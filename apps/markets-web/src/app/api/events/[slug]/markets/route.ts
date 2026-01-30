import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

// GET /api/events/[slug]/markets - Get markets for an event (for quick bet)
// Supports lookup by both slug and ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Try to find by slug first, then by ID
    let event = await prisma.event.findFirst({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        bannerUrl: true,
        logoUrl: true,
        category: true,
        isPublished: true,
        active: true,
        markets: {
          where: {
            isPublished: true,
            status: { in: ["PUBLISHED", "OPEN"] },
          },
          select: {
            id: true,
            question: true,
            outcomes: true,
            status: true,
            closesAt: true,
            seed0: true,
            seed1: true,
            pool0: true,
            pool1: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // If not found by slug, try by ID
    if (!event) {
      event = await prisma.event.findUnique({
        where: { id: slug },
        select: {
          id: true,
          title: true,
          slug: true,
          bannerUrl: true,
          logoUrl: true,
          category: true,
          isPublished: true,
          active: true,
          markets: {
            where: {
              isPublished: true,
              status: { in: ["PUBLISHED", "OPEN"] },
            },
            select: {
              id: true,
              question: true,
              outcomes: true,
              status: true,
              closesAt: true,
              seed0: true,
              seed1: true,
              pool0: true,
              pool1: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!event.isPublished || !event.active) {
      return NextResponse.json({ error: "Event not available" }, { status: 404 });
    }

    // Transform markets with stats
    const marketsWithStats = event.markets.map((market) => {
      const seed0 = Number(market.seed0 || 0);
      const seed1 = Number(market.seed1 || 0);
      const pool0 = Number(market.pool0 || 0);
      const pool1 = Number(market.pool1 || 0);
      const total0 = seed0 + pool0;
      const total1 = seed1 + pool1;
      const totalPool = total0 + total1;

      const percent0 = totalPool > 0 ? Math.round((total0 / totalPool) * 100) : 50;
      const percent1 = totalPool > 0 ? Math.round((total1 / totalPool) * 100) : 50;

      return {
        id: market.id,
        question: market.question,
        outcomes: market.outcomes,
        status: market.status,
        closesAt: market.closesAt,
        stats: {
          percent0,
          percent1,
          totalPool,
        },
      };
    });

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        bannerUrl: event.bannerUrl,
        logoUrl: event.logoUrl,
        category: event.category,
      },
      markets: marketsWithStats,
    });
  } catch (error) {
    console.error("Error fetching event markets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
