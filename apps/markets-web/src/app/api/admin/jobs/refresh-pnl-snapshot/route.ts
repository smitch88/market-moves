import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import {
  refreshPnLSnapshot,
  getSnapshotMetadata,
} from "@/lib/services/pnl-snapshot-service";

/**
 * POST /api/admin/jobs/refresh-pnl-snapshot
 * 
 * Manually trigger a PnL snapshot refresh from the admin panel.
 * Requires ADMIN role.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await getEffectiveUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log(`[Admin Jobs] PnL snapshot refresh triggered by ${user.handle || user.id}`);

    // Run the refresh
    const result = await refreshPnLSnapshot();

    if (result.success) {
      console.log("[Admin Jobs] PnL snapshot refresh completed", {
        userCount: result.userCount,
        durationMs: result.durationMs,
      });

      return NextResponse.json({
        success: true,
        message: "PnL snapshot refreshed successfully",
        userCount: result.userCount,
        durationMs: result.durationMs,
        refreshedAt: result.refreshedAt.toISOString(),
      });
    } else {
      console.error("[Admin Jobs] PnL snapshot refresh failed", {
        error: result.error,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Failed to refresh PnL snapshot",
          message: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Admin Jobs] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Failed to refresh PnL snapshot",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/jobs/refresh-pnl-snapshot
 * 
 * Get the current status of the PnL snapshot.
 * Requires ADMIN role.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await getEffectiveUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const metadata = await getSnapshotMetadata();

    return NextResponse.json({
      success: true,
      snapshot: metadata
        ? {
            lastRefresh: metadata.lastRefresh.toISOString(),
            userCount: metadata.userCount,
            durationMs: metadata.durationMs,
            status: metadata.status,
            error: metadata.error,
          }
        : null,
    });
  } catch (error) {
    console.error("[Admin Jobs] Error fetching snapshot status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch snapshot status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 600; // Allow up to 10 minutes for admin-triggered refresh
