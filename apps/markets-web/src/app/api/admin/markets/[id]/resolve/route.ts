import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, BetStatus, BalanceReason, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const resolveSchema = z.object({
  outcomeIndex: z.number().int().min(0).max(1),
  resolutionSourceUrl: z.string().url().optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { outcomeIndex, resolutionSourceUrl } = resolveSchema.parse(body);

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

      // Safety: Reject any remaining pending bets (shouldn't happen if close was called first)
      const pendingBets = await tx.bet.findMany({
        where: {
          marketId: id,
          status: BetStatus.PENDING_TWEET,
        },
        include: {
          user: { select: { id: true, balance: true } },
        },
      });

      let refundedCount = 0;
      let totalRefunded = 0;

      for (const bet of pendingBets) {
        const refundAmount = Number(bet.amount);
        const currentBalance = Number(bet.user.balance);
        const newBalance = currentBalance + refundAmount;

        await tx.user.update({
          where: { id: bet.userId },
          data: { balance: newBalance },
        });

        await tx.balanceLedger.create({
          data: {
            userId: bet.userId,
            delta: refundAmount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            reason: BalanceReason.OTHER,
            correlationId: bet.id,
            actorAdminUserId: admin.id,
          },
        });

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
          status: MarketStatus.RESOLVED,
          resolvedOutcome: outcomeIndex,
          resolvedAt: new Date(),
          ...(resolutionSourceUrl && { resolutionSourceUrl }),
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
            pendingBetsRejected: refundedCount,
            totalRefunded,
            resolutionSourceUrl: resolutionSourceUrl || null,
          },
        },
      });

      return { market: updated, pendingBetsRejected: refundedCount, totalRefunded };
    });

    return NextResponse.json(market);
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
