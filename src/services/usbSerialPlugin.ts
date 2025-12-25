/**
 * USB Serial Plugin - CORRECT Implementation for capacitor-plugin-usb-serial
 * With ECR Protocol Framing for OM-A880 POS
 * 
 * This module properly integrates with the capacitor-plugin-usb-serial plugin
 * using the EXACT method names from the plugin API:
 * 
 * Plugin Methods:
 * - connectedDevices() → returns { devices: UsbSerialDevice[] }
 * - openSerial(options) → opens connection with deviceId, baudRate, etc.
 * - closeSerial() → closes connection
 * - writeSerial({ data }) → writes data to serial port
 * - readSerial() → reads data from serial port
 * 
 * Events:
 * - 'attached' → device plugged in
 * - 'detached' → device unplugged
 * - 'connected' → connection established
 * - 'data' → data received
 * - 'error' → error occurred
 * - 'log' → debug log
 * 
 * ECR Protocol Requirements (OM-A880):
 * - Baud rate: 2400
 * - Frame: STX (0x02) + XML + ETX (0x03) + LRC
 * - ACK every message: 0x06
 * - Initialize with GetTerminalInfo before transactions
 */

import { USBDeviceInfo, DEFAULT_POS_IDENTIFIERS } from './usbHostService';
import {
  frameECRCommand,
  parseFramedResponse,
  createACK,
  bytesToHex,
  frameToDebugString,
  STX,
  ETX,
  ACK,
  INTERMEDIATE_STATUS_CODES,
  parseIntermediateStatus,
} from './ecrFraming';

// Plugin interface matching capacitor-plugin-usb-serial exactly
interface UsbSerialDevice {
  pid: number; // Product ID
  vid: number; // Vendor ID
  did: number; // Device ID (used for openSerial)
}

interface UsbSerialOptions {
  deviceId: number;
  portNum?: number;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: number;
  dtr?: boolean;
  rts?: boolean;
}

interface UsbSerialPlugin {
  connectedDevices(): Promise<{ devices: UsbSerialDevice[] }>;
  openSerial(options: UsbSerialOptions): Promise<void>;
  closeSerial(): Promise<void>;
  readSerial(): Promise<{ data: string }>;
  writeSerial(options: { data: string }): Promise<void>;
  addListener(eventName: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
}

// Plugin state
let pluginInitialized = false;
let activePlugin: 'UsbSerial' | 'none' = 'none';
let usbSerialPlugin: UsbSerialPlugin | null = null;
let connectedDeviceId: number | null = null;

// Serial configuration for OM-A880 POS
// CRITICAL: OM-A880 uses 2400 baud rate per ECR specification!
export const POS_SERIAL_CONFIG = {
  baudRate: 2400,     // OM-A880 requirement: 2400 baud
  dataBits: 8,        // 8 data bits
  stopBits: 1,        // 1 stop bit  
  parity: 0,          // 0 = none
  dtr: true,          // Data Terminal Ready
  rts: true,          // Request To Send
};

// Alternative config for other POS terminals (if needed)
export const POS_SERIAL_CONFIG_FAST = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 0,
  dtr: true,
  rts: true,
};

// Callback types
type DataReceivedCallback = (data: string) => void;
type ConnectionCallback = (connected: boolean, device?: USBDeviceInfo) => void;

// Registered callbacks
let dataCallbacks: DataReceivedCallback[] = [];
let connectionCallbacks: ConnectionCallback[] = [];

/**
 * Get the UsbSerial plugin from Capacitor
 */
const getUsbSerialPlugin = (): UsbSerialPlugin | null => {
  if (typeof (window as any).Capacitor === 'undefined') {
    console.log('[USBSerial] Capacitor not available');
    return null;
  }

  const Capacitor = (window as any).Capacitor;
  
  if (!Capacitor.isNativePlatform()) {
    console.log('[USBSerial] Not running on native platform');
    return null;
  }

  const plugins = Capacitor.Plugins;
  
  // The plugin registers as 'UsbSerial' in Capacitor
  if (plugins?.UsbSerial) {
    return plugins.UsbSerial as UsbSerialPlugin;
  }

  // Try alternative names
  const alternativeNames = ['USBSerial', 'CapacitorUsbSerial', 'usbSerial'];
  for (const name of alternativeNames) {
    if (plugins?.[name]) {
      console.log(`[USBSerial] Found plugin as: ${name}`);
      return plugins[name] as UsbSerialPlugin;
    }
  }

  console.log('[USBSerial] Plugin not found. Available plugins:', Object.keys(plugins || {}));
  return null;
};

