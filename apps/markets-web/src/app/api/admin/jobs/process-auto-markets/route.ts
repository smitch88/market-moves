import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import { processExpiredMarkets } from "@/lib/services/auto-market-service";

/**
 * POST /api/admin/jobs/process-auto-markets
 *
 * Manually trigger close/resolve/settle of expired auto-markets. Requires ADMIN role.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const startTime = Date.now();
    const result = await processExpiredMarkets();
    const durationMs = Date.now() - startTime;

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
    console.error("[Admin Jobs] process-auto-markets error:", error);
    return NextResponse.json(
      {
        error: "Failed to process auto-markets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;
