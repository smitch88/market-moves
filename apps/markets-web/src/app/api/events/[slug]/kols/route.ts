import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { getTopKOLsForEvent } from "@/lib/services/kol-service";

/**
 * GET /api/events/[slug]/kols
 * Get top KOLs who have placed bets on this event
 * 
 * Query params:
 * - limit: Number of KOLs to return (default: 5, max: 10)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    
    const limitParam = searchParams.get("limit");
    const limit = Math.min(10, Math.max(1, parseInt(limitParam || "5", 10)));

    // Find event by slug or id
    const event = await prisma.event.findFirst({
      where: {
        OR: [
          { slug },
          { id: slug },
        ],
      },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const kols = await getTopKOLsForEvent(event.id, limit);

    return NextResponse.json(
      { kols },
      {
        headers: {
          // Longer cache since this doesn't need to be as real-time
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching event KOLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOLs" },
      { status: 500 }
    );
  }
}
