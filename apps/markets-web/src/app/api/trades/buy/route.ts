import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@vault/auth";
import { tradeService } from "@/lib/services/trade-service";
import * as currency from "@/lib/utils/currency";
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

    const result = await tradeService.buyShares({
      userId: user.id,
      marketId,
      outcomeIndex: outcomeIndex as 0 | 1,
      amount: currency.decimal(amount),
      maxSlippage,
    });

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
