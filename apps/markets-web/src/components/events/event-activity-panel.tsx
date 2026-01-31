"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback, Badge } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { Activity, Star, Loader2, TrendingUp } from "lucide-react";
import Link from "next/link";

// ============================================================================
// TYPES
// ============================================================================

interface ActivityBet {
  id: string;
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    profileImageUrl: string | null;
    isKOL: boolean;
  };
  market: {
    id: string;
    question: string;
  };
  amount: number;
  outcomeIndex: number;
  outcomeLabel: string;
  createdAt: string;
}

interface ActivityResponse {
  bets: ActivityBet[];
}

interface EventActivityPanelProps {
  eventSlug: string;
  marketId?: string;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatAmount(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function getAvatarGradient(index: number): string {
  const gradients = [
    "from-violet-500 to-purple-600",
    "from-cyan-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-pink-400 to-rose-500",
    "from-amber-400 to-orange-500",
  ];
  return gradients[index % gradients.length];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EventActivityPanel({
  eventSlug,
  marketId,
  className,
}: EventActivityPanelProps) {
  // Poll for activity every 10 seconds
  const { data, isLoading, error } = useQuery<ActivityResponse>({
    queryKey: ["event-activity", eventSlug, marketId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (marketId) params.set("marketId", marketId);
      params.set("limit", "15");
      
      const res = await fetch(`/api/events/${eventSlug}/activity?${params}`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    refetchInterval: 10000, // 10 seconds
    staleTime: 5000,
  });

  const bets = data?.bets || [];

  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border/50 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">
          Activity
        </h3>
        {isLoading && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Failed to load activity
          </div>
        ) : bets.length === 0 && !isLoading ? (
          <div className="p-6 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Be the first to place a bet!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {bets.map((bet, index) => {
              const displayName =
                bet.user.name || bet.user.handle || bet.user.id.slice(0, 8);
              const profileLink = bet.user.handle
                ? `/u/${bet.user.handle}`
                : `/u/${bet.user.id}`;
              const timeAgo = formatDistanceToNow(new Date(bet.createdAt), {
                addSuffix: true,
              });

              return (
                <div
                  key={bet.id}
                  className="px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <Link href={profileLink} className="flex-shrink-0">
                      <div className="relative">
                        <Avatar className="h-8 w-8 border border-border/30">
                          <AvatarImage
                            src={bet.user.profileImageUrl || undefined}
                          />
                          <AvatarFallback
                            className={cn(
                              "bg-gradient-to-br text-white text-xs",
                              getAvatarGradient(index)
                            )}
                          >
                            {displayName[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {bet.user.isKOL && (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-[#df2421] rounded-full p-0.5 border border-background">
                            <Star className="w-2 h-2 text-white fill-white" />
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={profileLink}
                          className="font-medium text-sm hover:text-primary transition-colors truncate"
                        >
                          {displayName}
                        </Link>
                        {bet.user.isKOL && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4 border-[#df2421]/50 text-[#df2421]"
                          >
                            Captain
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        Bet{" "}
                        <span className="text-emerald-400 font-medium">
                          {formatAmount(bet.amount)}
                        </span>{" "}
                        on{" "}
                        <span className="text-foreground/80">
                          {bet.outcomeLabel}
                        </span>
                      </p>
                      {!marketId && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1">
                          {bet.market.question}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 whitespace-nowrap">
                      {timeAgo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
