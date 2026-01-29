import { NextRequest, NextResponse } from "next/server";
import { prisma, BalanceReason, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const adjustBalanceSchema = z.object({
  delta: z.number().int(), // Can be positive or negative
  reason: z.string().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { delta, reason } = adjustBalanceSchema.parse(body);

    if (delta === 0) {
      return NextResponse.json({ error: "Delta cannot be zero" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch the user
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, balance: true, handle: true, name: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const currentBalance = Number(user.balance);
      const newBalance = currentBalance + delta;

      // Prevent negative balance
      if (newBalance < 0) {
        throw new Error(`Cannot adjust: would result in negative balance (${newBalance})`);
      }

      // Update user balance
      await tx.user.update({
        where: { id },
        data: { balance: newBalance },
      });

      // Create balance ledger entry
      await tx.balanceLedger.create({
        data: {
          userId: id,
          delta,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          reason: BalanceReason.ADMIN_ADJUST,
          actorAdminUserId: admin.id,
        },
      });

      // Log admin action
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_UPDATE, // Could add USER_BALANCE_ADJUST action
          targetType: "User",
          targetId: id,
          metadata: {
            delta,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            reason,
          },
        },
      });

      return {
        userId: id,
        userHandle: user.handle,
        userName: user.name,
        delta,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        reason,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Cannot adjust")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error adjusting balance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
