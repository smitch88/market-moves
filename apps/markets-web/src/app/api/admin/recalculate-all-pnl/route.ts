import { NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import { recalculateUserRealizedPnL } from "@/lib/services/stats-service";
import { prisma, AdminAction } from "@vault/database";

/**
 * POST /api/admin/recalculate-all-pnl
 * 
 * Recalculate realized PnL for all users who have trading activity.
 * This is a one-time fix for historical data.
 */
export async function POST() {
  try {
    const admin = await requireAdmin();

    // Get all users with bets
    const usersWithBets = await prisma.user.findMany({
      where: {
        bets: { some: {} },
      },
      select: { id: true },
    });

    const results: Array<{
      userId: string;
      oldPnL: number;
      newPnL: number;
      changed: boolean;
    }> = [];

    // Process each user
    for (const user of usersWithBets) {
      try {
        const result = await recalculateUserRealizedPnL(user.id);
        results.push({
          userId: user.id,
          oldPnL: result.oldPnL,
          newPnL: result.newPnL,
          changed: result.oldPnL !== result.newPnL,
        });
      } catch (error) {
        console.error(`Error recalculating PnL for user ${user.id}:`, error);
      }
    }

    const changedCount = results.filter((r) => r.changed).length;

    // Log admin action
    await prisma.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: AdminAction.USER_UPDATE,
        targetType: "System",
        targetId: "all-users",
        metadata: {
          action: "recalculate_all_pnl",
          totalUsers: usersWithBets.length,
          usersChanged: changedCount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      totalUsers: usersWithBets.length,
      usersChanged: changedCount,
      results: results.filter((r) => r.changed), // Only show changed users
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error recalculating all user PnL:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
