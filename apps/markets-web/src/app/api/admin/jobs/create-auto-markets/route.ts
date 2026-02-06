import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import { createScheduledMarkets } from "@/lib/services/auto-market-service";

/**
 * POST /api/admin/jobs/create-auto-markets
 *
 * Manually trigger creation of scheduled auto-markets. Requires ADMIN role.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const startTime = Date.now();
    const result = await createScheduledMarkets();
    const durationMs = Date.now() - startTime;

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
    console.error("[Admin Jobs] create-auto-markets error:", error);
    return NextResponse.json(
      {
        error: "Failed to create auto-markets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
