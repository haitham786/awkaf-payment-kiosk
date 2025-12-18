/**
 * USB Serial Plugin Abstraction Layer
 * 
 * This module provides a unified interface for USB serial communication
 * compatible with multiple Capacitor USB serial plugins.
 * 
 * Supported plugins:
 * - capacitor-plugin-usb-serial (recommended)
 * - @nickolay/capacitor-usb-serial
 * - Custom native bridges
 * 
 * Installation required:
 * npm install capacitor-plugin-usb-serial
 * 
 * Then in Android project:
 * 1. Sync: npx cap sync android
 * 2. Build and run
 */

import { USBDeviceInfo, DEFAULT_POS_IDENTIFIERS } from './usbHostService';

// Plugin availability flags
let pluginInitialized = false;
let activePlugin: 'capacitor-usb-serial' | 'native-bridge' | 'none' = 'none';

// Serial connection settings for OM-A880
export const POS_SERIAL_CONFIG = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none' as const,
  timeout: 5000,
};

// Callback types
type DataReceivedCallback = (data: string) => void;
type ConnectionCallback = (connected: boolean, device?: USBDeviceInfo) => void;

// Registered callbacks
let dataCallbacks: DataReceivedCallback[] = [];
let connectionCallbacks: ConnectionCallback[] = [];

/**
 * Initialize the USB Serial plugin
 * Detects which plugin is available and sets up listeners
 */
export const initializeUSBSerial = async (): Promise<boolean> => {
  if (pluginInitialized) {
    return activePlugin !== 'none';
  }

  console.log('[USBSerial] Initializing USB Serial plugin...');

  // Try Capacitor USB Serial plugin
  if (await tryCapacitorUSBSerial()) {
    activePlugin = 'capacitor-usb-serial';
    pluginInitialized = true;
    console.log('[USBSerial] Using capacitor-usb-serial plugin');
    return true;
  }

  // Try native bridge fallback
  if (tryNativeBridge()) {
    activePlugin = 'native-bridge';
    pluginInitialized = true;
    console.log('[USBSerial] Using native bridge');
    return true;
  }

  console.warn('[USBSerial] No USB Serial plugin available');
  pluginInitialized = true;
  return false;
};

/**
 * Try to initialize Capacitor USB Serial plugin
 */
const tryCapacitorUSBSerial = async (): Promise<boolean> => {
  try {
    // Check for the plugin in Capacitor context
    if (typeof (window as any).Capacitor === 'undefined') {
      console.log('[USBSerial] Not running in Capacitor environment');
      return false;
    }

    const Capacitor = (window as any).Capacitor;
    
    // Check if native platform
    if (!Capacitor.isNativePlatform()) {
      console.log('[USBSerial] Not running on native platform (browser mode)');
      return false;
    }
    
    // Check if plugin is registered
    const plugins = Capacitor.Plugins;
    
    // Try different plugin names (capacitor-plugin-usb-serial registers as UsbSerial)
    const possiblePluginNames = [
      'UsbSerial',        // capacitor-plugin-usb-serial
      'USBSerial',        // alternative casing
      'CapacitorUsbSerial',
      'capacitorUsbSerial',
    ];

    for (const pluginName of possiblePluginNames) {
      if (plugins?.[pluginName]) {
        console.log(`[USBSerial] Found plugin: ${pluginName}`);
        
        // Register data listener
        try {
          await plugins[pluginName].addListener('data', (event: { data: string }) => {
            console.log('[USBSerial] Data received:', event.data?.substring(0, 100));
            dataCallbacks.forEach(cb => cb(event.data));
          });

          await plugins[pluginName].addListener('connectionChange', (event: { connected: boolean }) => {
            console.log('[USBSerial] Connection changed:', event.connected);
            connectionCallbacks.forEach(cb => cb(event.connected));
          });
          
          await plugins[pluginName].addListener('error', (event: { error: string }) => {
            console.error('[USBSerial] Plugin error:', event.error);
          });
        } catch (e) {
          console.warn('[USBSerial] Could not register listeners:', e);
        }

        return true;
      }
    }

    console.log('[USBSerial] No USB Serial plugin found in Capacitor.Plugins');
    console.log('[USBSerial] Available plugins:', Object.keys(plugins || {}));
    return false;
  } catch (error) {
    console.error('[USBSerial] Error initializing Capacitor plugin:', error);
    return false;
  }
};

/**
 * Try native bridge fallback
 */
