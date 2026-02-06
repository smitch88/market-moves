import { NextRequest, NextResponse } from "next/server";
import { createScheduledMarkets } from "@/lib/services/auto-market-service";

/**
 * GET /api/cron/create-auto-markets
 *
 * Vercel Cron Job endpoint - runs every 5 minutes
 * Creates new crypto price markets for active AutoMarketConfig entries whose window is due.
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        console.error("[Create Auto-Markets Cron] CRON_SECRET not configured");
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 }
        );
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[Create Auto-Markets Cron] Unauthorized cron attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[Create Auto-Markets Cron] Starting...");
    const startTime = Date.now();
    const result = await createScheduledMarkets();
    const durationMs = Date.now() - startTime;

    console.log("[Create Auto-Markets Cron] Completed", {
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      summary: {
        created: result.created,
        skipped: result.skipped,
        errors: result.errors.length,
        durationMs,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("[Create Auto-Markets Cron] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Failed to create auto-markets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";
