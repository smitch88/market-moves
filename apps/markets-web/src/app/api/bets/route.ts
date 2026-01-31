import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus, BalanceReason, Prisma } from "@vault/database";
import { requireUser } from "@vault/auth";
import { createPriceSnapshot } from "@/lib/services/price-snapshot-service";
import { broadcastPriceChange } from "@/lib/services/price-broadcaster";
import { awardXPForVolume } from "@/lib/services/xp-service";
import { z } from "zod";

const placeBetSchema = z.object({
  marketId: z.string(),
  outcomeIndex: z.number().int().min(0).max(1),
  amount: z.number().positive().int(),
});

// Minimum bet amount in dollars
const MIN_BET_AMOUNT = 1;
// Maximum bet amount in dollars (prevents accidental large bets)
const MAX_BET_AMOUNT = 100000;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { marketId, outcomeIndex, amount } = placeBetSchema.parse(body);

    // Validate bet amount bounds
    if (amount < MIN_BET_AMOUNT) {
      return NextResponse.json({ error: `Minimum bet amount is $${MIN_BET_AMOUNT}` }, { status: 400 });
    }
    if (amount > MAX_BET_AMOUNT) {
      return NextResponse.json({ error: `Maximum bet amount is $${MAX_BET_AMOUNT.toLocaleString()}` }, { status: 400 });
    }

    // Validate market exists, is published, and is open
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: {
        event: {
          select: { isPublished: true },
        },
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Check if market and event are published
    if (!market.isPublished || !market.event.isPublished) {
      return NextResponse.json({ error: "Market is not available for betting" }, { status: 400 });
    }

    if (market.status !== "OPEN" && market.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Market is not open for betting" }, { status: 400 });
    }

    if (market.closesAt && new Date(market.closesAt) < new Date()) {
      return NextResponse.json({ error: "Market has closed" }, { status: 400 });
    }

    // Validate outcome index
    const outcomes = JSON.parse(market.outcomes) as string[];
    if (outcomeIndex < 0 || outcomeIndex >= outcomes.length) {
      return NextResponse.json({ error: "Invalid outcome index" }, { status: 400 });
    }

    // Create bet, update balance, position, and pool in ATOMIC transaction
    // All balance checks happen INSIDE the transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // ATOMIC: Get and lock user row, then validate balance
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { balance: true, balanceLocked: true },
      });

      if (!currentUser) {
        throw new Error("User not found");
      }

      if (currentUser.balanceLocked) {
        throw new Error("Account is locked");
      }

      const userBalance = Number(currentUser.balance);
      if (userBalance < amount) {
        throw new Error("Insufficient balance");
      }

      // Double-check: ensure new balance won't go negative
      const newBalance = userBalance - amount;
      if (newBalance < 0) {
        throw new Error("Insufficient balance - transaction would result in negative balance");
      }

      const isOutcome0 = outcomeIndex === 0;

      // ATOMIC: Debit user balance FIRST with conditional update to prevent negative balance
      // This is the critical atomic operation that prevents overdraw
      const updateResult = await tx.user.updateMany({
        where: { 
          id: user.id,
          balance: { gte: amount }, // Only update if balance >= amount
        },
        data: { balance: { decrement: amount } },
      });

      // If no rows updated, the balance check failed (race condition caught!)
      if (updateResult.count === 0) {
        throw new Error("Insufficient balance - concurrent transaction detected");
      }

      // Calculate current price BEFORE the bet (this is the price user is buying at)
      const seed0Num = Number(market.seed0);
      const seed1Num = Number(market.seed1);
      const pool0Num = Number(market.pool0);
      const pool1Num = Number(market.pool1);
      const totalPoolBefore = seed0Num + seed1Num + pool0Num + pool1Num;
      const priceAtPurchase = totalPoolBefore > 0
        ? (isOutcome0 ? (seed0Num + pool0Num) : (seed1Num + pool1Num)) / totalPoolBefore
        : 0.5;

      // Calculate shares: amount / price (how many shares you get for your money)
      const sharesReceived = priceAtPurchase > 0 ? amount / priceAtPurchase : amount;

      // Create the bet (confirmed immediately - no tweet required)
      const bet = await tx.bet.create({
        data: {
          userId: user.id,
          marketId: market.id,
          outcomeIndex,
          amount,
          pricePerShare: priceAtPurchase,
          shares: sharesReceived,
          status: BetStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      // Create balance ledger entry
      await tx.balanceLedger.create({
        data: {
          userId: user.id,
          delta: -amount,
          balanceBefore: userBalance,
          balanceAfter: newBalance, // newBalance calculated at start of transaction
          reason: BalanceReason.BET_PLACED,
          correlationId: bet.id,
        },
      });

      // Get existing position to calculate weighted average cost
      const existingPosition = await tx.position.findUnique({
        where: {
          userId_marketId: {
            userId: user.id,
            marketId: market.id,
          },
        },
      });

      const currentShares = isOutcome0
        ? Number(existingPosition?.shares0 || 0)
        : Number(existingPosition?.shares1 || 0);
      const currentAvgCost = isOutcome0
        ? Number(existingPosition?.avgCost0 || 0)
        : Number(existingPosition?.avgCost1 || 0);

      // Calculate new weighted average cost
      const newTotalShares = currentShares + sharesReceived;
      const newAvgCost = newTotalShares > 0
        ? (currentShares * currentAvgCost + sharesReceived * priceAtPurchase) / newTotalShares
        : priceAtPurchase;

      // Update or create position
      await tx.position.upsert({
        where: {
          userId_marketId: {
            userId: user.id,
            marketId: market.id,
          },
        },
        update: {
          ...(isOutcome0
            ? {
                shares0: { increment: sharesReceived },
                avgCost0: newAvgCost,
                amount0: { increment: amount },
                weighted0: { increment: amount * bet.weight },
              }
            : {
                shares1: { increment: sharesReceived },
                avgCost1: newAvgCost,
                amount1: { increment: amount },
                weighted1: { increment: amount * bet.weight },
              }),
          lastBetAt: new Date(),
        },
        create: {
          userId: user.id,
          marketId: market.id,
          shares0: isOutcome0 ? sharesReceived : 0,
          shares1: isOutcome0 ? 0 : sharesReceived,
          avgCost0: isOutcome0 ? priceAtPurchase : 0,
          avgCost1: isOutcome0 ? 0 : priceAtPurchase,
          amount0: isOutcome0 ? amount : 0,
          amount1: isOutcome0 ? 0 : amount,
          weighted0: isOutcome0 ? amount * bet.weight : 0,
          weighted1: isOutcome0 ? 0 : amount * bet.weight,
          lastBetAt: new Date(),
        },
      });

      // Update market pool totals
      const updatedMarket = await tx.market.update({
        where: { id: market.id },
        data: {
          ...(isOutcome0
            ? { pool0: { increment: amount } }
            : { pool1: { increment: amount } }),
        },
      });

      // Calculate new prices (pari-mutuel style) - after pool update
      const newPool0 = Number(updatedMarket.pool0);
      const newPool1 = Number(updatedMarket.pool1);
      
      const totalPool = seed0Num + seed1Num + newPool0 + newPool1;
      const price0 = totalPool > 0 ? (seed0Num + newPool0) / totalPool : 0.5;
      const price1 = totalPool > 0 ? (seed1Num + newPool1) / totalPool : 0.5;

      // Persist new prices to database
      await tx.market.update({
        where: { id: market.id },
        data: {
          outcomePrices: JSON.stringify([price0.toFixed(4), price1.toFixed(4)]),
        },
      });

      // Create price snapshot for chart history
      await createPriceSnapshot(
        tx,
        market.id,
        updatedMarket.pool0,
        updatedMarket.pool1,
        updatedMarket.seed0,
        updatedMarket.seed1
      );

      // Broadcast to connected clients for real-time updates
      broadcastPriceChange(
        market.id,
        market.eventId,
        [price0, price1],
        [seed0Num + newPool0, seed1Num + newPool1]
      );

      return bet;
    });

    // Award XP for trading volume (with protection checks)
    let xpAwarded = 0;
    let xpReason: string | undefined;
    try {
      const xpResult = await awardXPForVolume(user.id, amount, result.id, marketId);
      if (xpResult) {
        xpAwarded = xpResult.xpAwarded;
        xpReason = xpResult.reason;
      }
    } catch (err) {
      console.error("Failed to award XP:", err);
    }

    return NextResponse.json({ 
      bet: result,
      outcomeLabel: outcomes[outcomeIndex],
      xpAwarded,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error placing bet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
