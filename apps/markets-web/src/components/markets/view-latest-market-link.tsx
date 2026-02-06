"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";

interface ViewLatestMarketLinkProps {
  autoMarketConfigId: string;
  currentMarketId: string;
  /** If true, starts fetching immediately with retries (for when countdown just ended) */
  autoRetry?: boolean;
}

async function fetchLatestMarket(configId: string) {
  const res = await fetch(`/api/auto-markets/${configId}/latest`);
  if (!res.ok) return null;
  return res.json();
}

export function ViewLatestMarketLink({
  autoMarketConfigId,
  currentMarketId,
  autoRetry = false,
}: ViewLatestMarketLinkProps) {
  const [data, setData] = useState<{
    marketId: string;
    eventSlug: string;
    question: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasNewMarket, setHasNewMarket] = useState(false);

  const fetchWithRetry = useCallback(async () => {
    setIsLoading(true);
    
    // Try up to 5 times over 5 seconds (1 second apart)
    for (let attempt = 0; attempt < 5; attempt++) {
      setRetryCount(attempt + 1);
      
      try {
        const result = await fetchLatestMarket(autoMarketConfigId);
        
        if (result?.marketId && result.marketId !== currentMarketId) {
          setData(result);
          setHasNewMarket(true);
          setIsLoading(false);
          return;
        }
      } catch {
        // Ignore errors, continue retrying
      }
      
      // Wait 1 second before next attempt (except on last attempt)
      if (attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setIsLoading(false);
    setRetryCount(0);
  }, [autoMarketConfigId, currentMarketId]);

  // Auto-retry on mount if autoRetry is true
  useEffect(() => {
    if (autoRetry && !hasNewMarket) {
      fetchWithRetry();
    }
  }, [autoRetry, hasNewMarket, fetchWithRetry]);

  // Initial fetch on mount (without retries)
  useEffect(() => {
    if (!autoRetry) {
      const doFetch = async () => {
        setIsLoading(true);
        try {
          const result = await fetchLatestMarket(autoMarketConfigId);
          if (result?.marketId && result.marketId !== currentMarketId) {
            setData(result);
            setHasNewMarket(true);
          }
        } catch {
          // Ignore
        }
        setIsLoading(false);
      };
      doFetch();
    }
  }, [autoMarketConfigId, currentMarketId, autoRetry]);

  // Show loading state during retry
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Finding next market{retryCount > 1 ? ` (${retryCount}/5)` : ""}...</span>
      </div>
    );
  }

  // Don't show if no new market found
  if (!hasNewMarket || !data?.eventSlug) {
    // If auto-retry was enabled and finished without finding, show retry button
    if (autoRetry && retryCount === 0 && !hasNewMarket) {
      return (
        <button
          onClick={fetchWithRetry}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Check for next market</span>
        </button>
      );
    }
    return null;
  }

  return (
    <Link
      href={`/markets/${data.eventSlug}`}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
    >
      View latest market
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
