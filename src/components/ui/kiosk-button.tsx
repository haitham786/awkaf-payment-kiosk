import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const kioskButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 kiosk-button",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-primary-foreground shadow-elegant hover:shadow-gold",
        secondary: "bg-gradient-gold text-secondary-foreground shadow-card hover:shadow-elegant",
        success: "bg-success text-success-foreground shadow-card hover:shadow-elegant",
        destructive: "bg-destructive text-destructive-foreground shadow-card hover:shadow-elegant",
        outline: "border-2 border-primary bg-card/50 text-primary hover:bg-gradient-primary hover:text-primary-foreground",
        ghost: "hover:bg-primary/10 hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
        donation: "bg-gradient-card border-2 border-primary/20 text-foreground shadow-card hover:border-primary hover:shadow-elegant hover:bg-gradient-primary hover:text-primary-foreground min-h-[120px] p-6 text-lg font-semibold",
        keypad: "bg-gradient-card border border-primary/30 text-foreground shadow-card hover:bg-gradient-primary hover:text-primary-foreground min-h-[80px] text-2xl font-bold",
        confirm: "bg-gradient-primary text-primary-foreground shadow-elegant hover:shadow-gold min-h-[60px] text-xl font-bold animate-glow",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-14 rounded-lg px-12",
        icon: "h-10 w-10",
        kiosk: "h-16 px-8 text-lg",
        donation: "min-h-[120px] p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface KioskButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof kioskButtonVariants> {
  asChild?: boolean;
}

const KioskButton = React.forwardRef<HTMLButtonElement, KioskButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(kioskButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
KioskButton.displayName = "KioskButton";

export { KioskButton, kioskButtonVariants };