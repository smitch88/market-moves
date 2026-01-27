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
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Transform bets to include outcome labels
    const transformedBets = recentBets.map((bet) => {
      const outcomes = JSON.parse(bet.market.outcomes) as string[];
      return {
        ...bet,
        outcomeLabel: outcomes[bet.outcomeIndex],
      };
    });

    // Fetch recent market status changes from admin logs
    const recentMarketActions = await prisma.adminActionLog.findMany({
      where: {
        action: {
          in: ["EVENT_CREATE", "EVENT_UPDATE", "MARKET_CREATE", "MARKET_UPDATE", "MARKET_CLOSE", "MARKET_RESOLVE", "MARKET_SETTLE"],
        },
        targetType: { in: ["Market", "Event"] },
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

    // Fetch market/event titles for actions
    const marketIds = recentMarketActions
      .filter((action) => action.targetType === "Market")
      .map((action) => action.targetId);
    const eventIds = recentMarketActions
      .filter((action) => action.targetType === "Event")
      .map((action) => action.targetId);

    const [markets, events] = await Promise.all([
      prisma.market.findMany({
        where: { id: { in: marketIds } },
        select: { 
          id: true, 
          question: true,
          event: {
            select: {
              slug: true,
              title: true,
            },
          },
        },
      }),
      prisma.event.findMany({
        where: { id: { in: eventIds } },
        select: { id: true, title: true, slug: true },
      }),
    ]);
    
    const marketMap = new Map(markets.map((m) => [m.id, m]));
    const eventMap = new Map(events.map((e) => [e.id, e]));

    // Enrich actions with market/event data
    const enrichedActions = recentMarketActions.map((action) => {
      const market = action.targetType === "Market" ? marketMap.get(action.targetId) : null;
      const event = action.targetType === "Event" ? eventMap.get(action.targetId) : null;
      return {
        ...action,
        market: market ? { 
          title: market.event?.title || market.question,
          slug: market.event?.slug,
        } : null,
        event,
      };
    });

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
      data: Record<string, unknown>;
    }> = [
      ...transformedBets.map((bet) => ({
        type: "bet" as const,
        timestamp: bet.createdAt,
        data: bet as Record<string, unknown>,
      })),
      ...enrichedActions.map((action) => ({
        type: "market_action" as const,
        timestamp: action.createdAt,
        data: action as Record<string, unknown>,
      })),
      ...recentUsers.map((user) => ({
        type: "user_signup" as const,
        timestamp: user.createdAt,
        data: user as Record<string, unknown>,
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
