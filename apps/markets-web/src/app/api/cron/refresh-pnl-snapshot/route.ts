import { NextRequest, NextResponse } from "next/server";
import {
  refreshPnLSnapshot,
  getSnapshotMetadata,
} from "@/lib/services/pnl-snapshot-service";

/**
 * GET /api/cron/refresh-pnl-snapshot
 * 
 * Vercel Cron Job endpoint - runs every 30 minutes
 * Refreshes the materialized view for PnL leaderboard data
 * 
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, require CRON_SECRET
    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        console.error("[PnL Snapshot Cron] CRON_SECRET not configured");
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 }
        );
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[PnL Snapshot Cron] Unauthorized cron attempt");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    console.log("[PnL Snapshot Cron] Starting PnL snapshot refresh...");

    // Refresh the snapshot
    const result = await refreshPnLSnapshot();

    if (result.success) {
      console.log("[PnL Snapshot Cron] Snapshot refresh completed", {
        userCount: result.userCount,
        durationMs: result.durationMs,
        refreshedAt: result.refreshedAt.toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "PnL snapshot refreshed successfully",
        summary: {
          userCount: result.userCount,
          durationMs: result.durationMs,
          refreshedAt: result.refreshedAt.toISOString(),
        },
      });
    } else {
      console.error("[PnL Snapshot Cron] Snapshot refresh failed", {
        error: result.error,
        durationMs: result.durationMs,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Failed to refresh PnL snapshot",
          message: result.error,
          durationMs: result.durationMs,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[PnL Snapshot Cron] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Failed to refresh PnL snapshot",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Support POST for manual triggers from admin
export async function POST(request: NextRequest) {
  return GET(request);
}

// Vercel cron configuration
export const maxDuration = 600; // Allow up to 10 minutes for the refresh (may have many users)
export const dynamic = "force-dynamic";
