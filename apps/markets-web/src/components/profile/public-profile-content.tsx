"use client";

import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@vault/ui";
import { ProfileActivity } from "./profile-activity";
import { ProfilePositions } from "./profile-positions";
import { ProfileHeaderCard } from "./profile-header-card";
import { PnLChart } from "./pnl-chart";
import { ProfileContentSkeleton } from "./profile-content-skeleton";
import { formatMoney } from "./profile-utils";

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

interface PnLHistoryPoint {
  timestamp: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalVolume: number;
}

interface PublicPosition {
  id: string;
  totalValue: number;
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

async function fetchPublicPnLHistory(handle: string): Promise<PnLHistoryPoint[]> {
  const res = await fetch(`/api/users/${handle}/pnl-history?days=90`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchPublicPositions(handle: string): Promise<PublicPosition[]> {
  const res = await fetch(`/api/users/${handle}/positions`);
  if (!res.ok) return [];
  return res.json();
}

function calculatePositionsValue(positions: PublicPosition[]): number {
  return positions.reduce((total, pos) => total + (pos.totalValue || 0), 0);
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

  const { data: positions } = useQuery({
    queryKey: ["public-positions", handle],
    queryFn: () => fetchPublicPositions(handle),
    enabled: !!profileData,
  });

  const { data: pnlHistory } = useQuery({
    queryKey: ["public-pnl-history", handle],
    queryFn: () => fetchPublicPnLHistory(handle),
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
  const positionsValue = calculatePositionsValue(positions || []);

  return (
    <div className="max-w-6xl mx-auto overflow-hidden">
      {/* Header - Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left side - User info */}
        <ProfileHeaderCard
          displayName={displayName}
          avatarUrl={avatarUrl}
          handle={user.handle}
          showHandleLink={true}
          joinedAt={user.createdAt}
          stats={[
            {
              label: "Positions Value",
              value: formatMoney(positionsValue || 0, { compact: true }),
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

        {/* Right side - P&L Chart */}
        <PnLChart
          totalPnL={totalPnL}
          pnlHistory={pnlHistory}
          interactive={true}
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
          <ProfilePositions userHandle={handle} readOnly />
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