/**
 * Initialize the USB Serial plugin
 */
export const initializeUSBSerial = async (): Promise<boolean> => {
  if (pluginInitialized && usbSerialPlugin) {
    return true;
  }

  console.log('[USBSerial] Initializing USB Serial plugin...');

  usbSerialPlugin = getUsbSerialPlugin();

  if (!usbSerialPlugin) {
    console.warn('[USBSerial] USB Serial plugin not available');
    activePlugin = 'none';
    pluginInitialized = true;
    return false;
  }

  activePlugin = 'UsbSerial';
  console.log('[USBSerial] Plugin found, registering listeners...');

  try {
    // Register event listeners
    await usbSerialPlugin.addListener('attached', (device: UsbSerialDevice) => {
      console.log('[USBSerial] Device attached:', device);
    });

    await usbSerialPlugin.addListener('detached', (device: UsbSerialDevice) => {
      console.log('[USBSerial] Device detached:', device);
      if (connectedDeviceId === device.did) {
        connectedDeviceId = null;
        connectionCallbacks.forEach(cb => cb(false));
      }
    });

    await usbSerialPlugin.addListener('connected', (device: UsbSerialDevice) => {
      console.log('[USBSerial] Connected to device:', device);
      connectedDeviceId = device.did;
      connectionCallbacks.forEach(cb => cb(true, {
        vendorId: device.vid,
        productId: device.pid,
        deviceId: device.did,
      }));
    });

    await usbSerialPlugin.addListener('data', (event: { data: string }) => {
      console.log('[USBSerial] Data received:', event.data?.substring(0, 100));
      if (event.data) {
        dataCallbacks.forEach(cb => cb(event.data));
      }
    });

    await usbSerialPlugin.addListener('error', (event: { error: string }) => {
      console.error('[USBSerial] Error:', event.error);
    });

    await usbSerialPlugin.addListener('log', (event: { text: string; tag: string }) => {
      console.log(`[USBSerial:${event.tag}] ${event.text}`);
    });

    console.log('[USBSerial] Plugin initialized successfully');
  } catch (error) {
    console.error('[USBSerial] Error registering listeners:', error);
  }

  pluginInitialized = true;
  return true;
};

/**
 * List connected USB devices
 * Uses connectedDevices() method from the plugin
 */
export const listUSBDevices = async (): Promise<USBDeviceInfo[]> => {
  console.log('[USBSerial] Listing USB devices...');

  if (!usbSerialPlugin) {
    usbSerialPlugin = getUsbSerialPlugin();
  }

  if (!usbSerialPlugin) {
    console.warn('[USBSerial] Plugin not available for listing devices');
    return [];
  }

  try {
    const result = await usbSerialPlugin.connectedDevices();
    console.log('[USBSerial] connectedDevices result:', result);

    if (!result?.devices || !Array.isArray(result.devices)) {
      console.log('[USBSerial] No devices array in result');
      return [];
    }

    // Map plugin device format to our USBDeviceInfo format
    const devices: USBDeviceInfo[] = result.devices.map((d: UsbSerialDevice) => ({
      vendorId: d.vid,
      productId: d.pid,
      deviceId: d.did,
      deviceName: `Device ${d.did}`,
    }));

    console.log('[USBSerial] Mapped devices:', devices);
    return devices;
  } catch (error) {
    console.error('[USBSerial] Error listing devices:', error);
    return [];
  }
};

/**
 * Request USB permission for a device
 * Note: The plugin handles permissions automatically during openSerial
 */
export const requestUSBPermission = async (device: USBDeviceInfo): Promise<boolean> => {
  console.log('[USBSerial] Permission will be requested during openSerial');
  // Plugin handles permissions during openSerial
  return true;
};

/**
 * Open USB serial connection using openSerial()
 */
