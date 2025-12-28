/**
 * USB Bridge Service for OM-A880 POS
 * 
 * Uses capacitor-usb-serial plugin for direct USB serial communication.
 * Vendor ID: 0x05C6 (1478), Product ID: 0x903B (36923) for OM-A880 POS
 * 
 * Based on: https://www.npmjs.com/package/capacitor-usb-serial
 */

import { getDeviceHandlers, UsbSerial, DeviceInfo, ConnectionParams } from 'capacitor-usb-serial';

// OM-A880 POS identifiers
const POS_VENDOR_ID = 0x05C6;  // 1478 in decimal
const POS_PRODUCT_ID = 0x903B; // 36923 in decimal

// Serial port configuration for OM-A880
const SERIAL_CONFIG: ConnectionParams = {
  baudRate: 2400,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
};

// Extended DeviceHandler type with optional connect params
interface ExtendedDeviceHandler {
  device: DeviceInfo;
  connect: (options?: ConnectionParams) => Promise<void>;
  disconnect: () => Promise<void>;
  write: (message: string) => Promise<{ data: string; bytesRead: number }>;
  read: () => Promise<{ data: string; bytesRead: number }>;
}

class UsbBridgeService {
  private portKey: string | null = null;
  private deviceId: number | null = null;
  private connected: boolean = false;

  async connect(): Promise<void> {
    try {
      console.log('[UsbBridge] Getting device handlers...');
      const devices = await getDeviceHandlers() as ExtendedDeviceHandler[];
      
      console.log('[UsbBridge] Found devices:', devices.length);
      
      // Log all devices for debugging
      for (const device of devices) {
        console.log('[UsbBridge] Device:', JSON.stringify(device.device));
      }
      
      // Find OM-A880 POS device
      let targetDevice = devices.find(d => 
        d.device.vendorId === POS_VENDOR_ID && 
        d.device.productId === POS_PRODUCT_ID
      );

      if (!targetDevice) {
        // Try to find any device if specific POS not found
        if (devices.length > 0) {
          console.log('[UsbBridge] OM-A880 not found by ID, using first available device');
          targetDevice = devices[0];
        } else {
          throw new Error('OM-A880 POS device not found. Ensure it is connected via USB OTG cable.');
        }
      }

      this.deviceId = targetDevice.device.deviceId;
      
      console.log('[UsbBridge] Connecting to device with config:', SERIAL_CONFIG);
      
      // Use openConnection directly to pass serial config
      const result = await UsbSerial.openConnection({
        deviceId: this.deviceId,
        ...SERIAL_CONFIG,
      });
      
      this.portKey = result.portKey;
      this.connected = true;

      console.log('[UsbBridge] Connected to OM-A880 POS successfully, portKey:', this.portKey);
    } catch (error) {
      console.error('[UsbBridge] Failed to connect to POS:', error);
      this.connected = false;
      throw error;
    }
  }

  async sendCommand(command: string): Promise<string> {
    if (!this.portKey || !this.connected) {
      throw new Error('POS not connected. Call connect() first.');
    }

    try {
      console.log('[UsbBridge] Writing command, length:', command.length);
      
      // Write and get immediate response
      const response = await UsbSerial.write({
        key: this.portKey,
        message: command,
        noRead: false, // Do read immediately after write
      });
      
      console.log('[UsbBridge] Received response, bytes:', response.bytesRead);
      
      // If no data, try reading again after a short delay
      if (!response.data || response.bytesRead === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryResponse = await UsbSerial.read({ key: this.portKey });
        return retryResponse.data || '';
      }
      
      return response.data || '';
    } catch (error) {
      console.error('[UsbBridge] Failed to send command to POS:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.portKey && this.connected) {
      try {
        await UsbSerial.endConnection({ key: this.portKey });
        this.portKey = null;
        this.deviceId = null;
        this.connected = false;
        console.log('[UsbBridge] Disconnected from POS');
      } catch (error) {
        console.error('[UsbBridge] Failed to disconnect from POS:', error);
        this.connected = false;
      }
    }
  }

  isConnected(): boolean {
    return this.connected && this.portKey !== null;
  }
  
  getPortKey(): string | null {
    return this.portKey;
  }
}

export default new UsbBridgeService();
