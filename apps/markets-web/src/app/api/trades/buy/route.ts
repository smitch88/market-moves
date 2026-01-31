import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireUser } from "@vault/auth";
import { tradeService } from "@/lib/services/trade-service";
import * as currency from "@/lib/utils/currency";
import { getXPConfig, getXPStatus } from "@/lib/services/xp-service";
import { updateUserStreak } from "@/lib/services/streak-service";
import { createKOLBetNotification, isUserKOL } from "@/lib/services/kol-service";
import { broadcastKOLBet } from "@/app/api/kol-bets/stream/route";
import { z } from "zod";

const buySchema = z.object({
  marketId: z.string(),
  outcomeIndex: z.number().int().min(0).max(1),
  amount: z.number().positive(), // Cost in dollars
  maxSlippage: z.number().min(0).max(1).optional(), // 0-1, default 0.05 (5%)
});

/**
 * POST /api/trades/buy
 * 
 * Buy shares immediately (no tweet verification required).
 * 
 * Request body:
 * - marketId: string
 * - outcomeIndex: 0 | 1
 * - amount: number (cost in dollars)
 * - maxSlippage?: number (0-1, default 0.05)
 * 
 * Response:
 * - bet: The confirmed bet
 * - quote: The trade quote with shares, price, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { marketId, outcomeIndex, amount, maxSlippage } = buySchema.parse(body);

    // Get XP status before trade to calculate expected XP with protections
    const [xpStatus, xpConfig] = await Promise.all([
      getXPStatus(user.id, marketId),
      getXPConfig(),
    ]);

    const result = await tradeService.buyShares({
      userId: user.id,
      marketId,
      outcomeIndex: outcomeIndex as 0 | 1,
      amount: currency.decimal(amount),
      maxSlippage,
    });

    // Calculate XP awarded considering protections
    let xpAwarded = 0;
    let xpReason: string | undefined;
    
    if (xpStatus.dailyXpRemaining <= 0) {
      xpReason = `Daily XP cap reached (${xpConfig.dailyXpCap.toLocaleString()} XP)`;
    } else if (xpStatus.cooldownRemaining > 0) {
      xpReason = `Market cooldown active`;
    } else {
      const baseXP = Math.floor(amount * xpConfig.xpPerDollar);
      xpAwarded = Math.floor(baseXP * xpStatus.nextTradeMultiplier);
      // Cap to daily remaining
      xpAwarded = Math.min(xpAwarded, xpStatus.dailyXpRemaining);
      
      if (xpStatus.nextTradeMultiplier < 1 && xpStatus.nextTradeMultiplier > 0) {
        xpReason = `Diminishing returns: ${Math.round(xpStatus.nextTradeMultiplier * 100)}% (tier ${xpStatus.currentTier + 1})`;
      } else if (xpStatus.nextTradeMultiplier === 0) {
        xpReason = `Volume cap reached for this market today ($${xpStatus.marketVolumeCap.toLocaleString()})`;
      }
    }

    // Update user's streak (placing a bet counts as daily activity)
    const streakResult = await updateUserStreak(user.id);

    // If user is a KOL, create a bet notification for broadcasting
    const userIsKOL = await isUserKOL(user.id);
    if (userIsKOL && result.bet) {
      try {
        // Get market info for the notification
        const market = await prisma.market.findUnique({
          where: { id: marketId },
          select: {
            eventId: true,
            question: true,
            outcomes: true,
            event: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        });

        if (market) {
          const outcomes = JSON.parse(market.outcomes) as string[];
          const outcomeLabel = outcomes[outcomeIndex] || `Outcome ${outcomeIndex}`;

          const notification = await createKOLBetNotification(
            user.id,
            result.bet.id,
            marketId,
            market.eventId,
            amount,
            outcomeIndex,
            outcomeLabel
          );

          // Broadcast to all connected SSE clients
          broadcastKOLBet(notification);
        }
      } catch (err) {
        // Don't fail the trade if notification creation fails
        console.error("Failed to create KOL bet notification:", err);
      }
    }

    return NextResponse.json({
      bet: result.bet,
      quote: {
        ...result.quote,
        inputAmount: currency.toNumber(result.quote.inputAmount),
        outputAmount: currency.toNumber(result.quote.outputAmount),
        avgPrice: currency.toNumber(result.quote.avgPrice),
        priceImpact: currency.toNumber(result.quote.priceImpact),
        feeAmount: currency.toNumber(result.quote.feeAmount),
        newPrices: {
          price0: currency.toNumber(result.quote.newPrices.price0),
          price1: currency.toNumber(result.quote.newPrices.price1),
        },
      },
      xpAwarded,
      xpReason,
      streak: {
        current: streakResult.newStreak,
        multiplier: streakResult.multiplier,
        isNewDay: streakResult.isNewDay,
        badgesAwarded: streakResult.badgesAwarded,
      },
      message: "Trade executed successfully!",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes("slippage") || error.message.includes("Insufficient")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating buy order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
