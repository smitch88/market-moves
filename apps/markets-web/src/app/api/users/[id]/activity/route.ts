import { NextRequest, NextResponse } from "next/server";
import { prisma, BalanceReason } from "@vault/database";
import { requireUser } from "@vault/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Users can only view their own activity
    if (user.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [bets, positions, redemptions] = await Promise.all([
      prisma.bet.findMany({
        where: { userId: id },
        include: {
          market: {
            select: { 
              question: true,
              outcomes: true,
              outcomeColors: true,
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
      prisma.position.findMany({
        where: { userId: id },
        include: {
          market: {
            select: { 
              question: true, 
              status: true,
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
        orderBy: { lastBetAt: "desc" },
      }),
      // Fetch redemption ledger entries (SETTLEMENT_PAYOUT)
      prisma.balanceLedger.findMany({
        where: {
          userId: id,
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
                outcomeColors: true,
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
      const colors = position?.market.outcomeColors
        ? JSON.parse(position.market.outcomeColors) as string[]
        : ["#22c55e", "#ef4444"];
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
          outcomeColors: position.market.outcomeColors,
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
          outcomeColors: bet.market.outcomeColors,
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
