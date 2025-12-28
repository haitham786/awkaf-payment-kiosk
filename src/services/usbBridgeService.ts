/**
 * USB Bridge Service for OM-A880 POS
 * 
 * Uses capacitor-usb-serial plugin for direct USB serial communication.
 * Vendor ID: 0x05C6, Product ID: 0x903B (OM-A880 POS)
 */

import { getDeviceHandlers } from 'capacitor-usb-serial';

class UsbBridgeService {
  private posDevice: any = null;

  async connect(): Promise<void> {
    try {
      const devices = await getDeviceHandlers();
      const pos = devices.find(d => d.device.vendorId === 0x05C6 && d.device.productId === 0x903B);

      if (!pos) {
        throw new Error('OM-A880 POS device not found. Ensure it is connected via USB.');
      }

      this.posDevice = pos;

      await this.posDevice.connect({
        baudRate: 2400,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      console.log('Connected to OM-A880 POS');
    } catch (error) {
      console.error('Failed to connect to POS:', error);
      throw error;
    }
  }

  async sendCommand(command: string): Promise<string> {
    if (!this.posDevice) {
      throw new Error('POS not connected. Call connect() first.');
    }

    try {
      await this.posDevice.write(command);
      const response = await this.posDevice.read();
      return response.data;
    } catch (error) {
      console.error('Failed to send command to POS:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.posDevice) {
      try {
        await this.posDevice.disconnect();
        this.posDevice = null;
        console.log('Disconnected from POS');
      } catch (error) {
        console.error('Failed to disconnect from POS:', error);
      }
    }
  }

  isConnected(): boolean {
    return this.posDevice !== null;
  }
}

export default new UsbBridgeService();
