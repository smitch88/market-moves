import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, BetStatus, BalanceReason, RaffleReason, AdminAction, PricingModel } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { randomUUID } from "crypto";
import { createPnLSnapshot } from "@/lib/services/stats-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      // Lock and fetch market with positions and bets
      const market = await tx.market.findUnique({
        where: { id },
        include: {
          positions: {
            include: { user: true },
          },
          bets: {
            where: { status: BetStatus.CONFIRMED },
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

      // Determine pricing model for settlement calculation
      const isCPMM = market.pricingModel === PricingModel.CPMM;

      // Calculate pools from seed + confirmed positions (for pari-mutuel)
      const pool0 = market.seed0 + market.pool0;
      const pool1 = market.seed1 + market.pool1;
      const totalPool = pool0 + pool1;
      const winningPool = isOutcome0 ? pool0 : pool1;
      const fee = market.feeBps / 10000;
      const netPool = totalPool * (1 - fee);

      // Calculate and distribute payouts based on pricing model
      // Also track cost basis for PnL calculation
      const payouts: { userId: string; amount: number; costBasis: number }[] = [];

      for (const position of market.positions) {
        let payout = 0;
        let costBasis = 0;

        if (isCPMM) {
          // CPMM: 1 winning share = 100 cents (after fees)
          const userShares = isOutcome0 ? position.shares0 : position.shares1;
          const avgCost = isOutcome0 ? position.avgCost0 : position.avgCost1;
          
          if (userShares > 0) {
            // Each winning share is worth $1
            const grossPayout = userShares; // Already in dollars (Decimal)
            payout = Math.floor(grossPayout * (1 - fee));
            // Cost basis = shares * avgCost (both already in dollars)
            costBasis = Math.floor(userShares * avgCost);
          }
        } else {
          // PARI_MUTUEL: Pro-rata payout from pool
          const userStake = isOutcome0 ? position.amount0 : position.amount1;

          if (userStake > 0 && winningPool > 0) {
            payout = Math.floor((userStake / winningPool) * netPool);
            costBasis = userStake;
          }
        }

        if (payout > 0) {
          payouts.push({ userId: position.userId, amount: payout, costBasis });
        }
      }

      // Track users who received payouts for PnL snapshots
      const affectedUserIds: string[] = [];

      // Apply payouts
      for (const { userId, amount, costBasis } of payouts) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true, realizedPnL: true },
        });

        if (user) {
          const newBalance = user.balance + amount;
          // Realized PnL = payout - cost basis
          const pnlDelta = amount - costBasis;

          await tx.user.update({
            where: { id: userId },
            data: { 
              balance: newBalance,
              realizedPnL: { increment: pnlDelta },
            },
          });
          
          affectedUserIds.push(userId);

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

      // Update bet statuses and payouts
      // Calculate per-bet payouts based on pricing model
      const betPayouts = new Map<string, number>();
      
      for (const bet of market.bets) {
        const isWinner = bet.outcomeIndex === market.resolvedOutcome;
        
        if (isWinner) {
          let betPayout = 0;

          if (isCPMM && bet.shares) {
            // CPMM: payout based on shares (1 share = $1, minus fee)
            const grossPayout = bet.shares; // Already in dollars (Decimal)
            betPayout = Math.floor(grossPayout * (1 - fee));
          } else if (!isCPMM && winningPool > 0) {
            // PARI_MUTUEL: pro-rata from pool
            betPayout = Math.floor((bet.amount / winningPool) * netPool);
          }

          if (betPayout > 0) {
            betPayouts.set(bet.id, betPayout);
          }
        }
      }

      // Update all bets with their final status and payout
      for (const bet of market.bets) {
        const isWinner = bet.outcomeIndex === market.resolvedOutcome;
        const payout = betPayouts.get(bet.id) || 0;

        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: isWinner ? BetStatus.WON : BetStatus.LOST,
            payout: payout,
          },
        });

        // Create SETTLEMENT_LOSS ledger entry for losing bets and update realized PnL
        if (!isWinner) {
          await tx.balanceLedger.create({
            data: {
              userId: bet.userId,
              delta: 0,
              balanceBefore: bet.user.balance,
              balanceAfter: bet.user.balance,
              reason: BalanceReason.SETTLEMENT_LOSS,
              correlationId: bet.id,
            },
          });
          
          // Update realized PnL for losing bets (loss = -bet amount)
          // Only for BUY trades (sells already realized their PnL)
          if (bet.tradeType === "BUY") {
            await tx.user.update({
              where: { id: bet.userId },
              data: {
                realizedPnL: { decrement: bet.amount },
              },
            });
            
            if (!affectedUserIds.includes(bet.userId)) {
              affectedUserIds.push(bet.userId);
            }
          }
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
            pricingModel: market.pricingModel,
            totalPool,
            netPool,
            winningOutcome: winningOutcomeLabel,
            winningIndex: market.resolvedOutcome,
            payoutsCount: payouts.length,
            totalPaidOut: payouts.reduce((sum, p) => sum + p.amount, 0),
          },
        },
      });

      const winningBetsCount = market.bets.filter(b => b.outcomeIndex === market.resolvedOutcome).length;
      const losingBetsCount = market.bets.length - winningBetsCount;

      return {
        market: updatedMarket,
        settlementRunId,
        payoutsCount: payouts.length,
        totalPaidOut: payouts.reduce((sum, p) => sum + p.amount, 0),
        betsUpdated: {
          won: winningBetsCount,
          lost: losingBetsCount,
          total: market.bets.length,
        },
        affectedUserIds,
      };
    });

    // Create PnL snapshots for affected users (fire-and-forget)
    for (const userId of result.affectedUserIds) {
      createPnLSnapshot(userId).catch(console.error);
    }

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
