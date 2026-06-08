import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildReceiptMessage } from "../_shared/receiptMessage.ts";


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

// Default Omantel iSmart SMS endpoint (Infocomm)
const DEFAULT_ISMART_URL = 'https://www.ismartsms.net/iBulkSMS/HttpWS/SMSDynamicRefIntlAPI.aspx';

// iSmart return-code map (per Infocomm API document Rev 1.0)
const ISMART_RETURN_CODES: Record<string, string> = {
  '1': 'Message pushed successfully.',
  '2': 'Company does not exist.',
  '3': 'User or password is wrong.',
  '4': 'Credit is low.',
  '5': 'Message is blank.',
  '6': 'Message length exceeded.',
  '7': 'Account is inactive.',
  '8': 'Mobile number length is empty.',
  '9': 'Invalid mobile number.',
  '10': 'Invalid language.',
  '11': 'Unknown error.',
  '12': 'Account blocked by administrator (concurrent login failures).',
  '13': 'Account expired.',
  '14': 'Credit expired.',
  '15': 'Invalid HTTP request or wrong parameter fields.',
  '16': 'Invalid date-time parameter.',
  '17': 'Web service user ID not registered.',
  '18': 'User not registered to use HTTP GET method API.',
  '19': 'Header not registered with Infocomm.',
  '20': 'Client IP address has been blocked.',
};

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

    if (transaction.status !== 'completed') {
      console.error('Transaction not completed:', transaction.status);
      return new Response(
        JSON.stringify({ success: false, error: 'SMS can only be sent for completed transactions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Fetch category title from database
    const { data: catData } = await supabaseAdmin
      .from('donation_categories')
      .select('title')
      .eq('category_id', transaction.category || category)
      .maybeSingle();

    const categoryArabic = catData?.title || category || 'عام';

    // Use the system reference number from the transaction record
    const smsReference = transaction.reference_number || reference_number;

    // Build the receipt body via the shared helper so SMS and WhatsApp
    // deliver byte-identical content, ordering, and formatting.
    const smsMessage = buildReceiptMessage({
      categoryArabic,
      amount_baisas,
      reference: smsReference,
      pos_rrn: pos_rrn || null,
    });

    console.log('SMS prepared for:', cleanMobile.slice(-4));


    // Load iSmart credentials from sms_settings
    const { data: smsSettings } = await supabaseAdmin
      .from('sms_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const apiUrl = (smsSettings?.api_endpoint && smsSettings.api_endpoint.trim()) || DEFAULT_ISMART_URL;
    const userId = smsSettings?.api_username?.trim();
    const password = smsSettings?.api_password?.trim();
    const header = (smsSettings?.sender_id || '').trim().slice(0, 11);

    let smsSent = false;
    let smsError: string | null = null;
    let returnCode: string | null = null;
    let gatewayResponse: string | null = null;

    if (!userId || !password || !header) {
      smsError = 'iSmart SMS gateway not configured. Set User ID, Password, and Sender Header in admin → SMS Settings.';
      console.warn(smsError);
    } else {
      try {
        // Format mobile to international (Omantel iSmart expects country-code prefix, no '+')
        const intlMobile = cleanMobile.startsWith('968') ? cleanMobile : `968${cleanMobile}`;

        // Reference id: 3-6 digit number derived from system reference (digits only, last 6)
        const refDigits = smsReference.replace(/\D/g, '').slice(-6) || '100';
        const referenceIds = refDigits.padStart(3, '0').slice(0, 6);

        // Lang=64 → Arabic (message body is Arabic)
        const formBody = new URLSearchParams({
          UserId: userId,
          Password: password,
          MobileNo: intlMobile,
          Message: smsMessage,
          Lang: '64',
          Header: header,
          referenceIds: referenceIds,
        });

        console.log('Posting to iSmart gateway:', apiUrl, '| header:', header, '| ref:', referenceIds);

        const smsResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/plain, */*',
          },
          body: formBody.toString(),
        });

        gatewayResponse = (await smsResponse.text()).trim();
        console.log('iSmart raw response:', gatewayResponse, '| HTTP', smsResponse.status);

        // Extract leading integer from response (gateway sometimes returns extra whitespace/markup)
        const match = gatewayResponse.match(/\d+/);
        returnCode = match ? match[0] : null;

        if (!smsResponse.ok) {
          smsError = `Gateway HTTP ${smsResponse.status}: ${gatewayResponse.slice(0, 200)}`;
        } else if (returnCode === '1') {
          smsSent = true;
        } else if (returnCode && ISMART_RETURN_CODES[returnCode]) {
          smsError = `iSmart code ${returnCode}: ${ISMART_RETURN_CODES[returnCode]}`;
        } else {
          smsError = `Unrecognised iSmart response: ${gatewayResponse.slice(0, 200)}`;
        }
      } catch (gatewayError: any) {
        smsError = `Gateway exception: ${gatewayError.message}`;
        console.error('iSmart gateway exception:', gatewayError);
      }
    }

    // Update transaction with delivery status
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
        return_code: returnCode,
        gateway_response: gatewayResponse,
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
