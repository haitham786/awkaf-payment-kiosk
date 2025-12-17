import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      mobile_number, 
      category, 
      reference_number, 
      pos_rrn,
      pos_auth_code,
      amount_baisas 
    }: SMSRequest = await req.json();

    console.log('SMS Request:', { mobile_number, category, reference_number, pos_rrn, amount_baisas });

    // Validate required fields
    if (!mobile_number || !reference_number || !amount_baisas) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
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
      education: 'تعليم'
    };

    const categoryArabic = categoryNames[category] || category;

    // Create SMS message in Arabic with BOTH references
    // System reference and POS/Bank reference must both be included
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

    console.log('SMS Message to', mobile_number, ':', smsMessage);

    // TODO: Integrate with SMS provider (e.g., local Omani SMS gateway)
    // The SMS should only be sent AFTER:
    // 1. POS returns successful final response
    // 2. POS reference values are captured and stored
    // 3. Transaction is saved in backend with both references
    // 4. Donor requests SMS by entering mobile number
    
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
    //     to: mobile_number,
    //     from: smsSenderId,
    //     message: smsMessage,
    //   }),
    // });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMS sent successfully',
        // For development/testing purposes
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
