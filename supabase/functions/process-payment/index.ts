import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas
// Categories are now dynamic - validated against the database instead of hardcoded list
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OMAN_MOBILE_REGEX = /^\+968[0-9]{8}$/;

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

serve(async (req) => {
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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    const { transactionId, kioskId, amount, category, mobileNumber, posResponse, softPosResult, paymentType, provider, thawaniReference } = requestData;
    
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

    // Fetch kiosk reference
    const { data: kioskData } = await supabaseClient
      .from('kiosks')
      .select('reference_number')
      .eq('id', kioskId)
      .maybeSingle();

    const kioskReference = kioskData?.reference_number || null;

    // Extract POS data from request (Soft POS, test mode, or Payment Gateway)
    const paymentResponse = posResponse || softPosResult || {};
    const posRRN = paymentResponse?.rrn || paymentResponse?.RRN || paymentResponse?.paymentId || null;
    const posAuthCode = paymentResponse?.authCode || paymentResponse?.AuthCode || paymentResponse?.approvalCode || null;
    const posTID = paymentResponse?.tid || paymentResponse?.TID || null;
    const posMID = paymentResponse?.mid || paymentResponse?.MID || null;
    const posResponseCode = paymentResponse?.responseCode || '00';
    const cardLastFour = paymentResponse?.cardLastFour || null;
    const cardType = paymentResponse?.cardType || null;

    // Determine if transaction is successful
    const isSuccess = posResponseCode === '00' || paymentResponse?.success === true;
    
    // Determine payment method
    const resolvedPaymentMethod = paymentType === 'soft_pos'
      ? (provider === 'thawani' ? 'thawani_lamsa' : 'soft_pos')
      : paymentType === 'test_payment'
        ? 'test_payment'
        : cardType || 'card';

    console.log('POS Response Data:', { posRRN, posAuthCode, posTID, posMID, posResponseCode, isSuccess });

    // Create transaction record with both system reference and POS references
    // System reference (reference_number) is auto-generated by database trigger
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        id: transactionId,
        kiosk_id: kioskId,
        category,
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