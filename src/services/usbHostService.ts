/**
 * USB Host Service for OM-A880 POS Integration
 * 
 * This service provides USB Host communication capabilities for Android devices
 * (Samsung Galaxy A13/A33 for trial, Sunmi Flex 3 for production).
 * 
 * Key Features:
 * - Automatic USB device detection on app launch, foreground, and cable connection
 * - USB permission handling (automatic request)
 * - USB session ownership and management
 * - Keep-alive messaging
 * - Reconnection on disconnect
 * 
 * IMPORTANT: For this to work on Android, you need to install a USB serial plugin:
 * npm install capacitor-plugin-usb-serial
 * npx cap sync android
 */

// USB Device identifiers
export interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  deviceId?: number; // Device ID used by capacitor-plugin-usb-serial for openSerial
  deviceName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  deviceClass?: number;
  deviceSubclass?: number;
}

// Known OM-A880 POS identifiers (configurable)
// CRITICAL: User's POS detected as Vendor 05C6, Product 903B (CDC ACM)
export const DEFAULT_POS_IDENTIFIERS: USBDeviceInfo[] = [
  // OM-A880 POS - CONFIRMED WORKING (User's device)
  { vendorId: 0x05C6, productId: 0x903B }, // OM-A880 CDC ACM - PRIMARY
  
  // OMA Emirates OM-A880 variants
  { vendorId: 0x0D46, productId: 0x4001 }, // OMA Emirates OM-A880 (common)
  { vendorId: 0x0D46, productId: 0x4002 }, // OMA Emirates OM-A880 variant
  { vendorId: 0x0D46, productId: 0x0000 }, // OMA Emirates generic
  
  // Newland POS (OM-A880 is based on Newland hardware)
  { vendorId: 0x1D90, productId: 0x201A }, // Newland N900
  { vendorId: 0x1D90, productId: 0x2015 }, // Newland generic
  
  // Qualcomm CDC (same vendor as user's device)
  { vendorId: 0x05C6, productId: 0x9091 }, // Qualcomm variant
  { vendorId: 0x05C6, productId: 0x9092 }, // Qualcomm variant
  
  // USB-Serial Adapters (commonly used with POS)
  { vendorId: 0x1A86, productId: 0x7523 }, // CH340 USB-Serial
  { vendorId: 0x067B, productId: 0x2303 }, // Prolific PL2303
  { vendorId: 0x0403, productId: 0x6001 }, // FTDI FT232R
  { vendorId: 0x10C4, productId: 0xEA60 }, // CP210x
  
  // CDC ACM (standard USB serial class)
  { vendorId: 0x0000, productId: 0x0000, deviceClass: 0x02 }, // CDC class
];

// USB Connection Status
export type USBConnectionState = 
  | 'disconnected'
  | 'device_detected'
  | 'requesting_permission'
  | 'permission_granted'
  | 'permission_denied'
  | 'connecting'
  | 'connected'
  | 'handshake_pending'
  | 'ready'
  | 'error';

// USB Event types
export type USBEventType = 
  | 'device_attached'
  | 'device_detached'
  | 'permission_granted'
  | 'permission_denied'
  | 'connection_established'
  | 'connection_lost'
  | 'data_received'
  | 'error';

// USB Event callback
export interface USBEvent {
  type: USBEventType;
  device?: USBDeviceInfo;
  data?: string;
  error?: string;
  timestamp: number;
}

// Callbacks
type USBStateCallback = (state: USBConnectionState, device?: USBDeviceInfo) => void;
type USBEventCallback = (event: USBEvent) => void;
type USBDataCallback = (data: string) => void;

// Internal state
let connectionState: USBConnectionState = 'disconnected';
let connectedDevice: USBDeviceInfo | null = null;
let customPOSIdentifiers: USBDeviceInfo[] = [];
let stateListeners: USBStateCallback[] = [];
let eventListeners: USBEventCallback[] = [];
let dataListeners: USBDataCallback[] = [];
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const KEEP_ALIVE_INTERVAL = 5000; // 5 seconds

/**
 * Initialize USB Host service
 * Call this on app launch and when returning to foreground
 */
