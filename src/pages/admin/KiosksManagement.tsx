import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Edit, Upload, X, CreditCard, FlaskConical, Usb } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PosKioskHealthPanel from "@/components/admin/PosKioskHealthPanel";
import PosAlertSettingsCard from "@/components/admin/PosAlertSettingsCard";
import { effectiveState, POS_HEALTH_META, type PosHealthState } from "@/lib/posHealth";


type PaymentMode = 'test_payment' | 'nbo_pos';
type ReceiptChannel = 'sms' | 'whatsapp' | 'both';

interface KioskConfiguration {
  payment_mode: PaymentMode;
  nbo_pos?: {
    baud_rate: number;
    vendor_id: number;
    product_id: number;
    timeout_seconds: number;
    terminal_label: string;
  };
  test_payment?: {
    auto_approve?: boolean;
  };
  sound_enabled?: boolean;
  receipt_channel?: ReceiptChannel;
}


// NBO OM-A880 is wired to the kiosk with a USB-OTG cable, so the settings are
// local link settings (no credentials travel over the internet).
const emptyNboPos = () => ({
  baud_rate: 115200,
  vendor_id: 0,
  product_id: 0,
  timeout_seconds: 90,
  terminal_label: '',
});

const KiosksManagement = () => {
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    reference_number: '',
    location: '',
    status: 'active' as 'active' | 'inactive' | 'maintenance' | 'pending_approval',
    configuration: {
      payment_mode: 'nbo_pos' as PaymentMode,
      nbo_pos: emptyNboPos(),
      sound_enabled: true,
      receipt_channel: 'sms' as ReceiptChannel,
    } as KioskConfiguration
  });
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [logoImage, setLogoImage] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [posStatus, setPosStatus] = useState<Record<string, any>>({});
  const [healthFilter, setHealthFilter] = useState<'all' | PosHealthState>('all');
  const [fleetSearch, setFleetSearch] = useState('');


  const sanitizeConfiguration = (configuration: KioskConfiguration): KioskConfiguration => ({
    payment_mode: configuration.payment_mode === 'test_payment' ? 'test_payment' : 'nbo_pos',
    nbo_pos: { ...emptyNboPos(), ...(configuration.nbo_pos || {}) },
    test_payment: configuration.test_payment || { auto_approve: true },
    sound_enabled: configuration.sound_enabled !== false,
    receipt_channel: configuration.receipt_channel || 'sms',
  });

  useEffect(() => {
    checkAuth();
    loadKiosks();
    loadBackgroundImage();
    loadLogoImage();
    loadPosStatus();

    const channel = supabase
      .channel('kiosks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosks' }, () => { loadKiosks(); })
      .subscribe();

    // Refresh the terminal health rows so the offline rule (>3 min stale) applies live.
    const healthPoll = window.setInterval(() => { loadPosStatus(); }, 20000);

    return () => { supabase.removeChannel(channel); window.clearInterval(healthPoll); };
  }, []);

  const loadPosStatus = async () => {
    try {
      const { data, error } = await supabase.from('kiosk_pos_status').select('*');
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((row: any) => { map[row.kiosk_id] = row; });
      setPosStatus(map);
    } catch (error) {
      console.error('Error loading POS health:', error);
    }
  };


  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/auth'); return; }
  };

  const loadKiosks = async () => {
    try {
      const { data, error } = await supabase.from('kiosks').select('*').order('created_at', { ascending: false });
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
      const { data, error } = await supabase.from("kiosk_settings").select("background_image_url").limit(1).maybeSingle();
      if (error) throw error;
      if (data?.background_image_url) setBackgroundImage(data.background_image_url);
    } catch (error) { console.error("Error loading background image:", error); }
  };

  const loadLogoImage = async () => {
    try {
      const { data, error } = await supabase.from("kiosk_settings").select("logo_url").limit(1).maybeSingle();
      if (error) throw error;
      if (data && (data as any).logo_url) setLogoImage((data as any).logo_url);
    } catch (error) { console.error("Error loading logo image:", error); }
  };

  const validateForm = (): boolean => {
    setValidationError(null);
    // Trial mode: any non-empty auth key is accepted. Real key only needed for live transactions.
    return true;
  };

  const normalizeReferenceNumber = (referenceNumber: string) => {
    const trimmedReference = referenceNumber.trim();
    return trimmedReference.length > 0 ? trimmedReference : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const referenceNumber = normalizeReferenceNumber(formData.reference_number);
      const publicConfig = sanitizeConfiguration(formData.configuration);


      if (editingId) {
        const existingKiosk = kiosks.find((kiosk) => kiosk.id === editingId);
        const currentReferenceNumber = normalizeReferenceNumber(existingKiosk?.reference_number || '');
        const updatePayload: Record<string, any> = {
          name: formData.name,
          location: formData.location,
          status: formData.status,
          configuration: publicConfig,
        };

        if (referenceNumber !== currentReferenceNumber) {
          if (referenceNumber) {
            const { data: duplicateKiosk, error: duplicateError } = await supabase
              .from('kiosks')
              .select('id')
              .eq('reference_number', referenceNumber)
              .neq('id', editingId)
              .maybeSingle();

            if (duplicateError) throw duplicateError;
            if (duplicateKiosk) throw new Error('This kiosk reference number is already used by another kiosk.');
          }

          updatePayload.reference_number = referenceNumber;
        }

        const { error } = await supabase.from('kiosks').update(updatePayload).eq('id', editingId);
        if (error) throw error;
        toast.success("Kiosk updated successfully");
      } else {
        if (referenceNumber) {
          const { data: duplicateKiosk, error: duplicateError } = await supabase
            .from('kiosks')
            .select('id')
            .eq('reference_number', referenceNumber)
            .maybeSingle();

          if (duplicateError) throw duplicateError;
          if (duplicateKiosk) throw new Error('This kiosk reference number is already used by another kiosk.');
        }

        const { error } = await supabase.from('kiosks').insert([{
          name: formData.name, reference_number: referenceNumber,
          location: formData.location, status: formData.status,
          configuration: publicConfig
        } as any]);
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
    const config = kiosk.configuration || {};
    setFormData({
      name: kiosk.name, reference_number: kiosk.reference_number || '',
      location: kiosk.location, status: kiosk.status,
      configuration: {
        payment_mode: config.payment_mode === 'test_payment' ? 'test_payment' : 'nbo_pos',
        nbo_pos: { ...emptyNboPos(), ...(config.nbo_pos || {}) },
        test_payment: config.test_payment || { auto_approve: true },
        sound_enabled: config.sound_enabled !== false,
        receipt_channel: (config.receipt_channel as ReceiptChannel) || 'sms',
      }
    });
    setValidationError(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this kiosk?')) return;
    try {
      const { error } = await supabase.from('kiosks').delete().eq('id', id);
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
      name: '', reference_number: '', location: '', status: 'active',
      configuration: {
        payment_mode: 'nbo_pos',
        nbo_pos: emptyNboPos(),
        test_payment: { auto_approve: true },
        sound_enabled: true,
        receipt_channel: 'sms',
      }
    });
    setValidationError(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error("Invalid file type. Please upload an image file"); return; }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => { img.onload = resolve; });
    const aspectRatio = img.width / img.height;
    const targetAspectRatio = 9 / 16;
    if (Math.abs(aspectRatio - targetAspectRatio) > 0.1) {
      toast.error(`Incorrect aspect ratio. Please upload 9:16 (vertical). Current: ${img.width}x${img.height}`);
      return;
    }
    setUploadingImage(true);
    try {
      if (backgroundImage) {
        const oldPath = backgroundImage.split('/').pop();
        if (oldPath) await supabase.storage.from('kiosk-backgrounds').remove([oldPath]);
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `background-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('kiosk-backgrounds').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('kiosk-backgrounds').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('kiosk_settings').update({ background_image_url: publicUrl }).eq('id', '00000000-0000-0000-0000-000000000001');
      if (updateError) throw updateError;
      setBackgroundImage(publicUrl);
      toast.success("Background image uploaded!");
    } catch (error: any) {
      toast.error(`Error uploading image: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!backgroundImage) return;
    try {
      const filePath = backgroundImage.split('/').pop()!;
      await supabase.storage.from("kiosk-backgrounds").remove([filePath]);
      await supabase.from("kiosk_settings").update({ background_image_url: null }).eq("id", "00000000-0000-0000-0000-000000000001");
      setBackgroundImage("");
      toast.success("Background image removed");
    } catch (error: any) {
      toast.error(`Error removing image: ${error.message}`);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|svg\+xml)$/)) { toast.error("Please upload a PNG or SVG file"); return; }
    try {
      setUploadingLogo(true);
      if (logoImage) {
        const oldFilePath = logoImage.split('/').pop()!;
        await supabase.storage.from("organization-logos").remove([oldFilePath]);
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("organization-logos").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("organization-logos").getPublicUrl(fileName);
      const { data: existing } = await supabase.from("kiosk_settings").select("id").limit(1).maybeSingle();
      if (existing) {
        await supabase.from("kiosk_settings").update({ logo_url: urlData.publicUrl } as any).eq("id", existing.id);
      } else {
        await supabase.from("kiosk_settings").insert({ logo_url: urlData.publicUrl } as any);
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
      const filePath = logoImage.split('/').pop()!;
      await supabase.storage.from("organization-logos").remove([filePath]);
      await supabase.from("kiosk_settings").update({ logo_url: null } as any).eq("id", "00000000-0000-0000-0000-000000000001");
      setLogoImage("");
      toast.success("Logo removed successfully");
    } catch (error: any) {
      toast.error(`Error removing logo: ${error.message}`);
    }
  };

  const getPaymentModeLabel = (kiosk: any) =>
    kiosk.configuration?.payment_mode === 'test_payment'
      ? 'Testing Mode (Simulated Success)'
      : 'National Bank of Oman (NBO) POS Terminal';

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/admin')}>
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
            <p className="text-sm text-muted-foreground mb-4">Upload your organization's logo (PNG or SVG format only)</p>
            {logoImage ? (
              <div className="space-y-4">
                <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-white flex items-center justify-center">
                  <img src={logoImage} alt="Organization Logo" className="max-w-full max-h-full object-contain p-2" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>Change Logo</Button>
                  <Button variant="destructive" onClick={handleRemoveLogo} disabled={uploadingLogo}>Remove Logo</Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? "Uploading..." : "Upload Logo"}
              </Button>
            )}
            <input ref={logoInputRef} type="file" accept="image/png,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
          </div>
        </Card>

        {/* Background Image */}
        <Card className="mb-8 p-6">
          <h2 className="text-xl font-bold mb-4">Kiosk Background Image</h2>
          <p className="text-sm text-muted-foreground mb-4">Upload a background image (9:16 aspect ratio, e.g., 1080x1920)</p>
          {backgroundImage ? (
            <div className="space-y-4">
              <div className="w-full max-w-xs mx-auto">
                <div className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '9/16', maxHeight: '400px' }}>
                  <img src={backgroundImage} alt="Kiosk background" className="w-full h-full object-cover" />
                </div>
              </div>
              <Button variant="destructive" onClick={handleRemoveImage} className="w-full">
                <X className="w-4 h-4 mr-2" />Remove Background Image
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => backgroundInputRef.current?.click()}>
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground mb-2">Click to upload</div>
              <div className="text-xs text-muted-foreground">PNG, JPG up to 10MB (9:16 aspect ratio)</div>
              <input ref={backgroundInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Form */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Kiosk' : 'Add New Kiosk'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Kiosk Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Muscat Mall Kiosk" />
              </div>
              <div>
                <Label htmlFor="reference_number">Reference Number</Label>
                <Input id="reference_number" value={formData.reference_number} onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })} placeholder="e.g., KIOSK001" />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required placeholder="e.g., Muscat City Centre, Ground Floor" />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method Toggle */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payment Method Configuration
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select a payment method for this kiosk. Only one can be active at a time.
                </p>

                <RadioGroup
                  value={formData.configuration.payment_mode}
                  onValueChange={(value: PaymentMode) => {
                    setFormData({ ...formData, configuration: { ...formData.configuration, payment_mode: value } });
                    setValidationError(null);
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="nbo_pos" id="nbo_pos" />
                    <Label htmlFor="nbo_pos" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Usb className="w-4 h-4" />
                      <div>
                        <p className="font-medium">National Bank of Oman (NBO) POS Terminal</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="test_payment" id="test_payment" />
                    <Label htmlFor="test_payment" className="flex items-center gap-2 cursor-pointer flex-1">
                      <FlaskConical className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Testing Mode</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* NBO OM-A880 (USB) Configuration */}
              {formData.configuration.payment_mode === 'nbo_pos' && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Usb className="w-4 h-4" />
                    NBO POS Terminal (OM-A880) Configuration
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    The terminal is connected to this kiosk with a USB-OTG cable and must be switched to
                    Interface (ECR) mode from the merchant menu. No credentials are stored here — the
                    terminal holds its own MID/TID from NBO.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="nbo_baud">Baud Rate</Label>
                      <Input
                        id="nbo_baud"
                        type="number"
                        value={formData.configuration.nbo_pos?.baud_rate ?? 115200}
                        onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, nbo_pos: { ...emptyNboPos(), ...formData.configuration.nbo_pos!, baud_rate: Number(e.target.value) } } })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">115200 for the OM-A880.</p>
                    </div>
                    <div>
                      <Label htmlFor="nbo_timeout">Response Timeout (seconds)</Label>
                      <Input
                        id="nbo_timeout"
                        type="number"
                        value={formData.configuration.nbo_pos?.timeout_seconds ?? 90}
                        onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, nbo_pos: { ...emptyNboPos(), ...formData.configuration.nbo_pos!, timeout_seconds: Number(e.target.value) } } })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="nbo_vid">USB Vendor ID (decimal, 0 = any)</Label>
                      <Input
                        id="nbo_vid"
                        type="number"
                        value={formData.configuration.nbo_pos?.vendor_id ?? 0}
                        onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, nbo_pos: { ...emptyNboPos(), ...formData.configuration.nbo_pos!, vendor_id: Number(e.target.value) } } })}
                        placeholder="1478"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nbo_pid">USB Product ID (decimal, 0 = any)</Label>
                      <Input
                        id="nbo_pid"
                        type="number"
                        value={formData.configuration.nbo_pos?.product_id ?? 0}
                        onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, nbo_pos: { ...emptyNboPos(), ...formData.configuration.nbo_pos!, product_id: Number(e.target.value) } } })}
                        placeholder="36923"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="nbo_label">Terminal Label (optional)</Label>
                    <Input
                      id="nbo_label"
                      value={formData.configuration.nbo_pos?.terminal_label || ''}
                      onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, nbo_pos: { ...emptyNboPos(), ...formData.configuration.nbo_pos!, terminal_label: e.target.value } } })}
                      placeholder="e.g. Main hall OM-A880"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Only for identification in reports. Pairing is physical: each kiosk drives the terminal on its own USB cable.
                    </p>
                  </div>
                </div>
              )}


              {formData.configuration.payment_mode === 'test_payment' && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FlaskConical className="w-4 h-4" />
                    Testing Mode Configuration
                  </h4>
                </div>
              )}

              {/* Receipt Channel */}
              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-sm">Receipt Channel</h3>
                <p className="text-xs text-muted-foreground">
                  Choose how donors receive their receipt after a successful donation.
                </p>
                <RadioGroup
                  value={formData.configuration.receipt_channel || 'sms'}
                  onValueChange={(value: ReceiptChannel) =>
                    setFormData({ ...formData, configuration: { ...formData.configuration, receipt_channel: value } })
                  }
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sms" id="rc_sms" />
                    <Label htmlFor="rc_sms" className="cursor-pointer">SMS only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="whatsapp" id="rc_wa" />
                    <Label htmlFor="rc_wa" className="cursor-pointer">WhatsApp only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="rc_both" />
                    <Label htmlFor="rc_both" className="cursor-pointer">Both</Label>
                  </div>
                </RadioGroup>
              </div>


              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{editingId ? 'Update' : 'Add'} Kiosk</Button>
                {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
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
              </Card>
            ) : (
              kiosks.map((kiosk) => (
                <Card key={kiosk.id} className={`p-4 ${kiosk.status === 'pending_approval' ? 'border-destructive' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">{kiosk.name}</h3>
                        {kiosk.status === 'pending_approval' && (
                          <span className="px-2 py-0.5 bg-destructive/20 text-destructive rounded text-xs font-medium">Needs Approval</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{kiosk.location}</p>
                      <div className="flex gap-4 mt-2">
                        <p className="text-xs text-muted-foreground">Ref: {kiosk.reference_number || 'N/A'}</p>
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
                      {/* Payment Mode */}
                       <div className="mt-2 flex items-center gap-2">
                         {kiosk.configuration?.payment_mode === 'test_payment'
                           ? <FlaskConical className="w-3 h-3 text-amber-600" />
                           : <Usb className="w-3 h-3 text-emerald-600" />}
                        <p className="text-xs text-muted-foreground">{getPaymentModeLabel(kiosk)}</p>
                      </div>

                      {/* Sound */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Sound Effects:</span>
                        <Button
                          size="sm"
                          variant={kiosk.configuration?.sound_enabled !== false ? "default" : "outline"}
                          onClick={async () => {
                            const currentSoundEnabled = kiosk.configuration?.sound_enabled !== false;
                            const publicConfig = sanitizeConfiguration({ ...kiosk.configuration, sound_enabled: !currentSoundEnabled });
                            await supabase.from('kiosks').update({ configuration: publicConfig as any }).eq('id', kiosk.id);
                            toast.success(`Sound ${!currentSoundEnabled ? 'enabled' : 'muted'} for ${kiosk.name}`);
                            loadKiosks();
                          }}
                          className="h-6 text-xs px-2"
                        >
                          {kiosk.configuration?.sound_enabled !== false ? '🔊 Enabled' : '🔇 Muted'}
                        </Button>
                      </div>

                      {/* OM-A880 POS health & status */}
                      <PosKioskHealthPanel
                        kioskId={kiosk.id}
                        status={posStatus[kiosk.id] || null}
                        fallbackTerminalLabel={kiosk.configuration?.nbo_pos?.terminal_label}
                      />
                    </div>

                    <div className="flex gap-2">
                      {kiosk.status === 'pending_approval' && (
                        <Button size="sm" variant="default"
                          onClick={async () => {
                            await supabase.from('kiosks').update({ status: 'active' }).eq('id', kiosk.id);
                            toast.success("Kiosk approved and activated");
                            loadKiosks();
                          }}
                          className="bg-success hover:bg-success/90"
                        >
                          Approve
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(kiosk)}><Edit className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(kiosk.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