export const openUSBConnection = async (device: USBDeviceInfo): Promise<boolean> => {
  console.log('[USBSerial] Opening connection to device:', device);

  if (!usbSerialPlugin) {
    usbSerialPlugin = getUsbSerialPlugin();
  }

  if (!usbSerialPlugin) {
    console.error('[USBSerial] Plugin not available');
    return false;
  }

  try {
    // Use the CORRECT options structure for openSerial
    const options: UsbSerialOptions = {
      deviceId: device.deviceId || device.vendorId, // deviceId is required
      portNum: 0, // Usually port 0
      baudRate: POS_SERIAL_CONFIG.baudRate,
      dataBits: POS_SERIAL_CONFIG.dataBits,
      stopBits: POS_SERIAL_CONFIG.stopBits,
      parity: POS_SERIAL_CONFIG.parity,
      dtr: POS_SERIAL_CONFIG.dtr,
      rts: POS_SERIAL_CONFIG.rts,
    };

    console.log('[USBSerial] Calling openSerial with options:', options);
    await usbSerialPlugin.openSerial(options);
    
    connectedDeviceId = options.deviceId;
    connectionCallbacks.forEach(cb => cb(true, device));
    
    console.log('[USBSerial] Connection opened successfully');
    return true;
  } catch (error) {
    console.error('[USBSerial] Error opening connection:', error);
    return false;
  }
};

/**
 * Close USB serial connection using closeSerial()
 */
export const closeUSBConnection = async (): Promise<boolean> => {
  console.log('[USBSerial] Closing connection...');

  if (!usbSerialPlugin) {
    return false;
  }

  try {
    await usbSerialPlugin.closeSerial();
    connectedDeviceId = null;
    connectionCallbacks.forEach(cb => cb(false));
    console.log('[USBSerial] Connection closed');
    return true;
  } catch (error) {
    console.error('[USBSerial] Error closing connection:', error);
    return false;
  }
};

/**
 * Write raw string data to USB serial using writeSerial()
 * WARNING: For ECR commands, use writeFramedCommand() instead!
 */
export const writeUSBData = async (data: string): Promise<boolean> => {
  console.log('[USBSerial] Writing raw data:', data.substring(0, 100));

  if (!usbSerialPlugin) {
    console.error('[USBSerial] Plugin not available for writing');
    return false;
  }

  if (connectedDeviceId === null) {
    console.error('[USBSerial] Not connected to any device');
    return false;
  }

  try {
    await usbSerialPlugin.writeSerial({ data });
    console.log('[USBSerial] Data written successfully');
    return true;
  } catch (error) {
    console.error('[USBSerial] Error writing data:', error);
    return false;
  }
};

/**
 * Write raw bytes to USB serial
 */
export const writeUSBBytes = async (bytes: Uint8Array): Promise<boolean> => {
  console.log('[USBSerial] Writing bytes:', bytesToHex(bytes.slice(0, 20)), '...');

  if (!usbSerialPlugin) {
    console.error('[USBSerial] Plugin not available for writing');
    return false;
  }

  if (connectedDeviceId === null) {
    console.error('[USBSerial] Not connected to any device');
    return false;
  }

  try {
    // Convert bytes to string (plugin expects string)
    // Use Latin-1 encoding to preserve byte values
    const dataStr = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    await usbSerialPlugin.writeSerial({ data: dataStr });
    console.log('[USBSerial] Bytes written successfully');
    return true;
  } catch (error) {
    console.error('[USBSerial] Error writing bytes:', error);
    return false;
  }
};

/**
 * Write ECR command with proper framing (STX + XML + ETX + LRC)
 * This is the CORRECT way to send commands to OM-A880!
 */
export const writeFramedCommand = async (xmlCommand: string): Promise<boolean> => {
  console.log('[USBSerial] Framing ECR command:', xmlCommand.substring(0, 80));

  const framedPacket = frameECRCommand(xmlCommand);
  console.log('[USBSerial] Framed packet:', frameToDebugString(framedPacket.slice(0, 50)), '...');
  console.log('[USBSerial] Hex:', bytesToHex(framedPacket.slice(0, 30)), '...');

  return await writeUSBBytes(framedPacket);
};

