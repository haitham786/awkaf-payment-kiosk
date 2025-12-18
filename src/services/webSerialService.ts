/**
 * Web Serial API Service for OM-A880 POS Communication
 * 
 * This service uses the browser's Web Serial API to communicate with USB devices
 * directly from Chrome/PWA without requiring native Capacitor plugins.
 * 
 * Requirements:
 * - Chrome 89+ on Android with USB OTG
 * - Must be served over HTTPS (or localhost)
 * - User must grant permission via device picker
 * 
 * Note: Web Serial API works in Chrome browser and PWA installed from Chrome.
 * It does NOT work inside Capacitor WebView - for that you need native plugins.
 */

import { DEFAULT_POS_IDENTIFIERS } from './usbHostService';

// Web Serial API type declarations (for browsers that support it)
declare global {
  interface Navigator {
    serial: Serial;
  }
  
  interface Serial {
    getPorts(): Promise<SerialPort[]>;
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  }
  
  interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
  }
  
  interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
  }
  
  interface SerialPort {
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
    addEventListener(type: 'disconnect', listener: () => void): void;
  }
  
  interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
  }
  
  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }
}

// Serial port configuration for OM-A880
export const WEB_SERIAL_CONFIG: SerialOptions = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 4096,
  flowControl: 'none',
};

// Connection state
let serialPort: SerialPort | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
let isConnected = false;
let readLoopActive = false;

// Callbacks
type DataCallback = (data: string) => void;
type ConnectionCallback = (connected: boolean) => void;
const dataCallbacks: DataCallback[] = [];
const connectionCallbacks: ConnectionCallback[] = [];

/**
 * Check if Web Serial API is available
 */
export const isWebSerialAvailable = (): boolean => {
  return 'serial' in navigator;
};

/**
 * Check if running in a supported environment (Chrome browser, not Capacitor WebView)
 */
export const isWebSerialSupported = (): { supported: boolean; reason?: string } => {
  // Check if we're in Capacitor WebView
  if (typeof (window as any).Capacitor !== 'undefined') {
    return {
      supported: false,
      reason: 'Web Serial is not available in Capacitor WebView. Please open in Chrome browser.',
    };
  }

  // Check if serial API exists
  if (!('serial' in navigator)) {
    return {
      supported: false,
      reason: 'Web Serial API not supported. Please use Chrome 89+ on Android.',
    };
  }

  // Check HTTPS (required for Web Serial)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    return {
      supported: false,
      reason: 'Web Serial requires HTTPS. Please access via HTTPS.',
    };
  }

  return { supported: true };
};

/**
 * Request user to select a serial port (USB device)
 * This opens the browser's device picker dialog
 */
export const requestSerialPort = async (): Promise<SerialPort | null> => {
  const support = isWebSerialSupported();
  if (!support.supported) {
    console.error('[WebSerial]', support.reason);
    throw new Error(support.reason);
  }

  try {
    // Build filter for known POS devices
    const filters: SerialPortFilter[] = DEFAULT_POS_IDENTIFIERS
      .filter(id => id.vendorId && id.productId)
      .map(id => ({
        usbVendorId: id.vendorId,
        usbProductId: id.productId,
      }));

    console.log('[WebSerial] Requesting port with filters:', filters);

    // Request port - this shows the browser's device picker
    // If no filters match, user can still select any device
    const port = await navigator.serial.requestPort({
      filters: filters.length > 0 ? filters : undefined,
    });

    console.log('[WebSerial] Port selected:', port.getInfo());
    return port;
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      console.log('[WebSerial] User cancelled device selection');
      return null;
    }
    console.error('[WebSerial] Error requesting port:', error);
    throw error;
  }
};

/**
 * Get previously authorized ports
 */
export const getAuthorizedPorts = async (): Promise<SerialPort[]> => {
  if (!isWebSerialAvailable()) {
    return [];
  }

  try {
    return await navigator.serial.getPorts();
  } catch (error) {
    console.error('[WebSerial] Error getting ports:', error);
    return [];
  }
};

