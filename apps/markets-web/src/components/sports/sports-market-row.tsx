"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Market } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { LineSelector } from "./line-selector";
import { MarketChart } from "./market-chart";
import { MarketInfoModal } from "@/components/markets/market-info-modal";
import { Lock } from "lucide-react";
import {
  parseOutcomes,
  parseOutcomePrices,
  priceToPercent,
  formatVolume,
  getMarketVolume,
  extractLine,
  extractPlayerName,
  getTeamAbbreviation,
  shortenOutcomeLabel,
  groupMarketsByLine,
  getLineValues,
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

// Common props for all market row components
interface BaseMarketRowProps {
  selectedMarketId?: string;
  selectedOutcome?: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
  expandedMarketId?: string;
  onToggleExpand?: (marketId: string) => void;
  eventSlug?: string;
}

// =============================================================================
// OUTCOME BUTTON - Unified button style for all market types
// =============================================================================

export interface OutcomeButtonProps {
  label: string;
  price: number;
  isSelected: boolean;
  onClick: () => void;
  /** When true, button takes full width on mobile */
  fullWidth?: boolean;
  /** When true, button is disabled (market closed) */
  disabled?: boolean;
}

export function OutcomeButton({
  label,
  price,
  isSelected,
  onClick,
  fullWidth = false,
  disabled = false,
}: OutcomeButtonProps) {
  // Only truncate if label is longer than ~12 characters
  const shouldTruncate = label.length > 12;
  
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      className={cn(
        "px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all",
        "flex items-center justify-between gap-1 sm:gap-2",
        fullWidth ? "flex-1 sm:flex-none sm:w-[120px]" : "min-w-[90px] sm:min-w-[120px]",
        disabled
          ? "bg-muted/20 text-muted-foreground cursor-not-allowed opacity-60 border border-border/50"
          : isSelected
            ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "bg-muted/30 text-foreground hover:bg-muted/60 border border-border hover:border-primary/50"
      )}
      whileHover={disabled ? {} : { scale: 1.01 }}
      whileTap={disabled ? {} : { scale: 0.99 }}
    >
      <span className={cn("font-medium text-left", shouldTruncate ? "truncate flex-1" : "whitespace-nowrap")}>{label}</span>
      <span className="font-bold tabular-nums flex-shrink-0">{price}%</span>
    </motion.button>
  );
}

// =============================================================================
// SECTION HEADER
// =============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4", className)}>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

// =============================================================================
// EXPANDABLE MARKET CARD WRAPPER
// =============================================================================

export interface ExpandableMarketCardProps {
  market: Market;
  children: React.ReactNode;
  expandedMarketId?: string;
  onToggleExpand?: (marketId: string) => void;
  selectedOutcome?: number | null;
  eventSlug?: string;
}

export function ExpandableMarketCard({
  market,
  children,
  expandedMarketId,
  onToggleExpand,
  selectedOutcome,
  eventSlug,
}: ExpandableMarketCardProps) {
  const isExpanded = expandedMarketId === market.id;

  // Create market object with event for the chart
  const marketWithEvent = {
    ...market,
    event: eventSlug ? { slug: eventSlug } : undefined,
  };

  return (
    <MarketCard>
      <div
        className={cn(
          "p-4 hover:bg-muted/20 transition-colors",
          onToggleExpand && "cursor-pointer",
          isExpanded && "bg-muted/10"
        )}
        onClick={() => onToggleExpand?.(market.id)}
      >
        {children}
      </div>

      <AnimatePresence>
        {isExpanded && onToggleExpand && (
          <div className="px-4 pb-4">
            <MarketChart market={marketWithEvent} selectedOutcome={selectedOutcome} />
          </div>
        )}
      </AnimatePresence>
    </MarketCard>
  );
}

// =============================================================================
// MARKET CARD WRAPPER
// =============================================================================

export interface MarketCardProps {
  children: React.ReactNode;
  delay?: number;
}

