/**
 * Ethernet ECR Service for OM-A880 POS
 * 
 * Implements TCP/IP communication with the POS terminal using the ECR protocol.
 * This is the PRIMARY connection method for production deployment.
 * 
 * Based on OMA Emirates ECR Integration Specification Document v1.25
 */

import { ECR_COMMANDS, parseXMLResponse as parseECRXML, ECRResponse } from './ecrProtocol';

// TCP Connection State
export type TCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// ECR Message Types
export interface ECRRequest {
  commandType: string;
  amount?: string;
  invoiceNo?: string;
  mref?: string;
  password?: string;
}

// Configuration
export interface EthernetConfig {
  ipAddress: string;
  port: number;
  timeout: number;
  retryAttempts: number;
  keepAliveInterval: number;
}

// Response callback types
type DataCallback = (data: string) => void;
type ErrorCallback = (error: Error) => void;
type StatusCallback = (state: TCPConnectionState) => void;

// Internal state
let config: EthernetConfig | null = null;
let connectionState: TCPConnectionState = 'disconnected';
let dataListeners: DataCallback[] = [];
let errorListeners: ErrorCallback[] = [];
let statusListeners: StatusCallback[] = [];
let socketInstance: any = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let responseBuffer: string = '';

// Default configuration
const DEFAULT_CONFIG: EthernetConfig = {
  ipAddress: '',
  port: 8000, // Default ECR port for OM-A880
  timeout: 120000, // 2 minutes
  retryAttempts: 3,
  keepAliveInterval: 30000, // 30 seconds
};

/**
 * Build ECR XML Request
 * Format according to OM-A880 ECR specification
 */
export const buildECRRequest = (request: ECRRequest): string => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<ECRMessage>\n';
  xml += `  <CommandType>${request.commandType}</CommandType>\n`;
  
  if (request.amount) {
    xml += `  <Amount>${request.amount}</Amount>\n`;
  }
  
  if (request.invoiceNo) {
    xml += `  <InvoiceNo>${request.invoiceNo}</InvoiceNo>\n`;
  }
  
  if (request.mref) {
    xml += `  <MREF>${request.mref}</MREF>\n`;
  }
  
  if (request.password) {
    xml += `  <Password>${request.password}</Password>\n`;
  }
  
  xml += '</ECRMessage>';
  
  return xml;
};

/**
 * Build Purchase Request XML
 */
export const buildPurchaseRequest = (
  amountInBaisas: number,
  invoiceNo?: string,
  merchantRef?: string
): string => {
  // Amount format: integer without decimals (2000 = 2.000 OMR)
  const amount = Math.round(amountInBaisas).toString().padStart(12, '0');
  
  return buildECRRequest({
    commandType: ECR_COMMANDS.PURCHASE,
    amount,
    invoiceNo: invoiceNo?.padStart(6, '0'),
    mref: merchantRef?.substring(0, 22), // Max 22 chars
  });
};

/**
 * Build Get Status Request XML
 */
export const buildStatusRequest = (): string => {
  return buildECRRequest({
    commandType: ECR_COMMANDS.GET_STATUS,
  });
};

/**
 * Build Terminal Info Request XML
 */
export const buildTerminalInfoRequest = (): string => {
  return buildECRRequest({
    commandType: ECR_COMMANDS.GET_TERMINAL_INFO,
  });
};

/**
 * Build Reconciliation Request XML
 */
export const buildReconciliationRequest = (): string => {
  return buildECRRequest({
    commandType: ECR_COMMANDS.RECONCILIATION,
  });
};

/**
 * Build Last Transaction Status Request XML
 */
export const buildLastTransactionRequest = (): string => {
  return buildECRRequest({
    commandType: ECR_COMMANDS.LAST_TRANSACTION_STATUS,
  });
};

/**
 * Build Get Totals Request XML
 */
export const buildTotalsRequest = (): string => {
  return buildECRRequest({
    commandType: ECR_COMMANDS.GET_TOTALS,
  });
};

/**
 * Initialize Ethernet ECR connection
 */
export const initializeEthernet = async (ethernetConfig: Partial<EthernetConfig>): Promise<boolean> => {
  config = { ...DEFAULT_CONFIG, ...ethernetConfig };
  
  if (!config.ipAddress) {
    console.error('IP address is required');
    setConnectionState('error');
    return false;
  }
  
  console.log(`Initializing Ethernet ECR connection to ${config.ipAddress}:${config.port}`);
  setConnectionState('connecting');
  
  try {
    const connected = await connectTCP();
    
    if (connected) {
      startKeepAlive();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Ethernet initialization failed:', error);
    setConnectionState('error');
    return false;
  }
};

/**
 * Connect to POS via TCP
 */
const connectTCP = async (): Promise<boolean> => {
  if (!config) return false;
  
  const { ipAddress, port, timeout, retryAttempts } = config;
  
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    console.log(`TCP connection attempt ${attempt}/${retryAttempts} to ${ipAddress}:${port}`);
    
    try {
      const connected = await attemptConnection(ipAddress, port, timeout);
      
      if (connected) {
        setConnectionState('connected');
        console.log('TCP connection established');
        return true;
      }
    } catch (error) {
      console.error(`Connection attempt ${attempt} failed:`, error);
    }
    
    if (attempt < retryAttempts) {
      await delay(2000);
    }
  }
  
  setConnectionState('disconnected');
  return false;
};

