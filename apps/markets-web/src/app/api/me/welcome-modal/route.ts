import { NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { prisma } from "@vault/database";

/**
 * POST /api/me/welcome-modal
 * 
 * Mark the welcome modal as seen for the current user.
 */
export async function POST() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update user to mark welcome modal as seen
    await prisma.user.update({
      where: { id: user.id },
      data: { hasSeenWelcomeModal: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating welcome modal status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