/**
 * Send ACK (0x06) to POS
 * CRITICAL: Must ACK every message from POS!
 */
export const sendACK = async (): Promise<boolean> => {
  console.log('[USBSerial] Sending ACK');
  return await writeUSBBytes(createACK());
};

/**
 * Read data from USB serial using readSerial()
 */
export const readUSBData = async (timeout: number = 5000): Promise<string | null> => {
  console.log('[USBSerial] Reading data with timeout:', timeout);

  if (!usbSerialPlugin) {
    return null;
  }

  return new Promise((resolve) => {
    let resolved = false;

    // Wait for data via callback (preferred - real-time)
    const dataHandler = (data: string) => {
      if (!resolved) {
        resolved = true;
        resolve(data);
        const index = dataCallbacks.indexOf(dataHandler);
        if (index > -1) dataCallbacks.splice(index, 1);
      }
    };
    dataCallbacks.push(dataHandler);

    // Also try direct read (for immediate data)
    setTimeout(async () => {
      if (!resolved && usbSerialPlugin) {
        try {
          const result = await usbSerialPlugin.readSerial();
          if (!resolved && result?.data) {
            resolved = true;
            resolve(result.data);
            const index = dataCallbacks.indexOf(dataHandler);
            if (index > -1) dataCallbacks.splice(index, 1);
          }
        } catch (e) {
          console.log('[USBSerial] Direct read failed:', e);
        }
      }
    }, 100);

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const index = dataCallbacks.indexOf(dataHandler);
        if (index > -1) dataCallbacks.splice(index, 1);
        resolve(null);
      }
    }, timeout);
  });
};

/**
 * Check if USB connection is active
 */
export const isUSBConnected = async (): Promise<boolean> => {
  return connectedDeviceId !== null;
};

/**
 * Register callback for data received
 */
export const onDataReceived = (callback: DataReceivedCallback): (() => void) => {
  dataCallbacks.push(callback);
  return () => {
    const index = dataCallbacks.indexOf(callback);
    if (index > -1) dataCallbacks.splice(index, 1);
  };
};

/**
 * Register callback for connection changes
 */
export const onConnectionChange = (callback: ConnectionCallback): (() => void) => {
  connectionCallbacks.push(callback);
  return () => {
    const index = connectionCallbacks.indexOf(callback);
    if (index > -1) connectionCallbacks.splice(index, 1);
  };
};

/**
 * Get active plugin type
 */
export const getActivePlugin = (): string => activePlugin;

/**
 * Check if USB Serial plugin is available
 */
export const isUSBSerialAvailable = (): boolean => {
  return activePlugin !== 'none';
};

/**
 * Filter devices to find POS terminals
 */
export const filterPOSDevices = (devices: USBDeviceInfo[]): USBDeviceInfo[] => {
  return devices.filter(device =>
    DEFAULT_POS_IDENTIFIERS.some(
      id => device.vendorId === id.vendorId && device.productId === id.productId
    )
  );
};

/**
 * Find and connect to POS device
 * This is the main function to establish USB connection with the POS
 */
export const findAndConnectPOS = async (): Promise<{ success: boolean; device?: USBDeviceInfo; error?: string }> => {
  console.log('[USBSerial] Finding and connecting to POS device...');

  // Initialize if needed
  if (!pluginInitialized) {
    await initializeUSBSerial();
  }

  if (activePlugin === 'none') {
    return { 
      success: false, 
      error: 'USB Serial plugin not available. Make sure you are running the native APK.' 
    };
  }

  // List devices using connectedDevices()
  const devices = await listUSBDevices();
  console.log('[USBSerial] Found devices:', devices);

  if (devices.length === 0) {
    return { 
      success: false, 
      error: 'No USB devices found. Connect the OM-A880 POS via USB OTG cable and grant permission.' 
    };
  }

  // Find POS device (or use first device)
  const posDevices = filterPOSDevices(devices);
  const targetDevice = posDevices.length > 0 ? posDevices[0] : devices[0];
  
  console.log('[USBSerial] Target device:', targetDevice);
  console.log('[USBSerial] Device ID for openSerial:', targetDevice.deviceId);

  // Open connection using openSerial()
  const connected = await openUSBConnection(targetDevice);
  
  if (!connected) {
    return { 
      success: false, 
      error: 'Failed to open USB serial connection. Check cable and try again.' 
    };
  }

  return { success: true, device: targetDevice };
};

