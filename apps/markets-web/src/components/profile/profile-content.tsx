"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@vault/ui";
import { ProfileActivity } from "./profile-activity";
import { ProfileSettings } from "./profile-settings";
import { ProfilePositions } from "./profile-positions";
import { ProfileRequests } from "./profile-requests";
import { ProfileBookmarks } from "./profile-bookmarks";
import { ProfileHeaderCard, type StreakData } from "./profile-header-card";
import { PnLChart } from "./pnl-chart";
import { ProfileContentSkeleton } from "./profile-content-skeleton";
import { MarketRequestModal } from "./market-request-modal";
import { formatMoney } from "./profile-utils";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

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
  largestWin: number;
}

interface PnLHistoryPoint {
  timestamp: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalVolume: number;
}

export function ProfileContent({ userId }: ProfileContentProps) {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "positions";
  const { user } = usePrivy();
  const authFetch = useAuthFetch();
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await authFetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["user-activity", userId],
    queryFn: async () => {
      const res = await authFetch(`/api/users/${userId}/activity`);
      if (!res.ok) return { bets: [], positions: [] };
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["user-stats"],
    queryFn: async (): Promise<UserStats | null> => {
      const res = await authFetch("/api/me/stats");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: pnlHistory } = useQuery({
    queryKey: ["pnl-history-header"],
    queryFn: async (): Promise<PnLHistoryPoint[]> => {
      const res = await authFetch("/api/me/pnl-history?days=90");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: positionsValue } = useQuery({
    queryKey: ["positions-value"],
    queryFn: async (): Promise<number> => {
      const res = await authFetch("/api/me/positions");
      if (!res.ok) return 0;
      const positions = await res.json();

      let totalValue = 0;
      positions.forEach(
        (pos: {
          shares0: number;
          shares1: number;
          market: { outcomePrices: string };
        }) => {
          try {
            const prices = JSON.parse(pos.market.outcomePrices);
            totalValue += (pos.shares0 || 0) * Number(prices[0]);
            totalValue += (pos.shares1 || 0) * Number(prices[1]);
          } catch {
            // ignore
          }
        }
      );
      return totalValue;
    },
  });

  const { data: streak } = useQuery<StreakData>({
    queryKey: ["streak"],
    queryFn: async () => {
      const res = await authFetch("/api/me/streak");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60 * 1000,
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

  const displayName =
    profile?.name ||
    profile?.handle ||
    user?.twitter?.username ||
    user?.email?.address?.split("@")[0] ||
    "User";
  const twitterHandle = profile?.handle;
  const avatarUrl = profile?.profileImageUrl || user?.twitter?.profilePictureUrl;
  const totalPnL = stats?.totalPnL || 0;

  return (
    <div className="max-w-6xl mx-auto overflow-hidden">
      {/* Header - Two column layout like Polymarket */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left side - User info */}
        <ProfileHeaderCard
          displayName={displayName}
          avatarUrl={avatarUrl}
          handle={twitterHandle}
          showHandleLink={true}
          joinedAt={profile.createdAt}
          onRequestMarket={profile?.isKOL ? () => setRequestModalOpen(true) : undefined}
          streak={streak}
          isKOL={profile?.isKOL ?? false}
          referralCode={profile?.referralCode}
          stats={[
            {
              label: "Positions",
              value: formatMoney(positionsValue || 0, { compact: true }),
            },
            {
              label: "Volume",
              value: formatMoney(stats?.totalVolume || 0, { compact: true }),
            },
            {
              label: "Win Rate",
              value: stats ? `${(stats.winRate * 100).toFixed(0)}%` : "0%",
              sublabel:
                stats && stats.totalBets > 0
                  ? `(${stats.wonBets}W-${stats.lostBets}L)`
                  : undefined,
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

      {/* Tabs */}
      <div className="bg-background rounded-xl p-6 -mx-2">
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
                value="bookmarks"
                className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform"
              >
                Bookmarks
              </TabsTrigger>
              <TabsTrigger
                value="referrals"
                className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform"
              >
                Referrals
              </TabsTrigger>
              <TabsTrigger
                value="requests"
                className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform"
              >
                Requests
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
          <TabsContent value="bookmarks" className="mt-0">
            <ProfileBookmarks />
          </TabsContent>
          <TabsContent value="requests" className="mt-0">
            <ProfileRequests onRequestNew={() => setRequestModalOpen(true)} />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <ProfileSettings profile={profile} showReferrals={false} />
          </TabsContent>
          <TabsContent value="referrals" className="mt-0">
            <ProfileSettings profile={profile} onlyReferrals={true} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Market Request Modal */}
      <MarketRequestModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
      />
    </div>
  );
}
