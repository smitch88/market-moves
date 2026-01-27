"use client";

import Link from "next/link";
import { format } from "date-fns";
import { GlassCard, GlassCardContent, Badge, Skeleton } from "@vault/ui";
import { getMarketUrl } from "@/lib/urls";

interface ProfileActivityProps {
  bets: Array<{
    id: string;
    amount: number;
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
  }>;
  isLoading: boolean;
}

// Helper to parse outcomes
function parseOutcomes(outcomes: string | undefined): string[] {
  if (!outcomes) return ["Yes", "No"];
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

export function ProfileActivity({ bets, isLoading }: ProfileActivityProps) {
  if (isLoading) {
    return (
      <GlassCard>
        <GlassCardContent className="pt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (bets.length === 0) {
    return (
      <GlassCard>
        <GlassCardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">No betting activity yet</p>
            <Link href="/" className="text-primary hover:underline mt-2 inline-block">
              Browse markets to place your first bet
            </Link>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <GlassCardContent className="pt-6">
        <div className="space-y-0">
          {bets.map((bet) => {
            const outcomes = parseOutcomes(bet.market.outcomes);
            const outcomeLabel = bet.outcomeLabel || outcomes[bet.outcomeIndex] || "Unknown";
            const eventSlug = bet.market.event?.slug || bet.market.slug || "";
            const title = bet.market.event?.title || bet.market.question || "Market";

            return (
              <Link
                key={bet.id}
                href={getMarketUrl(eventSlug)}
                className="flex items-center gap-4 py-4 border-b border-border/50 last:border-0 hover:bg-muted/50 -mx-6 px-6 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{title}</p>
                  <p className="text-sm text-muted-foreground">
                    Bet ${bet.amount.toLocaleString()} on{" "}
                    <span
                      className={
                        bet.outcomeIndex === 0 ? "text-chart-2" : "text-chart-5"
                      }
                    >
                      {outcomeLabel}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      bet.status === "CONFIRMED"
                        ? "success"
                        : bet.status === "PENDING_TWEET"
                        ? "warning"
                        : "secondary"
                    }
                  >
                    {bet.status.replace("_", " ")}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(bet.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
