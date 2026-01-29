import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/events
 * 
 * Polymarket-style events endpoint.
 * Returns events with their markets, outcomes, and prices.
 * 
 * Query params (Polymarket-compatible):
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - order: string (comma-separated fields, e.g., 'startDate,volume')
 * - ascending: boolean (default: false)
 * - active: boolean (filter by active status)
 * - closed: boolean (filter by closed status)
 * - featured: boolean (filter featured events)
 * - tag_id: string (filter by tag ID)
 * - slug: string[] (filter by slugs)
 * - category: string (filter by category)
 * - start_date_min: ISO date string
 * - start_date_max: ISO date string
 * - end_date_min: ISO date string
 * - end_date_max: ISO date string
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query params (Polymarket-style)
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const order = searchParams.get("order") || "startTime";
    const ascending = searchParams.get("ascending") === "true";
    
    // Filters
    const active = searchParams.get("active");
    const closed = searchParams.get("closed");
    const featured = searchParams.get("featured");
    const category = searchParams.get("category");
    const tagId = searchParams.get("tag_id");
    const slugs = searchParams.getAll("slug");
    
    // Date filters
    const startDateMin = searchParams.get("start_date_min");
    const startDateMax = searchParams.get("start_date_max");
    const endDateMin = searchParams.get("end_date_min");
    const endDateMax = searchParams.get("end_date_max");

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (active !== null) where.active = active === "true";
    if (closed !== null) where.closed = closed === "true";
    if (category) where.category = category;
    if (tagId) where.tags = { some: { id: tagId } };
    if (slugs.length > 0) where.slug = { in: slugs };
    
    // Date range filters
    if (startDateMin || startDateMax) {
      where.startTime = {};
      if (startDateMin) (where.startTime as Record<string, unknown>).gte = new Date(startDateMin);
      if (startDateMax) (where.startTime as Record<string, unknown>).lte = new Date(startDateMax);
    }
    if (endDateMin || endDateMax) {
      where.endTime = {};
      if (endDateMin) (where.endTime as Record<string, unknown>).gte = new Date(endDateMin);
      if (endDateMax) (where.endTime as Record<string, unknown>).lte = new Date(endDateMax);
    }

    // Build orderBy from comma-separated order param
    const orderFields = order.split(",").map((field) => field.trim());
    const orderBy = orderFields.map((field) => {
      // Map Polymarket field names to our schema
      const fieldMap: Record<string, string> = {
        startDate: "startTime",
        endDate: "endTime",
        createdAt: "createdAt",
        volume: "createdAt", // We'll sort by actual volume in post-processing
      };
      const mappedField = fieldMap[field] || field;
      return { [mappedField]: ascending ? "asc" : "desc" };
    });

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
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
              status: { in: ["PUBLISHED", "OPEN", "CLOSED", "RESOLVED"] },
            },
            select: {
              id: true,
              question: true,
              outcomes: true,
              outcomePrices: true,
              status: true,
              closesAt: true,
              resolvedOutcome: true,
              pool0: true,
              pool1: true,
              seed0: true,
              seed1: true,
              feeBps: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: { bets: { where: { status: "CONFIRMED" } } },
              },
            },
            orderBy: { closesAt: "asc" },
          },
        },
        orderBy: orderBy as never,
        take: limit,
        skip: offset,
      }),
      prisma.event.count({ where }),
    ]);

    // Transform to Polymarket-style response
    const response = events.map((event) => {
      // Calculate event-level volume and liquidity from markets
      let eventVolume = 0;
      let eventLiquidity = 0;

      const markets = event.markets.map((market) => {
        // Calculate prices from pools (convert Decimals to numbers)
        const s0 = Number(market.seed0);
        const s1 = Number(market.seed1);
        const p0 = Number(market.pool0);
        const p1 = Number(market.pool1);
        
        const pool0 = s0 + p0;
        const pool1 = s1 + p1;
        const totalPool = pool0 + pool1;
        const price0 = totalPool > 0 ? (pool0 / totalPool).toFixed(4) : "0.5000";
        const price1 = totalPool > 0 ? (pool1 / totalPool).toFixed(4) : "0.5000";
        
        const volume = p0 + p1;
        const liquidity = totalPool;
        
        eventVolume += volume;
        eventLiquidity += liquidity;

        // Determine if market is "new" (created within last 24 hours)
        const isNew = Date.now() - new Date(market.createdAt).getTime() < 24 * 60 * 60 * 1000;

        return {
          id: market.id,
          question: market.question,
          outcomes: market.outcomes, // JSON string like '["Yes", "No"]'
          outcomePrices: JSON.stringify([price0, price1]),
          outcomeColors: null,
          volume: volume.toString(),
          volumeNum: volume,
          liquidity: liquidity.toString(),
          liquidityNum: liquidity,
          active: market.status === "OPEN",
          closed: ["CLOSED", "RESOLVED", "SETTLED"].includes(market.status),
          endDate: market.closesAt?.toISOString() || null,
          resolvedOutcome: market.resolvedOutcome,
          new: isNew,
          fee: (market.feeBps / 10000).toString(),
          betCount: market._count.bets,
          createdAt: market.createdAt.toISOString(),
          updatedAt: market.updatedAt.toISOString(),
        };
      });

      // Determine if event is "new" (created within last 24 hours)
      const isNew = Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000;
      
      // Check if featured (has any open markets)
      const isFeatured = featured === "true" ? true : undefined;

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        // Polymarket uses 'image' and 'icon' 
        image: event.bannerUrl,
        icon: event.logoUrl,
        // Also include our naming for backward compat
        bannerUrl: event.bannerUrl,
        logoUrl: event.logoUrl,
        category: event.category,
        active: event.active,
        closed: event.closed,
        new: isNew,
        featured: isFeatured,
        // Polymarket uses startDate/endDate
        startDate: event.startTime?.toISOString() || null,
        endDate: event.endTime?.toISOString() || null,
        // Also include our naming
        startTime: event.startTime?.toISOString() || null,
        endTime: event.endTime?.toISOString() || null,
        // Aggregated stats
        volume: eventVolume,
        liquidity: eventLiquidity,
        // Nested data
        tags: event.tags,
        markets,
        // Timestamps
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      };
    });

    // If sorting by volume, sort in memory
    if (order.includes("volume")) {
      response.sort((a, b) => ascending 
        ? a.volume - b.volume 
        : b.volume - a.volume
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
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