/**
 * Send raw ECR command to POS and wait for response (legacy - no framing)
 * @deprecated Use sendFramedECRCommand instead
 */
export const sendCommandAndWaitForResponse = async (
  command: string, 
  timeoutMs: number = 30000
): Promise<{ success: boolean; response?: string; error?: string }> => {
  console.log('[USBSerial] Sending raw command (legacy):', command.substring(0, 100));

  if (connectedDeviceId === null) {
    return { success: false, error: 'Not connected to POS' };
  }

  const sent = await writeUSBData(command);
  if (!sent) {
    return { success: false, error: 'Failed to send command' };
  }

  // Wait for response
  const response = await readUSBData(timeoutMs);
  
  if (response) {
    return { success: true, response };
  } else {
    return { success: false, error: 'No response from POS (timeout)' };
  }
};

// Event callback types for framed communication
export type IntermediateStatusCallback = (statusCode: string, event: string, message: string) => void;
export type FinalResponseCallback = (xml: string) => void;

// Registered callbacks for ECR events
let intermediateCallbacks: IntermediateStatusCallback[] = [];
let posInitialized = false;

/**
 * Register callback for intermediate status events
 */
export const onIntermediateStatus = (callback: IntermediateStatusCallback): (() => void) => {
  intermediateCallbacks.push(callback);
  return () => {
    const index = intermediateCallbacks.indexOf(callback);
    if (index > -1) intermediateCallbacks.splice(index, 1);
  };
};

/**
 * Check if POS has been initialized
 */
export const isPOSInitialized = (): boolean => posInitialized;

/**
 * Send framed ECR command to POS with proper protocol handling
 * 
 * Flow:
 * 1. Frame command with STX/ETX/LRC
 * 2. Send framed command
 * 3. Wait for ACK
 * 4. Listen for intermediate status messages (ACK each)
 * 5. Wait for final response (ACK it)
 * 6. Return parsed response
 */
