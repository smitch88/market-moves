import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { getPnLHistory, calculateUnrealizedPnL } from "@/lib/services/stats-service";
import { prisma } from "@vault/database";

export async function GET(request: NextRequest) {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    // Get historical snapshots
    const history = await getPnLHistory(user.id, days);

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { realizedPnL: true, totalVolume: true, createdAt: true },
    });

    if (currentUser) {
      const unrealizedPnL = await calculateUnrealizedPnL(user.id);
      const now = new Date();
      
      // If no history, add a starting point from when user was created
      if (history.length === 0) {
        history.push({
          timestamp: currentUser.createdAt,
          realizedPnL: 0,
          unrealizedPnL: 0,
          totalVolume: 0,
        });
      }
      
      // Add current point if different from last snapshot or enough time has passed
      const lastPoint = history[history.length - 1];
      const currentRealizedPnL = Number(currentUser.realizedPnL);
      const currentTotalVolume = Number(currentUser.totalVolume);
      
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
    console.error("Error fetching PnL history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
