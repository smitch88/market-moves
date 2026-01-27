import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, OutcomeKey, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const createMarketSchema = z.object({
  title: z.string().min(1),
  question: z.string().optional(),
  slug: z.string().min(1),
  category: z.string().default("OTHER"),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  detailsMarkdown: z.string().optional(),
  resolutionSourceUrl: z.string().url().optional().or(z.literal("")),
  opensAt: z.string().nullable().optional(),
  closesAt: z.string().nullable().optional(),
  feeBps: z.number().int().min(0).max(10000).default(400),
  seedA: z.number().int().min(0).default(0),
  seedB: z.number().int().min(0).default(0),
  outcomeALabel: z.string().min(1),
  outcomeBLabel: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const data = createMarketSchema.parse(body);

    // Create market with outcomes in transaction
    const market = await prisma.$transaction(async (tx) => {
      const newMarket = await tx.market.create({
        data: {
          title: data.title,
          question: data.question || null,
          slug: data.slug,
          category: data.category as never,
          bannerUrl: data.bannerUrl || null,
          logoUrl: data.logoUrl || null,
          detailsMarkdown: data.detailsMarkdown || null,
          resolutionSourceUrl: data.resolutionSourceUrl || null,
          opensAt: data.opensAt ? new Date(data.opensAt) : null,
          closesAt: data.closesAt ? new Date(data.closesAt) : null,
          feeBps: data.feeBps,
          seedA: data.seedA,
          seedB: data.seedB,
          status: MarketStatus.DRAFT,
        },
      });

      // Create outcomes
      await tx.outcome.createMany({
        data: [
          { marketId: newMarket.id, key: OutcomeKey.A, label: data.outcomeALabel },
          { marketId: newMarket.id, key: OutcomeKey.B, label: data.outcomeBLabel },
        ],
      });

      // Log admin action
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_CREATE,
          targetType: "Market",
          targetId: newMarket.id,
          metadata: { title: data.title, slug: data.slug },
        },
      });

      return tx.market.findUnique({
        where: { id: newMarket.id },
        include: { outcomes: true },
      });
    });

    return NextResponse.json({ market });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A market with this slug already exists" }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating market:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
