import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas
const VALID_CATEGORIES = ['ashura', 'ramadan', 'zakat', 'sadaqah', 'charity', 'mosque', 'orphans', 'education'] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OMAN_MOBILE_REGEX = /^\+968[0-9]{8}$/;

// Validation helper
function validatePaymentInput(data: any) {
  const errors: string[] = [];

  // Validate transaction ID
  if (!data.transactionId || typeof data.transactionId !== 'string' || !UUID_REGEX.test(data.transactionId)) {
    errors.push('Invalid transaction ID format');
  }

  // Validate kiosk ID
  if (!data.kioskId || typeof data.kioskId !== 'string' || !UUID_REGEX.test(data.kioskId)) {
    errors.push('Invalid kiosk ID format');
  }

  // Validate amount
  if (typeof data.amount !== 'number' || !Number.isInteger(data.amount)) {
    errors.push('Amount must be an integer');
  } else if (data.amount < 100) {
    errors.push('Amount must be at least 100 Baisa');
  } else if (data.amount > 100000000) {
    errors.push('Amount cannot exceed 100,000 OMR');
  }

  // Validate category
  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.push('Invalid category');
  }

  // Validate mobile number (optional but must be valid if provided)
  if (data.mobileNumber && (typeof data.mobileNumber !== 'string' || !OMAN_MOBILE_REGEX.test(data.mobileNumber))) {
    errors.push('Invalid Omani mobile number format (must be +968XXXXXXXX)');
  }

  return errors;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const requestData = await req.json();
    
    // Validate input
    const validationErrors = validatePaymentInput(requestData);
    if (validationErrors.length > 0) {
      console.error('Validation failed:', validationErrors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid payment data'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const { transactionId, kioskId, amount, category, mobileNumber, posResponse } = requestData;
    
    // Verify kiosk exists and is active
    const { data: kiosk, error: kioskError } = await supabaseClient
      .from('kiosks')
      .select('id, status')
      .eq('id', kioskId)
      .maybeSingle();

    if (kioskError || !kiosk || kiosk.status !== 'active') {
      console.error('Invalid kiosk:', kioskError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid kiosk configuration'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check for duplicate transaction
    const { data: existingTx } = await supabaseClient
      .from('transactions')
      .select('id')
      .eq('id', transactionId)
      .maybeSingle();

    if (existingTx) {
      console.error('Duplicate transaction ID');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Transaction already exists'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409 
        }
      );
    }
    
    console.log('Processing payment:', { transactionId, kioskId, amount, category });

    // Fetch category reference
    const { data: categoryData } = await supabaseClient
      .from('donation_categories')
      .select('category_reference')
      .eq('category_id', category)
      .maybeSingle();

    const categoryReference = categoryData?.category_reference || null;

    // Fetch kiosk reference
    const { data: kioskData } = await supabaseClient
      .from('kiosks')
      .select('reference_number')
      .eq('id', kioskId)
      .maybeSingle();

    const kioskReference = kioskData?.reference_number || null;

    // Extract POS data from request (sent by KIOSK app after OM-A880 POS returns final XML)
    const posRRN = posResponse?.rrn || posResponse?.RRN || null;
    const posAuthCode = posResponse?.authCode || posResponse?.AuthCode || null;
    const posTID = posResponse?.tid || posResponse?.TID || null;
    const posMID = posResponse?.mid || posResponse?.MID || null;
    const posResponseCode = posResponse?.responseCode || '00';
    const cardLastFour = posResponse?.cardLastFour || null;
    const cardType = posResponse?.cardType || null;

    // Determine if transaction is successful based on POS response
    // The KIOSK app only calls this function AFTER receiving successful final XML from POS
    const isSuccess = posResponseCode === '00' || posResponse?.success === true;

    console.log('POS Response Data:', { posRRN, posAuthCode, posTID, posMID, posResponseCode, isSuccess });

    // Create transaction record with both system reference and POS references
    // System reference (reference_number) is auto-generated by database trigger
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        id: transactionId,
        kiosk_id: kioskId,
        category,
        category_reference: categoryReference,
        amount_baisas: amount,
        mobile_number: mobileNumber,
        status: isSuccess ? 'completed' : 'failed',
        // POS/Bank reference fields (from OM-A880 final XML response)
        pos_rrn: posRRN,
        pos_auth_code: posAuthCode,
        pos_tid: posTID,
        pos_mid: posMID,
        pos_response_code: posResponseCode,
        // Card info
        payment_method: cardType,
        card_last_four: cardLastFour,
        payment_reference: posRRN, // Legacy field - also store RRN here for compatibility
        pos_response: posResponse, // Full POS response for debugging
        completed_at: isSuccess ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
      throw transactionError;
    }

    console.log('Transaction created:', {
      id: transaction.id,
      reference_number: transaction.reference_number, // System reference
      pos_rrn: transaction.pos_rrn, // Bank reference
    });

    return new Response(
      JSON.stringify({
        success: isSuccess,
        transaction: {
          id: transactionId,
          // Dual-reference model: both system and POS references
          reference_number: transaction.reference_number, // System reference (primary)
          pos_rrn: posRRN, // Bank reference (for reconciliation)
          pos_auth_code: posAuthCode,
          pos_tid: posTID,
          pos_mid: posMID,
          category_reference: categoryReference,
          kiosk_reference: kioskReference,
          status: isSuccess ? 'completed' : 'failed',
          card_type: cardType,
          card_last_four: cardLastFour,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Payment processing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Payment processing failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
