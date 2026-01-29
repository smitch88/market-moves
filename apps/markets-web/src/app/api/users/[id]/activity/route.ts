import { NextRequest, NextResponse } from "next/server";
import { prisma, BalanceReason } from "@vault/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to find user by ID first, then by handle
    let targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    // If not found by ID, try by handle (case-insensitive)
    if (!targetUser) {
      targetUser = await prisma.user.findFirst({
        where: {
          handle: {
            equals: id,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = targetUser.id;

    const [bets, redemptions] = await Promise.all([
      prisma.bet.findMany({
        where: { userId },
        include: {
          market: {
            select: { 
              question: true,
              outcomes: true,
              event: {
                select: {
                  slug: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      // Fetch redemption ledger entries (SETTLEMENT_PAYOUT)
      prisma.balanceLedger.findMany({
        where: {
          userId,
          reason: BalanceReason.SETTLEMENT_PAYOUT,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    // Get market info for redemptions (correlationId is the position ID)
    const positionIds = redemptions.map((r) => r.correlationId).filter(Boolean) as string[];
    const redemptionPositions = positionIds.length > 0 
      ? await prisma.position.findMany({
          where: { id: { in: positionIds } },
          include: {
            market: {
              select: {
                id: true,
                question: true,
                outcomes: true,
                resolvedOutcome: true,
                event: {
                  select: {
                    slug: true,
                    title: true,
                  },
                },
              },
            },
          },
        })
      : [];

    // Create a map of position ID to position data
    const positionMap = new Map(redemptionPositions.map((p) => [p.id, p]));

    // Transform redemptions to activity entries
    const redemptionEntries = redemptions.map((ledger) => {
      const position = ledger.correlationId ? positionMap.get(ledger.correlationId) : null;
      const outcomes = position?.market.outcomes 
        ? JSON.parse(position.market.outcomes) as string[]
        : ["Yes", "No"];
      const colors = ["#22c55e", "#ef4444"]; // Default colors (outcomeColors not in schema)
      const resolvedOutcome = position?.market.resolvedOutcome ?? 0;

      return {
        id: ledger.id,
        type: "REDEMPTION" as const,
        amount: Number(ledger.delta),
        createdAt: ledger.createdAt.toISOString(),
        outcomeIndex: resolvedOutcome,
        outcomeLabel: outcomes[resolvedOutcome],
        outcomeColor: colors[resolvedOutcome],
        market: position?.market ? {
          question: position.market.question,
          outcomes: position.market.outcomes,
          outcomeColors: null,
          event: position.market.event,
        } : null,
      };
    });

    // Transform bets to include outcome labels and serialize Decimals
    const transformedBets = bets.map((bet) => {
      const outcomes = JSON.parse(bet.market.outcomes) as string[];
      return {
        id: bet.id,
        amount: Number(bet.amount),
        shares: bet.shares ? Number(bet.shares) : undefined,
        tradeType: bet.tradeType,
        status: bet.status,
        createdAt: bet.createdAt.toISOString(),
        outcomeIndex: bet.outcomeIndex,
        outcomeLabel: outcomes[bet.outcomeIndex],
        market: {
          question: bet.market.question,
          outcomes: bet.market.outcomes,
          outcomeColors: null,
          event: bet.market.event,
        },
      };
    });

    return NextResponse.json({ 
      bets: transformedBets, 
      redemptions: redemptionEntries,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching user activity:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
