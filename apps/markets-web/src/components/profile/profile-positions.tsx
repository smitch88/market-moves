"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@vault/ui";
import { ArrowUpRight, Gift, Zap, PieChart, Share2, Trophy } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { getMarketUrl } from "@/lib/urls";
import { SellPositionModal } from "./sell-position-modal";
import { RedeemPositionsModal } from "./redeem-positions-modal";
import { ShareXPModal } from "./share-xp-modal";
import { ShareMarketPnLModal } from "./share-market-pnl-modal";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

type PositionFilter = "active" | "closed";

interface Position {
  id: string;
  shares0: number;
  shares1: number;
  avgCost0: number;
  avgCost1: number;
  amount0: number;
  amount1: number;
  updatedAt: string;
  claimedAt: string | null;
  market: {
    id: string;
    question: string;
    outcomes: string;
    outcomePrices: string;
    outcomeColors?: string;
    status: string;
    reserve0: number;
    reserve1: number;
    resolvedOutcome: number | null;
    settledAt: string | null;
    feeBps: number;
    pool0: number;
    pool1: number;
    seed0: number;
    seed1: number;
    event?: {
      id: string;
      title: string;
      slug: string;
    };
  };
}

interface UnsharedBet {
  id: string;
  marketId: string;
  outcomeIndex: number;
  amount: number;
  createdAt: string;
  market: {
    id: string;
    question: string;
    outcomes: string;
    event: {
      id: string;
      slug: string;
      title: string;
    };
  };
}

