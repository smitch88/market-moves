import { NextResponse } from "next/server";
import { getXPConfig } from "@/lib/services/xp-service";

/**
 * GET /api/xp/share-config
 * 
 * Get the share XP bonus configuration (public endpoint for UI display)
 */
export async function GET() {
  try {
    const config = await getXPConfig();

    return NextResponse.json({
      shareBonusPercent: config.shareBonusPercent,
      xpPerDollar: config.xpPerDollar,
    });
  } catch (error) {
    console.error("Error fetching share XP config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
