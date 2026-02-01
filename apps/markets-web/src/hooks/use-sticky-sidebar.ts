"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseStickyOptions {
  topOffset?: number; // Distance from top when sticky (default: 96 = 6rem)
  enabled?: boolean;
}

/**
 * Custom hook for sticky sidebar behavior using fixed positioning.
 * Works around CSS sticky limitations with transforms/filters in ancestors.
 */
export function useStickySidebar(options: UseStickyOptions = {}) {
  const { topOffset = 96, enabled = true } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!enabled || !containerRef.current) {
      setStyle({});
      return;
    }

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollY = window.scrollY;
    
    // Get the container's position relative to document
    const containerTop = rect.top + scrollY;
    const containerLeft = rect.left;
    const containerWidth = rect.width;
    
    // Should we be in fixed mode?
    const shouldFix = scrollY >= containerTop - topOffset;

    if (shouldFix) {
      setStyle({
        position: "fixed",
        top: topOffset,
        left: containerLeft,
        width: containerWidth,
        zIndex: 10,
      });
    } else {
      setStyle({});
    }
  }, [topOffset, enabled]);

  useEffect(() => {
    if (!enabled) {
      setStyle({});
      return;
    }

    // Initial update
    updatePosition();

    // Update on scroll and resize
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [enabled, updatePosition]);

  return { containerRef, style };
}
