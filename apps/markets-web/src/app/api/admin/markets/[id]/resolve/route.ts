import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const resolveSchema = z.object({
  outcomeId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { outcomeId } = resolveSchema.parse(body);

    const market = await prisma.$transaction(async (tx) => {
      const existing = await tx.market.findUnique({
        where: { id },
        include: { outcomes: true },
      });

      if (!existing) {
        throw new Error("Market not found");
      }
      if (existing.status !== MarketStatus.CLOSED) {
        throw new Error("Market must be closed before resolving");
      }
      if (existing.resolvedOutcomeId) {
        throw new Error("Market already resolved");
      }

      // Verify outcome belongs to this market
      const outcome = existing.outcomes.find((o) => o.id === outcomeId);
      if (!outcome) {
        throw new Error("Invalid outcome for this market");
      }

      const updated = await tx.market.update({
        where: { id },
        data: {
          status: MarketStatus.RESOLVED,
          resolvedOutcomeId: outcomeId,
          resolvedAt: new Date(),
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_RESOLVE,
          targetType: "Market",
          targetId: id,
          metadata: {
            outcomeId,
            outcomeLabel: outcome.label,
            newStatus: MarketStatus.RESOLVED,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ market });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Market not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && (error.message.includes("closed") || error.message.includes("resolved") || error.message.includes("Invalid outcome"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error resolving market:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