/**
 * Attempt single TCP connection
 */
const attemptConnection = async (ip: string, port: number, timeout: number): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check for Capacitor TCP Socket Plugin
    if (typeof (window as any).CapacitorTCPSocket !== 'undefined') {
      const plugin = (window as any).CapacitorTCPSocket;
      
      plugin.connect({ host: ip, port, timeout })
        .then((socket: any) => {
          socketInstance = socket;
          setupSocketListeners(socket);
          resolve(true);
        })
        .catch((err: any) => {
          console.error('Capacitor TCP connect error:', err);
          resolve(false);
        });
      return;
    }
    
    // Check for OM-A880 Native Bridge (Android)
    if (typeof (window as any).OMA880Bridge !== 'undefined') {
      const bridge = (window as any).OMA880Bridge;
      
      bridge.connectEthernet(ip, port, timeout)
        .then((result: boolean) => {
          if (result) {
            socketInstance = { type: 'bridge' };
            setupBridgeListeners(bridge);
          }
          resolve(result);
        })
        .catch((err: any) => {
          console.error('Bridge connect error:', err);
          resolve(false);
        });
      return;
    }
    
    // Check for generic TCP Socket (Cordova/Capacitor plugins)
    if (typeof (window as any).Socket !== 'undefined') {
      const Socket = (window as any).Socket;
      const socket = new Socket();
      
      socket.open(ip, port, 
        () => {
          socketInstance = socket;
          setupGenericSocketListeners(socket);
          resolve(true);
        },
        (error: any) => {
          console.error('Socket open error:', error);
          resolve(false);
        }
      );
      
      setTimeout(() => {
        if (connectionState !== 'connected') {
          socket.close();
          resolve(false);
        }
      }, timeout);
      return;
    }
    
    // Web context - no native TCP available
    console.warn('No native TCP socket available. ECR communication requires native bridge.');
    
    // For development/testing, simulate connection check
    if (process.env.NODE_ENV === 'development' || import.meta.env.DEV) {
      console.log('Development mode: Simulating TCP check');
      setTimeout(() => resolve(false), 1000);
      return;
    }
    
    resolve(false);
  });
};

/**
 * Setup listeners for Capacitor TCP Socket
 */
const setupSocketListeners = (socket: any) => {
  socket.onData((data: ArrayBuffer) => {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(data);
    handleIncomingData(text);
  });
  
  socket.onClose(() => {
    console.log('TCP socket closed');
    setConnectionState('disconnected');
    socketInstance = null;
  });
  
  socket.onError((error: any) => {
    console.error('TCP socket error:', error);
    notifyError(new Error(error.message || 'Socket error'));
  });
};

/**
 * Setup listeners for OM-A880 Bridge
 */
const setupBridgeListeners = (bridge: any) => {
  bridge.onDataReceived = (data: string) => {
    handleIncomingData(data);
  };
  
  bridge.onConnectionLost = () => {
    console.log('Bridge connection lost');
    setConnectionState('disconnected');
    socketInstance = null;
  };
  
  bridge.onError = (error: string) => {
    console.error('Bridge error:', error);
    notifyError(new Error(error));
  };
};

/**
 * Setup listeners for generic Socket plugin
 */
const setupGenericSocketListeners = (socket: any) => {
  socket.onData = (data: Uint8Array) => {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(data);
    handleIncomingData(text);
  };
  
  socket.onClose = (hasError: boolean) => {
    console.log('Socket closed, hasError:', hasError);
    setConnectionState('disconnected');
    socketInstance = null;
  };
  
  socket.onError = (message: string) => {
    console.error('Socket error:', message);
    notifyError(new Error(message));
  };
};

/**
 * Handle incoming data from POS
 */
const handleIncomingData = (data: string) => {
  console.log('Received data from POS:', data.substring(0, 200));
  
  // Buffer data until we have a complete XML message
  responseBuffer += data;
  
  // Check if we have a complete XML response
  if (responseBuffer.includes('</ECRMessage>') || 
      responseBuffer.includes('</IntermediateStatus>') ||
      responseBuffer.includes('</TerminalInfo>') ||
      responseBuffer.includes('</StatusResponse>')) {
    
    // Extract complete message
    const endIndex = responseBuffer.lastIndexOf('>') + 1;
    const completeMessage = responseBuffer.substring(0, endIndex);
    responseBuffer = responseBuffer.substring(endIndex);
    
    // Notify listeners
    dataListeners.forEach(listener => listener(completeMessage));
  }
};

/**
 * Send ECR command and wait for response
 */
