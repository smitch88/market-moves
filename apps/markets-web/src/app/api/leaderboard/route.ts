import { NextResponse } from "next/server";
import { prisma } from "@vault/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        balance: true,
      },
      orderBy: {
        balance: "desc",
      },
      take: 50,
    });

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      ...user,
    }));

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
