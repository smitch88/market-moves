import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export type MarketHealthStatus = "healthy" | "warning" | "broken";

export interface MarketHealthResponse {
  marketId: string;
  status: MarketHealthStatus;
  issues: string[];
  details: {
    seed0: number;
    seed1: number;
    reserve0: number;
    reserve1: number;
    k: number | null;
    price0: number;
    price1: number;
    seedReserveMismatch: boolean;
    extremePrices: boolean;
    lowLiquidity: boolean;
    positionCount: number;
    betCount: number;
  };
}

const MIN_LIQUIDITY = 100;
const EXTREME_PRICE_THRESHOLD_LOW = 0.01; // 1%
const EXTREME_PRICE_THRESHOLD_HIGH = 0.99; // 99%

/**
 * GET /api/admin/markets/[id]/health
 * 
 * Returns health status and diagnostic information for a market.
 * Helps admins identify markets with broken pricing or liquidity issues.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse<MarketHealthResponse | { error: string }>> {
  try {
    await requireAdmin();
    const { id } = await params;

    const market = await prisma.market.findUnique({
      where: { id },
      select: {
        id: true,
        seed0: true,
        seed1: true,
        reserve0: true,
        reserve1: true,
        k: true,
        outcomePrices: true,
        status: true,
        _count: {
          select: {
            positions: true,
            bets: { where: { status: "CONFIRMED" } },
          },
        },
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Parse values
    const seed0 = Number(market.seed0);
    const seed1 = Number(market.seed1);
    const reserve0 = Number(market.reserve0);
    const reserve1 = Number(market.reserve1);
    const k = market.k ? Number(market.k) : null;

    // Parse prices
    let price0 = 0.5;
    let price1 = 0.5;
    try {
      const prices = JSON.parse(market.outcomePrices);
      price0 = parseFloat(prices[0]);
      price1 = parseFloat(prices[1]);
    } catch {
      // Use defaults
    }

    // Check for issues
    const issues: string[] = [];

    // 1. Check seed/reserve mismatch (only for markets that haven't been traded)
    const seedReserveMismatch = 
      Math.abs(seed0 - reserve0) > 1 || Math.abs(seed1 - reserve1) > 1;
    
    // For DRAFT markets, reserves should match seeds
    if (seedReserveMismatch && market.status === "DRAFT") {
      issues.push(`Seed/reserve mismatch: seed0=${seed0}, reserve0=${reserve0}, seed1=${seed1}, reserve1=${reserve1}`);
    }

    // 2. Check for extreme prices (potential broken market)
    const extremePrices = 
      price0 < EXTREME_PRICE_THRESHOLD_LOW || 
      price0 > EXTREME_PRICE_THRESHOLD_HIGH ||
      price1 < EXTREME_PRICE_THRESHOLD_LOW || 
      price1 > EXTREME_PRICE_THRESHOLD_HIGH;
    
    if (extremePrices) {
      issues.push(`Extreme prices detected: ${(price0 * 100).toFixed(2)}% / ${(price1 * 100).toFixed(2)}%`);
    }

    // 3. Check for low liquidity
    const lowLiquidity = reserve0 < MIN_LIQUIDITY || reserve1 < MIN_LIQUIDITY;
    if (lowLiquidity) {
      issues.push(`Low liquidity: reserve0=${reserve0.toFixed(2)}, reserve1=${reserve1.toFixed(2)}`);
    }

    // 4. Check for missing k invariant
    if (!k) {
      issues.push("Missing k invariant - market may not be properly initialized");
    }

    // Determine overall status
    let status: MarketHealthStatus = "healthy";
    if (issues.length > 0) {
      // Broken if extreme prices or very low liquidity
      if (extremePrices || reserve0 < 1 || reserve1 < 1) {
        status = "broken";
      } else {
        status = "warning";
      }
    }

    const response: MarketHealthResponse = {
      marketId: market.id,
      status,
      issues,
      details: {
        seed0,
        seed1,
        reserve0,
        reserve1,
        k,
        price0,
        price1,
        seedReserveMismatch,
        extremePrices,
        lowLiquidity,
        positionCount: market._count.positions,
        betCount: market._count.bets,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error checking market health:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
