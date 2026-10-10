import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Royal Premium - Glossy Green với Metallic Gold Border
        default: "bg-gradient-to-b from-primary via-primary to-primary-dark text-gold-light font-semibold rounded-full border-[2px] border-gold shadow-[inset_0_1px_0_hsl(var(--card) / 0.2),inset_0_-1px_0_hsl(var(--foreground) / 0.15),0_0_8px_hsl(var(--gold) / 0.4),0_2px_4px_hsl(var(--foreground) / 0.2)] hover:from-primary-hover hover:via-primary-hover hover:to-primary-dark hover:shadow-[inset_0_1px_0_hsl(var(--card) / 0.25),0_0_12px_hsl(var(--gold) / 0.5),0_3px_6px_hsl(var(--foreground) / 0.25)] hover:scale-[1.02] duration-300",
        destructive: "bg-gradient-to-b from-destructive via-destructive to-destructive text-primary-foreground font-semibold rounded-full border-[2px] border-gold/50 shadow-[inset_0_1px_0_hsl(var(--card) / 0.15)] hover:from-destructive hover:via-destructive hover:to-destructive duration-300",
        outline: "bg-transparent text-gold font-semibold rounded-full border-[2px] border-gold shadow-[0_0_6px_hsl(var(--gold) / 0.3)] hover:bg-primary/20 hover:text-gold-line hover:shadow-[0_0_10px_hsl(var(--gold) / 0.5)] duration-300",
        secondary: "bg-gradient-to-b from-secondary to-secondary text-primary font-semibold rounded-full border-[2px] border-gold/60 shadow-[0_0_4px_hsl(var(--gold) / 0.2)] hover:border-gold hover:shadow-[0_0_8px_hsl(var(--gold) / 0.4)] duration-300",
        ghost: "text-gold rounded-full hover:bg-primary/15 hover:text-gold-line border-[2px] border-transparent hover:border-gold/40 duration-300",
        link: "text-gold underline-offset-4 hover:underline hover:text-gold-line rounded-full",
        premium: "bg-gradient-to-b from-primary via-primary to-primary-dark text-gold-line font-bold rounded-full border-[2px] border-gold shadow-[inset_0_2px_0_hsl(var(--card) / 0.25),inset_0_-2px_0_hsl(var(--foreground) / 0.2),0_0_12px_hsl(var(--gold) / 0.5),0_3px_8px_hsl(var(--foreground) / 0.3)] hover:from-primary-hover hover:via-primary-hover hover:to-primary-dark hover:shadow-[inset_0_2px_0_hsl(var(--card) / 0.3),0_0_16px_hsl(var(--gold) / 0.6),0_4px_12px_hsl(var(--foreground) / 0.35)] hover:scale-[1.03] duration-300",
        light: "bg-gradient-to-b from-primary via-primary to-primary-dark text-gold-light font-semibold rounded-full border-[1.5px] border-gold/70 shadow-[inset_0_1px_0_hsl(var(--card) / 0.15),0_0_6px_hsl(var(--gold) / 0.3)] hover:border-gold hover:shadow-[inset_0_1px_0_hsl(var(--card) / 0.2),0_0_10px_hsl(var(--gold) / 0.5)] duration-300",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-12 px-8",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
