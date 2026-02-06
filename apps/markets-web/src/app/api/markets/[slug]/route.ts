import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

// Helper to convert Decimal to number
function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

// Serialize a bet to convert Decimals
function serializeBet(bet: {
  id: string;
  amount: unknown;
  shares: unknown;
  payout: unknown;
  pricePerShare: unknown;
  outcomeIndex: number;
  status: string;
  tradeType: string | null;
  createdAt: Date;
  user: {
    id: string;
    handle: string | null;
    name: string | null;
    profileImageUrl: string | null;
  };
}) {
  return {
    id: bet.id,
    amount: toNum(bet.amount),
    shares: toNum(bet.shares),
    payout: toNum(bet.payout),
    pricePerShare: toNum(bet.pricePerShare),
    outcomeIndex: bet.outcomeIndex,
    status: bet.status,
    tradeType: bet.tradeType,
    createdAt: bet.createdAt.toISOString(),
    user: bet.user,
  };
}

// Serialize a position to convert Decimals
function serializePosition(position: {
  id: string;
  amount0: unknown;
  amount1: unknown;
  shares0: unknown;
  shares1: unknown;
  avgCost0: unknown;
  avgCost1: unknown;
  user: {
    id: string;
    handle: string | null;
    name: string | null;
    profileImageUrl: string | null;
    createdAt: Date;
  };
}) {
  return {
    id: position.id,
    amount0: toNum(position.amount0),
    amount1: toNum(position.amount1),
    shares0: toNum(position.shares0),
    shares1: toNum(position.shares1),
    avgCost0: toNum(position.avgCost0),
    avgCost1: toNum(position.avgCost1),
    user: {
      ...position.user,
      createdAt: position.user.createdAt.toISOString(),
    },
  };
}

// Serialize a market to convert Decimals
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeMarket(market: any) {
  const seed0 = toNum(market.seed0);
  const seed1 = toNum(market.seed1);
  const pool0Val = toNum(market.pool0);
  const pool1Val = toNum(market.pool1);
  const totalPool0 = seed0 + pool0Val;
  const totalPool1 = seed1 + pool1Val;
  const totalPool = totalPool0 + totalPool1;

  return {
    id: market.id,
    question: market.question,
    displayLabel: market.displayLabel ?? null,
    sortOrder: market.sortOrder ?? null,
    status: market.status,
    detailsMarkdown: market.detailsMarkdown,
    resolutionSourceUrl: market.resolutionSourceUrl,
    publishedAt: market.publishedAt?.toISOString() ?? null,
    opensAt: market.opensAt?.toISOString() ?? null,
    closesAt: market.closesAt?.toISOString() ?? null,
    resolvedAt: market.resolvedAt?.toISOString() ?? null,
    settledAt: market.settledAt?.toISOString() ?? null,
    feeBps: market.feeBps,
    seed0,
    seed1,
    pool0: pool0Val,
    pool1: pool1Val,
    k: toNum(market.k),
    reserve0: toNum(market.reserve0),
    reserve1: toNum(market.reserve1),
    outcomes: market.outcomes,
    outcomePrices: market.outcomePrices,
    outcomeColors: market.outcomeColors,
    resolvedOutcome: market.resolvedOutcome,
    openingPrice: market.openingPrice != null ? toNum(market.openingPrice) : null,
    createdAt: market.createdAt?.toISOString() ?? null,
    updatedAt: market.updatedAt?.toISOString() ?? null,
    bets: market.bets?.map(serializeBet) ?? [],
    positions: market.positions?.map(serializePosition) ?? [],
    stats: {
      pool0: totalPool0,
      pool1: totalPool1,
      totalPool,
      percent0: totalPool > 0 ? Math.round((totalPool0 / totalPool) * 100) : 50,
      percent1: totalPool > 0 ? Math.round((totalPool1 / totalPool) * 100) : 50,
      totalBets: market.bets?.length ?? 0,
    },
  };
}

/**
 * GET /api/markets/[slug]
 * 
 * Get event by slug with all markets and stats.
 * The slug refers to the event slug (backward compatible).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Disable caching for real-time data
    const headers = new Headers();
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    // Find event by slug - only show published events
    const event = await prisma.event.findFirst({
      where: { 
        slug,
        isPublished: true, // Only show published events
      },
      include: {
        tags: {
          select: {
            id: true,
            slug: true,
            label: true,
          },
        },
        markets: {
          where: {
            isPublished: true, // Only show published markets
          },
          include: {
            bets: {
              where: { status: "CONFIRMED" },
              include: {
                user: {
                  select: {
                    id: true,
                    handle: true,
                    name: true,
                    profileImageUrl: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 50,
            },
            positions: {
              include: {
                user: {
                  select: {
                    id: true,
                    handle: true,
                    name: true,
                    profileImageUrl: true,
                    createdAt: true,
                  },
                },
              },
              orderBy: [
                { amount0: "desc" },
                { amount1: "desc" },
              ],
              take: 20,
            },
          },
          orderBy: { closesAt: "asc" },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Serialize markets with stats
    const marketsWithStats = event.markets.map(serializeMarket);

    // Calculate aggregate event stats
    const totalPool = marketsWithStats.reduce((sum, m) => sum + m.stats.totalPool, 0);
    const totalBets = marketsWithStats.reduce((sum, m) => sum + m.stats.totalBets, 0);
    
    // Calculate unique users across all bets
    const uniqueUserIds = new Set<string>();
    marketsWithStats.forEach(m => {
      m.bets?.forEach((bet: { user?: { id: string } }) => {
        if (bet.user?.id) {
          uniqueUserIds.add(bet.user.id);
        }
      });
    });
    const uniqueUsers = uniqueUserIds.size;

    // Return in backward-compatible format (market -> event)
    return NextResponse.json(
      {
        // For backward compatibility, expose as "market" with first market's data
        // But include full event structure
        event: {
          ...event,
          markets: marketsWithStats,
        },
        // Legacy format for existing components
        market: {
          id: event.id,
          slug: event.slug,
          title: event.title,
          question: event.markets[0]?.question || event.title,
          category: event.category,
          status: event.markets[0]?.status || "DRAFT",
          bannerUrl: event.bannerUrl,
          logoUrl: event.logoUrl,
          detailsMarkdown: event.markets[0]?.detailsMarkdown,
          closesAt: event.markets[0]?.closesAt,
          outcomes: event.markets[0]?.outcomes,
          outcomeColors: null,
          // Include nested markets for multi-market events
          markets: marketsWithStats,
          bets: marketsWithStats[0]?.bets || [],
          positions: marketsWithStats[0]?.positions || [],
        },
        stats: {
          pool0: marketsWithStats[0]?.stats.pool0 || 0,
          pool1: marketsWithStats[0]?.stats.pool1 || 0,
          poolA: marketsWithStats[0]?.stats.pool0 || 0, // Legacy alias
          poolB: marketsWithStats[0]?.stats.pool1 || 0, // Legacy alias
          totalPool,
          percent0: marketsWithStats[0]?.stats.percent0 || 50,
          percent1: marketsWithStats[0]?.stats.percent1 || 50,
          percentA: marketsWithStats[0]?.stats.percent0 || 50, // Legacy alias
          percentB: marketsWithStats[0]?.stats.percent1 || 50, // Legacy alias
          totalBets,
          uniqueUsers,
          marketCount: marketsWithStats.length,
        },
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
