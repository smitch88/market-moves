"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { Star, Loader2 } from "lucide-react";
import Link from "next/link";

// ============================================================================
// TYPES
// ============================================================================

interface EventKOLUser {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
}

interface EventKOL {
  user: EventKOLUser;
  totalVolume: number;
  betCount: number;
  latestBet?: {
    marketQuestion: string;
    outcomeLabel: string;
    amount: number;
    createdAt: string;
  } | null;
}

interface KOLsResponse {
  kols: EventKOL[];
}

interface EventKOLsPanelProps {
  eventSlug: string;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

function getAvatarGradient(index: number): string {
  const gradients = [
    "from-amber-400 to-orange-500",
    "from-violet-500 to-purple-600",
    "from-cyan-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-pink-400 to-rose-500",
  ];
  return gradients[index % gradients.length];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EventKOLsPanel({ eventSlug, className }: EventKOLsPanelProps) {
  // Poll for KOLs every 30 seconds
  const { data, isLoading } = useQuery<KOLsResponse>({
    queryKey: ["event-kols", eventSlug],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventSlug}/kols?limit=5`);
      if (!res.ok) throw new Error("Failed to fetch KOLs");
      return res.json();
    },
    refetchInterval: 30000, // 30 seconds
    staleTime: 15000,
  });

  const kols = data?.kols || [];

  // Don't render anything if there are no captains and not loading
  if (!isLoading && kols.length === 0) {
    return null;
  }

  // Show loading skeleton
  if (isLoading && kols.length === 0) {
    return (
      <div
        className={cn(
          "bg-card rounded-xl border border-border/50 overflow-hidden",
          className
        )}
      >
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
          <Star className="h-4 w-4 text-[#df2421] fill-[#df2421]" />
          <h3 className="font-semibold text-sm">Top Captains</h3>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-6 h-6 rounded-full bg-muted" />
              <div className="w-9 h-9 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border/50 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <Star className="h-4 w-4 text-[#df2421] fill-[#df2421]" />
        <h3 className="font-semibold text-sm">Top Captains</h3>
        {isLoading && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      {/* Content */}
      <div className="divide-y divide-border/30">
        {kols.map((kol, index) => {
          const user = kol.user;
          const displayName =
            user.name || user.handle || user.id.slice(0, 8);
          const profileLink = user.handle
            ? `/u/${user.handle}`
            : `/u/${user.id}`;

          return (
            <Link
              key={user.id}
              href={profileLink}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              {/* Avatar */}
              <div className="relative">
                <Avatar className="h-9 w-9 border border-border/30">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback
                    className={cn(
                      "bg-gradient-to-br text-white text-sm",
                      getAvatarGradient(index)
                    )}
                  >
                    {displayName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 bg-[#df2421] rounded-full p-0.5 border border-background">
                  <Star className="w-2.5 h-2.5 text-white fill-white" />
                </div>
              </div>

              {/* Name & Stats */}
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm truncate block">
                  {displayName}
                </span>
                {user.handle && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.handle}
                  </p>
                )}
              </div>

              {/* Volume */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-emerald-400">
                  {formatVolume(kol.totalVolume)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {kol.betCount} bet{kol.betCount !== 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
