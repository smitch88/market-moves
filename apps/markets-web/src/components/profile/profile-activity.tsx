"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button, Skeleton } from "@vault/ui";
import { ArrowUpRight, Activity } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { getMarketUrl } from "@/lib/urls";

interface ProfileActivityProps {
  bets: Array<{
    id: string;
    amount: number;
    shares?: number;
    tradeType?: string;
    status: string;
    createdAt: string;
    outcomeIndex: number;
    outcomeLabel?: string;
    market: {
      slug?: string;
      question?: string;
      outcomes?: string;
      outcomeColors?: string;
      event?: {
        slug: string;
        title: string;
      };
    };
  }>;
  isLoading: boolean;
}

function parseOutcomes(outcomes: string | undefined): string[] {
  if (!outcomes) return ["Yes", "No"];
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

function parseOutcomeColors(colors: string | undefined): string[] {
  if (!colors) return ["#22c55e", "#ef4444"];
  try {
    return JSON.parse(colors);
  } catch {
    return ["#22c55e", "#ef4444"];
  }
}

export function ProfileActivity({ bets, isLoading }: ProfileActivityProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="w-2 h-6 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="text-center py-16">
        <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">No trading activity yet</p>
        <Link href="/">
          <Button variant="outline">Browse markets</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {bets.map((bet) => {
        const outcomes = parseOutcomes(bet.market.outcomes);
        const colors = parseOutcomeColors(bet.market.outcomeColors);
        const outcomeLabel = bet.outcomeLabel || outcomes[bet.outcomeIndex] || "Unknown";
        const outcomeColor = colors[bet.outcomeIndex];
        const eventSlug = bet.market.event?.slug || bet.market.slug || "";
        const title = bet.market.event?.title || bet.market.question || "Market";
        const isSell = bet.tradeType === "SELL";
        const displayAmount = Math.abs(bet.amount);
        const timeAgo = formatDistanceToNow(new Date(bet.createdAt), { addSuffix: true });

        return (
          <Link
            key={bet.id}
            href={getMarketUrl(eventSlug)}
            className="flex items-center gap-4 py-4 border-b border-border/50 last:border-0 group hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
          >
            {/* Outcome indicator */}
            <div
              className="w-2 h-6 rounded-full flex-shrink-0"
              style={{ backgroundColor: outcomeColor }}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate group-hover:text-primary transition-colors">
                  {title}
                </span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-primary" />
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                <span className={isSell ? "text-red-500" : "text-green-500"}>
                  {isSell ? "Sold" : "Bought"}
                </span>
                {bet.shares && (
                  <span className="ml-1 tabular-nums">
                    {Math.abs(bet.shares).toFixed(2)} shares
                  </span>
                )}
                <span className="mx-1">for</span>
                <span className="tabular-nums font-medium text-foreground">
                  ${displayAmount.toLocaleString()}
                </span>
                <span className="mx-1">on</span>
                <span style={{ color: outcomeColor }} className="font-medium">
                  {outcomeLabel}
                </span>
              </div>
            </div>

            {/* Time & Status */}
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-muted-foreground">{timeAgo}</div>
              {bet.status === "PENDING_TWEET" && (
                <div className="text-xs text-amber-500 mt-0.5">Pending</div>
              )}
              {bet.status === "WON" && (
                <div className="text-xs text-green-500 mt-0.5">Won</div>
              )}
              {bet.status === "LOST" && (
                <div className="text-xs text-red-500 mt-0.5">Lost</div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
