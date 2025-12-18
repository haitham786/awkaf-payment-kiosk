/**
 * Soft POS NFC Payment Service
 * 
 * This service provides placeholder functions for integrating with SoftPOS SDK
 * (e.g., Sunmi Flex 3 NFC reader or similar devices).
 * 
 * IMPORTANT: This service does NOT handle card numbers or encryption.
 * All sensitive card data is handled by the SoftPOS SDK directly.
 */

export interface SoftPOSConfig {
  merchantId: string;
  terminalId: string;
  sdkEndpoint: string;
  callbackUrl: string;
  providerName: string;
  // Note: apiKey is NOT stored here for security reasons
  // API key should be managed via SOFT_POS_API_KEY environment secret
  // and accessed only through the manage-softpos-secret edge function
}

export interface SoftPOSTransactionResult {
  success: boolean;
  transactionId?: string;
  approvalCode?: string;
  cardType?: string;
  cardLastFour?: string;
  responseCode?: string;
  responseMessage?: string;
  timestamp?: string;
  error?: string;
}

export interface NFCReaderStatus {
  isAvailable: boolean;
  isEnabled: boolean;
  errorMessage?: string;
}

// Store the current configuration
let currentConfig: SoftPOSConfig | null = null;
let isInitialized = false;
let nfcReaderActive = false;

// Event callbacks
let onCardTappedCallback: ((cardData: any) => void) | null = null;
let onApprovalCallback: ((result: SoftPOSTransactionResult) => void) | null = null;
let onFailureCallback: ((error: string) => void) | null = null;

/**
 * Initialize the SoftPOS SDK with configuration
 * This should be called when the app starts with Soft POS mode enabled
 */
export const initializeSoftPOS = async (config: SoftPOSConfig): Promise<boolean> => {
  console.log('[SoftPOS] Initializing with config:', {
    merchantId: config.merchantId,
    terminalId: config.terminalId,
    providerName: config.providerName,
    sdkEndpoint: config.sdkEndpoint,
  });

  try {
    // Placeholder: In production, this would call the actual SoftPOS SDK
    // Example: await SunmiSoftPOS.initialize(config);
    
    currentConfig = config;
    isInitialized = true;
    
    console.log('[SoftPOS] SDK initialized successfully');
    return true;
  } catch (error) {
    console.error('[SoftPOS] Initialization failed:', error);
    isInitialized = false;
    return false;
  }
};

/**
 * Check if NFC reader is available on the device
 */
export const checkNFCAvailability = async (): Promise<NFCReaderStatus> => {
  console.log('[SoftPOS] Checking NFC availability...');
  
  // Placeholder: In production, check actual NFC hardware
  // Example: const status = await SunmiNFC.checkAvailability();
  
  return {
    isAvailable: true, // Simulated - would check actual hardware
    isEnabled: true,   // Simulated - would check if NFC is turned on
  };
};

/**
 * Activate NFC reader and start listening for card taps
 */
export const activateNFCReader = async (): Promise<boolean> => {
  console.log('[SoftPOS] Activating NFC reader...');
  
  if (!isInitialized) {
    console.error('[SoftPOS] Cannot activate NFC - SDK not initialized');
    return false;
  }
  
  try {
    // Placeholder: In production, activate the NFC hardware
    // Example: await SunmiNFC.startReading();
    
    nfcReaderActive = true;
    console.log('[SoftPOS] NFC reader activated, waiting for card tap...');
    return true;
  } catch (error) {
    console.error('[SoftPOS] Failed to activate NFC reader:', error);
    return false;
  }
};

/**
 * Deactivate NFC reader
 */
export const deactivateNFCReader = async (): Promise<void> => {
  console.log('[SoftPOS] Deactivating NFC reader...');
  
  try {
    // Placeholder: In production, deactivate the NFC hardware
    // Example: await SunmiNFC.stopReading();
    
    nfcReaderActive = false;
    console.log('[SoftPOS] NFC reader deactivated');
  } catch (error) {
    console.error('[SoftPOS] Failed to deactivate NFC reader:', error);
  }
};

/**
 * Start an NFC transaction for a specific amount
 * The NFC reader will wait for a card tap
 */
