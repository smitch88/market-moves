import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@vault/auth";
import { tradeService } from "@/lib/services/trade-service";
import * as currency from "@/lib/utils/currency";
import { z } from "zod";

const sellSchema = z.object({
  marketId: z.string(),
  outcomeIndex: z.number().int().min(0).max(1),
  shares: z.number().positive(), // Number of shares to sell
  minProceeds: z.number().min(0).optional(), // Minimum acceptable proceeds in dollars
});

/**
 * POST /api/trades/sell
 * 
 * Sell shares back to the market.
 * Unlike buys, sells are executed immediately (no tweet required).
 * 
 * Request body:
 * - marketId: string
 * - outcomeIndex: 0 | 1
 * - shares: number
 * - minProceeds?: number (minimum acceptable proceeds in dollars)
 * 
 * Response:
 * - success: boolean
 * - bet: The created sell record
 * - shares: Number of shares sold
 * - proceeds: Dollars received (after fees)
 * - avgPrice: Average price per share
 * - newPrices: Updated market prices
 * - priceImpact: Price impact percentage
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { marketId, outcomeIndex, shares, minProceeds } = sellSchema.parse(body);

    const result = await tradeService.executeSell({
      userId: user.id,
      marketId,
      outcomeIndex: outcomeIndex as 0 | 1,
      shares: currency.decimal(shares),
      minProceeds: minProceeds ? currency.decimal(minProceeds) : undefined,
    });

    const sharesNum = currency.toNumber(result.shares);
    const proceedsNum = currency.toNumber(result.proceeds || currency.zero());
    
    return NextResponse.json({
      success: result.success,
      bet: result.bet,
      shares: sharesNum,
      proceeds: proceedsNum,
      avgPrice: currency.toNumber(result.avgPrice),
      newPrices: [
        currency.toNumber(result.newPrices[0]),
        currency.toNumber(result.newPrices[1]),
      ],
      newReserves: [
        currency.toNumber(result.newReserves[0]),
        currency.toNumber(result.newReserves[1]),
      ],
      priceImpact: currency.toNumber(result.priceImpact),
      message: `Successfully sold ${sharesNum.toFixed(2)} shares for ${currency.formatCurrency(proceedsNum)}`,
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
      if (error.message.includes("Insufficient") || error.message.includes("below minimum")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error executing sell:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
