import { NextRequest, NextResponse } from "next/server";
import { processExpiredMarkets } from "@/lib/services/auto-market-service";

/**
 * GET /api/cron/process-auto-markets
 *
 * Vercel Cron Job endpoint - runs every minute
 * Closes, resolves, and settles auto-markets whose closesAt has passed.
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        console.error("[Process Auto-Markets Cron] CRON_SECRET not configured");
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 }
        );
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[Process Auto-Markets Cron] Unauthorized cron attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[Process Auto-Markets Cron] Starting...");
    const startTime = Date.now();
    const result = await processExpiredMarkets();
    const durationMs = Date.now() - startTime;

    console.log("[Process Auto-Markets Cron] Completed", {
      processed: result.processed,
      errors: result.errors.length,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      summary: {
        processed: result.processed,
        errors: result.errors.length,
        durationMs,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("[Process Auto-Markets Cron] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Failed to process auto-markets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export const maxDuration = 120;
export const dynamic = "force-dynamic";
