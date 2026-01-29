"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
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
import { User, ExternalLink } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { ProfileActivity } from "./profile-activity";
import { ProfileSettings } from "./profile-settings";
import { ProfilePositions } from "./profile-positions";

interface ProfileContentProps {
  userId: string;
}

interface UserStats {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalVolume: number;
  winRate: number;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  openPositions: number;
}

interface PnLHistoryPoint {
  timestamp: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalVolume: number;
}

async function fetchProfile() {
  const res = await fetch("/api/me");
  if (!res.ok) return null;
  return res.json();
}

async function fetchUserActivity(userId: string) {
  const res = await fetch(`/api/users/${userId}/activity`);
  if (!res.ok) return { bets: [], positions: [] };
  return res.json();
}

async function fetchUserStats(): Promise<UserStats | null> {
  const res = await fetch("/api/me/stats");
  if (!res.ok) return null;
  return res.json();
}

async function fetchPnLHistory(): Promise<PnLHistoryPoint[]> {
  const res = await fetch(`/api/me/pnl-history?days=90`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchPositionsValue(): Promise<number> {
  const res = await fetch("/api/me/positions");
  if (!res.ok) return 0;
  const positions = await res.json();
  
  let totalValue = 0;
  positions.forEach((pos: { shares0: number; shares1: number; market: { outcomePrices: string } }) => {
    try {
      const prices = JSON.parse(pos.market.outcomePrices);
      totalValue += (pos.shares0 || 0) * Number(prices[0]); // Already in dollars
      totalValue += (pos.shares1 || 0) * Number(prices[1]); // Already in dollars
    } catch {
      // ignore
    }
  });
  return totalValue;
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

// Enhanced chart tooltip with time and better formatting
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string; timestamp: string } }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0].value;
  const date = payload[0].payload.date;
  const timestamp = payload[0].payload.timestamp;

  // Format time
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

export function ProfileContent({ userId }: ProfileContentProps) {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "positions";
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const { user } = usePrivy();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["user-activity", userId],
    queryFn: () => fetchUserActivity(userId),
  });

  const { data: stats } = useQuery({
    queryKey: ["user-stats"],
    queryFn: fetchUserStats,
  });

  const { data: pnlHistory } = useQuery({
    queryKey: ["pnl-history-header"],
    queryFn: fetchPnLHistory,
  });

  const { data: positionsValue } = useQuery({
    queryKey: ["positions-value"],
    queryFn: fetchPositionsValue,
  });

  if (profileLoading) {
    return <ProfileContentSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  const displayName = profile?.name || profile?.handle || 
    user?.twitter?.username || user?.email?.address?.split("@")[0] || "User";
  const twitterHandle = profile?.handle;
  const avatarUrl = profile?.profileImageUrl || user?.twitter?.profilePictureUrl;
  const totalPnL = stats?.totalPnL || 0;
  const isPositive = totalPnL >= 0;

  // Filter chart data based on time range
  const now = Date.now();
  const rangeMs: Record<TimeRange, number> = {
    "1D": 24 * 60 * 60 * 1000,
    "1W": 7 * 24 * 60 * 60 * 1000,
    "1M": 30 * 24 * 60 * 60 * 1000,
    "ALL": Infinity,
  };

  const chartData = (pnlHistory || [])
    .filter((point) => {
      if (timeRange === "ALL") return true;
      return now - new Date(point.timestamp).getTime() <= rangeMs[timeRange];
    })
    .map((point) => ({
      date: format(new Date(point.timestamp), "MMM d"),
      timestamp: point.timestamp,
      value: point.realizedPnL + point.unrealizedPnL,
    }));

  const hasChartData = chartData.length > 1;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header - Two column layout like Polymarket */}
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
                {twitterHandle && (
                  <>
                    <a
                      href={`https://x.com/${twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      @{twitterHandle}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="text-muted-foreground">·</span>
                  </>
                )}
                <span className="text-sm text-muted-foreground">
                  Joined {profile.createdAt ? format(new Date(profile.createdAt), "MMM yyyy") : "recently"}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row - pushed to bottom */}
          <div className="flex items-center gap-6 pt-6 mt-auto border-t border-border">
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {formatMoney(positionsValue || 0, { compact: true })}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Positions Value</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {stats ? `${(stats.winRate * 100).toFixed(0)}%` : "0%"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Win Rate
                {stats && stats.totalBets > 0 && (
                  <span className="ml-1">({stats.wonBets}W-{stats.lostBets}L)</span>
                )}
              </div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {stats?.totalBets?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Predictions</div>
            </div>
          </div>
        </div>

        {/* Right side - P&L Chart */}
        <div className="border border-border rounded-xl p-5">
          {/* Header with P&L value and time range */}
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
                    <linearGradient id="pnlHeaderGradient" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#pnlHeaderGradient)"
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

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
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
            <TabsTrigger
              value="referrals"
              className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform"
            >
              Referrals
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform"
            >
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="positions" className="mt-0">
          <ProfilePositions />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <ProfileActivity
            bets={activity?.bets || []}
            redemptions={activity?.redemptions || []}
            isLoading={activityLoading}
          />
        </TabsContent>
        <TabsContent value="settings" className="mt-0">
          <ProfileSettings profile={profile} showReferrals={false} />
        </TabsContent>
        <TabsContent value="referrals" className="mt-0">
          <ProfileSettings profile={profile} onlyReferrals={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileContentSkeleton() {
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
      <Skeleton className="h-10 w-full mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
