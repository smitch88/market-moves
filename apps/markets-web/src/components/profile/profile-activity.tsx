"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button, Skeleton } from "@vault/ui";
import { ArrowUpRight, Activity, Gift } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { getMarketUrl } from "@/lib/urls";
import { getOutcomeColors } from "@/lib/outcome-colors";

interface BetEntry {
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
    event?: {
      slug: string;
      title: string;
    };
  };
}

interface RedemptionEntry {
  id: string;
  type: "REDEMPTION";
  amount: number;
  createdAt: string;
  outcomeIndex: number;
  outcomeLabel?: string;
  outcomeColor?: string;
  market: {
    question?: string;
    outcomes?: string;
    outcomeColors?: string;
    event?: {
      slug: string;
      title: string;
    };
  } | null;
}

interface ProfileActivityProps {
  bets: BetEntry[];
  redemptions?: RedemptionEntry[];
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


type ActivityEntry = 
  | (BetEntry & { entryType: "bet" })
  | (RedemptionEntry & { entryType: "redemption" });

export function ProfileActivity({ bets, redemptions = [], isLoading }: ProfileActivityProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
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

  // Merge and sort all activity entries by date
  const allActivity: ActivityEntry[] = [
    ...bets.map((bet) => ({ ...bet, entryType: "bet" as const })),
    ...redemptions.map((r) => ({ ...r, entryType: "redemption" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (allActivity.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">No trading activity yet</p>
        <Link href="/">
          <Button variant="outline">Browse markets</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allActivity.map((entry) => {
        if (entry.entryType === "redemption") {
          return <RedemptionRow key={entry.id} redemption={entry} />;
        }
        return <BetRow key={entry.id} bet={entry} />;
      })}
    </div>
  );
}

function BetRow({ bet }: { bet: BetEntry }) {
  const outcomes = parseOutcomes(bet.market.outcomes);
  const colors = getOutcomeColors(outcomes);
  const outcomeLabel = bet.outcomeLabel || outcomes[bet.outcomeIndex] || "Unknown";
  const outcomeColor = colors[bet.outcomeIndex];
  const eventSlug = bet.market.event?.slug || bet.market.slug || "";
  const title = bet.market.event?.title || bet.market.question || "Market";
  const isSell = bet.tradeType === "SELL";
  const displayAmount = Math.abs(bet.amount);
  const timeAgo = formatDistanceToNow(new Date(bet.createdAt), { addSuffix: true });

  return (
    <Link
      href={getMarketUrl(eventSlug)}
      className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card/50 group transition-all duration-200 hover:border-border hover:bg-card/80 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5"
    >
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
}

function RedemptionRow({ redemption }: { redemption: RedemptionEntry }) {
  const outcomes = parseOutcomes(redemption.market?.outcomes);
  const colors = getOutcomeColors(outcomes);
  const outcomeLabel = redemption.outcomeLabel || outcomes[redemption.outcomeIndex] || "Unknown";
  const outcomeColor = redemption.outcomeColor || colors[redemption.outcomeIndex];
  const eventSlug = redemption.market?.event?.slug || "";
  const title = redemption.market?.event?.title || redemption.market?.question || "Market";
  const timeAgo = formatDistanceToNow(new Date(redemption.createdAt), { addSuffix: true });

  const content = (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card/50 group transition-all duration-200 hover:border-border hover:bg-card/80 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 cursor-pointer">
      {/* Gift icon for redemption */}
      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
        <Gift className="h-3.5 w-3.5 text-green-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate group-hover:text-primary transition-colors">
            {title}
          </span>
          {eventSlug && (
            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-primary" />
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">
          <span className="text-green-500">Redeemed</span>
          <span className="mx-1">payout of</span>
          <span className="tabular-nums font-medium text-green-500">
            +${redemption.amount.toFixed(2)}
          </span>
          <span className="mx-1">on</span>
          <span style={{ color: outcomeColor }} className="font-medium">
            {outcomeLabel}
          </span>
        </div>
      </div>

      {/* Time */}
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-muted-foreground">{timeAgo}</div>
        <div className="text-xs text-green-500 mt-0.5">Claimed</div>
      </div>
    </div>
  );

  if (eventSlug) {
    return (
      <Link href={getMarketUrl(eventSlug)} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
