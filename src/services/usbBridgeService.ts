/**
 * USB Bridge Service for OM-A880 POS
 * 
 * This service enables communication with the POS via a USB-to-TCP bridge app.
 * 
 * SETUP INSTRUCTIONS (Using TCPUART app):
 * 1. Install "TCPUART" from Play Store (FREE)
 * 2. Connect OM-A880 POS to Samsung A13 via USB OTG cable
 * 3. Open TCPUART app:
 *    - Select the USB device (Vendor: 05C6, Product: 903B)
 *    - Set Baud Rate: 115200
 *    - Set Port: 8888
 *    - Tap "Start" to begin bridging
 * 4. Now our kiosk can connect to localhost:8888
 */

// Bridge connection state
export type BridgeState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Bridge configuration
export interface USBBridgeConfig {
  host: string;  // Usually 'localhost' or '127.0.0.1'
  port: number;  // Usually 8888 or similar
  timeout: number;
}

// Default configuration
const DEFAULT_CONFIG: USBBridgeConfig = {
  host: '127.0.0.1',
  port: 8888,
  timeout: 120000,
};

// Internal state
let config: USBBridgeConfig = { ...DEFAULT_CONFIG };
let connectionState: BridgeState = 'disconnected';
let socket: WebSocket | null = null;
let responseBuffer: string = '';
let dataListeners: ((data: string) => void)[] = [];
let stateListeners: ((state: BridgeState) => void)[] = [];
let lastError: string | null = null;

/**
 * Initialize USB Bridge connection
 */
export const initializeBridge = async (bridgeConfig?: Partial<USBBridgeConfig>): Promise<boolean> => {
  config = { ...DEFAULT_CONFIG, ...bridgeConfig };
  
  console.log(`[USBBridge] Initializing connection to ${config.host}:${config.port}`);
  setState('connecting');
  
  try {
    // Try WebSocket connection first (some bridge apps support this)
    const wsConnected = await tryWebSocketConnection();
    if (wsConnected) {
      return true;
    }
    
    // Try HTTP/fetch connection (for REST-based bridges)
    const httpConnected = await tryHTTPConnection();
    if (httpConnected) {
      return true;
    }
    
    // Try direct TCP via native bridge
    const tcpConnected = await tryNativeTCPConnection();
    if (tcpConnected) {
      return true;
    }
    
    setState('error');
    lastError = 'Could not connect to USB bridge app. Make sure the bridge app is running.';
    return false;
  } catch (error: any) {
    console.error('[USBBridge] Connection error:', error);
    lastError = error.message || 'Connection failed';
    setState('error');
    return false;
  }
};

/**
 * Try WebSocket connection
 */
const tryWebSocketConnection = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const wsUrl = `ws://${config.host}:${config.port}`;
      console.log('[USBBridge] Trying WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        socket = ws;
        setState('connected');
        console.log('[USBBridge] WebSocket connected!');
        
        ws.onmessage = (event) => {
          handleIncomingData(event.data);
        };
        
        ws.onclose = () => {
          socket = null;
          setState('disconnected');
        };
        
        ws.onerror = (err) => {
          console.error('[USBBridge] WebSocket error:', err);
        };
        
        resolve(true);
      };
      
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
};

/**
 * Try HTTP/REST connection (for bridge apps that expose HTTP API)
 */
