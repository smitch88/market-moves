import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { ConstantProductAMM } from "@/lib/services/pricing-engine";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface PositionSimulation {
  positionId: string;
  userId: string;
  userHandle: string | null;
  userName: string | null;
  before: {
    shares0: number;
    shares1: number;
    avgCost0: number;
    avgCost1: number;
    value0: number;
    value1: number;
    totalValue: number;
    costBasis0: number;
    costBasis1: number;
    totalCostBasis: number;
    unrealizedPnL: number;
  };
  after: {
    shares0: number;
    shares1: number;
    avgCost0: number;
    avgCost1: number;
    value0: number;
    value1: number;
    totalValue: number;
    costBasis0: number;
    costBasis1: number;
    totalCostBasis: number;
    unrealizedPnL: number;
  };
  change: {
    shares0Diff: number;
    shares1Diff: number;
    shares0Pct: number;
    shares1Pct: number;
    valueDiff: number;
    pnlDiff: number;
  };
}

export interface RecalibrationSimulation {
  marketId: string;
  question: string;
  canRecalibrate: boolean;
  reason?: string;
  market: {
    before: {
      reserve0: number;
      reserve1: number;
      k: number | null;
      price0: number;
      price1: number;
    };
    after: {
      reserve0: number;
      reserve1: number;
      k: number;
      price0: number;
      price1: number;
    };
    pools: {
      pool0: number;
      pool1: number;
      totalPool0: number;
      totalPool1: number;
    };
  };
  summary: {
    totalPositions: number;
    positionsWithShares: number;
    totalCostBasisBefore: number;
    totalCostBasisAfter: number;
    totalValueBefore: number;
    totalValueAfter: number;
  };
  positions: PositionSimulation[];
}

