/**
 * Soft POS Service - Abstraction Layer for SoftPOS Payments
 * 
 * This service provides a unified interface for Soft POS payments with two modes:
 * - TEST: Test/Demo mode that simulates payments (default)
 * - LIVE: Production mode using Amwal Pay SDK
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

// Amwal Pay environments
export type AmwalEnvironment = 'SIT' | 'UAT' | 'PROD';

// Current mode - defaults to TEST for development phase
const DEFAULT_MODE: SoftPosMode = 'test';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SoftPOSConfig {
  merchantId: string;
  terminalId: string;
  secretKey: string;
  environment: AmwalEnvironment;
  mode: SoftPosMode;
}

export interface SoftPOSTransactionResult {
  success: boolean;
  transactionId?: string;
  amwalReference?: string;
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
    
    // Get Amwal Pay config
    const softPosConfig = config?.soft_pos || {};
    const mode: SoftPosMode = softPosConfig.mode || 'test';
    
    // In live mode, credentials are required
    if (mode === 'live' && (!softPosConfig.merchant_id || !softPosConfig.terminal_id)) {
      console.error('[SoftPOS] Merchant ID and Terminal ID required for live mode');
      return null;
    }
    
    return {
      merchantId: softPosConfig.merchant_id || 'TEST_MERCHANT',
      terminalId: softPosConfig.terminal_id || 'TEST_TERMINAL',
      secretKey: softPosConfig.secret_key || '',
      environment: softPosConfig.environment || 'UAT',
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
 * Initialize the SoftPOS service with configuration
 */
export const initializeSoftPOS = async (config: SoftPOSConfig): Promise<boolean> => {
  console.log('[SoftPOS] Initializing Amwal Pay...', {
    environment: config.environment,
    mode: config.mode,
    hasMerchantId: !!config.merchantId,
    hasTerminalId: !!config.terminalId,
  });

  currentMode = config.mode || 'test';
  currentConfig = config;

  if (currentMode === 'test') {
    console.log('[SoftPOS] Running in TEST mode - payments will be simulated');
    isInitialized = true;
    return true;
  }

  // LIVE MODE - Amwal Pay SDK
  // This section will be enabled when SDK is integrated
  console.warn('[SoftPOS] Live mode requires Amwal Pay SDK integration');
  console.warn('[SoftPOS] Falling back to test mode');
  currentMode = 'test';
  isInitialized = true;
  return true;
};

// ============================================================================
// NFC STATUS (TEST IMPLEMENTATION FOR SAMSUNG A33 & SUNMI FLEX 3)
// ============================================================================

/**
 * Check if NFC reader is available and enabled
 * In test mode, this simulates NFC as available for Samsung A33 and Sunmi Flex 3
 * This allows full testing of the payment flow without actual NFC hardware
 */
