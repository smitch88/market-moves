"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Users, Wifi, WifiOff } from "lucide-react";
import type { Market, Event } from "@vault/database";
import {
  PropEventHeader,
  GenericMarketRow,
  SportsBettingSidebar,
  MarketCategoryTabs,
  MobileBettingSheet,
} from "@/components/sports";
import { useMarketUpdates, type PriceUpdate } from "@/hooks/use-market-updates";

// Extended market type with display fields
type MarketWithDisplay = Market & {
  displayLabel?: string | null;
  sortOrder?: number | null;
};

interface MarketDetailProps {
  event: Event & {
    markets: MarketWithDisplay[];
    tags?: { id: string; slug: string; label: string }[];
  };
}

async function fetchEventData(slug: string) {
  const res = await fetch(`/api/markets/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch event");
  return res.json();
}

// Helper to parse outcome prices
function parseOutcomePrices(outcomePrices: string): number[] {
  try {
    return JSON.parse(outcomePrices).map((p: string) => parseFloat(p));
  } catch {
    return [0.5, 0.5];
  }
}

// Get the highest probability for a market (for sorting)
function getMaxProbability(market: MarketWithDisplay): number {
  const prices = parseOutcomePrices(market.outcomePrices);
  return Math.max(...prices);
}

// Define category configurations for prop events
interface CategoryConfig {
  id: string;
  label: string;
  filter: (m: MarketWithDisplay) => boolean;
}

function getCategoriesForEvent(markets: MarketWithDisplay[]): CategoryConfig[] {
  // For prop events, create a simple "All Markets" category
  // Could be extended to group by question patterns
  return [
    {
      id: "all",
      label: "All Markets",
      filter: () => true,
    },
  ];
}

export function MarketDetail({ event }: MarketDetailProps) {
  const queryClient = useQueryClient();

  // State
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [expandedMarketId, setExpandedMarketId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Fetch live data (polling as fallback)
  const { data } = useQuery({
    queryKey: ["market", event.slug],
    queryFn: () => fetchEventData(event.slug),
    placeholderData: { event },
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Real-time price updates via SSE
  const handlePriceUpdate = useCallback(
    (update: PriceUpdate) => {
      queryClient.setQueryData(
        ["market", event.slug],
        (oldData: { event: Event & { markets: MarketWithDisplay[] } } | undefined) => {
          if (!oldData?.event?.markets) return oldData;

          return {
            ...oldData,
            event: {
              ...oldData.event,
              markets: oldData.event.markets.map((market: MarketWithDisplay) => {
                if (market.id === update.marketId) {
                  return {
                    ...market,
                    outcomePrices: JSON.stringify(
                      update.prices.map((p) => p.toFixed(4))
                    ),
                    pool0: update.pools[0] - Number(market.seed0 || 1000),
                    pool1: update.pools[1] - Number(market.seed1 || 1000),
                  };
                }
                return market;
              }),
            },
          };
        }
      );
    },
    [queryClient, event.slug]
  );

  const { isConnected } = useMarketUpdates({
    eventId: event.id,
    onPriceUpdate: handlePriceUpdate,
  });

  const markets = data?.event?.markets || event.markets;

  // Get categories for this event
  const categories = useMemo(() => getCategoriesForEvent(markets), [markets]);

  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      counts[cat.id] = markets.filter(cat.filter).length;
    });
    return counts;
  }, [markets, categories]);

  // Get markets for active category
  const activeCategory_obj = useMemo(
    () => categories.find((c) => c.id === activeCategory),
    [categories, activeCategory]
  );

  const activeMarkets = useMemo(() => {
    const filtered = activeCategory_obj ? markets.filter(activeCategory_obj.filter) : markets;
    
    // Check if markets have explicit sortOrder (from database)
    const hasSortOrder = filtered.some((m: MarketWithDisplay) => m.sortOrder !== null && m.sortOrder !== undefined);
    
    if (hasSortOrder) {
      // Sort by explicit sortOrder (lower = first), then by probability as fallback
      return [...filtered].sort((a, b) => {
        const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return getMaxProbability(b) - getMaxProbability(a);
      });
    }
    
    // Default: Sort by highest probability (most likely first)
    return [...filtered].sort((a, b) => getMaxProbability(b) - getMaxProbability(a));
  }, [markets, activeCategory_obj]);

  // Find selected market
  const selectedMarket = selectedMarketId
    ? markets.find((m: MarketWithDisplay) => m.id === selectedMarketId) || null
    : null;

  // Handle outcome selection
  const handleSelectOutcome = (marketId: string, outcomeIndex: number) => {
    if (selectedMarketId === marketId && selectedOutcome === outcomeIndex) {
      setSelectedMarketId(null);
      setSelectedOutcome(null);
      setMobileSheetOpen(false);
    } else {
      setSelectedMarketId(marketId);
      setSelectedOutcome(outcomeIndex);
      // Auto-open sheet on mobile when selecting an outcome
      setMobileSheetOpen(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedMarketId(null);
    setSelectedOutcome(null);
    setMobileSheetOpen(false);
  };

  const handleToggleExpand = (marketId: string) => {
    setExpandedMarketId(expandedMarketId === marketId ? null : marketId);
  };

  // Calculate stats
  const totalBets = markets.reduce(
    (sum: number, m: MarketWithDisplay & { _count?: { bets?: number } }) => {
      return sum + (m._count?.bets || 0);
    },
    0
  );

  return (
    <div className="max-w-7xl mx-auto pb-52 lg:pb-0">
      {/* Back navigation */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </Link>
      </motion.div>

      {/* Main grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left column: Header + Markets */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Prop Event Header */}
          <PropEventHeader event={event} />

          {/* Quick stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 sm:gap-6 flex-wrap"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{markets.length} markets</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{totalBets} predictions</span>
            </div>
            {/* Real-time connection indicator */}
            <div className="flex items-center gap-1 sm:gap-1.5 text-xs">
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Offline</span>
                </>
              )}
            </div>
          </motion.div>

          {/* Category tabs (if more than one category) */}
          {categories.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <MarketCategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                marketCounts={categoryCounts}
              />
            </motion.div>
          )}

          {/* Markets list */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {activeMarkets.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card/40 border border-border/30 rounded-2xl p-12 text-center"
              >
                <p className="text-muted-foreground">
                  No markets available in this category
                </p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {activeMarkets.map((market, index) => (
                  <GenericMarketRow
                    key={market.id}
                    market={market}
                    selectedMarketId={selectedMarketId ?? undefined}
                    selectedOutcome={selectedOutcome}
                    onSelectOutcome={handleSelectOutcome}
                    expandedMarketId={expandedMarketId ?? undefined}
                    onToggleExpand={handleToggleExpand}
                    eventSlug={event.slug}
                    delay={index * 0.03}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right column: Betting Sidebar (sticky) - hidden on mobile */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <SportsBettingSidebar
              event={event}
              selectedMarket={selectedMarket}
              selectedOutcome={selectedOutcome}
              onClearSelection={handleClearSelection}
            />
          </div>
        </div>
      </div>

      {/* Mobile betting sheet */}
      <div className="lg:hidden">
        <MobileBettingSheet
          event={event}
          selectedMarket={selectedMarket}
          selectedOutcome={selectedOutcome}
          onClearSelection={handleClearSelection}
          isOpen={mobileSheetOpen}
          onOpenChange={setMobileSheetOpen}
        />

        {/* Mobile trigger button - shown when selection exists but sheet is closed */}
        {selectedMarket && selectedOutcome !== null && !mobileSheetOpen && (
          <motion.button
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={() => setMobileSheetOpen(true)}
            className="fixed bottom-24 md:bottom-6 left-4 right-4 z-[30] bg-primary text-primary-foreground py-4 px-6 rounded-2xl shadow-2xl flex items-center justify-between"
          >
            <div className="flex flex-col items-start">
              <span className="text-xs opacity-80">Selected</span>
              <span className="font-bold">
                {(() => {
                  try {
                    const outcomes = JSON.parse(selectedMarket.outcomes);
                    return outcomes[selectedOutcome];
                  } catch {
                    return selectedOutcome === 0 ? "Yes" : "No";
                  }
                })()}
              </span>
            </div>
            <span className="font-semibold">Place Bet →</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
