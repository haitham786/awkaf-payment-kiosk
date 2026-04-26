/**
 * Web implementation of Thawani Lamsa Plugin
 * 
 * This provides a fallback/simulation mode when running in the browser
 * or on non-Android platforms.
 */

import type { 
  ThawaniLamsaPluginInterface, 
  ThawaniInitOptions, 
  ThawaniPaymentOptions, 
  ThawaniPaymentResult,
  NFCStatus 
} from './thawaniLamsaPlugin';

export class ThawaniLamsaPluginWeb implements ThawaniLamsaPluginInterface {
  private isInitialized = false;
  private config: ThawaniInitOptions | null = null;
  
  async isAvailable(): Promise<{ available: boolean }> {
    console.log('[ThawaniLamsa-Web] isAvailable called - returning false (web simulation)');
    return { available: false };
  }
  
  async initialize(options: ThawaniInitOptions) {
    console.log('[ThawaniLamsa-Web] initialize called with options:', {
      tajerToken: options.tajerToken ? '***REDACTED***' : 'empty',
      isProduction: options.isProduction,
    });
    
    if (!options.tajerToken) {
      return { success: false, message: 'Tajer Token is required', sdkAvailable: false, bridgeRegistered: false };
    }
    
    this.isInitialized = true;
    this.config = options;
    
    return { 
      success: true, 
      message: 'Web simulation mode initialized - actual payments require native Android app',
      sdkAvailable: false,
      bridgeRegistered: false,
    };
  }
  
  async checkNFCStatus(): Promise<NFCStatus> {
    console.log('[ThawaniLamsa-Web] checkNFCStatus called - returning simulated status');
    
    // Check if Web NFC API is available (very limited browser support)
    if ('NDEFReader' in window) {
      return {
        isAvailable: true,
        isEnabled: true,
        errorMessage: 'Web NFC available but Thawani SDK requires native Android',
      };
    }
    
    return {
      isAvailable: true, // Simulated as available for testing
      isEnabled: true,
      errorMessage: 'Simulated NFC - actual payments require native Android app',
    };
  }
  
  async startPayment(options: ThawaniPaymentOptions): Promise<ThawaniPaymentResult> {
    console.log('[ThawaniLamsa-Web] startPayment called:', options);
    
    if (!this.isInitialized) {
      return {
        success: false,
        transactionId: options.transactionId,
        errorCode: 'NOT_INITIALIZED',
        errorMessage: 'SDK not initialized',
        timestamp: new Date().toISOString(),
      };
    }
    
    // Simulate processing delay
    console.log('[ThawaniLamsa-Web] Simulating payment processing...');
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // 90% success rate for simulation
    const isSuccess = Math.random() > 0.1;
    
    if (isSuccess) {
      const result: ThawaniPaymentResult = {
        success: true,
        transactionId: options.transactionId,
        thawaniReference: `THSIM${Date.now()}`,
        approvalCode: `SIM${Math.floor(100000 + Math.random() * 900000)}`,
        cardType: 'Visa',
        cardLastFour: '4242',
        responseCode: '00',
        responseMessage: 'APPROVED (Simulated)',
        timestamp: new Date().toISOString(),
      };
      console.log('[ThawaniLamsa-Web] Simulated payment SUCCESS:', result);
      return result;
    } else {
      const result: ThawaniPaymentResult = {
        success: false,
        transactionId: options.transactionId,
        errorCode: '51',
        errorMessage: 'Insufficient Funds (Simulated)',
        responseCode: '51',
        responseMessage: 'DECLINED (Simulated)',
        timestamp: new Date().toISOString(),
      };
      console.log('[ThawaniLamsa-Web] Simulated payment DECLINED:', result);
      return result;
    }
  }
  
  async cancelPayment(): Promise<{ success: boolean }> {
    console.log('[ThawaniLamsa-Web] cancelPayment called');
    return { success: true };
  }
  
  async getStatus(): Promise<{ isInitialized: boolean; isReady: boolean }> {
    return {
      isInitialized: this.isInitialized,
      isReady: this.isInitialized && !!this.config?.tajerToken,
    };
  }
}
