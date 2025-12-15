/**
 * Hardware POS Abstraction Layer
 * Provides a unified interface for communicating with different POS hardware
 * Supports USB and Ethernet (TCP/IP) connection modes
 * POS-agnostic design allows different POS brands without changing business logic
 */

// Connection types
export type ConnectionType = 'usb' | 'ethernet';

// POS Connection Status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Transaction Status
export type TransactionStatus = 'idle' | 'pending' | 'processing' | 'approved' | 'declined' | 'cancelled' | 'timeout' | 'error';

// POS Configuration
export interface POSConfig {
  connectionType: ConnectionType;
  ipAddress?: string;
  port?: string;
  timeout?: number; // milliseconds
  retryAttempts?: number;
}

// Transaction Request
export interface TransactionRequest {
  transactionId: string;
  amount: number; // in baisas
  currency?: string;
  merchantId?: string;
  terminalId?: string;
}

// Transaction Response
export interface TransactionResponse {
  success: boolean;
  transactionId: string;
  referenceNumber?: string;
  authCode?: string;
  cardLastFour?: string;
  cardType?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

// POS Message Protocol (Placeholder - adaptable per POS brand)
export interface POSMessage {
  command: 'START_TRANSACTION' | 'CANCEL_TRANSACTION' | 'STATUS_CHECK' | 'RESPONSE';
  payload?: {
    amount?: number;
    transactionId?: string;
    success?: boolean;
    refNo?: string;
    errorCode?: string;
    errorMessage?: string;
  };
}

// Event callbacks
type StatusCallback = (status: ConnectionStatus) => void;
type TransactionCallback = (response: TransactionResponse) => void;

// Internal state
let currentConfig: POSConfig | null = null;
let connectionStatus: ConnectionStatus = 'disconnected';
let transactionStatus: TransactionStatus = 'idle';
let statusListeners: StatusCallback[] = [];
let transactionListeners: TransactionCallback[] = [];
let connectionCheckInterval: NodeJS.Timeout | null = null;

// Default configuration
const DEFAULT_CONFIG: Partial<POSConfig> = {
  timeout: 60000, // 60 seconds
  retryAttempts: 3,
};

/**
 * Initialize the POS connection with configuration
 */
export const initializePOS = async (config: POSConfig): Promise<boolean> => {
  try {
    currentConfig = { ...DEFAULT_CONFIG, ...config };
    setConnectionStatus('connecting');
    
    if (config.connectionType === 'usb') {
      return await initializeUSBConnection();
    } else if (config.connectionType === 'ethernet') {
      return await initializeEthernetConnection(config.ipAddress!, config.port!);
    }
    
    return false;
  } catch (error) {
    console.error('POS initialization error:', error);
    setConnectionStatus('error');
    return false;
  }
};

/**
 * Initialize USB connection
 * Uses Android USB Host / Serial APIs (placeholder for native implementation)
 */
const initializeUSBConnection = async (): Promise<boolean> => {
  console.log('Initializing USB connection...');
  
  // Placeholder: Auto-detect connected POS device
  // In native implementation, this will use:
  // - Android USB Host API
  // - USB Serial communication
  // - Device enumeration
  
  try {
    // Simulate USB device detection
    const deviceDetected = await detectUSBDevice();
    
    if (deviceDetected) {
      setConnectionStatus('connected');
      startConnectionMonitoring();
      return true;
    } else {
      setConnectionStatus('disconnected');
      return false;
    }
  } catch (error) {
    console.error('USB connection error:', error);
    setConnectionStatus('error');
    return false;
  }
};

/**
 * Detect USB POS device
 * Placeholder for native USB Host API implementation
 */
const detectUSBDevice = async (): Promise<boolean> => {
  // In production, this will enumerate USB devices and check for POS terminals
  // For now, return false to indicate no device connected
  console.log('Scanning for USB POS devices...');
  
  // Placeholder: Check if running in native context with USB access
  if (typeof (window as any).AndroidUSB !== 'undefined') {
    // Native Android USB Host API available
    return await (window as any).AndroidUSB.detectDevice();
  }
  
  // Web context - USB not available
  return false;
};

/**
 * Initialize Ethernet/TCP connection
 */
const initializeEthernetConnection = async (ipAddress: string, port: string): Promise<boolean> => {
  console.log(`Initializing Ethernet connection to ${ipAddress}:${port}...`);
  
  if (!ipAddress || !port) {
    console.error('IP address and port are required for Ethernet connection');
    setConnectionStatus('error');
    return false;
  }
  
  try {
    // Validate connection before proceeding
    const connected = await validateEthernetConnection(ipAddress, port);
    
    if (connected) {
      setConnectionStatus('connected');
      startConnectionMonitoring();
      return true;
    } else {
      setConnectionStatus('disconnected');
      return false;
    }
  } catch (error) {
    console.error('Ethernet connection error:', error);
    setConnectionStatus('error');
    return false;
  }
};

/**
 * Validate Ethernet connection with timeout and retry logic
 */
const validateEthernetConnection = async (ipAddress: string, port: string): Promise<boolean> => {
  const timeout = currentConfig?.timeout || 5000;
  const retryAttempts = currentConfig?.retryAttempts || 3;
  
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    console.log(`Connection attempt ${attempt}/${retryAttempts}...`);
    
    try {
      // Placeholder: Open TCP socket connection
      // In native implementation, this will use:
      // - WebSocket or TCP socket library
      // - Capacitor plugin for TCP communication
      
      const connected = await attemptTCPConnection(ipAddress, port, timeout);
      
      if (connected) {
        console.log('Connection established successfully');
        return true;
      }
    } catch (error) {
      console.error(`Connection attempt ${attempt} failed:`, error);
    }
    
    // Wait before retry
    if (attempt < retryAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return false;
};

/**
 * Attempt TCP connection
 * Placeholder for native TCP socket implementation
 */
const attemptTCPConnection = async (ipAddress: string, port: string, timeout: number): Promise<boolean> => {
  return new Promise((resolve) => {
    // In production, this will create a TCP socket connection
    // For now, simulate connection attempt
    
    if (typeof (window as any).TCPSocket !== 'undefined') {
      // Native TCP socket available
      const socket = (window as any).TCPSocket;
      return socket.connect(ipAddress, parseInt(port), timeout)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    }
    
    // Web context - TCP not directly available
    // Could use WebSocket proxy or Capacitor plugin
    setTimeout(() => resolve(false), 1000);
  });
};

/**
 * Start connection monitoring
 */
const startConnectionMonitoring = () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
  
  connectionCheckInterval = setInterval(async () => {
    if (connectionStatus === 'connected') {
      const stillConnected = await checkConnectionHealth();
      if (!stillConnected) {
        setConnectionStatus('disconnected');
      }
    }
  }, 5000); // Check every 5 seconds
};

/**
 * Check connection health
 */
const checkConnectionHealth = async (): Promise<boolean> => {
  if (!currentConfig) return false;
  
  if (currentConfig.connectionType === 'usb') {
    return await detectUSBDevice();
  } else {
    return await attemptTCPConnection(
      currentConfig.ipAddress!,
      currentConfig.port!,
      3000
    );
  }
};

/**
 * Set and notify connection status
 */
const setConnectionStatus = (status: ConnectionStatus) => {
  connectionStatus = status;
  statusListeners.forEach(listener => listener(status));
};

/**
 * Get current connection status
 */
export const getConnectionStatus = (): ConnectionStatus => {
  return connectionStatus;
};

/**
 * Subscribe to connection status changes
 */
export const onConnectionStatusChange = (callback: StatusCallback): () => void => {
  statusListeners.push(callback);
  return () => {
    statusListeners = statusListeners.filter(cb => cb !== callback);
  };
};

/**
 * Subscribe to transaction responses
 */
export const onTransactionResponse = (callback: TransactionCallback): () => void => {
  transactionListeners.push(callback);
  return () => {
    transactionListeners = transactionListeners.filter(cb => cb !== callback);
  };
};

/**
 * Start a payment transaction
 * POS Message: START_TRANSACTION(amount)
 */
export const startTransaction = async (request: TransactionRequest): Promise<TransactionResponse> => {
  if (connectionStatus !== 'connected') {
    return {
      success: false,
      transactionId: request.transactionId,
      errorCode: 'POS_NOT_CONNECTED',
      errorMessage: 'POS terminal is not connected. Please ensure the device is properly connected.',
    };
  }
  
  transactionStatus = 'processing';
  
  try {
    const message: POSMessage = {
      command: 'START_TRANSACTION',
      payload: {
        amount: request.amount,
        transactionId: request.transactionId,
      },
    };
    
    console.log('Sending transaction to POS:', message);
    
    // Send transaction to POS and wait for response
    const response = await sendPOSMessage(message);
    
    transactionStatus = response.success ? 'approved' : 'declined';
    
    // Notify listeners
    transactionListeners.forEach(listener => listener(response));
    
    return response;
  } catch (error: any) {
    transactionStatus = 'error';
    
    const errorResponse: TransactionResponse = {
      success: false,
      transactionId: request.transactionId,
      errorCode: 'COMMUNICATION_FAILURE',
      errorMessage: error.message || 'Communication error with POS terminal',
    };
    
    transactionListeners.forEach(listener => listener(errorResponse));
    
    return errorResponse;
  }
};

/**
 * Cancel current transaction
 * POS Message: CANCEL_TRANSACTION()
 */
export const cancelTransaction = async (): Promise<boolean> => {
  if (transactionStatus !== 'processing') {
    return false;
  }
  
  try {
    const message: POSMessage = {
      command: 'CANCEL_TRANSACTION',
    };
    
    await sendPOSMessage(message);
    transactionStatus = 'cancelled';
    return true;
  } catch (error) {
    console.error('Failed to cancel transaction:', error);
    return false;
  }
};

/**
 * Send message to POS and receive response
 * Placeholder for actual POS communication
 */
const sendPOSMessage = async (message: POSMessage): Promise<TransactionResponse> => {
  const timeout = currentConfig?.timeout || 60000;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('POS_TIMEOUT: Transaction timed out waiting for POS response'));
    }, timeout);
    
    // Placeholder: In production, this will:
    // 1. Serialize message to POS protocol format
    // 2. Send via USB/TCP depending on connection type
    // 3. Wait for and parse POS response
    
    if (typeof (window as any).POSBridge !== 'undefined') {
      // Native POS bridge available
      (window as any).POSBridge.sendMessage(message)
        .then((response: any) => {
          clearTimeout(timeoutId);
          resolve(parsePOSResponse(response, message.payload?.transactionId || ''));
        })
        .catch((error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    } else {
      // Simulation mode for development
      clearTimeout(timeoutId);
      
      // Simulate POS response (for testing)
      resolve({
        success: false,
        transactionId: message.payload?.transactionId || '',
        errorCode: 'POS_NOT_AVAILABLE',
        errorMessage: 'POS hardware bridge not available. Please connect a POS terminal.',
      });
    }
  });
};

