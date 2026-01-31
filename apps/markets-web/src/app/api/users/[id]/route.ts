import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { getUserStats } from "@/lib/services/stats-service";

/**
 * GET /api/users/[id]
 * 
 * Get public profile data for a user by their ID or handle.
 * This is a public endpoint - no authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || id.length < 1) {
      return NextResponse.json(
        { error: "User ID or handle is required" },
        { status: 400 }
      );
    }

    // Try to find user by ID first, then by handle
    let user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        createdAt: true,
        xp: true,
        isKOL: true,
      },
    });

    // If not found by ID, try by handle (case-insensitive)
    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          handle: {
            equals: id,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          handle: true,
          name: true,
          profileImageUrl: true,
          createdAt: true,
          xp: true,
          isKOL: true,
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get user stats
    const stats = await getUserStats(user.id);

    // Return public profile data
    return NextResponse.json({
      user: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        profileImageUrl: user.profileImageUrl,
        createdAt: user.createdAt.toISOString(),
        xp: user.xp,
        isKOL: user.isKOL,
      },
      stats: {
        realizedPnL: stats.realizedPnL,
        unrealizedPnL: stats.unrealizedPnL,
        totalPnL: stats.totalPnL,
        totalVolume: stats.totalVolume,
        largestWin: stats.largestWin,
        winRate: stats.winRate,
        totalBets: stats.totalBets,
        wonBets: stats.wonBets,
        lostBets: stats.lostBets,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
