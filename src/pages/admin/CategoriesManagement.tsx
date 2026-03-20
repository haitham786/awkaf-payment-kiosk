import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Edit, Eye, EyeOff, Info, Upload, X, GripVertical } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableCategory } from "@/components/admin/SortableCategory";

const CategoriesManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category_id: '',
    title: '',
    title_en: '',
    description: '',
    is_visible: true,
    icon_url: '',
    category_reference: ''
  });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>('');
  const [quranicVerse, setQuranicVerse] = useState<string>('');
  const [savingVerse, setSavingVerse] = useState(false);

  useEffect(() => {
    checkAuth();
    loadCategories();
    loadQuranicVerse();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('donation_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading categories",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQuranicVerse = async () => {
    try {
      const { data, error } = await supabase
        .from('kiosk_settings')
        .select('quranic_verse')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setQuranicVerse(data?.quranic_verse || 'وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ');
    } catch (error: any) {
      toast({
        title: "Error loading Quranic verse",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveQuranicVerse = async () => {
    setSavingVerse(true);
    try {
      const { error } = await supabase
        .from('kiosk_settings')
        .update({ quranic_verse: quranicVerse })
        .eq('id', (await supabase.from('kiosk_settings').select('id').limit(1).single()).data?.id);

      if (error) throw error;
      toast({ title: "Quranic verse updated successfully" });
    } catch (error: any) {
      toast({
        title: "Error saving Quranic verse",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingVerse(false);
    }
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 100KB)
    if (file.size > 100 * 1024) {
      toast({
        title: "File too large",
        description: "Icon must be less than 100KB",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only JPG, JPEG, and PNG files are allowed",
        variant: "destructive",
      });
      return;
    }

    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (categories.length >= 8 && !editingId) {
      toast({
        title: "Maximum categories reached",
        description: "You can only have up to 8 categories.",
        variant: "destructive",
      });
      return;
    }

    try {
      let iconUrl = formData.icon_url;

      // Upload icon if a new file is selected
      if (iconFile) {
        const fileName = `${formData.category_id}-${Date.now()}.${iconFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage
          .from('category-icons')
          .upload(fileName, iconFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('category-icons')
          .getPublicUrl(fileName);

        iconUrl = publicUrl;
      }

      const dataToSave = { ...formData, icon_url: iconUrl };

      if (editingId) {
        const { error } = await supabase
          .from('donation_categories')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: "Category updated successfully" });
      } else {
        const { error } = await supabase
          .from('donation_categories')
          .insert([dataToSave] as any);

        if (error) throw error;
        toast({ title: "Category added successfully" });
      }

      resetForm();
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Error saving category",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (category: any) => {
    setEditingId(category.id);
    setFormData({
      category_id: category.category_id,
      title: category.title,
      title_en: category.title_en || '',
      description: category.description,
      is_visible: category.is_visible,
      icon_url: category.icon_url || '',
      category_reference: category.category_reference || ''
    });
    setIconPreview(category.icon_url || '');
    setIconFile(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const { error } = await supabase
        .from('donation_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Category deleted successfully" });
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Error deleting category",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleVisibility = async (id: string, currentVisibility: boolean) => {
    try {
      const { error } = await supabase
        .from('donation_categories')
        .update({ is_visible: !currentVisibility })
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Visibility updated" });
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Error updating visibility",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);

    const updatedCategories = arrayMove(categories, oldIndex, newIndex);

    // Optimistically update UI
    setCategories(updatedCategories);

    // Update database with new order
    try {
      const updates = updatedCategories.map((cat, index) => ({
        id: cat.id,
        display_order: index + 1
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('donation_categories')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({ title: "Category order updated successfully" });
    } catch (error: any) {
      toast({
        title: "Error updating category order",
        description: error.message,
        variant: "destructive",
      });
      // Reload categories on error to restore correct order
      loadCategories();
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      category_id: '',
      title: '',
      title_en: '',
      description: '',
      is_visible: true,
      icon_url: '',
      category_reference: ''
    });
    setIconFile(null);
    setIconPreview('');
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold">Manage Categories</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Quranic Verse Settings */}
          <Card className="p-6 md:col-span-2">
            <h2 className="text-xl font-bold mb-4">Quranic Verse Settings</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This verse appears at the top of the kiosk homepage
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="quranic_verse">Quranic Verse (Arabic)</Label>
                <Textarea
                  id="quranic_verse"
                  value={quranicVerse}
                  onChange={(e) => setQuranicVerse(e.target.value)}
                  placeholder="الآية القرآنية التي تظهر في الصفحة الرئيسية"
                  rows={3}
                  className="text-right"
                />
              </div>
              <Button 
                onClick={saveQuranicVerse}
                disabled={savingVerse}
              >
                {savingVerse ? 'Saving...' : 'Save Quranic Verse'}
              </Button>
            </div>
          </Card>

          {/* Form */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Edit Category' : 'Add New Category'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="category_id">Category ID (English)</Label>
                <Input
                  id="category_id"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                  disabled={!!editingId}
                  placeholder="e.g., zakat, sadaqah"
                />
              </div>

              <div>
                <Label htmlFor="category_reference">Category Reference (for reports)</Label>
                <Input
                  id="category_reference"
                  value={formData.category_reference}
                  onChange={(e) => setFormData({ ...formData, category_reference: e.target.value })}
                  placeholder="e.g., ZKT-001, SDQ-002"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Enter a unique reference code (appears in reports and CSV exports)
                </p>
              </div>

              <div>
                <Label htmlFor="title">Title (Arabic)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="عنوان الفئة"
                />
              </div>

              <div>
                <Label htmlFor="description">Description (Arabic)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  placeholder="وصف الفئة"
                />
              </div>

              <div>
                <Label htmlFor="icon">Category Icon</Label>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => iconInputRef.current?.click()}
                    className="w-full mb-2"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Icon
                  </Button>
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleIconChange}
                    className="hidden"
                  />
                  <p className="text-sm text-muted-foreground">
                    Only JPG, JPEG, and PNG files. Maximum size: 100 KB
                  </p>
                </div>
                {iconPreview && (
                  <div className="mt-2 relative w-24 h-24">
                    <img 
                      src={iconPreview} 
                      alt="Icon preview" 
                      className="w-full h-full object-cover rounded-lg border-2 border-border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={() => {
                        setIconFile(null);
                        setIconPreview('');
                        setFormData({ ...formData, icon_url: '' });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_visible"
                  checked={formData.is_visible}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
                />
                <Label htmlFor="is_visible">Visible to public</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingId ? 'Update' : 'Add'} Category
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* Categories List */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">
              Existing Categories ({categories.length}/8)
            </h2>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={categories.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {categories.map((category) => (
                    <SortableCategory
                      key={category.id}
                      category={category}
                      onToggleVisibility={toggleVisibility}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoriesManagement;