import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus } from "@vault/database";
import { requireAdmin } from "@vault/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BetStatus | null;
    const marketId = searchParams.get("marketId");
    const eventId = searchParams.get("eventId");
    const userId = searchParams.get("userId");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (marketId) where.marketId = marketId;
    if (eventId) where.market = { eventId };
    if (userId) where.userId = userId;

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              handle: true,
              profileImageUrl: true,
            },
          },
          market: {
            select: {
              id: true,
              question: true,
              outcomes: true,
              event: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                },
              },
            },
          },
          tweetProof: {
            select: {
              id: true,
              tweetUrl: true,
              tweetId: true,
              verified: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.bet.count({ where }),
    ]);

    // Transform bets to include outcome labels
    const transformedBets = bets.map((bet) => {
      const outcomes = JSON.parse(bet.market.outcomes) as string[];
      const outcomeColors = bet.market.outcomeColors 
        ? JSON.parse(bet.market.outcomeColors) as string[]
        : null;

      return {
        ...bet,
        outcomeLabel: outcomes[bet.outcomeIndex],
        outcomeColor: outcomeColors?.[bet.outcomeIndex] || null,
      };
    });

    return NextResponse.json({
      bets: transformedBets,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching bets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