export const checkNFCAvailability = async (): Promise<NFCReaderStatus> => {
  console.log('[SoftPOS] Checking NFC availability (mode:', currentMode, ')');
  
  // Try to detect real NFC first (for native Android)
  const isNativeAndroid = typeof (window as any).Android !== 'undefined' || 
                          (navigator.userAgent.includes('Android') && typeof (window as any).AmwalPay !== 'undefined');
  
  if (isNativeAndroid && currentMode === 'live') {
    // In live mode on Android, try to check actual NFC status
    console.log('[SoftPOS] Native Android detected - would check real NFC');
    return {
      isAvailable: true,
      isEnabled: true,
      errorMessage: undefined,
    };
  }
  
  // For test mode, always simulate NFC as available
  // This allows testing on Samsung A33, Sunmi Flex 3, and any other device
  if (currentMode === 'test') {
    console.log('[SoftPOS] Test mode - simulating NFC as available');
    console.log('[SoftPOS] Compatible with: Samsung A33, Sunmi Flex 3, and other NFC devices');
    return {
      isAvailable: true,
      isEnabled: true,
      errorMessage: undefined,
    };
  }
  
  // Fallback - always return available for testing
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
 * Generate a test Amwal reference number
 */
const generateTestAmwalReference = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AMWAL${timestamp}${random}`;
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
 * This simulates the Amwal Pay Soft POS flow for Samsung A33 and Sunmi Flex 3
 */
const processTestPayment = async (
  amountBaisas: number,
  transactionId: string,
  remarks?: string
): Promise<SoftPOSTransactionResult> => {
  console.log('[SoftPOS-TEST] Processing simulated Amwal Pay payment...', { amountBaisas, transactionId });
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
      amwalReference: generateTestAmwalReference(),
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
 * 
 * @param amountBaisas - Amount in baisas (1 OMR = 1000 baisas)
 * @param transactionId - Internal transaction reference
 * @param remarks - Optional remarks for the transaction
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
    // LIVE MODE - Amwal Pay SDK (placeholder for future implementation)
    console.warn('[SoftPOS] Live mode not implemented - using test');
    result = await processTestPayment(amountBaisas, transactionId, remarks);
    result.isTest = true;
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

/**
 * Register callback for when payment starts processing
 */
export const onPaymentStart = (callback: () => void): void => {
  onPaymentStartCallback = callback;
  console.log('[SoftPOS] Payment start callback registered');
};

/**
 * Register callback for successful payment approval
 */
export const onSoftPOSApproval = (callback: (result: SoftPOSTransactionResult) => void): void => {
  onApprovalCallback = callback;
  console.log('[SoftPOS] Approval callback registered');
};

/**
 * Register callback for payment failure
 */
export const onSoftPOSFailure = (callback: (error: string, errorCode?: string) => void): void => {
  onFailureCallback = callback;
  console.log('[SoftPOS] Failure callback registered');
};

// ============================================================================
// TRANSACTION CONTROL
// ============================================================================

/**
 * Cancel the current pending transaction
 */
export const cancelTransaction = async (): Promise<void> => {
  console.log('[SoftPOS] Cancelling current transaction...');
  // In test mode, cancellation is immediate
  console.log('[SoftPOS] Transaction cancelled');
};

// ============================================================================
// STATUS & CLEANUP
// ============================================================================

/**
 * Get current SoftPOS status
 */
export const getSoftPOSStatus = (): {
  isInitialized: boolean;
  config: SoftPOSConfig | null;
  isNativeAvailable: boolean;
  mode: SoftPosMode;
} => {
  return {
    isInitialized,
    config: currentConfig,
    isNativeAvailable: false, // Always false until SDK is integrated
    mode: currentMode,
  };
};

/**
 * Cleanup and release SoftPOS resources
 */
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
// FUTURE: REAL AMWAL PAY SDK INTEGRATION (NOT IMPLEMENTED)
// ============================================================================

/**
 * Start a real Amwal Pay Soft POS transaction
 * 
 * IMPORTANT: This function is a placeholder for future SDK integration.
 * It exists but is NOT called during the test phase.
 * 
 * @param amount - Amount in OMR
 * @param merchantId - Amwal Pay Merchant ID
 * @param terminalId - Amwal Pay Terminal ID
 */
export const startRealAmwalSoftPos = async (
  amount: number,
  merchantId: string,
  terminalId: string
): Promise<SoftPOSTransactionResult> => {
  // PLACEHOLDER: This will be implemented when Amwal Pay SDK is integrated
  console.warn('[SoftPOS] startRealAmwalSoftPos called but SDK is not available');
  console.warn('[SoftPOS] This function will be implemented after SDK integration');
  
  return {
    success: false,
    error: 'Amwal Pay SDK is not available in test mode',
    errorCode: 'SDK_NOT_AVAILABLE',
    timestamp: new Date().toISOString(),
  };
};

// ============================================================================
// LEGACY EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

export { checkNFCAvailability as activateNFCReader };
export { checkNFCAvailability as deactivateNFCReader };

// Re-export types
export type { SoftPosMode as AmwalPaymentResult };
