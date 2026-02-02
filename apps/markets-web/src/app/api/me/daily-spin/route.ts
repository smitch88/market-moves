import { NextResponse } from "next/server";
import { requireUser } from "@vault/auth";
import { 
  canUserSpin, 
  executeDailySpin, 
  getPrizeTiers,
  getUserSpinHistory 
} from "@/lib/services/daily-spin-service";
import { isFeatureEnabled, FeatureFlags } from "@/lib/services/feature-flag-service";

/**
 * GET /api/me/daily-spin
 * Check if user can spin today and get prize tier info
 */
export async function GET() {
  try {
    const user = await requireUser();
    
    // Check feature flag
    const featureEnabled = await isFeatureEnabled(FeatureFlags.DAILY_SPIN, user);
    if (!featureEnabled) {
      return NextResponse.json({
        canSpin: false,
        featureDisabled: true,
      });
    }
    
    const spinStatus = await canUserSpin(user.id);
    const prizeTiers = getPrizeTiers();
    const history = await getUserSpinHistory(user.id, 5);
    
    return NextResponse.json({
      ...spinStatus,
      prizeTiers,
      history: history.map(spin => ({
        ...spin,
        reward: Number(spin.reward),
      })),
    });
  } catch (error) {
    console.error("Error checking spin status:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to check spin status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/me/daily-spin
 * Execute a daily spin
 */
export async function POST() {
  try {
    const user = await requireUser();
    
    // Check feature flag
    const featureEnabled = await isFeatureEnabled(FeatureFlags.DAILY_SPIN, user);
    if (!featureEnabled) {
      return NextResponse.json(
        { error: "Daily spin is currently disabled" },
        { status: 403 }
      );
    }
    
    const result = await executeDailySpin(user.id);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          canSpinAt: result.canSpinAt,
        },
        { status: 429 } // Too Many Requests
      );
    }
    
    return NextResponse.json({
      success: true,
      reward: result.reward,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Error executing spin:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to execute spin" },
      { status: 500 }
    );
  }
}

