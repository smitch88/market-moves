import { NextRequest, NextResponse } from "next/server";
import { prisma, BalanceReason, PricingModel } from "@vault/database";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { createPnLSnapshot } from "@/lib/services/stats-service";
import { z } from "zod";
import { Prisma } from "@vault/database";

const redeemSchema = z.object({
  positionIds: z.array(z.string()).optional(), // Optional - if empty, redeem all eligible
});

interface RedemptionResult {
  positionId: string;
  marketId: string;
  marketQuestion: string;
  outcomeIndex: number;
  outcomeName: string;
  shares: number;
  payout: number;
  costBasis: number;
  profit: number;
  isWinner: boolean;
}

/**
 * POST /api/me/redeem
 * 
 * Redeem settled positions. Users must call this to claim their payouts
 * after a market has been settled.
 * 
 * Request body (optional):
 * - positionIds: string[] - Specific positions to redeem. If empty, redeems all eligible.
 * 
 * Response:
 * - success: boolean
 * - totalRedeemed: number (total dollars claimed)
 * - positionsRedeemed: number
 * - positions: Array of redeemed position details
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { positionIds } = redeemSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // Find all eligible positions (settled market, not yet claimed)
      const whereClause: Prisma.PositionWhereInput = {
        userId: user.id,
        claimedAt: null,
        market: {
          settledAt: { not: null },
        },
      };

      // If specific positionIds provided, filter to those
      if (positionIds && positionIds.length > 0) {
        whereClause.id = { in: positionIds };
      }

      const positions = await tx.position.findMany({
        where: whereClause,
        include: {
          market: {
            select: {
              id: true,
              question: true,
              outcomes: true,
              resolvedOutcome: true,
              feeBps: true,
              pricingModel: true,
              pool0: true,
              pool1: true,
              seed0: true,
              seed1: true,
            },
          },
        },
      });

      if (positions.length === 0) {
        return {
          success: true,
          totalRedeemed: 0,
          positionsRedeemed: 0,
          positions: [],
          message: "No positions to redeem",
        };
      }

      const redemptions: RedemptionResult[] = [];
      let totalPayout = new Prisma.Decimal(0);
      let totalProfit = new Prisma.Decimal(0);

      // Get current user balance
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { balance: true, realizedPnL: true },
      });

      if (!currentUser) {
        throw new Error("User not found");
      }

      let runningBalance = currentUser.balance;

      for (const position of positions) {
        const { market } = position;
        const outcomes = JSON.parse(market.outcomes) as string[];
        const resolvedOutcome = market.resolvedOutcome;
        const fee = market.feeBps / 10000;
        const isCPMM = market.pricingModel === PricingModel.CPMM;

        // Process both outcomes for this position
        for (const outcomeIndex of [0, 1] as const) {
          const shares = outcomeIndex === 0 
            ? new Prisma.Decimal(position.shares0) 
            : new Prisma.Decimal(position.shares1);
          const avgCost = outcomeIndex === 0 
            ? new Prisma.Decimal(position.avgCost0) 
            : new Prisma.Decimal(position.avgCost1);
          const amount = outcomeIndex === 0 
            ? new Prisma.Decimal(position.amount0) 
            : new Prisma.Decimal(position.amount1);

          // Skip if no position on this outcome
          if (shares.isZero() && amount.isZero()) continue;

          const isWinner = resolvedOutcome === outcomeIndex;
          let payout = new Prisma.Decimal(0);
          let costBasis = new Prisma.Decimal(0);

          if (isCPMM) {
            // CPMM: Each winning share = $1 (minus fee)
            if (isWinner && !shares.isZero()) {
              payout = shares.mul(1 - fee).floor();
            }
            costBasis = shares.mul(avgCost);
          } else {
            // PARI_MUTUEL: Pro-rata from pool
            const pool0 = new Prisma.Decimal(market.pool0).plus(market.seed0);
            const pool1 = new Prisma.Decimal(market.pool1).plus(market.seed1);
            const totalPool = pool0.plus(pool1);
            const winningPool = resolvedOutcome === 0 ? pool0 : pool1;
            const netPool = totalPool.mul(1 - fee);

            if (isWinner && !amount.isZero() && !winningPool.isZero()) {
              payout = amount.div(winningPool).mul(netPool).floor();
            }
            costBasis = amount;
          }

          const profit = payout.minus(costBasis);

          redemptions.push({
            positionId: position.id,
            marketId: market.id,
            marketQuestion: market.question,
            outcomeIndex,
            outcomeName: outcomes[outcomeIndex],
            shares: shares.toNumber(),
            payout: payout.toNumber(),
            costBasis: costBasis.toNumber(),
            profit: profit.toNumber(),
            isWinner,
          });

          // Add to totals
          totalPayout = totalPayout.plus(payout);
          totalProfit = totalProfit.plus(profit);

          // Create balance ledger entry for winners
          if (isWinner && !payout.isZero()) {
            const newBalance = runningBalance.plus(payout);
            
            await tx.balanceLedger.create({
              data: {
                userId: user.id,
                delta: payout,
                balanceBefore: runningBalance,
                balanceAfter: newBalance,
                reason: BalanceReason.SETTLEMENT_PAYOUT,
                correlationId: position.id,
              },
            });
            
            runningBalance = newBalance;
          }

          // Create balance ledger entry for losers (tracking entry with delta=0)
          if (!isWinner && (!shares.isZero() || !amount.isZero())) {
            await tx.balanceLedger.create({
              data: {
                userId: user.id,
                delta: new Prisma.Decimal(0),
                balanceBefore: runningBalance,
                balanceAfter: runningBalance,
                reason: BalanceReason.SETTLEMENT_LOSS,
                correlationId: position.id,
              },
            });
          }
        }

        // Mark position as claimed
        await tx.position.update({
          where: { id: position.id },
          data: { claimedAt: new Date() },
        });
      }

      // Update user balance and realized PnL
      if (!totalPayout.isZero() || !totalProfit.isZero()) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            balance: runningBalance,
            realizedPnL: { increment: totalProfit },
          },
        });
      }

      return {
        success: true,
        totalRedeemed: totalPayout.toNumber(),
        totalProfit: totalProfit.toNumber(),
        positionsRedeemed: positions.length,
        positions: redemptions,
      };
    });

    // Create PnL snapshot (fire-and-forget)
    if (result.positionsRedeemed > 0) {
      createPnLSnapshot(user.id).catch(console.error);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error redeeming positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/me/redeem
 * 
 * Get summary of redeemable positions (positions that can be claimed).
 */
