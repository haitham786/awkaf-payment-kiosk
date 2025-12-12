import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Smartphone, HardDrive, Info } from "lucide-react";

interface POSConfig {
  posType: 'hard_pos' | 'soft_pos';
  hardPos: {
    connectionType: string;
    ipAddress: string;
    port: string;
  };
  softPos: {
    merchantId: string;
    terminalId: string;
    apiKey: string;
    sdkEndpoint: string;
    callbackUrl: string;
    providerName: string;
  };
}

interface POSConfigSectionProps {
  config: POSConfig;
  onChange: (config: POSConfig) => void;
  showTitle?: boolean;
}

const POSConfigSection: React.FC<POSConfigSectionProps> = ({
  config,
  onChange,
  showTitle = true,
}) => {
  const handlePosTypeChange = (type: 'hard_pos' | 'soft_pos') => {
    onChange({ ...config, posType: type });
  };

  const handleHardPosChange = (field: string, value: string) => {
    onChange({
      ...config,
      hardPos: { ...config.hardPos, [field]: value },
    });
  };

  const handleSoftPosChange = (field: string, value: string) => {
    onChange({
      ...config,
      softPos: { ...config.softPos, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      {showTitle && (
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          POS Configuration
        </h3>
      )}

      {/* POS Type Selection */}
      <Card className="p-4 space-y-4">
        <Label className="text-sm font-medium">Payment Terminal Type</Label>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Hard POS Option */}
          <div
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              config.posType === 'hard_pos'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handlePosTypeChange('hard_pos')}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                config.posType === 'hard_pos' ? 'bg-primary text-primary-foreground' : 'bg-gray-100'
              }`}>
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Hard POS</p>
                <p className="text-xs text-muted-foreground">USB/Ethernet Terminal</p>
              </div>
            </div>
          </div>

          {/* Soft POS Option */}
          <div
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              config.posType === 'soft_pos'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handlePosTypeChange('soft_pos')}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                config.posType === 'soft_pos' ? 'bg-primary text-primary-foreground' : 'bg-gray-100'
              }`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Soft POS</p>
                <p className="text-xs text-muted-foreground">NFC Contactless</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Hard POS Configuration */}
      {config.posType === 'hard_pos' && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>Configure USB or Ethernet POS terminal connection</span>
          </div>

          <div>
            <Label>Connection Type</Label>
            <Select
              value={config.hardPos.connectionType}
              onValueChange={(value) => handleHardPosChange('connectionType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usb">USB</SelectItem>
                <SelectItem value="ethernet">Ethernet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.hardPos.connectionType === 'ethernet' && (
            <>
              <div>
                <Label htmlFor="ip">IP Address</Label>
                <Input
                  id="ip"
                  value={config.hardPos.ipAddress}
                  onChange={(e) => handleHardPosChange('ipAddress', e.target.value)}
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  value={config.hardPos.port}
                  onChange={(e) => handleHardPosChange('port', e.target.value)}
                  placeholder="8080"
                />
              </div>
            </>
          )}
        </Card>
      )}

      {/* Soft POS Configuration */}
      {config.posType === 'soft_pos' && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>Configure SoftPOS SDK for NFC contactless payments (e.g., Sunmi Flex 3)</span>
          </div>

          <div>
            <Label htmlFor="providerName">Provider Name</Label>
            <Select
              value={config.softPos.providerName}
              onValueChange={(value) => handleSoftPosChange('providerName', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_muscat">Bank Muscat</SelectItem>
                <SelectItem value="thawani">Thawani</SelectItem>
                <SelectItem value="oman_arab_bank">Oman Arab Bank</SelectItem>
                <SelectItem value="ahli_bank">Ahli Bank</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="merchantId">Merchant ID (MID)</Label>
              <Input
                id="merchantId"
                value={config.softPos.merchantId}
                onChange={(e) => handleSoftPosChange('merchantId', e.target.value)}
                placeholder="Enter Merchant ID"
              />
            </div>
            <div>
              <Label htmlFor="terminalId">Terminal ID (TID)</Label>
              <Input
                id="terminalId"
                value={config.softPos.terminalId}
                onChange={(e) => handleSoftPosChange('terminalId', e.target.value)}
                placeholder="Enter Terminal ID"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="apiKey">API Key / Secret Token</Label>
            <Input
              id="apiKey"
              type="password"
              value={config.softPos.apiKey}
              onChange={(e) => handleSoftPosChange('apiKey', e.target.value)}
              placeholder="Enter API Key"
            />
          </div>

          <div>
            <Label htmlFor="sdkEndpoint">SDK Endpoint URL</Label>
            <Input
              id="sdkEndpoint"
              value={config.softPos.sdkEndpoint}
              onChange={(e) => handleSoftPosChange('sdkEndpoint', e.target.value)}
              placeholder="https://api.provider.com/v1"
            />
          </div>

          <div>
            <Label htmlFor="callbackUrl">Callback URL</Label>
            <Input
              id="callbackUrl"
              value={config.softPos.callbackUrl}
              onChange={(e) => handleSoftPosChange('callbackUrl', e.target.value)}
              placeholder="https://your-domain.com/callback"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> The SoftPOS SDK handles all card data securely. 
              This app only receives transaction results and does not process or store card numbers.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default POSConfigSection;
