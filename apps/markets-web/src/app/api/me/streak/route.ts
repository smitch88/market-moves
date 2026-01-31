import { NextResponse } from "next/server";
import { requireUser } from "@vault/auth";
import { getUserStreakInfo } from "@/lib/services/streak-service";

/**
 * GET /api/me/streak
 * Get current user's streak information including badges
 */
export async function GET() {
  try {
    const user = await requireUser();

    const streakInfo = await getUserStreakInfo(user.id);

    return NextResponse.json(streakInfo);
  } catch (error) {
    console.error("Error fetching streak info:", error);
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch streak info" },
      { status: 500 }
    );
  }
}
