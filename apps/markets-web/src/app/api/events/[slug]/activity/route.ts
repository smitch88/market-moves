import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus, Prisma } from "@vault/database";

/**
 * GET /api/events/[slug]/activity
 * Get recent betting activity for an event
 * 
 * Query params:
 * - marketId: Optional filter to specific market
 * - limit: Number of bets to return (default: 15, max: 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    
    const marketId = searchParams.get("marketId");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(50, Math.max(1, parseInt(limitParam || "15", 10)));

    // Find event by slug or id
    const event = await prisma.event.findFirst({
      where: {
        OR: [
          { slug },
          { id: slug },
        ],
      },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventId = event.id;

    // Build where clause
    const whereClause: Prisma.BetWhereInput = {
      market: { eventId },
      status: BetStatus.CONFIRMED,
      tradeType: "BUY",
    };

    if (marketId) {
      whereClause.market = { eventId, id: marketId };
    }

    // Fetch recent bets with user and market info
    const bets = await prisma.bet.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            handle: true,
            profileImageUrl: true,
            isKOL: true,
          },
        },
        market: {
          select: {
            id: true,
            question: true,
            outcomes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Transform to response format
    const activity = bets.map((bet) => {
      const outcomes = JSON.parse(bet.market.outcomes) as string[];
      const outcomeLabel = outcomes[bet.outcomeIndex] || `Outcome ${bet.outcomeIndex}`;

      return {
        id: bet.id,
        user: {
          id: bet.user.id,
          name: bet.user.name,
          handle: bet.user.handle,
          profileImageUrl: bet.user.profileImageUrl,
          isKOL: bet.user.isKOL,
        },
        market: {
          id: bet.market.id,
          question: bet.market.question,
        },
        amount: Number(bet.amount),
        outcomeIndex: bet.outcomeIndex,
        outcomeLabel,
        createdAt: bet.createdAt.toISOString(),
      };
    });

    return NextResponse.json(
      { bets: activity },
      {
        headers: {
          // Short cache for real-time feel
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching event activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
