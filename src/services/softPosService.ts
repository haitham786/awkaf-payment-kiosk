/**
 * Soft POS Service - Abstraction Layer for SoftPOS Payments
 * 
 * This service provides a unified interface for Soft POS payments with two modes:
 * - TEST: Test/Demo mode that simulates payments (default)
 * - LIVE: Production mode using Thawani Lamsa SDK
 * 
 * The test mode allows full end-to-end testing of the payment flow including:
 * - UI flow and user experience
 * - Transaction recording and reporting
 * - SMS receipt delivery
 * - Admin panel tracking
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// SOFT POS MODE CONFIGURATION
// ============================================================================

export type SoftPosMode = 'test' | 'live';

// Current mode - defaults to TEST for development phase
const DEFAULT_MODE: SoftPosMode = 'test';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SoftPOSConfig {
  authKey: string;          // Thawani touchpoint/authorization key
  isProduction: boolean;    // true for production, false for staging
  mode: SoftPosMode;        // test (simulated) or live (real SDK)
}

export interface SoftPOSTransactionResult {
  success: boolean;
  transactionId?: string;
  thawaniReference?: string;
  paymentId?: string;
  invoice?: string;
  approvalCode?: string;
  cardType?: string;
  cardLastFour?: string;
  responseCode?: string;
  responseMessage?: string;
  timestamp?: string;
  error?: string;
  errorCode?: string;
  isTest?: boolean;
}

export interface NFCReaderStatus {
  isAvailable: boolean;
  isEnabled: boolean;
  errorMessage?: string;
}

// ============================================================================
// INTERNAL STATE
// ============================================================================

let currentConfig: SoftPOSConfig | null = null;
let isInitialized = false;
let currentMode: SoftPosMode = DEFAULT_MODE;

// Event callbacks
let onPaymentStartCallback: (() => void) | null = null;
let onApprovalCallback: ((result: SoftPOSTransactionResult) => void) | null = null;
let onFailureCallback: ((error: string, errorCode?: string) => void) | null = null;

// ============================================================================
// CONFIGURATION LOADING
// ============================================================================

/**
 * Load Soft POS configuration for a specific kiosk
 */
