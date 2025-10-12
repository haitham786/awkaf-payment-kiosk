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
  if (!description && !infoText) return null;
  
  const content = infoText || description;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/50"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-4 h-4 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-2 border-primary/30 shadow-neon max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-right font-bold text-primary">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="text-right text-foreground leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
};
