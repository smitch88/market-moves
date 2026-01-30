import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus, Prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BetStatus | null;
    const marketId = searchParams.get("marketId");
    const eventId = searchParams.get("eventId");
    const userId = searchParams.get("userId");
    const userSearch = searchParams.get("userSearch"); // Search by handle or name
    const tweetStatus = searchParams.get("tweetStatus"); // Filter by tweet verification status
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = searchParams.get("sortDir") || "desc";
    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    const where: Prisma.BetWhereInput = {};
    if (status) where.status = status;
    if (marketId) where.marketId = marketId;
    if (eventId) where.market = { eventId };
    if (userId) where.userId = userId;
    
    // Search by user handle or name
    if (userSearch) {
      where.user = {
        OR: [
          { handle: { contains: userSearch, mode: "insensitive" } },
          { name: { contains: userSearch, mode: "insensitive" } },
        ],
      };
    }

    // Filter by tweet verification status
    if (tweetStatus === "verified") {
      where.tweetProof = { verified: true };
    } else if (tweetStatus === "unverified") {
      where.tweetProof = { verified: false };
    } else if (tweetStatus === "has_tweet") {
      where.tweetProof = { isNot: null };
    } else if (tweetStatus === "no_tweet") {
      where.tweetProof = null;
    }

    // Build orderBy
    let orderBy: Prisma.BetOrderByWithRelationInput = { createdAt: "desc" };
    if (sortBy === "amount") {
      orderBy = { amount: sortDir as "asc" | "desc" };
    } else if (sortBy === "createdAt") {
      orderBy = { createdAt: sortDir as "asc" | "desc" };
    }

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
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.bet.count({ where }),
    ]);

    // Transform bets to include outcome labels
    const transformedBets = bets.map((bet) => {
      const outcomes = JSON.parse(bet.market.outcomes) as string[];

      return {
        ...bet,
        outcomeLabel: outcomes[bet.outcomeIndex],
        outcomeColor: null, // outcomeColors not in schema
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
