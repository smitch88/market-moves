import { NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

// Time windows in minutes
const TIME_WINDOWS = {
  "5min": 5,
  "10min": 10,
  "15min": 15,
} as const;

/**
 * GET /api/admin/active-users
 *
 * Returns count of active users based on lastSeenAt timestamp.
 * Active = users seen within the last 15 minutes (configurable via query param).
 */
export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();

    // Calculate counts for each time window
    const [count5min, count10min, count15min, totalUsers] = await Promise.all([
      prisma.user.count({
        where: {
          lastSeenAt: {
            gte: new Date(now.getTime() - TIME_WINDOWS["5min"] * 60 * 1000),
          },
        },
      }),
      prisma.user.count({
        where: {
          lastSeenAt: {
            gte: new Date(now.getTime() - TIME_WINDOWS["10min"] * 60 * 1000),
          },
        },
      }),
      prisma.user.count({
        where: {
          lastSeenAt: {
            gte: new Date(now.getTime() - TIME_WINDOWS["15min"] * 60 * 1000),
          },
        },
      }),
      prisma.user.count(),
    ]);

    return NextResponse.json({
      // Primary count (15 minute window)
      activeCount: count15min,
      // Breakdown by time window
      breakdown: {
        "5min": count5min,
        "10min": count10min,
        "15min": count15min,
      },
      // Total registered users for context
      totalUsers,
      // Timestamp of this reading
      timestamp: now.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching active users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
