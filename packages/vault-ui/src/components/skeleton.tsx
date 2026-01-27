import { cn } from "../lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md",
        // Base colors - subtle and theme-aware
        "bg-muted/50 dark:bg-white/[0.06]",
        // Shimmer animation
        "relative overflow-hidden",
        "before:absolute before:inset-0",
        "before:translate-x-[-100%]",
        "before:animate-shimmer",
        "before:bg-gradient-to-r",
        "before:from-transparent before:via-white/10 before:to-transparent",
        "dark:before:via-white/[0.07]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
