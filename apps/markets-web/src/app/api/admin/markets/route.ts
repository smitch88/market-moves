import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
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
  seed0: z.number().int().min(0).default(1000),
  seed1: z.number().int().min(0).default(1000),
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
      const newMarket = await tx.market.create({
        data: {
          eventId: data.eventId,
          question: data.question,
          outcomes: JSON.stringify(data.outcomes),
          outcomePrices: JSON.stringify(["0.50", "0.50"]),
          outcomeColors: data.outcomeColors 
            ? JSON.stringify(data.outcomeColors) 
            : null,
          detailsMarkdown: data.detailsMarkdown || null,
          resolutionSourceUrl: data.resolutionSourceUrl || null,
          opensAt: data.opensAt ? new Date(data.opensAt) : null,
          closesAt: data.closesAt ? new Date(data.closesAt) : null,
          feeBps: data.feeBps,
          seed0: data.seed0,
          seed1: data.seed1,
          status: MarketStatus.DRAFT,
        },
      });

      // Create initial price snapshot for chart history
      // Calculate initial prices from seed values
      const totalSeeds = newMarket.seed0 + newMarket.seed1;
      const initialPrice0 = totalSeeds > 0 ? newMarket.seed0 / totalSeeds : 0.5;
      const initialPrice1 = totalSeeds > 0 ? newMarket.seed1 / totalSeeds : 0.5;
      
      await tx.priceSnapshot.create({
        data: {
          marketId: newMarket.id,
          price0: initialPrice0,
          price1: initialPrice1,
          pool0: newMarket.seed0,
          pool1: newMarket.seed1,
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