/**
 * Connect to a serial port
 */
export const connectToPort = async (port?: SerialPort): Promise<boolean> => {
  try {
    // If no port provided, check for previously authorized ports
    if (!port) {
      const ports = await getAuthorizedPorts();
      if (ports.length > 0) {
        port = ports[0]; // Use first authorized port
        console.log('[WebSerial] Using previously authorized port');
      } else {
        // Request new port
        port = await requestSerialPort();
      }
    }

    if (!port) {
      console.log('[WebSerial] No port available');
      return false;
    }

    // Open the port
    await port.open(WEB_SERIAL_CONFIG);
    
    serialPort = port;
    isConnected = true;

    // Set up reader and writer
    if (port.readable) {
      reader = port.readable.getReader();
      startReadLoop();
    }

    if (port.writable) {
      writer = port.writable.getWriter();
    }

    console.log('[WebSerial] Connected successfully');
    notifyConnectionChange(true);

    // Handle disconnect
    port.addEventListener('disconnect', () => {
      console.log('[WebSerial] Port disconnected');
      handleDisconnect();
    });

    return true;
  } catch (error: any) {
    console.error('[WebSerial] Connection error:', error);
    
    // Handle specific errors
    if (error.name === 'InvalidStateError') {
      console.log('[WebSerial] Port already open');
      return true;
    }
    
    if (error.name === 'NetworkError') {
      console.error('[WebSerial] Device not responding or disconnected');
    }

    handleDisconnect();
    return false;
  }
};

/**
 * Start the read loop to continuously receive data
 */
const startReadLoop = async () => {
  if (!reader || readLoopActive) return;

  readLoopActive = true;
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (readLoopActive && reader) {
      const { value, done } = await reader.read();
      
      if (done) {
        console.log('[WebSerial] Reader done');
        break;
      }

      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Check for complete XML messages (ended with </response> or similar)
        const completeMessages = extractCompleteMessages(buffer);
        
        for (const msg of completeMessages.messages) {
          console.log('[WebSerial] Received:', msg.substring(0, 200));
          notifyDataReceived(msg);
        }

        buffer = completeMessages.remaining;
      }
    }
  } catch (error: any) {
    if (error.name !== 'NetworkError') {
      console.error('[WebSerial] Read error:', error);
    }
  } finally {
    readLoopActive = false;
  }
};

/**
 * Extract complete XML messages from buffer
 */
const extractCompleteMessages = (buffer: string): { messages: string[]; remaining: string } => {
  const messages: string[] = [];
  let remaining = buffer;

  // Look for complete XML response tags
  const endTags = ['</TRANSACTION>', '</STATUS>', '</TERMINAL_INFO>', '</TOTALS>', '</RECONCILIATION>'];
  
  for (const endTag of endTags) {
    let endIndex = remaining.indexOf(endTag);
    while (endIndex !== -1) {
      const completeMsg = remaining.substring(0, endIndex + endTag.length);
      messages.push(completeMsg.trim());
      remaining = remaining.substring(endIndex + endTag.length);
      endIndex = remaining.indexOf(endTag);
    }
  }

  return { messages, remaining };
};

/**
 * Write data to the serial port
 */
export const writeData = async (data: string): Promise<boolean> => {
  if (!writer || !isConnected) {
    console.error('[WebSerial] Not connected');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    await writer.write(encoded);
    console.log('[WebSerial] Sent:', data.substring(0, 200));
    return true;
  } catch (error) {
    console.error('[WebSerial] Write error:', error);
    return false;
  }
};

/**
 * Send command and wait for response
 */
