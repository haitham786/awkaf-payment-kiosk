import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Edit, Upload, X, Smartphone, CreditCard, Globe, FlaskConical } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type SoftPosMode = 'test' | 'live';
type PaymentMode = 'soft_pos' | 'payment_gateway' | 'test_payment' | 'hardware_pos';
type ReceiptChannel = 'sms' | 'whatsapp' | 'both';

interface KioskConfiguration {
  payment_mode: PaymentMode;
  soft_pos?: {
    auth_key: string;
    is_production: boolean;
    mode: SoftPosMode;
  };
  payment_gateway?: {
    mode: 'test' | 'live';
  };
  hardware_pos?: {
    tid: string;
    mid: string;
    service_url: string;
    secure_key: string;
    currency_code: string;
    environment: 'uat' | 'production';
    timeout_seconds: number;
    soap_version?: '1.1' | '1.2';
    tem_namespace?: string;
    data_namespace?: string;
    contract_name?: string;
  };
  test_payment?: {
    auto_approve?: boolean;
  };
  sound_enabled?: boolean;
  receipt_channel?: ReceiptChannel;
}

const emptyHardwarePos = () => ({
  tid: '',
  mid: '',
  service_url: '',
  secure_key: '',
  currency_code: '512',
  environment: 'uat' as 'uat' | 'production',
  timeout_seconds: 90,
  soap_version: '1.1' as '1.1' | '1.2',
  tem_namespace: '',
  data_namespace: '',
  contract_name: '',
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
      payment_mode: 'soft_pos' as PaymentMode,
      soft_pos: { auth_key: '', is_production: false, mode: 'test' as SoftPosMode },
      payment_gateway: { mode: 'test' as 'test' | 'live' },
      hardware_pos: emptyHardwarePos(),
      sound_enabled: true,
      receipt_channel: 'sms' as ReceiptChannel,
    } as KioskConfiguration
  });
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [logoImage, setLogoImage] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [verifyingTerminal, setVerifyingTerminal] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);


  const separateKioskSecret = (configuration: KioskConfiguration) => {
    const { soft_pos, hardware_pos, ...restConfig } = configuration;
    const authKey = soft_pos?.auth_key?.trim() || '';
    const apexSecureKey = hardware_pos?.secure_key?.trim() || '';

    return {
      publicConfig: {
        ...restConfig,
        soft_pos: soft_pos
          ? {
              is_production: soft_pos.is_production,
              mode: soft_pos.mode,
            }
          : undefined,
        hardware_pos: hardware_pos
          ? {
              tid: hardware_pos.tid?.trim() || '',
              mid: hardware_pos.mid?.trim() || '',
              service_url: hardware_pos.service_url?.trim() || '',
              currency_code: hardware_pos.currency_code?.trim() || '512',
              environment: hardware_pos.environment || 'uat',
              timeout_seconds: Number(hardware_pos.timeout_seconds) > 0 ? Number(hardware_pos.timeout_seconds) : 90,
              soap_version: hardware_pos.soap_version === '1.2' ? '1.2' : '1.1',
              tem_namespace: hardware_pos.tem_namespace?.trim() || '',
              data_namespace: hardware_pos.data_namespace?.trim() || '',
              contract_name: hardware_pos.contract_name?.trim() || '',
            }
          : undefined,
      },
      authKey,
      apexSecureKey,
    };
  };

  const saveKioskSecret = async (kioskId: string, authKey: string, apexSecureKey = '') => {
    const { error } = await supabase
      .from('kiosk_secrets')
      .upsert(
        { kiosk_id: kioskId, soft_pos_auth_key: authKey, apex_secure_key: apexSecureKey },
        { onConflict: 'kiosk_id' },
      );
    if (error) throw error;
  };

  useEffect(() => {
    checkAuth();
    loadKiosks();
    loadBackgroundImage();
    loadLogoImage();

    const channel = supabase
      .channel('kiosks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosks' }, () => { loadKiosks(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/auth'); return; }
  };

  const loadKiosks = async () => {
    try {
      const { data, error } = await supabase.from('kiosks').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const kioskIds = (data || []).map((kiosk) => kiosk.id);
      const { data: secrets, error: secretsError } = kioskIds.length > 0
        ? await supabase.from('kiosk_secrets').select('kiosk_id, soft_pos_auth_key, apex_secure_key').in('kiosk_id', kioskIds)
        : { data: [], error: null };
      if (secretsError) throw secretsError;
      const secretsByKiosk = new Map((secrets || []).map((secret) => [secret.kiosk_id, secret]));
      const mergedKiosks = (data || []).map((kiosk) => {
        const config = kiosk.configuration && typeof kiosk.configuration === 'object' ? kiosk.configuration as Record<string, any> : {};
        const softPos = config.soft_pos && typeof config.soft_pos === 'object' ? config.soft_pos as Record<string, any> : {};
        const hardwarePos = config.hardware_pos && typeof config.hardware_pos === 'object' ? config.hardware_pos as Record<string, any> : {};
        const secret = secretsByKiosk.get(kiosk.id) as { soft_pos_auth_key?: string; apex_secure_key?: string } | undefined;
        return {
          ...kiosk,
          configuration: {
            ...config,
            soft_pos: {
              ...softPos,
              auth_key: secret?.soft_pos_auth_key || '',
            },
            hardware_pos: {
              ...emptyHardwarePos(),
              ...hardwarePos,
              secure_key: secret?.apex_secure_key || '',
            },
          },
        };
      });
      setKiosks(mergedKiosks);
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

  const findTerminalConflict = (tid: string, excludeId: string | null) => {
    const target = tid.trim();
    if (!target) return null;
    return (
      kiosks.find((kiosk) => {
        if (excludeId && kiosk.id === excludeId) return false;
        const config = kiosk.configuration || {};
        if (config.payment_mode !== 'hardware_pos') return false;
        return String(config.hardware_pos?.tid || '').trim() === target;
      }) || null
    );
  };

  const handleVerifyTerminal = async () => {
    const hardware = formData.configuration.hardware_pos;
    if (!editingId) {
      toast.error('Save the kiosk first, then verify its terminal.');
      return;
    }
    if (!hardware?.tid?.trim() || !hardware?.mid?.trim()) {
      toast.error('Enter both MID and TID before verifying.');
      return;
    }
    setVerifyingTerminal(true);
    try {
      const { data, error } = await supabase.functions.invoke('apex-ecr-payment', {
        body: { action: 'enquiry', kioskId: editingId, transactionId: crypto.randomUUID() },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Terminal ${hardware.tid} responded${data.responseText ? `: ${data.responseText}` : ''}`);
      } else {
        toast.error(data?.error || 'The terminal did not confirm this TID/MID pair.');
      }
    } catch (error: any) {
      toast.error(`Terminal verification failed: ${error.message}`);
    } finally {
      setVerifyingTerminal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const referenceNumber = normalizeReferenceNumber(formData.reference_number);
      const { publicConfig, authKey, apexSecureKey } = separateKioskSecret(formData.configuration);

      if (formData.configuration.payment_mode === 'hardware_pos') {
        const tid = formData.configuration.hardware_pos?.tid?.trim() || '';
        if (!tid) {
          setValidationError('A Terminal ID (TID) is required so this kiosk is paired with its own POS terminal.');
          toast.error('Terminal ID (TID) is required for Hardware POS kiosks.');
          return;
        }
        const conflict = findTerminalConflict(tid, editingId);
        if (conflict) {
          const message = `Terminal ID ${tid} is already paired with "${conflict.name}". Each kiosk must use its own terminal.`;
          setValidationError(message);
          toast.error(message);
          return;
        }
      }


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
        await saveKioskSecret(editingId, authKey, apexSecureKey);
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

        const { data: createdKiosk, error } = await supabase.from('kiosks').insert([{
          name: formData.name, reference_number: referenceNumber,
          location: formData.location, status: formData.status,
          configuration: publicConfig
        } as any]).select('id').single();
        if (error) throw error;
        if (createdKiosk?.id) await saveKioskSecret(createdKiosk.id, authKey, apexSecureKey);
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
        payment_mode: config.payment_mode || 'soft_pos',
        soft_pos: config.soft_pos || { auth_key: '', is_production: false, mode: 'test' },
        payment_gateway: config.payment_gateway || { mode: 'test' },
        hardware_pos: { ...emptyHardwarePos(), ...(config.hardware_pos || {}) },
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
        payment_mode: 'soft_pos',
        soft_pos: { auth_key: '', is_production: false, mode: 'test' },
        payment_gateway: { mode: 'test' },
        hardware_pos: emptyHardwarePos(),
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

  const getPaymentModeLabel = (kiosk: any) => {
    const paymentMode = kiosk.configuration?.payment_mode;
    if (paymentMode === 'payment_gateway') return 'Payment Gateway (Thawani)';
    if (paymentMode === 'hardware_pos') return 'Hardware POS Terminal (ApexECR)';
    if (paymentMode === 'test_payment') return 'Testing Mode (Simulated Success)';
    return 'Soft POS (Thawani Lamsa)';
  };

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
                    <RadioGroupItem value="soft_pos" id="soft_pos" />
                    <Label htmlFor="soft_pos" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Smartphone className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Soft POS (Thawani Lamsa)</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="payment_gateway" id="payment_gateway" />
                    <Label htmlFor="payment_gateway" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Globe className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Payment Gateway (Thawani Checkout)</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="hardware_pos" id="hardware_pos" />
                    <Label htmlFor="hardware_pos" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Hardware POS Terminal (ApexECR / AFS)</p>
                        <p className="text-xs text-muted-foreground">External EFTPOS terminal over the internet</p>
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

              {/* Soft POS (Thawani Lamsa) Configuration */}
              {formData.configuration.payment_mode === 'soft_pos' && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Thawani Lamsa Soft POS Configuration
                  </h4>

                  <div>
                    <Label htmlFor="auth_key">Auth Key (Touchpoint Key)</Label>
                    <Input id="auth_key" type="password"
                      value={formData.configuration.soft_pos?.auth_key || ''}
                      onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, soft_pos: { ...formData.configuration.soft_pos!, auth_key: e.target.value } } })}
                      placeholder="Enter any value for trial, real key for live"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Trial: any value is accepted so you can verify NFC card detection. A real touchpoint key from merchant.thawani.om is required for live card charging.
                    </p>
                  </div>

                  <div>
                    <Label>Soft POS Mode</Label>
                    <RadioGroup
                      value={formData.configuration.soft_pos?.mode || 'test'}
                      onValueChange={(value: SoftPosMode) => setFormData({ ...formData, configuration: { ...formData.configuration, soft_pos: { ...formData.configuration.soft_pos!, mode: value } } })}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="test" id="mode_test" />
                        <Label htmlFor="mode_test" className="cursor-pointer">Test Mode</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="live" id="mode_live" />
                        <Label htmlFor="mode_live" className="cursor-pointer">Live Mode</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label>Environment</Label>
                    <RadioGroup
                      value={formData.configuration.soft_pos?.is_production ? 'production' : 'staging'}
                      onValueChange={(value: string) => setFormData({ ...formData, configuration: { ...formData.configuration, soft_pos: { ...formData.configuration.soft_pos!, is_production: value === 'production' } } })}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="staging" id="env_staging" />
                        <Label htmlFor="env_staging" className="cursor-pointer">Staging</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="production" id="env_production" />
                        <Label htmlFor="env_production" className="cursor-pointer">Production</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}

              {/* Payment Gateway Configuration */}
              {formData.configuration.payment_mode === 'payment_gateway' && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Thawani Payment Gateway Configuration
                  </h4>

                  <div>
                    <Label>Gateway Mode</Label>
                    <RadioGroup
                      value={formData.configuration.payment_gateway?.mode || 'test'}
                      onValueChange={(value: 'test' | 'live') => setFormData({ ...formData, configuration: { ...formData.configuration, payment_gateway: { mode: value } } })}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="test" id="gw_test" />
                        <Label htmlFor="gw_test" className="cursor-pointer">Test Mode (UAT)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="live" id="gw_live" />
                        <Label htmlFor="gw_live" className="cursor-pointer">Live Mode</Label>
                      </div>
                    </RadioGroup>
                  </div>

                </div>
              )}

              {/* Hardware POS (ApexECR) Configuration */}
              {formData.configuration.payment_mode === 'hardware_pos' && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Hardware POS Terminal (ApexECR) Configuration
                  </h4>

                  <div>
                    <Label htmlFor="apex_service_url">ApexECR Service URL</Label>
                    <Input
                      id="apex_service_url"
                      value={formData.configuration.hardware_pos?.service_url || ''}
                      onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, hardware_pos: { ...emptyHardwarePos(), ...formData.configuration.hardware_pos!, service_url: e.target.value } } })}
                      placeholder="https://.../ApexEcrService.svc"
                    />
                    <p className="text-xs text-muted-foreground mt-1">HTTPS endpoint supplied by AFS / Ahli Bank.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="apex_mid">Merchant ID (MID)</Label>
                      <Input
                        id="apex_mid"
                        value={formData.configuration.hardware_pos?.mid || ''}
                        onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, hardware_pos: { ...emptyHardwarePos(), ...formData.configuration.hardware_pos!, mid: e.target.value } } })}
                        placeholder="MID"
                      />
                    </div>
                    <div>
                      <Label htmlFor="apex_tid">Terminal ID (TID)</Label>
                      <Input
                        id="apex_tid"
                        value={formData.configuration.hardware_pos?.tid || ''}
                        onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, hardware_pos: { ...emptyHardwarePos(), ...formData.configuration.hardware_pos!, tid: e.target.value } } })}
                        placeholder="TID"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="apex_secure_key">Merchant Secure Key</Label>
                    <Input
                      id="apex_secure_key"
                      type="password"
                      value={formData.configuration.hardware_pos?.secure_key || ''}
                      onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, hardware_pos: { ...emptyHardwarePos(), ...formData.configuration.hardware_pos!, secure_key: e.target.value } } })}
                      placeholder="Stored privately, never sent to the kiosk"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="apex_currency">Currency Code (ISO numeric)</Label>
                      <Input
                        id="apex_currency"
                        value={formData.configuration.hardware_pos?.currency_code || '512'}
                        onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, hardware_pos: { ...emptyHardwarePos(), ...formData.configuration.hardware_pos!, currency_code: e.target.value } } })}
                        placeholder="512"
                      />
                      <p className="text-xs text-muted-foreground mt-1">OMR = 512</p>
                    </div>
                    <div>
                      <Label htmlFor="apex_timeout">Card Tap Timeout (seconds)</Label>
                      <Input
                        id="apex_timeout"
                        type="number"
                        min={15}
                        max={300}
                        value={formData.configuration.hardware_pos?.timeout_seconds ?? 90}
                        onChange={(e) => setFormData({ ...formData, configuration: { ...formData.configuration, hardware_pos: { ...emptyHardwarePos(), ...formData.configuration.hardware_pos!, timeout_seconds: Number(e.target.value) } } })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Environment</Label>
                    <RadioGroup
                      value={formData.configuration.hardware_pos?.environment || 'uat'}
                      onValueChange={(value: 'uat' | 'production') => setFormData({ ...formData, configuration: { ...formData.configuration, hardware_pos: { ...emptyHardwarePos(), ...formData.configuration.hardware_pos!, environment: value } } })}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="uat" id="apex_uat" />
                        <Label htmlFor="apex_uat" className="cursor-pointer">UAT</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="production" id="apex_prod" />
                        <Label htmlFor="apex_prod" className="cursor-pointer">Production</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      This kiosk is paired 1:1 with the terminal registered under this TID. A terminal ID can
                      only be assigned to one kiosk, so a sale can never reach another kiosk's terminal.
                    </p>
                    {(() => {
                      const tid = formData.configuration.hardware_pos?.tid?.trim() || '';
                      const conflict = findTerminalConflict(tid, editingId);
                      return conflict ? (
                        <p className="text-xs font-medium text-destructive">
                          Terminal ID {tid} is already paired with "{conflict.name}".
                        </p>
                      ) : null;
                    })()}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleVerifyTerminal}
                      disabled={verifyingTerminal}
                    >
                      {verifyingTerminal ? 'Verifying terminal…' : 'Verify Terminal'}
                    </Button>
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
                        {kiosk.configuration?.payment_mode === 'payment_gateway' ? (
                          <Globe className="w-3 h-3 text-blue-600" />
                        ) : (
                          <Smartphone className="w-3 h-3 text-emerald-600" />
                        )}
                        <p className="text-xs text-muted-foreground">{getPaymentModeLabel(kiosk)}</p>
                      </div>
                      {/* Paired terminal */}
                      {kiosk.configuration?.payment_mode === 'hardware_pos' && (() => {
                        const tid = String(kiosk.configuration?.hardware_pos?.tid || '').trim();
                        const conflict = findTerminalConflict(tid, kiosk.id);
                        return (
                          <div className="mt-2 text-xs">
                            <span className="text-muted-foreground">Paired terminal: </span>
                            {tid ? (
                              <span className={conflict ? 'text-destructive font-medium' : 'font-medium'}>
                                TID {tid}
                                {kiosk.configuration?.hardware_pos?.mid ? ` · MID ${kiosk.configuration.hardware_pos.mid}` : ''}
                                {kiosk.configuration?.hardware_pos?.environment ? ` · ${kiosk.configuration.hardware_pos.environment.toUpperCase()}` : ''}
                                {conflict ? ` — also used by "${conflict.name}"` : ''}
                              </span>
                            ) : (
                              <span className="text-destructive font-medium">Not configured</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Sound */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Sound Effects:</span>
                        <Button
                          size="sm"
                          variant={kiosk.configuration?.sound_enabled !== false ? "default" : "outline"}
                          onClick={async () => {
                            const currentSoundEnabled = kiosk.configuration?.sound_enabled !== false;
                            const { publicConfig } = separateKioskSecret({ ...kiosk.configuration, sound_enabled: !currentSoundEnabled });
                            await supabase.from('kiosks').update({ configuration: publicConfig }).eq('id', kiosk.id);
                            toast.success(`Sound ${!currentSoundEnabled ? 'enabled' : 'muted'} for ${kiosk.name}`);
                            loadKiosks();
                          }}
                          className="h-6 text-xs px-2"
                        >
                          {kiosk.configuration?.sound_enabled !== false ? '🔊 Enabled' : '🔇 Muted'}
                        </Button>
                      </div>
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
