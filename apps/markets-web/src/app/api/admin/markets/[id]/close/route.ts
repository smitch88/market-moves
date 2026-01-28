import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, BetStatus, BalanceReason, AdminAction } from "@vault/database";
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

      // Find all pending bets for this market
      const pendingBets = await tx.bet.findMany({
        where: {
          marketId: id,
          status: BetStatus.PENDING_TWEET,
        },
        include: {
          user: { select: { id: true, balance: true } },
        },
      });

      // Refund all pending bets
      let refundedCount = 0;
      let totalRefunded = 0;

      for (const bet of pendingBets) {
        const refundAmount = bet.amount;
        const newBalance = bet.user.balance + refundAmount;

        // Refund user balance
        await tx.user.update({
          where: { id: bet.userId },
          data: { balance: newBalance },
        });

        // Create refund ledger entry
        await tx.balanceLedger.create({
          data: {
            userId: bet.userId,
            delta: refundAmount,
            balanceBefore: bet.user.balance,
            balanceAfter: newBalance,
            reason: BalanceReason.OTHER,
            correlationId: bet.id,
            actorAdminUserId: admin.id,
          },
        });

        // Update bet status to rejected
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: BetStatus.REJECTED },
        });

        refundedCount++;
        totalRefunded += refundAmount;
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
          metadata: {
            newStatus: MarketStatus.CLOSED,
            pendingBetsRejected: refundedCount,
            totalRefunded,
          },
        },
      });

      return { market: updated, pendingBetsRejected: refundedCount, totalRefunded };
    });

    return NextResponse.json(market);
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