export const sendCommand = async (command: string, timeout: number = 60000): Promise<string | null> => {
  if (!isConnected) {
    console.error('[WebSerial] Not connected');
    return null;
  }

  return new Promise(async (resolve) => {
    let resolved = false;
    let responseBuffer = '';

    // Set up response handler
    const handler = (data: string) => {
      responseBuffer += data;
      
      // Check if we have a complete response
      if (isCompleteResponse(responseBuffer)) {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(responseBuffer);
        }
      }
    };

    const cleanup = () => {
      const index = dataCallbacks.indexOf(handler);
      if (index > -1) dataCallbacks.splice(index, 1);
    };

    dataCallbacks.push(handler);

    // Send command
    const sent = await writeData(command);
    if (!sent) {
      cleanup();
      resolve(null);
      return;
    }

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.warn('[WebSerial] Command timeout');
        resolve(responseBuffer || null);
      }
    }, timeout);
  });
};

/**
 * Check if response is complete
 */
const isCompleteResponse = (data: string): boolean => {
  const endTags = ['</TRANSACTION>', '</STATUS>', '</TERMINAL_INFO>', '</TOTALS>', '</RECONCILIATION>'];
  return endTags.some(tag => data.includes(tag));
};

/**
 * Disconnect from the serial port
 */
export const disconnect = async (): Promise<void> => {
  readLoopActive = false;

  try {
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
      reader = null;
    }

    if (writer) {
      await writer.close();
      writer = null;
    }

    if (serialPort) {
      await serialPort.close();
      serialPort = null;
    }
  } catch (error) {
    console.error('[WebSerial] Disconnect error:', error);
  }

  handleDisconnect();
};

/**
 * Handle disconnection
 */
const handleDisconnect = () => {
  isConnected = false;
  serialPort = null;
  reader = null;
  writer = null;
  readLoopActive = false;
  notifyConnectionChange(false);
};

/**
 * Register data received callback
 */
export const onDataReceived = (callback: DataCallback): (() => void) => {
  dataCallbacks.push(callback);
  return () => {
    const index = dataCallbacks.indexOf(callback);
    if (index > -1) dataCallbacks.splice(index, 1);
  };
};

/**
 * Register connection change callback
 */
export const onConnectionChange = (callback: ConnectionCallback): (() => void) => {
  connectionCallbacks.push(callback);
  return () => {
    const index = connectionCallbacks.indexOf(callback);
    if (index > -1) connectionCallbacks.splice(index, 1);
  };
};

/**
 * Notify data callbacks
 */
const notifyDataReceived = (data: string) => {
  dataCallbacks.forEach(cb => {
    try {
      cb(data);
    } catch (e) {
      console.error('[WebSerial] Callback error:', e);
    }
  });
};

/**
 * Notify connection callbacks
 */
const notifyConnectionChange = (connected: boolean) => {
  connectionCallbacks.forEach(cb => {
    try {
      cb(connected);
    } catch (e) {
      console.error('[WebSerial] Callback error:', e);
    }
  });
};

/**
 * Get connection status
 */
export const getConnectionStatus = (): boolean => isConnected;

/**
 * Get port info
 */
export const getPortInfo = (): SerialPortInfo | null => {
  if (!serialPort) return null;
  return serialPort.getInfo();
};

/**
 * Convenience function: Auto-connect to POS
 * First tries previously authorized port, then prompts user
 */
export const autoConnectToPOS = async (): Promise<{ connected: boolean; error?: string }> => {
  const support = isWebSerialSupported();
  if (!support.supported) {
    return { connected: false, error: support.reason };
  }

  try {
    // Try previously authorized ports first
    const ports = await getAuthorizedPorts();
    
    if (ports.length > 0) {
      console.log('[WebSerial] Found previously authorized port');
      const connected = await connectToPort(ports[0]);
      if (connected) {
        return { connected: true };
      }
    }

    // Prompt user to select device
    console.log('[WebSerial] Prompting user to select device...');
    const port = await requestSerialPort();
    
    if (port) {
      const connected = await connectToPort(port);
      return { connected, error: connected ? undefined : 'Failed to open port' };
    }

    return { connected: false, error: 'No device selected' };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
};
