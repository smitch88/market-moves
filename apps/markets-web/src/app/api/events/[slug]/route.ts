import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/events/[slug]
 * 
 * Polymarket-style single event endpoint.
 * Returns detailed event data with all markets and trading stats.
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
              take: 20,
            },
            positions: {
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
              orderBy: [
                { amount0: "desc" },
                { amount1: "desc" },
              ],
              take: 10,
            },
            _count: {
              select: { 
                bets: { where: { status: "CONFIRMED" } },
                positions: true,
              },
            },
          },
          orderBy: { closesAt: "asc" },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Calculate event-level stats
    let eventVolume = 0;
    let eventLiquidity = 0;
    let totalBets = 0;

    // Transform markets with stats (Polymarket style)
    const markets = event.markets.map((market) => {
      // Calculate pool totals
      const pool0 = market.seed0 + market.pool0;
      const pool1 = market.seed1 + market.pool1;
      const totalPool = pool0 + pool1;
      const price0 = totalPool > 0 ? (pool0 / totalPool).toFixed(4) : "0.5000";
      const price1 = totalPool > 0 ? (pool1 / totalPool).toFixed(4) : "0.5000";
      
      const volume = market.pool0 + market.pool1;
      const liquidity = totalPool;
      
      eventVolume += volume;
      eventLiquidity += liquidity;
      totalBets += market._count.bets;

      // Parse outcomes for display
      const outcomes = JSON.parse(market.outcomes) as string[];
      const outcomeColors = market.outcomeColors 
        ? JSON.parse(market.outcomeColors) as string[]
        : null;

      // Determine if market is "new"
      const isNew = Date.now() - new Date(market.createdAt).getTime() < 24 * 60 * 60 * 1000;

      return {
        id: market.id,
        question: market.question,
        // Raw JSON strings (Polymarket style)
        outcomes: market.outcomes,
        outcomePrices: JSON.stringify([price0, price1]),
        outcomeColors: market.outcomeColors,
        // Parsed for convenience
        outcomesArray: outcomes,
        outcomePricesArray: [price0, price1],
        outcomeColorsArray: outcomeColors,
        // Status
        status: market.status,
        active: market.status === "OPEN",
        closed: ["CLOSED", "RESOLVED", "SETTLED"].includes(market.status),
        resolvedOutcome: market.resolvedOutcome,
        // Dates
        endDate: market.closesAt?.toISOString() || null,
        closesAt: market.closesAt?.toISOString() || null,
        resolvedAt: market.resolvedAt?.toISOString() || null,
        // Stats
        volume: volume.toString(),
        volumeNum: volume,
        liquidity: liquidity.toString(),
        liquidityNum: liquidity,
        pool0,
        pool1,
        totalPool,
        percent0: totalPool > 0 ? Math.round((pool0 / totalPool) * 100) : 50,
        percent1: totalPool > 0 ? Math.round((pool1 / totalPool) * 100) : 50,
        fee: (market.feeBps / 10000).toString(),
        feeBps: market.feeBps,
        // Counts
        betCount: market._count.bets,
        positionCount: market._count.positions,
        new: isNew,
        // Recent activity
        recentBets: market.bets.map((bet) => {
          const outcomeLabel = outcomes[bet.outcomeIndex] || `Outcome ${bet.outcomeIndex}`;
          const outcomeColor = outcomeColors?.[bet.outcomeIndex] || null;
          return {
            id: bet.id,
            amount: bet.amount,
            outcomeIndex: bet.outcomeIndex,
            outcomeLabel,
            outcomeColor,
            createdAt: bet.createdAt.toISOString(),
            user: bet.user,
          };
        }),
        // Top positions
        topPositions: market.positions.map((pos) => ({
          id: pos.id,
          amount0: pos.amount0,
          amount1: pos.amount1,
          totalAmount: pos.amount0 + pos.amount1,
          user: pos.user,
        })),
        // Timestamps
        createdAt: market.createdAt.toISOString(),
        updatedAt: market.updatedAt.toISOString(),
      };
    });

    // Determine if event is "new"
    const isNew = Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000;

    const response = {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      // Polymarket naming
      image: event.bannerUrl,
      icon: event.logoUrl,
      // Our naming (backward compat)
      bannerUrl: event.bannerUrl,
      logoUrl: event.logoUrl,
      category: event.category,
      active: event.active,
      closed: event.closed,
      new: isNew,
      // Dates (Polymarket style)
      startDate: event.startTime?.toISOString() || null,
      endDate: event.endTime?.toISOString() || null,
      // Our naming
      startTime: event.startTime?.toISOString() || null,
      endTime: event.endTime?.toISOString() || null,
      // Aggregated stats
      volume: eventVolume,
      liquidity: eventLiquidity,
      totalBets,
      marketCount: markets.length,
      // Nested data
      tags: event.tags,
      markets,
      // Timestamps
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
