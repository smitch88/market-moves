"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Price update event from SSE stream
 */
export interface PriceUpdate {
  type: "price_update";
  marketId: string;
  eventId: string;
  prices: [number, number];
  pools: [number, number];
  timestamp: string;
}

/**
 * Connection status for the SSE stream
 */
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * Options for useMarketUpdates hook
 */
interface UseMarketUpdatesOptions {
  /** Filter updates to a specific event */
  eventId?: string;
  /** Enable/disable the subscription */
  enabled?: boolean;
  /** Callback when a price update is received */
  onPriceUpdate?: (update: PriceUpdate) => void;
  /** Reconnection delay in ms (default: 3000) */
  reconnectDelay?: number;
  /** Max reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
}

/**
 * Hook for subscribing to real-time market price updates via SSE
 * 
 * @example
 * ```tsx
 * const { priceUpdates, status, latestUpdate } = useMarketUpdates({
 *   eventId: "super-bowl-2026",
 *   onPriceUpdate: (update) => console.log("Price changed:", update),
 * });
 * ```
 */
export function useMarketUpdates(options: UseMarketUpdatesOptions = {}) {
  const {
    eventId,
    enabled = true,
    onPriceUpdate,
    reconnectDelay = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [latestUpdate, setLatestUpdate] = useState<PriceUpdate | null>(null);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, PriceUpdate>>(new Map());
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const lastEventIdRef = useRef(eventId);
  
  // Store callback in a ref to avoid dependency issues
  const onPriceUpdateRef = useRef(onPriceUpdate);
  onPriceUpdateRef.current = onPriceUpdate;

  /**
   * Get the current price for a specific market
   */
  const getMarketPrice = useCallback((marketId: string): PriceUpdate | undefined => {
    return priceUpdates.get(marketId);
  }, [priceUpdates]);

  /**
   * Connect to the SSE stream
   */
  const connect = useCallback(() => {
    if (!enabled) return;
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus("connecting");

    // Build URL with optional eventId filter
    const url = eventId 
      ? `/api/markets/stream?eventId=${encodeURIComponent(eventId)}`
      : "/api/markets/stream";

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus("connected");
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "connected") {
          // Initial connection confirmation
          return;
        }

        if (data.type === "price_update") {
          const update = data as PriceUpdate;
          
          // Update the latest update
          setLatestUpdate(update);
          
          // Update the price map
          setPriceUpdates((prev) => {
            const next = new Map(prev);
            next.set(update.marketId, update);
            return next;
          });

          // Call the callback if provided (use ref to avoid stale closure)
          onPriceUpdateRef.current?.(update);
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      // Prevent duplicate error handling
      if (!eventSourceRef.current) {
        return;
      }
      
      setStatus("error");
      eventSource.close();
      eventSourceRef.current = null;
      isConnectingRef.current = false;

      // Attempt to reconnect with exponential backoff
      // Use a minimum delay of 5 seconds to prevent rapid reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const baseDelay = Math.max(reconnectDelay, 5000);
        const delay = baseDelay * Math.pow(1.5, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setStatus("disconnected");
          isConnectingRef.current = false;
          connect();
        }, Math.min(delay, 30000)); // Cap at 30 seconds
      } else {
        setStatus("disconnected");
      }
    };
  }, [enabled, eventId, reconnectDelay, maxReconnectAttempts]);

  /**
   * Disconnect from the SSE stream
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setStatus("disconnected");
    reconnectAttemptsRef.current = 0;
  }, []);

  /**
   * Force reconnection
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    if (!enabled) {
      disconnect();
      isConnectingRef.current = false;
      return;
    }

    // Prevent duplicate connection attempts
    if (isConnectingRef.current && lastEventIdRef.current === eventId) {
      return;
    }

    // If eventId changed, disconnect first
    if (lastEventIdRef.current !== eventId && eventSourceRef.current) {
      disconnect();
    }

    lastEventIdRef.current = eventId;
    isConnectingRef.current = true;

    // Connect with a small delay to batch rapid updates
    const timer = setTimeout(() => {
      connect();
    }, 50);

    return () => {
      clearTimeout(timer);
      disconnect();
      isConnectingRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, eventId]);

  return {
    /** Current connection status */
    status,
    /** Whether the connection is active */
    isConnected: status === "connected",
    /** The most recent price update received */
    latestUpdate,
    /** Map of marketId -> latest price update */
    priceUpdates,
    /** Get price update for a specific market */
    getMarketPrice,
    /** Manually reconnect */
    reconnect,
    /** Manually disconnect */
    disconnect,
  };
}

/**
 * Hook for getting real-time price for a specific market
 * 
 * @example
 * ```tsx
 * const { prices, pools, timestamp } = useMarketPrice(marketId);
 * ```
 */
export function useMarketPrice(
  marketId: string,
  options: Omit<UseMarketUpdatesOptions, "onPriceUpdate"> = {}
) {
  const [currentPrices, setCurrentPrices] = useState<[number, number] | null>(null);
  const [currentPools, setCurrentPools] = useState<[number, number] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const { status, isConnected } = useMarketUpdates({
    ...options,
    onPriceUpdate: (update) => {
      if (update.marketId === marketId) {
        setCurrentPrices(update.prices);
        setCurrentPools(update.pools);
        setLastUpdated(update.timestamp);
      }
    },
  });

  return {
    prices: currentPrices,
    pools: currentPools,
    lastUpdated,
    status,
    isConnected,
  };
}
