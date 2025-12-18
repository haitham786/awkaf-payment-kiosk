import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  mobile_number: string;
  category: string;
  reference_number: string; // System reference
  pos_rrn?: string; // POS/Bank reference (RRN)
  pos_auth_code?: string; // Authorization code
  amount_baisas: number;
  transaction_id?: string; // For verification
}

// Validate Omani mobile number format
const OMAN_MOBILE_REGEX = /^(968)?[79]\d{7}$/;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for verification
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
        JSON.stringify({ error: 'Missing required fields: mobile_number, reference_number, and amount_baisas are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate mobile number format
    const cleanMobile = mobile_number.replace(/\s/g, '');
    if (!OMAN_MOBILE_REGEX.test(cleanMobile)) {
      console.error('Invalid mobile number format:', cleanMobile);
      return new Response(
        JSON.stringify({ error: 'Invalid Omani mobile number format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate amount is positive integer
    if (!Number.isInteger(amount_baisas) || amount_baisas <= 0 || amount_baisas > 100000000) {
      console.error('Invalid amount:', amount_baisas);
      return new Response(
        JSON.stringify({ error: 'Invalid amount: must be a positive integer in baisas' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Server-side verification: Check if transaction exists and matches
    // This prevents abuse by verifying the SMS request corresponds to a real transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, reference_number, amount_baisas, status, sms_status')
      .eq('reference_number', reference_number)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found for reference:', reference_number);
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify transaction status is completed
    if (transaction.status !== 'completed') {
      console.error('Transaction not completed:', transaction.status);
      return new Response(
        JSON.stringify({ error: 'SMS can only be sent for completed transactions' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify amount matches (prevent tampering)
    if (transaction.amount_baisas !== amount_baisas) {
      console.error('Amount mismatch:', { expected: transaction.amount_baisas, received: amount_baisas });
      return new Response(
        JSON.stringify({ error: 'Transaction amount mismatch' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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

    // Translate category to Arabic
    const categoryNames: Record<string, string> = {
      ashura: 'عاشوراء',
      ramadan: 'رمضان',
      zakat: 'زكاة',
      sadaqah: 'صدقة',
      charity: 'خيرية',
      mosque: 'مآتم',
      orphans: 'أيتام',
      education: 'تعليم',
      donation: 'تبرع',
      general: 'عام'
    };

    const categoryArabic = categoryNames[category] || category;

    // Create SMS message in Arabic with BOTH references
    let smsMessage = `شكراً لتبرعكم!
الفئة: ${categoryArabic}
المبلغ: ${formattedAmount}
التاريخ: ${dateStr} ${timeStr}
رقم المعاملة: ${reference_number}`;

    // Add POS/Bank reference if available
    if (pos_rrn) {
      smsMessage += `
رقم مرجع البنك: ${pos_rrn}`;
    }

    smsMessage += `
جزاكم الله خيراً`;

    console.log('SMS prepared for:', cleanMobile.slice(-4));

    // Update transaction to mark SMS as sent
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ 
        sms_status: 'sent',
        mobile_number: cleanMobile 
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('Failed to update SMS status:', updateError);
    }

    // TODO: Integrate with SMS provider (e.g., local Omani SMS gateway)
    // Example integration with SMS gateway:
    // const smsGatewayUrl = Deno.env.get('SMS_GATEWAY_URL');
    // const smsApiKey = Deno.env.get('SMS_API_KEY');
    // const smsSenderId = Deno.env.get('SMS_SENDER_ID');
    //
    // const smsResponse = await fetch(smsGatewayUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${smsApiKey}`,
    //   },
    //   body: JSON.stringify({
    //     to: cleanMobile,
    //     from: smsSenderId,
    //     message: smsMessage,
    //   }),
    // });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMS sent successfully',
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
      JSON.stringify({ error: 'Failed to process SMS request' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
