import { NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

/**
 * GET /api/admin/volume-history
 * Returns betting volume history over time for the admin dashboard chart
 */
export async function GET() {
  try {
    await requireAdmin();

    // Get all confirmed bets grouped by day
    const bets = await prisma.bet.findMany({
      where: { status: "CONFIRMED" },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Calculate total volume
    const totalVolume = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);

    // Group by day and calculate cumulative volume
    const volumeByDay = new Map<string, number>();
    let cumulativeVolume = 0;

    bets.forEach((bet) => {
      const dayKey = bet.createdAt.toISOString().split("T")[0];
      const amount = Number(bet.amount);
      
      if (!volumeByDay.has(dayKey)) {
        volumeByDay.set(dayKey, cumulativeVolume);
      }
      cumulativeVolume += amount;
      volumeByDay.set(dayKey, cumulativeVolume);
    });

    // Convert to array format for the chart
    const volumeHistory = Array.from(volumeByDay.entries()).map(([date, cumVolume]) => ({
      timestamp: new Date(date).toISOString(),
      volume: 0, // Daily volume (not used currently)
      cumulativeVolume: cumVolume,
    }));

    // Add current day if not present
    const today = new Date().toISOString().split("T")[0];
    if (volumeHistory.length > 0 && !volumeByDay.has(today)) {
      volumeHistory.push({
        timestamp: new Date().toISOString(),
        volume: 0,
        cumulativeVolume: totalVolume,
      });
    }

    return NextResponse.json({
      volumeHistory,
      totalVolume,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching volume history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
