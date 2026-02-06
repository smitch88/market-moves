import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, BetStatus, RaffleReason, AdminAction } from "@vault/database";
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

    // Use extended timeout for markets with many bets/positions
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

      // Calculate pools for logging purposes
      const pool0 = Number(market.seed0) + Number(market.pool0);
      const pool1 = Number(market.seed1) + Number(market.pool1);
      const totalPool = pool0 + pool1;
      const fee = market.feeBps / 10000;
      const netPool = totalPool * (1 - fee);

      // NOTE: Payouts are NOT automatically distributed here.
      // Users must manually redeem their WINNING positions via /api/me/redeem
      // LOSING positions are auto-closed during settlement (no action needed by user).
      
      // Track affected users for PnL snapshots
      const affectedUserIds: string[] = [];
      
      // Calculate potential payouts for logging purposes only (CPMM: 1 share = $1)
      let potentialTotalPayout = 0;
      let winnersCount = 0;
      let losersCount = 0;
      const pureLosingPositionIds: string[] = [];
      
      for (const position of market.positions) {
        const winningShares = isOutcome0 ? position.shares0 : position.shares1;
        const losingShares = isOutcome0 ? position.shares1 : position.shares0;
        
        if (Number(winningShares) > 0) {
          potentialTotalPayout += Math.floor(Number(winningShares) * (1 - fee));
          winnersCount++;
        }
        
        // Track pure losing positions (no winning shares) to auto-close them
        if (Number(losingShares) > 0) {
          losersCount++;
          // Only auto-close if they have ZERO winning shares
          // Positions with any winning shares need manual redemption
          if (Number(winningShares) === 0) {
            pureLosingPositionIds.push(position.id);
          }
        }
      }
      
      // Auto-close pure losing positions (set claimedAt so they don't need manual redemption)
      if (pureLosingPositionIds.length > 0) {
        await tx.position.updateMany({
          where: { id: { in: pureLosingPositionIds } },
          data: { claimedAt: new Date() },
        });
      }
      
      // Create raffle entries for winners (still automatic as it's a reward, not payment)
      const winningPositions = market.positions.filter(position => {
        const userShares = isOutcome0 ? Number(position.shares0) : Number(position.shares1);
        return userShares > 0;
      });
      
      // Upserts must be done individually (no batch upsert in Prisma)
      for (const position of winningPositions) {
        affectedUserIds.push(position.userId);
        await tx.raffleEntry.upsert({
          where: {
            userId_marketId_reason: {
              userId: position.userId,
              marketId: market.id,
              reason: RaffleReason.CORRECT_PREDICTION,
            },
          },
          update: {
            entries: { increment: 1 },
          },
          create: {
            userId: position.userId,
            marketId: market.id,
            entries: 1,
            reason: RaffleReason.CORRECT_PREDICTION,
          },
        });
      }

      // Separate winning and losing bets
      const winningBetIds: string[] = [];
      const losingBetIds: string[] = [];
      const betPayouts: { id: string; payout: number }[] = [];
      
      for (const bet of market.bets) {
        const isWinner = bet.outcomeIndex === market.resolvedOutcome;
        
        if (isWinner) {
          winningBetIds.push(bet.id);
          // CPMM: payout based on shares (1 share = $1, minus fee)
          if (bet.shares) {
            const grossPayout = Number(bet.shares);
            const betPayout = Math.floor(grossPayout * (1 - fee));
            if (betPayout > 0) {
              betPayouts.push({ id: bet.id, payout: betPayout });
            }
          }
        } else {
          losingBetIds.push(bet.id);
          // Track losing users for PnL snapshots
          if (!affectedUserIds.includes(bet.userId)) {
            affectedUserIds.push(bet.userId);
          }
        }
      }

      // Batch update all losing bets at once (same status, payout 0)
      if (losingBetIds.length > 0) {
        await tx.bet.updateMany({
          where: { id: { in: losingBetIds } },
          data: {
            status: BetStatus.LOST,
            payout: 0,
          },
        });
      }
      
      // Batch update winning bets
      if (winningBetIds.length > 0) {
        // Winners without specific payouts (payout defaults to 0)
        const winnersWithPayouts = new Set(betPayouts.map(b => b.id));
        const winnersWithoutPayouts = winningBetIds.filter(id => !winnersWithPayouts.has(id));
        
        // Batch update winners without specific payouts
        if (winnersWithoutPayouts.length > 0) {
          await tx.bet.updateMany({
            where: { id: { in: winnersWithoutPayouts } },
            data: {
              status: BetStatus.WON,
              payout: 0,
            },
          });
        }
        
        // Update winners with payouts individually
        // Note: Promise.all in interactive transactions still executes sequentially
        // (single DB connection), but reduces JS overhead. For very large markets,
        // consider chunking or using $transaction([...]) batch mode outside.
        for (const { id, payout } of betPayouts) {
          await tx.bet.update({
            where: { id },
            data: {
              status: BetStatus.WON,
              payout,
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

      // Filter referrals where referred user bet on this market
      const eligibleReferrals = qualifiedReferrals.filter(
        referral => referral.referred.positions.length > 0
      );
      
      // Award referral bonuses (must be done individually for upserts)
      for (const referral of eligibleReferrals) {
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
            totalPool: Number(totalPool),
            netPool: Number(netPool),
            winningOutcome: winningOutcomeLabel,
            winningIndex: market.resolvedOutcome,
            winnersCount,
            losersCount,
            losingPositionsAutoClosed: pureLosingPositionIds.length,
            potentialTotalPayout,
            payoutsDistributed: false, // Winning payouts require manual redemption
          },
        },
      });

      const winningBetsCount = market.bets.filter(b => b.outcomeIndex === market.resolvedOutcome).length;
      const losingBetsCount = market.bets.length - winningBetsCount;

      return {
        market: updatedMarket,
        settlementRunId,
        winnersCount,
        losersCount,
        losingPositionsAutoClosed: pureLosingPositionIds.length,
        potentialTotalPayout,
        payoutsDistributed: false, // Winning payouts require manual redemption
        betsUpdated: {
          won: winningBetsCount,
          lost: losingBetsCount,
          total: market.bets.length,
        },
        affectedUserIds,
      };
    }, {
      timeout: 120000, // 2 minute timeout for markets with many bets
      maxWait: 10000,  // Wait up to 10s to acquire transaction
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
