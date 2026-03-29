import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const THAWANI_API_KEY = Deno.env.get('THAWANI_API_KEY');
    const THAWANI_PUBLISHABLE_KEY = Deno.env.get('THAWANI_PUBLISHABLE_KEY');
    const THAWANI_ENV = Deno.env.get('THAWANI_ENV') || 'test'; // 'test' or 'live'

    if (!THAWANI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thawani API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const baseUrl = THAWANI_ENV === 'live'
      ? 'https://checkout.thawani.om/api/v1'
      : 'https://uatcheckout.thawani.om/api/v1';

    const checkoutBaseUrl = THAWANI_ENV === 'live'
      ? 'https://checkout.thawani.om'
      : 'https://uatcheckout.thawani.om';

    const body = await req.json();
    const { action } = body;

    if (action === 'create_session') {
      const { amount, category, transactionId, kioskId, successUrl, cancelUrl, categoryReference } = body;

      if (!amount || !category || !transactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Thawani expects amount in baisas (smallest unit)
      // amount is already in baisas from the kiosk app
      const amountInBaisas = Math.round(amount);

      const sessionData = {
        client_reference_id: transactionId,
        mode: 'payment',
        products: [
          {
            name: `Donation - ${category}`,
            unit_amount: amountInBaisas,
            quantity: 1,
          },
        ],
        success_url: successUrl || `${req.headers.get('origin')}/kiosk/thank-you?category=${category}&amount=${amount}&ref=${transactionId}&catRef=${categoryReference || ''}`,
        cancel_url: cancelUrl || `${req.headers.get('origin')}/kiosk/error?category=${category}&amount=${amount}`,
        metadata: {
          kiosk_id: kioskId,
          category,
          category_reference: categoryReference || '',
          transaction_id: transactionId,
        },
      };

      console.log('Creating Thawani session:', { transactionId, amount: amountInBaisas, category });

      const response = await fetch(`${baseUrl}/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'thawani-api-key': THAWANI_API_KEY,
        },
        body: JSON.stringify(sessionData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('Thawani session creation failed:', result);
        return new Response(
          JSON.stringify({ success: false, error: result.description || 'Failed to create payment session' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const sessionId = result.data?.session_id;
      const checkoutUrl = `${checkoutBaseUrl}/pay/${sessionId}?key=${THAWANI_PUBLISHABLE_KEY}`;

      // Create a pending transaction record
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      );

      await supabaseClient.from('transactions').insert({
        id: transactionId,
        kiosk_id: kioskId,
        category,
        category_reference: categoryReference || null,
        amount_baisas: amountInBaisas,
        status: 'pending',
        payment_method: 'thawani_gateway',
        payment_reference: sessionId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          session_id: sessionId,
          checkout_url: checkoutUrl,
          publishable_key: THAWANI_PUBLISHABLE_KEY,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'check_session') {
      const { sessionId } = body;

      if (!sessionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing session ID' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const response = await fetch(`${baseUrl}/checkout/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'thawani-api-key': THAWANI_API_KEY,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to check session status' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // If payment is completed, update transaction
      if (result.data?.payment_status === 'paid') {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        );

        await supabaseClient
          .from('transactions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            pos_response: result.data,
          })
          .eq('payment_reference', sessionId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          session: result.data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  } catch (error) {
    console.error('Thawani checkout error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
