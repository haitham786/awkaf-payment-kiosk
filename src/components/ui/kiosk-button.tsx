import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { soundManager } from "@/utils/soundEffects";

const kioskButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 kiosk-button relative",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-primary-foreground shadow-elegant hover:shadow-neon border border-primary/50",
        secondary: "bg-gradient-gold text-secondary-foreground shadow-card hover:shadow-elegant border border-secondary/50",
        success: "bg-success text-success-foreground shadow-card hover:shadow-elegant border border-success/50",
        destructive: "bg-destructive text-destructive-foreground shadow-card hover:shadow-elegant border border-destructive/50",
        outline: "border-2 border-primary/60 bg-card/20 backdrop-blur-sm text-foreground hover:bg-primary/10 hover:border-primary hover:shadow-elegant",
        ghost: "hover:bg-primary/20 hover:text-primary hover:shadow-card",
        link: "text-primary underline-offset-4 hover:underline",
        donation: "bg-gradient-card backdrop-blur-sm border-2 border-primary/40 text-foreground shadow-card hover:border-primary hover:shadow-elegant hover:scale-105 transform-3d min-h-[120px] p-6 text-lg font-bold",
        keypad: "bg-card/40 backdrop-blur-md border-2 border-primary/40 text-foreground shadow-card hover:bg-primary/10 hover:border-primary hover:shadow-elegant hover:text-primary min-h-[80px] text-2xl font-bold",
        confirm: "bg-gradient-neon text-primary-foreground shadow-neon hover:shadow-elegant min-h-[60px] text-xl font-bold animate-glow border-2 border-primary/70",
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
  soundEffect?: 'keypad' | 'navigation' | 'category';
}

const KioskButton = React.forwardRef<HTMLButtonElement, KioskButtonProps>(
  ({ className, variant, size, asChild = false, soundEffect, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const [isGlowing, setIsGlowing] = React.useState(false);
    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Play sound based on variant if not explicitly set
      let sound: 'keypad' | 'navigation' | 'category' | undefined = soundEffect;
      if (!sound) {
        if (variant === 'keypad') {
          sound = 'keypad';
        } else if (variant === 'donation') {
          sound = 'category';
        } else {
          sound = 'navigation';
        }
      }
      
      if (sound && soundManager.isReady()) {
        soundManager.play(sound);
      }

      // Haptic feedback for Android
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      // Trigger glow effect (longer duration, more visible)
      setIsGlowing(true);
      setTimeout(() => setIsGlowing(false), 600);

      // Create ripple effect at click position
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = Date.now();
        
        setRipples(prev => [...prev, { id, x, y }]);
        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== id));
        }, 600);
      }

      // Call original onClick
      onClick?.(e);
    };

    // Merge refs
    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement);

    // Get glow color based on variant
    const getGlowColor = () => {
      if (variant === 'donation' || variant === 'confirm') return 'button-glow-emerald';
      if (variant === 'keypad') return 'button-glow-blue';
      if (variant === 'secondary') return 'button-glow-gold';
      if (variant === 'default') return 'button-glow-emerald';
      return 'button-glow-blue'; // fallback for outline, ghost, etc.
    };

    return (
      <Comp
        className={cn(
          kioskButtonVariants({ variant, size, className }),
          isGlowing && getGlowColor(),
          "relative overflow-hidden"
        )}
        ref={buttonRef}
        onClick={handleClick}
        {...props}
      >
        {props.children}
        
        {/* Ripple effects */}
        {ripples.map(ripple => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/40 pointer-events-none animate-ripple"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: '10px',
              height: '10px',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </Comp>
    );
  }
);
KioskButton.displayName = "KioskButton";

export { KioskButton, kioskButtonVariants };