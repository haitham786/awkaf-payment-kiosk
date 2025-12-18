/**
 * POS Diagnostics Page
 * 
 * Use this page to test and diagnose POS connection issues with the OM-A880
 * Access via: /kiosk/diagnostics
 * 
 * Supports:
 * - Web Serial API (Chrome/PWA - no native plugins required!)
 * - Native USB (requires Capacitor plugin)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  Usb,
  Unplug,
  Terminal,
  Wifi,
  Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  isWebSerialSupported, 
  autoConnectToPOS, 
  disconnect as webSerialDisconnect,
  getConnectionStatus,
  getPortInfo,
  sendCommand,
  onConnectionChange,
} from '@/services/webSerialService';
import { buildTerminalInfoRequest } from '@/services/ethernetEcrService';
import { parseXMLResponse } from '@/services/ecrProtocol';

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
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<string>('none');
  const [lastData, setLastData] = useState<string | null>(null);
  const [portInfo, setPortInfo] = useState<any>(null);

  // Check connection status on mount
  useEffect(() => {
    setIsConnected(getConnectionStatus());
    const info = getPortInfo();
    if (info) setPortInfo(info);

    // Subscribe to connection changes
    const unsubscribe = onConnectionChange((connected) => {
      setIsConnected(connected);
      if (!connected) {
        setPortInfo(null);
        setConnectionMethod('none');
      }
    });

    return () => unsubscribe();
  }, []);

  const addResult = (result: Omit<DiagnosticResult, 'timestamp'>) => {
    setResults(prev => [...prev, { ...result, timestamp: new Date() }]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    
    try {
      // Test 1: Check environment
      addResult({
        test: 'Environment Check',
        status: 'info',
        message: `Running in: ${typeof (window as any).Capacitor !== 'undefined' ? 'Capacitor Native App' : 'Web Browser'}`,
      });

      // Test 2: Check Web Serial support
      const webSerialSupport = isWebSerialSupported();
      addResult({
        test: 'Web Serial API',
        status: webSerialSupport.supported ? 'pass' : 'warning',
        message: webSerialSupport.supported 
          ? 'Web Serial API is available! You can connect to POS via USB from Chrome.'
          : webSerialSupport.reason || 'Web Serial not available',
        details: webSerialSupport,
      });

      // Test 3: Try to connect if Web Serial is available
      if (webSerialSupport.supported) {
        addResult({
          test: 'POS Connection',
          status: 'info',
          message: 'Attempting to connect to POS via Web Serial... (Select your device in the popup)',
        });

        const connectResult = await autoConnectToPOS();
        
        if (connectResult.connected) {
          setIsConnected(true);
          setConnectionMethod('webserial');
          const info = getPortInfo();
          setPortInfo(info);
          
          addResult({
            test: 'POS Connection',
            status: 'pass',
            message: 'Successfully connected to POS device!',
            details: info,
          });

          // Test 4: Send terminal info request
          addResult({
            test: 'Terminal Communication',
            status: 'info',
            message: 'Sending terminal info request...',
          });

          try {
            const infoRequest = buildTerminalInfoRequest();
            const response = await sendCommand(infoRequest, 10000);
            
            if (response) {
              setLastData(response);
              const parsed = parseXMLResponse(response);
              
              addResult({
                test: 'Terminal Communication',
                status: 'pass',
                message: 'Received response from POS terminal!',
                details: parsed,
              });
            } else {
              addResult({
                test: 'Terminal Communication',
                status: 'warning',
                message: 'No response from terminal (may need to wake up the POS)',
              });
            }
          } catch (err: any) {
            addResult({
              test: 'Terminal Communication',
              status: 'warning',
              message: `Communication test: ${err.message}`,
            });
          }
        } else {
          addResult({
            test: 'POS Connection',
            status: 'fail',
            message: connectResult.error || 'Failed to connect to POS',
          });
        }
      }

      // Check for native bridges
      const hasOMA880Bridge = typeof (window as any).OMA880Bridge !== 'undefined';
      const hasAndroidUSB = typeof (window as any).AndroidUSB !== 'undefined';
      
      addResult({
        test: 'Native Bridges',
        status: hasOMA880Bridge || hasAndroidUSB ? 'pass' : 'info',
        message: hasOMA880Bridge 
          ? 'OMA880Bridge detected (native)' 
          : hasAndroidUSB 
            ? 'AndroidUSB bridge detected (native)'
            : 'No native bridges (normal for Chrome/PWA)',
        details: { hasOMA880Bridge, hasAndroidUSB },
      });

    } catch (error: any) {
      addResult({
        test: 'Diagnostics Error',
        status: 'fail',
        message: error.message || 'Unknown error during diagnostics',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const disconnectPOS = async () => {
    await webSerialDisconnect();
    setIsConnected(false);
    setPortInfo(null);
    setConnectionMethod('none');
    addResult({
      test: 'Disconnect',
      status: 'info',
      message: 'Disconnected from POS',
      timestamp: new Date(),
    } as DiagnosticResult);
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
              POS Diagnostics
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Test and diagnose connection with the OM-A880 POS terminal.
              <br />
              <strong className="text-foreground">Web Serial</strong> works directly in Chrome - no app installation needed!
            </p>
            
            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Method</div>
                  <div className="flex items-center gap-1">
                    {connectionMethod === 'webserial' ? (
                      <>
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Web Serial</span>
                      </>
                    ) : connectionMethod === 'native' ? (
                      <>
                        <Usb className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Native USB</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Connection</div>
                  <div className="flex items-center gap-1">
                    {isConnected ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-500" />
                        <span className="text-green-500">Connected</span>
                      </>
                    ) : (
                      <>
                        <Unplug className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Disconnected</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
              {portInfo && (
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Device</div>
                    <div className="font-mono text-xs">
                      {portInfo.usbVendorId 
                        ? `VID:0x${portInfo.usbVendorId.toString(16).toUpperCase()}` 
                        : 'Unknown'}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={runDiagnostics} 
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Running...' : 'Connect & Test POS'}
              </Button>
              {isConnected && (
                <Button variant="outline" onClick={disconnectPOS}>
                  <Unplug className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              )}
              {results.length > 0 && (
                <Button variant="ghost" onClick={clearResults}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Diagnostic Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {results.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>Click "Connect & Test POS" to start</p>
                  <p className="text-xs mt-2">
                    A device picker will appear - select your POS terminal
                  </p>
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
                            <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(result.details, null, 2)}
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

        {/* Last Data Received */}
        {lastData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Last Response from POS</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                {lastData}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How Web Serial Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="bg-green-500">✓</Badge>
              <p className="text-muted-foreground">
                <strong className="text-foreground">No app installation needed</strong> - Works directly in Chrome browser on Android
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-green-500">✓</Badge>
              <p className="text-muted-foreground">
                <strong className="text-foreground">No Android Studio required</strong> - Just connect your POS via USB OTG adapter
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-green-500">✓</Badge>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Works with PWA</strong> - Install this site to home screen for app-like experience
              </p>
            </div>
            
            <div className="border-t pt-3 mt-3">
              <p className="text-muted-foreground text-xs">
                <strong>Requirements:</strong> Chrome 89+ on Android, USB OTG adapter, HTTPS connection
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default POSDiagnosticsPage;
