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
        market: {
          select: {
            outcomes: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!pendingBet) {
      return NextResponse.json({ pendingBet: null });
    }

    // Parse outcomes and add the label to the response
    const outcomes = JSON.parse(pendingBet.market.outcomes) as string[];
    const outcomeColors = pendingBet.market.outcomeColors 
      ? JSON.parse(pendingBet.market.outcomeColors) as string[]
      : null;

    return NextResponse.json({ 
      pendingBet: {
        ...pendingBet,
        outcomeLabel: outcomes[pendingBet.outcomeIndex],
        outcomeColor: outcomeColors?.[pendingBet.outcomeIndex] || null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching pending bet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
