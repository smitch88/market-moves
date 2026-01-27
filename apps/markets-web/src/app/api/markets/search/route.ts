import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/markets/search
 * 
 * Polymarket-style search endpoint.
 * Search across events and markets.
 * 
 * Query params:
 * - q: search query (required, min 2 chars)
 * - limit: max results per type (default: 8, max: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "8"), 20);

    if (!query || query.length < 2) {
      return NextResponse.json({ events: [], markets: [], query: "", count: 0 });
    }

    // Search events
    const events = await prisma.event.findMany({
      where: {
        active: true,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        markets: {
          where: { status: { in: ["PUBLISHED", "OPEN"] } },
          select: {
            id: true,
            pool0: true,
            pool1: true,
            seed0: true,
            seed1: true,
          },
        },
        _count: {
          select: { markets: true },
        },
      },
      orderBy: { startTime: "asc" },
      take: limit,
    });

    // Transform events with Polymarket naming
    const transformedEvents = events.map((event) => {
      // Calculate aggregate volume/liquidity
      let volume = 0;
      let liquidity = 0;
      for (const market of event.markets) {
        volume += market.pool0 + market.pool1;
        liquidity += market.seed0 + market.seed1 + market.pool0 + market.pool1;
      }

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        category: event.category,
        icon: event.logoUrl,
        image: event.bannerUrl,
        startDate: event.startTime?.toISOString() || null,
        volume,
        liquidity,
        marketCount: event._count.markets,
      };
    });

    // Search markets directly
    const markets = await prisma.market.findMany({
      where: {
        status: { in: ["PUBLISHED", "OPEN"] },
        question: { contains: query, mode: "insensitive" },
      },
      select: {
        id: true,
        question: true,
        outcomes: true,
        closesAt: true,
        pool0: true,
        pool1: true,
        seed0: true,
        seed1: true,
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            logoUrl: true,
          },
        },
        _count: {
          select: { bets: { where: { status: "CONFIRMED" } } },
        },
      },
      orderBy: [
        { bets: { _count: "desc" } },
        { publishedAt: "desc" },
      ],
      take: limit,
    });

    // Transform markets with Polymarket naming
    const transformedMarkets = markets.map((market) => {
      const pool0 = market.seed0 + market.pool0;
      const pool1 = market.seed1 + market.pool1;
      const totalPool = pool0 + pool1;
      const price0 = totalPool > 0 ? (pool0 / totalPool).toFixed(4) : "0.5000";
      const price1 = totalPool > 0 ? (pool1 / totalPool).toFixed(4) : "0.5000";

      return {
        id: market.id,
        question: market.question,
        outcomes: market.outcomes,
        outcomePrices: JSON.stringify([price0, price1]),
        endDate: market.closesAt?.toISOString() || null,
        volume: market.pool0 + market.pool1,
        liquidity: totalPool,
        betCount: market._count.bets,
        event: {
          id: market.event.id,
          slug: market.event.slug,
          title: market.event.title,
          category: market.event.category,
          icon: market.event.logoUrl,
        },
      };
    });

    return NextResponse.json({ 
      events: transformedEvents,
      markets: transformedMarkets,
      query,
      count: transformedEvents.length + transformedMarkets.length,
    });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json(
      { error: "Failed to search" },
      { status: 500 }
    );
  }
}
