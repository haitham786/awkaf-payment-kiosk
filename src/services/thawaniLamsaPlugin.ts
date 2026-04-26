/**
 * Thawani Lamsa SDK Plugin for Capacitor
 * 
 * This plugin bridges the React/TypeScript app with the native Android Thawani Lamsa SDK.
 * It handles initialization, NFC payment processing, and result callbacks.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// Type definitions for the plugin
export interface ThawaniInitOptions {
  tajerToken: string;
  isProduction: boolean;
}

export interface ThawaniPaymentOptions {
  amount: number; // Amount in OMR (e.g., 1.5 for 1.5 OMR)
  transactionId: string; // Internal reference for tracking
  remarks?: string; // Optional remarks/notes
}

export interface ThawaniPaymentResult {
  success: boolean;
  transactionId: string; // Internal reference passed in
  thawaniReference?: string; // Thawani's transaction reference
  approvalCode?: string;
  cardType?: string;
  cardLastFour?: string;
  responseCode?: string;
  responseMessage?: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface NFCStatus {
  isAvailable: boolean;
  isEnabled: boolean;
  errorMessage?: string;
}

export interface ThawaniInitResult {
  success: boolean;
  message: string;
  sdkAvailable?: boolean;
  bridgeRegistered?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface ThawaniLamsaPluginInterface {
  /**
   * Check if the plugin is available on this platform
   */
  isAvailable(): Promise<{ available: boolean; error?: string }>;
  
  /**
   * Initialize the Thawani Lamsa SDK with credentials
   */
  initialize(options: ThawaniInitOptions): Promise<ThawaniInitResult>;
  
  /**
   * Check NFC availability and status
   */
  checkNFCStatus(): Promise<NFCStatus>;
  
  /**
   * Start a payment transaction
   * This launches the native Thawani payment activity
   */
  startPayment(options: ThawaniPaymentOptions): Promise<ThawaniPaymentResult>;
  
  /**
   * Cancel any pending payment
   */
  cancelPayment(): Promise<{ success: boolean }>;
  
  /**
   * Get current SDK status
   */
  getStatus(): Promise<{ isInitialized: boolean; isReady: boolean }>;
}

// Register the plugin with Capacitor
const ThawaniLamsaPlugin = registerPlugin<ThawaniLamsaPluginInterface>('ThawaniLamsa', {
  web: () => import('./thawaniLamsaPluginWeb').then(m => new m.ThawaniLamsaPluginWeb()),
});

export default ThawaniLamsaPlugin;

/**
 * Helper class for Thawani Lamsa integration
 */
export class ThawaniLamsaService {
  private isInitialized = false;
  private currentConfig: ThawaniInitOptions | null = null;
  private lastInitResult: ThawaniInitResult | null = null;

  /**
   * Check if we're running on a native platform with the plugin
   */
  isNativeAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Detailed result of the last initialize() call. Useful so the UI can tell
   * apart "plugin missing", "SDK class not loadable", and "ok".
   */
  getLastInitResult(): ThawaniInitResult | null {
    return this.lastInitResult;
  }

  /**
   * Initialize the SDK
   */
  async initialize(tajerToken: string, isProduction: boolean = false): Promise<boolean> {
    console.log('[ThawaniLamsa] Initializing SDK...', { isProduction });
    this.lastInitResult = null;

    if (!this.isNativeAvailable()) {
      console.log('[ThawaniLamsa] Native platform not available, using simulation mode');
      this.isInitialized = true;
      this.currentConfig = { tajerToken, isProduction };
      this.lastInitResult = {
        success: true,
        message: 'Simulation mode (non-native platform)',
        sdkAvailable: false,
        bridgeRegistered: false,
      };
      return true;
    }

    try {
      const result = await ThawaniLamsaPlugin.initialize({
        tajerToken,
        isProduction,
      });

      console.log('[ThawaniLamsa] SDK initialization result:', result);
      this.isInitialized = !!result.success;
      this.currentConfig = { tajerToken, isProduction };
      this.lastInitResult = result;
      return !!result.success;
    } catch (error: any) {
      // If Capacitor throws "UNIMPLEMENTED" the native plugin is not registered in MainActivity.
      const msg = error?.message || String(error);
      const isUnimplemented = /UNIMPLEMENTED|not implemented|No such plugin/i.test(msg);
      console.error('[ThawaniLamsa] SDK initialization failed:', error);
      this.isInitialized = false;
      this.lastInitResult = {
        success: false,
        message: msg,
        sdkAvailable: false,
        bridgeRegistered: !isUnimplemented,
        errorCode: isUnimplemented ? 'PLUGIN_NOT_REGISTERED' : 'INIT_THREW',
        errorMessage: msg,
      };
      return false;
    }
  }
  