const tryHTTPConnection = async (): Promise<boolean> => {
  try {
    const httpUrl = `http://${config.host}:${config.port}`;
    console.log('[USBBridge] Trying HTTP:', httpUrl);
    
    // Test connection with a simple request
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${httpUrl}/status`, {
      signal: controller.signal,
      mode: 'cors',
    }).catch(() => null);
    
    clearTimeout(timeout);
    
    if (response?.ok) {
      setState('connected');
      console.log('[USBBridge] HTTP connection available!');
      return true;
    }
  } catch {
    // HTTP not available
  }
  return false;
};

/**
 * Try native TCP connection via Android bridge
 */
const tryNativeTCPConnection = async (): Promise<boolean> => {
  // Check for Capacitor TCP plugin
  if (typeof (window as any).CapacitorTCPSocket !== 'undefined') {
    try {
      const plugin = (window as any).CapacitorTCPSocket;
      await plugin.connect({
        host: config.host,
        port: config.port,
        timeout: 5000,
      });
      setState('connected');
      console.log('[USBBridge] Native TCP connected!');
      return true;
    } catch {
      // Native TCP not available
    }
  }
  
  // Check for custom bridge interface
  if (typeof (window as any).TCPBridge !== 'undefined') {
    try {
      const result = await (window as any).TCPBridge.connect(config.host, config.port);
      if (result) {
        setState('connected');
        return true;
      }
    } catch {
      // Bridge not available
    }
  }
  
  return false;
};

/**
 * Handle incoming data from bridge
 */
const handleIncomingData = (data: string) => {
  console.log('[USBBridge] Received:', data.substring(0, 100));
  responseBuffer += data;
  
  // Check for complete XML message
  if (responseBuffer.includes('</ECRMessage>') || 
      responseBuffer.includes('</IntermediateStatus>') ||
      responseBuffer.includes('</TerminalInfo>')) {
    const endIndex = responseBuffer.lastIndexOf('>') + 1;
    const message = responseBuffer.substring(0, endIndex);
    responseBuffer = responseBuffer.substring(endIndex);
    
    dataListeners.forEach(cb => cb(message));
  }
};

/**
 * Send command via bridge
 */
export const sendBridgeCommand = async (command: string, timeout?: number): Promise<string | null> => {
  if (connectionState !== 'connected') {
    throw new Error('Not connected to USB bridge');
  }
  
  const cmdTimeout = timeout || config.timeout;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Command timeout'));
    }, cmdTimeout);
    
    const responseHandler = (data: string) => {
      clearTimeout(timeoutId);
      dataListeners = dataListeners.filter(cb => cb !== responseHandler);
      resolve(data);
    };
    
    dataListeners.push(responseHandler);
    
    // Send via WebSocket
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(command);
      return;
    }
    
    // Send via HTTP POST
    fetch(`http://${config.host}:${config.port}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: command,
    })
      .then(res => res.text())
      .then(data => {
        clearTimeout(timeoutId);
        dataListeners = dataListeners.filter(cb => cb !== responseHandler);
        resolve(data);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        dataListeners = dataListeners.filter(cb => cb !== responseHandler);
        reject(err);
      });
  });
};

/**
 * Disconnect from bridge
 */
export const disconnectBridge = async (): Promise<void> => {
  if (socket) {
    socket.close();
    socket = null;
  }
  setState('disconnected');
};

/**
 * Set connection state
 */
const setState = (state: BridgeState) => {
  connectionState = state;
  stateListeners.forEach(cb => cb(state));
};

/**
 * Get current state
 */
export const getBridgeState = (): BridgeState => connectionState;

/**
 * Get last error
 */
export const getLastError = (): string | null => lastError;

/**
 * Subscribe to state changes
 */
export const onBridgeStateChange = (callback: (state: BridgeState) => void): (() => void) => {
  stateListeners.push(callback);
  return () => {
    stateListeners = stateListeners.filter(cb => cb !== callback);
  };
};

/**
 * Subscribe to incoming data
 */
export const onBridgeData = (callback: (data: string) => void): (() => void) => {
  dataListeners.push(callback);
  return () => {
    dataListeners = dataListeners.filter(cb => cb !== callback);
  };
};

/**
 * Test bridge connection
 */
export const testBridgeConnection = async (): Promise<{
  connected: boolean;
  method: 'websocket' | 'http' | 'tcp' | null;
  error?: string;
}> => {
  // Try WebSocket
  const ws = await tryWebSocketConnection();
  if (ws) {
    return { connected: true, method: 'websocket' };
  }
  
  // Try HTTP
  const http = await tryHTTPConnection();
  if (http) {
    return { connected: true, method: 'http' };
  }
  
  // Try TCP
  const tcp = await tryNativeTCPConnection();
  if (tcp) {
    return { connected: true, method: 'tcp' };
  }
  
  return { 
    connected: false, 
    method: null, 
    error: lastError || 'No connection method available' 
  };
};

/**
 * Get recommended bridge apps
 */
export const getRecommendedApps = () => [
  {
    name: 'TCPUART',
    developer: 'h4ck3d',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.hardcodedjoy.tcpuart',
    features: ['Free', 'Simple USB-to-TCP bridge', 'No complex setup'],
    setup: [
      'Install TCPUART from Play Store',
      'Connect OM-A880 POS via USB OTG cable',
      'Open TCPUART app',
      'Select USB device (Vendor: 05C6, Product: 903B)',
      'Set Baud Rate: 115200',
      'Set Port: 8888',
      'Tap "Start" to begin TCP server',
    ],
  },
  {
    name: 'USB TCP Bridge',
    developer: 'FTDI',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ftdi.j2xx.hyperterm',
    features: ['Free', 'FTDI compatible', 'TCP server mode'],
    setup: [
      'Install from Play Store',
      'Connect POS via USB OTG',
      'Set baud rate to 115200',
      'Enable TCP server on port 8888',
    ],
  },
];
