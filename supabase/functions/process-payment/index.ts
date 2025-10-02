import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { transactionId, kioskId, amount, category, mobileNumber } = await req.json();

    console.log('Processing payment:', { transactionId, kioskId, amount, category });

    // Create transaction record
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        id: transactionId,
        kiosk_id: kioskId,
        category,
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

    // Simulate POS device communication
    // In production, this would integrate with actual POS terminal API
    // Examples: Ingenico, Verifone, PAX terminals via their SDKs
    console.log('Communicating with POS terminal...');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time

    // Simulate payment result (90% success rate for demo)
    const isSuccess = Math.random() > 0.1;
    const mockPOSResponse = {
      terminal_id: 'POS-12345',
      transaction_ref: `TXN-${Date.now()}`,
      card_type: ['Visa', 'MasterCard', 'Mada'][Math.floor(Math.random() * 3)],
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
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});