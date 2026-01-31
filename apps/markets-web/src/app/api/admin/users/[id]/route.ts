import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;

    // Get user with related data
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        handle: true,
        name: true,
        role: true,
        balance: true,
        xp: true,
        twitterSubject: true,
        profileImageUrl: true,
        createdAt: true,
        referralCode: true,
        isKOL: true,
        kolApprovedAt: true,
        _count: {
          select: {
            bets: { where: { status: "CONFIRMED" } },
            positions: true,
            referralsGiven: true,
            xpLedger: true,
            followers: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user stats (aggregated from bets and positions)
    const [betStats, positionStats, recentBets, recentXpLedger] = await Promise.all([
      // Bet statistics
      prisma.bet.aggregate({
        where: { userId: id, status: "CONFIRMED" },
        _sum: { amount: true, payout: true },
        _count: true,
      }),
      // Position value
      prisma.position.findMany({
        where: { userId: id },
        include: {
          market: {
            select: {
              outcomePrices: true,
              status: true,
            },
          },
        },
      }),
      // Recent bets for activity
      prisma.bet.findMany({
        where: { userId: id, status: "CONFIRMED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          market: {
            select: {
              question: true,
              outcomes: true,
              status: true,
              event: {
                select: {
                  slug: true,
                  title: true,
                },
              },
            },
          },
        },
      }),
      // Recent XP ledger entries
      prisma.xPLedger.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Calculate position value
    let positionsValue = 0;
    positionStats.forEach((pos) => {
      try {
        const prices = JSON.parse(pos.market.outcomePrices);
        positionsValue += (Number(pos.shares0) || 0) * Number(prices[0]);
        positionsValue += (Number(pos.shares1) || 0) * Number(prices[1]);
      } catch {
        // ignore parse errors
      }
    });

    // Calculate realized PnL from completed bets
    const totalBetAmount = betStats._sum.amount ? Number(betStats._sum.amount) : 0;
    const totalPayout = betStats._sum.payout ? Number(betStats._sum.payout) : 0;
    const realizedPnL = totalPayout - totalBetAmount;

    // Calculate win rate
    const wonBets = await prisma.bet.count({
      where: { userId: id, status: "CONFIRMED", payout: { gt: 0 } },
    });
    const lostBets = await prisma.bet.count({
      where: { userId: id, status: "CONFIRMED", payout: { equals: 0 } },
    });
    const totalResolvedBets = wonBets + lostBets;
    const winRate = totalResolvedBets > 0 ? wonBets / totalResolvedBets : 0;

    return NextResponse.json({
      user: {
        ...user,
        twitterId: user.twitterSubject,
        _count: user._count,
      },
      stats: {
        totalBets: betStats._count,
        totalBetVolume: totalBetAmount,
        totalPayout,
        realizedPnL,
        positionsValue,
        positionsCount: user._count.positions,
        referralsCount: user._count.referralsGiven,
        xpTransactionsCount: user._count.xpLedger,
        winRate,
        wonBets,
        lostBets,
      },
      recentActivity: {
        bets: recentBets.map((bet) => ({
          id: bet.id,
          amount: Number(bet.amount),
          outcome: bet.outcomeIndex,
          payout: Number(bet.payout ?? 0),
          createdAt: bet.createdAt,
          market: {
            question: bet.market.question,
            outcomes: bet.market.outcomes,
            outcomeColors: ["#22c55e", "#ef4444"], // Default colors since we don't have them in schema
            status: bet.market.status,
            eventSlug: bet.market.event?.slug,
            eventTitle: bet.market.event?.title,
          },
        })),
        xpTransactions: recentXpLedger.map((tx) => ({
          id: tx.id,
          amount: tx.delta,
          reason: tx.reason,
          createdAt: tx.createdAt,
        })),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
