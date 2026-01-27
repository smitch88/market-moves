import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const updateMarketSchema = z.object({
  title: z.string().min(1).optional(),
  question: z.string().optional(),
  category: z.string().optional(),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  detailsMarkdown: z.string().optional(),
  resolutionSourceUrl: z.string().url().optional().or(z.literal("")),
  opensAt: z.string().nullable().optional(),
  closesAt: z.string().nullable().optional(),
  feeBps: z.number().int().min(0).max(10000).optional(),
  seedA: z.number().int().min(0).optional(),
  seedB: z.number().int().min(0).optional(),
  outcomeALabel: z.string().optional(),
  outcomeBLabel: z.string().optional(),
});

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
      // Update market
      const updatedMarket = await tx.market.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title }),
          ...(data.question !== undefined && { question: data.question || null }),
          ...(data.category && { category: data.category as never }),
          ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl || null }),
          ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
          ...(data.detailsMarkdown !== undefined && { detailsMarkdown: data.detailsMarkdown || null }),
          ...(data.resolutionSourceUrl !== undefined && { resolutionSourceUrl: data.resolutionSourceUrl || null }),
          ...(data.opensAt !== undefined && { opensAt: data.opensAt ? new Date(data.opensAt) : null }),
          ...(data.closesAt !== undefined && { closesAt: data.closesAt ? new Date(data.closesAt) : null }),
          ...(data.feeBps !== undefined && { feeBps: data.feeBps }),
          ...(data.seedA !== undefined && { seedA: data.seedA }),
          ...(data.seedB !== undefined && { seedB: data.seedB }),
        },
      });

      // Update outcome labels if provided
      if (data.outcomeALabel) {
        await tx.outcome.updateMany({
          where: { marketId: id, key: "A" },
          data: { label: data.outcomeALabel },
        });
      }
      if (data.outcomeBLabel) {
        await tx.outcome.updateMany({
          where: { marketId: id, key: "B" },
          data: { label: data.outcomeBLabel },
        });
      }

      // Log admin action
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
        include: { outcomes: true },
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