export const initializeUSBHost = async (customIdentifiers?: USBDeviceInfo[]): Promise<boolean> => {
  console.log('[USBHost] Initializing USB Host service...');
  
  if (customIdentifiers && customIdentifiers.length > 0) {
    customPOSIdentifiers = customIdentifiers;
  }
  
  // Check if running on Android with USB Host support
  if (!isUSBHostAvailable()) {
    console.warn('[USBHost] USB Host not available in this environment');
    return false;
  }
  
  // Register for USB events
  registerUSBEventListeners();
  
  // Scan for existing connected devices
  await scanForDevices();
  
  return connectionState !== 'disconnected';
};

/**
 * Check if USB Host is available (Android native bridge)
 */
export const isUSBHostAvailable = (): boolean => {
  // Check for Capacitor USB plugin
  if (typeof (window as any).Capacitor !== 'undefined') {
    const plugins = (window as any).Capacitor?.Plugins;
    if (plugins?.USBHost || plugins?.OMA880USB) {
      return true;
    }
  }
  
  // Check for native Android bridge
  if (typeof (window as any).AndroidUSBHost !== 'undefined') {
    return true;
  }
  
  // Check for OM-A880 specific bridge
  if (typeof (window as any).OMA880Bridge !== 'undefined') {
    return true;
  }
  
  return false;
};

/**
 * Register USB event listeners for attach/detach
 */
const registerUSBEventListeners = () => {
  // Capacitor plugin approach
  if (typeof (window as any).Capacitor !== 'undefined') {
    const plugins = (window as any).Capacitor?.Plugins;
    
    if (plugins?.USBHost) {
      plugins.USBHost.addListener('deviceAttached', handleDeviceAttached);
      plugins.USBHost.addListener('deviceDetached', handleDeviceDetached);
      plugins.USBHost.addListener('dataReceived', handleDataReceived);
      console.log('[USBHost] Registered Capacitor USB listeners');
      return;
    }
    
    if (plugins?.OMA880USB) {
      plugins.OMA880USB.addListener('onDeviceAttached', handleDeviceAttached);
      plugins.OMA880USB.addListener('onDeviceDetached', handleDeviceDetached);
      plugins.OMA880USB.addListener('onDataReceived', handleDataReceived);
      console.log('[USBHost] Registered OMA880USB listeners');
      return;
    }
  }
  
  // Native Android bridge approach
  if (typeof (window as any).AndroidUSBHost !== 'undefined') {
    (window as any).AndroidUSBHost.onDeviceAttached = handleDeviceAttached;
    (window as any).AndroidUSBHost.onDeviceDetached = handleDeviceDetached;
    (window as any).AndroidUSBHost.onDataReceived = handleDataReceived;
    console.log('[USBHost] Registered AndroidUSBHost listeners');
    return;
  }
  
  // OM-A880 Bridge approach
  if (typeof (window as any).OMA880Bridge !== 'undefined') {
    (window as any).OMA880Bridge.onUSBAttached = handleDeviceAttached;
    (window as any).OMA880Bridge.onUSBDetached = handleDeviceDetached;
    (window as any).OMA880Bridge.onDataReceived = handleDataReceived;
    console.log('[USBHost] Registered OMA880Bridge listeners');
  }
};

/**
 * Scan for connected USB devices
 */
export const scanForDevices = async (): Promise<USBDeviceInfo[]> => {
  console.log('[USBHost] Scanning for USB devices...');
  
  const identifiers = [...DEFAULT_POS_IDENTIFIERS, ...customPOSIdentifiers];
  
  try {
    // Capacitor plugin
    if (typeof (window as any).Capacitor !== 'undefined') {
      const plugins = (window as any).Capacitor?.Plugins;
      
      if (plugins?.USBHost) {
        const result = await plugins.USBHost.listDevices();
        return filterPOSDevices(result.devices || [], identifiers);
      }
      
      if (plugins?.OMA880USB) {
        const result = await plugins.OMA880USB.getConnectedDevices();
        return filterPOSDevices(result.devices || [], identifiers);
      }
    }
    
    // Native Android bridge
    if (typeof (window as any).AndroidUSBHost !== 'undefined') {
      const devices = await (window as any).AndroidUSBHost.getDeviceList();
      return filterPOSDevices(devices || [], identifiers);
    }
    
    // OM-A880 Bridge
    if (typeof (window as any).OMA880Bridge !== 'undefined') {
      const devices = await (window as any).OMA880Bridge.scanUSBDevices();
      return filterPOSDevices(devices || [], identifiers);
    }
  } catch (error) {
    console.error('[USBHost] Error scanning devices:', error);
  }
  
  return [];
};

