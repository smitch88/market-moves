"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Market } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { LineSelector } from "./line-selector";
import {
  parseOutcomes,
  parseOutcomePrices,
  formatVolume,
  getMarketVolume,
  extractLine,
  extractPlayerName,
  getTeamAbbreviation,
  shortenOutcomeLabel,
  groupMarketsByLine,
  getLineValues,
} from "./market-utils";

// Common props for all market row components
interface BaseMarketRowProps {
  selectedMarketId?: string;
  selectedOutcome?: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
}

// =============================================================================
// OUTCOME BUTTON - Unified button style for all market types
// =============================================================================

interface OutcomeButtonProps {
  label: string;
  price: number;
  isSelected: boolean;
  onClick: () => void;
}

function OutcomeButton({
  label,
  price,
  isSelected,
  onClick,
}: OutcomeButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "w-[120px] px-3 py-2.5 rounded-lg font-medium text-sm transition-all",
        "flex items-center justify-between gap-2",
        isSelected
          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "bg-muted/50 text-foreground hover:bg-muted border border-border/50 hover:border-border"
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <span className="font-medium truncate text-left flex-1">{label}</span>
      <span className="font-bold tabular-nums flex-shrink-0">{price}¢</span>
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
// MARKET CARD WRAPPER
// =============================================================================

interface MarketCardProps {
  children: React.ReactNode;
  delay?: number;
}

function MarketCard({ children, delay = 0 }: MarketCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-4 hover:border-border/60 transition-colors"
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
}: MoneylineRowProps) {
  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const price0 = Math.round(parseFloat(outcomePrices[0] || "0.50") * 100);
  const price1 = Math.round(parseFloat(outcomePrices[1] || "0.50") * 100);
  const volume = getMarketVolume(market);

  const isSelected = selectedMarketId === market.id;
  const team0 = getTeamAbbreviation(outcomes[0] || "A");
  const team1 = getTeamAbbreviation(outcomes[1] || "B");

  return (
    <MarketCard>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground">Moneyline</h4>
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
          />
          <OutcomeButton
            label={team1}
            price={price1}
            isSelected={isSelected && selectedOutcome === 1}
            onClick={() => onSelectOutcome(market.id, 1)}
          />
        </div>
      </div>
    </MarketCard>
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
}: SpreadRowProps) {
  const lines = getLineValues(markets);
  const marketsByLine = groupMarketsByLine(markets);
  const [activeLine, setActiveLine] = useState(lines[0] || 0);

  const activeMarket = marketsByLine.get(activeLine) || markets[0];
  if (!activeMarket) return null;

  const outcomes = parseOutcomes(activeMarket.outcomes);
  const outcomePrices = parseOutcomePrices(activeMarket.outcomePrices);
  const price0 = Math.round(parseFloat(outcomePrices[0] || "0.50") * 100);
  const price1 = Math.round(parseFloat(outcomePrices[1] || "0.50") * 100);
  const totalVolume = markets.reduce((sum, m) => sum + getMarketVolume(m), 0);

  const isSelected = selectedMarketId === activeMarket.id;
  const label0 = shortenOutcomeLabel(outcomes[0] || "");
  const label1 = shortenOutcomeLabel(outcomes[1] || "");

  return (
    <MarketCard>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground">{title}</h4>
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
          />
          <OutcomeButton
            label={label1}
            price={price1}
            isSelected={isSelected && selectedOutcome === 1}
            onClick={() => onSelectOutcome(activeMarket.id, 1)}
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
    </MarketCard>
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
}: TotalsRowProps) {
  const lines = getLineValues(markets);
  const marketsByLine = groupMarketsByLine(markets);
  const [activeLine, setActiveLine] = useState(lines[0] || 0);

  const activeMarket = marketsByLine.get(activeLine) || markets[0];
  if (!activeMarket) return null;

  const outcomePrices = parseOutcomePrices(activeMarket.outcomePrices);
  const price0 = Math.round(parseFloat(outcomePrices[0] || "0.50") * 100);
  const price1 = Math.round(parseFloat(outcomePrices[1] || "0.50") * 100);
  const totalVolume = markets.reduce((sum, m) => sum + getMarketVolume(m), 0);

  const isSelected = selectedMarketId === activeMarket.id;
  const line = extractLine(activeMarket.question) || activeLine;

  return (
    <MarketCard>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground">{title}</h4>
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
          />
          <OutcomeButton
            label={`U ${line}`}
            price={price1}
            isSelected={isSelected && selectedOutcome === 1}
            onClick={() => onSelectOutcome(activeMarket.id, 1)}
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
    </MarketCard>
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
}: TeamTotalRowProps) {
  const lines = getLineValues(markets);
  const marketsByLine = groupMarketsByLine(markets);
  const [activeLine, setActiveLine] = useState(lines[0] || 0);

  const activeMarket = marketsByLine.get(activeLine) || markets[0];
  if (!activeMarket) return null;

  const outcomePrices = parseOutcomePrices(activeMarket.outcomePrices);
  const price0 = Math.round(parseFloat(outcomePrices[0] || "0.50") * 100);
  const price1 = Math.round(parseFloat(outcomePrices[1] || "0.50") * 100);
  const totalVolume = markets.reduce((sum, m) => sum + getMarketVolume(m), 0);

  const isSelected = selectedMarketId === activeMarket.id;
  const line = extractLine(activeMarket.question) || activeLine;

  return (
    <MarketCard>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground">{teamName}</h4>
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
          />
          <OutcomeButton
            label={`U ${line}`}
            price={price1}
            isSelected={isSelected && selectedOutcome === 1}
            onClick={() => onSelectOutcome(activeMarket.id, 1)}
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
    </MarketCard>
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
}: PlayerPropRowProps) {
  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const price0 = Math.round(parseFloat(outcomePrices[0] || "0.50") * 100);
  const price1 = Math.round(parseFloat(outcomePrices[1] || "0.50") * 100);
  const volume = getMarketVolume(market);

  const isSelected = selectedMarketId === market.id;
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
    <MarketCard>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground">{playerName}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatVolume(volume)} volume
          </p>
        </div>

        <div className="flex items-center gap-2">
          <OutcomeButton
            label={label0}
            price={price0}
            isSelected={isSelected && selectedOutcome === 0}
            onClick={() => onSelectOutcome(market.id, 0)}
          />
          <OutcomeButton
            label={label1}
            price={price1}
            isSelected={isSelected && selectedOutcome === 1}
            onClick={() => onSelectOutcome(market.id, 1)}
          />
        </div>
      </div>
    </MarketCard>
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
