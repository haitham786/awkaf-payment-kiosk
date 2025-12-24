/**
 * POS Diagnostics Page
 * 
 * Test USB connection with OM-A880 POS
 * Access via: /kiosk/diagnostics
 * 
 * IMPORTANT: USB connection only works in the native APK, not in browser!
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  Usb,
  Unplug,
  Terminal,
  Cable,
  Smartphone,
  Globe,
  Download,
  Send,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildTerminalInfoRequest, buildStatusRequest } from '@/services/ethernetEcrService';
import { parseXMLResponse } from '@/services/ecrProtocol';
import {
  initializeUSBSerial,
  listUSBDevices,
  findAndConnectPOS,
  closeUSBConnection,
  isUSBSerialAvailable,
  getActivePlugin,
  writeUSBData,
  readUSBData,
  onDataReceived,
  onConnectionChange,
  sendCommandAndWaitForResponse,
} from '@/services/usbSerialPlugin';

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  message: string;
  details?: any;
  timestamp: Date;
}

const POSDiagnosticsPage = () => {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [pluginAvailable, setPluginAvailable] = useState(false);

  // Check environment on mount
  useEffect(() => {
    const checkEnvironment = async () => {
      const Capacitor = (window as any).Capacitor;
      const isNative = Capacitor?.isNativePlatform?.() || false;
      setIsNativeApp(isNative);
      
      if (isNative) {
        const available = await initializeUSBSerial();
        setPluginAvailable(available);
      }
    };
    
    checkEnvironment();
    
    // Subscribe to connection changes
    const unsubConn = onConnectionChange((connected) => {
      setIsConnected(connected);
    });
    
    // Subscribe to data
    const unsubData = onDataReceived((data) => {
      setLastData(data);
      addResult({
        test: 'Data Received',
        status: 'info',
        message: `Received ${data.length} bytes from POS`,
        details: data.substring(0, 500),
      });
    });

    return () => {
      unsubConn();
      unsubData();
    };
  }, []);

  const addResult = (result: Omit<DiagnosticResult, 'timestamp'>) => {
    setResults(prev => [...prev, { ...result, timestamp: new Date() }]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    
    try {
      // Test 1: Check environment
      const Capacitor = (window as any).Capacitor;
      const isNative = Capacitor?.isNativePlatform?.() || false;
      const platform = Capacitor?.getPlatform?.() || 'web';
      
      addResult({
        test: 'Environment',
        status: isNative ? 'pass' : 'warning',
        message: isNative 
          ? `Native App (${platform})` 
          : 'Browser Mode - USB not available',
        details: {
          isNative,
          platform,
          userAgent: navigator.userAgent.substring(0, 50),
        }
      });

      if (!isNative) {
        addResult({
          test: 'USB Plugin',
          status: 'fail',
          message: 'USB requires native APK. Please install the APK from GitHub.',
        });
        setIsRunning(false);
        return;
      }

      // Test 2: Check USB Serial plugin
      addResult({
        test: 'USB Plugin',
        status: 'info',
        message: 'Initializing USB Serial plugin...',
      });

      const pluginAvail = await initializeUSBSerial();
      const activePlugin = getActivePlugin();
      
      addResult({
        test: 'USB Plugin',
        status: pluginAvail ? 'pass' : 'fail',
        message: pluginAvail 
          ? `Plugin loaded: ${activePlugin}`
          : 'USB Serial plugin not found',
        details: {
          available: pluginAvail,
          plugin: activePlugin,
          capacitorPlugins: Object.keys(Capacitor?.Plugins || {}),
        }
      });

      if (!pluginAvail) {
        addResult({
          test: 'USB Plugin',
          status: 'fail',
          message: 'capacitor-plugin-usb-serial not found. Rebuild APK required.',
          details: {
            availablePlugins: Object.keys(Capacitor?.Plugins || {}),
            hint: 'Make sure the APK was built with the USB serial plugin installed.',
          }
        });
        setIsRunning(false);
        return;
      }

      // Test 3: Scan for USB devices
      addResult({
        test: 'USB Scan',
        status: 'info',
        message: 'Calling connectedDevices()...',
      });

      const devices = await listUSBDevices();
      
      addResult({
        test: 'USB Scan',
        status: devices.length > 0 ? 'pass' : 'warning',
        message: devices.length > 0 
          ? `Found ${devices.length} USB device(s)`
          : 'No USB devices found. Connect POS via OTG cable.',
        details: devices.map(d => ({
          vendorId: `0x${(d.vendorId || 0).toString(16).toUpperCase().padStart(4, '0')}`,
          productId: `0x${(d.productId || 0).toString(16).toUpperCase().padStart(4, '0')}`,
          deviceId: d.deviceId,
          name: d.deviceName || 'Unknown',
        })),
      });

      if (devices.length === 0) {
        addResult({
          test: 'Troubleshooting',
          status: 'warning',
          message: 'USB device not detected',
          details: {
            steps: [
              '1. Check USB OTG cable is connected properly',
              '2. Ensure POS is powered on',
              '3. Try a different USB cable',
              '4. Check if permission dialog appeared',
              '5. Restart the app after connecting POS',
            ]
          }
        });
        setIsRunning(false);
        return;
      }

      // Test 4: Connect to POS
      addResult({
        test: 'POS Connection',
        status: 'info',
        message: 'Calling openSerial()...',
      });

      const connectResult = await findAndConnectPOS();
      
      if (connectResult.success) {
        setIsConnected(true);
        addResult({
          test: 'POS Connection',
          status: 'pass',
          message: 'Connected to POS successfully!',
          details: connectResult.device,
        });

        // Test 5: Send terminal info request
        addResult({
          test: 'POS Communication',
          status: 'info',
          message: 'Sending GET_TERMINAL_INFO command...',
        });

        try {
          const infoRequest = buildTerminalInfoRequest();
          const sent = await writeUSBData(infoRequest);
          
          if (sent) {
            addResult({
              test: 'POS Communication',
              status: 'pass',
              message: 'Command sent via writeSerial(). Waiting for response...',
              details: { sentBytes: infoRequest.length },
            });

            // Wait a bit for response
            const response = await readUSBData(10000);
            if (response) {
              addResult({
                test: 'POS Response',
                status: 'pass',
                message: 'Received response from POS!',
                details: response.substring(0, 500),
              });

              // Try to parse
              try {
                const parsed = parseXMLResponse(response);
                if (parsed) {
                  addResult({
                    test: 'POS Response Parsed',
                    status: 'pass',
                    message: `Terminal: ${parsed.tid || 'Unknown'}`,
                    details: {
                      tid: parsed.tid,
                      mid: parsed.mid,
                      errorCode: parsed.errorCode,
                    }
                  });
                }
              } catch (parseErr) {
                addResult({
                  test: 'POS Response',
                  status: 'warning',
                  message: 'Response received but parse failed',
                });
              }
            } else {
              addResult({
                test: 'POS Response',
                status: 'warning',
                message: 'No response received within 10 seconds',
                details: {
                  hint: 'POS may need to be in ECR mode. Check POS configuration.',
                }
              });
            }
          } else {
            addResult({
              test: 'POS Communication',
              status: 'warning',
              message: 'writeSerial() returned false',
            });
          }
        } catch (err: any) {
          addResult({
            test: 'POS Communication',
            status: 'warning',
            message: `Error: ${err.message}`,
          });
        }
      } else {
        addResult({
          test: 'POS Connection',
          status: 'fail',
          message: connectResult.error || 'Failed to connect to POS',
          details: {
            hint: 'Check if USB permission was granted when the dialog appeared.',
          }
        });
      }

    } catch (error: any) {
      addResult({
        test: 'Error',
        status: 'fail',
        message: error.message || 'Unknown error',
        details: error.stack?.substring(0, 200),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const sendTestCommand = async () => {
    if (!isConnected) {
      addResult({
        test: 'Send Command',
        status: 'fail',
        message: 'Not connected to POS',
      });
      return;
    }

    setIsSending(true);
    addResult({
      test: 'Send Command',
      status: 'info',
      message: 'Sending GET_STATUS command...',
    });

    try {
      const statusRequest = buildStatusRequest();
      const result = await sendCommandAndWaitForResponse(statusRequest, 15000);
      
      if (result.success && result.response) {
        addResult({
          test: 'Send Command',
          status: 'pass',
          message: 'Command successful!',
          details: result.response.substring(0, 500),
        });
      } else {
        addResult({
          test: 'Send Command',
          status: 'warning',
          message: result.error || 'No response',
        });
      }
    } catch (err: any) {
      addResult({
        test: 'Send Command',
        status: 'fail',
        message: err.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  const disconnectPOS = async () => {
    await closeUSBConnection();
    setIsConnected(false);
    addResult({
      test: 'Disconnect',
      status: 'info',
      message: 'Disconnected from POS',
    });
  };

  const clearResults = () => {
    setResults([]);
    setLastData(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'fail':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              POS USB Diagnostics (OM-A880)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Back
            </Button>
          </CardHeader>
          <CardContent>
            {/* Environment Status */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                {isNativeApp ? (
                  <>
                    <Smartphone className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-500">Native APK</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-yellow-500">Browser (USB disabled)</span>
                  </>
                )}
              </div>
              {isNativeApp && (
                <Badge variant={pluginAvailable ? "default" : "destructive"}>
                  {pluginAvailable ? "USB Plugin Ready" : "Plugin Missing"}
                </Badge>
              )}
              {isConnected && (
                <Badge variant="default" className="bg-green-500">
                  <Cable className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>

            {/* Browser Warning */}
            {!isNativeApp && (
              <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertTitle className="text-yellow-500">Browser Mode</AlertTitle>
                <AlertDescription className="text-sm">
                  USB connection is only available in the native Android APK.
                  <br />
                  <strong>To test USB:</strong> Download and install the APK from GitHub Releases.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={runDiagnostics} 
                disabled={isRunning}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Testing...' : 'Test USB Connection'}
              </Button>
              {isConnected && (
                <>
                  <Button 
                    variant="secondary" 
                    onClick={sendTestCommand}
                    disabled={isSending}
                  >
                    <Send className={`h-4 w-4 mr-2 ${isSending ? 'animate-pulse' : ''}`} />
                    {isSending ? 'Sending...' : 'Send Test Command'}
                  </Button>
                  <Button variant="outline" onClick={disconnectPOS}>
                    <Unplug className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </>
              )}
              {results.length > 0 && (
                <Button variant="ghost" onClick={clearResults}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* APK Download Instructions */}
        {!isNativeApp && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                How to Get the APK
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal list-inside space-y-2">
                <li><strong>Connect Lovable to GitHub</strong> (click GitHub button in editor)</li>
                <li><strong>Wait for build</strong> - APK builds automatically (~5 mins)</li>
                <li><strong>Go to GitHub → Releases</strong> to download APK</li>
                <li><strong>Transfer APK</strong> to Samsung A13 and install</li>
                <li><strong>Connect POS</strong> via USB OTG cable</li>
                <li><strong>Open app</strong> and navigate to /kiosk/diagnostics</li>
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {results.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Usb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Click "Test USB Connection" to start</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
                    >
                      <div className="flex items-start gap-2">
                        {getStatusIcon(result.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{result.test}</span>
                            <span className="text-xs text-muted-foreground">
                              {result.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{result.message}</p>
                          {result.details && (
                            <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                              {typeof result.details === 'string' 
                                ? result.details 
                                : JSON.stringify(result.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Last Response */}
        {lastData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Last POS Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                {lastData}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default POSDiagnosticsPage;