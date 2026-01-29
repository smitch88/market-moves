import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { getPnLHistory, calculateUnrealizedPnL } from "@/lib/services/stats-service";

/**
 * GET /api/users/[id]/pnl-history
 * 
 * Get public PnL history for a user by their ID or handle.
 * This is a public endpoint - no authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "90", 10);

    // Try to find user by ID first, then by handle
    let targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, realizedPnL: true, totalVolume: true, createdAt: true },
    });

    // If not found by ID, try by handle (case-insensitive)
    if (!targetUser) {
      targetUser = await prisma.user.findFirst({
        where: {
          handle: {
            equals: id,
            mode: "insensitive",
          },
        },
        select: { id: true, realizedPnL: true, totalVolume: true, createdAt: true },
      });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get historical snapshots
    const history = await getPnLHistory(targetUser.id, days);

    // Get current unrealized PnL
    const unrealizedPnL = await calculateUnrealizedPnL(targetUser.id);
    const now = new Date();

    // If no history, add a starting point from when user was created
    if (history.length === 0) {
      history.push({
        timestamp: targetUser.createdAt,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalVolume: 0,
      });
    }

    // Add current point if different from last snapshot or enough time has passed
    const lastPoint = history[history.length - 1];
    const currentRealizedPnL = Number(targetUser.realizedPnL);
    const currentTotalVolume = Number(targetUser.totalVolume);

    if (
      !lastPoint ||
      now.getTime() - new Date(lastPoint.timestamp).getTime() > 60 * 60 * 1000 || // More than 1 hour
      Number(lastPoint.realizedPnL) !== currentRealizedPnL ||
      Number(lastPoint.totalVolume) !== currentTotalVolume
    ) {
      history.push({
        timestamp: now,
        realizedPnL: currentRealizedPnL,
        unrealizedPnL,
        totalVolume: currentTotalVolume,
      });
    }

    // Serialize Decimal values
    const serializedHistory = history.map((point) => ({
      timestamp: point.timestamp instanceof Date ? point.timestamp.toISOString() : point.timestamp,
      realizedPnL: Number(point.realizedPnL),
      unrealizedPnL: Number(point.unrealizedPnL),
      totalVolume: Number(point.totalVolume),
    }));

    return NextResponse.json(serializedHistory);
  } catch (error) {
    console.error("Error fetching user PnL history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

