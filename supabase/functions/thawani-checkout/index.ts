import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";

const ALLOWED_TRANSACTION_CATEGORIES = new Set(['donation', 'zakat', 'sadaqah', 'general']);

const normalizeTransactionCategory = (category: string) => (
  ALLOWED_TRANSACTION_CATEGORIES.has(category) ? category : 'general'
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    const createSessionWithConfig = async (thawaniConfig: ReturnType<typeof resolveThawaniConfig>, sessionData: Record<string, unknown>) => {
      const response = await fetch(`${thawaniConfig.baseUrl}/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'thawani-api-key': thawaniConfig.apiKey || '',
        },
        body: JSON.stringify(sessionData),
      });

      const result = await response.json();
      return { response, result };
    };

    const resolveThawaniConfig = (mode?: string) => {
      const normalizedMode = mode === 'live' ? 'live' : 'test';
      const fallbackEnv = Deno.env.get('THAWANI_ENV') === 'live' ? 'live' : 'test';
      const activeMode = mode ? normalizedMode : fallbackEnv;
      const isLive = activeMode === 'live';

      return {
        env: activeMode,
        apiKey: isLive
          ? Deno.env.get('THAWANI_LIVE_API_KEY') || Deno.env.get('THAWANI_API_KEY')
          : Deno.env.get('THAWANI_TEST_API_KEY') || Deno.env.get('THAWANI_API_KEY'),
        publishableKey: isLive
          ? Deno.env.get('THAWANI_LIVE_PUBLISHABLE_KEY') || Deno.env.get('THAWANI_PUBLISHABLE_KEY')
          : Deno.env.get('THAWANI_TEST_PUBLISHABLE_KEY') || Deno.env.get('THAWANI_PUBLISHABLE_KEY'),
        baseUrl: isLive ? 'https://checkout.thawani.om/api/v1' : 'https://uatcheckout.thawani.om/api/v1',
        checkoutBaseUrl: isLive ? 'https://checkout.thawani.om' : 'https://uatcheckout.thawani.om',
      };
    };

    // Use service role key for DB operations (needed for UPDATE which requires admin RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { action } = body;

    if (action === 'create_session') {
      const { amount, category, transactionId, kioskId, successUrl, cancelUrl, categoryReference, gatewayMode } = body;
      const normalizedCategory = normalizeTransactionCategory(category);
      const thawaniConfig = resolveThawaniConfig(gatewayMode);

      if (!amount || !category || !transactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      if (!thawaniConfig.apiKey || !thawaniConfig.publishableKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thawani gateway keys are not configured for the selected environment' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Validate caller-supplied redirect URLs against an allowlist of
      // trusted origins. This blocks "open redirect" abuse where an
      // attacker tricks Thawani into bouncing the donor to a phishing
      // site after a legitimate payment.
      const ALLOWED_REDIRECT_ORIGINS = new Set<string>([
        'https://awkaf-payment-kiosk.lovable.app',
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:4173',
      ]);
      const isAllowedRedirect = (raw: string | undefined): boolean => {
        if (!raw) return true; // optional → server-side default used
        try {
          const u = new URL(raw);
          if (ALLOWED_REDIRECT_ORIGINS.has(u.origin)) return true;
          if (u.hostname.endsWith('.lovable.app')) return true;
          if (u.hostname.endsWith('.lovableproject.com')) return true;
          if (u.protocol === 'capacitor:' || u.protocol === 'ionic:' || u.protocol === 'file:') return true;
          return false;
        } catch {
          return false;
        }
      };
      if (!isAllowedRedirect(successUrl) || !isAllowedRedirect(cancelUrl)) {
        console.warn('Rejected non-allowlisted redirect URL', { successUrl, cancelUrl });
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid redirect URL' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Thawani expects amount in baisas (smallest unit)
      const amountInBaisas = Math.round(amount);

      // Fetch category title for Thawani product name
      const { data: catData } = await supabaseClient
        .from('donation_categories')
        .select('title, title_en, category_reference')
        .eq('category_id', category)
        .maybeSingle();

      const categoryTitle = catData?.title_en || catData?.title || category;
      const resolvedCategoryReference = categoryReference || catData?.category_reference || '';

      const sessionData = {
        client_reference_id: transactionId,
        mode: 'payment',
        products: [
          {
            name: `Donation - ${categoryTitle}`,
            unit_amount: amountInBaisas,
            quantity: 1,
          },
        ],
        success_url: successUrl || `${req.headers.get('origin')}/kiosk/thank-you?category=${category}&amount=${amount}&transactionId=${transactionId}&paymentMethod=gateway&catRef=${resolvedCategoryReference}`,
        cancel_url: cancelUrl || `${req.headers.get('origin')}/kiosk/error?category=${category}&amount=${amount}&source=gateway&error=payment`,
        metadata: {
          kiosk_id: kioskId,
          category,
          category_reference: resolvedCategoryReference,
          transaction_id: transactionId,
        },
      };

      console.log('Creating Thawani session:', { transactionId, amount: amountInBaisas, category, gatewayMode: thawaniConfig.env });

      let activeConfig = thawaniConfig;
      let { response, result } = await createSessionWithConfig(activeConfig, sessionData);

      if ((!response.ok || !result.success) && (result?.detail === 'Api key invalid' || result?.description === 'Api key invalid')) {
        const alternateConfig = resolveThawaniConfig(activeConfig.env === 'live' ? 'test' : 'live');

        if (alternateConfig.apiKey && alternateConfig.publishableKey) {
          console.warn('Retrying Thawani session creation with alternate environment', { original: activeConfig.env, fallback: alternateConfig.env });
          const retryResult = await createSessionWithConfig(alternateConfig, sessionData);
          response = retryResult.response;
          result = retryResult.result;

          if (response.ok && result.success) {
            activeConfig = alternateConfig;
          }
        }
      }

      if (!response.ok || !result.success) {
        console.error('Thawani session creation failed:', result);
        return new Response(
          JSON.stringify({ success: false, error: result.detail || result.description || 'Failed to create payment session' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const sessionId = result.data?.session_id;
      const checkoutUrl = `${activeConfig.checkoutBaseUrl}/pay/${sessionId}?key=${activeConfig.publishableKey}`;

      // Create a pending transaction record
      const { data: generatedReference, error: referenceError } = await supabaseClient.rpc('generate_reference_number');

      if (referenceError) {
        console.error('Reference generation error:', referenceError);
      }

      const { error: insertError } = await supabaseClient.from('transactions').insert({
        id: transactionId,
        kiosk_id: kioskId,
        category: normalizedCategory,
        category_reference: resolvedCategoryReference,
        amount_baisas: amountInBaisas,
        status: 'pending',
        payment_method: 'thawani_gateway',
        payment_reference: sessionId,
        reference_number: generatedReference || null,
        pos_response: { gateway_mode: activeConfig.env },
      });

      if (insertError) {
        console.error('Transaction insert error:', insertError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          session_id: sessionId,
          checkout_url: checkoutUrl,
          publishable_key: activeConfig.publishableKey,
          gateway_mode: activeConfig.env,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'check_session') {
      const { sessionId, transactionId } = body;
      let thawaniConfig = resolveThawaniConfig(body.gatewayMode);

      if (!thawaniConfig.apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thawani API key not configured for the selected environment' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      if (!sessionId && !transactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing session ID or transaction ID' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // If we have a transactionId, look up the session from the transaction record
      let resolvedSessionId = sessionId;
      if (!resolvedSessionId && transactionId) {
        const { data: txData } = await supabaseClient
          .from('transactions')
          .select('payment_reference, status, reference_number')
          .eq('id', transactionId)
          .maybeSingle();

        if (txData) {
          // If already completed, return immediately
          if (txData.status === 'completed') {
            return new Response(
              JSON.stringify({
                success: true,
                already_completed: true,
                transaction: {
                  reference_number: txData.reference_number,
                  status: 'completed',
                },
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
          resolvedSessionId = txData.payment_reference;

          const storedGatewayMode = (txData as any)?.pos_response?.gateway_mode;
          if (storedGatewayMode === 'live' || storedGatewayMode === 'test') {
            thawaniConfig = resolveThawaniConfig(storedGatewayMode);
          }
        }
      }

      if (!resolvedSessionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not resolve session ID' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const response = await fetch(`${thawaniConfig.baseUrl}/checkout/session/${resolvedSessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'thawani-api-key': thawaniConfig.apiKey,
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
        const metadata = result.data?.metadata || {};
        const normalizedCategory = normalizeTransactionCategory(metadata.category || 'general');
        const { data: existingTx } = await supabaseClient
          .from('transactions')
          .select('id, reference_number')
          .eq('payment_reference', resolvedSessionId)
          .maybeSingle();

        let updatedTx = existingTx;
        let updateError = null;

        if (existingTx) {
          const response = await supabaseClient
            .from('transactions')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              pos_response: result.data,
              payment_method: 'thawani_gateway',
              pos_response_code: '00',
            })
            .eq('id', existingTx.id)
            .select('reference_number, id')
            .maybeSingle();

          updatedTx = response.data;
          updateError = response.error;
        } else {
          const { data: generatedReference } = await supabaseClient.rpc('generate_reference_number');
          const response = await supabaseClient
            .from('transactions')
            .insert({
              id: metadata.transaction_id || transactionId,
              kiosk_id: metadata.kiosk_id || null,
              category: normalizedCategory,
              category_reference: metadata.category_reference || null,
              amount_baisas: Number(result.data?.amount ?? 0),
              status: 'completed',
              completed_at: new Date().toISOString(),
              pos_response: result.data,
              payment_method: 'thawani_gateway',
              payment_reference: resolvedSessionId,
              reference_number: generatedReference || null,
              pos_response_code: '00',
            })
            .select('reference_number, id')
            .single();

          updatedTx = response.data;
          updateError = response.error;
        }

        if (updateError) {
          console.error('Transaction update error:', updateError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            payment_completed: true,
            session: result.data,
            transaction: {
              reference_number: updatedTx?.reference_number || null,
              id: updatedTx?.id || null,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment_completed: false,
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
