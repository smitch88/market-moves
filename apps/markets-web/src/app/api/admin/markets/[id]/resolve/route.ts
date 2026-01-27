import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const resolveSchema = z.object({
  outcomeIndex: z.number().int().min(0).max(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { outcomeIndex } = resolveSchema.parse(body);

    const market = await prisma.$transaction(async (tx) => {
      const existing = await tx.market.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("Market not found");
      }
      if (existing.status !== MarketStatus.CLOSED) {
        throw new Error("Market must be closed before resolving");
      }
      if (existing.resolvedOutcome !== null) {
        throw new Error("Market already resolved");
      }

      // Parse outcomes to get the label for logging
      const outcomes = JSON.parse(existing.outcomes) as string[];
      const outcomeLabel = outcomes[outcomeIndex];

      if (!outcomeLabel) {
        throw new Error("Invalid outcome index");
      }

      const updated = await tx.market.update({
        where: { id },
        data: {
          status: MarketStatus.RESOLVED,
          resolvedOutcome: outcomeIndex,
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
            outcomeIndex,
            outcomeLabel,
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