/**
 * Filter devices to find POS terminals
 */
const filterPOSDevices = (devices: USBDeviceInfo[], identifiers: USBDeviceInfo[]): USBDeviceInfo[] => {
  return devices.filter(device => 
    identifiers.some(id => 
      (id.vendorId && id.productId && device.vendorId === id.vendorId && device.productId === id.productId) ||
      (id.deviceClass && device.deviceClass === id.deviceClass)
    )
  );
};

/**
 * Handle device attached event
 */
const handleDeviceAttached = async (device: USBDeviceInfo) => {
  console.log('[USBHost] Device attached:', device);
  
  setConnectionState('device_detected', device);
  notifyEvent({ type: 'device_attached', device, timestamp: Date.now() });
  
  // Auto-request permission
  await requestPermission(device);
};

/**
 * Handle device detached event
 */
const handleDeviceDetached = (device: USBDeviceInfo) => {
  console.log('[USBHost] Device detached:', device);
  
  if (connectedDevice?.vendorId === device.vendorId && connectedDevice?.productId === device.productId) {
    stopKeepAlive();
    connectedDevice = null;
    setConnectionState('disconnected');
    notifyEvent({ type: 'device_detached', device, timestamp: Date.now() });
    
    // Attempt reconnection after brief delay (cable reinserted)
    setTimeout(() => {
      if (connectionState === 'disconnected') {
        scanForDevices().then(devices => {
          if (devices.length > 0) {
            handleDeviceAttached(devices[0]);
          }
        });
      }
    }, 1000);
  }
};

/**
 * Handle data received from POS
 */
const handleDataReceived = (data: string) => {
  console.log('[USBHost] Data received:', data);
  notifyEvent({ type: 'data_received', data, timestamp: Date.now() });
  dataListeners.forEach(listener => listener(data));
};

/**
 * Request USB permission for a device
 */
export const requestPermission = async (device: USBDeviceInfo): Promise<boolean> => {
  console.log('[USBHost] Requesting permission for device:', device);
  setConnectionState('requesting_permission', device);
  
  try {
    // Capacitor plugin
    if (typeof (window as any).Capacitor !== 'undefined') {
      const plugins = (window as any).Capacitor?.Plugins;
      
      if (plugins?.USBHost) {
        const result = await plugins.USBHost.requestPermission({ 
          vendorId: device.vendorId, 
          productId: device.productId 
        });
        return handlePermissionResult(result.granted, device);
      }
      
      if (plugins?.OMA880USB) {
        const result = await plugins.OMA880USB.requestDevicePermission({
          vendorId: device.vendorId,
          productId: device.productId
        });
        return handlePermissionResult(result.granted, device);
      }
    }
    
    // Native Android bridge
    if (typeof (window as any).AndroidUSBHost !== 'undefined') {
      const granted = await (window as any).AndroidUSBHost.requestPermission(
        device.vendorId, 
        device.productId
      );
      return handlePermissionResult(granted, device);
    }
    
    // OM-A880 Bridge
    if (typeof (window as any).OMA880Bridge !== 'undefined') {
      const granted = await (window as any).OMA880Bridge.requestUSBPermission(device);
      return handlePermissionResult(granted, device);
    }
  } catch (error) {
    console.error('[USBHost] Permission request error:', error);
    setConnectionState('error', device);
    notifyEvent({ type: 'error', device, error: String(error), timestamp: Date.now() });
  }
  
  return false;
};

/**
 * Handle permission result
 */
const handlePermissionResult = async (granted: boolean, device: USBDeviceInfo): Promise<boolean> => {
  if (granted) {
    console.log('[USBHost] Permission granted');
    setConnectionState('permission_granted', device);
    notifyEvent({ type: 'permission_granted', device, timestamp: Date.now() });
    
    // Proceed to connect
    return await connectToDevice(device);
  } else {
    console.log('[USBHost] Permission denied');
    setConnectionState('permission_denied', device);
    notifyEvent({ type: 'permission_denied', device, timestamp: Date.now() });
    
    // Retry permission after delay
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      setTimeout(() => requestPermission(device), 3000);
    }
    
    return false;
  }
};

