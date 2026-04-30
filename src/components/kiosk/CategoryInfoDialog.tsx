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
          className="w-7 h-7 rounded-full hover:bg-white/20"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-5 h-5 text-gray-700" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white/80 backdrop-blur-md border-0 shadow-xl max-w-xs mx-4 rounded-2xl [&>button]:bg-transparent [&>button]:border-0 [&>button]:ring-0 [&>button]:shadow-none [&>button]:outline-none [&>button]:focus:ring-0 [&>button]:focus:ring-offset-0 [&>button]:p-0">
        <DialogHeader>
          <DialogTitle className="text-xl text-right font-bold text-gray-900 pl-10">
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
