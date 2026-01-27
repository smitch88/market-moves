import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

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

    // Find event by slug
    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        tags: {
          select: {
            id: true,
            slug: true,
            label: true,
          },
        },
        markets: {
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

    // Calculate stats for each market
    const marketsWithStats = event.markets.map((market) => {
      const pool0 = market.seed0 + market.pool0;
      const pool1 = market.seed1 + market.pool1;
      const totalPool = pool0 + pool1;

      return {
        ...market,
        stats: {
          pool0,
          pool1,
          totalPool,
          percent0: totalPool > 0 ? Math.round((pool0 / totalPool) * 100) : 50,
          percent1: totalPool > 0 ? Math.round((pool1 / totalPool) * 100) : 50,
          totalBets: market.bets.length,
        },
      };
    });

    // Calculate aggregate event stats
    const totalPool = marketsWithStats.reduce((sum, m) => sum + m.stats.totalPool, 0);
    const totalBets = marketsWithStats.reduce((sum, m) => sum + m.stats.totalBets, 0);

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
          outcomeColors: event.markets[0]?.outcomeColors,
          // Include nested markets for multi-market events
          markets: marketsWithStats,
          bets: event.markets[0]?.bets || [],
          positions: event.markets[0]?.positions || [],
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
