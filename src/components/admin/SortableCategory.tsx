import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff, Edit, Trash2 } from "lucide-react";

interface SortableCategoryProps {
  category: any;
  onToggleVisibility: (id: string, currentVisibility: boolean) => void;
  onEdit: (category: any) => void;
  onDelete: (id: string) => void;
}

export const SortableCategory = ({
  category,
  onToggleVisibility,
  onEdit,
  onDelete,
}: SortableCategoryProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="p-4">
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing hover:bg-accent p-1 rounded transition-colors touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Category icon */}
        {category.icon_url && (
          <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-border flex-shrink-0">
            <img
              src={category.icon_url}
              alt={category.title}
              className="w-full h-full object-contain bg-white"
            />
          </div>
        )}

        {/* Category details */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold">{category.title}</h3>
            {category.is_visible ? (
              <Eye className="w-4 h-4 text-success" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{category.description}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>Ref: {category.category_reference || 'N/A'}</span>
            <span>Order: {category.display_order}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleVisibility(category.id, category.is_visible)}
          >
            {category.is_visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(category)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(category.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