/**
 * GET /api/admin/markets/[id]/recalibrate/simulate
 * 
 * Simulates what would happen if recalibration was run.
 * Shows before/after for all positions WITHOUT making any changes.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse<RecalibrationSimulation | { error: string }>> {
  try {
    await requireAdmin();
    const { id } = await params;

    const market = await prisma.market.findUnique({
      where: { id },
      select: {
        id: true,
        question: true,
        status: true,
        seed0: true,
        seed1: true,
        pool0: true,
        pool1: true,
        reserve0: true,
        reserve1: true,
        k: true,
        outcomePrices: true,
        positions: {
          select: {
            id: true,
            userId: true,
            shares0: true,
            shares1: true,
            avgCost0: true,
            avgCost1: true,
            user: {
              select: {
                handle: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Check if recalibration is allowed
    const canRecalibrate = ["OPEN", "DRAFT"].includes(market.status);
    if (!canRecalibrate) {
      return NextResponse.json({
        marketId: market.id,
        question: market.question,
        canRecalibrate: false,
        reason: `Cannot recalibrate ${market.status} markets. Only OPEN or DRAFT markets can be recalibrated.`,
        market: {
          before: { reserve0: 0, reserve1: 0, k: null, price0: 0, price1: 0 },
          after: { reserve0: 0, reserve1: 0, k: 0, price0: 0, price1: 0 },
        },
        summary: {
          totalPositions: 0,
          positionsWithShares: 0,
          totalCostBasisBefore: 0,
          totalCostBasisAfter: 0,
          totalValueBefore: 0,
          totalValueAfter: 0,
        },
        positions: [],
      });
    }

    // Current market values
    const currentReserve0 = Number(market.reserve0);
    const currentReserve1 = Number(market.reserve1);
    const currentK = market.k ? Number(market.k) : null;
    const seed0 = Number(market.seed0);
    const seed1 = Number(market.seed1);
    const pool0 = Number(market.pool0);
    const pool1 = Number(market.pool1);

    // Parse current prices
    let currentPrice0 = 0.5;
    let currentPrice1 = 0.5;
    try {
      const prices = JSON.parse(market.outcomePrices);
      currentPrice0 = parseFloat(prices[0]);
      currentPrice1 = parseFloat(prices[1]);
    } catch {
      // Use defaults
    }

    // Calculate POOL-WEIGHTED target prices based on actual betting
    // Total money on each side = seed + pool
    const totalPool0 = seed0 + pool0;
    const totalPool1 = seed1 + pool1;
    const totalLiquidity = totalPool0 + totalPool1;

    // In CPMM: price of outcome = OTHER side's pool / total
    // More bets on an outcome = higher price for that outcome
    // This reflects market sentiment from actual betting
    let targetPrice0: number;
    let targetPrice1: number;

    if (totalLiquidity > 0) {
      // Price reflects betting weight on each side
      // If more $ bet on outcome 1 (No), outcome 1 price is higher
      targetPrice0 = totalPool0 / totalLiquidity;
      targetPrice1 = totalPool1 / totalLiquidity;
    } else {
      // Fallback to 50/50 if no pools
      targetPrice0 = 0.5;
      targetPrice1 = 0.5;
    }

    // Ensure prices are within valid bounds (1% - 99%)
    targetPrice0 = Math.max(0.01, Math.min(0.99, targetPrice0));
    targetPrice1 = Math.max(0.01, Math.min(0.99, targetPrice1));
    
    // Normalize to ensure they sum to 1
    const priceSum = targetPrice0 + targetPrice1;
    targetPrice0 = targetPrice0 / priceSum;
    targetPrice1 = targetPrice1 / priceSum;

    // Calculate new reserves to achieve target prices while maintaining liquidity depth
    // Use original k from seeds for liquidity depth
    const targetK = seed0 * seed1;
    
    // Given target price and k, solve for reserves:
    // price0 = reserve1 / (reserve0 + reserve1)
    // k = reserve0 * reserve1
    // 
    // Let ratio = reserve0 / reserve1 = (1 - price0) / price0 = price1 / price0
    const ratio = targetPrice1 / targetPrice0;
    
    // k = reserve0 * reserve1 = ratio * reserve1 * reserve1 = ratio * reserve1^2
    // reserve1 = sqrt(k / ratio)
    const newReserve1 = Math.sqrt(targetK / ratio);
    const newReserve0 = ratio * newReserve1;
    const newK = newReserve0 * newReserve1;
    
    // Verify prices
    const newPrice0 = newReserve1 / (newReserve0 + newReserve1);
    const newPrice1 = newReserve0 / (newReserve0 + newReserve1);

    // Simulate position changes
    const positionSimulations: PositionSimulation[] = [];
    let totalCostBasisBefore = 0;
    let totalCostBasisAfter = 0;
    let totalValueBefore = 0;
    let totalValueAfter = 0;
    let positionsWithShares = 0;

    for (const position of market.positions) {
      const oldShares0 = Number(position.shares0);
      const oldShares1 = Number(position.shares1);
      const oldAvgCost0 = Number(position.avgCost0);
      const oldAvgCost1 = Number(position.avgCost1);

      // Skip positions with no shares
      if (oldShares0 === 0 && oldShares1 === 0) continue;
      positionsWithShares++;

      // Calculate cost basis (what user actually spent)
      const costBasis0 = oldShares0 * oldAvgCost0;
      const costBasis1 = oldShares1 * oldAvgCost1;
      const totalCostBasis = costBasis0 + costBasis1;

      // Current value
      const currentValue0 = oldShares0 * currentPrice0;
      const currentValue1 = oldShares1 * currentPrice1;
      const currentTotalValue = currentValue0 + currentValue1;
      const currentPnL = currentTotalValue - totalCostBasis;

      // New shares after recalibration (preserving cost basis)
      const newShares0 = newPrice0 > 0 ? costBasis0 / newPrice0 : 0;
      const newShares1 = newPrice1 > 0 ? costBasis1 / newPrice1 : 0;

      // New value after recalibration
      const newValue0 = newShares0 * newPrice0;
      const newValue1 = newShares1 * newPrice1;
      const newTotalValue = newValue0 + newValue1;
      const newCostBasis = costBasis0 + costBasis1; // Cost basis preserved
      const newPnL = newTotalValue - newCostBasis;

      // Calculate changes
      const shares0Diff = newShares0 - oldShares0;
      const shares1Diff = newShares1 - oldShares1;
      const shares0Pct = oldShares0 > 0 ? ((newShares0 - oldShares0) / oldShares0) * 100 : 0;
      const shares1Pct = oldShares1 > 0 ? ((newShares1 - oldShares1) / oldShares1) * 100 : 0;

      totalCostBasisBefore += totalCostBasis;
      totalCostBasisAfter += newCostBasis;
      totalValueBefore += currentTotalValue;
      totalValueAfter += newTotalValue;

      positionSimulations.push({
        positionId: position.id,
        userId: position.userId,
        userHandle: position.user.handle,
        userName: position.user.name,
        before: {
          shares0: oldShares0,
          shares1: oldShares1,
          avgCost0: oldAvgCost0,
          avgCost1: oldAvgCost1,
          value0: currentValue0,
          value1: currentValue1,
          totalValue: currentTotalValue,
          costBasis0,
          costBasis1,
          totalCostBasis,
          unrealizedPnL: currentPnL,
        },
        after: {
          shares0: newShares0,
          shares1: newShares1,
          avgCost0: newPrice0,
          avgCost1: newPrice1,
          value0: newValue0,
          value1: newValue1,
          totalValue: newTotalValue,
          costBasis0,
          costBasis1,
          totalCostBasis: newCostBasis,
          unrealizedPnL: newPnL,
        },
        change: {
          shares0Diff,
          shares1Diff,
          shares0Pct,
          shares1Pct,
          valueDiff: newTotalValue - currentTotalValue,
          pnlDiff: newPnL - currentPnL,
        },
      });
    }

    return NextResponse.json({
      marketId: market.id,
      question: market.question,
      canRecalibrate: true,
      market: {
        before: {
          reserve0: currentReserve0,
          reserve1: currentReserve1,
          k: currentK,
          price0: currentPrice0,
          price1: currentPrice1,
        },
        after: {
          reserve0: newReserve0,
          reserve1: newReserve1,
          k: newK,
          price0: newPrice0,
          price1: newPrice1,
        },
        pools: {
          pool0,
          pool1,
          totalPool0,
          totalPool1,
        },
      },
      summary: {
        totalPositions: market.positions.length,
        positionsWithShares,
        totalCostBasisBefore,
        totalCostBasisAfter,
        totalValueBefore,
        totalValueAfter,
      },
      positions: positionSimulations,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error simulating recalibration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