const tryNativeBridge = (): boolean => {
  const possibleBridges = [
    'AndroidUSBSerial',
    'AndroidUSB',
    'OMA880Bridge',
    'POSBridge',
  ];

  for (const bridge of possibleBridges) {
    if (typeof (window as any)[bridge] !== 'undefined') {
      console.log(`[USBSerial] Found native bridge: ${bridge}`);
      return true;
    }
  }

  return false;
};

/**
 * Get the active USB Serial plugin instance
 */
const getPlugin = (): any => {
  if (typeof (window as any).Capacitor === 'undefined') {
    return null;
  }

  const plugins = (window as any).Capacitor.Plugins;
  
  const possiblePluginNames = [
    'USBSerial',
    'UsbSerial',
    'CapacitorUsbSerial',
  ];

  for (const name of possiblePluginNames) {
    if (plugins?.[name]) {
      return plugins[name];
    }
  }

  return null;
};

/**
 * Get native bridge if available
 */
const getNativeBridge = (): any => {
  const possibleBridges = [
    'AndroidUSBSerial',
    'AndroidUSB',
    'OMA880Bridge',
    'POSBridge',
  ];

  for (const bridge of possibleBridges) {
    if (typeof (window as any)[bridge] !== 'undefined') {
      return (window as any)[bridge];
    }
  }

  return null;
};

/**
 * List available USB devices
 */
export const listUSBDevices = async (): Promise<USBDeviceInfo[]> => {
  console.log('[USBSerial] Listing USB devices...');

  try {
    // Capacitor plugin
    const plugin = getPlugin();
    if (plugin) {
      const result = await plugin.listDevices();
      console.log('[USBSerial] Devices found:', result);
      return result?.devices || [];
    }

    // Native bridge
    const bridge = getNativeBridge();
    if (bridge?.listDevices) {
      const devices = await bridge.listDevices();
      return devices || [];
    }

    if (bridge?.getDeviceList) {
      const devices = await bridge.getDeviceList();
      return devices || [];
    }
  } catch (error) {
    console.error('[USBSerial] Error listing devices:', error);
  }

  return [];
};

/**
 * Request USB permission for a device
 */
export const requestUSBPermission = async (device: USBDeviceInfo): Promise<boolean> => {
  console.log('[USBSerial] Requesting permission for device:', device);

  try {
    // Capacitor plugin
    const plugin = getPlugin();
    if (plugin) {
      const result = await plugin.requestPermission({
        vendorId: device.vendorId,
        productId: device.productId,
      });
      return result?.granted ?? false;
    }

    // Native bridge
    const bridge = getNativeBridge();
    if (bridge?.requestPermission) {
      return await bridge.requestPermission(device.vendorId, device.productId);
    }
  } catch (error) {
    console.error('[USBSerial] Error requesting permission:', error);
  }

  return false;
};

/**
 * Open USB serial connection
 */
export const openUSBConnection = async (device: USBDeviceInfo): Promise<boolean> => {
  console.log('[USBSerial] Opening connection to device:', device);

  try {
    // Capacitor plugin
    const plugin = getPlugin();
    if (plugin) {
      const result = await plugin.open({
        vendorId: device.vendorId,
        productId: device.productId,
        baudRate: POS_SERIAL_CONFIG.baudRate,
        dataBits: POS_SERIAL_CONFIG.dataBits,
        stopBits: POS_SERIAL_CONFIG.stopBits,
        parity: POS_SERIAL_CONFIG.parity,
      });
      
      if (result?.success) {
        connectionCallbacks.forEach(cb => cb(true, device));
        return true;
      }
      return false;
    }

    // Native bridge
    const bridge = getNativeBridge();
    if (bridge?.openConnection) {
      const connected = await bridge.openConnection(
        device.vendorId,
        device.productId,
        POS_SERIAL_CONFIG.baudRate
      );
      if (connected) {
        connectionCallbacks.forEach(cb => cb(true, device));
      }
      return connected;
    }

    if (bridge?.connect) {
      const connected = await bridge.connect(device);
      if (connected) {
        connectionCallbacks.forEach(cb => cb(true, device));
      }
      return connected;
    }
  } catch (error) {
    console.error('[USBSerial] Error opening connection:', error);
  }

  return false;
};

/**
 * Close USB serial connection
 */
