import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CategoryInfoDialogProps {
  title: string;
  description: string;
  infoText?: string;
}

export const CategoryInfoDialog = ({ title, description, infoText }: CategoryInfoDialogProps) => {
  const content = infoText || description;
  
  if (!content) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-emerald-100/70 hover:bg-emerald-200/70 z-10 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-4 h-4 text-emerald-700" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white/70 backdrop-blur-sm border-0 shadow-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-right font-bold text-gray-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="text-right text-gray-800 leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
};
