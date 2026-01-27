import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const market = await prisma.market.findUnique({
      where: { slug },
      include: {
        outcomes: true,
        bets: {
          where: { status: "CONFIRMED" },
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                name: true,
                profileImageUrl: true,
              },
            },
            outcome: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        positions: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                name: true,
                profileImageUrl: true,
                createdAt: true,
              },
            },
          },
          orderBy: [
            { amountOutcomeA: "desc" },
            { amountOutcomeB: "desc" },
          ],
          take: 20,
        },
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Calculate pool totals
    const poolA = market.seedA + market.positions.reduce((sum, p) => sum + p.amountOutcomeA, 0);
    const poolB = market.seedB + market.positions.reduce((sum, p) => sum + p.amountOutcomeB, 0);
    const totalPool = poolA + poolB;

    return NextResponse.json({
      market,
      stats: {
        poolA,
        poolB,
        totalPool,
        percentA: totalPool > 0 ? Math.round((poolA / totalPool) * 100) : 50,
        percentB: totalPool > 0 ? Math.round((poolB / totalPool) * 100) : 50,
        totalBets: market.bets.length,
      },
    });
  } catch (error) {
    console.error("Error fetching market:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
