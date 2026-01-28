"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  // Prevent clicks from propagating to parent (e.g., expandable card)
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartIndex, setDragStartIndex] = useState(0);

  // Navigate to previous/next line
  const navigateToPrevious = () => {
    const currentIndex = lines.indexOf(activeLine);
    if (currentIndex > 0) {
      onLineChange(lines[currentIndex - 1]);
    }
  };

  const navigateToNext = () => {
    const currentIndex = lines.indexOf(activeLine);
    if (currentIndex < lines.length - 1) {
      onLineChange(lines[currentIndex + 1]);
    }
  };

  // Handle drag to select
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    
    setIsDragging(true);
    const currentIndex = lines.indexOf(activeLine);
    setDragStartIndex(currentIndex);
    
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setDragStartX(clientX);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - dragStartX;
    const threshold = 30; // pixels to move before changing selection

    const steps = Math.round(deltaX / threshold);
    const newIndex = Math.max(0, Math.min(lines.length - 1, dragStartIndex + steps));

    if (newIndex !== lines.indexOf(activeLine)) {
      onLineChange(lines[newIndex]);
    }
  }, [isDragging, dragStartX, dragStartIndex, lines, activeLine, onLineChange]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach drag listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove);
      window.addEventListener("touchend", handleDragEnd);

      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
        window.removeEventListener("touchmove", handleDragMove);
        window.removeEventListener("touchend", handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      navigateToPrevious();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      navigateToNext();
    }
  };

  if (lines.length <= 1) return null;

  const currentIndex = lines.indexOf(activeLine);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < lines.length - 1;

  return (
    <div
      className={cn("relative flex items-center gap-3 mt-3 pt-3 border-t border-border/20", className)}
      onKeyDown={handleKeyDown}
      onClick={handleContainerClick}
      tabIndex={0}
    >
      {/* Left arrow button */}
      <button
        onClick={navigateToPrevious}
        disabled={!hasPrevious}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
          hasPrevious
            ? "bg-muted/60 hover:bg-muted text-foreground hover:scale-110 active:scale-95"
            : "bg-muted/20 text-muted-foreground/30 cursor-not-allowed"
        )}
        aria-label="Previous line"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Draggable line selector */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-muted/20",
          isDragging && "cursor-grabbing select-none",
          !isDragging && "cursor-grab"
        )}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={lines.length - 1}
        aria-valuenow={currentIndex}
        aria-label="Select line value"
      >
        {lines.map((line) => {
          const isActive = line === activeLine;
          return (
            <button
              key={line}
              onClick={(e) => {
                e.stopPropagation();
                onLineChange(line);
              }}
              className={cn(
                "relative px-2.5 py-1 text-sm font-medium rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.div
                  layoutId="line-selector-active"
                  className="absolute inset-0 bg-primary/15 rounded-md border border-primary/20"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 tabular-nums whitespace-nowrap text-xs font-bold">
                {line}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right arrow button */}
      <button
        onClick={navigateToNext}
        disabled={!hasNext}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
          hasNext
            ? "bg-muted/60 hover:bg-muted text-foreground hover:scale-110 active:scale-95"
            : "bg-muted/20 text-muted-foreground/30 cursor-not-allowed"
        )}
        aria-label="Next line"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
