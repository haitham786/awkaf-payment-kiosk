import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, CheckCircle, AlertCircle, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SMSSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [secretsConfigured, setSecretsConfigured] = useState(false);

  useEffect(() => {
    checkAuth();
    checkSecretsStatus();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
  };

  const checkSecretsStatus = async () => {
    try {
      // Check if SMS gateway secrets are configured by calling an edge function
      // For now, we'll just set loading to false - actual check would need an edge function
      setSecretsConfigured(false); // Default to not configured
    } catch (error: any) {
      console.error('Error checking secrets status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSMS = async () => {
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          mobile_number: '96899999999',
          category: 'zakat',
          reference_number: 'TEST123456789',
          amount_baisas: 10000
        }
      });

      if (error) throw error;

      toast({
        title: "Test SMS sent",
        description: data.message || "Check the logs for the SMS preview.",
      });
    } catch (error: any) {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold">SMS Settings</h1>
          </div>
          <ThemeToggle />
        </div>

        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertTitle>Secure Configuration</AlertTitle>
          <AlertDescription>
            SMS gateway credentials are stored securely as environment secrets. 
            Contact your system administrator to configure or update SMS gateway credentials.
          </AlertDescription>
        </Alert>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              {secretsConfigured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">SMS Gateway Configured</p>
                    <p className="text-sm text-muted-foreground">
                      SMS gateway credentials are securely configured
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium">SMS Gateway Not Configured</p>
                    <p className="text-sm text-muted-foreground">
                      Configure the following environment secrets: SMS_GATEWAY_ENDPOINT, SMS_GATEWAY_API_KEY, SMS_GATEWAY_USERNAME, SMS_GATEWAY_PASSWORD, SMS_SENDER_ID
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Test SMS Configuration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Send a test SMS to verify the gateway configuration is working correctly.
              </p>
              <Button
                variant="outline"
                onClick={handleTestSMS}
                disabled={testing}
              >
                <Send className="w-4 h-4 mr-2" />
                {testing ? 'Testing...' : 'Send Test SMS'}
              </Button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Required Environment Secrets</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li><code className="bg-background px-1 rounded">SMS_GATEWAY_ENDPOINT</code> - API endpoint URL</li>
              <li><code className="bg-background px-1 rounded">SMS_GATEWAY_API_KEY</code> - API authentication key</li>
              <li><code className="bg-background px-1 rounded">SMS_GATEWAY_USERNAME</code> - Gateway username (optional)</li>
              <li><code className="bg-background px-1 rounded">SMS_GATEWAY_PASSWORD</code> - Gateway password (optional)</li>
              <li><code className="bg-background px-1 rounded">SMS_SENDER_ID</code> - Sender ID (e.g., "Awkaf")</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">SMS Features</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>SMS will be sent automatically after successful transactions</li>
              <li>Only transactions with mobile numbers will receive SMS</li>
              <li>Duplicate SMS prevention for the same transaction</li>
              <li>Full audit trail of SMS delivery status</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SMSSettings;