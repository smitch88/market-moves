import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@vault/database";
import { tradeService } from "@/lib/services/trade-service";
import * as currency from "@/lib/utils/currency";
import { z } from "zod";

const quoteSchema = z.object({
  marketId: z.string(),
  outcomeIndex: z.number().int().min(0).max(1),
  side: z.enum(["buy", "sell"]),
  amount: z.number().positive(), // Dollars for both buy and sell
});

/**
 * GET /api/trades/quote
 * 
 * Get a quote for a trade without executing it.
 * Works for both buy (amount = cost in dollars) and sell (amount = shares).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params = quoteSchema.parse({
      marketId: searchParams.get("marketId"),
      outcomeIndex: parseInt(searchParams.get("outcomeIndex") || "0", 10),
      side: searchParams.get("side"),
      amount: parseFloat(searchParams.get("amount") || "0"),
    });

    const quote = await tradeService.getQuote({
      marketId: params.marketId,
      outcomeIndex: params.outcomeIndex as 0 | 1,
      side: params.side,
      amount: currency.decimal(params.amount),
    });

    // Convert Decimal values to numbers for JSON response
    return NextResponse.json({
      ...quote,
      inputAmount: currency.toNumber(quote.inputAmount),
      outputAmount: currency.toNumber(quote.outputAmount),
      avgPrice: currency.toNumber(quote.avgPrice),
      priceImpact: currency.toNumber(quote.priceImpact),
      feeAmount: currency.toNumber(quote.feeAmount),
      newPrices: {
        price0: currency.toNumber(quote.newPrices.price0),
        price1: currency.toNumber(quote.newPrices.price1),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error getting quote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/trades/quote
 * 
 * Alternative POST endpoint for quote (useful for complex requests).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = quoteSchema.parse(body);

    const quote = await tradeService.getQuote({
      marketId: params.marketId,
      outcomeIndex: params.outcomeIndex as 0 | 1,
      side: params.side,
      amount: currency.decimal(params.amount),
    });

    // Convert Decimal values to numbers for JSON response
    return NextResponse.json({
      ...quote,
      inputAmount: currency.toNumber(quote.inputAmount),
      outputAmount: currency.toNumber(quote.outputAmount),
      avgPrice: currency.toNumber(quote.avgPrice),
      priceImpact: currency.toNumber(quote.priceImpact),
      feeAmount: currency.toNumber(quote.feeAmount),
      newPrices: {
        price0: currency.toNumber(quote.newPrices.price0),
        price1: currency.toNumber(quote.newPrices.price1),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error getting quote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
