import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@vault/database";
import { getMarketUrl, getAdminMarketEditUrl } from "@/lib/urls";
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
import { AdminPriceChart } from "@/components/admin/admin-price-chart";

// Force dynamic rendering - requires database access
export const dynamic = "force-dynamic";

// Helper to parse outcomes
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

// Helper to serialize market for client components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeMarket(market: any) {
  return {
    ...market,
    seed0: Number(market.seed0),
    seed1: Number(market.seed1),
    pool0: Number(market.pool0),
    pool1: Number(market.pool1),
    k: market.k ? Number(market.k) : null,
    reserve0: Number(market.reserve0),
    reserve1: Number(market.reserve1),
    publishedAt: market.publishedAt?.toISOString() ?? null,
    opensAt: market.opensAt?.toISOString() ?? null,
    closesAt: market.closesAt?.toISOString() ?? null,
    resolvedAt: market.resolvedAt?.toISOString() ?? null,
    settledAt: market.settledAt?.toISOString() ?? null,
    createdAt: market.createdAt?.toISOString() ?? null,
    updatedAt: market.updatedAt?.toISOString() ?? null,
    bets: market.bets?.map((bet: { amount: unknown; shares: unknown; payout: unknown; pricePerShare: unknown; createdAt: Date; [key: string]: unknown }) => ({
      ...bet,
      amount: Number(bet.amount),
      shares: bet.shares ? Number(bet.shares) : null,
      payout: bet.payout ? Number(bet.payout) : null,
      pricePerShare: bet.pricePerShare ? Number(bet.pricePerShare) : null,
      createdAt: bet.createdAt?.toISOString() ?? null,
    })) ?? [],
    positions: market.positions?.map((pos: { amount0: unknown; amount1: unknown; shares0: unknown; shares1: unknown; avgCost0: unknown; avgCost1: unknown; user?: { balance: unknown; [key: string]: unknown }; [key: string]: unknown }) => ({
      ...pos,
      amount0: Number(pos.amount0),
      amount1: Number(pos.amount1),
      shares0: Number(pos.shares0),
      shares1: Number(pos.shares1),
      avgCost0: Number(pos.avgCost0),
      avgCost1: Number(pos.avgCost1),
      user: pos.user ? {
        ...pos.user,
        balance: Number(pos.user.balance),
      } : null,
    })) ?? [],
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminMarketDetailPage({ params }: PageProps) {
  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      event: {
        include: { tags: true },
      },
      bets: {
        where: { status: "CONFIRMED" },
        include: {
          user: {
            select: { id: true, handle: true, name: true },
          },
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

  // Serialize market to convert Decimals for client components
  const serializedMarket = serializeMarket(market);

  // Parse outcomes
  const outcomes = parseOutcomes(market.outcomes);

  // Calculate pool stats (using serialized numbers)
  const pool0 = serializedMarket.seed0 + serializedMarket.pool0;
  const pool1 = serializedMarket.seed1 + serializedMarket.pool1;
  const totalPool = pool0 + pool1;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{market.event.title}</h1>
          <p className="text-muted-foreground">{market.question}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={getAdminMarketEditUrl(market.id)}>Edit</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={getMarketUrl(market.event.slug)} target="_blank">
              View Public
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <GlassCard variant="solid">
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
                    {outcomes[0]} Pool
                  </p>
                  <p className="text-xl font-bold text-chart-2">
                    ${pool0.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {outcomes[1]} Pool
                  </p>
                  <p className="text-xl font-bold text-chart-5">
                    ${pool1.toLocaleString()}
                  </p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Price History Chart */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">Price History</h2>
            </GlassCardHeader>
            <GlassCardContent>
              <AdminPriceChart market={serializedMarket} />
            </GlassCardContent>
          </GlassCard>

          {/* Bets ledger */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">
                Bets Ledger ({serializedMarket.bets.length})
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
                    {serializedMarket.bets.map((bet: { id: string; user: { name?: string; handle?: string }; outcomeIndex: number; amount: number; createdAt: string }) => (
                      <tr key={bet.id} className="border-b border-border/50">
                        <td className="p-4">
                          {bet.user.name || bet.user.handle || "Anonymous"}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className={
                              bet.outcomeIndex === 0
                                ? "border-chart-2 text-chart-2"
                                : "border-chart-5 text-chart-5"
                            }
                          >
                            {outcomes[bet.outcomeIndex]}
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
                    {serializedMarket.bets.length === 0 && (
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
          <MarketActions market={serializedMarket} outcomes={outcomes} />

          {/* Timeline */}
          <GlassCard variant="solid">
            <GlassCardContent className="pt-6">
              <MarketTimeline
                currentStatus={serializedMarket.status as MarketStatus}
                publishedAt={serializedMarket.publishedAt ? new Date(serializedMarket.publishedAt) : null}
                opensAt={serializedMarket.opensAt ? new Date(serializedMarket.opensAt) : null}
                closesAt={serializedMarket.closesAt ? new Date(serializedMarket.closesAt) : null}
                resolvedAt={serializedMarket.resolvedAt ? new Date(serializedMarket.resolvedAt) : null}
                settledAt={serializedMarket.settledAt ? new Date(serializedMarket.settledAt) : null}
              />
            </GlassCardContent>
          </GlassCard>

          {/* Config */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h3 className="text-sm font-semibold">Configuration</h3>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span>{serializedMarket.feeBps / 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seed 0 ({outcomes[0]})</span>
                <span>${serializedMarket.seed0.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seed 1 ({outcomes[1]})</span>
                <span>${serializedMarket.seed1.toLocaleString()}</span>
              </div>
              {serializedMarket.settlementRunId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Settlement ID</span>
                  <span className="font-mono text-xs truncate max-w-24">
                    {serializedMarket.settlementRunId}
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
