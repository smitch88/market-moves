import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus } from "@vault/database";

/**
 * GET /api/markets
 * 
 * Polymarket-style markets endpoint.
 * List individual markets with filtering and sorting.
 * 
 * Query params (Polymarket-compatible):
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - order: string (comma-separated fields)
 * - ascending: boolean (default: false)
 * - active: boolean
 * - closed: boolean
 * - event_id: string (filter by parent event)
 * - q: string (search query)
 * - category: string
 * - end_date_min: ISO date
 * - end_date_max: ISO date
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const order = searchParams.get("order") || "createdAt";
    const ascending = searchParams.get("ascending") === "true";
    
    // Filters
    const query = searchParams.get("q");
    const active = searchParams.get("active");
    const closed = searchParams.get("closed");
    const category = searchParams.get("category");
    const eventId = searchParams.get("event_id");
    const endDateMin = searchParams.get("end_date_min");
    const endDateMax = searchParams.get("end_date_max");

    // Build where clause
    const where: Record<string, unknown> = {};
    
    // Status filter based on active/closed
    if (active === "true") {
      where.status = MarketStatus.OPEN;
    } else if (closed === "true") {
      where.status = { in: [MarketStatus.CLOSED, MarketStatus.RESOLVED, MarketStatus.SETTLED] };
    } else {
      // Default: show published and open markets
      where.status = { in: [MarketStatus.PUBLISHED, MarketStatus.OPEN] };
    }
    
    if (eventId) where.eventId = eventId;
    if (category) where.event = { category: category as never };
    
    // Search
    if (query) {
      where.OR = [
        { question: { contains: query, mode: "insensitive" } },
        { event: { title: { contains: query, mode: "insensitive" } } },
        { event: { slug: { contains: query, mode: "insensitive" } } },
      ];
    }
    
    // Date filters
    if (endDateMin || endDateMax) {
      where.closesAt = {};
      if (endDateMin) (where.closesAt as Record<string, unknown>).gte = new Date(endDateMin);
      if (endDateMax) (where.closesAt as Record<string, unknown>).lte = new Date(endDateMax);
    }

    // Build orderBy
    const orderFields = order.split(",").map((f) => f.trim());
    const orderBy = orderFields.map((field) => {
      const fieldMap: Record<string, string> = {
        endDate: "closesAt",
        volume: "pool0", // approximate, will sort in post-processing
      };
      const mappedField = fieldMap[field] || field;
      return { [mappedField]: ascending ? "asc" : "desc" };
    });

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        include: {
          event: {
            select: {
              id: true,
              slug: true,
              title: true,
              category: true,
              bannerUrl: true,
              logoUrl: true,
              active: true,
              closed: true,
              startTime: true,
              endTime: true,
            },
          },
          _count: {
            select: { 
              bets: { where: { status: "CONFIRMED" } },
              positions: true,
            },
          },
        },
        orderBy: orderBy as never,
        take: limit,
        skip: offset,
      }),
      prisma.market.count({ where }),
    ]);

    // Transform to Polymarket-style response
    const response = markets.map((market) => {
      // Convert Decimals to numbers
      const seed0 = Number(market.seed0);
      const seed1 = Number(market.seed1);
      const poolVal0 = Number(market.pool0);
      const poolVal1 = Number(market.pool1);
      
      const pool0 = seed0 + poolVal0;
      const pool1 = seed1 + poolVal1;
      const totalPool = pool0 + pool1;
      const price0 = totalPool > 0 ? (pool0 / totalPool).toFixed(4) : "0.5000";
      const price1 = totalPool > 0 ? (pool1 / totalPool).toFixed(4) : "0.5000";
      
      const volume = poolVal0 + poolVal1;
      const liquidity = totalPool;

      const isNew = Date.now() - new Date(market.createdAt).getTime() < 24 * 60 * 60 * 1000;

      return {
        id: market.id,
        question: market.question,
        // JSON strings (Polymarket style)
        outcomes: market.outcomes,
        outcomePrices: JSON.stringify([price0, price1]),
        outcomeColors: null,
        // Status
        status: market.status,
        active: market.status === "OPEN",
        closed: ["CLOSED", "RESOLVED", "SETTLED"].includes(market.status),
        resolvedOutcome: market.resolvedOutcome,
        new: isNew,
        // Dates
        endDate: market.closesAt?.toISOString() || null,
        closesAt: market.closesAt?.toISOString() || null,
        // Stats
        volume: volume.toString(),
        volumeNum: volume,
        liquidity: liquidity.toString(),
        liquidityNum: liquidity,
        pool0,
        pool1,
        fee: (market.feeBps / 10000).toString(),
        betCount: market._count.bets,
        positionCount: market._count.positions,
        // Parent event (Polymarket includes this)
        event: {
          id: market.event.id,
          slug: market.event.slug,
          title: market.event.title,
          category: market.event.category,
          image: market.event.bannerUrl,
          icon: market.event.logoUrl,
          active: market.event.active,
          closed: market.event.closed,
          startDate: market.event.startTime?.toISOString() || null,
          endDate: market.event.endTime?.toISOString() || null,
        },
        // Timestamps
        createdAt: market.createdAt.toISOString(),
        updatedAt: market.updatedAt.toISOString(),
      };
    });

    // Sort by volume if requested (in-memory since we can't do it in DB)
    if (order.includes("volume")) {
      response.sort((a, b) => ascending 
        ? a.volumeNum - b.volumeNum 
        : b.volumeNum - a.volumeNum
      );
    }

    return NextResponse.json(response, {
      headers: {
        "X-Total-Count": total.toString(),
        "X-Limit": limit.toString(),
        "X-Offset": offset.toString(),
      },
    });
  } catch (error) {
    console.error("Error fetching markets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
