import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus, BalanceReason, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const cancelBetSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = cancelBetSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // Fetch the bet
      const bet = await tx.bet.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, balance: true },
          },
          market: {
            select: { id: true, question: true, status: true },
          },
        },
      });

      if (!bet) {
        throw new Error("Bet not found");
      }

      // Only pending or confirmed bets can be cancelled
      if (bet.status !== BetStatus.PENDING_TWEET && bet.status !== BetStatus.CONFIRMED) {
        throw new Error(`Cannot cancel bet with status: ${bet.status}`);
      }

      // Refund user balance
      const refundAmount = bet.amount;
      const newBalance = bet.user.balance + refundAmount;

      await tx.user.update({
        where: { id: bet.userId },
        data: { balance: newBalance },
      });

      // Create balance ledger entry for refund
      await tx.balanceLedger.create({
        data: {
          userId: bet.userId,
          delta: refundAmount,
          balanceBefore: bet.user.balance,
          balanceAfter: newBalance,
          reason: BalanceReason.OTHER, // Could add BET_CANCELLED reason
          correlationId: bet.id,
          actorAdminUserId: admin.id,
        },
      });

      // Update bet status to cancelled
      const updatedBet = await tx.bet.update({
        where: { id },
        data: {
          status: BetStatus.CANCELLED,
        },
      });

      // If bet was confirmed, decrement the pool
      if (bet.status === BetStatus.CONFIRMED) {
        const poolField = bet.outcomeIndex === 0 ? "pool0" : "pool1";
        await tx.market.update({
          where: { id: bet.marketId },
          data: {
            [poolField]: { decrement: bet.amount },
          },
        });

        // Also update the position
        const amountField = bet.outcomeIndex === 0 ? "amount0" : "amount1";
        const weightedField = bet.outcomeIndex === 0 ? "weighted0" : "weighted1";
        
        await tx.position.updateMany({
          where: {
            userId: bet.userId,
            marketId: bet.marketId,
          },
          data: {
            [amountField]: { decrement: bet.amount },
            [weightedField]: { decrement: bet.weight || bet.amount },
          },
        });
      }

      // Log admin action
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.MARKET_UPDATE, // Could add BET_CANCEL action
          targetType: "Bet",
          targetId: id,
          metadata: {
            previousStatus: bet.status,
            refundAmount,
            reason: reason || "Admin cancellation",
            marketId: bet.marketId,
          },
        },
      });

      return {
        bet: updatedBet,
        refundAmount,
        newBalance,
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
    if (error instanceof Error && error.message === "Bet not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Cannot cancel")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error cancelling bet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
