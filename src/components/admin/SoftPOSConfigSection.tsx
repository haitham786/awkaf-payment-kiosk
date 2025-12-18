import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Smartphone, Info, Shield, CheckCircle, AlertCircle } from "lucide-react";

interface SoftPOSConfig {
  merchantId: string;
  terminalId: string;
  sdkEndpoint: string;
  callbackUrl: string;
  providerName: string;
}

interface SoftPOSConfigSectionProps {
  config: SoftPOSConfig;
  onChange: (config: SoftPOSConfig) => void;
  showTitle?: boolean;
  compact?: boolean;
  apiKeyConfigured?: boolean;
}

const SoftPOSConfigSection: React.FC<SoftPOSConfigSectionProps> = ({
  config,
  onChange,
  showTitle = true,
  compact = false,
  apiKeyConfigured = false,
}) => {
  const handleChange = (field: string, value: string) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="space-y-4">
      {showTitle && (
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Soft POS Configuration
        </h3>
      )}

      <Card className={`${compact ? 'p-3' : 'p-4'} space-y-4`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="w-4 h-4" />
          <span>Configure SoftPOS SDK for NFC contactless payments (e.g., Sunmi Flex 3)</span>
        </div>

        <div>
          <Label htmlFor="providerName" className={compact ? 'text-sm' : ''}>Provider Name</Label>
          <Select
            value={config.providerName}
            onValueChange={(value) => handleChange('providerName', value)}
          >
            <SelectTrigger className={compact ? 'h-9' : ''}>
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

        <div className={`grid ${compact ? 'grid-cols-2 gap-2' : 'grid-cols-2 gap-4'}`}>
          <div>
            <Label htmlFor="merchantId" className={compact ? 'text-sm' : ''}>Merchant ID (MID)</Label>
            <Input
              id="merchantId"
              value={config.merchantId}
              onChange={(e) => handleChange('merchantId', e.target.value)}
              placeholder="Enter Merchant ID"
              className={compact ? 'h-9' : ''}
            />
          </div>
          <div>
            <Label htmlFor="terminalId" className={compact ? 'text-sm' : ''}>Terminal ID (TID)</Label>
            <Input
              id="terminalId"
              value={config.terminalId}
              onChange={(e) => handleChange('terminalId', e.target.value)}
              placeholder="Enter Terminal ID"
              className={compact ? 'h-9' : ''}
            />
          </div>
        </div>

        {/* Secure API Key Status */}
        <div className={`p-3 rounded-lg border ${apiKeyConfigured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 ${apiKeyConfigured ? 'text-green-600' : 'text-amber-600'}`} />
            <span className={`text-sm font-medium ${apiKeyConfigured ? 'text-green-700' : 'text-amber-700'}`}>
              API Key / Secret Token
            </span>
            {apiKeyConfigured ? (
              <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 ml-auto" />
            )}
          </div>
          <p className={`text-xs mt-1 ${apiKeyConfigured ? 'text-green-600' : 'text-amber-600'}`}>
            {apiKeyConfigured 
              ? 'API key is securely stored in environment secrets.' 
              : 'API key not configured. Contact your administrator to add the SOFT_POS_API_KEY secret.'}
          </p>
        </div>

        <div>
          <Label htmlFor="sdkEndpoint" className={compact ? 'text-sm' : ''}>SDK Endpoint URL</Label>
          <Input
            id="sdkEndpoint"
            value={config.sdkEndpoint}
            onChange={(e) => handleChange('sdkEndpoint', e.target.value)}
            placeholder="https://api.provider.com/v1"
            className={compact ? 'h-9' : ''}
          />
        </div>

        <div>
          <Label htmlFor="callbackUrl" className={compact ? 'text-sm' : ''}>Callback URL</Label>
          <Input
            id="callbackUrl"
            value={config.callbackUrl}
            onChange={(e) => handleChange('callbackUrl', e.target.value)}
            placeholder="https://your-domain.com/callback"
            className={compact ? 'h-9' : ''}
          />
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-blue-700`}>
            <strong>Note:</strong> The SoftPOS SDK handles all card data securely. 
            This app only receives transaction results and does not process or store card numbers.
            API keys are stored securely and never exposed to the client.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SoftPOSConfigSection;
