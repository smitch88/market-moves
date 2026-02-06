import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketCategory } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  tokenSymbol: z.string().min(1).optional(),
  tokenName: z.string().min(1).optional(),
  coingeckoId: z.string().min(1).optional(),
  chain: z.string().optional().nullable(),
  timeframeMinutes: z.number().int().min(1).optional(),
  timeframeLabel: z.string().min(1).optional(),
  feeBps: z.number().int().min(0).max(10000).optional(),
  seed0: z.number().min(100).optional(),
  seed1: z.number().min(100).optional(),
  category: z.nativeEnum(MarketCategory).optional(),
  eventBannerUrl: z.string().url().optional().nullable().or(z.literal("")),
  eventLogoUrl: z.string().url().optional().nullable().or(z.literal("")),
  cronExpression: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const config = await prisma.autoMarketConfig.findUnique({
      where: { id },
      include: { _count: { select: { markets: true } } },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const config = await prisma.autoMarketConfig.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.tokenSymbol !== undefined && { tokenSymbol: data.tokenSymbol }),
        ...(data.tokenName !== undefined && { tokenName: data.tokenName }),
        ...(data.coingeckoId !== undefined && { coingeckoId: data.coingeckoId }),
        ...(data.chain !== undefined && { chain: data.chain }),
        ...(data.timeframeMinutes !== undefined && {
          timeframeMinutes: data.timeframeMinutes,
        }),
        ...(data.timeframeLabel !== undefined && {
          timeframeLabel: data.timeframeLabel,
        }),
        ...(data.feeBps !== undefined && { feeBps: data.feeBps }),
        ...(data.seed0 !== undefined && { seed0: data.seed0 }),
        ...(data.seed1 !== undefined && { seed1: data.seed1 }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.eventBannerUrl !== undefined && {
          eventBannerUrl: data.eventBannerUrl && data.eventBannerUrl !== "" ? data.eventBannerUrl : null,
        }),
        ...(data.eventLogoUrl !== undefined && {
          eventLogoUrl: data.eventLogoUrl && data.eventLogoUrl !== "" ? data.eventLogoUrl : null,
        }),
        ...(data.cronExpression !== undefined && {
          cronExpression: data.cronExpression,
        }),
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
      error.message.includes("Record to update not found")
    ) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error updating auto-market config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
