import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

// Export leaderboard snapshot as CSV or JSON
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const sortBy = searchParams.get("sortBy") || "xp"; // xp, pnl, volume
    const limit = parseInt(searchParams.get("limit") || "1000", 10);

    // Determine sort order
    const orderBy: Record<string, "desc"> = {};
    switch (sortBy) {
      case "pnl":
        orderBy.realizedPnL = "desc";
        break;
      case "volume":
        orderBy.totalVolume = "desc";
        break;
      case "xp":
      default:
        orderBy.xp = "desc";
        break;
    }

    // Fetch users with all relevant data
    const users = await prisma.user.findMany({
      select: {
        id: true,
        twitterSubject: true,
        handle: true,
        name: true,
        email: true,
        xp: true,
        realizedPnL: true,
        totalVolume: true,
        balance: true,
        createdAt: true,
        _count: {
          select: {
            bets: { where: { status: "CONFIRMED" } },
            positions: true,
            tweetProofs: { where: { verified: true } },
          },
        },
      },
      orderBy,
      take: limit,
    });

    // Calculate rank
    const rankedUsers = users.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      twitterId: user.twitterSubject || "",
      handle: user.handle || "",
      name: user.name || "",
      email: user.email || "",
      xp: user.xp,
      realizedPnL: Number(user.realizedPnL),
      totalVolume: Number(user.totalVolume),
      balance: Number(user.balance),
      totalBets: user._count.bets,
      totalPositions: user._count.positions,
      verifiedTweets: user._count.tweetProofs,
      createdAt: user.createdAt.toISOString(),
    }));

    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    if (format === "json") {
      // Return JSON
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        exportedBy: admin.handle || admin.id,
        sortBy,
        totalUsers: rankedUsers.length,
        users: rankedUsers,
      }, {
        headers: {
          "Content-Disposition": `attachment; filename="vault-leaderboard-${timestamp}.json"`,
        },
      });
    }

    // Generate CSV
    const headers = [
      "Rank",
      "User ID",
      "Twitter ID",
      "Handle",
      "Name",
      "Email",
      "XP",
      "Realized PnL",
      "Total Volume",
      "Balance",
      "Total Bets",
      "Total Positions",
      "Verified Tweets",
      "Created At",
    ];

    const rows = rankedUsers.map((user) => [
      user.rank,
      user.userId,
      user.twitterId,
      user.handle,
      user.name,
      user.email,
      user.xp,
      user.realizedPnL.toFixed(4),
      user.totalVolume.toFixed(2),
      user.balance.toFixed(2),
      user.totalBets,
      user.totalPositions,
      user.verifiedTweets,
      user.createdAt,
    ]);

    // Escape CSV fields
    const escapeCSV = (value: string | number) => {
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="vault-leaderboard-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error exporting leaderboard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
