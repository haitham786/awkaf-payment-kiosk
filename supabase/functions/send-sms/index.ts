import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  mobile_number: string;
  category: string;
  reference_number: string;
  pos_rrn?: string;
  pos_auth_code?: string;
  amount_baisas: number;
  transaction_id?: string;
}

// Validate Omani mobile number format (with or without country code)
const OMAN_MOBILE_REGEX = /^(968)?[79]\d{7}$/;

// Categories are dynamic - no hardcoded validation needed

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const { 
      mobile_number, 
      category, 
      reference_number, 
      pos_rrn,
      pos_auth_code,
      amount_baisas,
      transaction_id
    }: SMSRequest = await req.json();

    console.log('SMS Request received:', { 
      mobile_number: mobile_number ? '***' + mobile_number.slice(-4) : 'missing', 
      category, 
      reference_number, 
      pos_rrn,
      amount_baisas,
      transaction_id
    });

    // Validate required fields
    if (!mobile_number || !reference_number || !amount_baisas) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: mobile_number, reference_number, and amount_baisas are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate mobile number format
    const cleanMobile = mobile_number.replace(/[\s+]/g, '');
    if (!OMAN_MOBILE_REGEX.test(cleanMobile)) {
      console.error('Invalid mobile number format:', cleanMobile);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Omani mobile number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount is positive integer
    if (!Number.isInteger(amount_baisas) || amount_baisas <= 0 || amount_baisas > 100000000) {
      console.error('Invalid amount:', amount_baisas);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid amount: must be a positive integer in baisas (1-100,000,000)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side verification: Check if transaction exists
    // Try by reference_number first, then by transaction ID
    let transaction = null;
    let txError = null;

    const { data: txByRef, error: refError } = await supabaseAdmin
      .from('transactions')
      .select('id, reference_number, amount_baisas, status, sms_status, category')
      .eq('reference_number', reference_number)
      .maybeSingle();

    if (txByRef) {
      transaction = txByRef;
    } else if (transaction_id) {
      // Fallback: look up by transaction UUID
      const { data: txById, error: idError } = await supabaseAdmin
        .from('transactions')
        .select('id, reference_number, amount_baisas, status, sms_status, category')
        .eq('id', transaction_id)
        .maybeSingle();
      transaction = txById;
      txError = idError;
    } else {
      txError = refError;
    }

    if (txError) {
      console.error('Error fetching transaction:', txError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error verifying transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transaction) {
      console.error('Transaction not found for reference:', reference_number, 'or id:', transaction_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction status is completed
    if (transaction.status !== 'completed') {
      console.error('Transaction not completed:', transaction.status);
      return new Response(
        JSON.stringify({ success: false, error: 'SMS can only be sent for completed transactions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if SMS was already sent (prevent duplicate sends)
    if (transaction.sms_status === 'sent') {
      console.log('SMS already sent for transaction:', reference_number);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'SMS was already sent for this transaction',
          already_sent: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format amount
    const rials = Math.floor(amount_baisas / 1000);
    const baisas = amount_baisas % 1000;
    const formattedAmount = `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;

    // Format date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-OM', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const timeStr = now.toLocaleTimeString('ar-OM', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Fetch category title from database for SMS message
    const { data: catData } = await supabaseAdmin
      .from('donation_categories')
      .select('title')
      .eq('category_id', transaction.category || category)
      .maybeSingle();

    const categoryArabic = catData?.title || category || 'عام';

    // Use the system reference number from the transaction record
    const smsReference = transaction.reference_number || reference_number;

    // Create SMS message in Arabic with BOTH references
    let smsMessage = `شكراً لتبرعكم!
الفئة: ${categoryArabic}
المبلغ: ${formattedAmount}
التاريخ: ${dateStr} ${timeStr}
رقم المعاملة: ${smsReference}`;

    // Add POS/Bank reference if available
    if (pos_rrn) {
      smsMessage += `
رقم مرجع البنك: ${pos_rrn}`;
    }

    smsMessage += `
جزاكم الله خيراً`;

    console.log('SMS prepared for:', cleanMobile.slice(-4));

    // Get SMS gateway credentials from database
    const { data: smsSettings, error: settingsError } = await supabaseAdmin
      .from('sms_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    let smsSent = false;
    let smsError = null;

    // Only attempt to send if SMS gateway is configured in database
    if (smsSettings?.api_endpoint && smsSettings?.api_key) {
      try {
        console.log('Attempting to send SMS via gateway...');
        
        const smsResponse = await fetch(smsSettings.api_endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${smsSettings.api_key}`,
          },
          body: JSON.stringify({
            to: cleanMobile.startsWith('968') ? cleanMobile : `968${cleanMobile}`,
            from: smsSettings.sender_id || 'Awkaf',
            message: smsMessage,
            username: smsSettings.api_username,
            password: smsSettings.api_password,
          }),
        });

        if (smsResponse.ok) {
          smsSent = true;
          console.log('SMS sent successfully via gateway');
        } else {
          const errorText = await smsResponse.text();
          smsError = `Gateway error: ${smsResponse.status} - ${errorText}`;
          console.error('SMS gateway error:', smsError);
        }
      } catch (gatewayError: any) {
        smsError = `Gateway exception: ${gatewayError.message}`;
        console.error('SMS gateway exception:', gatewayError);
      }
    } else {
      console.log('SMS gateway not configured in database');
      smsError = 'SMS gateway not configured. Please configure SMS settings in the admin panel.';
    }

    // Update transaction to mark SMS status
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ 
        sms_status: smsSent ? 'sent' : 'failed',
        mobile_number: cleanMobile.startsWith('968') ? cleanMobile : `968${cleanMobile}`
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('Failed to update SMS status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: smsSent, 
        message: smsSent ? 'SMS sent successfully' : 'SMS sending failed',
        error: smsError,
        // For development/testing purposes only
        preview: smsMessage,
        references: {
          system_reference: reference_number,
          bank_reference: pos_rrn || null,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in send-sms function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to process SMS request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
