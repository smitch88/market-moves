import { NextRequest, NextResponse } from "next/server";
import {
  runDailyKOLCompetition,
  type CompetitionResult,
} from "@/lib/services/kol-competition-service";

/**
 * POST /api/cron/daily-kol-competition
 * 
 * Vercel Cron Job endpoint - runs daily at midnight UTC
 * Calculates the winning KOL and distributes XP bonuses
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
        console.error("CRON_SECRET not configured");
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 }
        );
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("Unauthorized cron attempt");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    console.log("[Cron] Starting daily KOL competition...");
    const startTime = Date.now();

    // Run the competition for yesterday (the day that just ended)
    const result: CompetitionResult = await runDailyKOLCompetition();

    const duration = Date.now() - startTime;

    console.log("[Cron] Daily KOL competition completed", {
      date: result.date.toISOString(),
      winner: result.winner?.kolUserId || "none",
      totalXpDistributed: result.totalXpDistributed,
      followersRewarded: result.followersRewarded,
      participantCount: result.allParticipants.length,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      message: result.winner
        ? `Competition complete! Winner: ${result.winner.name || result.winner.handle || result.winner.kolUserId}`
        : "Competition complete. No winner (no KOL had follower activity).",
      summary: {
        date: result.date.toISOString().split("T")[0],
        winner: result.winner
          ? {
              id: result.winner.kolUserId,
              name: result.winner.name || result.winner.handle,
              followerVolume: result.winner.followerVolume,
              followerPnL: result.winner.followerPnL,
              xpAwarded: result.winner.xpAwarded,
            }
          : null,
        totalParticipants: result.allParticipants.length,
        followersRewarded: result.followersRewarded,
        totalXpDistributed: result.totalXpDistributed,
        durationMs: duration,
      },
    });
  } catch (error) {
    // Handle "already run" error gracefully
    if (error instanceof Error && error.message.includes("already run")) {
      console.log("[Cron] Competition already run for this date:", error.message);
      return NextResponse.json({
        success: true,
        message: error.message,
        skipped: true,
      });
    }

    console.error("[Cron] Daily KOL competition failed:", error);
    return NextResponse.json(
      {
        error: "Failed to run competition",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers from admin
export async function POST(request: NextRequest) {
  return GET(request);
}

// Vercel cron configuration
export const maxDuration = 60; // Allow up to 60 seconds for the cron job
export const dynamic = "force-dynamic";
