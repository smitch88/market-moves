import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    // Fetch recent bets
    const recentBets = await prisma.bet.findMany({
      where: {
        status: "CONFIRMED",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            handle: true,
            profileImageUrl: true,
          },
        },
        market: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        outcome: {
          select: {
            id: true,
            key: true,
            label: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Fetch recent market status changes from admin logs
    const recentMarketActions = await prisma.adminActionLog.findMany({
      where: {
        action: {
          in: ["MARKET_CREATE", "MARKET_UPDATE", "MARKET_CLOSE", "MARKET_RESOLVE", "MARKET_SETTLE"],
        },
        targetType: "Market",
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            handle: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Fetch market titles for actions
    const marketIds = recentMarketActions.map((action) => action.targetId);
    const markets = await prisma.market.findMany({
      where: { id: { in: marketIds } },
      select: { id: true, title: true, slug: true },
    });
    const marketMap = new Map(markets.map((m) => [m.id, m]));

    // Enrich actions with market data
    const enrichedActions = recentMarketActions.map((action) => ({
      ...action,
      market: marketMap.get(action.targetId),
    }));

    // Fetch recent user signups
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 20),
      select: {
        id: true,
        name: true,
        handle: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    // Combine and sort all activities
    const activities: Array<{
      type: "bet" | "market_action" | "user_signup";
      timestamp: Date;
      data: any;
    }> = [
      ...recentBets.map((bet) => ({
        type: "bet" as const,
        timestamp: bet.createdAt,
        data: bet,
      })),
      ...enrichedActions.map((action) => ({
        type: "market_action" as const,
        timestamp: action.createdAt,
        data: action,
      })),
      ...recentUsers.map((user) => ({
        type: "user_signup" as const,
        timestamp: user.createdAt,
        data: user,
      })),
    ];

    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Return top N activities
    return NextResponse.json({
      activities: activities.slice(0, limit),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching activity:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