  /**
   * Check NFC status before payment
   */
  async checkNFCReadiness(): Promise<NFCStatus> {
    console.log('[ThawaniLamsa] Checking NFC readiness...');
    
    if (!this.isNativeAvailable()) {
      console.log('[ThawaniLamsa] Simulation mode - NFC assumed available');
      return { isAvailable: true, isEnabled: true };
    }
    
    try {
      const status = await ThawaniLamsaPlugin.checkNFCStatus();
      console.log('[ThawaniLamsa] NFC status:', status);
      return status;
    } catch (error) {
      console.error('[ThawaniLamsa] NFC check failed:', error);
      return { 
        isAvailable: false, 
        isEnabled: false, 
        errorMessage: 'Failed to check NFC status' 
      };
    }
  }
  
  /**
   * Start a payment - launches the native Thawani activity
   */
  async startPayment(
    amountOMR: number,
    transactionId: string,
    remarks?: string
  ): Promise<ThawaniPaymentResult> {
    console.log('[ThawaniLamsa] Starting payment...', { amountOMR, transactionId, remarks });
    
    if (!this.isInitialized) {
      console.error('[ThawaniLamsa] SDK not initialized');
      return {
        success: false,
        transactionId,
        errorCode: 'NOT_INITIALIZED',
        errorMessage: 'Thawani SDK is not initialized',
        timestamp: new Date().toISOString(),
      };
    }
    
    // Check NFC first
    const nfcStatus = await this.checkNFCReadiness();
    if (!nfcStatus.isEnabled) {
      console.error('[ThawaniLamsa] NFC not enabled');
      return {
        success: false,
        transactionId,
        errorCode: 'NFC_DISABLED',
        errorMessage: nfcStatus.errorMessage || 'NFC is not enabled on this device',
        timestamp: new Date().toISOString(),
      };
    }
    
    if (!this.isNativeAvailable()) {
      console.log('[ThawaniLamsa] Simulation mode - simulating payment');
      return this.simulatePayment(amountOMR, transactionId);
    }
    
    try {
      const result = await ThawaniLamsaPlugin.startPayment({
        amount: amountOMR,
        transactionId,
        remarks: remarks || `Donation ${transactionId}`,
      });
      
      console.log('[ThawaniLamsa] Payment result:', result);
      return result;
    } catch (error: any) {
      console.error('[ThawaniLamsa] Payment failed:', error);
      return {
        success: false,
        transactionId,
        errorCode: 'PAYMENT_FAILED',
        errorMessage: error.message || 'Payment processing failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
  
  /**
   * Cancel ongoing payment
   */
  async cancelPayment(): Promise<boolean> {
    console.log('[ThawaniLamsa] Cancelling payment...');
    
    if (!this.isNativeAvailable()) {
      return true;
    }
    
    try {
      const result = await ThawaniLamsaPlugin.cancelPayment();
      return result.success;
    } catch (error) {
      console.error('[ThawaniLamsa] Cancel failed:', error);
      return false;
    }
  }
  
  /**
   * Get SDK status
   */
  getStatus(): { isInitialized: boolean; config: ThawaniInitOptions | null } {
    return {
      isInitialized: this.isInitialized,
      config: this.currentConfig,
    };
  }
  
  /**
   * Simulate payment for development/testing
   */
  private async simulatePayment(
    amountOMR: number,
    transactionId: string
  ): Promise<ThawaniPaymentResult> {
    console.log('[ThawaniLamsa] SIMULATION: Processing payment...');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // 90% success rate in simulation
    const isSuccess = Math.random() > 0.1;
    
    if (isSuccess) {
      return {
        success: true,
        transactionId,
        thawaniReference: `TH${Date.now()}${Math.floor(Math.random() * 1000)}`,
        approvalCode: `APP${Math.floor(100000 + Math.random() * 900000)}`,
        cardType: 'Visa',
        cardLastFour: '4242',
        responseCode: '00',
        responseMessage: 'Approved',
        timestamp: new Date().toISOString(),
      };
    } else {
      return {
        success: false,
        transactionId,
        errorCode: '51',
        errorMessage: 'Insufficient Funds',
        responseCode: '51',
        responseMessage: 'Declined',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
export const thawaniLamsaService = new ThawaniLamsaService();
