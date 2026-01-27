import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus, BalanceReason, OutcomeKey } from "@vault/database";
import { requireUser } from "@vault/auth";
import { z } from "zod";

const placeBetSchema = z.object({
  marketId: z.string(),
  outcomeKey: z.enum(["A", "B"]),
  amount: z.number().positive().int(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { marketId, outcomeKey, amount } = placeBetSchema.parse(body);

    // Validate market exists and is open
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: true },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status !== "OPEN" && market.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Market is not open for betting" }, { status: 400 });
    }

    if (market.closesAt && new Date(market.closesAt) < new Date()) {
      return NextResponse.json({ error: "Market has closed" }, { status: 400 });
    }

    // Get the outcome
    const outcome = market.outcomes.find((o) => o.key === outcomeKey);
    if (!outcome) {
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    }

    // Check user has sufficient balance
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { balance: true, balanceLocked: true },
    });

    if (!currentUser || currentUser.balanceLocked) {
      return NextResponse.json({ error: "Account is locked" }, { status: 403 });
    }

    if (currentUser.balance < amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // Create bet and update balance in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the bet (pending tweet verification)
      const bet = await tx.bet.create({
        data: {
          userId: user.id,
          marketId: market.id,
          outcomeId: outcome.id,
          amount,
          status: BetStatus.PENDING_TWEET,
        },
      });

      // Debit user balance
      const newBalance = currentUser.balance - amount;
      await tx.user.update({
        where: { id: user.id },
        data: { balance: newBalance },
      });

      // Create balance ledger entry
      await tx.balanceLedger.create({
        data: {
          userId: user.id,
          delta: -amount,
          balanceBefore: currentUser.balance,
          balanceAfter: newBalance,
          reason: BalanceReason.BET_PLACED,
          correlationId: bet.id,
        },
      });

      return bet;
    });

    return NextResponse.json({ bet: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error placing bet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
