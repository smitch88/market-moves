import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import {
  processExpiredMarkets,
  createScheduledMarkets,
} from "@/lib/services/auto-market-service";

/**
 * POST /api/admin/jobs/auto-markets
 *
 * Manually trigger auto-markets cron job. Requires ADMIN role.
 * 1. First processes expired markets (close → resolve → settle)
 * 2. Then creates new markets for active configs
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const startTime = Date.now();

    // Run both in parallel for faster execution
    const [processResult, createResult] = await Promise.all([
      processExpiredMarkets(),
      createScheduledMarkets(),
    ]);

    const durationMs = Date.now() - startTime;

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
    console.error("[Admin Jobs] auto-markets error:", error);
    return NextResponse.json(
      {
        error: "Failed to run auto-markets job",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;
