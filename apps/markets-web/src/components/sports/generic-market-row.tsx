"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Market } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { MarketCard, OutcomeButton } from "./sports-market-row";
import { MarketChart } from "./market-chart";
import { MarketInfoModal } from "@/components/markets/market-info-modal";
import { Lock, Info } from "lucide-react";
import {
  parseOutcomes,
  parseOutcomePrices,
  priceToPercent,
  formatVolume,
  getMarketVolume,
} from "./market-utils";

// Check if a market is closed (by status or by closesAt time)
function isMarketClosed(market: Market): boolean {
  // Check market status
  if (market.status === "CLOSED" || market.status === "RESOLVED") {
    return true;
  }
  
  // Check if closesAt time has passed
  if (market.closesAt) {
    const closesAt = new Date(market.closesAt);
    return closesAt.getTime() < Date.now();
  }
  
  return false;
}

// =============================================================================
// GENERIC MARKET ROW - For binary Yes/No markets with full question display
// =============================================================================

export interface GenericMarketRowProps {
  market: Market & { displayLabel?: string | null; sortOrder?: number | null };
  selectedMarketId?: string;
  selectedOutcome?: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
  expandedMarketId?: string;
  onToggleExpand?: (marketId: string) => void;
  eventSlug?: string;
  /** Animation delay for staggered entrance */
  delay?: number;
}

export function GenericMarketRow({
  market,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
  expandedMarketId,
  onToggleExpand,
  eventSlug,
  delay = 0,
}: GenericMarketRowProps) {
  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const price0 = priceToPercent(outcomePrices[0]);
  const price1 = priceToPercent(outcomePrices[1]);
  const volume = getMarketVolume(market);

  const isSelected = selectedMarketId === market.id;
  const isExpanded = expandedMarketId === market.id;
  const isClosed = isMarketClosed(market);

  // Determine labels - use actual outcome names
  const label0 = outcomes[0] || "Yes";
  const label1 = outcomes[1] || "No";
  
  // Use database displayLabel if available, otherwise fall back to question
  const displayLabel = market.displayLabel || market.question;

  // Create market object with event for the chart
  const marketWithEvent = {
    ...market,
    event: eventSlug ? { slug: eventSlug } : undefined,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <MarketCard>
        <div
          className={cn(
            "p-3 sm:p-4 hover:bg-muted/20 transition-colors",
            onToggleExpand && "cursor-pointer",
            isExpanded && "bg-muted/10"
          )}
          onClick={() => onToggleExpand?.(market.id)}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm sm:text-base text-foreground line-clamp-2">
                  {displayLabel}
                </h4>
                {isClosed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/50 shrink-0">
                    <Lock className="h-2.5 w-2.5" />
                    Closed
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                <p className="text-xs text-muted-foreground">
                  {formatVolume(volume)} volume
                </p>
                <MarketInfoModal market={market} outcomes={outcomes} />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0">
              <OutcomeButton
                label={label0}
                price={price0}
                isSelected={isSelected && selectedOutcome === 0}
                onClick={() => onSelectOutcome(market.id, 0)}
                fullWidth
                disabled={isClosed}
              />
              <OutcomeButton
                label={label1}
                price={price1}
                isSelected={isSelected && selectedOutcome === 1}
                onClick={() => onSelectOutcome(market.id, 1)}
                fullWidth
                disabled={isClosed}
              />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && onToggleExpand && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 pb-4"
            >
              <MarketChart market={marketWithEvent} selectedOutcome={selectedOutcome} />
            </motion.div>
          )}
        </AnimatePresence>
      </MarketCard>
    </motion.div>
  );
}

// =============================================================================
// GENERIC MARKETS LIST - Renders a list of markets with staggered animations
// =============================================================================

export interface GenericMarketsListProps {
  markets: Market[];
  selectedMarketId?: string;
  selectedOutcome?: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
  expandedMarketId?: string;
  onToggleExpand?: (marketId: string) => void;
  eventSlug?: string;
}

export function GenericMarketsList({
  markets,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
  expandedMarketId,
  onToggleExpand,
  eventSlug,
}: GenericMarketsListProps) {
  if (markets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card/40 border border-border/30 rounded-2xl p-12 text-center"
      >
        <p className="text-muted-foreground">No markets available</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      {markets.map((market, index) => (
        <GenericMarketRow
          key={market.id}
          market={market}
          selectedMarketId={selectedMarketId}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
          expandedMarketId={expandedMarketId}
          onToggleExpand={onToggleExpand}
          eventSlug={eventSlug}
          delay={index * 0.03}
        />
      ))}
    </div>
  );
}