function parseJsonArray(json: string | undefined, fallback: string[]): string[] {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function parseNumericArray(json: string | undefined): number[] {
  if (!json) return [0.5, 0.5];
  try {
    const arr = JSON.parse(json);
    return arr.map((v: string | number) => Number(v));
  } catch {
    return [0.5, 0.5];
  }
}

interface RedeemableSummary {
  totalRedeemable: number;
  positionsCount: number;
  winnersCount: number;
  losersCount: number;
}

export interface ProfilePositionsProps {
  /** User handle for public profile view. If not provided, fetches current user's positions. */
  userHandle?: string;
  /** If true, hides sell/redeem/boost functionality (for public profiles) */
  readOnly?: boolean;
}

export function ProfilePositions({ userHandle, readOnly = false }: ProfilePositionsProps = {}) {
  const queryClient = useQueryClient();
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("active");
  const authFetch = useAuthFetch();

  // For public profiles, fetch from public API
  const isPublicView = !!userHandle;

  const { data: positions, isLoading, error } = useQuery({
    queryKey: isPublicView ? ["public-positions", userHandle] : ["positions", positionFilter],
    queryFn: async (): Promise<Position[]> => {
      if (isPublicView) {
        const res = await fetch(`/api/users/${userHandle}/positions`);
        if (!res.ok) throw new Error("Failed to fetch positions");
        const data = await res.json();
        // Transform public API response to match Position interface
        return data.map((pos: {
          id: string;
          marketId: string;
          shares0: number;
          shares1: number;
          avgCost0: number;
          avgCost1: number;
          totalCost: number;
          totalValue: number;
          unrealizedPnL: number;
          lastBetAt: string | null;
          market: {
            id: string;
            question: string;
            status: string;
            outcomes: string[];
            outcomeColors: string[];
            outcomePrices: number[];
            resolvedOutcome: number | null;
            settledAt: string | null;
            feeBps: number;
            event: { slug: string; title: string } | null;
          };
        }) => ({
          ...pos,
          amount0: 0,
          amount1: 0,
          updatedAt: pos.lastBetAt || new Date().toISOString(),
          claimedAt: null,
          market: {
            ...pos.market,
            outcomes: JSON.stringify(pos.market.outcomes),
            outcomeColors: JSON.stringify(pos.market.outcomeColors),
            outcomePrices: JSON.stringify(pos.market.outcomePrices),
            reserve0: 0,
            reserve1: 0,
            pool0: 0,
            pool1: 0,
            seed0: 0,
            seed1: 0,
            feeBps: pos.market.feeBps || 100,
            event: pos.market.event ? {
              id: pos.market.event.slug,
              title: pos.market.event.title,
              slug: pos.market.event.slug,
            } : undefined,
          },
        }));
      } else {
        const res = await authFetch(`/api/me/positions?filter=${positionFilter}`);
        if (!res.ok) throw new Error("Failed to fetch positions");
        return res.json();
      }
    },
  });

  const { data: redeemableSummary } = useQuery({
    queryKey: ["redeemable-positions"],
    queryFn: async (): Promise<RedeemableSummary | null> => {
      try {
        const res = await authFetch("/api/me/redeem");
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !isPublicView, // Only fetch for own profile
  });

  // Fetch unshared bets for Boost XP feature
  const { data: unsharedBets } = useQuery({
    queryKey: ["unshared-bets"],
    queryFn: async (): Promise<UnsharedBet[]> => {
      const res = await authFetch("/api/me/bets/unshared");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isPublicView, // Only fetch for own profile
  });

  // Fetch profile for share modal
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await authFetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !isPublicView, // Only fetch for own profile
  });

  // Create a map of marketId-outcomeIndex to unshared bet for quick lookup
  const unsharedBetMap = useMemo(() => {
    const map = new Map<string, UnsharedBet>();
    unsharedBets?.forEach((bet) => {
      const key = `${bet.marketId}-${bet.outcomeIndex}`;
      map.set(key, bet);
    });
    return map;
  }, [unsharedBets]);

  // Minimum shares threshold to filter out dust from floating-point precision
  const MIN_SHARES_THRESHOLD = 0.01;

  // Flatten positions - memoized to ensure consistent hook order
  const allPositionRows = useMemo(() => {
    const rows: Array<{
      position: Position;
      outcomeIndex: 0 | 1;
      shares: number;
      avgCost: number;
    }> = [];

    positions?.forEach((position) => {
      if (position.shares0 >= MIN_SHARES_THRESHOLD) {
        rows.push({
          position,
          outcomeIndex: 0,
          shares: position.shares0,
          avgCost: position.avgCost0,
        });
      }
      if (position.shares1 >= MIN_SHARES_THRESHOLD) {
        rows.push({
          position,
          outcomeIndex: 1,
          shares: position.shares1,
          avgCost: position.avgCost1,
        });
      }
    });

    return rows;
  }, [positions]);

  // Use all positions (no filtering)
  const positionRows = allPositionRows;

  // Group positions by market for "By Market" view
  const marketPositions = useMemo(() => {
    const marketMap = new Map<string, {
      marketId: string;
      eventTitle: string;
      eventSlug: string;
      marketQuestion: string;
      marketStatus: string;
      isSettled: boolean;
      settledAt: string | null;
      resolvedOutcome: number | null;
      outcomes: string[];
      outcomeColors: string[];
      positions: Array<{
        position: Position; // Original position for sell modal
        outcomeIndex: 0 | 1;
        outcomeLabel: string;
        outcomeColor: string;
        shares: number;
        avgCost: number;
        currentPrice: number;
        currentValue: number;
        costBasis: number;
        pnl: number;
        didWin: boolean;
        didLose: boolean;
        settledValue: number;
        realizedPnL: number;
        feeBps: number;
      }>;
      totalCost: number;
      totalValue: number;
      totalPnL: number;
      totalShares: number;
    }>();

    positionRows.forEach((row) => {
      const { position, outcomeIndex, shares, avgCost } = row;
      const { market } = position;
      
      const prices = parseNumericArray(market.outcomePrices);
      const outcomes = parseJsonArray(market.outcomes, ["Yes", "No"]);
      const colors = parseJsonArray(market.outcomeColors, ["#22c55e", "#ef4444"]);
      const currentPrice = prices[outcomeIndex];
      const currentValue = shares * currentPrice;
      const costBasis = shares * avgCost;
      const pnl = currentValue - costBasis;
      
      const isSettled = market.settledAt !== null;
      const didWin = isSettled && market.resolvedOutcome === outcomeIndex;
      const didLose = isSettled && market.resolvedOutcome !== null && market.resolvedOutcome !== outcomeIndex;
      
      const fee = (market.feeBps || 100) / 10000;
      const settledValue = didWin ? Math.floor(shares * (1 - fee)) : 0;
      const realizedPnL = settledValue - costBasis;

      const eventTitle = market.event?.title || market.question || "Unknown Market";
      const eventSlug = market.event?.slug || "";

      if (!marketMap.has(market.id)) {
        marketMap.set(market.id, {
          marketId: market.id,
          eventTitle,
          eventSlug,
          marketQuestion: market.question || "",
          marketStatus: market.status,
          isSettled,
          settledAt: market.settledAt,
          resolvedOutcome: market.resolvedOutcome,
          outcomes,
          outcomeColors: colors,
          positions: [],
          totalCost: 0,
          totalValue: 0,
          totalPnL: 0,
          totalShares: 0,
        });
      }

      const marketData = marketMap.get(market.id)!;
      marketData.positions.push({
        position, // Original position for sell modal
        outcomeIndex,
        outcomeLabel: outcomes[outcomeIndex] || `Outcome ${outcomeIndex}`,
        outcomeColor: colors[outcomeIndex] || "#666",
        shares,
        avgCost,
        currentPrice,
        currentValue,
        costBasis,
        pnl,
        didWin,
        didLose,
        settledValue,
        realizedPnL,
        feeBps: market.feeBps || 100,
      });

      if (isSettled) {
        marketData.totalValue += settledValue;
        marketData.totalPnL += realizedPnL;
      } else {
        marketData.totalValue += currentValue;
        marketData.totalPnL += pnl;
      }
      marketData.totalCost += costBasis;
      marketData.totalShares += shares;
    });

    return Array.from(marketMap.values());
  }, [positionRows]);

  // Calculate totals - memoized for consistent hook order
  // Accounts for settled positions using their final value instead of current price
  const totals = useMemo(() => {
    return positionRows.reduce(
      (acc, row) => {
        const { market } = row.position;
        const isSettled = market.settledAt !== null;
        const costBasis = row.shares * row.avgCost;
        
        let currentValue: number;
        if (isSettled) {
          // For settled markets, use final value (1 share = $1 for winners, $0 for losers)
          const didWin = market.resolvedOutcome === row.outcomeIndex;
          const fee = (market.feeBps || 100) / 10000;
          currentValue = didWin ? Math.floor(row.shares * (1 - fee)) : 0;
        } else {
          // For open markets, use current price
          const prices = parseNumericArray(market.outcomePrices);
          const currentPrice = prices[row.outcomeIndex];
          currentValue = row.shares * currentPrice;
        }
        
        return {
          totalValue: acc.totalValue + currentValue,
          totalCost: acc.totalCost + costBasis,
          totalPnL: acc.totalPnL + (currentValue - costBasis),
        };
      },
      { totalValue: 0, totalCost: 0, totalPnL: 0 }
    );
  }, [positionRows]);

  // Get redeemable positions from API summary (only for own profile)
  const hasRedeemable = !isPublicView && redeemableSummary && redeemableSummary.positionsCount > 0;

  // Early returns AFTER all hooks have been called
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-1 text-right">
              <Skeleton className="h-5 w-16 ml-auto" />
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Failed to load positions
      </div>
    );
  }

  if (allPositionRows.length === 0) {
    return (
      <div>
        {/* Filter toggle - only for own profile */}
        {!isPublicView && (
          <div className="flex items-center gap-3 pb-4 mb-2">
            <div className="flex items-center border border-border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPositionFilter("active")}
                className={cn(
                  "h-8 px-3 rounded-r-none border-r border-border text-xs",
                  positionFilter === "active" && "bg-muted"
                )}
              >
                Active
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPositionFilter("closed")}
                className={cn(
                  "h-8 px-3 rounded-l-none text-xs",
                  positionFilter === "closed" && "bg-muted"
                )}
              >
                Closed
              </Button>
            </div>
          </div>
        )}
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">
            {positionFilter === "closed" ? "No closed positions" : "No active positions"}
          </p>
          {!isPublicView && positionFilter === "active" && (
            <Link href="/">
              <Button variant="outline">Browse markets</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Redeemable positions banner - only for own profile viewing active positions */}
      {!isPublicView && positionFilter === "active" && hasRedeemable && redeemableSummary && (
        <div className="mb-6 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-primary/10 border border-green-500/20">
          {/* Mobile layout */}
          <div className="sm:hidden space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20 animate-pulse">
                <Gift className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Winnings Ready</h3>
                <p className="text-sm text-muted-foreground">
                  {redeemableSummary.winnersCount} winning position{redeemableSummary.winnersCount !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-lg font-bold text-green-500">
                +${redeemableSummary.totalRedeemable.toFixed(2)}
              </p>
            </div>
            <Button 
              onClick={() => setShowRedeemModal(true)}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <Gift className="h-4 w-4 mr-2" />
              Redeem All
            </Button>
          </div>

          {/* Desktop layout */}
          <div className="hidden sm:flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-semibold">Winnings Ready to Claim</h3>
                <p className="text-sm text-muted-foreground">
                  {redeemableSummary.winnersCount} winning position{redeemableSummary.winnersCount !== 1 ? "s" : ""} from settled markets
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-lg font-bold text-green-500">
                +${redeemableSummary.totalRedeemable.toFixed(2)}
              </p>
              <Button 
                onClick={() => setShowRedeemModal(true)}
                className="bg-green-500 hover:bg-green-600"
              >
                Redeem {redeemableSummary.winnersCount} Position{redeemableSummary.winnersCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Modal - only for own profile */}
      {!isPublicView && (
        <RedeemPositionsModal
          open={showRedeemModal}
          onOpenChange={setShowRedeemModal}
        />
      )}

      {/* Stats + View toggle bar */}
      <div className="flex items-center justify-between gap-4 pb-4 mb-2">
        {/* Left side: Filter + Stats */}
        <div className="flex items-center gap-3">
          {/* Filter toggle - only for own profile */}
          {!isPublicView && (
            <div className="flex items-center border border-border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPositionFilter("active")}
                className={cn(
                  "h-8 px-3 rounded-r-none border-r border-border text-xs",
                  positionFilter === "active" && "bg-muted"
                )}
              >
                Active
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPositionFilter("closed")}
                className={cn(
                  "h-8 px-3 rounded-l-none text-xs",
                  positionFilter === "closed" && "bg-muted"
                )}
              >
                Closed
              </Button>
            </div>
          )}

          {/* Mobile: Stats button */}
          <div className="sm:hidden">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs px-2">
                <span className="font-bold tabular-nums">${totals.totalValue.toFixed(2)}</span>
                {totals.totalCost > 0 && (
                  <span className={cn(
                    "tabular-nums",
                    totals.totalPnL >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {totals.totalPnL >= 0 ? "+" : ""}{((totals.totalPnL / totals.totalCost) * 100).toFixed(0)}%
                  </span>
                )}
                <PieChart className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  Portfolio Summary
                </DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 gap-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <span className="text-muted-foreground">Total Value</span>
                  <span className="text-xl font-bold tabular-nums">${totals.totalValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <span className="text-muted-foreground">Cost Basis</span>
                  <span className="text-xl font-bold tabular-nums">${totals.totalCost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <span className="text-muted-foreground">Unrealized P&L</span>
                  <div className="text-right">
                    <span className={cn(
                      "text-xl font-bold tabular-nums",
                      totals.totalPnL >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {totals.totalPnL >= 0 ? "+" : ""}${totals.totalPnL.toFixed(2)}
                    </span>
                    {totals.totalCost > 0 && (
                      <span className={cn(
                        "text-sm ml-2 tabular-nums",
                        totals.totalPnL >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        ({totals.totalPnL >= 0 ? "+" : ""}{((totals.totalPnL / totals.totalCost) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <span className="text-muted-foreground">Positions</span>
                  <span className="text-xl font-bold tabular-nums">{positionRows.length}</span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Desktop: Inline stats on left */}
        <div className="hidden sm:flex items-center gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Value</span>
            <span className="ml-1.5 font-bold tabular-nums">
              ${totals.totalValue.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Cost</span>
            <span className="ml-1.5 font-medium tabular-nums">
              ${totals.totalCost.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">P&L</span>
            <span className={cn(
              "ml-1.5 font-bold tabular-nums",
              totals.totalPnL >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {totals.totalPnL >= 0 ? "+" : ""}${totals.totalPnL.toFixed(2)}
            </span>
          </div>
          <div className="text-muted-foreground">
            {positionRows.length} position{positionRows.length !== 1 ? "s" : ""}
          </div>
        </div>
        </div>
      </div>

      {/* Position list */}
      <div className="space-y-3">
        {marketPositions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No positions yet</p>
            {!isPublicView && (
              <Link href="/">
                <Button variant="outline" size="sm" className="mt-2">
                  Browse markets
                </Button>
              </Link>
            )}
          </div>
        ) : (
          marketPositions.map((market) => (
            <MarketPositionCard
              key={market.marketId}
              market={market}
              profile={profile}
              readOnly={readOnly || isPublicView}
              unsharedBetMap={isPublicView ? undefined : unsharedBetMap}
              onSellComplete={isPublicView ? undefined : () => {
                queryClient.invalidateQueries({ queryKey: ["positions"] });
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Market Position Card for "By Market" view
interface MarketPositionCardProps {
  market: {
    marketId: string;
    eventTitle: string;
    eventSlug: string;
    marketQuestion: string;
    marketStatus: string;
    isSettled: boolean;
    settledAt: string | null;
    resolvedOutcome: number | null;
    outcomes: string[];
    outcomeColors: string[];
    positions: Array<{
      position: Position;
      outcomeIndex: 0 | 1;
      outcomeLabel: string;
      outcomeColor: string;
      shares: number;
      avgCost: number;
      currentPrice: number;
      currentValue: number;
      costBasis: number;
      pnl: number;
      didWin: boolean;
      didLose: boolean;
      settledValue: number;
      realizedPnL: number;
      feeBps: number;
    }>;
    totalCost: number;
    totalValue: number;
    totalPnL: number;
    totalShares: number;
  };
  profile?: {
    name?: string | null;
    handle?: string | null;
    profileImageUrl?: string | null;
  } | null;
  readOnly?: boolean;
  unsharedBetMap?: Map<string, UnsharedBet>;
  onSellComplete?: () => void;
}

function MarketPositionCard({ market, profile, readOnly = false, unsharedBetMap, onSellComplete }: MarketPositionCardProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [sellModalPosition, setSellModalPosition] = useState<{
    position: Position;
    outcomeIndex: 0 | 1;
    outcomeLabel: string;
    outcomeColor: string;
    shares: number;
    avgCost: number;
  } | null>(null);
  const [boostModalBet, setBoostModalBet] = useState<UnsharedBet | null>(null);

  const isProfitable = market.totalPnL > 0;
  const pnlPercent = market.totalCost > 0 ? (market.totalPnL / market.totalCost) * 100 : 0;
  
  // Check if any position won
  const hasWinner = market.positions.some(p => p.didWin);
  const allLost = market.isSettled && market.positions.every(p => p.didLose);
  const isOpen = market.marketStatus === "OPEN" || market.marketStatus === "PUBLISHED";

  return (
    <>
      <div className={cn(
        "p-4 rounded-lg border border-border/50 bg-card/50 transition-all duration-200 hover:border-border hover:bg-card/80"
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <Link
              href={getMarketUrl(market.eventSlug)}
              className="font-medium hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <span className="line-clamp-1">{market.eventTitle}</span>
              <ArrowUpRight className="h-3 w-3 opacity-50 flex-shrink-0" />
            </Link>
            {market.marketQuestion && market.marketQuestion !== market.eventTitle && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{market.marketQuestion}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {market.isSettled && (
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded",
                hasWinner ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                allLost ? "bg-muted/50 text-muted-foreground" :
                "bg-muted/50 text-muted-foreground"
              )}>
                {hasWinner ? "Won" : allLost ? "Lost" : "Settled"}
              </span>
            )}
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareModal(true)}
                className="h-7 px-2 gap-1"
              >
                <Share2 className="h-3 w-3" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            )}
          </div>
        </div>

        {/* Positions breakdown */}
        <div className="space-y-2 mb-3">
          {market.positions.map((pos, idx) => {
            const positionKey = `${market.marketId}-${pos.outcomeIndex}`;
            const unsharedBet = unsharedBetMap?.get(positionKey);
            
            return (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: pos.outcomeColor }}
                  />
                  <span className={cn(
                    pos.didWin && "text-green-500 font-medium",
                    pos.didLose && "text-muted-foreground"
                  )}>
                    {pos.outcomeLabel}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {pos.shares.toFixed(2)} @ ${pos.avgCost.toFixed(2)}
                  </span>
                  {pos.didWin && <Trophy className="h-3 w-3 text-green-500" />}
                </div>
                <div className="flex items-center gap-2">
                  {/* Boost MP button */}
                  {!readOnly && unsharedBet && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBoostModalBet(unsharedBet)}
                      className="h-7 px-2 gap-1 text-xs text-[#df2421] border-[#df2421]/30 hover:bg-[#df2421]/10 hover:text-[#df2421]"
                    >
                      <Zap className="h-3 w-3" />
                      +MP
                    </Button>
                  )}
                  {/* Sell button */}
                  {!readOnly && isOpen && !market.isSettled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSellModalPosition({
                        position: pos.position,
                        outcomeIndex: pos.outcomeIndex,
                        outcomeLabel: pos.outcomeLabel,
                        outcomeColor: pos.outcomeColor,
                        shares: pos.shares,
                        avgCost: pos.avgCost,
                      })}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Sell
                    </Button>
                  )}
                  <span className={cn(
                    "font-medium tabular-nums text-sm",
                    market.isSettled
                      ? (pos.realizedPnL >= 0 ? "text-green-500" : "text-red-500")
                      : (pos.pnl >= 0 ? "text-green-500" : "text-red-500")
                  )}>
                    {(market.isSettled ? pos.realizedPnL : pos.pnl) >= 0 ? "+" : ""}
                    ${Math.abs(market.isSettled ? pos.realizedPnL : pos.pnl).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Cost: <span className="text-foreground tabular-nums">${market.totalCost.toFixed(2)}</span></span>
            <span>Value: <span className="text-foreground tabular-nums">${market.totalValue.toFixed(2)}</span></span>
          </div>
          <div className="text-right">
            <span className={cn(
              "font-bold tabular-nums",
              isProfitable ? "text-green-500" : "text-red-500"
            )}>
              {isProfitable ? "+" : ""}${market.totalPnL.toFixed(2)}
            </span>
            <span className={cn(
              "text-xs ml-1 tabular-nums",
              isProfitable ? "text-green-500/70" : "text-red-500/70"
            )}>
              ({isProfitable ? "+" : ""}{pnlPercent.toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareMarketPnLModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        eventTitle={market.eventTitle}
        eventSlug={market.eventSlug}
        marketQuestion={market.marketQuestion}
        isSettled={market.isSettled}
        outcomes={market.outcomes}
        outcomeColors={market.outcomeColors}
        positions={market.positions}
        totalCost={market.totalCost}
        totalValue={market.totalValue}
        totalPnL={market.totalPnL}
        totalShares={market.totalShares}
        profile={profile}
      />

      {/* Sell Modal */}
      {sellModalPosition && onSellComplete && (
        <SellPositionModal
          open={!!sellModalPosition}
          onOpenChange={(open) => !open && setSellModalPosition(null)}
          position={sellModalPosition.position}
          outcomeIndex={sellModalPosition.outcomeIndex}
          outcomeLabel={sellModalPosition.outcomeLabel}
          outcomeColor={sellModalPosition.outcomeColor}
          maxShares={sellModalPosition.shares}
          avgCost={sellModalPosition.avgCost}
          onSellComplete={() => {
            setSellModalPosition(null);
            onSellComplete();
          }}
        />
      )}

      {/* Boost XP Modal */}
      {boostModalBet && (
        <ShareXPModal
          open={!!boostModalBet}
          onOpenChange={(open) => !open && setBoostModalBet(null)}
          bet={boostModalBet}
          profile={profile}
        />
      )}
    </>
  );
}
