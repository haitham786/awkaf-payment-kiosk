/**
 * POS Diagnostics Page
 * 
 * Use this page to test and diagnose POS connection issues with the OM-A880
 * Access via: /kiosk/diagnostics
 * 
 * RECOMMENDED: USB Bridge App method for Android
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Globe,
  ExternalLink,
  Cable,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildTerminalInfoRequest } from '@/services/ethernetEcrService';
import { parseXMLResponse } from '@/services/ecrProtocol';
import {
  initializeBridge,
  disconnectBridge,
  sendBridgeCommand,
  getBridgeState,
  testBridgeConnection,
  getRecommendedApps,
  onBridgeStateChange,
} from '@/services/usbBridgeService';

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
  
  // Bridge configuration
  const [bridgeHost, setBridgeHost] = useState('127.0.0.1');
  const [bridgePort, setBridgePort] = useState('8888');
  const [showSetup, setShowSetup] = useState(true);

  // Check connection status on mount
  useEffect(() => {
    setIsConnected(getBridgeState() === 'connected');
    
    const unsubscribe = onBridgeStateChange((state) => {
      setIsConnected(state === 'connected');
      if (state !== 'connected') {
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
        test: 'Environment',
        status: 'info',
        message: `Running on: ${/Android/i.test(navigator.userAgent) ? 'Android' : 'Other'} | ${typeof (window as any).Capacitor !== 'undefined' ? 'Native App' : 'Browser'}`,
      });

      // Test 2: Test USB Bridge connection
      addResult({
        test: 'USB Bridge',
        status: 'info',
        message: `Testing connection to ${bridgeHost}:${bridgePort}...`,
      });

      const bridgeResult = await testBridgeConnection();
      
      if (bridgeResult.connected) {
        setIsConnected(true);
        setConnectionMethod('usbbridge');
        
        addResult({
          test: 'USB Bridge',
          status: 'pass',
          message: `Connected via ${bridgeResult.method}!`,
          details: bridgeResult,
        });

        // Test 3: Try to communicate with POS
        addResult({
          test: 'POS Communication',
          status: 'info',
          message: 'Sending terminal info request...',
        });

        try {
          const infoRequest = buildTerminalInfoRequest();
          const response = await sendBridgeCommand(infoRequest, 10000);
          
          if (response) {
            setLastData(response);
            const parsed = parseXMLResponse(response);
            
            addResult({
              test: 'POS Communication',
              status: 'pass',
              message: 'POS responded successfully!',
              details: parsed,
            });
          } else {
            addResult({
              test: 'POS Communication',
              status: 'warning',
              message: 'No response from POS (make sure POS is ready)',
            });
          }
        } catch (err: any) {
          addResult({
            test: 'POS Communication',
            status: 'warning',
            message: `Communication: ${err.message}`,
          });
        }
      } else {
        addResult({
          test: 'USB Bridge',
          status: 'fail',
          message: bridgeResult.error || 'Cannot connect to bridge app',
          details: {
            tip: 'Make sure the USB bridge app is running and TCP server is enabled',
          },
        });
      }

    } catch (error: any) {
      addResult({
        test: 'Error',
        status: 'fail',
        message: error.message || 'Unknown error',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const disconnectPOS = async () => {
    await disconnectBridge();
    setIsConnected(false);
    setConnectionMethod('none');
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

  const recommendedApps = getRecommendedApps();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              POS Diagnostics (USB Bridge)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Back
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Connect to OM-A880 POS using a <strong>USB Bridge App</strong> on your Android device.
            </p>
            
            {/* Bridge Configuration */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <Label className="text-xs">Bridge Host</Label>
                <Input
                  value={bridgeHost}
                  onChange={(e) => setBridgeHost(e.target.value)}
                  placeholder="127.0.0.1"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Bridge Port</Label>
                <Input
                  value={bridgePort}
                  onChange={(e) => setBridgePort(e.target.value)}
                  placeholder="8888"
                  className="h-9"
                />
              </div>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Cable className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-500">Connected</span>
                  </>
                ) : (
                  <>
                    <Unplug className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Disconnected</span>
                  </>
                )}
              </div>
              {connectionMethod !== 'none' && (
                <Badge variant="secondary">{connectionMethod}</Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={runDiagnostics} 
                disabled={isRunning}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Testing...' : 'Test Connection'}
              </Button>
              {isConnected && (
                <Button variant="outline" onClick={disconnectPOS}>
                  <Unplug className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowSetup(!showSetup)}>
                {showSetup ? 'Hide' : 'Show'} Setup Guide
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Setup Guide */}
        {showSetup && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Setup Guide - USB Bridge App
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <p className="mb-3 text-muted-foreground">
                  This method uses a free Android app to bridge USB serial data to TCP, which our kiosk can connect to.
                </p>
                
                {recommendedApps.map((app, idx) => (
                  <div key={idx} className="p-3 bg-background rounded-lg mb-3 border">
                    <div className="flex items-center justify-between mb-2">
                      <strong>{app.name}</strong>
                      <a 
                        href={app.playStoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs flex items-center gap-1 hover:underline"
                      >
                        Play Store <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">by {app.developer}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {app.features.map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-medium mb-1">Setup Steps:</p>
                      <ol className="text-xs text-muted-foreground space-y-1">
                        {app.setup.map((step, i) => (
                          <li key={i}>{i + 1}. {step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Test Results</CardTitle>
              {results.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearResults}>Clear</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {results.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Cable className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Click "Test Connection" to start</p>
                  <p className="text-xs mt-1">Make sure the bridge app is running first</p>
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
                            <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-auto max-h-24">
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

        {/* Last Response */}
        {lastData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Last POS Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-40">
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
