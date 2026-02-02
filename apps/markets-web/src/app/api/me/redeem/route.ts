import { NextRequest, NextResponse } from "next/server";
import { prisma, BalanceReason, PnLReason } from "@vault/database";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { createPnLSnapshot } from "@/lib/services/stats-service";
import { updateUserStreak } from "@/lib/services/streak-service";
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

      // Get current user balance
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { balance: true, realizedPnL: true },
      });

      if (!currentUser) {
        throw new Error("User not found");
      }

      // First pass: Mark positions as claimed atomically to prevent race conditions
      const claimTimestamp = new Date();
      const claimedPositionIds: string[] = [];
      
      for (const position of positions) {
        const updateResult = await tx.position.updateMany({
          where: { 
            id: position.id,
            claimedAt: null, // Only update if not already claimed
          },
          data: { claimedAt: claimTimestamp },
        });
        
        if (updateResult.count > 0) {
          claimedPositionIds.push(position.id);
        } else {
          console.warn(`Position ${position.id} already claimed by concurrent request, skipping`);
        }
      }

      // Filter to only process positions we successfully claimed
      const claimedPositions = positions.filter(p => claimedPositionIds.includes(p.id));

      if (claimedPositions.length === 0) {
        return {
          success: true,
          totalRedeemed: 0,
          positionsRedeemed: 0,
          positions: [],
          message: "No positions to redeem (already claimed or unavailable)",
        };
      }

      // Second pass: Calculate payouts and create ledger entries
      const redemptions: RedemptionResult[] = [];
      const balanceLedgerEntries: Array<{
        userId: string;
        delta: Prisma.Decimal;
        balanceBefore: Prisma.Decimal;
        balanceAfter: Prisma.Decimal;
        reason: BalanceReason;
        correlationId: string;
      }> = [];
      
      let totalPayout = new Prisma.Decimal(0);
      let totalProfit = new Prisma.Decimal(0);
      let runningBalance = currentUser.balance;

      for (const position of claimedPositions) {
        const { market } = position;
        const outcomes = JSON.parse(market.outcomes) as string[];
        const resolvedOutcome = market.resolvedOutcome;
        const fee = market.feeBps / 10000;

        // Process both outcomes for this position
        for (const outcomeIndex of [0, 1] as const) {
          const shares = outcomeIndex === 0 
            ? new Prisma.Decimal(position.shares0) 
            : new Prisma.Decimal(position.shares1);
          const avgCost = outcomeIndex === 0 
            ? new Prisma.Decimal(position.avgCost0) 
            : new Prisma.Decimal(position.avgCost1);

          // Skip if no shares on this outcome
          if (shares.isZero()) continue;

          const isWinner = resolvedOutcome === outcomeIndex;
          let payout = new Prisma.Decimal(0);

          // CPMM: Each winning share = $1 (minus fee)
          if (isWinner && !shares.isZero()) {
            payout = shares.mul(1 - fee).floor();
          }
          const costBasis = shares.mul(avgCost);
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

          // Prepare balance ledger entry for winners
          if (isWinner && !payout.isZero()) {
            const newBalance = runningBalance.plus(payout);
            
            balanceLedgerEntries.push({
              userId: user.id,
              delta: payout,
              balanceBefore: runningBalance,
              balanceAfter: newBalance,
              reason: BalanceReason.SETTLEMENT_PAYOUT,
              correlationId: position.id,
            });
            
            runningBalance = newBalance;
          }

          // Prepare balance ledger entry for losers (tracking entry with delta=0)
          if (!isWinner && !shares.isZero()) {
            balanceLedgerEntries.push({
              userId: user.id,
              delta: new Prisma.Decimal(0),
              balanceBefore: runningBalance,
              balanceAfter: runningBalance,
              reason: BalanceReason.SETTLEMENT_LOSS,
              correlationId: position.id,
            });
          }
        }
      }

      // Batch create all balance ledger entries
      if (balanceLedgerEntries.length > 0) {
        await tx.balanceLedger.createMany({
          data: balanceLedgerEntries,
        });
      }

      // Update user balance and realized PnL (even for losses)
      const newRealizedPnL = currentUser.realizedPnL.plus(totalProfit);
      
      await tx.user.update({
        where: { id: user.id },
        data: {
          balance: runningBalance,
          realizedPnL: newRealizedPnL,
        },
      });

      // Create PnL ledger entry for audit trail (even for $0 payout)
      await tx.pnLLedger.create({
        data: {
          userId: user.id,
          delta: totalProfit,
          pnlBefore: currentUser.realizedPnL,
          pnlAfter: newRealizedPnL,
          reason: PnLReason.REDEMPTION,
          correlationId: `redeem-${Date.now()}`,
          metadata: {
            positionsRedeemed: claimedPositions.length,
            totalPayout: totalPayout.toNumber(),
            markets: claimedPositions.map((p) => p.marketId),
          },
        },
      });

      return {
        success: true,
        totalRedeemed: totalPayout.toNumber(),
        totalProfit: totalProfit.toNumber(),
        positionsRedeemed: claimedPositions.length,
        positions: redemptions,
      };
    });

    // Create PnL snapshot (fire-and-forget)
    if (result.positionsRedeemed > 0) {
      createPnLSnapshot(user.id).catch(console.error);
    }

    // Update user's streak (redeeming positions counts as daily activity)
    let streakInfo = null;
    if (result.positionsRedeemed > 0) {
      const streakResult = await updateUserStreak(user.id);
      streakInfo = {
        current: streakResult.newStreak,
        multiplier: streakResult.multiplier,
        isNewDay: streakResult.isNewDay,
        badgesAwarded: streakResult.badgesAwarded,
      };
    }

    return NextResponse.json({
      ...result,
      streak: streakInfo,
    });
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
          },
        },
      },
    });

    let totalRedeemable = new Prisma.Decimal(0);
    let winnersCount = 0;
    let losersCount = 0;

    const redeemablePositions = positions.map((position) => {
      const { market } = position;
      const outcomes = JSON.parse(market.outcomes) as string[];
      const resolvedOutcome = market.resolvedOutcome;
      const fee = market.feeBps / 10000;

      let payout = new Prisma.Decimal(0);
      let isWinner = false;

      // Check outcome 0 (CPMM: 1 share = $1)
      const shares0 = new Prisma.Decimal(position.shares0);
      if (resolvedOutcome === 0 && !shares0.isZero()) {
        isWinner = true;
        payout = payout.plus(shares0.mul(1 - fee).floor());
      }

      // Check outcome 1 (CPMM: 1 share = $1)
      const shares1 = new Prisma.Decimal(position.shares1);
      if (resolvedOutcome === 1 && !shares1.isZero()) {
        isWinner = true;
        payout = payout.plus(shares1.mul(1 - fee).floor());
      }

      if (isWinner) {
        totalRedeemable = totalRedeemable.plus(payout);
        winnersCount++;
      } else {
        losersCount++;
      }

      return {
        positionId: position.id,
        marketId: market.id,
        marketQuestion: market.question,
        winningOutcome: outcomes[resolvedOutcome ?? 0],
        payout: payout.toNumber(),
        isWinner,
      };
    });

    return NextResponse.json({
      totalRedeemable: totalRedeemable.toNumber(),
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
