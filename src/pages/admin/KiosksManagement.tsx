import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Edit, Upload, X } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const KiosksManagement = () => {
  const navigate = useNavigate();
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    reference_number: '',
    location: '',
    status: 'active' as 'active' | 'inactive' | 'maintenance' | 'pending_approval',
    configuration: { pos: { connectionType: 'usb', ipAddress: '', port: '' } }
  });
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [logoImage, setLogoImage] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    checkAuth();
    loadKiosks();
    loadBackgroundImage();
    loadLogoImage();

    // Subscribe to real-time changes in kiosks table
    const channel = supabase
      .channel('kiosks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kiosks'
        },
        () => {
          loadKiosks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      toast.error(`Error loading kiosks: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadBackgroundImage = async () => {
    try {
      const { data, error } = await supabase
        .from("kiosk_settings")
        .select("background_image_url")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.background_image_url) {
        setBackgroundImage(data.background_image_url);
      }
    } catch (error) {
      console.error("Error loading background image:", error);
    }
  };

  const loadLogoImage = async () => {
    try {
      const { data, error } = await supabase
        .from("kiosk_settings")
        .select("logo_url")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data && (data as any).logo_url) {
        setLogoImage((data as any).logo_url);
      }
    } catch (error) {
      console.error("Error loading logo image:", error);
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
        toast.success("Kiosk updated successfully");
      } else {
        const { error } = await supabase
          .from('kiosks')
          .insert([formData]);

        if (error) throw error;
        toast.success("Kiosk added successfully");
      }

      resetForm();
      loadKiosks();
    } catch (error: any) {
      toast.error(`Error saving kiosk: ${error.message}`);
    }
  };

  const handleEdit = (kiosk: any) => {
    setEditingId(kiosk.id);
    setFormData({
      name: kiosk.name,
      reference_number: kiosk.reference_number || '',
      location: kiosk.location,
      status: kiosk.status,
      configuration: kiosk.configuration || { pos: { connectionType: 'usb', ipAddress: '', port: '' } }
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
      toast.success("Kiosk deleted successfully");
      loadKiosks();
    } catch (error: any) {
      toast.error(`Error deleting kiosk: ${error.message}`);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      reference_number: '',
      location: '',
      status: 'active',
      configuration: { pos: { connectionType: 'usb', ipAddress: '', port: '' } }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Invalid file type. Please upload an image file");
      return;
    }

    // Validate aspect ratio would be 9:16 (vertical)
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const aspectRatio = img.width / img.height;
    const targetAspectRatio = 9 / 16;
    const tolerance = 0.1;

    if (Math.abs(aspectRatio - targetAspectRatio) > tolerance) {
      toast.error(`Incorrect aspect ratio. Please upload an image with a 9:16 aspect ratio (vertical). Current ratio: ${img.width}x${img.height}`);
      return;
    }

    setUploadingImage(true);

    try {
      // Delete old image if exists
      if (backgroundImage) {
        const oldPath = backgroundImage.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('kiosk-backgrounds')
            .remove([oldPath]);
        }
      }

      // Upload new image
      const fileExt = file.name.split('.').pop();
      const fileName = `background-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('kiosk-backgrounds')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('kiosk-backgrounds')
        .getPublicUrl(fileName);

      // Update database
      const { error: updateError } = await supabase
        .from('kiosk_settings')
        .update({ background_image_url: publicUrl })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (updateError) throw updateError;

      setBackgroundImage(publicUrl);
      toast.success("Background image uploaded! The image will now appear on all kiosk screens");
    } catch (error: any) {
      toast.error(`Error uploading image: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!backgroundImage) return;

    try {
      // Extract file path from the full URL
      const urlParts = backgroundImage.split('/');
      const filePath = urlParts[urlParts.length - 1];
      
      // Delete file from storage
      const { error: deleteError } = await supabase.storage
        .from("kiosk-backgrounds")
        .remove([filePath]);

      if (deleteError) throw deleteError;

      // Update database to remove the URL
      const { error: updateError } = await supabase
        .from("kiosk_settings")
        .update({ background_image_url: null })
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (updateError) throw updateError;

      setBackgroundImage("");
      toast.success("Background image removed successfully");
    } catch (error: any) {
      toast.error(`Error removing image: ${error.message}`);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(png|svg\+xml)$/)) {
      toast.error("Please upload a PNG or SVG file");
      return;
    }

    try {
      setUploadingLogo(true);

      // Delete old logo if exists
      if (logoImage) {
        const urlParts = logoImage.split('/');
        const oldFilePath = urlParts[urlParts.length - 1];
        await supabase.storage
          .from("organization-logos")
          .remove([oldFilePath]);
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(fileName);

      // Update or insert kiosk_settings
      const { data: existing } = await supabase
        .from("kiosk_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("kiosk_settings")
          .update({ logo_url: urlData.publicUrl } as any)
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("kiosk_settings")
          .insert({ logo_url: urlData.publicUrl } as any);

        if (insertError) throw insertError;
      }

      setLogoImage(urlData.publicUrl);
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      toast.error(`Error uploading logo: ${error.message}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoImage) return;

    try {
      const urlParts = logoImage.split('/');
      const filePath = urlParts[urlParts.length - 1];
      
      const { error: deleteError } = await supabase.storage
        .from("organization-logos")
        .remove([filePath]);

      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from("kiosk_settings")
        .update({ logo_url: null } as any)
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (updateError) throw updateError;

      setLogoImage("");
      toast.success("Logo removed successfully");
    } catch (error: any) {
      toast.error(`Error removing logo: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold">Kiosk Management</h1>
          </div>
          <ThemeToggle />
        </div>

        {/* Logo Management */}
        <Card className="mb-6">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Organization Logo</h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload your organization's logo (PNG or SVG format only)
            </p>
            
            {logoImage ? (
              <div className="space-y-4">
                <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-white flex items-center justify-center">
                  <img 
                    src={logoImage} 
                    alt="Organization Logo" 
                    className="max-w-full max-h-full object-contain p-2"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    disabled={uploadingLogo}
                  >
                    Change Logo
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                  >
                    Remove Logo
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? "Uploading..." : "Upload Logo"}
                </Button>
              </div>
            )}
            
            <input
              id="logo-upload"
              type="file"
              accept=".png,.svg"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-8 mb-8">
          {/* Background Image Upload */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Kiosk Background Image</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a background image that will appear on all kiosk screens. Recommended: 9:16 aspect ratio (e.g., 1080x1920 pixels)
            </p>
            
            {backgroundImage ? (
              <div className="space-y-4">
                <div className="w-full max-w-xs mx-auto">
                  <div className="relative rounded-lg overflow-hidden" style={{aspectRatio: '9/16', maxHeight: '400px'}}>
                    <img
                      src={backgroundImage}
                      alt="Kiosk background"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleRemoveImage}
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove Background Image
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <Label
                  htmlFor="background-upload"
                  className="cursor-pointer inline-block"
                >
                  <div className="text-sm text-muted-foreground mb-2">
                    Click to upload or drag and drop
                  </div>
                  <div className="text-xs text-muted-foreground">
                    PNG, JPG up to 10MB (9:16 aspect ratio)
                  </div>
                </Label>
                <Input
                  id="background-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </div>
            )}
            
            {uploadingImage && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Uploading...
              </p>
            )}
          </Card>
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

              {/* POS Configuration Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">POS Configuration</h3>
                <div>
                  <Label>Connection Type</Label>
                  <Select
                    value={formData.configuration.pos.connectionType}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      configuration: { 
                        ...formData.configuration, 
                        pos: { ...formData.configuration.pos, connectionType: value }
                      }
                    })}
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

                {formData.configuration.pos.connectionType === 'ethernet' && (
                  <>
                    <div>
                      <Label htmlFor="ip">IP Address</Label>
                      <Input
                        id="ip"
                        value={formData.configuration.pos.ipAddress}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          configuration: { 
                            ...formData.configuration, 
                            pos: { ...formData.configuration.pos, ipAddress: e.target.value }
                          }
                        })}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        value={formData.configuration.pos.port}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          configuration: { 
                            ...formData.configuration, 
                            pos: { ...formData.configuration.pos, port: e.target.value }
                          }
                        })}
                        placeholder="8080"
                      />
                    </div>
                  </>
                )}
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Existing Kiosks ({kiosks.length})</h2>
              {kiosks.filter(k => k.status === 'pending_approval').length > 0 && (
                <span className="px-3 py-1 bg-destructive/20 text-destructive rounded-full text-sm font-medium">
                  {kiosks.filter(k => k.status === 'pending_approval').length} Pending Approval
                </span>
              )}
            </div>
            {loading ? (
              <p>Loading...</p>
            ) : kiosks.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No kiosks registered yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Kiosks can register themselves from the Settings Panel on the kiosk app.
                </p>
              </Card>
            ) : (
              kiosks.map((kiosk) => (
                <Card key={kiosk.id} className={`p-4 ${kiosk.status === 'pending_approval' ? 'border-destructive' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">{kiosk.name}</h3>
                        {kiosk.status === 'pending_approval' && (
                          <span className="px-2 py-0.5 bg-destructive/20 text-destructive rounded text-xs font-medium">
                            Needs Approval
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{kiosk.location}</p>
                      <div className="flex gap-4 mt-2">
                        <p className="text-xs text-muted-foreground">
                          Ref: {kiosk.reference_number || 'N/A'}
                        </p>
                        <p className="text-xs">
                          <span className={`px-2 py-1 rounded ${
                            kiosk.status === 'active' ? 'bg-success/20 text-success' :
                            kiosk.status === 'pending_approval' ? 'bg-destructive/20 text-destructive' :
                            kiosk.status === 'inactive' ? 'bg-gray-400/20 text-gray-600' :
                            'bg-warning/20 text-warning'
                          }`}>
                            {kiosk.status.replace('_', ' ')}
                          </span>
                        </p>
                      </div>
                      {kiosk.configuration?.pos && (
                        <p className="text-xs text-muted-foreground mt-2">
                          POS: {kiosk.configuration.pos.connectionType?.toUpperCase() || 'Not configured'}
                          {kiosk.configuration.pos.connectionType === 'ethernet' && kiosk.configuration.pos.ipAddress && (
                            <> ({kiosk.configuration.pos.ipAddress}:{kiosk.configuration.pos.port})</>
                          )}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Sound Effects:</span>
                        <Button
                          size="sm"
                          variant={kiosk.configuration?.sound_enabled !== false ? "default" : "outline"}
                          onClick={async () => {
                            const currentSoundEnabled = kiosk.configuration?.sound_enabled !== false;
                            const { error } = await supabase
                              .from('kiosks')
                              .update({
                                configuration: {
                                  ...kiosk.configuration,
                                  sound_enabled: !currentSoundEnabled
                                }
                              })
                              .eq('id', kiosk.id);
                            
                            if (!error) {
                              toast.success(`Sound ${!currentSoundEnabled ? 'enabled' : 'muted'} for ${kiosk.name}`);
                              loadKiosks();
                            }
                          }}
                          className="h-6 text-xs px-2"
                        >
                          {kiosk.configuration?.sound_enabled !== false ? '🔊 Enabled' : '🔇 Muted'}
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {kiosk.status === 'pending_approval' && (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={async () => {
                            const { error } = await supabase
                              .from('kiosks')
                              .update({ status: 'active' })
                              .eq('id', kiosk.id);
                            
                            if (!error) {
                              toast.success("Kiosk approved and activated");
                              loadKiosks();
                            }
                          }}
                          className="bg-success hover:bg-success/90"
                        >
                          Approve
                        </Button>
                      )}
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
