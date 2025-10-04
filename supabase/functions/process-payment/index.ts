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

    // POS Device Integration: Ingenico AXIUM RX5000
    // In production, integrate with Ingenico AXIUM RX5000 terminal API
    // The terminal supports: VISA, MasterCard, Diners Club, Apple Pay, and Mal (Oman national payment system)
    // Integration would use Ingenico's SDK/API to communicate with the terminal
    // The amount (amount_baisas) will be charged to the donor's account when card is presented
    console.log('Communicating with Ingenico AXIUM RX5000 terminal...');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time

    // Simulate payment result (90% success rate for demo)
    const isSuccess = Math.random() > 0.1;
    const supportedPaymentMethods = ['Visa', 'MasterCard', 'Diners Club', 'Apple Pay', 'Mal'];
    const mockPOSResponse = {
      terminal_id: 'AXIUM-RX5000-001',
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