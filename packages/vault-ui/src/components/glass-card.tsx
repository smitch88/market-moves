import * as React from "react";
import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const glassCardVariants = cva(
  "relative overflow-hidden rounded-lg border transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-white/5 backdrop-blur-md border-white/10 shadow-xl",
        elevated:
          "bg-white/10 backdrop-blur-lg border-white/15 shadow-2xl",
        subtle:
          "bg-white/[0.02] backdrop-blur-sm border-white/5 shadow-lg",
      },
      hover: {
        true: "hover:bg-white/10 hover:border-white/20 hover:shadow-2xl cursor-pointer",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      hover: false,
    },
  }
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, hover, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(glassCardVariants({ variant, hover, className }))}
        {...props}
      >
        {/* Gradient sheen effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
GlassCardHeader.displayName = "GlassCardHeader";

const GlassCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
GlassCardTitle.displayName = "GlassCardTitle";

const GlassCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
GlassCardDescription.displayName = "GlassCardDescription";

const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
GlassCardContent.displayName = "GlassCardContent";

const GlassCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
GlassCardFooter.displayName = "GlassCardFooter";

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
  glassCardVariants,
};
