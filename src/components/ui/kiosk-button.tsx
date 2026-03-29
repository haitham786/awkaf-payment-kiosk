import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { soundManager } from "@/utils/soundEffects";

const kioskButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 kiosk-button relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "liquid-glass text-foreground hover:bg-white/30",
        secondary: "liquid-glass-tinted text-foreground hover:bg-white/30",
        success: "liquid-glass text-foreground border-emerald-300/40 hover:bg-emerald-50/20",
        destructive: "liquid-glass text-destructive border-red-300/40 hover:bg-red-50/20",
        outline: "liquid-glass text-foreground hover:bg-white/25",
        ghost: "bg-transparent hover:bg-white/15 hover:backdrop-blur-md border-transparent",
        link: "text-primary underline-offset-4 hover:underline bg-transparent border-transparent",
        donation: "liquid-glass-strong text-foreground hover:bg-white/35 hover:shadow-lg min-h-[120px] p-6 text-lg font-bold",
        keypad: "liquid-glass text-foreground hover:bg-white/30 hover:shadow-md min-h-[80px] text-2xl font-bold",
        confirm: "liquid-glass-strong bg-emerald-500/20 text-foreground border-emerald-400/50 hover:bg-emerald-500/30 hover:shadow-lg min-h-[60px] text-xl font-bold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-11 rounded-xl px-8",
        xl: "h-14 rounded-2xl px-12",
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

      // Trigger glow effect (0.2s duration)
      setIsGlowing(true);
      setTimeout(() => setIsGlowing(false), 200);

      // Create ripple effect at click position
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = Date.now();
        
        setRipples(prev => [...prev, { id, x, y }]);
        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== id));
        }, 200);
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
      return 'button-glow-effect';
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
            className="absolute rounded-full bg-white/30 pointer-events-none animate-ripple z-[3]"
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