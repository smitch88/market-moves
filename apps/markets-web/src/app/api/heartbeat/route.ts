import { NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { prisma } from "@vault/database";

// Throttle: Only update lastSeenAt if it's been more than 1 minute since last update
const THROTTLE_MS = 60 * 1000; // 1 minute

/**
 * POST /api/heartbeat
 *
 * Updates the user's lastSeenAt timestamp for activity tracking.
 * Throttled to prevent excessive database writes.
 */
export async function POST() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Check if we should update (throttle check)
    if (user.lastSeenAt) {
      const lastSeenTime = new Date(user.lastSeenAt).getTime();
      const timeSinceLastSeen = now.getTime() - lastSeenTime;

      if (timeSinceLastSeen < THROTTLE_MS) {
        // Skip update, too recent
        return NextResponse.json({ success: true, throttled: true });
      }
    }

    // Update lastSeenAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: now },
    });

    return NextResponse.json({ success: true, throttled: false });
  } catch (error) {
    console.error("Error updating heartbeat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
