import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Trash2, Shield, User, UserPlus } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const AdminsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadAdmins();
    }
  }, [currentUserId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    
    setCurrentUserId(session.user.id);

    // Check if user has admin or super_admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    if (!roles || roles.length === 0) {
      navigate('/auth');
      return;
    }

    const hasAdminRole = roles.some(r => r.role === 'admin' || r.role === 'super_admin');
    if (!hasAdminRole) {
      navigate('/auth');
      return;
    }

    // Check if super admin (for delete privileges)
    const hasSuperAdminRole = roles.some(r => r.role === 'super_admin');
    setIsSuperAdmin(hasSuperAdminRole);
  };

  const loadAdmins = async () => {
    try {
      // Get all users with admin or super_admin roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'super_admin']);

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        setAdmins([]);
        setLoading(false);
        return;
      }

      const userIds = rolesData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const combined = profilesData?.map(profile => ({
        ...profile,
        role: rolesData.find(r => r.user_id === profile.id)?.role || 'admin'
      })) || [];

      // Sort: super_admins first, then by name
      combined.sort((a, b) => {
        if (a.role === 'super_admin' && b.role !== 'super_admin') return -1;
        if (a.role !== 'super_admin' && b.role === 'super_admin') return 1;
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });

      setAdmins(combined);
    } catch (error: any) {
      toast({
        title: "Error loading admins",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    // Check if target user is super admin
    const { data: targetRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'super_admin');
    
    if (targetRoles && targetRoles.length > 0) {
      toast({
        title: "Cannot delete super admin",
        description: "Super admin accounts cannot be deleted.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Are you sure you want to remove this admin?')) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      toast({ title: "Admin removed successfully" });
      loadAdmins();
    } catch (error: any) {
      toast({
        title: "Error removing admin",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Manage Admins</h1>
          </div>
          <ThemeToggle />
        </div>

        {isSuperAdmin && (
          <div className="mb-6">
            <Button onClick={() => navigate('/admin/add-admin')}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add New Admin
            </Button>
          </div>
        )}

        {isSuperAdmin && (
          <Card className="p-6 mb-6 bg-primary/10">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Super Admin Access
            </h2>
            <p className="text-sm text-muted-foreground">
              You have super admin privileges with full access to all features including managing other admins.
            </p>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Current Admins ({admins.length})</h2>
          {loading ? (
            <p>Loading...</p>
          ) : admins.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No admins found. Contact super admin to get admin access.
            </Card>
          ) : (
            admins.map((admin) => (
              <Card key={admin.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${admin.role === 'super_admin' ? 'bg-primary/20' : 'bg-secondary/20'}`}>
                      {admin.role === 'super_admin' ? (
                        <Shield className="w-5 h-5 text-primary" />
                      ) : (
                        <User className="w-5 h-5 text-secondary" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{admin.full_name || 'No name'}</h3>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {admin.role === 'super_admin' ? '🔑 Super Admin' : '👤 Admin'}
                      </p>
                    </div>
                  </div>
                  {isSuperAdmin && admin.id !== currentUserId && admin.role !== 'super_admin' && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(admin.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        <Card className="p-6 mt-6 bg-muted/50">
          <h3 className="font-semibold mb-2">Note</h3>
          <p className="text-sm text-muted-foreground">
            Only super admins can add or remove other admins. Super admin accounts cannot be deleted for security reasons.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default AdminsManagement;