export const startNFCTransaction = async (
  amount: number,
  currency: string = 'OMR',
  transactionId: string
): Promise<void> => {
  console.log('[SoftPOS] Starting NFC transaction:', { amount, currency, transactionId });
  
  if (!isInitialized || !currentConfig) {
    throw new Error('SoftPOS not initialized');
  }
  
  if (!nfcReaderActive) {
    const activated = await activateNFCReader();
    if (!activated) {
      throw new Error('Failed to activate NFC reader');
    }
  }
  
  // Placeholder: In production, prepare the transaction with the SDK
  // Example:
  // await SunmiSoftPOS.prepareTransaction({
  //   amount,
  //   currency,
  //   transactionId,
  //   merchantId: currentConfig.merchantId,
  //   terminalId: currentConfig.terminalId,
  // });
  
  console.log('[SoftPOS] Transaction prepared, waiting for card tap...');
};

/**
 * Handle when a card is tapped on the NFC reader
 * This is called by the SDK when a card is detected
 */
export const onCardTapped = (callback: (cardData: any) => void): void => {
  onCardTappedCallback = callback;
  console.log('[SoftPOS] Card tap callback registered');
  
  // Placeholder: In production, register with actual SDK
  // Example:
  // SunmiNFC.onCardDetected((cardData) => {
  //   callback(cardData);
  // });
};

/**
 * Handle successful payment approval from the SDK
 */
export const onSoftPOSApproval = (callback: (result: SoftPOSTransactionResult) => void): void => {
  onApprovalCallback = callback;
  console.log('[SoftPOS] Approval callback registered');
  
  // Placeholder: In production, register with actual SDK
  // Example:
  // SunmiSoftPOS.onTransactionApproved((result) => {
  //   callback(result);
  // });
};

/**
 * Handle payment failure from the SDK
 */
export const onSoftPOSFailure = (callback: (error: string) => void): void => {
  onFailureCallback = callback;
  console.log('[SoftPOS] Failure callback registered');
  
  // Placeholder: In production, register with actual SDK
  // Example:
  // SunmiSoftPOS.onTransactionFailed((error) => {
  //   callback(error);
  // });
};

/**
 * Cancel the current pending transaction
 */
export const cancelTransaction = async (): Promise<void> => {
  console.log('[SoftPOS] Cancelling current transaction...');
  
  try {
    // Placeholder: In production, cancel with SDK
    // Example: await SunmiSoftPOS.cancelTransaction();
    
    await deactivateNFCReader();
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
  isNFCActive: boolean;
  config: SoftPOSConfig | null;
} => {
  return {
    isInitialized,
    isNFCActive: nfcReaderActive,
    config: currentConfig,
  };
};

/**
 * Simulate a card tap for testing purposes (development only)
 * This should be removed in production
 */
export const simulateCardTap = async (
  amount: number,
  transactionId: string
): Promise<SoftPOSTransactionResult> => {
  console.log('[SoftPOS] SIMULATION: Card tapped');
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simulate card data
  const cardData = {
    cardType: 'Visa',
    lastFour: '4242',
  };
  
  // Trigger card tapped callback if registered
  if (onCardTappedCallback) {
    onCardTappedCallback(cardData);
  }
  
  // Simulate another delay for approval
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate 90% success rate
  const isSuccess = Math.random() > 0.1;
  
  const result: SoftPOSTransactionResult = {
    success: isSuccess,
    transactionId,
    approvalCode: isSuccess ? `APP${Math.floor(100000 + Math.random() * 900000)}` : undefined,
    cardType: cardData.cardType,
    cardLastFour: cardData.lastFour,
    responseCode: isSuccess ? '00' : '51',
    responseMessage: isSuccess ? 'Approved' : 'Insufficient Funds',
    timestamp: new Date().toISOString(),
    error: isSuccess ? undefined : 'Transaction declined',
  };
  
  // Trigger appropriate callback
  if (isSuccess && onApprovalCallback) {
    onApprovalCallback(result);
  } else if (!isSuccess && onFailureCallback) {
    onFailureCallback(result.error || 'Unknown error');
  }
  
  return result;
};

/**
 * Cleanup and release SoftPOS resources
 */
export const cleanupSoftPOS = async (): Promise<void> => {
  console.log('[SoftPOS] Cleaning up...');
  
  await deactivateNFCReader();
  
  onCardTappedCallback = null;
  onApprovalCallback = null;
  onFailureCallback = null;
  currentConfig = null;
  isInitialized = false;
  
  console.log('[SoftPOS] Cleanup complete');
};
