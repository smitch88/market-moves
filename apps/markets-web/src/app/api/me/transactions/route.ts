import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireUser } from "@vault/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const limit = Math.min(pageSize, 100); // Cap at 100
    const offset = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.balanceLedger.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.balanceLedger.count({ where: { userId: user.id } }),
    ]);

    // Enrich transactions with related data
    const enrichedTransactions = await Promise.all(
      transactions.map(async (tx) => {
        let relatedInfo: Record<string, unknown> = {};

        // If there's a correlationId, try to find related bet/market
        if (tx.correlationId) {
          // Try to find a bet with this ID
          const bet = await prisma.bet.findUnique({
            where: { id: tx.correlationId },
            select: {
              id: true,
              outcomeIndex: true,
              amount: true,
              status: true,
              market: {
                select: {
                  id: true,
                  question: true,
                  outcomes: true,
                  event: {
                    select: {
                      slug: true,
                      title: true,
                    },
                  },
                },
              },
            },
          });

          if (bet) {
            const outcomes = JSON.parse(bet.market.outcomes) as string[];
            relatedInfo = {
              type: "bet",
              betId: bet.id,
              betAmount: bet.amount,
              betStatus: bet.status,
              outcomeLabel: outcomes[bet.outcomeIndex],
              marketQuestion: bet.market.question,
              eventSlug: bet.market.event?.slug,
              eventTitle: bet.market.event?.title,
            };
          }
        }

        return {
          id: tx.id,
          delta: tx.delta,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          reason: tx.reason,
          createdAt: tx.createdAt,
          ...relatedInfo,
        };
      })
    );

    return NextResponse.json({
      transactions: enrichedTransactions,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
