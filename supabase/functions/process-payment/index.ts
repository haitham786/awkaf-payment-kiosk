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

    const { transactionId, kioskId, amount, category, mobileNumber } = requestData;
    
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

    // Create transaction record
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        id: transactionId,
        kiosk_id: kioskId,
        category,
        category_reference: categoryReference,
        amount_baisas: amount,
        mobile_number: mobileNumber,
        status: 'processing',
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
      throw transactionError;
    }

    // POS Device Integration: Generic POS Terminal
    // In production, integrate with your POS terminal API
    // The terminal supports: VISA, MasterCard, Diners Club, Apple Pay, and Mal (Oman national payment system)
    // Integration would use the POS device's SDK/API to communicate with the terminal
    // The amount (amount_baisas) will be charged to the donor's account when card is presented
    console.log('Communicating with POS terminal...');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time

    // Simulate payment result (90% success rate for demo)
    const isSuccess = Math.random() > 0.1;
    const supportedPaymentMethods = ['Visa', 'MasterCard', 'Diners Club', 'Apple Pay', 'Mal'];
    const mockPOSResponse = {
      terminal_id: 'POS-TERM-001',
      transaction_ref: `TXN-${Date.now()}`,
      card_type: supportedPaymentMethods[Math.floor(Math.random() * supportedPaymentMethods.length)],
      card_last_four: Math.floor(1000 + Math.random() * 9000).toString(),
      approval_code: isSuccess ? `APP${Math.floor(100000 + Math.random() * 900000)}` : null,
      response_code: isSuccess ? '00' : '51',
      response_message: isSuccess ? 'Approved' : 'Insufficient Funds',
      timestamp: new Date().toISOString(),
    };

    console.log('POS Response:', mockPOSResponse);

    // Update transaction with POS response
    const { error: updateError } = await supabaseClient
      .from('transactions')
      .update({
        status: isSuccess ? 'completed' : 'failed',
        payment_method: mockPOSResponse.card_type,
        card_last_four: mockPOSResponse.card_last_four,
        payment_reference: mockPOSResponse.transaction_ref,
        pos_response: mockPOSResponse,
        completed_at: isSuccess ? new Date().toISOString() : null,
        error_message: isSuccess ? null : mockPOSResponse.response_message,
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      throw updateError;
    }

    // If mobile number provided and payment successful, simulate sending SMS receipt
    if (isSuccess && mobileNumber) {
      console.log(`Simulating SMS receipt to ${mobileNumber}`);
      // In production, integrate with SMS gateway like Twilio, AWS SNS, or local provider
      
      await supabaseClient
        .from('transactions')
        .update({ receipt_sent: true })
        .eq('id', transactionId);
    }

    // Simulate thermal printer receipt
    if (isSuccess) {
      console.log('Printing receipt...');
      // In production, send print command to thermal printer via USB/Network
      
      await supabaseClient
        .from('transactions')
        .update({ receipt_printed: true })
        .eq('id', transactionId);
    }

    return new Response(
      JSON.stringify({
        success: isSuccess,
        transaction: {
          id: transactionId,
          reference_number: transaction.reference_number,
          category_reference: categoryReference,
          kiosk_reference: kioskReference,
          status: isSuccess ? 'completed' : 'failed',
          ...mockPOSResponse,
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