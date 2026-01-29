import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";

export async function GET(request: NextRequest) {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get("marketId");

    // If marketId is provided, return single position for that market
    if (marketId) {
      const position = await prisma.position.findUnique({
        where: {
          userId_marketId: {
            userId: user.id,
            marketId,
          },
        },
        include: {
          market: {
            select: {
              id: true,
              question: true,
              outcomes: true,
              outcomePrices: true,
              status: true,
              pricingModel: true,
              reserve0: true,
              reserve1: true,
            },
          },
        },
      });

      // Return null if no position exists (not an error)
      return NextResponse.json(position);
    }

    // Otherwise return all positions for the user
    const positions = await prisma.position.findMany({
      where: {
        userId: user.id,
        OR: [
          { shares0: { gt: 0 } },
          { shares1: { gt: 0 } },
          { amount0: { gt: 0 } },
          { amount1: { gt: 0 } },
        ],
      },
      include: {
        market: {
          select: {
            id: true,
            question: true,
            outcomes: true,
            outcomePrices: true,
            outcomeColors: true,
            status: true,
            pricingModel: true,
            reserve0: true,
            reserve1: true,
            resolvedOutcome: true,
            settledAt: true,
            event: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error("Error fetching positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
