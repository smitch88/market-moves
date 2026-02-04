import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction, Prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface PositionAdjustment {
  positionId: string;
  userId: string;
  oldShares0: number;
  oldShares1: number;
  oldAvgCost0: number;
  oldAvgCost1: number;
  newShares0: number;
  newShares1: number;
  newAvgCost0: number;
  newAvgCost1: number;
  costBasis0: number;
  costBasis1: number;
}

/**
 * POST /api/admin/markets/[id]/recalibrate
 * 
 * Recalibrates a market's AMM reserves to fix broken pricing.
 * Uses POOL-WEIGHTED pricing to preserve market sentiment from actual betting.
 * 
 * How it works:
 * 1. Calculate target prices based on total pools (seed + bets on each side)
 * 2. Set reserves to achieve those prices while maintaining liquidity depth
 * 3. Fairly adjust all positions to preserve cost basis at new prices
 * 
 * This ensures users who bet on the popular side keep their position value,
 * while fixing the underlying reserve/liquidity bug.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const market = await prisma.market.findUnique({
      where: { id },
      select: {
        id: true,
        question: true,
        status: true,
        seed0: true,
        seed1: true,
        reserve0: true,
        reserve1: true,
        k: true,
        pool0: true,
        pool1: true,
        outcomePrices: true,
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Only allow recalibration for OPEN or DRAFT markets
    if (!["OPEN", "DRAFT"].includes(market.status)) {
      return NextResponse.json(
        { error: "Can only recalibrate OPEN or DRAFT markets" },
        { status: 400 }
      );
    }

    // Store old values for logging
    const oldValues = {
      reserve0: Number(market.reserve0),
      reserve1: Number(market.reserve1),
      k: Number(market.k),
      outcomePrices: market.outcomePrices,
    };

    const seed0 = Number(market.seed0);
    const seed1 = Number(market.seed1);
    const pool0 = Number(market.pool0);
    const pool1 = Number(market.pool1);

    // Calculate POOL-WEIGHTED target prices based on actual betting
    // Total money on each side = seed + pool
    const totalPool0 = seed0 + pool0;
    const totalPool1 = seed1 + pool1;
    const totalLiquidity = totalPool0 + totalPool1;

    // Calculate target prices reflecting market sentiment
    let targetPrice0: number;
    let targetPrice1: number;

    if (totalLiquidity > 0) {
      // Price reflects betting weight on each side
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
    // ratio = reserve0 / reserve1 = price1 / price0
    const ratio = targetPrice1 / targetPrice0;
    
    // k = ratio * reserve1^2 => reserve1 = sqrt(k / ratio)
    const newReserve1 = Math.sqrt(targetK / ratio);
    const newReserve0 = ratio * newReserve1;
    const newK = newReserve0 * newReserve1;
    
    // Calculate final prices from reserves
    const newPrice0 = newReserve1 / (newReserve0 + newReserve1);
    const newPrice1 = newReserve0 / (newReserve0 + newReserve1);

    // Fetch all positions for this market
    const positions = await prisma.position.findMany({
      where: { marketId: id },
      select: {
        id: true,
        userId: true,
        shares0: true,
        shares1: true,
        avgCost0: true,
        avgCost1: true,
      },
    });

    // Calculate position adjustments
    const positionAdjustments: PositionAdjustment[] = [];

    for (const position of positions) {
      const oldShares0 = Number(position.shares0);
      const oldShares1 = Number(position.shares1);
      const oldAvgCost0 = Number(position.avgCost0);
      const oldAvgCost1 = Number(position.avgCost1);

      // Calculate cost basis (what user actually spent)
      const costBasis0 = oldShares0 * oldAvgCost0;
      const costBasis1 = oldShares1 * oldAvgCost1;

      // Calculate new shares at new prices (preserving cost basis)
      // newShares = costBasis / newPrice
      const newShares0 = newPrice0 > 0 ? costBasis0 / newPrice0 : 0;
      const newShares1 = newPrice1 > 0 ? costBasis1 / newPrice1 : 0;

      // Only include positions that have shares
      if (oldShares0 > 0 || oldShares1 > 0) {
        positionAdjustments.push({
          positionId: position.id,
          userId: position.userId,
          oldShares0,
          oldShares1,
          oldAvgCost0,
          oldAvgCost1,
          newShares0,
          newShares1,
          newAvgCost0: newPrice0,
          newAvgCost1: newPrice1,
          costBasis0,
          costBasis1,
        });
      }
    }

    // Update the market and positions in a transaction
    // Use extended timeout for markets with many positions
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update market reserves and prices
      const updated = await tx.market.update({
        where: { id },
        data: {
          reserve0: newReserve0,
          reserve1: newReserve1,
          k: newK,
          outcomePrices: JSON.stringify([
            newPrice0.toFixed(4),
            newPrice1.toFixed(4),
          ]),
        },
      });

      // 2. Adjust all positions using single bulk SQL UPDATE (much faster than individual updates)
      if (positionAdjustments.length > 0) {
        // Build a single UPDATE with CASE/WHEN for each position
        const positionIds = positionAdjustments.map(adj => adj.positionId);
        
        // Build CASE statements for each column
        const shares0Cases = positionAdjustments
          .map(adj => `WHEN id = '${adj.positionId}' THEN ${adj.newShares0.toFixed(6)}`)
          .join(' ');
        const shares1Cases = positionAdjustments
          .map(adj => `WHEN id = '${adj.positionId}' THEN ${adj.newShares1.toFixed(6)}`)
          .join(' ');
        const avgCost0Cases = positionAdjustments
          .map(adj => `WHEN id = '${adj.positionId}' THEN ${adj.newAvgCost0.toFixed(6)}`)
          .join(' ');
        const avgCost1Cases = positionAdjustments
          .map(adj => `WHEN id = '${adj.positionId}' THEN ${adj.newAvgCost1.toFixed(6)}`)
          .join(' ');
        
        const idList = positionIds.map(id => `'${id}'`).join(',');
        
        await tx.$executeRawUnsafe(`
          UPDATE "Position"
          SET 
            shares0 = CASE ${shares0Cases} END,
            shares1 = CASE ${shares1Cases} END,
            "avgCost0" = CASE ${avgCost0Cases} END,
            "avgCost1" = CASE ${avgCost1Cases} END,
            "updatedAt" = NOW()
          WHERE id IN (${idList})
        `);
      }

      // 3. Log the recalibration action with position adjustments
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_UPDATE,
          targetType: "Market",
          targetId: id,
          metadata: {
            action: "recalibrate",
            question: market.question,
            oldValues,
            newValues: {
              reserve0: newReserve0,
              reserve1: newReserve1,
              k: newK,
              outcomePrices: [
                newPrice0.toFixed(4),
                newPrice1.toFixed(4),
              ],
              poolWeighted: {
                totalPool0,
                totalPool1,
                targetPrice0,
                targetPrice1,
              },
            },
            positionsAdjusted: positionAdjustments.length,
            // Store summary of position changes for audit
            positionAdjustments: positionAdjustments.map(adj => ({
              positionId: adj.positionId,
              userId: adj.userId,
              shares0Change: `${adj.oldShares0.toFixed(2)} → ${adj.newShares0.toFixed(2)}`,
              shares1Change: `${adj.oldShares1.toFixed(2)} → ${adj.newShares1.toFixed(2)}`,
              costBasis0: adj.costBasis0.toFixed(2),
              costBasis1: adj.costBasis1.toFixed(2),
            })),
          },
        },
      });

      // 4. Create a price snapshot for the recalibration
      await tx.priceSnapshot.create({
        data: {
          marketId: id,
          price0: newPrice0,
          price1: newPrice1,
          pool0: Math.floor(Number(market.seed0) + Number(market.pool0)),
          pool1: Math.floor(Number(market.seed1) + Number(market.pool1)),
        },
      });

      return updated;
    }, {
      maxWait: 15000, // 15 seconds max wait to acquire connection
      timeout: 15000, // 15 seconds timeout (single SQL UPDATE is very fast)
    });

    return NextResponse.json({
      success: true,
      message: `Market recalibrated successfully. ${positionAdjustments.length} position(s) adjusted.`,
      market: {
        id: result.id,
        reserve0: Number(result.reserve0),
        reserve1: Number(result.reserve1),
        k: Number(result.k),
        outcomePrices: result.outcomePrices,
      },
      oldValues,
      positionsAdjusted: positionAdjustments.length,
      adjustments: positionAdjustments.map(adj => ({
        positionId: adj.positionId,
        costBasis: { outcome0: adj.costBasis0, outcome1: adj.costBasis1 },
        sharesBefore: { outcome0: adj.oldShares0, outcome1: adj.oldShares1 },
        sharesAfter: { outcome0: adj.newShares0, outcome1: adj.newShares1 },
      })),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error recalibrating market:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
