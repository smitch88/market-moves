import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus, BalanceReason } from "@vault/database";
import { requireUser } from "@vault/auth";
import { createPriceSnapshot } from "@/lib/services/price-snapshot-service";
import { broadcastPriceChange } from "@/lib/services/price-broadcaster";
import { z } from "zod";

const placeBetSchema = z.object({
  marketId: z.string(),
  outcomeIndex: z.number().int().min(0).max(1),
  amount: z.number().positive().int(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { marketId, outcomeIndex, amount } = placeBetSchema.parse(body);

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

    // Check user has sufficient balance
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { balance: true, balanceLocked: true },
    });

    if (!currentUser || currentUser.balanceLocked) {
      return NextResponse.json({ error: "Account is locked" }, { status: 403 });
    }

    const userBalance = Number(currentUser.balance);
    if (userBalance < amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // Create bet, update balance, position, and pool in transaction (immediate confirmation)
    const result = await prisma.$transaction(async (tx) => {
      const isOutcome0 = outcomeIndex === 0;

      // Create the bet (confirmed immediately - no tweet required)
      const bet = await tx.bet.create({
        data: {
          userId: user.id,
          marketId: market.id,
          outcomeIndex,
          amount,
          status: BetStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      // Debit user balance
      const newBalance = userBalance - amount;
      await tx.user.update({
        where: { id: user.id },
        data: { balance: newBalance },
      });

      // Create balance ledger entry
      await tx.balanceLedger.create({
        data: {
          userId: user.id,
          delta: -amount,
          balanceBefore: userBalance,
          balanceAfter: newBalance,
          reason: BalanceReason.BET_PLACED,
          correlationId: bet.id,
        },
      });

      // Update or create position (pari-mutuel style)
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
                amount0: { increment: amount },
                weighted0: { increment: amount * bet.weight },
              }
            : {
                amount1: { increment: amount },
                weighted1: { increment: amount * bet.weight },
              }),
          lastBetAt: new Date(),
        },
        create: {
          userId: user.id,
          marketId: market.id,
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

      // Calculate new prices (pari-mutuel style)
      const seed0Num = Number(updatedMarket.seed0);
      const seed1Num = Number(updatedMarket.seed1);
      const pool0Num = Number(updatedMarket.pool0);
      const pool1Num = Number(updatedMarket.pool1);
      
      const totalPool = seed0Num + seed1Num + pool0Num + pool1Num;
      const price0 = totalPool > 0 ? (seed0Num + pool0Num) / totalPool : 0.5;
      const price1 = totalPool > 0 ? (seed1Num + pool1Num) / totalPool : 0.5;

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
        [seed0Num + pool0Num, seed1Num + pool1Num]
      );

      return bet;
    });

    return NextResponse.json({ 
      bet: result,
      outcomeLabel: outcomes[outcomeIndex],
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
