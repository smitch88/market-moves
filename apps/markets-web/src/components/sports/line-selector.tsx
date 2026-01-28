"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@vault/ui/lib/utils";

interface LineSelectorProps {
  lines: number[];
  activeLine: number;
  onLineChange: (line: number) => void;
  className?: string;
}

export function LineSelector({
  lines,
  activeLine,
  onLineChange,
  className,
}: LineSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    // Center the active line on mount
    const activeIndex = lines.indexOf(activeLine);
    if (activeIndex > 0 && scrollRef.current) {
      const lineWidth = 56;
      const scrollTo = activeIndex * lineWidth - scrollRef.current.clientWidth / 2 + lineWidth / 2;
      scrollRef.current.scrollTo({ left: Math.max(0, scrollTo), behavior: "smooth" });
    }
  }, [lines, activeLine]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 100;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (lines.length <= 1) return null;

  return (
    <div className={cn("relative flex items-center gap-1 mt-4 pt-4 border-t border-border/30", className)}>
      {/* Left arrow */}
      <button
        onClick={() => scroll("left")}
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all",
          canScrollLeft
            ? "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
            : "text-muted-foreground/20 cursor-default"
        )}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Scrollable lines */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex-1 overflow-x-auto scrollbar-hide"
      >
        <div className="flex items-center justify-center gap-1.5 min-w-max px-2">
          {lines.map((line) => {
            const isActive = line === activeLine;
            return (
              <motion.button
                key={line}
                onClick={() => onLineChange(line)}
                className={cn(
                  "relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeLineIndicator"
                    className="absolute inset-0 bg-primary/10 border border-primary/30 rounded-lg"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 tabular-nums">{line}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scroll("right")}
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all",
          canScrollRight
            ? "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
            : "text-muted-foreground/20 cursor-default"
        )}
        disabled={!canScrollRight}
        aria-label="Scroll right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
