import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { ConstantProductAMM } from "@/lib/services/pricing-engine";
import { z } from "zod";

const createMarketSchema = z.object({
  eventId: z.string().min(1),
  question: z.string().min(1),
  outcomes: z.array(z.string()).length(2),
  outcomeColors: z.array(z.string()).length(2).optional(),
  detailsMarkdown: z.string().optional(),
  resolutionSourceUrl: z.string().url().optional().or(z.literal("")),
  opensAt: z.string().nullable().optional(),
  closesAt: z.string().nullable().optional(),
  feeBps: z.number().int().min(0).max(10000).default(100),
  // Initial liquidity (reserves)
  reserve0: z.number().min(0).optional().default(1000),
  reserve1: z.number().min(0).optional().default(1000),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const markets = await prisma.market.findMany({
      where: {
        ...(eventId && { eventId }),
        ...(status && { status: status as never }),
      },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
          },
        },
        _count: {
          select: { 
            bets: { where: { status: "CONFIRMED" } },
            positions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ markets });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching markets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const data = createMarketSchema.parse(body);

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const market = await prisma.$transaction(async (tx) => {
      const cpmm = new ConstantProductAMM();

      // Set up reserves for CPMM
      const reserve0 = data.reserve0 ?? 1000;
      const reserve1 = data.reserve1 ?? 1000;
      
      const k = ConstantProductAMM.calculateInitialK(reserve0, reserve1);

      // Calculate initial prices (CPMM: price is based on reserve ratio)
      const prices = cpmm.calculatePrice(reserve0, reserve1);
      const initialPrice0 = prices.price0.toFixed(4);
      const initialPrice1 = prices.price1.toFixed(4);

      const newMarket = await tx.market.create({
        data: {
          eventId: data.eventId,
          question: data.question,
          outcomes: JSON.stringify(data.outcomes),
          outcomePrices: JSON.stringify([initialPrice0, initialPrice1]),
          detailsMarkdown: data.detailsMarkdown || null,
          resolutionSourceUrl: data.resolutionSourceUrl || null,
          opensAt: data.opensAt ? new Date(data.opensAt) : null,
          closesAt: data.closesAt ? new Date(data.closesAt) : null,
          feeBps: data.feeBps,
          // CPMM AMM fields
          reserve0,
          reserve1,
          k,
          status: MarketStatus.DRAFT,
        },
      });

      // Create initial price snapshot for chart history
      const snapshotPrice0 = parseFloat(initialPrice0);
      const snapshotPrice1 = parseFloat(initialPrice1);
      
      await tx.priceSnapshot.create({
        data: {
          marketId: newMarket.id,
          price0: snapshotPrice0,
          price1: snapshotPrice1,
          pool0: Math.floor(reserve0),
          pool1: Math.floor(reserve1),
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_CREATE,
          targetType: "Market",
          targetId: newMarket.id,
          metadata: { 
            eventId: data.eventId,
            question: data.question,
            reserve0,
            reserve1,
            k,
          },
        },
      });

      return tx.market.findUnique({
        where: { id: newMarket.id },
        include: { event: true },
      });
    });

    return NextResponse.json({ market });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating market:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
