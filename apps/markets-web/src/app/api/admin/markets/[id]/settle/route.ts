import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, BalanceReason, RaffleReason, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { randomUUID } from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      // Lock and fetch market
      const market = await tx.market.findUnique({
        where: { id },
        include: {
          positions: {
            include: { user: true },
          },
        },
      });

      if (!market) {
        throw new Error("Market not found");
      }

      if (market.status !== MarketStatus.RESOLVED) {
        throw new Error("Market must be resolved before settlement");
      }

      if (market.settledAt || market.settlementRunId) {
        throw new Error("Market already settled");
      }

      if (market.resolvedOutcome === null) {
        throw new Error("No resolved outcome set");
      }

      // Generate unique settlement run ID for idempotency
      const settlementRunId = randomUUID();

      // Get winning outcome info
      const outcomes = JSON.parse(market.outcomes) as string[];
      const winningOutcomeLabel = outcomes[market.resolvedOutcome];
      const isOutcome0 = market.resolvedOutcome === 0;

      // Calculate pools from seed + confirmed positions
      let pool0 = market.seed0 + market.pool0;
      let pool1 = market.seed1 + market.pool1;

      const totalPool = pool0 + pool1;
      const winningPool = isOutcome0 ? pool0 : pool1;
      const fee = market.feeBps / 10000;
      const netPool = totalPool * (1 - fee);

      // Calculate and distribute payouts
      const payouts: { userId: string; amount: number }[] = [];

      for (const position of market.positions) {
        const userStake = isOutcome0
          ? position.amount0
          : position.amount1;

        if (userStake > 0 && winningPool > 0) {
          // Pro-rata payout
          const payout = Math.floor((userStake / winningPool) * netPool);
          payouts.push({ userId: position.userId, amount: payout });
        }
      }

      // Apply payouts
      for (const { userId, amount } of payouts) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });

        if (user) {
          const newBalance = user.balance + amount;

          await tx.user.update({
            where: { id: userId },
            data: { balance: newBalance },
          });

          await tx.balanceLedger.create({
            data: {
              userId,
              delta: amount,
              balanceBefore: user.balance,
              balanceAfter: newBalance,
              reason: BalanceReason.SETTLEMENT_PAYOUT,
              correlationId: settlementRunId,
            },
          });

          // Create raffle entry for correct prediction
          await tx.raffleEntry.upsert({
            where: {
              userId_marketId_reason: {
                userId,
                marketId: market.id,
                reason: RaffleReason.CORRECT_PREDICTION,
              },
            },
            update: {
              entries: { increment: 1 },
            },
            create: {
              userId,
              marketId: market.id,
              entries: 1,
              reason: RaffleReason.CORRECT_PREDICTION,
            },
          });
        }
      }

      // Award referral bonuses for qualified referrals
      const qualifiedReferrals = await tx.referral.findMany({
        where: {
          qualifiedAt: { not: null },
          bonusEntriesAwarded: 0,
        },
        include: {
          referred: {
            select: {
              positions: {
                where: { marketId: market.id },
              },
            },
          },
        },
      });

      for (const referral of qualifiedReferrals) {
        // Check if referred user bet on this market
        if (referral.referred.positions.length > 0) {
          await tx.raffleEntry.upsert({
            where: {
              userId_marketId_reason: {
                userId: referral.referrerUserId,
                marketId: market.id,
                reason: RaffleReason.REFERRAL_BONUS,
              },
            },
            update: {
              entries: { increment: 1 },
            },
            create: {
              userId: referral.referrerUserId,
              marketId: market.id,
              entries: 1,
              reason: RaffleReason.REFERRAL_BONUS,
            },
          });

          await tx.referral.update({
            where: { id: referral.id },
            data: { bonusEntriesAwarded: 1 },
          });
        }
      }

      // Update market as settled
      const updatedMarket = await tx.market.update({
        where: { id },
        data: {
          status: MarketStatus.SETTLED,
          settledAt: new Date(),
          settlementRunId,
        },
      });

      // Log admin action
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_SETTLE,
          targetType: "Market",
          targetId: id,
          metadata: {
            settlementRunId,
            totalPool,
            netPool,
            winningOutcome: winningOutcomeLabel,
            winningIndex: market.resolvedOutcome,
            payoutsCount: payouts.length,
            totalPaidOut: payouts.reduce((sum, p) => sum + p.amount, 0),
          },
        },
      });

      return {
        market: updatedMarket,
        settlementRunId,
        payoutsCount: payouts.length,
        totalPaidOut: payouts.reduce((sum, p) => sum + p.amount, 0),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Market not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("resolved") ||
        error.message.includes("settled") ||
        error.message.includes("outcome"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error settling market:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
