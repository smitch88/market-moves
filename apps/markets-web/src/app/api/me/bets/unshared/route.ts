import { NextResponse } from "next/server";
import { prisma, XPReason } from "@vault/database";
import { requireUser } from "@vault/auth";

/**
 * GET /api/me/bets/unshared
 * 
 * Get bets that are eligible for share XP (confirmed but not yet claimed).
 * Groups by market to show one bet per market position.
 */
export async function GET() {
  try {
    const user = await requireUser();

    // Get all confirmed bets for the user
    const confirmedBets = await prisma.bet.findMany({
      where: {
        userId: user.id,
        status: "CONFIRMED",
      },
      include: {
        market: {
          include: {
            event: {
              select: {
                id: true,
                slug: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get all share XP claims for this user
    const shareXpClaims = await prisma.xPLedger.findMany({
      where: {
        userId: user.id,
        reason: XPReason.SHARE_TWEET,
      },
      select: {
        correlationId: true,
      },
    });

    // Build a set of bet IDs that have already claimed share XP
    const claimedBetIds = new Set<string>();
    shareXpClaims.forEach((claim) => {
      // correlationId format: share-{betId} or share-{betId}-tweet-{tweetId}
      if (claim.correlationId) {
        const match = claim.correlationId.match(/^share-([^-]+)/);
        if (match) {
          claimedBetIds.add(match[1]);
        }
      }
    });

    // Filter bets to only those that haven't claimed share XP
    // Group by market and outcome to show the most recent unclaimed bet per position
    const unsharedByPosition = new Map<string, typeof confirmedBets[0]>();
    
    confirmedBets.forEach((bet) => {
      if (!claimedBetIds.has(bet.id)) {
        const positionKey = `${bet.marketId}-${bet.outcomeIndex}`;
        // Keep only the most recent unclaimed bet per position
        if (!unsharedByPosition.has(positionKey)) {
          unsharedByPosition.set(positionKey, bet);
        }
      }
    });

    const unsharedBets = Array.from(unsharedByPosition.values()).map((bet) => ({
      id: bet.id,
      marketId: bet.marketId,
      outcomeIndex: bet.outcomeIndex,
      amount: Number(bet.amount),
      createdAt: bet.createdAt.toISOString(),
      market: {
        id: bet.market.id,
        question: bet.market.question,
        outcomes: bet.market.outcomes,
        event: bet.market.event,
      },
    }));

    return NextResponse.json(unsharedBets);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching unshared bets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
