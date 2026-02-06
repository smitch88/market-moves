import { NextRequest, NextResponse } from "next/server";
import {
  processExpiredMarkets,
  createScheduledMarkets,
} from "@/lib/services/auto-market-service";

/**
 * GET /api/cron/auto-markets
 *
 * Vercel Cron Job endpoint - runs every minute
 * 1. First processes expired markets (close → resolve → settle) - time-sensitive
 * 2. Then creates new markets for active configs whose window is due
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        console.error("[Auto-Markets Cron] CRON_SECRET not configured");
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 }
        );
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[Auto-Markets Cron] Unauthorized cron attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[Auto-Markets Cron] Starting...");
    const startTime = Date.now();

    // Run both in parallel for faster execution
    const [processResult, createResult] = await Promise.all([
      processExpiredMarkets(),
      createScheduledMarkets(),
    ]);

    const durationMs = Date.now() - startTime;

    console.log("[Auto-Markets Cron] Completed", {
      processed: processResult.processed,
      created: createResult.created,
      skipped: createResult.skipped,
      processErrors: processResult.errors.length,
      createErrors: createResult.errors.length,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      summary: {
        processed: processResult.processed,
        created: createResult.created,
        skipped: createResult.skipped,
        durationMs,
      },
      errors:
        processResult.errors.length > 0 || createResult.errors.length > 0
          ? {
              process: processResult.errors,
              create: createResult.errors,
            }
          : undefined,
    });
  } catch (error) {
    console.error("[Auto-Markets Cron] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Failed to run auto-markets cron",
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
