import { NextRequest, NextResponse } from "next/server";
import { prisma, BalanceReason } from "@vault/database";
import { requireAdmin } from "@vault/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const reason = searchParams.get("reason") as BalanceReason | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const limit = Math.min(pageSize, 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (reason) where.reason = reason;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [entries, total] = await Promise.all([
      prisma.balanceLedger.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              handle: true,
              name: true,
              profileImageUrl: true,
            },
          },
          actorAdmin: {
            select: {
              id: true,
              handle: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.balanceLedger.count({ where }),
    ]);

    // Enrich with related bet/market info where applicable
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        let relatedInfo: Record<string, unknown> = {};

        if (entry.correlationId) {
          // Try to find a bet
          const bet = await prisma.bet.findUnique({
            where: { id: entry.correlationId },
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
                },
              },
            },
          });

          if (bet) {
            const outcomes = JSON.parse(bet.market.outcomes) as string[];
            relatedInfo = {
              relatedType: "bet",
              betId: bet.id,
              betAmount: bet.amount,
              betStatus: bet.status,
              outcomeLabel: outcomes[bet.outcomeIndex],
              marketId: bet.market.id,
              marketQuestion: bet.market.question,
            };
          }
        }

        return {
          ...entry,
          ...relatedInfo,
        };
      })
    );

    // Get summary stats
    const stats = await prisma.balanceLedger.groupBy({
      by: ["reason"],
      where,
      _sum: { delta: true },
      _count: true,
    });

    return NextResponse.json({
      entries: enrichedEntries,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      stats: stats.map((s) => ({
        reason: s.reason,
        count: s._count,
        totalDelta: s._sum.delta || 0,
      })),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching ledger:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
