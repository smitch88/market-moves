import { prisma } from "@vault/database";
import { GlassCard, GlassCardContent, GlassCardHeader } from "@vault/ui";
import { BarChart3, Users, DollarSign, TrendingUp } from "lucide-react";

export default async function AdminDashboard() {
  const [marketCount, userCount, betCount, totalVolume] = await Promise.all([
    prisma.market.count(),
    prisma.user.count(),
    prisma.bet.count({ where: { status: "CONFIRMED" } }),
    prisma.bet.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { amount: true },
    }),
  ]);

  const stats = [
    {
      label: "Total Markets",
      value: marketCount,
      icon: BarChart3,
      color: "text-chart-1",
    },
    {
      label: "Total Users",
      value: userCount,
      icon: Users,
      color: "text-chart-2",
    },
    {
      label: "Total Bets",
      value: betCount,
      icon: TrendingUp,
      color: "text-chart-3",
    },
    {
      label: "Total Volume",
      value: `$${(totalVolume._sum.amount || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-chart-4",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your prediction markets</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <GlassCard key={stat.label}>
            <GlassCardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        ))}
      </div>

      {/* Recent activity placeholder */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </GlassCardHeader>
        <GlassCardContent>
          <p className="text-muted-foreground text-center py-8">
            Activity feed coming soon...
          </p>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