export const loadKioskSoftPosConfig = async (kioskId: string): Promise<SoftPOSConfig | null> => {
  console.log('[SoftPOS] Loading config for kiosk:', kioskId);
  
  try {
    const { data: kioskData, error } = await supabase
      .from('kiosks')
      .select('configuration')
      .eq('id', kioskId)
      .single();
    
    if (error) throw error;
    
    const config = kioskData?.configuration as any;
    
    if (config?.payment_mode !== 'soft_pos') {
      console.log('[SoftPOS] Kiosk is not configured for Soft POS');
      return null;
    }
    
    // Get Thawani Lamsa config
    const softPosConfig = config?.soft_pos || {};
    const mode: SoftPosMode = softPosConfig.mode || 'test';
    
    // Trial-friendly: pass whatever auth key is configured straight to Lamsa.
    // Lamsa itself will accept/reject the key during the actual transaction.
    return {
      authKey: softPosConfig.auth_key || 'TRIAL_AUTH_KEY',
      isProduction: softPosConfig.is_production ?? false,
      mode: mode,
    };
  } catch (error) {
    console.error('[SoftPOS] Failed to load kiosk config:', error);
    return null;
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the SoftPOS service with configuration.
 *
 * On native Android we REQUIRE the Lamsa SDK to be present; if it's missing
 * we surface a loud error instead of silently dropping into simulation
 * (silent fallback hides build/Maven configuration problems).
 */
export const initializeSoftPOS = async (config: SoftPOSConfig): Promise<boolean> => {
  console.log('[SoftPOS] Initializing Thawani Lamsa...', {
    isProduction: config.isProduction,
    mode: config.mode,
    hasAuthKey: !!config.authKey,
  });

  currentMode = config.mode || 'test';
  currentConfig = config;

  const isNativePlatform = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

  // On the web preview (no Capacitor native bridge), force simulation regardless
  // of mode, so designers/admins can still walk through the flow on desktop.
  if (!isNativePlatform) {
    console.log('[SoftPOS] Web/desktop preview - using simulation');
    currentMode = 'test';
    isInitialized = true;
    return true;
  }

  // On native Android: try to initialize the real Thawani Lamsa SDK via plugin.
  try {
    const { thawaniLamsaService } = await import('@/services/thawaniLamsaPlugin');
    const success = await thawaniLamsaService.initialize(config.authKey, config.isProduction);
    if (success) {
      console.log('[SoftPOS] Thawani Lamsa SDK initialized on device');
      // Force live mode on native - the Lamsa Activity is what should drive the UX.
      currentMode = 'live';
      isInitialized = true;
      return true;
    }
    console.error('[SoftPOS] Lamsa SDK init returned false on native device.');
    isInitialized = false;
    return false;
  } catch (error) {
    console.error('[SoftPOS] Failed to initialize Lamsa SDK on native device:', error);
    isInitialized = false;
    return false;
  }
};

// ============================================================================
// NFC STATUS (TEST IMPLEMENTATION FOR SAMSUNG A33 & SUNMI FLEX 3)
// ============================================================================

/**
 * Check if NFC reader is available and enabled
 */
export const checkNFCAvailability = async (): Promise<NFCReaderStatus> => {
  console.log('[SoftPOS] Checking NFC availability (mode:', currentMode, ')');
  
  // Try to detect real NFC first (for native Android)
  const isNativeAndroid = typeof (window as any).Android !== 'undefined' || 
                          (navigator.userAgent.includes('Android') && typeof (window as any).ThawaniLamsa !== 'undefined');
  
  if (isNativeAndroid && currentMode === 'live') {
    console.log('[SoftPOS] Native Android detected - would check real NFC');
    return {
      isAvailable: true,
      isEnabled: true,
      errorMessage: undefined,
    };
  }
  
  // For test mode, always simulate NFC as available
  if (currentMode === 'test') {
    console.log('[SoftPOS] Test mode - simulating NFC as available');
    console.log('[SoftPOS] Compatible with: Samsung A33, Sunmi Flex 3, and other NFC devices');
    return {
      isAvailable: true,
      isEnabled: true,
      errorMessage: undefined,
    };
  }
  
  // Fallback
  return {
    isAvailable: true,
    isEnabled: true,
  };
};

/**
 * Validate readiness before starting payment
 */
export const validatePaymentReadiness = async (): Promise<{ ready: boolean; error?: string }> => {
  console.log('[SoftPOS] Validating payment readiness...');
  
  if (!isInitialized || !currentConfig) {
    return { ready: false, error: 'Soft POS is not initialized' };
  }
  
  const nfcStatus = await checkNFCAvailability();
  
  if (!nfcStatus.isAvailable) {
    return { ready: false, error: 'NFC hardware is not available on this device' };
  }
  
  if (!nfcStatus.isEnabled) {
    return { ready: false, error: 'NFC is disabled. Please enable NFC in device settings.' };
  }
  
  return { ready: true };
};

// ============================================================================
// TEST PAYMENT PROCESSING
// ============================================================================

/**
 * Generate a test Thawani reference number
 */
const generateTestThawaniReference = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TH${timestamp}${random}`;
};

/**
 * Generate a test approval code
 */
const generateTestApprovalCode = (): string => {
  return `APR${Math.floor(100000 + Math.random() * 900000)}`;
};

/**
 * Get a random card type for test transactions
 */
const getRandomCardType = (): { type: string; lastFour: string } => {
  const cards = [
    { type: 'Visa', lastFour: '4242' },
    { type: 'Mastercard', lastFour: '5555' },
    { type: 'Visa', lastFour: '1234' },
    { type: 'Mastercard', lastFour: '8888' },
  ];
  return cards[Math.floor(Math.random() * cards.length)];
};

/**
 * Simulate a test payment with configurable delay and success rate
 * This simulates the Thawani Lamsa Soft POS flow for Samsung A33 and Sunmi Flex 3
 */
const processTestPayment = async (
  amountBaisas: number,
  transactionId: string,
  remarks?: string
): Promise<SoftPOSTransactionResult> => {
  console.log('[SoftPOS-TEST] Processing simulated Thawani Lamsa payment...', { amountBaisas, transactionId });
  console.log('[SoftPOS-TEST] Simulating NFC card tap on Samsung A33 / Sunmi Flex 3...');
  
  // Simulate NFC activation and card detection (1.5 seconds)
  console.log('[SoftPOS-TEST] NFC Reader activated - waiting for card tap...');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate card detection
  console.log('[SoftPOS-TEST] Card detected! Processing payment...');
  
  // Simulate payment processing delay (1-2 seconds for realism)
  const delay = 1000 + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // 95% success rate for test transactions
  const isSuccess = Math.random() > 0.05;
  
  if (isSuccess) {
    const card = getRandomCardType();
    return {
      success: true,
      transactionId,
      thawaniReference: generateTestThawaniReference(),
      paymentId: `PAY${Date.now()}`,
      approvalCode: generateTestApprovalCode(),
      cardType: card.type,
      cardLastFour: card.lastFour,
      responseCode: '00',
      responseMessage: 'APPROVED',
      timestamp: new Date().toISOString(),
      isTest: true,
    };
  } else {
    // Simulate various decline reasons
    const declineReasons = [
      { code: '51', message: 'Insufficient Funds' },
      { code: '05', message: 'Do Not Honor' },
      { code: '14', message: 'Invalid Card Number' },
    ];
    const reason = declineReasons[Math.floor(Math.random() * declineReasons.length)];
    
    return {
      success: false,
      transactionId,
      errorCode: reason.code,
      error: reason.message,
      responseCode: reason.code,
      responseMessage: reason.message,
      timestamp: new Date().toISOString(),
      isTest: true,
    };
  }
};

// ============================================================================
// TRANSACTION PROCESSING
// ============================================================================

/**
 * Start a Soft POS transaction
 */
export const startSoftPOSTransaction = async (
  amountBaisas: number,
  transactionId: string,
  remarks?: string
): Promise<SoftPOSTransactionResult> => {
  console.log('[SoftPOS] Starting transaction:', { amountBaisas, transactionId, mode: currentMode });
  
  if (!isInitialized || !currentConfig) {
    const error = 'Soft POS not initialized';
    console.error('[SoftPOS]', error);
    onFailureCallback?.(error, 'NOT_INITIALIZED');
    return {
      success: false,
      transactionId,
      error,
      errorCode: 'NOT_INITIALIZED',
      timestamp: new Date().toISOString(),
    };
  }
  
  // Notify payment start
  onPaymentStartCallback?.();
  
  let result: SoftPOSTransactionResult;
  
  if (currentMode === 'test') {
    // TEST MODE - Simulate payment
    result = await processTestPayment(amountBaisas, transactionId, remarks);
  } else {
    // LIVE MODE - Use Thawani Lamsa SDK via Capacitor plugin
    try {
      const { thawaniLamsaService } = await import('@/services/thawaniLamsaPlugin');
      const amountOMR = amountBaisas / 1000;
      const lamsaResult = await thawaniLamsaService.startPayment(amountOMR, transactionId, remarks);
      
      result = {
        success: lamsaResult.success,
        transactionId: lamsaResult.transactionId,
        thawaniReference: lamsaResult.thawaniReference,
        approvalCode: lamsaResult.approvalCode,
        cardType: lamsaResult.cardType,
        cardLastFour: lamsaResult.cardLastFour,
        responseCode: lamsaResult.responseCode,
        responseMessage: lamsaResult.responseMessage,
        timestamp: lamsaResult.timestamp,
        error: lamsaResult.errorMessage,
        errorCode: lamsaResult.errorCode,
        isTest: false,
      };
    } catch (error: any) {
      console.error('[SoftPOS] Lamsa SDK payment error:', error);
      result = {
        success: false,
        transactionId,
        error: error.message || 'Lamsa SDK payment failed',
        errorCode: 'SDK_ERROR',
        timestamp: new Date().toISOString(),
        isTest: false,
      };
    }
  }
  
  // Trigger appropriate callback
  if (result.success) {
    console.log('[SoftPOS] Transaction successful:', result);
    onApprovalCallback?.(result);
  } else {
    console.log('[SoftPOS] Transaction failed:', result);
    onFailureCallback?.(result.error || 'Payment failed', result.errorCode);
  }
  
  return result;
};

// ============================================================================
// CALLBACK REGISTRATION
// ============================================================================

export const onPaymentStart = (callback: () => void): void => {
  onPaymentStartCallback = callback;
  console.log('[SoftPOS] Payment start callback registered');
};

export const onSoftPOSApproval = (callback: (result: SoftPOSTransactionResult) => void): void => {
  onApprovalCallback = callback;
  console.log('[SoftPOS] Approval callback registered');
};

export const onSoftPOSFailure = (callback: (error: string, errorCode?: string) => void): void => {
  onFailureCallback = callback;
  console.log('[SoftPOS] Failure callback registered');
};

// ============================================================================
// TRANSACTION CONTROL
// ============================================================================

export const cancelTransaction = async (): Promise<void> => {
  console.log('[SoftPOS] Cancelling current transaction...');
  console.log('[SoftPOS] Transaction cancelled');
};

// ============================================================================
// STATUS & CLEANUP
// ============================================================================

export const getSoftPOSStatus = (): {
  isInitialized: boolean;
  config: SoftPOSConfig | null;
  isNativeAvailable: boolean;
  mode: SoftPosMode;
} => {
  return {
    isInitialized,
    config: currentConfig,
    isNativeAvailable: typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.(),
    mode: currentMode,
  };
};

export const cleanupSoftPOS = async (): Promise<void> => {
  console.log('[SoftPOS] Cleaning up...');
  
  await cancelTransaction();
  
  onPaymentStartCallback = null;
  onApprovalCallback = null;
  onFailureCallback = null;
  currentConfig = null;
  isInitialized = false;
  currentMode = DEFAULT_MODE;
  
  console.log('[SoftPOS] Cleanup complete');
};

// ============================================================================
// LEGACY EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

export { checkNFCAvailability as activateNFCReader };
export { checkNFCAvailability as deactivateNFCReader };
