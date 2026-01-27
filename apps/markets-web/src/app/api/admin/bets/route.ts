import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus } from "@vault/database";
import { requireAdmin } from "@vault/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BetStatus | null;
    const marketId = searchParams.get("marketId");
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (status) where.status = status;
    if (marketId) where.marketId = marketId;
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
              title: true,
              slug: true,
            },
          },
          outcome: {
            select: {
              id: true,
              key: true,
              label: true,
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

    return NextResponse.json({ bets, total });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching bets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

