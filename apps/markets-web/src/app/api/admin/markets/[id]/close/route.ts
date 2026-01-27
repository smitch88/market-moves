import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const market = await prisma.$transaction(async (tx) => {
      const existing = await tx.market.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("Market not found");
      }
      if (existing.status !== MarketStatus.OPEN && existing.status !== MarketStatus.PUBLISHED) {
        throw new Error("Market is not open");
      }

      const updated = await tx.market.update({
        where: { id },
        data: {
          status: MarketStatus.CLOSED,
          closesAt: existing.closesAt || new Date(),
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_CLOSE,
          targetType: "Market",
          targetId: id,
          metadata: { newStatus: MarketStatus.CLOSED },
        },
      });

      return updated;
    });

    return NextResponse.json({ market });
  } catch (error) {
    if (error instanceof Error && error.message === "Market not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("not open")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error closing market:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
