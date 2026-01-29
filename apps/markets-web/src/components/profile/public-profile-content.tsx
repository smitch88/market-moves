"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { ProfileActivity } from "./profile-activity";
import { ProfileHeaderCard } from "./profile-header-card";
import { PnLChart } from "./pnl-chart";
import { ProfileContentSkeleton } from "./profile-content-skeleton";
import { formatXp } from "./profile-utils";

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

async function fetchPublicProfile(
  handle: string
): Promise<ProfileResponse | null> {
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

export function PublicProfileContent({ handle }: PublicProfileContentProps) {
  const {
    data: profileData,
    isLoading: profileLoading,
    error,
  } = useQuery({
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
    return <ProfileContentSkeleton />;
  }

  if (error || !profileData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const { user, stats } = profileData;
  const displayName =
    user.name || user.handle || `User ${user.id.slice(0, 8)}...`;
  const avatarUrl = user.profileImageUrl;
  const totalPnL = stats.totalPnL;

  // Generate chart data from activity (simplified)
  // In production, you might want a dedicated endpoint for public PnL history
  const chartData = (activity?.bets || [])
    .slice(0, 20)
    .reverse()
    .map((bet: { createdAt: string; amount: number }, index: number) => ({
      date: format(new Date(bet.createdAt), "MMM d"),
      timestamp: bet.createdAt,
      value: totalPnL * ((index + 1) / 20), // Simplified linear progression
    }));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header - Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left side - User info */}
        <ProfileHeaderCard
          displayName={displayName}
          avatarUrl={avatarUrl}
          handle={user.handle}
          showHandleLink={false}
          joinedAt={user.createdAt}
          stats={[
            {
              label: "XP",
              value: formatXp(user.xp),
            },
            {
              label: "Win Rate",
              value: `${(stats.winRate * 100).toFixed(0)}%`,
              sublabel:
                stats.totalBets > 0
                  ? `(${stats.wonBets}W-${stats.lostBets}L)`
                  : undefined,
            },
            {
              label: "Predictions",
              value: stats.totalBets.toLocaleString(),
            },
          ]}
        />

        {/* Right side - P&L */}
        <PnLChart
          totalPnL={totalPnL}
          chartData={chartData}
          interactive={false}
          timeRangeLabel="All-Time"
        />
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
          <PublicPositionsList
            positions={positions || []}
            isLoading={positionsLoading}
          />
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
  isLoading,
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
            <p className="text-sm text-muted-foreground truncate">
              {market.event.title}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {holdings.map(({ outcomeIndex, shares }) => (
              <span
                key={outcomeIndex}
                className="inline-flex items-center gap-1.5 text-sm"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: market.outcomeColors?.[outcomeIndex] || "#888",
                  }}
                />
                <span className="font-medium">
                  {market.outcomes?.[outcomeIndex] || `Outcome ${outcomeIndex}`}
                </span>
                <span className="text-muted-foreground">
                  {shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  shares
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold tabular-nums">
            $
            {totalValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div
            className={cn(
              "text-sm tabular-nums",
              isProfit ? "text-green-500" : "text-red-500"
            )}
          >
            {isProfit ? "+" : ""}$
            {unrealizedPnL.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
    </Link>
  );
}
