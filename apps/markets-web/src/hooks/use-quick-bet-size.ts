"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "vault-quick-bet-size";
const SYNC_EVENT = "vault-quick-bet-size-change";

// Bet size options for quick selection
export const BET_SIZE_OPTIONS = [50, 100, 200, 500] as const;

/**
 * Custom hook for managing quick bet size with cross-component sync.
 * Uses localStorage for persistence and custom events for instant sync
 * across all modal instances without requiring a refresh.
 */
export function useQuickBetSize() {
  const [quickBetSize, setQuickBetSizeState] = useState<number>(100);
  const [isCustomAmount, setIsCustomAmount] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = getStoredBetSize();
    setQuickBetSizeState(stored);
    setIsCustomAmount(!BET_SIZE_OPTIONS.includes(stored as typeof BET_SIZE_OPTIONS[number]));
  }, []);

  // Listen for changes from other components
  useEffect(() => {
    const handleSync = (event: CustomEvent<number>) => {
      const newSize = event.detail;
      setQuickBetSizeState(newSize);
      setIsCustomAmount(!BET_SIZE_OPTIONS.includes(newSize as typeof BET_SIZE_OPTIONS[number]));
    };

    window.addEventListener(SYNC_EVENT, handleSync as EventListener);
    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync as EventListener);
    };
  }, []);

  // Set bet size and broadcast to other components
  const setQuickBetSize = useCallback((size: number) => {
    setQuickBetSizeState(size);
    setIsCustomAmount(!BET_SIZE_OPTIONS.includes(size as typeof BET_SIZE_OPTIONS[number]));
    localStorage.setItem(STORAGE_KEY, String(size));
    
    // Broadcast to other components
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: size }));
  }, []);

  return {
    quickBetSize,
    setQuickBetSize,
    isCustomAmount,
  };
}

// Helper to get stored bet size from localStorage
function getStoredBetSize(): number {
  if (typeof window === "undefined") return 100;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const num = Number(stored);
    if (!isNaN(num) && num > 0) return num;
  }
  return 100; // Default
}