export async function GET() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all eligible positions (settled market, not yet claimed)
    const positions = await prisma.position.findMany({
      where: {
        userId: user.id,
        claimedAt: null,
        market: {
          settledAt: { not: null },
        },
      },
      include: {
        market: {
          select: {
            id: true,
            question: true,
            outcomes: true,
            resolvedOutcome: true,
            feeBps: true,
            pricingModel: true,
            pool0: true,
            pool1: true,
            seed0: true,
            seed1: true,
          },
        },
      },
    });

    let totalRedeemable = 0;
    let winnersCount = 0;
    let losersCount = 0;

    const redeemablePositions = positions.map((position) => {
      const { market } = position;
      const outcomes = JSON.parse(market.outcomes) as string[];
      const resolvedOutcome = market.resolvedOutcome;
      const fee = market.feeBps / 10000;
      const isCPMM = market.pricingModel === PricingModel.CPMM;

      let payout = 0;
      let isWinner = false;

      // Check outcome 0
      const shares0 = Number(position.shares0);
      const amount0 = Number(position.amount0);
      if (resolvedOutcome === 0 && (shares0 > 0 || amount0 > 0)) {
        isWinner = true;
        if (isCPMM) {
          payout += Math.floor(shares0 * (1 - fee));
        } else {
          const pool0 = Number(market.pool0) + Number(market.seed0);
          const pool1 = Number(market.pool1) + Number(market.seed1);
          const totalPool = pool0 + pool1;
          const netPool = totalPool * (1 - fee);
          payout += Math.floor((amount0 / pool0) * netPool);
        }
      }

      // Check outcome 1
      const shares1 = Number(position.shares1);
      const amount1 = Number(position.amount1);
      if (resolvedOutcome === 1 && (shares1 > 0 || amount1 > 0)) {
        isWinner = true;
        if (isCPMM) {
          payout += Math.floor(shares1 * (1 - fee));
        } else {
          const pool0 = Number(market.pool0) + Number(market.seed0);
          const pool1 = Number(market.pool1) + Number(market.seed1);
          const totalPool = pool0 + pool1;
          const netPool = totalPool * (1 - fee);
          payout += Math.floor((amount1 / pool1) * netPool);
        }
      }

      if (isWinner) {
        totalRedeemable += payout;
        winnersCount++;
      } else {
        losersCount++;
      }

      return {
        positionId: position.id,
        marketId: market.id,
        marketQuestion: market.question,
        winningOutcome: outcomes[resolvedOutcome ?? 0],
        payout,
        isWinner,
      };
    });

    return NextResponse.json({
      totalRedeemable,
      positionsCount: positions.length,
      winnersCount,
      losersCount,
      positions: redeemablePositions,
    });
  } catch (error) {
    console.error("Error fetching redeemable positions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
