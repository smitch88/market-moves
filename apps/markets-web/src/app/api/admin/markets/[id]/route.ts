import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const updateMarketSchema = z.object({
  question: z.string().min(1).optional(),
  outcomes: z.array(z.string()).length(2).optional(),
  outcomeColors: z.array(z.string()).length(2).optional(),
  detailsMarkdown: z.string().optional(),
  resolutionSourceUrl: z.string().url().optional().or(z.literal("")),
  opensAt: z.string().nullable().optional(),
  closesAt: z.string().nullable().optional(),
  feeBps: z.number().int().min(0).max(10000).optional(),
  seed0: z.number().int().min(0).optional(),
  seed1: z.number().int().min(0).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        event: {
          include: { tags: true },
        },
        bets: {
          where: { status: "CONFIRMED" },
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        positions: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { bets: true },
        },
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Calculate stats (convert Decimals to numbers)
    const pool0 = Number(market.seed0) + Number(market.pool0);
    const pool1 = Number(market.seed1) + Number(market.pool1);
    const totalPool = pool0 + pool1;

    // Serialize market to convert Decimals
    const serializedMarket = {
      ...market,
      seed0: Number(market.seed0),
      seed1: Number(market.seed1),
      pool0: Number(market.pool0),
      pool1: Number(market.pool1),
      k: Number(market.k),
      reserve0: Number(market.reserve0),
      reserve1: Number(market.reserve1),
      positions: market.positions.map((pos) => ({
        ...pos,
        amount0: Number(pos.amount0),
        amount1: Number(pos.amount1),
        shares0: Number(pos.shares0),
        shares1: Number(pos.shares1),
        avgCost0: Number(pos.avgCost0),
        avgCost1: Number(pos.avgCost1),
      })),
    };

    return NextResponse.json({ 
      market: serializedMarket,
      stats: {
        pool0,
        pool1,
        totalPool,
        percent0: totalPool > 0 ? Math.round((pool0 / totalPool) * 100) : 50,
        percent1: totalPool > 0 ? Math.round((pool1 / totalPool) * 100) : 50,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching market:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = updateMarketSchema.parse(body);

    const market = await prisma.$transaction(async (tx) => {
      const updatedMarket = await tx.market.update({
        where: { id },
        data: {
          ...(data.question && { question: data.question }),
          ...(data.outcomes && { outcomes: JSON.stringify(data.outcomes) }),
          ...(data.outcomeColors && { outcomeColors: JSON.stringify(data.outcomeColors) }),
          ...(data.detailsMarkdown !== undefined && { detailsMarkdown: data.detailsMarkdown || null }),
          ...(data.resolutionSourceUrl !== undefined && { resolutionSourceUrl: data.resolutionSourceUrl || null }),
          ...(data.opensAt !== undefined && { opensAt: data.opensAt ? new Date(data.opensAt) : null }),
          ...(data.closesAt !== undefined && { closesAt: data.closesAt ? new Date(data.closesAt) : null }),
          ...(data.feeBps !== undefined && { feeBps: data.feeBps }),
          ...(data.seed0 !== undefined && { seed0: data.seed0 }),
          ...(data.seed1 !== undefined && { seed1: data.seed1 }),
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_UPDATE,
          targetType: "Market",
          targetId: id,
          metadata: data,
        },
      });

      return tx.market.findUnique({
        where: { id },
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
    console.error("Error updating market:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
