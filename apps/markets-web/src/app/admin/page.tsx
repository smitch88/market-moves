import Link from "next/link";
import { prisma } from "@vault/database";
import { GlassCard, GlassCardContent, GlassCardHeader, Button } from "@vault/ui";
import { BarChart3, Users, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import { RecentActivity } from "@/components/admin/recent-activity";
import { RecentSocialVerifications } from "@/components/admin/recent-social-verifications";
import { LeaderboardExport } from "@/components/admin/leaderboard-export";
import { VolumeChart } from "@/components/admin/volume-chart";

// X (Twitter) icon as inline SVG for server component
function XIconInline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Force dynamic rendering - requires database access
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [eventCount, marketCount, userCount, betCount] = await Promise.all([
    prisma.event.count(),
    prisma.market.count(),
    prisma.user.count(),
    prisma.bet.count({ where: { status: "CONFIRMED" } }),
  ]);

  const stats = [
    {
      label: "Total Events",
      value: eventCount,
      icon: Calendar,
      color: "text-chart-1",
    },
    {
      label: "Total Markets",
      value: marketCount,
      icon: BarChart3,
      color: "text-chart-2",
    },
    {
      label: "Total Users",
      value: userCount,
      icon: Users,
      color: "text-chart-3",
    },
    {
      label: "Total Bets",
      value: betCount,
      icon: TrendingUp,
      color: "text-chart-4",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Overview of your prediction markets</p>
        </div>
        <LeaderboardExport />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat) => (
          <GlassCard key={stat.label} variant="solid">
            <GlassCardContent className="p-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="h-4 w-4 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        ))}
      </div>

      {/* Volume Chart */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-4 sm:pt-6">
          <VolumeChart />
        </GlassCardContent>
      </GlassCard>

      {/* Recent Activity and Social Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* Recent activity */}
        <GlassCard variant="solid">
          <GlassCardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold">Recent Activity</h2>
              <Link href="/admin/bets">
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                  View all
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </GlassCardHeader>
          <GlassCardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <RecentActivity limit={5} />
          </GlassCardContent>
        </GlassCard>

        {/* Recent Social Verifications */}
        <GlassCard variant="solid">
          <GlassCardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XIconInline className="h-4 w-4 sm:h-5 sm:w-5" />
                <h2 className="text-base sm:text-lg font-semibold">XP Boost Verifications</h2>
              </div>
              <Link href="/admin/social">
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                  View all
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </GlassCardHeader>
          <GlassCardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <RecentSocialVerifications limit={5} />
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
