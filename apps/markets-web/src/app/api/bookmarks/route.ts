import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus } from "@vault/database";
import { requireUser } from "@vault/auth";

// GET /api/bookmarks - List user's bookmarked events
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            category: true,
            bannerUrl: true,
            logoUrl: true,
            startTime: true,
            endTime: true,
            active: true,
            isPublished: true,
            _count: {
              select: { markets: true },
            },
            markets: {
              where: {
                isPublished: true,
                status: { in: ["PUBLISHED", "OPEN"] },
              },
              select: {
                id: true,
                seed0: true,
                seed1: true,
                pool0: true,
                pool1: true,
                closesAt: true,
                _count: {
                  select: {
                    bets: { where: { status: BetStatus.CONFIRMED } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to include aggregations
    const bookmarksWithAggregations = bookmarks
      .filter((b) => b.event.isPublished && b.event.active)
      .map((bookmark) => {
        const totalVolume = bookmark.event.markets.reduce((sum, market) => {
          return (
            sum +
            Number(market.seed0 || 0) +
            Number(market.seed1 || 0) +
            Number(market.pool0 || 0) +
            Number(market.pool1 || 0)
          );
        }, 0);

        const totalBets = bookmark.event.markets.reduce((sum, market) => {
          return sum + market._count.bets;
        }, 0);

        const earliestClose = bookmark.event.markets.reduce(
          (earliest, market) => {
            if (!market.closesAt) return earliest;
            if (!earliest) return market.closesAt;
            return market.closesAt < earliest ? market.closesAt : earliest;
          },
          null as Date | null
        );

        const { markets, ...eventData } = bookmark.event;

        return {
          id: bookmark.id,
          eventId: bookmark.eventId,
          createdAt: bookmark.createdAt.toISOString(),
          event: {
            ...eventData,
            startTime: eventData.startTime?.toISOString() ?? null,
            endTime: eventData.endTime?.toISOString() ?? null,
            _aggregations: {
              totalVolume,
              totalBets,
              earliestClose: earliestClose?.toISOString() ?? null,
            },
          },
        };
      });

    return NextResponse.json({ bookmarks: bookmarksWithAggregations });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching bookmarks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/bookmarks - Add a bookmark
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // Check if event exists and is published
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, isPublished: true, active: true },
    });

    if (!event || !event.isPublished || !event.active) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Create bookmark (upsert to handle duplicates gracefully)
    const bookmark = await prisma.bookmark.upsert({
      where: {
        userId_eventId: {
          userId: user.id,
          eventId,
        },
      },
      update: {}, // No update needed if it exists
      create: {
        userId: user.id,
        eventId,
      },
    });

    return NextResponse.json({ bookmark, created: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating bookmark:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
