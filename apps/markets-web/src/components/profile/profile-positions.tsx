"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Skeleton } from "@vault/ui";
import { ArrowUpRight, Target, Gift } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { getMarketUrl } from "@/lib/urls";
import { SellPositionModal } from "./sell-position-modal";
import { RedeemPositionsModal } from "./redeem-positions-modal";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

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
  onSellComplete: () => void;
}

function PositionRow({ position, outcomeIndex, shares, avgCost, onSellComplete }: PositionRowProps) {
  const [showSellModal, setShowSellModal] = useState(false);

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
        "py-4 border-b border-border/50 last:border-0",
        isClaimed && "opacity-60"
      )}>
        <div className="flex items-center gap-4">
          {/* Market info */}
          <div className="flex-1 min-w-0">
            <Link
              href={getMarketUrl(eventSlug)}
              className="font-medium hover:text-primary transition-colors inline-flex items-center gap-1 group/link"
            >
              <span className="truncate">{title}</span>
              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
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
                  <div className="text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                    Pending claim
                  </div>
                ) : didLose ? (
                  <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    Lost
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <>
              {isOpen && (
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

      {/* Sell Modal */}
      {!isSettled && (
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
    </>
  );
}

interface RedeemableSummary {
  totalRedeemable: number;
  positionsCount: number;
  winnersCount: number;
  losersCount: number;
}

export function ProfilePositions() {
  const queryClient = useQueryClient();
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const authFetch = useAuthFetch();

  const { data: positions, isLoading, error } = useQuery({
    queryKey: ["positions"],
    queryFn: async (): Promise<Position[]> => {
      const res = await authFetch("/api/me/positions");
      if (!res.ok) throw new Error("Failed to fetch positions");
      return res.json();
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
  });

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

  // Flatten positions
  const positionRows: Array<{
    position: Position;
    outcomeIndex: 0 | 1;
    shares: number;
    avgCost: number;
  }> = [];

  // Minimum shares threshold to filter out dust from floating-point precision
  const MIN_SHARES_THRESHOLD = 0.01;

  positions?.forEach((position) => {
    if (position.shares0 >= MIN_SHARES_THRESHOLD) {
      positionRows.push({
        position,
        outcomeIndex: 0,
        shares: position.shares0,
        avgCost: position.avgCost0,
      });
    }
    if (position.shares1 >= MIN_SHARES_THRESHOLD) {
      positionRows.push({
        position,
        outcomeIndex: 1,
        shares: position.shares1,
        avgCost: position.avgCost1,
      });
    }
  });

  // Get redeemable positions from API summary
  const hasRedeemable = redeemableSummary && redeemableSummary.positionsCount > 0;

  if (positionRows.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">No open positions</p>
        <Link href="/">
          <Button variant="outline">Browse markets</Button>
        </Link>
      </div>
    );
  }

  // Calculate totals
  const totals = positionRows.reduce(
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

  return (
    <div>
      {/* Redeemable positions banner */}
      {hasRedeemable && redeemableSummary && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-primary/10 border border-green-500/20">
          <div className="flex items-center justify-between gap-4">
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

      {/* Redeem Modal */}
      <RedeemPositionsModal
        open={showRedeemModal}
        onOpenChange={setShowRedeemModal}
      />

      {/* Summary bar */}
      <div className="flex items-center gap-6 pb-4 mb-2 text-sm">
        <div>
          <span className="text-muted-foreground">Value</span>
          <span className="ml-2 font-bold tabular-nums">
            ${totals.totalValue.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Cost</span>
          <span className="ml-2 font-medium tabular-nums">
            ${totals.totalCost.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">P&L</span>
          <span className={cn(
            "ml-2 font-bold tabular-nums",
            totals.totalPnL >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {totals.totalPnL >= 0 ? "+" : ""}${totals.totalPnL.toFixed(2)}
          </span>
        </div>
        <div className="text-muted-foreground">
          {positionRows.length} position{positionRows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Position list */}
      <div>
        {positionRows.map((row) => (
          <PositionRow
            key={`${row.position.id}-${row.outcomeIndex}`}
            position={row.position}
            outcomeIndex={row.outcomeIndex}
            shares={row.shares}
            avgCost={row.avgCost}
            onSellComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["positions"] });
            }}
          />
        ))}
      </div>
    </div>
  );
}
