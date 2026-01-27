import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus } from "@vault/database";
import { requireUser } from "@vault/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get("marketId");

    if (!marketId) {
      return NextResponse.json({ error: "marketId is required" }, { status: 400 });
    }

    // Find pending bets for this user and market
    const pendingBet = await prisma.bet.findFirst({
      where: {
        userId: user.id,
        marketId,
        status: BetStatus.PENDING_TWEET,
      },
      include: {
        outcome: {
          select: {
            id: true,
            key: true,
            label: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ pendingBet });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching pending bet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

