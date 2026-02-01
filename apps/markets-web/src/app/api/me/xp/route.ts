import { NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { getUserXPInfo } from "@/lib/services/xp-service";

/**
 * GET /api/me/xp
 * 
 * Get the current user's XP and level information
 */
export async function GET() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get XP info from database
    const xpInfo = await getUserXPInfo(user.id);

    return NextResponse.json(xpInfo);
  } catch (error) {
    console.error("Error fetching XP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
