import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";


// Validation schemas
// Categories are now dynamic - validated against the database instead of hardcoded list
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OMAN_MOBILE_REGEX = /^\+968[0-9]{8}$/;
const ALLOWED_TRANSACTION_CATEGORIES = new Set(['donation', 'zakat', 'sadaqah', 'general']);

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_KIOSK = 20; // Max 20 requests per kiosk per minute
const MAX_REQUESTS_PER_IP = 30; // Max 30 requests per IP per minute

// In-memory rate limit store (resets on cold start, which is acceptable for edge functions)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired rate limit entries
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Check rate limit for a given key
function checkRateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number; resetIn: number } {
  cleanupRateLimits();
  
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // Create new window
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: maxRequests - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }
  
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetTime - now };
}

// Get client IP from request headers
function getClientIP(req: Request): string {
  // Check common headers for real IP (behind proxies/load balancers)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  // Fallback - connection info not available in Deno Deploy
  return 'unknown';
}

// Validation helper
function validatePaymentInput(data: any) {
  const errors: string[] = [];

  // Validate transaction ID
  if (!data.transactionId || typeof data.transactionId !== 'string' || !UUID_REGEX.test(data.transactionId)) {
    errors.push('Invalid transaction ID format');
  }

  // Validate kiosk ID
  if (!data.kioskId || typeof data.kioskId !== 'string' || !UUID_REGEX.test(data.kioskId)) {
    errors.push('Invalid kiosk ID format');
  }

  // Validate amount
  if (typeof data.amount !== 'number' || !Number.isInteger(data.amount)) {
    errors.push('Amount must be an integer');
  } else if (data.amount < 100) {
    errors.push('Amount must be at least 100 Baisa');
  } else if (data.amount > 100000000) {
    errors.push('Amount cannot exceed 100,000 OMR');
  }

  // Validate category (basic string check - full validation against DB happens later)
  if (!data.category || typeof data.category !== 'string' || data.category.length > 100) {
    errors.push('Invalid category');
  }

  // Validate mobile number (optional but must be valid if provided)
  if (data.mobileNumber && (typeof data.mobileNumber !== 'string' || !OMAN_MOBILE_REGEX.test(data.mobileNumber))) {
    errors.push('Invalid Omani mobile number format (must be +968XXXXXXXX)');
  }

  return errors;
}

