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
          className="absolute top-1 right-4 w-7 h-7 rounded-full hover:bg-white/20 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-5 h-5 text-gray-700" />
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
