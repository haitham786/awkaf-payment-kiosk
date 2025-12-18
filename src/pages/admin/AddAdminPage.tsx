import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, Copy, CheckCircle, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const AddAdminPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [createdAdmin, setCreatedAdmin] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    // Check if super admin using database role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'super_admin');
    
    const hasSuperAdminRole = roles && roles.length > 0;
    setIsSuperAdmin(hasSuperAdminRole);

    if (!hasSuperAdminRole) {
      toast({
        title: "Access Denied",
        description: "Only super admin can add new admins.",
        variant: "destructive",
      });
      navigate('/admin/admins');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCreatedAdmin(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      // Call edge function to create admin (bypasses RLS)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create admin');
      }

      // Show the temporary password (only shown once)
      setCreatedAdmin({
        email: email,
        temporaryPassword: result.temporaryPassword,
      });

      toast({
        title: "Admin added successfully",
        description: `Admin account created for ${email}. Please share the temporary password securely.`,
      });

      setEmail('');
    } catch (error: any) {
      toast({
        title: "Error adding admin",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    if (createdAdmin?.temporaryPassword) {
      await navigator.clipboard.writeText(createdAdmin.temporaryPassword);
      setCopied(true);
      toast({
        title: "Password copied",
        description: "Temporary password copied to clipboard. Share it securely.",
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDone = () => {
    setCreatedAdmin(null);
    navigate('/admin/admins');
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin/admins')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admins
            </Button>
            <h1 className="text-3xl font-bold">Add New Admin</h1>
          </div>
          <ThemeToggle />
        </div>

        {createdAdmin ? (
          // Show temporary password after successful creation
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4 text-green-600">
              <CheckCircle className="w-6 h-6" />
              <h2 className="text-xl font-semibold">Admin Created Successfully</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Email</Label>
                <p className="font-medium">{createdAdmin.email}</p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <Label className="font-semibold text-amber-800">Temporary Password</Label>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-white border rounded font-mono text-sm break-all">
                    {createdAdmin.temporaryPassword}
                  </code>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyPassword}
                    className="shrink-0"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  ⚠️ This password is shown only once. Please copy and share it securely with the new admin.
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">Important Notes</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Share this password through a secure channel (in person, encrypted message)</li>
                  <li>The new admin must change this password on first login</li>
                  <li>This password will not be shown again</li>
                </ul>
              </div>

              <Button onClick={handleDone} className="w-full">
                Done - Return to Admins List
              </Button>
            </div>
          </Card>
        ) : (
          // Show form for creating new admin
          <Card className="p-6">
            <form onSubmit={handleAddAdmin} className="space-y-6">
              <div>
                <Label htmlFor="email">Admin Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  A secure temporary password will be generated automatically.
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                <UserPlus className="w-4 h-4 mr-2" />
                {loading ? 'Creating Admin...' : 'Create Admin Account'}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">Security Information</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Only super admin can create new admins</li>
                <li>A strong, random password will be generated</li>
                <li>New admins must change their password on first login</li>
                <li>The temporary password is shown only once after creation</li>
              </ul>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AddAdminPage;
