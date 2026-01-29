import { NextRequest, NextResponse } from "next/server";
import {
  getLeaderboard,
  LeaderboardMetric,
  LeaderboardPeriod,
} from "@/lib/services/leaderboard-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard
 *
 * Query params:
 * - metric: "xp" | "pnl" (default: "xp")
 * - period: "all" | "monthly" | "weekly" (default: "all")
 * - limit: number (default: 100, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const metricParam = searchParams.get("metric") || "xp";
    const periodParam = searchParams.get("period") || "all";
    const limitParam = searchParams.get("limit") || "100";

    // Validate metric
    const validMetrics: LeaderboardMetric[] = ["xp", "pnl"];
    const metric = validMetrics.includes(metricParam as LeaderboardMetric)
      ? (metricParam as LeaderboardMetric)
      : "xp";

    // Validate period
    const validPeriods: LeaderboardPeriod[] = ["all", "monthly", "weekly"];
    const period = validPeriods.includes(periodParam as LeaderboardPeriod)
      ? (periodParam as LeaderboardPeriod)
      : "all";

    // Validate limit
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 100));

    // Get leaderboard data
    const result = await getLeaderboard(metric, period, limit);

    // Return with cache headers for CDN caching
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