export const sendFramedECRCommand = async (
  xmlCommand: string,
  timeoutMs: number = 120000,
  onStatus?: IntermediateStatusCallback
): Promise<{ 
  success: boolean; 
  response?: string; 
  ackReceived: boolean;
  intermediateEvents: string[];
  error?: string;
  rawHex?: string;
}> => {
  console.log('[USBSerial ECR] Sending framed command...');
  console.log('[USBSerial ECR] XML:', xmlCommand.substring(0, 150));

  if (connectedDeviceId === null) {
    return { success: false, ackReceived: false, intermediateEvents: [], error: 'Not connected to POS' };
  }

  // Send framed command
  const sent = await writeFramedCommand(xmlCommand);
  if (!sent) {
    return { success: false, ackReceived: false, intermediateEvents: [], error: 'Failed to send framed command' };
  }

  console.log('[USBSerial ECR] Command sent, waiting for response...');

  // Collect events and response
  const intermediateEvents: string[] = [];
  let ackReceived = false;
  let finalResponse: string | null = null;
  let rawHex: string = '';

  return new Promise((resolve) => {
    let resolved = false;
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        resolve({
          success: false,
          ackReceived,
          intermediateEvents,
          error: 'Timeout waiting for POS response',
        });
      }
    }, timeoutMs);

    // Handle incoming data
    const handleData = async (data: string) => {
      if (resolved) return;

      console.log('[USBSerial ECR] Raw data received:', data.substring(0, 100));
      
      // Convert string to bytes for parsing
      const bytes = new Uint8Array(data.split('').map(c => c.charCodeAt(0)));
      const parsed = parseFramedResponse(bytes);
      
      rawHex = parsed.rawHex;
      console.log('[USBSerial ECR] Parsed:', {
        valid: parsed.valid,
        isACK: parsed.isACK,
        isNAK: parsed.isNAK,
        isIntermediate: parsed.isIntermediate,
        dataLength: parsed.data?.length,
      });

      // Handle ACK
      if (parsed.isACK) {
        console.log('[USBSerial ECR] ACK received ✓');
        ackReceived = true;
        return; // Continue waiting for actual response
      }

      // Handle NAK
      if (parsed.isNAK) {
        console.error('[USBSerial ECR] NAK received - command rejected!');
        resolved = true;
        clearTimeout(timeoutId);
        unsubscribe();
        resolve({
          success: false,
          ackReceived: false,
          intermediateEvents,
          error: 'POS rejected command (NAK)',
          rawHex,
        });
        return;
      }

      // Handle intermediate status
      if (parsed.isIntermediate && parsed.data) {
        const statusCode = parseIntermediateStatus(parsed.data);
        if (statusCode) {
          const statusInfo = INTERMEDIATE_STATUS_CODES[statusCode];
          const event = statusInfo?.event || 'UNKNOWN';
          const message = statusInfo?.arabicMessage || '';
          
          console.log('[USBSerial ECR] Intermediate status:', statusCode, event);
          intermediateEvents.push(`${statusCode}:${event}`);
          
          // Notify callbacks
          if (onStatus) onStatus(statusCode, event, message);
          intermediateCallbacks.forEach(cb => cb(statusCode, event, message));
          
          // ACK the intermediate message
          await sendACK();
        }
        return; // Continue waiting for final response
      }

      // Handle final response (has ResponseCode or ErrorCode)
      if (parsed.data && (
        parsed.data.includes('<ResponseCode>') || 
        parsed.data.includes('<ErrorCode>') ||
        parsed.data.includes('</EFTData>')
      )) {
        console.log('[USBSerial ECR] Final response received');
        finalResponse = parsed.data;
        
        // ACK the final response
        await sendACK();
        
        resolved = true;
        clearTimeout(timeoutId);
        unsubscribe();
        
        resolve({
          success: true,
          response: finalResponse,
          ackReceived,
          intermediateEvents,
          rawHex,
        });
        return;
      }

      // Unknown data - log but continue
      console.warn('[USBSerial ECR] Unknown data format:', parsed.data?.substring(0, 100));
    };

    // Subscribe to data
    const unsubscribe = onDataReceived(handleData);
  });
};

/**
 * Initialize POS connection with GetTerminalInfo
 * MANDATORY: Must be called before any transaction!
 */
export const initializePOSTerminal = async (): Promise<{
  success: boolean;
  terminalId?: string;
  merchantId?: string;
  appVersion?: string;
  serialNo?: string;
  error?: string;
}> => {
  console.log('[USBSerial ECR] Initializing POS terminal...');

  // Import framing module for building command
  const { buildGetTerminalInfoCommand } = await import('./ecrFraming');
  const xmlCommand = buildGetTerminalInfoCommand();
  
  const result = await sendFramedECRCommand(xmlCommand, 15000);
  
  if (!result.success || !result.response) {
    console.error('[USBSerial ECR] POS initialization failed:', result.error);
    posInitialized = false;
    return { 
      success: false, 
      error: result.error || 'No response from POS during initialization' 
    };
  }

  // Parse terminal info from response
  try {
    const tidMatch = result.response.match(/<TID>([^<]+)<\/TID>/);
    const midMatch = result.response.match(/<MID>([^<]+)<\/MID>/);
    const versionMatch = result.response.match(/<AppVersion>([^<]+)<\/AppVersion>/);
    const serialMatch = result.response.match(/<SerialNo>([^<]+)<\/SerialNo>/);
    const errorMatch = result.response.match(/<ErrorCode>([^<]+)<\/ErrorCode>/);
    
    const errorCode = errorMatch?.[1];
    if (errorCode && errorCode !== 'E000') {
      console.error('[USBSerial ECR] POS returned error:', errorCode);
      posInitialized = false;
      return { 
        success: false, 
        error: `POS error: ${errorCode}` 
      };
    }

    posInitialized = true;
    console.log('[USBSerial ECR] POS initialized successfully');
    console.log('[USBSerial ECR] TID:', tidMatch?.[1], 'MID:', midMatch?.[1]);

    return {
      success: true,
      terminalId: tidMatch?.[1],
      merchantId: midMatch?.[1],
      appVersion: versionMatch?.[1],
      serialNo: serialMatch?.[1],
    };
  } catch (parseError) {
    console.error('[USBSerial ECR] Failed to parse terminal info:', parseError);
    return { 
      success: false, 
      error: 'Failed to parse terminal info response' 
    };
  }
};

