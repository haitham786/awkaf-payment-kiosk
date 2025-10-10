import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Edit } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const KiosksManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    reference_number: '',
    location: '',
    status: 'active' as 'active' | 'inactive' | 'maintenance'
  });

  useEffect(() => {
    checkAuth();
    loadKiosks();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
  };

  const loadKiosks = async () => {
    try {
      const { data, error } = await supabase
        .from('kiosks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKiosks(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading kiosks",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('kiosks')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: "Kiosk updated successfully" });
      } else {
        const { error } = await supabase
          .from('kiosks')
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Kiosk added successfully" });
      }

      resetForm();
      loadKiosks();
    } catch (error: any) {
      toast({
        title: "Error saving kiosk",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (kiosk: any) => {
    setEditingId(kiosk.id);
    setFormData({
      name: kiosk.name,
      reference_number: kiosk.reference_number || '',
      location: kiosk.location,
      status: kiosk.status
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this kiosk?')) return;

    try {
      const { error } = await supabase
        .from('kiosks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Kiosk deleted successfully" });
      loadKiosks();
    } catch (error: any) {
      toast({
        title: "Error deleting kiosk",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      reference_number: '',
      location: '',
      status: 'active'
    });
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Manage Kiosks</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Form */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Edit Kiosk' : 'Add New Kiosk'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Kiosk Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Muscat Mall Kiosk"
                />
              </div>

              <div>
                <Label htmlFor="reference_number">Reference Number</Label>
                <Input
                  id="reference_number"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  required
                  placeholder="e.g., KIOSK001"
                />
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                  placeholder="e.g., Muscat City Centre, Ground Floor"
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingId ? 'Update' : 'Add'} Kiosk
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* Kiosks List */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Existing Kiosks ({kiosks.length})</h2>
            {loading ? (
              <p>Loading...</p>
            ) : (
              kiosks.map((kiosk) => (
                <Card key={kiosk.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{kiosk.name}</h3>
                      <p className="text-sm text-muted-foreground">{kiosk.location}</p>
                      <div className="flex gap-4 mt-2">
                        <p className="text-xs text-muted-foreground">
                          Ref: {kiosk.reference_number || 'N/A'}
                        </p>
                        <p className="text-xs">
                          <span className={`px-2 py-1 rounded ${
                            kiosk.status === 'active' ? 'bg-success/20 text-success' :
                            kiosk.status === 'inactive' ? 'bg-destructive/20 text-destructive' :
                            'bg-warning/20 text-warning'
                          }`}>
                            {kiosk.status}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(kiosk)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(kiosk.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiosksManagement;