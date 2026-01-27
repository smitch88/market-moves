import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const filter = searchParams.get("filter") || "featured";
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const markets = await prisma.market.findMany({
      where: {
        status: { in: ["PUBLISHED", "OPEN"] },
        ...(query && {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { question: { contains: query, mode: "insensitive" } },
          ],
        }),
        ...(category && { category: category as never }),
      },
      include: {
        outcomes: true,
        _count: {
          select: { bets: { where: { status: "CONFIRMED" } } },
        },
      },
      orderBy: getOrderBy(filter),
      take: Math.min(limit, 50),
    });

    return NextResponse.json({ markets });
  } catch (error) {
    console.error("Error fetching markets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getOrderBy(filter: string) {
  switch (filter) {
    case "trending":
      return [{ bets: { _count: "desc" as const } }];
    case "ending":
      return [{ closesAt: "asc" as const }];
    case "new":
      return [{ publishedAt: "desc" as const }];
    default:
      return [{ publishedAt: "desc" as const }];
  }
}