/**
 * Send Purchase transaction with proper ECR protocol
 * 
 * @param amountInBaisas - Amount without decimals (e.g., 10.50 OMR = 1050)
 * @param merchantRef - Optional reference (max 22 chars)
 * @param onStatus - Optional callback for intermediate status updates
 */
export const sendPurchaseTransaction = async (
  amountInBaisas: number,
  merchantRef?: string,
  onStatus?: IntermediateStatusCallback
): Promise<{
  success: boolean;
  response?: string;
  rrn?: string;
  authCode?: string;
  tid?: string;
  mid?: string;
  error?: string;
  intermediateEvents: string[];
}> => {
  console.log('[USBSerial ECR] Starting Purchase transaction...');
  console.log('[USBSerial ECR] Amount:', amountInBaisas, 'baisas');

  // Check if POS is initialized
  if (!posInitialized) {
    console.log('[USBSerial ECR] POS not initialized, initializing...');
    const initResult = await initializePOSTerminal();
    if (!initResult.success) {
      return {
        success: false,
        error: `POS initialization failed: ${initResult.error}`,
        intermediateEvents: [],
      };
    }
  }

  // Import framing module for building command
  const { buildPurchaseCommand } = await import('./ecrFraming');
  const xmlCommand = buildPurchaseCommand(amountInBaisas, merchantRef);
  
  // Send with 2 minute timeout for card entry/PIN
  const result = await sendFramedECRCommand(xmlCommand, 120000, onStatus);
  
  if (!result.success || !result.response) {
    return {
      success: false,
      error: result.error || 'No response from POS',
      intermediateEvents: result.intermediateEvents,
    };
  }

  // Parse transaction response
  try {
    const rrnMatch = result.response.match(/<RRN>([^<]+)<\/RRN>/);
    const authMatch = result.response.match(/<AuthCode>([^<]+)<\/AuthCode>/);
    const tidMatch = result.response.match(/<TID>([^<]+)<\/TID>/);
    const midMatch = result.response.match(/<MID>([^<]+)<\/MID>/);
    const errorMatch = result.response.match(/<ErrorCode>([^<]+)<\/ErrorCode>/);
    const responseMatch = result.response.match(/<ResponseCode>([^<]+)<\/ResponseCode>/);
    const statusMatch = result.response.match(/<TxnStatus>([^<]+)<\/TxnStatus>/);
    
    const errorCode = errorMatch?.[1];
    const responseCode = responseMatch?.[1];
    const txnStatus = statusMatch?.[1];
    
    // Transaction is successful if error is E000 and status is OK, or response is 00/APPROVED
    const success = (errorCode === 'E000' && txnStatus === 'OK') || 
                    responseCode === '00' || 
                    responseCode === 'APPROVED';

    return {
      success,
      response: result.response,
      rrn: rrnMatch?.[1],
      authCode: authMatch?.[1],
      tid: tidMatch?.[1],
      mid: midMatch?.[1],
      error: success ? undefined : `${errorCode}: ${responseCode}`,
      intermediateEvents: result.intermediateEvents,
    };
  } catch (parseError) {
    console.error('[USBSerial ECR] Failed to parse transaction response:', parseError);
    return {
      success: false,
      error: 'Failed to parse transaction response',
      intermediateEvents: result.intermediateEvents,
    };
  }
};

/**
 * Get last transaction status (recovery after timeout)
 */
export const getLastTransactionStatus = async (): Promise<{
  success: boolean;
  response?: string;
  error?: string;
}> => {
  const { buildLastTransactionStatusCommand } = await import('./ecrFraming');
  const xmlCommand = buildLastTransactionStatusCommand();
  
  const result = await sendFramedECRCommand(xmlCommand, 30000);
  
  return {
    success: result.success,
    response: result.response,
    error: result.error,
  };
};
