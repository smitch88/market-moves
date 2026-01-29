import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";

// Helper to serialize Decimal fields to numbers
function serializePosition(position: {
  id: string;
  shares0: unknown;
  shares1: unknown;
  avgCost0: unknown;
  avgCost1: unknown;
  amount0: unknown;
  amount1: unknown;
  claimedAt: Date | null;
  updatedAt: Date;
  market: {
    id: string;
    question: string;
    outcomes: string;
    outcomePrices: string;
    outcomeColors?: string | null;
    status: string;
    pricingModel: string;
    reserve0: unknown;
    reserve1: unknown;
    resolvedOutcome?: number | null;
    settledAt?: Date | null;
    feeBps?: number;
    pool0?: unknown;
    pool1?: unknown;
    seed0?: unknown;
    seed1?: unknown;
    event?: { id: string; title: string; slug: string } | null;
  };
}) {
  return {
    id: position.id,
    shares0: Number(position.shares0),
    shares1: Number(position.shares1),
    avgCost0: Number(position.avgCost0),
    avgCost1: Number(position.avgCost1),
    amount0: Number(position.amount0),
    amount1: Number(position.amount1),
    claimedAt: position.claimedAt?.toISOString() ?? null,
    updatedAt: position.updatedAt.toISOString(),
    market: {
      id: position.market.id,
      question: position.market.question,
      outcomes: position.market.outcomes,
      outcomePrices: position.market.outcomePrices,
      outcomeColors: position.market.outcomeColors,
      status: position.market.status,
      pricingModel: position.market.pricingModel,
      reserve0: Number(position.market.reserve0),
      reserve1: Number(position.market.reserve1),
      resolvedOutcome: position.market.resolvedOutcome ?? null,
      settledAt: position.market.settledAt?.toISOString() ?? null,
      feeBps: position.market.feeBps ?? 100,
      pool0: Number(position.market.pool0 ?? 0),
      pool1: Number(position.market.pool1 ?? 0),
      seed0: Number(position.market.seed0 ?? 0),
      seed1: Number(position.market.seed1 ?? 0),
      event: position.market.event,
    },
  };
}

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

      if (!position) {
        return NextResponse.json(null);
      }

      // Serialize single position
      return NextResponse.json({
        id: position.id,
        shares0: Number(position.shares0),
        shares1: Number(position.shares1),
        avgCost0: Number(position.avgCost0),
        avgCost1: Number(position.avgCost1),
        amount0: Number(position.amount0),
        amount1: Number(position.amount1),
        claimedAt: position.claimedAt?.toISOString() ?? null,
        updatedAt: position.updatedAt.toISOString(),
        market: {
          id: position.market.id,
          question: position.market.question,
          outcomes: position.market.outcomes,
          outcomePrices: position.market.outcomePrices,
          status: position.market.status,
          pricingModel: position.market.pricingModel,
          reserve0: Number(position.market.reserve0),
          reserve1: Number(position.market.reserve1),
        },
      });
    }

    // Check for filter params
    const includeSettled = searchParams.get("includeSettled") === "true";

    // Otherwise return all positions for the user
    const positions = await prisma.position.findMany({
      where: {
        userId: user.id,
        // Filter out claimed positions unless explicitly requested
        ...(includeSettled ? {} : { claimedAt: null }),
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
            feeBps: true,
            pool0: true,
            pool1: true,
            seed0: true,
            seed1: true,
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

    // Serialize all positions to convert Decimals to numbers
    const serializedPositions = positions.map(serializePosition);

    return NextResponse.json(serializedPositions);
  } catch (error) {
    console.error("Error fetching positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
