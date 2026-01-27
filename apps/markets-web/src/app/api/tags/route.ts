import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/tags
 * 
 * Polymarket-style tags endpoint for category discovery.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        slug: true,
        label: true,
        _count: {
          select: { events: true },
        },
      },
      orderBy: { label: "asc" },
      take: limit,
    });

    return NextResponse.json(
      tags.map((tag) => ({
        id: tag.id,
        slug: tag.slug,
        label: tag.label,
        eventCount: tag._count.events,
      }))
    );
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
