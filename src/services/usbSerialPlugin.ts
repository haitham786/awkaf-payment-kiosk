/**
 * USB Serial Plugin - CORRECT Implementation for capacitor-plugin-usb-serial
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
 */

import { USBDeviceInfo, DEFAULT_POS_IDENTIFIERS } from './usbHostService';

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
export const POS_SERIAL_CONFIG = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 0, // 0 = none
  dtr: true, // Data Terminal Ready
  rts: true, // Request To Send
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
 * Write data to USB serial using writeSerial()
 */
export const writeUSBData = async (data: string): Promise<boolean> => {
  console.log('[USBSerial] Writing data:', data.substring(0, 100));

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
 * Send ECR command to POS and wait for response
 */
export const sendCommandAndWaitForResponse = async (
  command: string, 
  timeoutMs: number = 30000
): Promise<{ success: boolean; response?: string; error?: string }> => {
  console.log('[USBSerial] Sending command:', command.substring(0, 100));

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
