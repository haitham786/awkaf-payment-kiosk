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
          className="absolute top-2 right-2 w-10 h-10 rounded-full bg-primary/30 hover:bg-primary/50 border-2 border-primary z-10 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-5 h-5 text-primary" />
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
