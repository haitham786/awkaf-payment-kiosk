import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildReceiptMessage, formatAmountOMR, formatArabicDateTime } from "../_shared/receiptMessage.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';
const OMAN_MOBILE_REGEX = /^(968)?[79]\d{7}$/;

interface WhatsAppRequest {
  mobile_number: string;
  category?: string;
  reference_number: string;
  pos_rrn?: string;
  amount_baisas: number;
  transaction_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body: WhatsAppRequest = await req.json();
    const { mobile_number, category, reference_number, pos_rrn, amount_baisas, transaction_id } = body;

    if (!mobile_number || !reference_number || !amount_baisas) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanMobile = mobile_number.replace(/[\s+]/g, '');
    if (!OMAN_MOBILE_REGEX.test(cleanMobile)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Omani mobile number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Number.isInteger(amount_baisas) || amount_baisas <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction
    let transaction: any = null;
    const { data: txByRef } = await supabaseAdmin
      .from('transactions')
      .select('id, reference_number, amount_baisas, status, whatsapp_status, category')
      .eq('reference_number', reference_number)
      .maybeSingle();
    if (txByRef) {
      transaction = txByRef;
    } else if (transaction_id) {
      const { data: txById } = await supabaseAdmin
        .from('transactions')
        .select('id, reference_number, amount_baisas, status, whatsapp_status, category')
        .eq('id', transaction_id)
        .maybeSingle();
      transaction = txById;
    }

    if (!transaction) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (transaction.status !== 'completed') {
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp can only be sent for completed transactions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (transaction.whatsapp_status === 'sent') {
      return new Response(
        JSON.stringify({ success: true, message: 'WhatsApp already sent', already_sent: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load WhatsApp settings
    const { data: waSettings } = await supabaseAdmin
      .from('whatsapp_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!waSettings || !waSettings.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp delivery is disabled. Enable it in admin → WhatsApp Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!waSettings.from_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp sender (From number) not configured.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Twilio connector not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format amount + date (shared with SMS for identical output)
    const formattedAmount = formatAmountOMR(amount_baisas);
    const { dateStr, timeStr } = formatArabicDateTime();

    // Resolve category title
    const { data: catData } = await supabaseAdmin
      .from('donation_categories')
      .select('title')
      .eq('category_id', transaction.category || category)
      .maybeSingle();
    const categoryArabic = catData?.title || category || 'عام';

    const intlMobile = cleanMobile.startsWith('968') ? cleanMobile : `968${cleanMobile}`;
    const to = `whatsapp:+${intlMobile}`;
    const from = waSettings.from_number.startsWith('whatsapp:')
      ? waSettings.from_number
      : `whatsapp:${waSettings.from_number}`;

    // Build the exact same Arabic message the SMS gateway sends, so both
    // channels deliver identical content, ordering, and formatting (including
    // the conditional bank-reference line).
    const receiptBody = buildReceiptMessage({
      categoryArabic,
      amount_baisas,
      reference: transaction.reference_number || reference_number,
      pos_rrn: pos_rrn || null,
    });

    const form = new URLSearchParams({
      To: to,
      From: from,
      Body: receiptBody,
    });

    // If an approved template is configured, include it as well. Twilio uses
    // the template when the recipient is outside the 24h customer-care window
    // (where free-form Body is rejected). The template should be authored to
    // render the same content using the positional variables below.
    if (waSettings.template_sid) {
      const contentVariables = {
        "1": categoryArabic,
        "2": formattedAmount,
        "3": `${dateStr} ${timeStr}`,
        "4": transaction.reference_number || reference_number,
        "5": pos_rrn || '-',
      };
      form.set('ContentSid', waSettings.template_sid);
      form.set('ContentVariables', JSON.stringify(contentVariables));
    }

    console.log('Twilio WhatsApp send →', to, '| template:', waSettings.template_sid || '(freeform)');


    const twilioRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const twilioJson: any = await twilioRes.json().catch(() => ({}));
    const ok = twilioRes.ok && (twilioJson.sid || twilioJson.status);
    const errorMsg = ok ? null : (twilioJson.message || `Twilio HTTP ${twilioRes.status}`);

    await supabaseAdmin
      .from('transactions')
      .update({
        whatsapp_status: ok ? 'sent' : 'failed',
        mobile_number: intlMobile,
      })
      .eq('id', transaction.id);

    return new Response(
      JSON.stringify({
        success: !!ok,
        message: ok ? 'WhatsApp sent successfully' : 'WhatsApp sending failed',
        error: errorMsg,
        sid: twilioJson.sid,
        status: twilioJson.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('send-whatsapp error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Failed to process WhatsApp request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
