import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import { recalculateUserRealizedPnL } from "@/lib/services/stats-service";
import { prisma, AdminAction } from "@vault/database";

/**
 * POST /api/admin/users/[id]/recalculate-pnl
 * 
 * Recalculate and fix a user's realized PnL.
 * This accounts for both redemption profits and sell profits.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id: userId } = await params;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, handle: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Recalculate PnL
    const result = await recalculateUserRealizedPnL(userId);

    // Log admin action
    await prisma.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: AdminAction.USER_UPDATE,
        targetType: "User",
        targetId: userId,
        metadata: {
          action: "recalculate_pnl",
          oldPnL: result.oldPnL,
          newPnL: result.newPnL,
          redemptionPnL: result.redemptionPnL,
          sellPnL: result.sellPnL,
        },
      },
    });

    return NextResponse.json({
      success: true,
      userId,
      ...result,
      message: `Realized PnL updated from ${result.oldPnL} to ${result.newPnL}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error recalculating user PnL:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
