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
import { ArrowUpRight, Gift, Zap, PieChart, Share2, Trophy, List, LayoutGrid } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { getMarketUrl } from "@/lib/urls";
import { SellPositionModal } from "./sell-position-modal";
import { RedeemPositionsModal } from "./redeem-positions-modal";
import { ShareXPModal } from "./share-xp-modal";
import { ShareWinModal } from "./share-win-modal";
import { ShareMarketPnLModal } from "./share-market-pnl-modal";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

type PositionView = "individual" | "by-market";

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


interface PositionRowProps {
  position: Position;
  outcomeIndex: 0 | 1;
  shares: number;
  avgCost: number;
  onSellComplete?: () => void;
  unsharedBet?: UnsharedBet | null;
  profile?: {
    name?: string | null;
    handle?: string | null;
    profileImageUrl?: string | null;
  } | null;
  /** If true, hides sell/boost buttons (for public profiles) */
  readOnly?: boolean;
}

function PositionRow({ position, outcomeIndex, shares, avgCost, onSellComplete, unsharedBet, profile, readOnly = false }: PositionRowProps) {
  const [showSellModal, setShowSellModal] = useState(false);
  const [showShareXPModal, setShowShareXPModal] = useState(false);
  const [showShareWinModal, setShowShareWinModal] = useState(false);

  const { market } = position;
  const outcomes = parseJsonArray(market.outcomes, ["Yes", "No"]);
  const prices = parseNumericArray(market.outcomePrices);
  const colors = parseJsonArray(market.outcomeColors, ["#22c55e", "#ef4444"]);

  const currentPrice = prices[outcomeIndex];
  const outcomeLabel = outcomes[outcomeIndex];
  const outcomeColor = colors[outcomeIndex];
  const eventSlug = market.event?.slug || "";
  const title = market.event?.title || market.question;

  const currentValue = shares * currentPrice; // Already in dollars
  const costBasis = shares * avgCost; // Already in dollars
  const unrealizedPnL = currentValue - costBasis;
  const pnlPercent = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;

  const isOpen = market.status === "OPEN" || market.status === "PUBLISHED";
  const isSettled = market.settledAt !== null;
  const isClaimed = position.claimedAt !== null;
  
  // Check if this position won/lost (only meaningful when settled)
  const didWin = isSettled && market.resolvedOutcome === outcomeIndex;
  const didLose = isSettled && market.resolvedOutcome !== null && market.resolvedOutcome !== outcomeIndex;
  
  // Calculate payout for settled positions (1 share = $1 for winners, minus fee)
  const fee = (market.feeBps || 100) / 10000;
  const settledValue = didWin ? Math.floor(shares * (1 - fee)) : 0;
  const realizedPnL = settledValue - costBasis;
  
  // Can redeem if settled but not claimed and is a winner
  const canRedeem = isSettled && !isClaimed && didWin;

  return (
    <>
      <div className={cn(
        "p-3 sm:p-4 rounded-lg border border-border/50 bg-card/50 transition-all duration-200 hover:border-border hover:bg-card/80 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 cursor-pointer group",
        isClaimed && "opacity-60 hover:opacity-70"
      )}>
        {/* Mobile: Condensed stacked layout */}
        <div className="sm:hidden space-y-2">
          {/* Title + outcome row */}
          <div>
            <Link
              href={getMarketUrl(eventSlug)}
              className="font-medium text-sm hover:text-primary group-hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <span className="line-clamp-1">{title}</span>
              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </Link>
            <div className="flex items-center gap-1.5 text-xs mt-0.5">
              <span style={{ color: outcomeColor }} className="font-medium">
                {outcomeLabel}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground tabular-nums">{shares.toFixed(2)} @ ${avgCost.toFixed(2)}</span>
              {isSettled && (
                <>
                  <span className="text-muted-foreground">·</span>
                  {didWin ? (
                    <span className="text-green-500 font-medium">Won</span>
                  ) : didLose ? (
                    <span className="text-muted-foreground">Lost</span>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Value + Actions row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-bold tabular-nums text-sm">
                {isSettled ? `$${settledValue.toFixed(2)}` : `$${currentValue.toFixed(2)}`}
              </div>
              <div className={cn(
                "text-xs tabular-nums",
                isSettled 
                  ? (realizedPnL >= 0 ? "text-green-500" : "text-red-500")
                  : (unrealizedPnL >= 0 ? "text-green-500" : "text-red-500")
              )}>
                {isSettled ? (
                  <>{realizedPnL >= 0 ? "+" : ""}{((realizedPnL / costBasis) * 100).toFixed(0)}%</>
                ) : (
                  <>{pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(0)}%</>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {!readOnly && unsharedBet && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShareXPModal(true)}
                  className="h-7 px-2 gap-1 text-[#df2421] border-[#df2421]/30 hover:bg-[#df2421]/10 hover:text-[#df2421]"
                >
                  <Zap className="h-3 w-3" />
                  +MP
                </Button>
              )}

              {/* Share Win button - mobile */}
              {didWin && realizedPnL > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShareWinModal(true)}
                  className="h-7 px-2 gap-1 text-green-500 border-green-500/30 hover:bg-green-500/10"
                >
                  <Share2 className="h-3 w-3" />
                </Button>
              )}
              
              {isSettled ? (
                isClaimed ? (
                  didWin ? (
                    <div className="text-[10px] text-green-500 font-medium bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                      ✓ Claimed
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      Settled
                    </div>
                  )
                ) : canRedeem ? (
                  readOnly ? (
                    <div className="text-[10px] text-green-500 font-medium bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                      Winner
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-500 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Pending
                    </div>
                  )
                ) : didLose ? (
                  <div className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    Lost
                  </div>
                ) : null
              ) : (
                !readOnly && isOpen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSellModal(true)}
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    Sell
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Desktop: Horizontal layout */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Market info */}
          <div className="flex-1 min-w-0">
            <Link
              href={getMarketUrl(eventSlug)}
              className="font-medium hover:text-primary group-hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <span className="truncate">{title}</span>
              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </Link>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground flex-wrap">
              <span style={{ color: outcomeColor }} className="font-medium">
                {outcomeLabel}
              </span>
              {isSettled && (
                <>
                  <span>·</span>
                  {didWin ? (
                    <span className="inline-flex items-center gap-1 text-green-500 font-medium">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Won
                    </span>
                  ) : didLose ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground"></span>
                      Lost
                    </span>
                  ) : null}
                </>
              )}
              <span>·</span>
              <span className="tabular-nums">{shares.toFixed(2)} shares</span>
              <span>·</span>
              <span className="tabular-nums">${avgCost.toFixed(2)} avg</span>
            </div>
          </div>

          {/* Value & P&L */}
          <div className="text-right flex-shrink-0">
            <div className="font-bold tabular-nums">
              {isSettled ? (
                <>
                  ${settledValue.toFixed(2)}
                  {!didWin && (
                    <span className="text-xs text-muted-foreground ml-1">(settled)</span>
                  )}
                </>
              ) : (
                `$${currentValue.toFixed(2)}`
              )}
            </div>
            <div className={cn(
              "text-sm tabular-nums",
              isSettled 
                ? (realizedPnL >= 0 ? "text-green-500" : "text-red-500")
                : (unrealizedPnL >= 0 ? "text-green-500" : "text-red-500")
            )}>
              {isSettled ? (
                <>
                  {realizedPnL >= 0 ? "+" : ""}${realizedPnL.toFixed(2)}
                  <span className="text-xs ml-1 opacity-70">
                    ({realizedPnL >= 0 ? "+" : ""}{((realizedPnL / costBasis) * 100).toFixed(0)}%)
                  </span>
                </>
              ) : (
                <>
                  {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toFixed(2)}
                  <span className="text-xs ml-1 opacity-70">
                    {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(0)}%
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Boost XP button - only show for own profile */}
            {!readOnly && unsharedBet && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareXPModal(true)}
                className="gap-1.5 text-[#df2421] border-[#df2421]/30 hover:bg-[#df2421]/10 hover:text-[#df2421]"
              >
                <Zap className="h-3.5 w-3.5" />
                Boost MP
              </Button>
            )}

            {/* Share Win button - only for won positions */}
            {didWin && realizedPnL > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareWinModal(true)}
                className="gap-1.5 text-green-500 border-green-500/30 hover:bg-green-500/10 hover:text-green-500"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share Win
              </Button>
            )}
            
            {isSettled ? (
              <div className="flex flex-col items-end gap-1">
                {isClaimed ? (
                  // Already claimed
                  didWin ? (
                    <div className="text-xs text-green-500 font-medium bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                      ✓ Claimed
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      Settled
                    </div>
                  )
                ) : (
                  // Not yet claimed
                  canRedeem ? (
                    readOnly ? (
                      <div className="text-xs text-green-500 font-medium bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                        Winner
                      </div>
                    ) : (
                      <div className="text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                        Pending claim
                      </div>
                    )
                  ) : didLose ? (
                    <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      Lost
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <>
                {!readOnly && isOpen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSellModal(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Sell
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sell Modal - only when not read-only */}
      {!readOnly && !isSettled && onSellComplete && (
        <SellPositionModal
          open={showSellModal}
          onOpenChange={setShowSellModal}
          position={position}
          outcomeIndex={outcomeIndex}
          outcomeLabel={outcomeLabel}
          outcomeColor={outcomeColor}
          maxShares={shares}
          avgCost={avgCost}
          onSellComplete={onSellComplete}
        />
      )}

      {/* Share XP Modal - only when not read-only */}
      {!readOnly && unsharedBet && (
        <ShareXPModal
          open={showShareXPModal}
          onOpenChange={setShowShareXPModal}
          bet={unsharedBet}
          profile={profile}
        />
      )}

      {/* Share Win Modal - for profitable won positions */}
      {didWin && realizedPnL > 0 && (
        <ShareWinModal
          open={showShareWinModal}
          onOpenChange={setShowShareWinModal}
          eventTitle={title}
          eventSlug={eventSlug}
          marketQuestion={market.question}
          outcomeLabel={outcomeLabel}
          wager={costBasis}
          profit={realizedPnL}
          payout={settledValue}
          profitPercent={(realizedPnL / costBasis) * 100}
          settledDate={market.settledAt ? new Date(market.settledAt) : undefined}
          profile={profile}
        />
      )}
    </>
  );
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
  const [positionView, setPositionView] = useState<PositionView>("individual");
  const authFetch = useAuthFetch();

  // For public profiles, fetch from public API
  const isPublicView = !!userHandle;

  const { data: positions, isLoading, error } = useQuery({
    queryKey: isPublicView ? ["public-positions", userHandle] : ["positions"],
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
        const res = await authFetch("/api/me/positions");
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
      isSettled: boolean;
      settledAt: string | null;
      resolvedOutcome: number | null;
      outcomes: string[];
      outcomeColors: string[];
      positions: Array<{
        outcomeIndex: 0 | 1;
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
        outcomeIndex,
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
  const totals = useMemo(() => {
    return positionRows.reduce(
      (acc, row) => {
        const prices = parseNumericArray(row.position.market.outcomePrices);
        const currentPrice = prices[row.outcomeIndex];
        const currentValue = row.shares * currentPrice; // Already in dollars
        const costBasis = row.shares * row.avgCost;
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
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">No open positions</p>
        {!isPublicView && (
          <Link href="/">
            <Button variant="outline">Browse markets</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Redeemable positions banner - only for own profile */}
      {!isPublicView && hasRedeemable && redeemableSummary && (
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
              <div className="p-2 rounded-full bg-green-500/20 animate-pulse">
                <Gift className="h-5 w-5 text-green-500" />
              </div>
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
                <Gift className="h-4 w-4 mr-2" />
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
        {/* Left: Stats - Modal on mobile, inline on desktop */}
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

        {/* Right: View toggle */}
        <div className="flex items-center border border-border rounded-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPositionView("individual")}
            className={cn(
              "h-8 px-2 rounded-r-none border-r border-border",
              positionView === "individual" && "bg-muted"
            )}
            title="Individual positions"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPositionView("by-market")}
            className={cn(
              "h-8 px-2 rounded-l-none",
              positionView === "by-market" && "bg-muted"
            )}
            title="Group by market"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Position list */}
      <div className="space-y-3">
        {positionRows.length === 0 ? (
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
        ) : positionView === "by-market" ? (
          // By Market View
          marketPositions.map((market) => (
            <MarketPositionCard
              key={market.marketId}
              market={market}
              profile={profile}
              readOnly={readOnly || isPublicView}
            />
          ))
        ) : (
          // Individual View
          positionRows.map((row) => {
            const positionKey = `${row.position.market.id}-${row.outcomeIndex}`;
            const unsharedBet = isPublicView ? undefined : unsharedBetMap.get(positionKey);
            
            return (
              <PositionRow
                key={`${row.position.id}-${row.outcomeIndex}`}
                position={row.position}
                outcomeIndex={row.outcomeIndex}
                shares={row.shares}
                avgCost={row.avgCost}
                onSellComplete={isPublicView ? undefined : () => {
                  queryClient.invalidateQueries({ queryKey: ["positions"] });
                }}
                unsharedBet={unsharedBet}
                profile={isPublicView ? undefined : profile}
                readOnly={readOnly || isPublicView}
              />
            );
          })
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
    isSettled: boolean;
    settledAt: string | null;
    resolvedOutcome: number | null;
    outcomes: string[];
    outcomeColors: string[];
    positions: Array<{
      outcomeIndex: 0 | 1;
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
}

function MarketPositionCard({ market, profile, readOnly = false }: MarketPositionCardProps) {
  const [showShareModal, setShowShareModal] = useState(false);

  const isProfitable = market.totalPnL > 0;
  const pnlPercent = market.totalCost > 0 ? (market.totalPnL / market.totalCost) * 100 : 0;
  
  // Check if any position won
  const hasWinner = market.positions.some(p => p.didWin);
  const allLost = market.isSettled && market.positions.every(p => p.didLose);

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
          {market.positions.map((pos, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: market.outcomeColors[pos.outcomeIndex] || "#666" }}
                />
                <span className={cn(
                  pos.didWin && "text-green-500 font-medium",
                  pos.didLose && "text-muted-foreground"
                )}>
                  {market.outcomes[pos.outcomeIndex] || `Outcome ${pos.outcomeIndex}`}
                </span>
                <span className="text-muted-foreground text-xs">
                  {pos.shares.toFixed(2)} @ ${pos.avgCost.toFixed(2)}
                </span>
                {pos.didWin && <Trophy className="h-3 w-3 text-green-500" />}
              </div>
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
          ))}
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
    </>
  );
}
