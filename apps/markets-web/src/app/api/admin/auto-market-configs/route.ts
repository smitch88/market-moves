import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketCategory } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  tokenSymbol: z.string().min(1),
  tokenName: z.string().min(1),
  coingeckoId: z.string().min(1),
  chain: z.string().optional().nullable(),
  timeframeMinutes: z.number().int().min(1),
  timeframeLabel: z.string().min(1),
  feeBps: z.number().int().min(0).max(10000).optional().default(100),
  seed0: z.number().min(100).optional().default(100000),
  seed1: z.number().min(100).optional().default(100000),
  category: z.nativeEnum(MarketCategory).optional().default(MarketCategory.CRYPTO),
  eventBannerUrl: z.string().url().optional().nullable().or(z.literal("")),
  eventLogoUrl: z.string().url().optional().nullable().or(z.literal("")),
  cronExpression: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const configs = await prisma.autoMarketConfig.findMany({
      orderBy: [{ isActive: "desc" }, { tokenSymbol: "asc" }, { timeframeMinutes: "asc" }],
      include: {
        _count: { select: { markets: true } },
      },
    });

    return NextResponse.json({ configs });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing auto-market configs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = createSchema.parse(body);

    const config = await prisma.autoMarketConfig.create({
      data: {
        name: data.name,
        isActive: data.isActive,
        tokenSymbol: data.tokenSymbol,
        tokenName: data.tokenName,
        coingeckoId: data.coingeckoId,
        chain: data.chain ?? null,
        timeframeMinutes: data.timeframeMinutes,
        timeframeLabel: data.timeframeLabel,
        feeBps: data.feeBps,
        seed0: data.seed0,
        seed1: data.seed1,
        category: data.category,
        eventBannerUrl: data.eventBannerUrl && data.eventBannerUrl !== "" ? data.eventBannerUrl : null,
        eventLogoUrl: data.eventLogoUrl && data.eventLogoUrl !== "" ? data.eventLogoUrl : null,
        cronExpression: data.cronExpression ?? null,
      },
    });

    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "A config for this token and timeframe already exists" },
        { status: 400 }
      );
    }
    console.error("Error creating auto-market config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
