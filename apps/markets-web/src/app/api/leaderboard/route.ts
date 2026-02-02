import { NextRequest, NextResponse } from "next/server";
import {
  getLeaderboard,
  getUserLeaderboardEntry,
  LeaderboardMetric,
  LeaderboardPeriod,
} from "@/lib/services/leaderboard-service";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard
 *
 * Query params:
 * - metric: "xp" | "pnl" | "volume" | "creators" (default: "xp")
 * - period: "all" | "monthly" | "weekly" (default: "all")
 * - page: number (default: 1)
 * - pageSize: number (default: 25, max: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const metricParam = searchParams.get("metric") || "xp";
    const periodParam = searchParams.get("period") || "all";
    const pageParam = searchParams.get("page") || "1";
    const pageSizeParam = searchParams.get("pageSize") || "25";

    // Validate metric
    const validMetrics: LeaderboardMetric[] = ["xp", "pnl", "volume", "creators", "referrals"];
    const metric = validMetrics.includes(metricParam as LeaderboardMetric)
      ? (metricParam as LeaderboardMetric)
      : "xp";

    // Validate period
    const validPeriods: LeaderboardPeriod[] = ["all", "monthly", "weekly"];
    const period = validPeriods.includes(periodParam as LeaderboardPeriod)
      ? (periodParam as LeaderboardPeriod)
      : "all";

    // Validate pagination
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(pageSizeParam, 10) || 25));

    // Get leaderboard data
    const result = await getLeaderboard(metric, period, page, pageSize);

    // Try to get current user's rank if authenticated
    let currentUserEntry = null;
    let isAuthenticated = false;
    try {
      const user = await getEffectiveUser();
      if (user) {
        isAuthenticated = true;
        // Check if user is already in the current page
        const isInCurrentPage = result.entries.some((e) => e.userId === user.id);
        if (!isInCurrentPage) {
          currentUserEntry = await getUserLeaderboardEntry(user.id, metric, period);
        }
      }
    } catch {
      // User not authenticated, that's fine
    }

    // Return with appropriate cache headers
    // Use private caching for authenticated requests to prevent CDN from
    // serving one user's currentUserEntry to another user
    const cacheControl = isAuthenticated
      ? "private, max-age=30"
      : "public, s-maxage=30, stale-while-revalidate=60";
    
    return NextResponse.json(
      {
        ...result,
        currentUserEntry,
      },
      {
        headers: {
          "Cache-Control": cacheControl,
        },
      }
    );
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
