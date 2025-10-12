import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const AddAdminPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [email, setEmail] = useState('');

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

    try {
      // Use default password
      const defaultPassword = 'awkaf12345';

      // Create the user account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: defaultPassword,
        options: {
          data: {
            full_name: email.split('@')[0],
          },
          emailRedirectTo: `${window.location.origin}/auth/first-login`,
        },
      });

      if (signUpError) throw signUpError;

      if (signUpData.user) {
        // Add admin role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: signUpData.user.id, role: 'admin' }]);

        if (roleError) throw roleError;

        toast({
          title: "Admin added successfully",
          description: `Admin account created for ${email}. Default password: awkaf12345 (must be changed on first login)`,
        });

        setEmail('');
      }
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
                The admin will be assigned the default password: awkaf12345
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? 'Adding Admin...' : 'Add Admin'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Note</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Only super admin can add new admins</li>
              <li>Default password: awkaf12345</li>
              <li>New admins must change their password on first login</li>
              <li>Admins can access the admin panel and all its features</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AddAdminPage;