export function MarketCard({ children, delay = 0 }: MarketCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// MONEYLINE ROW
// =============================================================================

interface MoneylineRowProps extends BaseMarketRowProps {
  market: Market;
}

export function MoneylineRow({
  market,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
  expandedMarketId,
  onToggleExpand,
  eventSlug,
}: MoneylineRowProps) {
  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const price0 = priceToPercent(outcomePrices[0]);
  const price1 = priceToPercent(outcomePrices[1]);
  const volume = getMarketVolume(market);

  const isSelected = selectedMarketId === market.id;
  const isClosed = isMarketClosed(market);
  const team0 = getTeamAbbreviation(outcomes[0] || "A");
  const team1 = getTeamAbbreviation(outcomes[1] || "B");

  return (
    <ExpandableMarketCard
      market={market}
      expandedMarketId={expandedMarketId}
      onToggleExpand={onToggleExpand}
      selectedOutcome={selectedOutcome}
      eventSlug={eventSlug}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground">Moneyline</h4>
            {isClosed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">
                <Lock className="h-2.5 w-2.5" />
                Closed
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatVolume(volume)} volume
          </p>
        </div>

        <div className="flex items-center gap-2">
          <OutcomeButton
            label={team0}
            price={price0}
            isSelected={isSelected && selectedOutcome === 0}
            onClick={() => onSelectOutcome(market.id, 0)}
            disabled={isClosed}
          />
          <OutcomeButton
            label={team1}
            price={price1}
            isSelected={isSelected && selectedOutcome === 1}
            onClick={() => onSelectOutcome(market.id, 1)}
            disabled={isClosed}
          />
        </div>
      </div>
    </ExpandableMarketCard>
  );
}

// =============================================================================
// SPREAD ROW (with line selector)
// =============================================================================

interface SpreadRowProps extends BaseMarketRowProps {
  markets: Market[];
  title?: string;
}

export function SpreadRow({
  markets,
  title = "Spreads",
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
  expandedMarketId,
  onToggleExpand,
  eventSlug,
}: SpreadRowProps) {
  const lines = getLineValues(markets);
  const marketsByLine = groupMarketsByLine(markets);
  const [activeLine, setActiveLine] = useState(lines[0] || 0);
  const prevMarketIdRef = useRef<string | null>(null);

  const activeMarket = marketsByLine.get(activeLine) || markets[0];
  
  // When the active market changes due to line change, update selection/expansion if needed
  useEffect(() => {
    if (!activeMarket) return;
    const prevId = prevMarketIdRef.current;
    const newId = activeMarket.id;
    
    if (prevId && prevId !== newId) {
      // If the previous market was selected, select the new one
      if (selectedMarketId === prevId && typeof selectedOutcome === 'number') {
        onSelectOutcome(newId, selectedOutcome);
      }
      // If the previous market was expanded, expand the new one
      if (expandedMarketId === prevId && onToggleExpand) {
        onToggleExpand(newId);
      }
    }
    prevMarketIdRef.current = newId;
  }, [activeMarket?.id, selectedMarketId, selectedOutcome, expandedMarketId, onSelectOutcome, onToggleExpand]);

  if (!activeMarket) return null;

  const outcomes = parseOutcomes(activeMarket.outcomes);
  const outcomePrices = parseOutcomePrices(activeMarket.outcomePrices);
  const price0 = priceToPercent(outcomePrices[0]);
  const price1 = priceToPercent(outcomePrices[1]);
  const totalVolume = markets.reduce((sum, m) => sum + getMarketVolume(m), 0);

  const isSelected = selectedMarketId === activeMarket.id;
  const isClosed = isMarketClosed(activeMarket);
  const label0 = shortenOutcomeLabel(outcomes[0] || "");
  const label1 = shortenOutcomeLabel(outcomes[1] || "");

  return (
    <ExpandableMarketCard
      market={activeMarket}
      expandedMarketId={expandedMarketId}
      onToggleExpand={onToggleExpand}
      selectedOutcome={selectedOutcome}
      eventSlug={eventSlug}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">{title}</h4>
              {isClosed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">
                  <Lock className="h-2.5 w-2.5" />
                  Closed
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatVolume(totalVolume)} volume
            </p>
          </div>

          <div className="flex items-center gap-2">
            <OutcomeButton
              label={label0}
              price={price0}
              isSelected={isSelected && selectedOutcome === 0}
              onClick={() => onSelectOutcome(activeMarket.id, 0)}
              disabled={isClosed}
            />
            <OutcomeButton
              label={label1}
              price={price1}
              isSelected={isSelected && selectedOutcome === 1}
              onClick={() => onSelectOutcome(activeMarket.id, 1)}
              disabled={isClosed}
            />
          </div>
        </div>

        {lines.length > 1 && (
          <LineSelector
            lines={lines}
            activeLine={activeLine}
            onLineChange={setActiveLine}
          />
        )}
      </div>
    </ExpandableMarketCard>
  );
}

// =============================================================================
// TOTALS ROW (Over/Under)
// =============================================================================

interface TotalsRowProps extends BaseMarketRowProps {
  markets: Market[];
  title?: string;
}

export function TotalsRow({
  markets,
  title = "Totals",
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
  expandedMarketId,
  onToggleExpand,
  eventSlug,
}: TotalsRowProps) {
  const lines = getLineValues(markets);
  const marketsByLine = groupMarketsByLine(markets);
  const [activeLine, setActiveLine] = useState(lines[0] || 0);
  const prevMarketIdRef = useRef<string | null>(null);

  const activeMarket = marketsByLine.get(activeLine) || markets[0];
  
  // When the active market changes due to line change, update selection/expansion if needed
  useEffect(() => {
    if (!activeMarket) return;
    const prevId = prevMarketIdRef.current;
    const newId = activeMarket.id;
    
    if (prevId && prevId !== newId) {
      // If the previous market was selected, select the new one
      if (selectedMarketId === prevId && typeof selectedOutcome === 'number') {
        onSelectOutcome(newId, selectedOutcome);
      }
      // If the previous market was expanded, expand the new one
      if (expandedMarketId === prevId && onToggleExpand) {
        onToggleExpand(newId);
      }
    }
    prevMarketIdRef.current = newId;
  }, [activeMarket?.id, selectedMarketId, selectedOutcome, expandedMarketId, onSelectOutcome, onToggleExpand]);

  if (!activeMarket) return null;

  const outcomePrices = parseOutcomePrices(activeMarket.outcomePrices);
  const price0 = priceToPercent(outcomePrices[0]);
  const price1 = priceToPercent(outcomePrices[1]);
  const totalVolume = markets.reduce((sum, m) => sum + getMarketVolume(m), 0);

  const isSelected = selectedMarketId === activeMarket.id;
  const isClosed = isMarketClosed(activeMarket);
  const line = extractLine(activeMarket.question) || activeLine;

  return (
    <ExpandableMarketCard
      market={activeMarket}
      expandedMarketId={expandedMarketId}
      onToggleExpand={onToggleExpand}
      selectedOutcome={selectedOutcome}
      eventSlug={eventSlug}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">{title}</h4>
              {isClosed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">
                  <Lock className="h-2.5 w-2.5" />
                  Closed
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatVolume(totalVolume)} volume
            </p>
          </div>

          <div className="flex items-center gap-2">
            <OutcomeButton
              label={`O ${line}`}
              price={price0}
              isSelected={isSelected && selectedOutcome === 0}
              onClick={() => onSelectOutcome(activeMarket.id, 0)}
              disabled={isClosed}
            />
            <OutcomeButton
              label={`U ${line}`}
              price={price1}
              isSelected={isSelected && selectedOutcome === 1}
              onClick={() => onSelectOutcome(activeMarket.id, 1)}
              disabled={isClosed}
            />
          </div>
        </div>

        {lines.length > 1 && (
          <LineSelector
            lines={lines}
            activeLine={activeLine}
            onLineChange={setActiveLine}
          />
        )}
      </div>
    </ExpandableMarketCard>
  );
}

// =============================================================================
// TEAM TOTAL ROW (Single team with line selector)
// =============================================================================

interface TeamTotalRowProps extends BaseMarketRowProps {
  teamName: string;
  markets: Market[];
}

export function TeamTotalRow({
  teamName,
  markets,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
  expandedMarketId,
  onToggleExpand,
  eventSlug,
}: TeamTotalRowProps) {
  const lines = getLineValues(markets);
  const marketsByLine = groupMarketsByLine(markets);
  const [activeLine, setActiveLine] = useState(lines[0] || 0);
  const prevMarketIdRef = useRef<string | null>(null);

  const activeMarket = marketsByLine.get(activeLine) || markets[0];
  
  // When the active market changes due to line change, update selection/expansion if needed
  useEffect(() => {
    if (!activeMarket) return;
    const prevId = prevMarketIdRef.current;
    const newId = activeMarket.id;
    
    if (prevId && prevId !== newId) {
      // If the previous market was selected, select the new one
      if (selectedMarketId === prevId && typeof selectedOutcome === 'number') {
        onSelectOutcome(newId, selectedOutcome);
      }
      // If the previous market was expanded, expand the new one
      if (expandedMarketId === prevId && onToggleExpand) {
        onToggleExpand(newId);
      }
    }
    prevMarketIdRef.current = newId;
  }, [activeMarket?.id, selectedMarketId, selectedOutcome, expandedMarketId, onSelectOutcome, onToggleExpand]);

  if (!activeMarket) return null;

  const outcomePrices = parseOutcomePrices(activeMarket.outcomePrices);
  const price0 = priceToPercent(outcomePrices[0]);
  const price1 = priceToPercent(outcomePrices[1]);
  const totalVolume = markets.reduce((sum, m) => sum + getMarketVolume(m), 0);

  const isSelected = selectedMarketId === activeMarket.id;
  const isClosed = isMarketClosed(activeMarket);
  const line = extractLine(activeMarket.question) || activeLine;

  return (
    <ExpandableMarketCard
      market={activeMarket}
      expandedMarketId={expandedMarketId}
      onToggleExpand={onToggleExpand}
      selectedOutcome={selectedOutcome}
      eventSlug={eventSlug}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">{teamName}</h4>
              {isClosed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">
                  <Lock className="h-2.5 w-2.5" />
                  Closed
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatVolume(totalVolume)} volume
            </p>
          </div>

          <div className="flex items-center gap-2">
            <OutcomeButton
              label={`O ${line}`}
              price={price0}
              isSelected={isSelected && selectedOutcome === 0}
              onClick={() => onSelectOutcome(activeMarket.id, 0)}
              disabled={isClosed}
            />
            <OutcomeButton
              label={`U ${line}`}
              price={price1}
              isSelected={isSelected && selectedOutcome === 1}
              onClick={() => onSelectOutcome(activeMarket.id, 1)}
              disabled={isClosed}
            />
          </div>
        </div>

        {lines.length > 1 && (
          <LineSelector
            lines={lines}
            activeLine={activeLine}
            onLineChange={setActiveLine}
          />
        )}
      </div>
    </ExpandableMarketCard>
  );
}

// =============================================================================
// PLAYER PROP ROW (Touchdowns, Rushing, Receiving)
// =============================================================================

interface PlayerPropRowProps extends BaseMarketRowProps {
  market: Market;
  showLine?: boolean;
}

export function PlayerPropRow({
  market,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
  showLine = true,
  expandedMarketId,
  onToggleExpand,
  eventSlug,
}: PlayerPropRowProps) {
  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const price0 = priceToPercent(outcomePrices[0]);
  const price1 = priceToPercent(outcomePrices[1]);
  const volume = getMarketVolume(market);

  const isSelected = selectedMarketId === market.id;
  const isClosed = isMarketClosed(market);
  const playerName = extractPlayerName(market.question) || market.question;
  const line = extractLine(market.question);
  const isYesNo = outcomes[0]?.toLowerCase() === "yes";

  // Determine labels
  let label0: string;
  let label1: string;

  if (isYesNo) {
    label0 = "Yes";
    label1 = "No";
  } else if (line && showLine) {
    label0 = `O ${line}`;
    label1 = `U ${line}`;
  } else {
    label0 = shortenOutcomeLabel(outcomes[0] || "Yes");
    label1 = shortenOutcomeLabel(outcomes[1] || "No");
  }

  return (
    <ExpandableMarketCard
      market={market}
      expandedMarketId={expandedMarketId}
      onToggleExpand={onToggleExpand}
      selectedOutcome={selectedOutcome}
      eventSlug={eventSlug}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground">{playerName}</h4>
            {isClosed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">
                <Lock className="h-2.5 w-2.5" />
                Closed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground">
              {formatVolume(volume)} volume
            </p>
            <MarketInfoModal market={market} outcomes={outcomes} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <OutcomeButton
            label={label0}
            price={price0}
            isSelected={isSelected && selectedOutcome === 0}
            onClick={() => onSelectOutcome(market.id, 0)}
            disabled={isClosed}
          />
          <OutcomeButton
            label={label1}
            price={price1}
            isSelected={isSelected && selectedOutcome === 1}
            onClick={() => onSelectOutcome(market.id, 1)}
            disabled={isClosed}
          />
        </div>
      </div>
    </ExpandableMarketCard>
  );
}

// =============================================================================
// LEGACY: Keep for backwards compatibility
// =============================================================================

interface SportsMarketRowProps {
  market: Market;
  selectedMarketId?: string;
  selectedOutcome?: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
  showVolume?: boolean;
  variant?: "default" | "compact";
}

export function SportsMarketRow(props: SportsMarketRowProps) {
  return <PlayerPropRow {...props} />;
}

interface GroupedMarketsRowProps {
  title: string;
  markets: Market[];
  selectedMarketId?: string;
  selectedOutcome?: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
  volume?: number;
}

export function GroupedMarketsRow(props: GroupedMarketsRowProps) {
  return <SpreadRow {...props} />;
}
