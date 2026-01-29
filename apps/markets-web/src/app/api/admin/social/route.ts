import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

// Get verified tweet proofs with XP boost info
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10))
    );
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;

    const skip = (page - 1) * pageSize;
    const take = limit || pageSize;

    // Get verified tweet proofs with user and market info
    const [verifications, total] = await Promise.all([
      prisma.tweetProof.findMany({
        where: {
          verified: true,
        },
        include: {
          user: {
            select: {
              id: true,
              handle: true,
              name: true,
              profileImageUrl: true,
              twitterSubject: true,
              xp: true,
            },
          },
          market: {
            select: {
              id: true,
              question: true,
              outcomes: true,
              event: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                },
              },
            },
          },
          bets: {
            where: {
              status: "CONFIRMED",
            },
            select: {
              id: true,
              amount: true,
              outcomeIndex: true,
              shares: true,
              createdAt: true,
            },
          },
        },
        orderBy: { verifiedAt: "desc" },
        skip: limit ? 0 : skip,
        take,
      }),
      prisma.tweetProof.count({
        where: { verified: true },
      }),
    ]);

    // Get XP ledger entries for SHARE_TWEET reason to match with verifications
    const xpEntries = await prisma.xPLedger.findMany({
      where: {
        reason: "SHARE_TWEET",
        userId: { in: verifications.map((v) => v.userId) },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map XP entries by correlationId (which should be the bet ID or tweet proof ID)
    const xpByCorrelation = new Map<string, number>();
    for (const entry of xpEntries) {
      if (entry.correlationId) {
        xpByCorrelation.set(entry.correlationId, entry.delta);
      }
    }

    // Transform data
    const socialVerifications = verifications.map((v) => {
      // Try to find XP earned for this verification
      let xpEarned = 0;
      
      // Check if any bet ID matches an XP entry
      for (const bet of v.bets) {
        if (xpByCorrelation.has(bet.id)) {
          xpEarned = xpByCorrelation.get(bet.id) || 0;
          break;
        }
      }
      
      // Also check by tweet proof ID
      if (xpEarned === 0 && xpByCorrelation.has(v.id)) {
        xpEarned = xpByCorrelation.get(v.id) || 0;
      }

      return {
        id: v.id,
        tweetUrl: v.tweetUrl,
        tweetId: v.tweetId,
        verified: v.verified,
        verifiedAt: v.verifiedAt,
        createdAt: v.createdAt,
        method: v.method,
        xpEarned,
        user: {
          id: v.user.id,
          handle: v.user.handle,
          name: v.user.name,
          avatarUrl: v.user.profileImageUrl,
          twitterId: v.user.twitterSubject,
          totalXp: v.user.xp,
        },
        market: {
          id: v.market.id,
          slug: v.market.event?.slug || v.market.id,
          question: v.market.question,
          outcomes: JSON.parse(v.market.outcomes),
          event: v.market.event,
        },
        bets: v.bets.map((bet: { id: string; amount: unknown; outcomeIndex: number; shares: unknown; createdAt: Date }) => ({
          id: bet.id,
          amount: Number(bet.amount),
          outcomeIndex: bet.outcomeIndex,
          shares: bet.shares ? Number(bet.shares) : null,
          createdAt: bet.createdAt,
        })),
      };
    });

    return NextResponse.json({
      verifications: socialVerifications,
      total,
      page: limit ? 1 : page,
      pageSize: limit || pageSize,
      totalPages: limit ? 1 : Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching social verifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
