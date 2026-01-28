import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { getPriceHistory, type TimePeriod } from "@/lib/services/price-snapshot-service";

const VALID_PERIODS: TimePeriod[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "1D") as TimePeriod;
    const marketId = searchParams.get("marketId");

    // Validate period
    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json(
        { error: `Invalid period. Valid values: ${VALID_PERIODS.join(", ")}` },
        { status: 400 }
      );
    }

    // If marketId is provided, use it directly
    // Otherwise, try to find the market by event slug (first market of the event)
    let targetMarketId = marketId;

    if (!targetMarketId) {
      // Find event by slug and get its first market
      const event = await prisma.event.findUnique({
        where: { slug },
        include: {
          markets: {
            take: 1,
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      if (event.markets.length === 0) {
        return NextResponse.json({ error: "No markets found for event" }, { status: 404 });
      }

      targetMarketId = event.markets[0]!.id;
    }

    // Get price history
    const snapshots = await getPriceHistory(targetMarketId, period);

    // If no snapshots exist, return current price as single point
    if (snapshots.length === 0) {
      const market = await prisma.market.findUnique({
        where: { id: targetMarketId },
        select: {
          id: true,
          seed0: true,
          seed1: true,
          pool0: true,
          pool1: true,
        },
      });

      if (!market) {
        return NextResponse.json({ error: "Market not found" }, { status: 404 });
      }

      const totalPool0 = market.seed0 + market.pool0;
      const totalPool1 = market.seed1 + market.pool1;
      const total = totalPool0 + totalPool1;
      const price0 = total > 0 ? totalPool0 / total : 0.5;
      const price1 = total > 0 ? totalPool1 / total : 0.5;

      return NextResponse.json({
        marketId: targetMarketId,
        period,
        snapshots: [
          {
            price0,
            price1,
            pool0: totalPool0,
            pool1: totalPool1,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }

    // Format response
    return NextResponse.json({
      marketId: targetMarketId,
      period,
      snapshots: snapshots.map((s) => ({
        price0: s.price0,
        price1: s.price1,
        pool0: s.pool0,
        pool1: s.pool1,
        timestamp: s.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching price history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
