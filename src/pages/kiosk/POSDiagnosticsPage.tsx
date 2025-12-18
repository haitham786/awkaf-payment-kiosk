/**
 * POS Diagnostics Page
 * 
 * Use this page to test and diagnose USB connection issues with the OM-A880 POS
 * Access via: /kiosk/diagnostics
 */

import { usePOSDiagnostics } from '@/hooks/usePOSDiagnostics';
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
  Terminal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const POSDiagnosticsPage = () => {
  const navigate = useNavigate();
  const {
    isRunning,
    results,
    allDevices,
    posDevices,
    isConnected,
    activePlugin,
    lastData,
    runDiagnostics,
    disconnectPOS,
    clearResults,
  } = usePOSDiagnostics();

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
              Test and diagnose USB connection with the OM-A880 POS terminal.
            </p>
            
            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Plugin</div>
                  <div className="font-mono text-sm">{activePlugin}</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Connection</div>
                  <div className="flex items-center gap-1">
                    {isConnected ? (
                      <>
                        <Usb className="h-4 w-4 text-green-500" />
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
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">USB Devices</div>
                  <div className="font-mono text-sm">{allDevices.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">POS Devices</div>
                  <div className="font-mono text-sm">{posDevices.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={runDiagnostics} 
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Running...' : 'Run Diagnostics'}
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

        {/* Detected Devices */}
        {allDevices.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Usb className="h-4 w-4" />
                Detected USB Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allDevices.map((device, index) => (
                  <div 
                    key={index} 
                    className={`p-2 rounded border ${
                      posDevices.includes(device) 
                        ? 'border-green-500/30 bg-green-500/5' 
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">
                        VID: 0x{device.vendorId?.toString(16)?.toUpperCase() || '????'} | 
                        PID: 0x{device.productId?.toString(16)?.toUpperCase() || '????'}
                      </span>
                      {posDevices.includes(device) && (
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          POS
                        </Badge>
                      )}
                    </div>
                    {device.deviceName && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {device.deviceName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Diagnostic Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {results.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Click "Run Diagnostics" to start testing
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
              <CardTitle className="text-base">Last Data Received</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-32">
                {lastData}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Installation Instructions */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p className="text-muted-foreground">
              To enable USB communication with the POS terminal, follow these steps:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                <code className="bg-muted px-1 rounded">npm install capacitor-plugin-usb-serial</code>
              </li>
              <li>
                <code className="bg-muted px-1 rounded">npx cap sync android</code>
              </li>
              <li>
                Rebuild and deploy the Android app
              </li>
              <li>
                Connect the POS via USB cable/adapter
              </li>
              <li>
                Grant USB permission when prompted
              </li>
            </ol>
            <p className="text-muted-foreground text-xs mt-4">
              Note: Samsung A13 supports USB Host mode via OTG adapter.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default POSDiagnosticsPage;