export const closeUSBConnection = async (): Promise<boolean> => {
  console.log('[USBSerial] Closing connection...');

  try {
    // Capacitor plugin
    const plugin = getPlugin();
    if (plugin) {
      await plugin.close();
      connectionCallbacks.forEach(cb => cb(false));
      return true;
    }

    // Native bridge
    const bridge = getNativeBridge();
    if (bridge?.closeConnection) {
      await bridge.closeConnection();
      connectionCallbacks.forEach(cb => cb(false));
      return true;
    }

    if (bridge?.disconnect) {
      await bridge.disconnect();
      connectionCallbacks.forEach(cb => cb(false));
      return true;
    }
  } catch (error) {
    console.error('[USBSerial] Error closing connection:', error);
  }

  return false;
};

/**
 * Write data to USB serial
 */
export const writeUSBData = async (data: string): Promise<boolean> => {
  console.log('[USBSerial] Writing data:', data.substring(0, 100) + '...');

  try {
    // Capacitor plugin
    const plugin = getPlugin();
    if (plugin) {
      const result = await plugin.write({ data });
      return result?.success ?? false;
    }

    // Native bridge
    const bridge = getNativeBridge();
    if (bridge?.write) {
      return await bridge.write(data);
    }

    if (bridge?.sendData) {
      return await bridge.sendData(data);
    }
  } catch (error) {
    console.error('[USBSerial] Error writing data:', error);
  }

  return false;
};

/**
 * Read data from USB serial (with timeout)
 */
export const readUSBData = async (timeout: number = 5000): Promise<string | null> => {
  console.log('[USBSerial] Reading data with timeout:', timeout);

  return new Promise((resolve) => {
    let resolved = false;

    const dataHandler = (data: string) => {
      if (!resolved) {
        resolved = true;
        resolve(data);
        // Remove this specific handler
        const index = dataCallbacks.indexOf(dataHandler);
        if (index > -1) {
          dataCallbacks.splice(index, 1);
        }
      }
    };

    dataCallbacks.push(dataHandler);

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const index = dataCallbacks.indexOf(dataHandler);
        if (index > -1) {
          dataCallbacks.splice(index, 1);
        }
        resolve(null);
      }
    }, timeout);
  });
};

/**
 * Check if USB connection is open
 */
export const isUSBConnected = async (): Promise<boolean> => {
  try {
    // Capacitor plugin
    const plugin = getPlugin();
    if (plugin?.isConnected) {
      const result = await plugin.isConnected();
      return result?.connected ?? false;
    }

    // Native bridge
    const bridge = getNativeBridge();
    if (bridge?.isConnected) {
      return await bridge.isConnected();
    }

    if (bridge?.getStatus) {
      const status = await bridge.getStatus();
      return status?.connected ?? false;
    }
  } catch (error) {
    console.error('[USBSerial] Error checking connection:', error);
  }

  return false;
};

/**
 * Register callback for data received
 */
export const onDataReceived = (callback: DataReceivedCallback): (() => void) => {
  dataCallbacks.push(callback);
  return () => {
    const index = dataCallbacks.indexOf(callback);
    if (index > -1) {
      dataCallbacks.splice(index, 1);
    }
  };
};

/**
 * Register callback for connection changes
 */
export const onConnectionChange = (callback: ConnectionCallback): (() => void) => {
  connectionCallbacks.push(callback);
  return () => {
    const index = connectionCallbacks.indexOf(callback);
    if (index > -1) {
      connectionCallbacks.splice(index, 1);
    }
  };
};

/**
 * Get active plugin type
 */
export const getActivePlugin = (): string => activePlugin;

/**
 * Check if any USB plugin is available
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
      error: 'No USB Serial plugin available. Please install capacitor-plugin-usb-serial.' 
    };
  }

  // List devices
  const devices = await listUSBDevices();
  console.log('[USBSerial] Found devices:', devices);

  if (devices.length === 0) {
    return { 
      success: false, 
      error: 'No USB devices found. Please connect the POS terminal.' 
    };
  }

  // Filter for POS devices
  const posDevices = filterPOSDevices(devices);
  
  // If no known POS device, try first available device
  const targetDevice = posDevices.length > 0 ? posDevices[0] : devices[0];
  console.log('[USBSerial] Target device:', targetDevice);

  // Request permission
  const hasPermission = await requestUSBPermission(targetDevice);
  if (!hasPermission) {
    return { 
      success: false, 
      error: 'USB permission denied. Please grant USB access permission.' 
    };
  }

  // Open connection
  const connected = await openUSBConnection(targetDevice);
  if (!connected) {
    return { 
      success: false, 
      error: 'Failed to open USB connection. Please try reconnecting the cable.' 
    };
  }

  return { success: true, device: targetDevice };
};
