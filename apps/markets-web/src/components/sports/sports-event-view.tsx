"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Users } from "lucide-react";
import type { Market, Event } from "@vault/database";
import { SportsEventHeader } from "./sports-event-header";
import {
  MarketCategoryTabs,
  NFL_MARKET_CATEGORIES,
  getCategoryCounts,
} from "./market-category-tabs";
import {
  SectionHeader,
  MoneylineRow,
  SpreadRow,
  TotalsRow,
  TeamTotalRow,
  PlayerPropRow,
} from "./sports-market-row";
import { SportsBettingSidebar } from "./sports-betting-sidebar";
import { groupByTeam } from "./market-utils";

interface SportsEventViewProps {
  event: Event & {
    markets: Market[];
    tags?: { id: string; slug: string; label: string }[];
  };
}

async function fetchEventData(slug: string) {
  const res = await fetch(`/api/markets/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch event");
  return res.json();
}

// =============================================================================
// GAME LINES SECTION
// =============================================================================

function GameLinesSection({
  markets,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
}: {
  markets: Market[];
  selectedMarketId: string | null;
  selectedOutcome: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
}) {
  const moneylineMarket = markets.find(
    (m) => m.question.includes("vs.") && !m.question.includes("O/U")
  );

  const spreadMarkets = markets.filter((m) =>
    m.question.includes("Spread") && !m.question.includes("1H")
  );

  const totalMarkets = markets.filter((m) =>
    m.question.includes("O/U") &&
    !m.question.includes("Team Total") &&
    !m.question.includes("1H") &&
    !m.question.includes(":")
  );

  return (
    <div className="space-y-3">
      {moneylineMarket && (
        <MoneylineRow
          market={moneylineMarket}
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
        />
      )}

      {spreadMarkets.length > 0 && (
        <SpreadRow
          markets={spreadMarkets}
          title="Spreads"
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
        />
      )}

      {totalMarkets.length > 0 && (
        <TotalsRow
          markets={totalMarkets}
          title="Game Total"
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
        />
      )}
    </div>
  );
}

// =============================================================================
// FIRST HALF SECTION
// =============================================================================

function FirstHalfSection({
  markets,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
}: {
  markets: Market[];
  selectedMarketId: string | null;
  selectedOutcome: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
}) {
  const moneylineMarket = markets.find((m) =>
    m.question.includes("1H Moneyline") || (m.question.includes("1H") && m.question.includes("Moneyline"))
  );

  const spreadMarkets = markets.filter((m) =>
    m.question.includes("1H") && m.question.includes("Spread")
  );

  const totalMarkets = markets.filter((m) =>
    m.question.includes("1H") && m.question.includes("O/U")
  );

  return (
    <div className="space-y-3">
      {moneylineMarket && (
        <MoneylineRow
          market={moneylineMarket}
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
        />
      )}

      {spreadMarkets.length > 0 && (
        <SpreadRow
          markets={spreadMarkets}
          title="1H Spreads"
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
        />
      )}

      {totalMarkets.length > 0 && (
        <TotalsRow
          markets={totalMarkets}
          title="1H Total"
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
        />
      )}
    </div>
  );
}

// =============================================================================
// TEAM TOTALS SECTION
// =============================================================================

function TeamTotalsSection({
  markets,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
}: {
  markets: Market[];
  selectedMarketId: string | null;
  selectedOutcome: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
}) {
  const teamGroups = groupByTeam(markets);

  return (
    <div className="space-y-3">
      {Array.from(teamGroups.entries()).map(([teamName, teamMarkets]) => (
        <TeamTotalRow
          key={teamName}
          teamName={teamName}
          markets={teamMarkets}
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
        />
      ))}
    </div>
  );
}

// =============================================================================
// TOUCHDOWNS SECTION
// =============================================================================

function TouchdownsSection({
  markets,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
}: {
  markets: Market[];
  selectedMarketId: string | null;
  selectedOutcome: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
}) {
  const anytimeTDs = markets.filter((m) =>
    m.question.toLowerCase().includes("anytime touchdown")
  );

  const firstTDs = markets.filter((m) =>
    m.question.toLowerCase().includes("first touchdown")
  );

  return (
    <div className="space-y-8">
      {anytimeTDs.length > 0 && (
        <div>
          <SectionHeader
            title="Anytime Touchdowns"
            subtitle={`${anytimeTDs.length} players`}
          />
          <div className="space-y-2">
            {anytimeTDs.map((market, index) => (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <PlayerPropRow
                  market={market}
                  selectedMarketId={selectedMarketId || undefined}
                  selectedOutcome={selectedOutcome}
                  onSelectOutcome={onSelectOutcome}
                  showLine={false}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {firstTDs.length > 0 && (
        <div>
          <SectionHeader
            title="First Touchdown"
            subtitle={`${firstTDs.length} players`}
          />
          <div className="space-y-2">
            {firstTDs.map((market, index) => (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <PlayerPropRow
                  market={market}
                  selectedMarketId={selectedMarketId || undefined}
                  selectedOutcome={selectedOutcome}
                  onSelectOutcome={onSelectOutcome}
                  showLine={false}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PLAYER PROPS SECTION (Rushing, Receiving)
// =============================================================================

function PlayerPropsSection({
  markets,
  title,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
}: {
  markets: Market[];
  title: string;
  selectedMarketId: string | null;
  selectedOutcome: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
}) {
  return (
    <div>
      <SectionHeader
        title={title}
        subtitle={`${markets.length} props`}
      />
      <div className="space-y-2">
        {markets.map((market, index) => (
          <motion.div
            key={market.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <PlayerPropRow
              market={market}
              selectedMarketId={selectedMarketId || undefined}
              selectedOutcome={selectedOutcome}
              onSelectOutcome={onSelectOutcome}
              showLine={true}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SportsEventView({ event }: SportsEventViewProps) {
  const [activeCategory, setActiveCategory] = useState("game-lines");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);

  // Fetch live data
  const { data } = useQuery({
    queryKey: ["market", event.slug],
    queryFn: () => fetchEventData(event.slug),
    placeholderData: { event },
    staleTime: 0,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const markets = data?.event?.markets || event.markets;

  // Get category counts
  const categoryCounts = useMemo(
    () => getCategoryCounts(markets, NFL_MARKET_CATEGORIES),
    [markets]
  );

  // Get markets for active category
  const activeMarkets = useMemo(() => {
    const category = NFL_MARKET_CATEGORIES.find((c) => c.id === activeCategory);
    return category ? markets.filter(category.filter) : [];
  }, [markets, activeCategory]);

  // Find selected market
  const selectedMarket = selectedMarketId
    ? markets.find((m: Market) => m.id === selectedMarketId) || null
    : null;

  // Handle outcome selection
  const handleSelectOutcome = (marketId: string, outcomeIndex: number) => {
    if (selectedMarketId === marketId && selectedOutcome === outcomeIndex) {
      setSelectedMarketId(null);
      setSelectedOutcome(null);
    } else {
      setSelectedMarketId(marketId);
      setSelectedOutcome(outcomeIndex);
    }
  };

  const handleClearSelection = () => {
    setSelectedMarketId(null);
    setSelectedOutcome(null);
  };

  // Calculate stats
  const totalBets = markets.reduce((sum: number, m: Market & { _count?: { bets?: number } }) => {
    return sum + (m._count?.bets || 0);
  }, 0);
  const totalVolume = markets.reduce((sum: number, m: Market) => {
    return sum + (m.seed0 || 0) + (m.seed1 || 0) + (m.pool0 || 0) + (m.pool1 || 0);
  }, 0);

  // Render the appropriate section based on active category
  const renderMarkets = () => {
    if (activeMarkets.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card/40 border border-border/30 rounded-2xl p-12 text-center"
        >
          <p className="text-muted-foreground">
            No markets available in this category
          </p>
        </motion.div>
      );
    }

    switch (activeCategory) {
      case "game-lines":
        return (
          <GameLinesSection
            markets={activeMarkets}
            selectedMarketId={selectedMarketId}
            selectedOutcome={selectedOutcome}
            onSelectOutcome={handleSelectOutcome}
          />
        );

      case "1st-half":
        return (
          <FirstHalfSection
            markets={activeMarkets}
            selectedMarketId={selectedMarketId}
            selectedOutcome={selectedOutcome}
            onSelectOutcome={handleSelectOutcome}
          />
        );

      case "team-totals":
        return (
          <TeamTotalsSection
            markets={activeMarkets}
            selectedMarketId={selectedMarketId}
            selectedOutcome={selectedOutcome}
            onSelectOutcome={handleSelectOutcome}
          />
        );

      case "touchdowns":
        return (
          <TouchdownsSection
            markets={activeMarkets}
            selectedMarketId={selectedMarketId}
            selectedOutcome={selectedOutcome}
            onSelectOutcome={handleSelectOutcome}
          />
        );

      case "rushing":
        return (
          <PlayerPropsSection
            markets={activeMarkets}
            title="Rushing Yards"
            selectedMarketId={selectedMarketId}
            selectedOutcome={selectedOutcome}
            onSelectOutcome={handleSelectOutcome}
          />
        );

      case "receiving":
        return (
          <PlayerPropsSection
            markets={activeMarkets}
            title="Receiving Yards"
            selectedMarketId={selectedMarketId}
            selectedOutcome={selectedOutcome}
            onSelectOutcome={handleSelectOutcome}
          />
        );

      default:
        return (
          <PlayerPropsSection
            markets={activeMarkets}
            title="Markets"
            selectedMarketId={selectedMarketId}
            selectedOutcome={selectedOutcome}
            onSelectOutcome={handleSelectOutcome}
          />
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back navigation */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Events</span>
        </Link>
      </motion.div>

      {/* Main grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Header + Markets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sports Header */}
          <SportsEventHeader event={event} />

          {/* Quick stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-6"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>{markets.length} markets</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{totalBets} predictions</span>
            </div>
          </motion.div>

          {/* Category tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <MarketCategoryTabs
              categories={NFL_MARKET_CATEGORIES}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              marketCounts={categoryCounts}
            />
          </motion.div>

          {/* Markets list */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {renderMarkets()}
          </motion.div>
        </div>

        {/* Right column: Betting Sidebar (sticky) */}
        <div className="lg:col-span-1">
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
    </div>
  );
}
