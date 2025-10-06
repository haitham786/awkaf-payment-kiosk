import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  mobile_number: string;
  category: string;
  reference_number: string;
  amount_baisas: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mobile_number, category, reference_number, amount_baisas }: SMSRequest = await req.json();

    console.log('SMS Request:', { mobile_number, category, reference_number, amount_baisas });

    // Format amount
    const rials = Math.floor(amount_baisas / 1000);
    const baisas = amount_baisas % 1000;
    const formattedAmount = `${rials}.${baisas.toString().padStart(3, '0')} ر.ع`;

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

    // Create SMS message in Arabic
    const smsMessage = `شكراً لتبرعكم!
الفئة: ${categoryArabic}
المبلغ: ${formattedAmount}
رقم المعاملة: ${reference_number}
جزاكم الله خيراً`;

    // TODO: Integrate with SMS provider (e.g., Twilio, AWS SNS, etc.)
    // For now, we'll just log the message
    console.log('SMS Message to', mobile_number, ':', smsMessage);

    // Simulated SMS sending
    // In production, you would call your SMS provider's API here
    // Example with Twilio:
    // const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    // const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    // const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    // const twilioResponse = await fetch(
    //   `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
    //       'Content-Type': 'application/x-www-form-urlencoded',
    //     },
    //     body: new URLSearchParams({
    //       From: twilioPhoneNumber,
    //       To: mobile_number,
    //       Body: smsMessage,
    //     }),
    //   }
    // );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMS sent successfully',
        // For development/testing purposes
        preview: smsMessage
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