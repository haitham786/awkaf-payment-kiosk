/**
 * Soft POS Service - Thawani Lamsa Integration
 * 
 * This service handles Soft POS (Thawani) payments by bridging to the native
 * Thawani Lamsa SDK via the Capacitor plugin.
 * 
 * IMPORTANT: This service does NOT handle card numbers or encryption.
 * All sensitive card data is handled by the Thawani Lamsa SDK directly.
 */

import { thawaniLamsaService, ThawaniPaymentResult, NFCStatus } from './thawaniLamsaPlugin';
import { supabase } from '@/integrations/supabase/client';

export interface SoftPOSConfig {
  tajerToken: string;
  environment: 'trial' | 'live';
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
}

export interface NFCReaderStatus {
  isAvailable: boolean;
  isEnabled: boolean;
  errorMessage?: string;
}

// Store the current configuration
let currentConfig: SoftPOSConfig | null = null;
let isInitialized = false;

// Event callbacks
let onPaymentStartCallback: (() => void) | null = null;
let onApprovalCallback: ((result: SoftPOSTransactionResult) => void) | null = null;
let onFailureCallback: ((error: string, errorCode?: string) => void) | null = null;

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
    
    if (!config?.soft_pos?.tajer_token) {
      console.error('[SoftPOS] Tajer Token not configured for this kiosk');
      return null;
    }
    
    return {
      tajerToken: config.soft_pos.tajer_token,
      environment: config.soft_pos.environment || 'trial',
    };
  } catch (error) {
    console.error('[SoftPOS] Failed to load kiosk config:', error);
    return null;
  }
};

/**
 * Initialize the SoftPOS SDK with configuration
 * This should be called when the app starts with Soft POS mode enabled
 */
export const initializeSoftPOS = async (config: SoftPOSConfig): Promise<boolean> => {
  console.log('[SoftPOS] Initializing Thawani Lamsa SDK...', {
    environment: config.environment,
    hasToken: !!config.tajerToken,
  });

  if (!config.tajerToken) {
    console.error('[SoftPOS] Tajer Token is required');
    return false;
  }

  try {
    const isProduction = config.environment === 'live';
    const success = await thawaniLamsaService.initialize(config.tajerToken, isProduction);
    
    if (success) {
      currentConfig = config;
      isInitialized = true;
      console.log('[SoftPOS] Thawani Lamsa SDK initialized successfully');
    } else {
      console.error('[SoftPOS] Failed to initialize Thawani Lamsa SDK');
    }
    
    return success;
  } catch (error) {
    console.error('[SoftPOS] Initialization failed:', error);
    isInitialized = false;
    return false;
  }
};

/**
 * Check if NFC reader is available and enabled on the device
 */
export const checkNFCAvailability = async (): Promise<NFCReaderStatus> => {
  console.log('[SoftPOS] Checking NFC availability...');
  
  try {
    const status = await thawaniLamsaService.checkNFCReadiness();
    console.log('[SoftPOS] NFC status:', status);
    return status;
  } catch (error) {
    console.error('[SoftPOS] NFC check failed:', error);
    return {
      isAvailable: false,
      isEnabled: false,
      errorMessage: 'Failed to check NFC status',
    };
  }
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

/**
 * Start a Soft POS transaction
 * This launches the native Thawani Lamsa SDK activity
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
  console.log('[SoftPOS] Starting transaction:', { amountBaisas, transactionId });
  
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
  
  // Convert baisas to OMR for the SDK
  const amountOMR = amountBaisas / 1000;
  
  try {
    const result = await thawaniLamsaService.startPayment(amountOMR, transactionId, remarks);
    
    // Map the result
    const softPosResult: SoftPOSTransactionResult = {
      success: result.success,
      transactionId: result.transactionId,
      thawaniReference: result.thawaniReference,
      approvalCode: result.approvalCode,
      cardType: result.cardType,
      cardLastFour: result.cardLastFour,
      responseCode: result.responseCode,
      responseMessage: result.responseMessage,
      error: result.errorMessage,
      errorCode: result.errorCode,
      timestamp: result.timestamp,
    };
    
    // Trigger appropriate callback
    if (result.success) {
      console.log('[SoftPOS] Transaction successful:', softPosResult);
      onApprovalCallback?.(softPosResult);
    } else {
      console.log('[SoftPOS] Transaction failed:', softPosResult);
      onFailureCallback?.(result.errorMessage || 'Payment failed', result.errorCode);
    }
    
    return softPosResult;
  } catch (error: any) {
    console.error('[SoftPOS] Transaction error:', error);
    const errorMessage = error.message || 'Unknown error';
    onFailureCallback?.(errorMessage, 'EXCEPTION');
    
    return {
      success: false,
      transactionId,
      error: errorMessage,
      errorCode: 'EXCEPTION',
      timestamp: new Date().toISOString(),
    };
  }
};

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

/**
 * Cancel the current pending transaction
 */
export const cancelTransaction = async (): Promise<void> => {
  console.log('[SoftPOS] Cancelling current transaction...');
  
  try {
    await thawaniLamsaService.cancelPayment();
    console.log('[SoftPOS] Transaction cancelled');
  } catch (error) {
    console.error('[SoftPOS] Failed to cancel transaction:', error);
  }
};

/**
 * Get current SoftPOS status
 */
export const getSoftPOSStatus = (): {
  isInitialized: boolean;
  config: SoftPOSConfig | null;
  isNativeAvailable: boolean;
} => {
  const serviceStatus = thawaniLamsaService.getStatus();
  return {
    isInitialized: serviceStatus.isInitialized,
    config: currentConfig,
    isNativeAvailable: thawaniLamsaService.isNativeAvailable(),
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
  
  console.log('[SoftPOS] Cleanup complete');
};

// Legacy exports for backward compatibility
export { checkNFCAvailability as activateNFCReader };
export { checkNFCAvailability as deactivateNFCReader };

// Re-export for type compatibility
export type { ThawaniPaymentResult };
