"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Users, Wifi, WifiOff } from "lucide-react";
import type { Market, Event } from "@vault/database";
import { SportsEventHeader } from "./sports-event-header";
import { MarketCategoryTabs } from "./market-category-tabs";
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
import {
  getSportConfig,
  getCategoryCountsForSport,
  type SportConfig,
  type MarketCategoryConfig,
} from "./sport-configs";
import { useMarketUpdates, type PriceUpdate } from "@/hooks/use-market-updates";

interface SportsEventViewProps {
  event: Event & {
    markets: Market[];
    tags?: { id: string; slug: string; label: string }[];
  };
  /** Optional sport override (defaults to event.category) */
  sport?: string;
}

async function fetchEventData(slug: string) {
  const res = await fetch(`/api/markets/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch event");
  return res.json();
}

// =============================================================================
// GENERIC SECTION RENDERERS
// These render markets based on category patterns
// =============================================================================

interface SectionProps {
  markets: Market[];
  selectedMarketId: string | null;
  selectedOutcome: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
  config: SportConfig;
  expandedMarketId: string | null;
  onToggleExpand: (marketId: string) => void;
  eventSlug?: string;
}

/**
 * Game Lines Section - Moneyline, Spreads, Totals
 */
function GameLinesSection({ markets, selectedMarketId, selectedOutcome, onSelectOutcome, expandedMarketId, onToggleExpand, eventSlug }: SectionProps) {
  const moneylineMarket = markets.find(
    (m) => m.question.includes("vs.") && !m.question.includes("O/U")
  );

  const spreadMarkets = markets.filter((m) =>
    m.question.includes("Spread") || m.question.includes("Line")
  );

  const totalMarkets = markets.filter((m) =>
    m.question.includes("O/U") && !m.question.includes("Team Total")
  );

  return (
    <div className="space-y-3">
      {moneylineMarket && (
        <MoneylineRow
          market={moneylineMarket}
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          eventSlug={eventSlug}
          onSelectOutcome={onSelectOutcome}
          expandedMarketId={expandedMarketId || undefined}
          onToggleExpand={onToggleExpand}
        />
      )}

      {spreadMarkets.length > 0 && (
        <SpreadRow
          markets={spreadMarkets}
          title="Spreads"
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
          expandedMarketId={expandedMarketId || undefined}
          onToggleExpand={onToggleExpand}
          eventSlug={eventSlug}
        />
      )}

      {totalMarkets.length > 0 && (
        <TotalsRow
          markets={totalMarkets}
          title="Game Total"
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
          expandedMarketId={expandedMarketId || undefined}
          onToggleExpand={onToggleExpand}
          eventSlug={eventSlug}
        />
      )}
    </div>
  );
}

/**
 * Half/Period Section - For 1H, 1Q, 1P markets
 */
function HalfSection({ markets, selectedMarketId, selectedOutcome, onSelectOutcome, expandedMarketId, onToggleExpand, eventSlug }: SectionProps) {
  const moneylineMarket = markets.find((m) =>
    m.question.includes("Moneyline") || (m.question.includes("vs.") && !m.question.includes("O/U"))
  );

  const spreadMarkets = markets.filter((m) => m.question.includes("Spread"));
  const totalMarkets = markets.filter((m) => m.question.includes("O/U"));

  return (
    <div className="space-y-3">
      {moneylineMarket && (
        <MoneylineRow
          market={moneylineMarket}
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
          expandedMarketId={expandedMarketId || undefined}
          onToggleExpand={onToggleExpand}
          eventSlug={eventSlug}
        />
      )}

      {spreadMarkets.length > 0 && (
        <SpreadRow
          markets={spreadMarkets}
          title="Spreads"
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
          expandedMarketId={expandedMarketId || undefined}
          onToggleExpand={onToggleExpand}
          eventSlug={eventSlug}
        />
      )}

      {totalMarkets.length > 0 && (
        <TotalsRow
          markets={totalMarkets}
          title="Total"
          selectedMarketId={selectedMarketId || undefined}
          selectedOutcome={selectedOutcome}
          onSelectOutcome={onSelectOutcome}
          expandedMarketId={expandedMarketId || undefined}
          onToggleExpand={onToggleExpand}
          eventSlug={eventSlug}
        />
      )}
    </div>
  );
}

/**
 * Team Totals Section
 */
function TeamTotalsSection({ markets, selectedMarketId, selectedOutcome, onSelectOutcome, expandedMarketId, onToggleExpand, eventSlug }: SectionProps) {
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
          expandedMarketId={expandedMarketId || undefined}
          onToggleExpand={onToggleExpand}
          eventSlug={eventSlug}
        />
      ))}
    </div>
  );
}

/**
 * Touchdowns Section (NFL specific, but works for any Yes/No props)
 */
function TouchdownsSection({ markets, selectedMarketId, selectedOutcome, onSelectOutcome, expandedMarketId, onToggleExpand, eventSlug }: SectionProps) {
  const anytimeTDs = markets.filter((m) =>
    m.question.toLowerCase().includes("anytime")
  );

  const firstTDs = markets.filter((m) =>
    m.question.toLowerCase().includes("first")
  );

  const otherTDs = markets.filter((m) =>
    !m.question.toLowerCase().includes("anytime") &&
    !m.question.toLowerCase().includes("first")
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
                  expandedMarketId={expandedMarketId || undefined}
                  onToggleExpand={onToggleExpand}
                  eventSlug={eventSlug}
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
                  expandedMarketId={expandedMarketId || undefined}
                  onToggleExpand={onToggleExpand}
                  eventSlug={eventSlug}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {otherTDs.length > 0 && (
        <div>
          <SectionHeader title="Other" subtitle={`${otherTDs.length} props`} />
          <div className="space-y-2">
            {otherTDs.map((market, index) => (
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
                  expandedMarketId={expandedMarketId || undefined}
                  onToggleExpand={onToggleExpand}
                  eventSlug={eventSlug}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generic Player Props Section
 */
function PlayerPropsSection({
  markets,
  selectedMarketId,
  selectedOutcome,
  onSelectOutcome,
  expandedMarketId,
  onToggleExpand,
  eventSlug,
  title = "Player Props",
}: SectionProps & { title?: string }) {
  return (
    <div>
      <SectionHeader title={title} subtitle={`${markets.length} props`} />
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
              expandedMarketId={expandedMarketId || undefined}
              onToggleExpand={onToggleExpand}
              eventSlug={eventSlug}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/**
 * Generic Markets Section (fallback)
 */
function GenericSection({ markets, selectedMarketId, selectedOutcome, onSelectOutcome, expandedMarketId, onToggleExpand, eventSlug }: SectionProps) {
  return (
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
            expandedMarketId={expandedMarketId || undefined}
            onToggleExpand={onToggleExpand}
            eventSlug={eventSlug}
          />
        </motion.div>
      ))}
    </div>
  );
}

// =============================================================================
// SECTION RENDERER MAPPER
// Maps category IDs to appropriate renderers
// =============================================================================

function getSectionRenderer(categoryId: string): React.ComponentType<SectionProps & { title?: string }> {
  const renderers: Record<string, React.ComponentType<SectionProps & { title?: string }>> = {
    // Game lines categories
    "game-lines": GameLinesSection,
    "match-result": GameLinesSection,
    "match-winner": GameLinesSection,
    winner: GameLinesSection,
    "tournament-winner": GenericSection,
    
    // Half/period categories
    "1st-half": HalfSection,
    "1st-quarter": HalfSection,
    "first-5": HalfSection,
    period: HalfSection,
    "first-set": HalfSection,
    
    // Team totals
    "team-totals": TeamTotalsSection,
    
    // Touchdowns/scoring props
    touchdowns: TouchdownsSection,
    goals: TouchdownsSection,
    scorer: TouchdownsSection,
    
    // Player props (with O/U lines)
    rushing: PlayerPropsSection,
    receiving: PlayerPropsSection,
    points: PlayerPropsSection,
    rebounds: PlayerPropsSection,
    assists: PlayerPropsSection,
    threes: PlayerPropsSection,
    hits: PlayerPropsSection,
    strikeouts: PlayerPropsSection,
    "home-runs": PlayerPropsSection,
    shots: PlayerPropsSection,
    corners: PlayerPropsSection,
    
    // UFC specific
    method: GenericSection,
    round: GenericSection,
    props: PlayerPropsSection,
    
    // Tennis/Golf
    sets: PlayerPropsSection,
    games: PlayerPropsSection,
    "top-finish": GenericSection,
    matchups: GameLinesSection,
    
    // Both teams (soccer)
    "both-teams": GenericSection,
  };

  return renderers[categoryId] || GenericSection;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SportsEventView({ event, sport }: SportsEventViewProps) {
  // Get sport config
  const sportType = sport || event.category;
  const config = useMemo(() => getSportConfig(sportType), [sportType]);
  const queryClient = useQueryClient();

  // State
  const [activeCategory, setActiveCategory] = useState(config.categories[0]?.id || "all");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [expandedMarketId, setExpandedMarketId] = useState<string | null>(null);

  // Fetch live data (polling as fallback)
  const { data } = useQuery({
    queryKey: ["market", event.slug],
    queryFn: () => fetchEventData(event.slug),
    placeholderData: { event },
    staleTime: 0,
    refetchInterval: 30000, // Reduced to 30s since we have real-time now
    refetchOnWindowFocus: true,
  });

  // Real-time price updates via SSE
  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    // Update the React Query cache with new prices
    queryClient.setQueryData(["market", event.slug], (oldData: { event: Event & { markets: Market[] } } | undefined) => {
      if (!oldData?.event?.markets) return oldData;
      
      return {
        ...oldData,
        event: {
          ...oldData.event,
          markets: oldData.event.markets.map((market: Market) => {
            if (market.id === update.marketId) {
              return {
                ...market,
                outcomePrices: JSON.stringify(update.prices.map(p => p.toFixed(4))),
                // Update pool values for display
                pool0: update.pools[0] - Number(market.seed0 || 1000),
                pool1: update.pools[1] - Number(market.seed1 || 1000),
              };
            }
            return market;
          }),
        },
      };
    });
  }, [queryClient, event.slug]);

  const { status: sseStatus, isConnected } = useMarketUpdates({
    eventId: event.id,
    onPriceUpdate: handlePriceUpdate,
  });

  const markets = data?.event?.markets || event.markets;

  // Get category counts
  const categoryCounts = useMemo(
    () => getCategoryCountsForSport(markets, sportType),
    [markets, sportType]
  );

  // Get markets for active category
  const activeCategory_obj = useMemo(
    () => config.categories.find((c) => c.id === activeCategory),
    [config.categories, activeCategory]
  );

  const activeMarkets = useMemo(() => {
    if (!activeCategory_obj) return [];
    return markets.filter(activeCategory_obj.filter);
  }, [markets, activeCategory_obj]);

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

  const handleToggleExpand = (marketId: string) => {
    setExpandedMarketId(expandedMarketId === marketId ? null : marketId);
  };

  // Calculate stats
  const totalBets = markets.reduce((sum: number, m: Market & { _count?: { bets?: number } }) => {
    return sum + (m._count?.bets || 0);
  }, 0);

  // Render markets based on active category
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

    // Get the appropriate renderer for this category
    const SectionRenderer = getSectionRenderer(activeCategory);
    const categoryLabel = activeCategory_obj?.label || "Markets";

    // Determine title based on category
    let title = categoryLabel;
    if (activeCategory === "rushing") title = "Rushing Yards";
    if (activeCategory === "receiving") title = "Receiving Yards";
    if (activeCategory === "points") title = "Points";
    if (activeCategory === "rebounds") title = "Rebounds";
    if (activeCategory === "assists") title = "Assists";

    return (
      <SectionRenderer
        markets={activeMarkets}
        selectedMarketId={selectedMarketId}
        selectedOutcome={selectedOutcome}
        onSelectOutcome={handleSelectOutcome}
        config={config}
        expandedMarketId={expandedMarketId}
        onToggleExpand={handleToggleExpand}
        title={title}
        eventSlug={event.slug}
      />
    );
  };

  return (
    <div className="max-w-7xl mx-auto pb-24 lg:pb-0">
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
          {/* Sports Header */}
          <SportsEventHeader event={event} />

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

          {/* Category tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <MarketCategoryTabs
              categories={config.categories}
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

      {/* Mobile fixed bottom bar - shown when outcome is selected */}
      {selectedMarket && selectedOutcome !== null && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border p-4 shadow-lg">
          <SportsBettingSidebar
            event={event}
            selectedMarket={selectedMarket}
            selectedOutcome={selectedOutcome}
            onClearSelection={handleClearSelection}
            compact
          />
        </div>
      )}
    </div>
  );
}
