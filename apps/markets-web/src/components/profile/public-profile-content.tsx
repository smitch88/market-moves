"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { User } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { ProfileActivity } from "./profile-activity";

interface PublicProfileContentProps {
  /** User ID or handle - the API supports both */
  handle: string;
}

interface UserProfile {
  id: string;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  xp: number;
}

interface UserStats {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  winRate: number;
  totalBets: number;
  wonBets: number;
  lostBets: number;
}

interface ProfileResponse {
  user: UserProfile;
  stats: UserStats;
}

async function fetchPublicProfile(handle: string): Promise<ProfileResponse | null> {
  const res = await fetch(`/api/users/${handle}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchPublicActivity(handle: string) {
  const res = await fetch(`/api/users/${handle}/activity`);
  if (!res.ok) return { bets: [], redemptions: [] };
  return res.json();
}

interface PublicPosition {
  id: string;
  marketId: string;
  shares0: number;
  shares1: number;
  totalCost: number;
  totalValue: number;
  unrealizedPnL: number;
  avgPrice0: number | null;
  avgPrice1: number | null;
  lastBetAt: string | null;
  market: {
    id: string;
    question: string;
    status: string;
    outcomes: string[];
    outcomeColors: string[];
    outcomePrices: number[];
    resolvedOutcome: number | null;
    event: {
      slug: string;
      title: string;
    } | null;
  };
}

async function fetchPublicPositions(handle: string): Promise<PublicPosition[]> {
  const res = await fetch(`/api/users/${handle}/positions`);
  if (!res.ok) return [];
  return res.json();
}

function formatMoney(dollars: number, options?: { compact?: boolean; showSign?: boolean }): string {
  const absDollars = Math.abs(dollars);
  let formatted: string;

  if (options?.compact) {
    if (absDollars >= 1000000) {
      formatted = `${(absDollars / 1000000).toFixed(1)}m`;
    } else if (absDollars >= 1000) {
      formatted = `${(absDollars / 1000).toFixed(1)}k`;
    } else {
      formatted = absDollars.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  } else {
    formatted = absDollars.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (options?.showSign && dollars !== 0) {
    return dollars >= 0 ? `+$${formatted}` : `-$${formatted}`;
  }
  return dollars >= 0 ? `$${formatted}` : `-$${formatted}`;
}

function formatXp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

// Chart tooltip
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string; timestamp: string } }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0].value;
  const timestamp = payload[0].payload.timestamp;
  const time = format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-xl">
      <div className="text-xs text-muted-foreground mb-1">{time}</div>
      <div className={cn("font-mono font-semibold text-base", value >= 0 ? "text-green-500" : "text-red-500")}>
        {value >= 0 ? "+" : ""}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

type TimeRange = "1D" | "1W" | "1M" | "ALL";

export function PublicProfileContent({ handle }: PublicProfileContentProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");

  const { data: profileData, isLoading: profileLoading, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: () => fetchPublicProfile(handle),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["public-activity", handle],
    queryFn: () => fetchPublicActivity(handle),
    enabled: !!profileData,
  });

  const { data: positions, isLoading: positionsLoading } = useQuery({
    queryKey: ["public-positions", handle],
    queryFn: () => fetchPublicPositions(handle),
    enabled: !!profileData,
  });

  if (profileLoading) {
    return <PublicProfileSkeleton />;
  }

  if (error || !profileData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const { user, stats } = profileData;
  const displayName = user.name || user.handle || `User ${user.id.slice(0, 8)}...`;
  const avatarUrl = user.profileImageUrl;
  const totalPnL = stats.totalPnL;
  const isPositive = totalPnL >= 0;

  // Generate mock chart data from activity (simplified)
  // In production, you might want a dedicated endpoint for public PnL history
  const chartData = (activity?.bets || [])
    .slice(0, 20)
    .reverse()
    .map((bet: { createdAt: string; amount: number }, index: number) => ({
      date: format(new Date(bet.createdAt), "MMM d"),
      timestamp: bet.createdAt,
      value: totalPnL * ((index + 1) / 20), // Simplified linear progression
    }));

  const hasChartData = chartData.length > 1;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header - Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left side - User info */}
        <div className="border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 via-green-400 to-blue-400 flex-shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <User className="h-8 w-8 text-white/70" />
                </div>
              )}
            </div>

            {/* Name & meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{displayName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {user.handle && (
                  <>
                    <span className="text-sm text-muted-foreground">
                      @{user.handle}
                    </span>
                    <span className="text-muted-foreground">·</span>
                  </>
                )}
                <span className="text-sm text-muted-foreground">
                  Joined {format(new Date(user.createdAt), "MMM yyyy")}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 pt-6 mt-auto border-t border-border">
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {formatXp(user.xp)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">XP</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {`${(stats.winRate * 100).toFixed(0)}%`}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Win Rate
                {stats.totalBets > 0 && (
                  <span className="ml-1">({stats.wonBets}W-{stats.lostBets}L)</span>
                )}
              </div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {stats.totalBets.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Predictions</div>
            </div>
          </div>
        </div>

        {/* Right side - P&L */}
        <div className="border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span className={cn("w-2 h-2 rounded-full", isPositive ? "bg-green-500" : "bg-red-500")} />
                Profit/Loss
              </div>
              <div className={cn(
                "text-3xl font-bold tabular-nums tracking-tight",
                isPositive ? "text-green-500" : "text-red-500"
              )}>
                {formatMoney(totalPnL, { showSign: false })}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">All-Time</div>
            </div>

            {/* Time range selector */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {(["1D", "1W", "1M", "ALL"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    timeRange === range
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="h-[120px] -mx-2">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="pnlPublicGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={isPositive ? "hsl(var(--primary))" : "#ef4444"}
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor={isPositive ? "hsl(var(--primary))" : "#ef4444"}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={isPositive ? "hsl(var(--primary))" : "#ef4444"}
                    strokeWidth={2.5}
                    fill="url(#pnlPublicGradient)"
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No trading history yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs - Positions and Activity */}
      <Tabs defaultValue="positions" className="w-full">
        <div className="border-b border-border mb-6">
          <TabsList className="h-auto p-0 bg-transparent gap-6">
            <TabsTrigger
              value="positions"
              className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform"
            >
              Positions
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform"
            >
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="positions" className="mt-0">
          <PublicPositionsList positions={positions || []} isLoading={positionsLoading} />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <ProfileActivity
            bets={activity?.bets || []}
            redemptions={activity?.redemptions || []}
            isLoading={activityLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Positions list component
function PublicPositionsList({ 
  positions, 
  isLoading 
}: { 
  positions: PublicPosition[]; 
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No active positions
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((position) => (
        <PositionCard key={position.id} position={position} />
      ))}
    </div>
  );
}

// Individual position card
function PositionCard({ position }: { position: PublicPosition }) {
  const { market } = position;
  const eventSlug = market.event?.slug || "";
  const prices = market.outcomePrices || [0.5, 0.5];
  
  // Determine which outcome(s) the user holds
  const holdings: { outcomeIndex: number; shares: number; value: number }[] = [];
  const shares0 = position.shares0 ?? 0;
  const shares1 = position.shares1 ?? 0;
  
  if (shares0 > 0) {
    holdings.push({
      outcomeIndex: 0,
      shares: shares0,
      value: shares0 * (prices[0] ?? 0.5),
    });
  }
  if (shares1 > 0) {
    holdings.push({
      outcomeIndex: 1,
      shares: shares1,
      value: shares1 * (prices[1] ?? 0.5),
    });
  }

  const totalValue = position.totalValue ?? 0;
  const unrealizedPnL = position.unrealizedPnL ?? 0;
  const isProfit = unrealizedPnL >= 0;

  return (
    <Link
      href={eventSlug ? `/events/${eventSlug}` : "#"}
      className="block border border-border rounded-lg p-4 hover:bg-muted/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{market.question}</p>
          {market.event && (
            <p className="text-sm text-muted-foreground truncate">{market.event.title}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {holdings.map(({ outcomeIndex, shares }) => (
              <span
                key={outcomeIndex}
                className="inline-flex items-center gap-1.5 text-sm"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: market.outcomeColors?.[outcomeIndex] || "#888" }}
                />
                <span className="font-medium">{market.outcomes?.[outcomeIndex] || `Outcome ${outcomeIndex}`}</span>
                <span className="text-muted-foreground">
                  {shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold tabular-nums">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={cn(
            "text-sm tabular-nums",
            isProfit ? "text-green-500" : "text-red-500"
          )}>
            {isProfit ? "+" : ""}${unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </Link>
  );
}

function PublicProfileSkeleton() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="border border-border rounded-xl p-5">
          <div className="flex items-start gap-4 mb-6">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-6 pt-4 border-t border-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-[120px] w-full" />
        </div>
      </div>
      <Skeleton className="h-6 w-32 mb-4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