/**
 * Parse POS response to standard format
 * Adaptable per POS brand
 */
const parsePOSResponse = (rawResponse: any, transactionId: string): TransactionResponse => {
  // Generic response parsing
  // This can be overridden per POS brand
  return {
    success: rawResponse.success || rawResponse.approved || false,
    transactionId: transactionId,
    referenceNumber: rawResponse.refNo || rawResponse.referenceNumber || rawResponse.rrn,
    authCode: rawResponse.authCode || rawResponse.approvalCode,
    cardLastFour: rawResponse.cardLastFour || rawResponse.pan?.slice(-4),
    cardType: rawResponse.cardType || rawResponse.scheme,
    errorCode: rawResponse.errorCode || rawResponse.responseCode,
    errorMessage: rawResponse.errorMessage || rawResponse.responseMessage,
    rawResponse: rawResponse,
  };
};

/**
 * Get current transaction status
 */
export const getTransactionStatus = (): TransactionStatus => {
  return transactionStatus;
};

/**
 * Reset transaction status to idle
 */
export const resetTransactionStatus = () => {
  transactionStatus = 'idle';
};

/**
 * Disconnect from POS
 */
export const disconnectPOS = async (): Promise<void> => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
  
  setConnectionStatus('disconnected');
  currentConfig = null;
  
  console.log('POS disconnected');
};

