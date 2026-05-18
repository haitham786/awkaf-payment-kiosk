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
  titleEn?: string | null;
  description: string;
  descriptionEn?: string | null;
  infoText?: string | null;
  infoTextEn?: string | null;
}

export const CategoryInfoDialog = ({
  title,
  titleEn,
  description,
  descriptionEn,
  infoText,
  infoTextEn,
}: CategoryInfoDialogProps) => {
  const contentAr = infoText || description;
  const contentEn = infoTextEn || descriptionEn;

  if (!contentAr && !contentEn) return null;

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
      <DialogContent className="bg-white/80 backdrop-blur-md border-0 shadow-xl max-w-xs mx-4 rounded-2xl pt-10 [&>button]:!left-5 [&>button]:!right-auto [&>button]:!top-5 [&>button]:!bg-transparent [&>button]:!border-0 [&>button]:!ring-0 [&>button]:!ring-offset-0 [&>button]:!shadow-none [&>button]:!outline-none [&>button]:hover:!bg-transparent [&>button]:focus:!ring-0 [&>button]:focus:!ring-offset-0 [&>button]:focus:!outline-none [&>button]:focus-visible:!ring-0 [&>button]:focus-visible:!ring-offset-0 [&>button]:focus-visible:!outline-none [&>button]:!p-0 [&>button]:!opacity-100 [&>button]:[-webkit-tap-highlight-color:transparent]">
        <DialogHeader>
          <DialogTitle className="text-xl text-right font-bold text-gray-900 pr-1 pt-1">
            {title}
          </DialogTitle>
        </DialogHeader>
        {contentAr && (
          <div className="text-right text-gray-800 leading-relaxed whitespace-pre-wrap mt-4">
            {contentAr}
          </div>
        )}
        {titleEn && (
          <div className="text-left text-base font-semibold text-gray-900 mt-3">
            {titleEn}
          </div>
        )}
        {contentEn && (
          <div className="text-left text-gray-700 leading-relaxed whitespace-pre-wrap mt-1 text-sm">
            {contentEn}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