/**
 * Connect to USB device
 */
export const connectToDevice = async (device: USBDeviceInfo): Promise<boolean> => {
  console.log('[USBHost] Connecting to device:', device);
  setConnectionState('connecting', device);
  
  try {
    // Capacitor plugin
    if (typeof (window as any).Capacitor !== 'undefined') {
      const plugins = (window as any).Capacitor?.Plugins;
      
      if (plugins?.USBHost) {
        const result = await plugins.USBHost.openDevice({
          vendorId: device.vendorId,
          productId: device.productId
        });
        if (result.success) {
          return handleConnectionSuccess(device);
        }
      }
      
      if (plugins?.OMA880USB) {
        const result = await plugins.OMA880USB.connect({
          vendorId: device.vendorId,
          productId: device.productId
        });
        if (result.connected) {
          return handleConnectionSuccess(device);
        }
      }
    }
    
    // Native Android bridge
    if (typeof (window as any).AndroidUSBHost !== 'undefined') {
      const connected = await (window as any).AndroidUSBHost.openConnection(
        device.vendorId,
        device.productId
      );
      if (connected) {
        return handleConnectionSuccess(device);
      }
    }
    
    // OM-A880 Bridge
    if (typeof (window as any).OMA880Bridge !== 'undefined') {
      const connected = await (window as any).OMA880Bridge.connectUSB(device);
      if (connected) {
        return handleConnectionSuccess(device);
      }
    }
  } catch (error) {
    console.error('[USBHost] Connection error:', error);
    setConnectionState('error', device);
    notifyEvent({ type: 'error', device, error: String(error), timestamp: Date.now() });
  }
  
  return false;
};

/**
 * Handle successful connection
 */
const handleConnectionSuccess = (device: USBDeviceInfo): boolean => {
  console.log('[USBHost] Connection established');
  connectedDevice = device;
  reconnectAttempts = 0;
  setConnectionState('connected', device);
  notifyEvent({ type: 'connection_established', device, timestamp: Date.now() });
  
  // Start keep-alive
  startKeepAlive();
  
  return true;
};

/**
 * Send data to USB device
 */
export const sendData = async (data: string): Promise<boolean> => {
  if (!connectedDevice || connectionState !== 'connected' && connectionState !== 'ready') {
    console.warn('[USBHost] Cannot send data - not connected');
    return false;
  }
  
  try {
    // Capacitor plugin
    if (typeof (window as any).Capacitor !== 'undefined') {
      const plugins = (window as any).Capacitor?.Plugins;
      
      if (plugins?.USBHost) {
        const result = await plugins.USBHost.write({ data });
        return result.success;
      }
      
      if (plugins?.OMA880USB) {
        const result = await plugins.OMA880USB.sendData({ data });
        return result.sent;
      }
    }
    
    // Native Android bridge
    if (typeof (window as any).AndroidUSBHost !== 'undefined') {
      return await (window as any).AndroidUSBHost.write(data);
    }
    
    // OM-A880 Bridge
    if (typeof (window as any).OMA880Bridge !== 'undefined') {
      return await (window as any).OMA880Bridge.sendUSBData(data);
    }
  } catch (error) {
    console.error('[USBHost] Send error:', error);
  }
  
  return false;
};

/**
 * Start keep-alive timer
 */
const startKeepAlive = () => {
  stopKeepAlive();
  
  keepAliveInterval = setInterval(async () => {
    if (connectionState === 'connected' || connectionState === 'ready') {
      const isAlive = await checkConnection();
      if (!isAlive) {
        handleConnectionLost();
      }
    }
  }, KEEP_ALIVE_INTERVAL);
};

/**
 * Stop keep-alive timer
 */
const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
};

/**
 * Check if connection is still alive
 */
