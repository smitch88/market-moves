import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, AdminAction, PricingModel } from "@vault/database";
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
  // Legacy pari-mutuel seeds (kept for backward compatibility)
  seed0: z.number().int().min(0).default(1000),
  seed1: z.number().int().min(0).default(1000),
  // AMM options
  pricingModel: z.enum(["PARI_MUTUEL", "CPMM"]).default("CPMM"),
  reserve0: z.number().min(0).optional(), // Initial shares for outcome 0
  reserve1: z.number().min(0).optional(), // Initial shares for outcome 1
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
      const isCPMM = data.pricingModel === "CPMM";
      const cpmm = new ConstantProductAMM();

      // Set up reserves for CPMM or seeds for pari-mutuel
      // For CPMM: reserves represent share liquidity (not scaled)
      let reserve0: number;
      let reserve1: number;
      
      if (isCPMM) {
        reserve0 = data.reserve0 ?? data.seed0; // Reserves are shares
        reserve1 = data.reserve1 ?? data.seed1; // Reserves are shares
      } else {
        // Pari-mutuel uses seeds directly (in cents)
        reserve0 = data.seed0;
        reserve1 = data.seed1;
      }
      
      const k = isCPMM ? ConstantProductAMM.calculateInitialK(reserve0, reserve1) : null;

      // Calculate initial prices
      let initialPrice0: string;
      let initialPrice1: string;

      if (isCPMM) {
        // CPMM: price is based on reserve ratio
        const prices = cpmm.calculatePrice(reserve0, reserve1);
        initialPrice0 = prices.price0.toFixed(4);
        initialPrice1 = prices.price1.toFixed(4);
      } else {
        // Pari-mutuel: price is based on seed ratio
        const totalSeeds = data.seed0 + data.seed1;
        initialPrice0 = totalSeeds > 0 ? (data.seed0 / totalSeeds).toFixed(4) : "0.5000";
        initialPrice1 = totalSeeds > 0 ? (data.seed1 / totalSeeds).toFixed(4) : "0.5000";
      }

      const newMarket = await tx.market.create({
        data: {
          eventId: data.eventId,
          question: data.question,
          outcomes: JSON.stringify(data.outcomes),
          outcomePrices: JSON.stringify([initialPrice0, initialPrice1]),
          outcomeColors: data.outcomeColors 
            ? JSON.stringify(data.outcomeColors) 
            : null,
          detailsMarkdown: data.detailsMarkdown || null,
          resolutionSourceUrl: data.resolutionSourceUrl || null,
          opensAt: data.opensAt ? new Date(data.opensAt) : null,
          closesAt: data.closesAt ? new Date(data.closesAt) : null,
          feeBps: data.feeBps,
          // Pricing model
          pricingModel: isCPMM ? PricingModel.CPMM : PricingModel.PARI_MUTUEL,
          // Legacy pari-mutuel fields
          seed0: data.seed0,
          seed1: data.seed1,
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
            pricingModel: data.pricingModel,
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