/**
 * Test POS connection
 */
export const testConnection = async (config: POSConfig): Promise<{ connected: boolean; message: string }> => {
  try {
    if (config.connectionType === 'usb') {
      const detected = await detectUSBDevice();
      return {
        connected: detected,
        message: detected 
          ? 'USB POS device detected and connected' 
          : 'No USB POS device detected. Please connect the device.',
      };
    } else {
      if (!config.ipAddress || !config.port) {
        return {
          connected: false,
          message: 'IP address and port are required for Ethernet connection',
        };
      }
      
      const connected = await attemptTCPConnection(config.ipAddress, config.port, 5000);
      return {
        connected,
        message: connected 
          ? `Connected to POS at ${config.ipAddress}:${config.port}` 
          : `Failed to connect to ${config.ipAddress}:${config.port}. Please check the configuration.`,
      };
    }
  } catch (error: any) {
    return {
      connected: false,
      message: `Connection test failed: ${error.message}`,
    };
  }
};

/**
 * Get error message for user display
 */
export const getErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    'POS_NOT_CONNECTED': 'جهاز نقاط البيع غير متصل. يرجى التأكد من توصيل الجهاز.',
    'POS_TIMEOUT': 'انتهت مهلة العملية. يرجى المحاولة مرة أخرى.',
    'USER_CANCELLED': 'تم إلغاء العملية من قبل المستخدم.',
    'COMMUNICATION_FAILURE': 'فشل الاتصال مع جهاز نقاط البيع. يرجى المحاولة مرة أخرى.',
    'POS_NOT_AVAILABLE': 'جهاز نقاط البيع غير متوفر.',
    'DECLINED': 'تم رفض البطاقة. يرجى استخدام بطاقة أخرى.',
    'INSUFFICIENT_FUNDS': 'رصيد غير كافٍ.',
    'CARD_EXPIRED': 'البطاقة منتهية الصلاحية.',
    'INVALID_CARD': 'بطاقة غير صالحة.',
  };
  
  return errorMessages[errorCode] || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
};
