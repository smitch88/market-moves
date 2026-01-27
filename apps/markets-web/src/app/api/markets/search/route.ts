import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "8"), 20);

    if (!query || query.length < 2) {
      return NextResponse.json({ markets: [] });
    }

    const markets = await prisma.market.findMany({
      where: {
        status: { in: ["PUBLISHED", "OPEN"] },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { question: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        question: true,
        category: true,
        logoUrl: true,
        closesAt: true,
        outcomes: {
          select: {
            id: true,
            key: true,
            label: true,
          },
          take: 2,
        },
        _count: {
          select: { bets: true },
        },
      },
      orderBy: [
        { bets: { _count: "desc" } },
        { publishedAt: "desc" },
      ],
      take: limit,
    });

    return NextResponse.json({ 
      markets,
      query,
      count: markets.length,
    });
  } catch (error) {
    console.error("Error searching markets:", error);
    return NextResponse.json(
      { error: "Failed to search markets" },
      { status: 500 }
    );
  }
}