function normalizeTransactionCategory(category: string) {
  return ALLOWED_TRANSACTION_CATEGORIES.has(category) ? category : 'general';
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(req);
    
    // Check IP-based rate limit first (before parsing body)
    const ipRateLimit = checkRateLimit(`ip:${clientIP}`, MAX_REQUESTS_PER_IP);
    if (!ipRateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(ipRateLimit.resetIn / 1000)
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(ipRateLimit.resetIn / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(ipRateLimit.resetIn / 1000))
          },
          status: 429 
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const requestData = await req.json();
    
    // Validate input
    const validationErrors = validatePaymentInput(requestData);
    if (validationErrors.length > 0) {
      console.error('Validation failed:', validationErrors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid payment data'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const { transactionId, kioskId, amount, category, mobileNumber, posResponse, softPosResult, paymentType, provider, thawaniReference, offlineProcessed, offlinePaymentResult } = requestData;
    const normalizedCategory = normalizeTransactionCategory(category);
    
    // Check kiosk-based rate limit
    const kioskRateLimit = checkRateLimit(`kiosk:${kioskId}`, MAX_REQUESTS_PER_KIOSK);
    if (!kioskRateLimit.allowed) {
      console.warn(`Rate limit exceeded for kiosk: ${kioskId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many requests from this kiosk. Please wait before retrying.',
          retryAfter: Math.ceil(kioskRateLimit.resetIn / 1000)
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(kioskRateLimit.resetIn / 1000)),
            'X-RateLimit-Remaining': '0'
          },
          status: 429 
        }
      );
    }
    
    // Verify kiosk exists and is active
    const { data: kiosk, error: kioskError } = await supabaseClient
      .from('kiosks')
      .select('id, status')
      .eq('id', kioskId)
      .maybeSingle();

    if (kioskError || !kiosk || kiosk.status !== 'active') {
      console.error('Invalid kiosk:', kioskError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid kiosk configuration'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check for duplicate transaction
    const { data: existingTx } = await supabaseClient
      .from('transactions')
      .select('id')
      .eq('id', transactionId)
      .maybeSingle();

    if (existingTx) {
      console.error('Duplicate transaction ID');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Transaction already exists'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409 
        }
      );
    }
    
    console.log('Processing payment:', { transactionId, kioskId, amount, category, clientIP: clientIP.substring(0, 8) + '...' });

    // Fetch category reference
    const { data: categoryData } = await supabaseClient
      .from('donation_categories')
      .select('category_reference')
      .eq('category_id', category)
      .maybeSingle();

    const categoryReference = categoryData?.category_reference || null;

    const { data: generatedReference, error: referenceError } = await supabaseClient.rpc('generate_reference_number');
    if (referenceError) {
      console.error('Reference generation error:', referenceError);
      throw referenceError;
    }

    // Fetch kiosk reference
    const { data: kioskData } = await supabaseClient
      .from('kiosks')
      .select('reference_number')
      .eq('id', kioskId)
      .maybeSingle();

    const kioskReference = kioskData?.reference_number || null;

    // Gate test_payment behind an explicit environment flag so attackers
    // cannot inflate donation totals by posting forged test transactions.
    if (paymentType === 'test_payment') {
      const allowTest = (Deno.env.get('ALLOW_TEST_PAYMENTS') ?? '').toLowerCase() === 'true';
      if (!allowTest) {
        console.warn('Rejected test_payment: ALLOW_TEST_PAYMENTS is not enabled');
        return new Response(
          JSON.stringify({ success: false, error: 'Test payments are disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
        );
      }
    }

    // Extract POS data from request (Soft POS, test mode, or Payment Gateway)
    const paymentResponse = posResponse || softPosResult || {};
    const posRRN = paymentResponse?.rrn || paymentResponse?.RRN || paymentResponse?.paymentId || null;
    const posAuthCode = paymentResponse?.authCode || paymentResponse?.AuthCode || paymentResponse?.approvalCode || null;
    const posTID = paymentResponse?.tid || paymentResponse?.TID || null;
    const posMID = paymentResponse?.mid || paymentResponse?.MID || null;
    const posResponseCode = paymentResponse?.responseCode || '00';
    const cardLastFour = paymentResponse?.cardLastFour || null;
    const cardType = paymentResponse?.cardType || null;

    // For Thawani Lamsa payments, verify the session server-side against the
    // Thawani API using the supplied reference. This prevents callers from
    // forging a "success" response without an actual paid Thawani session.
    let verifiedSuccess: boolean | null = null;
    if (paymentType === 'soft_pos' && provider === 'thawani' && thawaniReference) {
      try {
        const thawaniApiKey = Deno.env.get('THAWANI_API_KEY');
        const thawaniEnv = (Deno.env.get('THAWANI_ENV') ?? 'test').toLowerCase();
        const baseUrl = thawaniEnv === 'production'
          ? 'https://checkout.thawani.om'
          : 'https://uatcheckout.thawani.om';
        if (thawaniApiKey) {
          const verifyRes = await fetch(`${baseUrl}/api/v1/checkout/session/${encodeURIComponent(thawaniReference)}`, {
            headers: { 'Thawani-Api-Key': thawaniApiKey, 'Content-Type': 'application/json' },
          });
          if (verifyRes.ok) {
            const body = await verifyRes.json();
            const status = body?.data?.payment_status || body?.data?.status || '';
            verifiedSuccess = String(status).toLowerCase() === 'paid' || String(status).toLowerCase() === 'success';
          } else {
            console.warn('Thawani verification request failed', verifyRes.status);
            verifiedSuccess = false;
          }
        }
      } catch (verifyErr) {
        console.error('Thawani verification error', verifyErr);
        verifiedSuccess = false;
      }
    }

    // Determine if transaction is successful. When we have a verified result
    // from Thawani, it always wins over caller-supplied claims.
    const callerClaimedSuccess = posResponseCode === '00' || paymentResponse?.success === true;
    const isSuccess = verifiedSuccess !== null ? verifiedSuccess : callerClaimedSuccess;

    // Determine payment method
    const resolvedPaymentMethod = paymentType === 'soft_pos'
      ? (provider === 'thawani' ? 'thawani_lamsa' : 'soft_pos')
      : paymentType === 'test_payment'
        ? 'test_payment'
        : cardType || 'card';

    console.log('POS Response Data:', { posRRN, posAuthCode, posTID, posMID, posResponseCode, isSuccess, verifiedSuccess });


    // Create transaction record with both system reference and POS references
    // System reference (reference_number) is auto-generated by database trigger
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        id: transactionId,
        kiosk_id: kioskId,
         category: normalizedCategory,
        category_reference: categoryReference,
        amount_baisas: amount,
        mobile_number: mobileNumber,
        status: isSuccess ? 'completed' : 'failed',
        // POS/Bank reference fields (from OM-A880 final XML response)
        pos_rrn: posRRN,
        pos_auth_code: posAuthCode,
        pos_tid: posTID,
        pos_mid: posMID,
        pos_response_code: posResponseCode,
        // Card info
        payment_method: resolvedPaymentMethod,
        card_last_four: cardLastFour,
        payment_reference: thawaniReference || posRRN || null,
         reference_number: generatedReference,
        pos_response: paymentResponse, // Full POS response for debugging
        completed_at: isSuccess ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
      throw transactionError;
    }

    console.log('Transaction created:', {
      id: transaction.id,
      reference_number: transaction.reference_number, // System reference
      pos_rrn: transaction.pos_rrn, // Bank reference
    });

    // If this transaction was originally queued offline, record a tracking
    // row in offline_transaction_queue using the service role. This replaces
    // the previous direct client insert and keeps the table closed to anon.
    if (offlineProcessed) {
      const { error: queueError } = await supabaseClient
        .from('offline_transaction_queue')
        .upsert({
          transaction_data: {
            transactionId,
            kioskId,
            amount,
            category: normalizedCategory,
            mobileNumber,
            paymentResult: offlinePaymentResult ?? paymentResponse ?? null,
          },
          status: isSuccess ? 'synced' : 'failed',
          kiosk_id: kioskId,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      if (queueError) {
        console.warn('Offline queue tracking insert failed:', queueError);
      }
    }

    return new Response(
      JSON.stringify({
        success: isSuccess,
        transaction: {
          id: transactionId,
          // Dual-reference model: both system and POS references
          reference_number: transaction.reference_number, // System reference (primary)
          pos_rrn: posRRN, // Bank reference (for reconciliation)
          pos_auth_code: posAuthCode,
          pos_tid: posTID,
          pos_mid: posMID,
          category_reference: categoryReference,
          kiosk_reference: kioskReference,
          status: isSuccess ? 'completed' : 'failed',
          card_type: cardType,
          card_last_four: cardLastFour,
        },
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(Math.min(ipRateLimit.remaining, kioskRateLimit.remaining))
        },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Payment processing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Payment processing failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});