export const sendCommand = async (
  xmlRequest: string,
  timeout?: number
): Promise<ECRResponse | null> => {
  if (connectionState !== 'connected' || !socketInstance) {
    console.error('Not connected to POS');
    throw new Error('NOT_CONNECTED');
  }
  
  const commandTimeout = timeout || config?.timeout || 120000;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('COMMAND_TIMEOUT'));
    }, commandTimeout);
    
    // Set up one-time response handler
    const responseHandler = (data: string) => {
      clearTimeout(timeoutId);
      
      // Remove this handler
      dataListeners = dataListeners.filter(l => l !== responseHandler);
      
      // Parse XML response
      const response = parseECRXML(data);
      resolve(response);
    };
    
    dataListeners.push(responseHandler);
    
    // Send command
    sendData(xmlRequest)
      .catch((error) => {
        clearTimeout(timeoutId);
        dataListeners = dataListeners.filter(l => l !== responseHandler);
        reject(error);
      });
  });
};

/**
 * Send raw data to POS
 */
const sendData = async (data: string): Promise<void> => {
  if (!socketInstance) {
    throw new Error('No socket connection');
  }
  
  console.log('Sending to POS:', data.substring(0, 200));
  
  // Capacitor TCP Socket
  if (typeof socketInstance.write === 'function') {
    const encoder = new TextEncoder();
    await socketInstance.write(encoder.encode(data));
    return;
  }
  
  // OM-A880 Bridge
  if (socketInstance.type === 'bridge' && typeof (window as any).OMA880Bridge !== 'undefined') {
    await (window as any).OMA880Bridge.sendData(data);
    return;
  }
  
  // Generic Socket plugin
  if (typeof socketInstance.write !== 'undefined') {
    return new Promise((resolve, reject) => {
      const encoder = new TextEncoder();
      socketInstance.write(encoder.encode(data), resolve, reject);
    });
  }
  
  throw new Error('Unknown socket type');
};

/**
 * Start keep-alive monitoring
 */
const startKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
  }
  
  keepAliveTimer = setInterval(async () => {
    if (connectionState === 'connected') {
      try {
        // Send status request as keep-alive
        const statusXml = buildStatusRequest();
        await sendCommand(statusXml, 5000);
      } catch (error) {
        console.warn('Keep-alive failed:', error);
        // Don't disconnect on single failure, retry will happen
      }
    }
  }, config?.keepAliveInterval || 30000);
};

/**
 * Stop keep-alive monitoring
 */
const stopKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
};

/**
 * Disconnect from POS
 */
export const disconnectEthernet = async (): Promise<void> => {
  stopKeepAlive();
  
  if (socketInstance) {
    try {
      if (typeof socketInstance.close === 'function') {
        await socketInstance.close();
      } else if (socketInstance.type === 'bridge' && typeof (window as any).OMA880Bridge !== 'undefined') {
        await (window as any).OMA880Bridge.disconnect();
      }
    } catch (error) {
      console.error('Error closing socket:', error);
    }
    
    socketInstance = null;
  }
  
  setConnectionState('disconnected');
  responseBuffer = '';
  console.log('Ethernet ECR disconnected');
};

/**
 * Test Ethernet connection
 */
export const testEthernetConnection = async (
  ip: string,
  port: number,
  timeout: number = 5000
): Promise<{ connected: boolean; terminalInfo?: any; error?: string }> => {
  try {
    const connected = await attemptConnection(ip, port, timeout);
    
    if (!connected) {
      return { 
        connected: false, 
        error: `Unable to connect to ${ip}:${port}` 
      };
    }
    
    // Try to get terminal info
    try {
      const infoXml = buildTerminalInfoRequest();
      const response = await sendCommand(infoXml, 10000);
      
      await disconnectEthernet();
      
      return {
        connected: true,
        terminalInfo: response,
      };
    } catch (cmdError) {
      await disconnectEthernet();
      return {
        connected: true,
        error: 'Connected but failed to get terminal info',
      };
    }
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || 'Connection failed',
    };
  }
};

/**
 * Get current connection state
 */
export const getConnectionState = (): TCPConnectionState => connectionState;

/**
 * Subscribe to connection state changes
 */
export const onConnectionStateChange = (callback: StatusCallback): () => void => {
  statusListeners.push(callback);
  return () => {
    statusListeners = statusListeners.filter(l => l !== callback);
  };
};

/**
 * Subscribe to data events
 */
export const onData = (callback: DataCallback): () => void => {
  dataListeners.push(callback);
  return () => {
    dataListeners = dataListeners.filter(l => l !== callback);
  };
};

/**
 * Subscribe to error events
 */
export const onError = (callback: ErrorCallback): () => void => {
  errorListeners.push(callback);
  return () => {
    errorListeners = errorListeners.filter(l => l !== callback);
  };
};

// Internal helpers
const setConnectionState = (state: TCPConnectionState) => {
  connectionState = state;
  statusListeners.forEach(l => l(state));
};

const notifyError = (error: Error) => {
  errorListeners.forEach(l => l(error));
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if Ethernet ECR is available
 */
export const isEthernetAvailable = (): boolean => {
  return (
    typeof (window as any).CapacitorTCPSocket !== 'undefined' ||
    typeof (window as any).OMA880Bridge !== 'undefined' ||
    typeof (window as any).Socket !== 'undefined'
  );
};
