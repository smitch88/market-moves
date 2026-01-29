import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/users/[id]/positions
 * 
 * Get public positions for a user by their ID or handle.
 * This is a public endpoint - no authentication required.
 */
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

    // Fetch positions with market data
    const positions = await prisma.position.findMany({
      where: {
        userId,
        // Only show unclaimed positions (active positions)
        claimedAt: null,
      },
      include: {
        market: {
          select: {
            id: true,
            question: true,
            status: true,
            outcomes: true,
            outcomePrices: true,
            resolvedOutcome: true,
            settledAt: true,
            feeBps: true,
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
    });

    // Transform positions with serialized Decimals
    const transformedPositions = positions.map((pos) => {
      const outcomes = JSON.parse(pos.market.outcomes) as string[];
      const colors = ["#22c55e", "#ef4444"]; // Default colors (outcomeColors not in schema)
      const prices = pos.market.outcomePrices
        ? (JSON.parse(pos.market.outcomePrices) as number[])
        : [0.5, 0.5];

      // Calculate position value and cost
      const shares0 = Number(pos.shares0);
      const shares1 = Number(pos.shares1);
      const avgCost0 = Number(pos.avgCost0);
      const avgCost1 = Number(pos.avgCost1);
      
      // Current value based on market prices
      const value0 = shares0 * Number(prices[0]);
      const value1 = shares1 * Number(prices[1]);
      const totalValue = value0 + value1;
      
      // Total cost = shares * average cost per share
      const totalCost = (shares0 * avgCost0) + (shares1 * avgCost1);
      const unrealizedPnL = totalValue - totalCost;

      return {
        id: pos.id,
        marketId: pos.marketId,
        shares0,
        shares1,
        avgCost0,
        avgCost1,
        totalCost,
        totalValue,
        unrealizedPnL,
        avgPrice0: avgCost0 || null,
        avgPrice1: avgCost1 || null,
        lastBetAt: pos.lastBetAt?.toISOString() || null,
        market: {
          id: pos.market.id,
          question: pos.market.question,
          status: pos.market.status,
          outcomes,
          outcomeColors: colors,
          outcomePrices: prices,
          resolvedOutcome: pos.market.resolvedOutcome,
          settledAt: pos.market.settledAt?.toISOString() || null,
          feeBps: pos.market.feeBps,
          event: pos.market.event,
        },
      };
    });

    return NextResponse.json(transformedPositions);
  } catch (error) {
    console.error("Error fetching user positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
