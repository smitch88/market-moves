import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@vault/database";
import { format } from "date-fns";
import {
  Button,
  Badge,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  MarketTimeline,
} from "@vault/ui";
import type { MarketStatus } from "@vault/database";
import { MarketActions } from "@/components/admin/market-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminMarketDetailPage({ params }: PageProps) {
  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      outcomes: true,
      bets: {
        where: { status: "CONFIRMED" },
        include: {
          user: {
            select: { id: true, handle: true, name: true },
          },
          outcome: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      positions: {
        include: {
          user: {
            select: { id: true, handle: true, name: true, balance: true },
          },
        },
      },
    },
  });

  if (!market) {
    notFound();
  }

  // Calculate pool stats
  const poolA =
    market.seedA + market.positions.reduce((sum, p) => sum + p.amountOutcomeA, 0);
  const poolB =
    market.seedB + market.positions.reduce((sum, p) => sum + p.amountOutcomeB, 0);
  const totalPool = poolA + poolB;

  const outcomeA = market.outcomes.find((o) => o.key === "A");
  const outcomeB = market.outcomes.find((o) => o.key === "B");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{market.title}</h1>
          <p className="text-muted-foreground">{market.question}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/markets/${market.id}/edit`}>Edit</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/markets/${market.slug}`} target="_blank">
              View Public
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <GlassCard>
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">Market Stats</h2>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      market.status === "OPEN"
                        ? "success"
                        : market.status === "SETTLED"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {market.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pool</p>
                  <p className="text-xl font-bold">${totalPool.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {outcomeA?.label || "A"} Pool
                  </p>
                  <p className="text-xl font-bold text-chart-2">
                    ${poolA.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {outcomeB?.label || "B"} Pool
                  </p>
                  <p className="text-xl font-bold text-chart-5">
                    ${poolB.toLocaleString()}
                  </p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Bets ledger */}
          <GlassCard>
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">
                Bets Ledger ({market.bets.length})
              </h2>
            </GlassCardHeader>
            <GlassCardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        User
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Outcome
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {market.bets.map((bet) => (
                      <tr key={bet.id} className="border-b border-border/50">
                        <td className="p-4">
                          {bet.user.name || bet.user.handle || "Anonymous"}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className={
                              bet.outcome.key === "A"
                                ? "border-chart-2 text-chart-2"
                                : "border-chart-5 text-chart-5"
                            }
                          >
                            {bet.outcome.label}
                          </Badge>
                        </td>
                        <td className="p-4 text-right font-mono">
                          ${bet.amount.toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-sm text-muted-foreground">
                          {format(new Date(bet.createdAt), "MMM d, HH:mm")}
                        </td>
                      </tr>
                    ))}
                    {market.bets.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          No bets yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <MarketActions market={market} outcomeA={outcomeA} outcomeB={outcomeB} />

          {/* Timeline */}
          <GlassCard>
            <GlassCardContent className="pt-6">
              <MarketTimeline
                currentStatus={market.status as MarketStatus}
                publishedAt={market.publishedAt}
                opensAt={market.opensAt}
                closesAt={market.closesAt}
                resolvedAt={market.resolvedAt}
                settledAt={market.settledAt}
              />
            </GlassCardContent>
          </GlassCard>

          {/* Config */}
          <GlassCard>
            <GlassCardHeader>
              <h3 className="text-sm font-semibold">Configuration</h3>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span>{market.feeBps / 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seed A</span>
                <span>${market.seedA.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seed B</span>
                <span>${market.seedB.toLocaleString()}</span>
              </div>
              {market.settlementRunId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Settlement ID</span>
                  <span className="font-mono text-xs truncate max-w-24">
                    {market.settlementRunId}
                  </span>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
