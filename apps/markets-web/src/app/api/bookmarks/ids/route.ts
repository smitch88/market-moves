import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireUser } from "@vault/auth";

// GET /api/bookmarks/ids - Get all bookmarked event IDs for current user
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      select: { eventId: true },
    });

    const eventIds = bookmarks.map((b) => b.eventId);

    return NextResponse.json({ eventIds });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching bookmark IDs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
