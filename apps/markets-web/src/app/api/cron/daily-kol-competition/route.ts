import { NextRequest, NextResponse } from "next/server";
import {
  runDailyKOLCompetition,
  calculateAndAwardKOLMarketVolumeXP,
  type CompetitionResult,
  type DailyKOLMarketVolumeResults,
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

    console.log("[Cron] Starting daily KOL tasks...");
    const startTime = Date.now();

    // Run the competition for yesterday (the day that just ended)
    console.log("[Cron] Running daily KOL competition...");
    const competitionResult: CompetitionResult = await runDailyKOLCompetition();

    // Run captain market volume XP distribution
    console.log("[Cron] Running captain market volume XP distribution...");
    const volumeResult: DailyKOLMarketVolumeResults = await calculateAndAwardKOLMarketVolumeXP();

    const duration = Date.now() - startTime;

    console.log("[Cron] Daily KOL tasks completed", {
      date: competitionResult.date.toISOString(),
      competition: {
        winner: competitionResult.winner?.kolUserId || "none",
        totalXpDistributed: competitionResult.totalXpDistributed,
        followersRewarded: competitionResult.followersRewarded,
        participantCount: competitionResult.allParticipants.length,
      },
      marketVolume: {
        captainsRewarded: volumeResult.results.filter(r => r.xpAwarded > 0).length,
        totalXpDistributed: volumeResult.totalXpDistributed,
      },
      durationMs: duration,
    });

    const totalXpDistributed = competitionResult.totalXpDistributed + volumeResult.totalXpDistributed;

    return NextResponse.json({
      success: true,
      message: competitionResult.winner
        ? `Competition complete! Winner: ${competitionResult.winner.name || competitionResult.winner.handle || competitionResult.winner.kolUserId}`
        : "Competition complete. No winner (no KOL had follower activity).",
      summary: {
        date: competitionResult.date.toISOString().split("T")[0],
        competition: {
          winner: competitionResult.winner
            ? {
                id: competitionResult.winner.kolUserId,
                name: competitionResult.winner.name || competitionResult.winner.handle,
                followerVolume: competitionResult.winner.followerVolume,
                followerPnL: competitionResult.winner.followerPnL,
                xpAwarded: competitionResult.winner.xpAwarded,
              }
            : null,
          totalParticipants: competitionResult.allParticipants.length,
          followersRewarded: competitionResult.followersRewarded,
          xpDistributed: competitionResult.totalXpDistributed,
        },
        marketVolume: {
          captainsRewarded: volumeResult.results.filter(r => r.xpAwarded > 0).length,
          topCaptains: volumeResult.results
            .filter(r => r.xpAwarded > 0)
            .sort((a, b) => b.xpAwarded - a.xpAwarded)
            .slice(0, 5)
            .map(r => ({
              id: r.kolUserId,
              name: r.name || r.handle,
              volume: r.dailyVolume,
              xpAwarded: r.xpAwarded,
            })),
          xpDistributed: volumeResult.totalXpDistributed,
        },
        totalXpDistributed,
        durationMs: duration,
      },
    });
  } catch (error) {
    // Handle "already run" error gracefully - still try to run market volume XP
    if (error instanceof Error && error.message.includes("already run")) {
      console.log("[Cron] Competition already run for this date:", error.message);
      
      // Still try to run market volume XP distribution
      try {
        console.log("[Cron] Running captain market volume XP distribution...");
        const volumeResult = await calculateAndAwardKOLMarketVolumeXP();
        
        return NextResponse.json({
          success: true,
          message: error.message,
          competitionSkipped: true,
          marketVolume: {
            captainsRewarded: volumeResult.results.filter(r => r.xpAwarded > 0).length,
            xpDistributed: volumeResult.totalXpDistributed,
          },
        });
      } catch (volumeError) {
        console.error("[Cron] Market volume XP distribution failed:", volumeError);
        return NextResponse.json({
          success: true,
          message: error.message,
          competitionSkipped: true,
          marketVolumeError: volumeError instanceof Error ? volumeError.message : "Unknown error",
        });
      }
    }

    console.error("[Cron] Daily KOL tasks failed:", error);
    return NextResponse.json(
      {
        error: "Failed to run daily KOL tasks",
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
