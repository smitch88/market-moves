import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import {
  runDailyKOLCompetition,
  getDailyCompetitionHistory,
  type CompetitionResult,
} from "@/lib/services/kol-competition-service";

/**
 * POST /api/admin/kol-competition
 * Run the daily KOL competition (typically called by cron at midnight UTC)
 * 
 * Query params:
 * - date: Optional ISO date string to run competition for a specific date
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    let forDate: Date | undefined;
    if (dateParam) {
      forDate = new Date(dateParam);
      if (isNaN(forDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }
    }

    const result = await runDailyKOLCompetition(forDate);

    return NextResponse.json({
      success: true,
      result,
      message: result.winner
        ? `Competition complete! Winner: ${result.winner.name || result.winner.handle || result.winner.kolUserId}`
        : "Competition complete. No winner (no KOL had follower activity).",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes("already run")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error running KOL competition:", error);
    return NextResponse.json(
      { error: "Failed to run competition" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/kol-competition
 * Get recent competition history
 * 
 * Query params:
 * - days: Number of days of history to fetch (default: 7)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 7;

    const history = await getDailyCompetitionHistory(days);

    return NextResponse.json({ history });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching competition history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
