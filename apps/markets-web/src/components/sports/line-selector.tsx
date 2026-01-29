"use client";

import { useRef, useCallback, useId } from "react";
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
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);

  // Find current index, defaulting to 0 if activeLine not found
  const currentIndex = Math.max(0, lines.indexOf(activeLine));
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < lines.length - 1;

  // Navigate to previous/next line
  const navigateToPrevious = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const idx = Math.max(0, lines.indexOf(activeLine));
    if (idx > 0) {
      onLineChange(lines[idx - 1]);
    }
  }, [lines, activeLine, onLineChange]);

  const navigateToNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const idx = Math.max(0, lines.indexOf(activeLine));
    if (idx < lines.length - 1) {
      onLineChange(lines[idx + 1]);
    }
  }, [lines, activeLine, onLineChange]);

  // Find which line index the mouse is over based on position
  const getIndexAtPosition = useCallback((clientX: number): number => {
    if (!containerRef.current) return currentIndex;
    
    const buttons = containerRef.current.querySelectorAll('button');
    if (buttons.length === 0) return currentIndex;
    
    // Find which button the mouse is over
    for (let i = 0; i < buttons.length; i++) {
      const rect = buttons[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return i;
      }
    }
    
    // If mouse is to the left of all buttons, return first index
    const firstRect = buttons[0].getBoundingClientRect();
    if (clientX < firstRect.left) {
      return 0;
    }
    
    // If mouse is to the right of all buttons, return last index
    const lastRect = buttons[buttons.length - 1].getBoundingClientRect();
    if (clientX > lastRect.right) {
      return buttons.length - 1;
    }
    
    return currentIndex;
  }, [currentIndex]);

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingRef.current) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    
    hasDraggedRef.current = true;
    
    const newIndex = getIndexAtPosition(clientX);
    if (lines[newIndex] !== undefined && lines[newIndex] !== activeLine) {
      onLineChange(lines[newIndex]);
    }
  }, [lines, activeLine, onLineChange, getIndexAtPosition]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    
    // Clean up listeners
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", handleDragEnd);
    window.removeEventListener("touchmove", handleDragMove);
    window.removeEventListener("touchend", handleDragEnd);
    
    // Reset hasDragged after a short delay
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 100);
  }, [handleDragMove]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    
    // Attach listeners
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: true });
    window.addEventListener("touchend", handleDragEnd);
  }, [handleDragMove, handleDragEnd]);

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

  // Handle line button click - only if we haven't been dragging
  const handleLineClick = useCallback((e: React.MouseEvent, line: number) => {
    e.stopPropagation();
    if (!hasDraggedRef.current && !isDraggingRef.current) {
      onLineChange(line);
    }
  }, [onLineChange]);

  if (lines.length <= 1) return null;

  return (
    <div
      className={cn("relative flex items-center gap-2 sm:gap-3 mt-3 pt-3 border-t border-border/20", className)}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      tabIndex={0}
    >
      {/* Left arrow button */}
      <button
        onClick={navigateToPrevious}
        disabled={!hasPrevious}
        className={cn(
          "flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all",
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
        className="flex-1 flex items-center justify-center gap-0.5 sm:gap-1 py-1 px-1.5 sm:px-2 rounded-lg bg-muted/20 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing select-none"
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
              onClick={(e) => handleLineClick(e, line)}
              className={cn(
                "relative px-2 sm:px-2.5 py-1 text-xs sm:text-sm font-medium rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.div
                  layoutId={`line-selector-active-${id}`}
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
          "flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all",
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
