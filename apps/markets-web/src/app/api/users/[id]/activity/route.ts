import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireUser } from "@vault/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Users can only view their own activity
    if (user.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [bets, positions] = await Promise.all([
      prisma.bet.findMany({
        where: { userId: id },
        include: {
          market: {
            select: { 
              question: true,
              outcomes: true,
              event: {
                select: {
                  slug: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.position.findMany({
        where: { userId: id },
        include: {
          market: {
            select: { 
              question: true, 
              status: true,
              outcomes: true,
              event: {
                select: {
                  slug: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: { lastBetAt: "desc" },
      }),
    ]);

    // Transform bets to include outcome labels
    const transformedBets = bets.map((bet) => {
      const outcomes = JSON.parse(bet.market.outcomes) as string[];
      return {
        ...bet,
        outcomeLabel: outcomes[bet.outcomeIndex],
      };
    });

    return NextResponse.json({ bets: transformedBets, positions });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching user activity:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
