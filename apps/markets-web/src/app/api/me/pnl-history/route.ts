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

    // Always include current point
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { realizedPnL: true, totalVolume: true },
    });

    if (currentUser) {
      const unrealizedPnL = await calculateUnrealizedPnL(user.id);
      
      // Add current point if different from last snapshot
      const lastPoint = history[history.length - 1];
      const now = new Date();
      
      if (
        !lastPoint ||
        now.getTime() - lastPoint.timestamp.getTime() > 60 * 60 * 1000 || // More than 1 hour
        lastPoint.realizedPnL !== currentUser.realizedPnL ||
        lastPoint.totalVolume !== currentUser.totalVolume
      ) {
        history.push({
          timestamp: now,
          realizedPnL: currentUser.realizedPnL,
          unrealizedPnL,
          totalVolume: currentUser.totalVolume,
        });
      }
    }

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching PnL history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
