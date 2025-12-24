/**
 * Soft POS Service - Abstraction Layer for SoftPOS Payments
 * 
 * This service provides a unified interface for Soft POS payments with two modes:
 * - MOCK: Trial/Demo mode that simulates payments (default)
 * - REAL: Production mode using Thawani Lamsa SDK (disabled until SDK approval)
 * 
 * The mock mode allows full end-to-end testing of the payment flow including:
 * - UI flow and user experience
 * - Transaction recording and reporting
 * - SMS receipt delivery
 * - Admin panel tracking
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// SOFT POS MODE CONFIGURATION
// ============================================================================

export type SoftPosMode = 'mock' | 'real';

// Current mode - defaults to MOCK for trial phase
// When Thawani SDK is approved, this can be switched to 'real' per kiosk
const DEFAULT_MODE: SoftPosMode = 'mock';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SoftPOSConfig {
  tajerToken: string;
  environment: 'trial' | 'live';
  mode: SoftPosMode;
}

export interface SoftPOSTransactionResult {
  success: boolean;
  transactionId?: string;
  thawaniReference?: string;
  approvalCode?: string;
  cardType?: string;
  cardLastFour?: string;
  responseCode?: string;
  responseMessage?: string;
  timestamp?: string;
  error?: string;
  errorCode?: string;
  isMock?: boolean;
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
    
    // For trial phase, we don't strictly require the token since we're in mock mode
    const softPosConfig = config?.soft_pos || {};
    const mode: SoftPosMode = softPosConfig.mode || 'mock';
    
    // In mock mode, token is optional
    if (mode === 'real' && !softPosConfig.tajer_token) {
      console.error('[SoftPOS] Tajer Token required for real mode');
      return null;
    }
    
    return {
      tajerToken: softPosConfig.tajer_token || 'MOCK_TOKEN',
      environment: softPosConfig.environment || 'trial',
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
  console.log('[SoftPOS] Initializing...', {
    environment: config.environment,
    mode: config.mode,
    hasToken: !!config.tajerToken,
  });

  currentMode = config.mode || 'mock';
  currentConfig = config;

  if (currentMode === 'mock') {
    console.log('[SoftPOS] Running in MOCK mode - payments will be simulated');
    isInitialized = true;
    return true;
  }

  // REAL MODE - Thawani SDK (disabled for trial)
  // This section will be enabled when SDK is approved
  console.warn('[SoftPOS] Real mode is not available during trial phase');
  console.warn('[SoftPOS] Falling back to mock mode');
  currentMode = 'mock';
  isInitialized = true;
  return true;
};

// ============================================================================
// NFC STATUS (MOCK/TRIAL IMPLEMENTATION FOR SAMSUNG A33 & SUNMI FLEX 3)
// ============================================================================

/**
 * Check if NFC reader is available and enabled
 * In mock/trial mode, this simulates NFC as available for Samsung A33 and Sunmi Flex 3
 * This allows full testing of the payment flow without actual NFC hardware
 */
export const checkNFCAvailability = async (): Promise<NFCReaderStatus> => {
  console.log('[SoftPOS] Checking NFC availability (mode:', currentMode, ')');
  
  // Try to detect real NFC first (for native Android)
  const isNativeAndroid = typeof (window as any).Android !== 'undefined' || 
                          (navigator.userAgent.includes('Android') && typeof (window as any).ThawaniLamsa !== 'undefined');
  
  if (isNativeAndroid && currentMode === 'real') {
    // In real mode on Android, try to check actual NFC status
    // This would be implemented when Thawani SDK is available
    console.log('[SoftPOS] Native Android detected - would check real NFC');
    return {
      isAvailable: true,
      isEnabled: true,
      errorMessage: undefined,
    };
  }
  
  // For trial/mock mode, always simulate NFC as available
  // This allows testing on Samsung A33, Sunmi Flex 3, and any other device
  if (currentMode === 'mock') {
    console.log('[SoftPOS] Mock mode - simulating NFC as available for trial');
    console.log('[SoftPOS] Compatible with: Samsung A33, Sunmi Flex 3, and other NFC devices');
    return {
      isAvailable: true,
      isEnabled: true,
      errorMessage: undefined,
    };
  }
  
  // Fallback - in trial phase, always return available for testing
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
// MOCK PAYMENT PROCESSING
// ============================================================================

/**
 * Generate a mock Thawani reference number
 */
const generateMockThawaniReference = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `THMOCK${timestamp}${random}`;
};

/**
 * Generate a mock approval code
 */
const generateMockApprovalCode = (): string => {
  return `APR${Math.floor(100000 + Math.random() * 900000)}`;
};

/**
 * Get a random card type for mock transactions
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
 * Simulate a mock payment with configurable delay and success rate
 * This simulates the Thawani Soft POS flow for Samsung A33 and Sunmi Flex 3
 */
const processMockPayment = async (
  amountBaisas: number,
  transactionId: string,
  remarks?: string
): Promise<SoftPOSTransactionResult> => {
  console.log('[SoftPOS-MOCK] Processing simulated Thawani payment...', { amountBaisas, transactionId });
  console.log('[SoftPOS-MOCK] Simulating NFC card tap on Samsung A33 / Sunmi Flex 3...');
  
  // Simulate NFC activation and card detection (1.5 seconds)
  console.log('[SoftPOS-MOCK] NFC Reader activated - waiting for card tap...');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate card detection
  console.log('[SoftPOS-MOCK] Card detected! Processing payment...');
  
  // Simulate payment processing delay (1-2 seconds for realism)
  const delay = 1000 + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // 95% success rate for mock transactions (higher for trial to ensure good testing)
  const isSuccess = Math.random() > 0.05;
  
  if (isSuccess) {
    const card = getRandomCardType();
    return {
      success: true,
      transactionId,
      thawaniReference: generateMockThawaniReference(),
      approvalCode: generateMockApprovalCode(),
      cardType: card.type,
      cardLastFour: card.lastFour,
      responseCode: '00',
      responseMessage: 'APPROVED',
      timestamp: new Date().toISOString(),
      isMock: true,
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
      isMock: true,
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
  
  if (currentMode === 'mock') {
    // MOCK MODE - Simulate payment
    result = await processMockPayment(amountBaisas, transactionId, remarks);
  } else {
    // REAL MODE - Thawani SDK (placeholder for future implementation)
    // This will be implemented when SDK is approved
    console.warn('[SoftPOS] Real mode not implemented - using mock');
    result = await processMockPayment(amountBaisas, transactionId, remarks);
    result.isMock = true;
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
  // In mock mode, cancellation is immediate
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
    isNativeAvailable: false, // Always false during trial (no real SDK)
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
// FUTURE: REAL THAWANI SDK INTEGRATION (NOT IMPLEMENTED)
// ============================================================================

/**
 * Start a real Thawani Soft POS transaction
 * 
 * IMPORTANT: This function is a placeholder for future SDK integration.
 * It exists but is NOT called during the trial phase.
 * 
 * @param amount - Amount in OMR
 * @param tajerToken - Thawani Tajer authentication token
 */
export const startRealThawaniSoftPos = async (
  amount: number,
  tajerToken: string
): Promise<SoftPOSTransactionResult> => {
  // PLACEHOLDER: This will be implemented when Thawani SDK is approved
  console.warn('[SoftPOS] startRealThawaniSoftPos called but SDK is not available');
  console.warn('[SoftPOS] This function will be implemented after SDK approval');
  
  return {
    success: false,
    error: 'Real Thawani SDK is not available during trial phase',
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
export type { SoftPosMode as ThawaniPaymentResult };
