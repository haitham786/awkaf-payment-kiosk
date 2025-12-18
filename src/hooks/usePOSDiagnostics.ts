/**
 * POS Diagnostics Hook
 * 
 * Use this hook to diagnose USB connection issues with the OM-A880 POS
 */

import { useState, useCallback, useEffect } from 'react';
import {
  initializeUSBSerial,
  listUSBDevices,
  isUSBSerialAvailable,
  getActivePlugin,
  findAndConnectPOS,
  isUSBConnected,
  closeUSBConnection,
  onDataReceived,
  onConnectionChange,
  filterPOSDevices,
} from '@/services/usbSerialPlugin';
import { USBDeviceInfo, DEFAULT_POS_IDENTIFIERS } from '@/services/usbHostService';

export interface DiagnosticResult {
  timestamp: Date;
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  message: string;
  details?: any;
}

export interface POSDiagnosticsState {
  isRunning: boolean;
  results: DiagnosticResult[];
  allDevices: USBDeviceInfo[];
  posDevices: USBDeviceInfo[];
  isConnected: boolean;
  activePlugin: string;
  lastData: string | null;
}

export const usePOSDiagnostics = () => {
  const [state, setState] = useState<POSDiagnosticsState>({
    isRunning: false,
    results: [],
    allDevices: [],
    posDevices: [],
    isConnected: false,
    activePlugin: 'none',
    lastData: null,
  });

  // Listen for data and connection changes
  useEffect(() => {
    const unsubData = onDataReceived((data) => {
      setState(prev => ({
        ...prev,
        lastData: data,
        results: [...prev.results, {
          timestamp: new Date(),
          test: 'Data Received',
          status: 'info',
          message: `Received ${data.length} bytes from POS`,
          details: data.substring(0, 200),
        }],
      }));
    });

    const unsubConnection = onConnectionChange((connected) => {
      setState(prev => ({
        ...prev,
        isConnected: connected,
        results: [...prev.results, {
          timestamp: new Date(),
          test: 'Connection Change',
          status: connected ? 'pass' : 'warning',
          message: connected ? 'USB connection established' : 'USB disconnected',
        }],
      }));
    });

    return () => {
      unsubData();
      unsubConnection();
    };
  }, []);

  const addResult = useCallback((result: Omit<DiagnosticResult, 'timestamp'>) => {
    setState(prev => ({
      ...prev,
      results: [...prev.results, { ...result, timestamp: new Date() }],
    }));
  }, []);

  const runDiagnostics = useCallback(async () => {
    setState(prev => ({ ...prev, isRunning: true, results: [] }));

    // Test 1: Check environment
    addResult({
      test: 'Environment Check',
      status: 'info',
      message: `Running on: ${typeof (window as any).Capacitor !== 'undefined' ? 'Capacitor' : 'Web'}`,
      details: {
        capacitor: typeof (window as any).Capacitor !== 'undefined',
        platform: (window as any).Capacitor?.getPlatform?.() || 'web',
        isNative: (window as any).Capacitor?.isNativePlatform?.() || false,
      },
    });

    // Test 2: Check for USB plugin
    addResult({
      test: 'USB Plugin Detection',
      status: 'info',
      message: 'Checking for available USB plugins...',
    });

    const pluginAvailable = await initializeUSBSerial();
    const activePlugin = getActivePlugin();

    setState(prev => ({ ...prev, activePlugin }));

    if (!pluginAvailable) {
      addResult({
        test: 'USB Plugin',
        status: 'fail',
        message: 'No USB Serial plugin found',
        details: {
          suggestion: 'Install: npm install capacitor-plugin-usb-serial',
          steps: [
            '1. npm install capacitor-plugin-usb-serial',
            '2. npx cap sync android',
            '3. Rebuild the Android app',
          ],
        },
      });
    } else {
      addResult({
        test: 'USB Plugin',
        status: 'pass',
        message: `USB plugin active: ${activePlugin}`,
      });
    }

    // Test 3: List USB devices
    addResult({
      test: 'Device Scan',
      status: 'info',
      message: 'Scanning for USB devices...',
    });

    const devices = await listUSBDevices();
    const posDevices = filterPOSDevices(devices);

    setState(prev => ({
      ...prev,
      allDevices: devices,
      posDevices,
    }));

    if (devices.length === 0) {
      addResult({
        test: 'Device Scan',
        status: 'warning',
        message: 'No USB devices detected',
        details: {
          troubleshooting: [
            'Ensure POS is powered on',
            'Check USB cable connection',
            'Try a different USB cable',
            'Check USB OTG adapter if using one',
            'Verify phone supports USB Host mode',
          ],
        },
      });
    } else {
      addResult({
        test: 'Device Scan',
        status: 'pass',
        message: `Found ${devices.length} USB device(s)`,
        details: devices.map(d => ({
          vendorId: `0x${d.vendorId?.toString(16)?.toUpperCase() || '????'}`,
          productId: `0x${d.productId?.toString(16)?.toUpperCase() || '????'}`,
          name: d.deviceName || 'Unknown',
          manufacturer: d.manufacturerName || 'Unknown',
        })),
      });

      if (posDevices.length > 0) {
        addResult({
          test: 'POS Detection',
          status: 'pass',
          message: `Found ${posDevices.length} potential POS device(s)`,
          details: posDevices,
        });
      } else {
        addResult({
          test: 'POS Detection',
          status: 'warning',
          message: 'No known POS device found. Found devices may still work.',
          details: {
            knownVendorIds: DEFAULT_POS_IDENTIFIERS.slice(0, 5).map(d => 
              `0x${d.vendorId.toString(16).toUpperCase()}`
            ),
            foundVendorIds: devices.map(d => 
              `0x${d.vendorId?.toString(16)?.toUpperCase() || '????'}`
            ),
          },
        });
      }
    }

    // Test 4: Attempt connection
    if (devices.length > 0) {
      addResult({
        test: 'Connection Test',
        status: 'info',
        message: 'Attempting to connect to POS...',
      });

      const result = await findAndConnectPOS();
      
      if (result.success) {
        setState(prev => ({ ...prev, isConnected: true }));
        addResult({
          test: 'Connection Test',
          status: 'pass',
          message: 'Successfully connected to POS!',
          details: result.device,
        });

        // Check if still connected
        const stillConnected = await isUSBConnected();
        addResult({
          test: 'Connection Verify',
          status: stillConnected ? 'pass' : 'warning',
          message: stillConnected ? 'Connection verified' : 'Connection state uncertain',
        });
      } else {
        addResult({
          test: 'Connection Test',
          status: 'fail',
          message: result.error || 'Failed to connect',
          details: {
            troubleshooting: [
              'Grant USB permission when prompted',
              'Try disconnecting and reconnecting USB',
              'Restart the POS terminal',
              'Check if another app is using USB',
            ],
          },
        });
      }
    }

    // Complete
    addResult({
      test: 'Diagnostics Complete',
      status: 'info',
      message: 'Diagnostic tests completed',
    });

    setState(prev => ({ ...prev, isRunning: false }));
  }, [addResult]);

  const disconnectPOS = useCallback(async () => {
    await closeUSBConnection();
    setState(prev => ({ ...prev, isConnected: false }));
    addResult({
      test: 'Disconnect',
      status: 'info',
      message: 'Disconnected from POS',
    });
  }, [addResult]);

  const clearResults = useCallback(() => {
    setState(prev => ({ ...prev, results: [] }));
  }, []);

  return {
    ...state,
    runDiagnostics,
    disconnectPOS,
    clearResults,
  };
};
