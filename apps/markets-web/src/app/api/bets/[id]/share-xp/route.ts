import { NextRequest, NextResponse } from "next/server";
import { prisma, XPReason } from "@vault/database";
import { requireUser } from "@vault/auth";
import { twitterService } from "@vault/twitter-service";
import {
  buildRequiredTweetText,
  buildMarketLink,
  verifyTweetByTimeline,
  verifyTweetByUrl,
} from "@/lib/services/tweet-verification";
import { calculateLevel, getXPConfig } from "@/lib/services/xp-service";
import { updateUserStreak } from "@/lib/services/streak-service";
import { z } from "zod";

const shareXPSchema = z.object({
  method: z.enum(["timeline", "url"]),
  tweetUrl: z.string().optional(),
});

/**
 * POST /api/bets/[id]/share-xp
 * 
 * Verify a share tweet and award XP bonus.
 * Users can share their bet on X and verify to earn bonus XP.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: betId } = await params;
    const body = await request.json();

    const { method, tweetUrl } = shareXPSchema.parse(body);

    // Get the bet with market info
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: {
        market: {
          include: {
            event: {
              select: {
                slug: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    // Verify ownership
    if (bet.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if bet is confirmed (can only share confirmed bets)
    if (bet.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Can only share confirmed bets" },
        { status: 400 }
      );
    }

    // Check if user already claimed share XP for this bet
    // Use startsWith to match both old format (share-{betId}) and new format (share-{betId}-tweet-{tweetId})
    const existingClaim = await prisma.xPLedger.findFirst({
      where: {
        userId: user.id,
        reason: XPReason.SHARE_TWEET,
        correlationId: {
          startsWith: `share-${betId}`,
        },
      },
    });

    if (existingClaim) {
      return NextResponse.json(
        { error: "XP already claimed for this bet", alreadyClaimed: true },
        { status: 400 }
      );
    }

    // Build expected tweet content
    const requiredText = buildRequiredTweetText({
      marketTitle: bet.market.event.title,
      marketSlug: bet.market.event.slug,
    });
    const marketLink = buildMarketLink(bet.market.event.slug);

    let verificationResult;

    if (method === "url" && tweetUrl) {
      // Verify by tweet URL
      verificationResult = await verifyTweetByUrl(
        user.id,
        bet.marketId,
        tweetUrl,
        requiredText,
        marketLink
      );
    } else {
      // Verify by timeline scan
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { twitterSubject: true, handle: true },
      });

      if (!dbUser?.twitterSubject && !dbUser?.handle) {
        return NextResponse.json(
          { error: "Twitter account not linked", code: "NO_TWITTER" },
          { status: 400 }
        );
      }

      // Get Twitter user ID if we only have handle
      let twitterUserId = dbUser.twitterSubject;
      if (!twitterUserId && dbUser.handle) {
        const twitterUser = await twitterService.getUserByHandle(dbUser.handle);
        if (twitterUser) {
          twitterUserId = twitterUser.restId;
        }
      }

      if (!twitterUserId) {
        return NextResponse.json(
          { error: "Could not resolve Twitter account", code: "TWITTER_LOOKUP_FAILED" },
          { status: 400 }
        );
      }

      verificationResult = await verifyTweetByTimeline(
        user.id,
        bet.marketId,
        twitterUserId,
        requiredText,
        marketLink
      );
    }

    if (!verificationResult.verified) {
      return NextResponse.json({
        verified: false,
        message: verificationResult.error || "Tweet not found or does not match required content",
      });
    }

    // Check if this tweet has already been used for XP (prevent reusing the same tweet)
    if (verificationResult.tweetId) {
      const existingTweetXP = await prisma.xPLedger.findFirst({
        where: {
          reason: XPReason.SHARE_TWEET,
          correlationId: {
            endsWith: `-tweet-${verificationResult.tweetId}`,
          },
        },
      });

      if (existingTweetXP) {
        return NextResponse.json(
          { error: "This tweet has already been used for XP", tweetAlreadyUsed: true },
          { status: 400 }
        );
      }
    }

    // Get XP config for share bonus percentage
    const xpConfig = await getXPConfig();
    
    // Calculate XP bonus as percentage of bet amount
    const betAmount = Number(bet.amount);
    const xpBonus = Math.floor(betAmount * (xpConfig.shareBonusPercent / 100) * xpConfig.xpPerDollar);

    // Award XP bonus
    const result = await prisma.$transaction(async (tx) => {
      // Get current XP
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { xp: true },
      });

      if (!currentUser) {
        throw new Error("User not found");
      }

      const xpBefore = currentUser.xp;
      const xpAfter = xpBefore + xpBonus;

      // Update user XP
      await tx.user.update({
        where: { id: user.id },
        data: { xp: xpAfter },
      });

      // Create XP ledger entry (include tweetId in correlationId for deduplication)
      await tx.xPLedger.create({
        data: {
          userId: user.id,
          delta: xpBonus,
          xpBefore,
          xpAfter,
          reason: XPReason.SHARE_TWEET,
          correlationId: `share-${betId}-tweet-${verificationResult.tweetId}`,
        },
      });

      return { xpBefore, xpAfter };
    });

    const levelBefore = calculateLevel(result.xpBefore);
    const levelAfter = calculateLevel(result.xpAfter);

    // Update user's streak (claiming share XP counts as daily activity)
    const streakResult = await updateUserStreak(user.id);

    return NextResponse.json({
      verified: true,
      xpAwarded: xpBonus,
      newXp: result.xpAfter,
      newLevel: levelAfter,
      leveledUp: levelAfter > levelBefore,
      tweetId: verificationResult.tweetId,
      message: `+${xpBonus.toLocaleString()} XP for sharing!`,
      shareBonusPercent: xpConfig.shareBonusPercent,
      streak: {
        current: streakResult.newStreak,
        multiplier: streakResult.multiplier,
        isNewDay: streakResult.isNewDay,
        badgesAwarded: streakResult.badgesAwarded,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error verifying share for XP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

