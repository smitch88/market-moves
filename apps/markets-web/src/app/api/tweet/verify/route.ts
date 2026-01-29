import { NextRequest, NextResponse } from "next/server";
import { prisma, BetStatus } from "@vault/database";
import { requireUser } from "@vault/auth";
import { twitterService } from "@vault/twitter-service";
import {
  buildRequiredTweetText,
  buildMarketLink,
  verifyTweetByTimeline,
  verifyTweetByUrl,
} from "@/lib/services/tweet-verification";
import { tradeService } from "@/lib/services/trade-service";
import { z } from "zod";

const verifySchema = z.object({
  marketId: z.string(),
  betId: z.string(),
  method: z.enum(["timeline", "url"]),
  tweetUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { marketId, betId, method, tweetUrl } = verifySchema.parse(body);

    // Get market details with event
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { 
        id: true, 
        question: true,
        eventId: true,
        reserve0: true,
        reserve1: true,
        k: true,
        feeBps: true,
        event: {
          select: {
            slug: true,
            title: true,
          },
        },
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Get the bet
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: { user: true },
    });

    if (!bet || bet.userId !== user.id) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (bet.status !== "PENDING_TWEET") {
      return NextResponse.json({ error: "Bet already verified or rejected" }, { status: 400 });
    }

    // Get required tweet content (use event slug for the link)
    const requiredText = buildRequiredTweetText({
      marketTitle: market.event.title,
      marketSlug: market.event.slug,
    });
    const marketLink = buildMarketLink(market.event.slug);

    let verificationResult: { verified: boolean; tweetId?: string; matchedText?: string; error?: string };

    if (method === "url" && tweetUrl) {
      // Verify by tweet URL
      verificationResult = await verifyTweetByUrl(
        user.id,
        market.id,
        tweetUrl,
        requiredText,
        marketLink
      );
    } else {
      // Verify by timeline scan
      // We need the user's Twitter ID - get from their profile
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
        market.id,
        twitterUserId,
        requiredText,
        marketLink
      );
    }

    if (verificationResult.verified) {
      // Update bet status to confirmed and execute trade
      await prisma.$transaction(async (tx) => {
        // Update bet status
        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: BetStatus.CONFIRMED,
            confirmedAt: new Date(),
          },
        });

        const isOutcome0 = bet.outcomeIndex === 0;

        // Execute CPMM share purchase using trade service
        const fullMarket = await tx.market.findUnique({
          where: { id: market.id },
        });

        if (fullMarket) {
          await tradeService.executeBuy(tx, bet, fullMarket);
        }

        // Check if this is user's first confirmed bet and handle referral
        const userBetCount = await tx.bet.count({
          where: {
            userId: user.id,
            status: BetStatus.CONFIRMED,
          },
        });

        if (userBetCount === 1) {
          // First confirmed bet - qualify referral if exists
          const referral = await tx.referral.findUnique({
            where: { referredUserId: user.id },
          });

          if (referral && !referral.qualifiedAt) {
            await tx.referral.update({
              where: { id: referral.id },
              data: { qualifiedAt: new Date() },
            });
          }
        }
      });

      return NextResponse.json({
        verified: true,
        tweetId: verificationResult.tweetId,
        message: "Tweet verified successfully!",
      });
    } else {
      return NextResponse.json({
        verified: false,
        message: verificationResult.error || "Tweet not found or does not match required content",
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error verifying tweet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