const checkConnection = async (): Promise<boolean> => {
  try {
    // Capacitor plugin
    if (typeof (window as any).Capacitor !== 'undefined') {
      const plugins = (window as any).Capacitor?.Plugins;
      
      if (plugins?.USBHost) {
        const result = await plugins.USBHost.isConnected();
        return result.connected;
      }
      
      if (plugins?.OMA880USB) {
        const result = await plugins.OMA880USB.checkConnection();
        return result.connected;
      }
    }
    
    // Native Android bridge
    if (typeof (window as any).AndroidUSBHost !== 'undefined') {
      return await (window as any).AndroidUSBHost.isConnected();
    }
    
    // OM-A880 Bridge
    if (typeof (window as any).OMA880Bridge !== 'undefined') {
      return await (window as any).OMA880Bridge.isUSBConnected();
    }
  } catch (error) {
    console.error('[USBHost] Connection check error:', error);
  }
  
  return false;
};

/**
 * Handle connection lost
 */
const handleConnectionLost = () => {
  console.log('[USBHost] Connection lost');
  notifyEvent({ type: 'connection_lost', device: connectedDevice || undefined, timestamp: Date.now() });
  
  // Attempt reconnection
  if (connectedDevice && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`[USBHost] Attempting reconnection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    connectToDevice(connectedDevice);
  } else {
    connectedDevice = null;
    setConnectionState('disconnected');
  }
};

/**
 * Disconnect from USB device
 */
export const disconnect = async (): Promise<void> => {
  console.log('[USBHost] Disconnecting...');
  stopKeepAlive();
  
  try {
    // Capacitor plugin
    if (typeof (window as any).Capacitor !== 'undefined') {
      const plugins = (window as any).Capacitor?.Plugins;
      
      if (plugins?.USBHost) {
        await plugins.USBHost.closeDevice();
      }
      
      if (plugins?.OMA880USB) {
        await plugins.OMA880USB.disconnect();
      }
    }
    
    // Native Android bridge
    if (typeof (window as any).AndroidUSBHost !== 'undefined') {
      await (window as any).AndroidUSBHost.closeConnection();
    }
    
    // OM-A880 Bridge
    if (typeof (window as any).OMA880Bridge !== 'undefined') {
      await (window as any).OMA880Bridge.disconnectUSB();
    }
  } catch (error) {
    console.error('[USBHost] Disconnect error:', error);
  }
  
  connectedDevice = null;
  setConnectionState('disconnected');
};

/**
 * Set connection state and notify listeners
 */
const setConnectionState = (state: USBConnectionState, device?: USBDeviceInfo) => {
  connectionState = state;
  stateListeners.forEach(listener => listener(state, device));
};

/**
 * Notify event listeners
 */
const notifyEvent = (event: USBEvent) => {
  eventListeners.forEach(listener => listener(event));
};

/**
 * Get current connection state
 */
export const getConnectionState = (): USBConnectionState => connectionState;

/**
 * Get connected device info
 */
export const getConnectedDevice = (): USBDeviceInfo | null => connectedDevice;

/**
 * Subscribe to connection state changes
 */
export const onConnectionStateChange = (callback: USBStateCallback): (() => void) => {
  stateListeners.push(callback);
  return () => {
    stateListeners = stateListeners.filter(cb => cb !== callback);
  };
};

/**
 * Subscribe to USB events
 */
export const onUSBEvent = (callback: USBEventCallback): (() => void) => {
  eventListeners.push(callback);
  return () => {
    eventListeners = eventListeners.filter(cb => cb !== callback);
  };
};

/**
 * Subscribe to data received
 */
export const onDataReceived = (callback: USBDataCallback): (() => void) => {
  dataListeners.push(callback);
  return () => {
    dataListeners = dataListeners.filter(cb => cb !== callback);
  };
};

/**
 * Keep screen awake (for mobile trial devices)
 */
export const setKeepScreenAwake = async (awake: boolean): Promise<void> => {
  try {
    if (typeof (window as any).Capacitor !== 'undefined') {
      const plugins = (window as any).Capacitor?.Plugins;
      if (plugins?.KeepAwake) {
        if (awake) {
          await plugins.KeepAwake.keepAwake();
        } else {
          await plugins.KeepAwake.allowSleep();
        }
      }
    }
    
    if (typeof (window as any).AndroidUSBHost !== 'undefined') {
      await (window as any).AndroidUSBHost.setKeepScreenOn(awake);
    }
  } catch (error) {
    console.error('[USBHost] Keep screen awake error:', error);
  }
};
