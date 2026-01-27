import { prisma, TweetProofMethod } from "@vault/database";
import { twitterService, type Tweet } from "@vault/twitter-service";

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ============================================================================
// TYPES
// ============================================================================

export interface RequiredTweetParams {
  marketTitle: string;
  marketSlug: string;
  outcomeLabel?: string;
}

export interface TweetVerificationResult {
  verified: boolean;
  tweetId?: string;
  tweetUrl?: string;
  matchedText?: string;
  error?: string;
}

// ============================================================================
// TWEET CONTENT BUILDERS
// ============================================================================

/**
 * Build the required tweet text for verification
 */
export function buildRequiredTweetText(params: RequiredTweetParams): string {
  // Default prediction tweet copy
  return `I just predicted ${params.outcomeLabel || ""} for a chance to win 2027 Super Bowl tickets Predict here 👇`.trim();
}

/**
 * Build the market link for the tweet
 */
export function buildMarketLink(marketSlug: string): string {
  return `${APP_URL}/markets/${marketSlug}`;
}

/**
 * Build the full Twitter/X intent URL for sharing
 */
export function buildTweetIntentUrl(params: RequiredTweetParams): string {
  const text = buildRequiredTweetText(params);
  const link = buildMarketLink(params.marketSlug);
  const fullText = `${text} ${link}`;

  const intentUrl = new URL("https://twitter.com/intent/tweet");
  intentUrl.searchParams.set("text", fullText);

  return intentUrl.toString();
}

// ============================================================================
// CONTENT VERIFICATION
// ============================================================================

/**
 * Verify that tweet content matches expected requirements
 */
export function verifyTweetContent(
  tweetText: string,
  expectedContent: string,
  expectedLink: string
): { matches: boolean; hasContent: boolean; hasLink: boolean } {
  const normalizedTweet = tweetText.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedExpected = expectedContent.toLowerCase().replace(/\s+/g, " ").trim();

  
  

  // Check for content match (case-insensitive, whitespace-normalized)
  const hasContent = normalizedTweet.includes(normalizedExpected);

  // Check for link match (must contain the market URL)
  const hasLink = tweetText.toLowerCase().includes(expectedLink.toLowerCase());

  // Must have either content OR link for now (can be stricter later)
  const matches = hasContent || hasLink;

  return { matches, hasContent, hasLink };
}

// ============================================================================
// VERIFICATION SERVICE
// ============================================================================

/**
 * Verify tweet by scanning user's timeline
 */
export async function verifyTweetByTimeline(
  userId: string,
  marketId: string,
  twitterUserId: string,
  expectedContent: string,
  expectedLink: string
): Promise<TweetVerificationResult> {
  try {
    const tweets = await twitterService.getUserTweets(twitterUserId, 30);

    for (const tweet of tweets) {
      const { matches, hasContent, hasLink } = verifyTweetContent(
        tweet.text,
        expectedContent,
        expectedLink
      );

      if (matches) {
        // Store proof in database
        await prisma.tweetProof.create({
          data: {
            userId,
            marketId,
            method: TweetProofMethod.TIMELINE_SCAN,
            tweetId: tweet.tweetId,
            verified: true,
            matchedText: tweet.text.slice(0, 500),
            verifiedAt: new Date(),
            raw: JSON.parse(JSON.stringify({ tweet, hasContent, hasLink })),
          },
        });

        return {
          verified: true,
          tweetId: tweet.tweetId,
          tweetUrl: `https://x.com/${tweet.authorHandle}/status/${tweet.tweetId}`,
          matchedText: tweet.text,
        };
      }
    }

    return {
      verified: false,
      error: "Could not find matching tweet in user timeline",
    };
  } catch (error) {
    console.error("[TweetVerification] Timeline scan failed:", error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : "Timeline scan failed",
    };
  }
}

/**
 * Verify tweet by URL
 */
export async function verifyTweetByUrl(
  userId: string,
  marketId: string,
  tweetUrl: string,
  expectedContent: string,
  expectedLink: string
): Promise<TweetVerificationResult> {
  try {
    const tweetId = twitterService.extractTweetIdFromUrl(tweetUrl);
    if (!tweetId) {
      return {
        verified: false,
        error: "Invalid tweet URL",
      };
    }

    if (process.env.NODE_ENV === "development") {
      return { verified: true, tweetId: tweetId, tweetUrl: tweetUrl, matchedText: "DEV-TEST" };
    }

    const tweet = await twitterService.getTweetById(tweetId);
    if (!tweet) {
      return {
        verified: false,
        error: "Tweet not found",
      };
    }

    const { matches, hasContent, hasLink } = verifyTweetContent(
      tweet.text,
      expectedContent,
      expectedLink
    );

    // Store proof in database (even if not verified)
    await prisma.tweetProof.create({
      data: {
        userId,
        marketId,
        method: TweetProofMethod.TWEET_URL,
        tweetUrl,
        tweetId: tweet.tweetId,
        verified: matches,
        matchedText: tweet.text.slice(0, 500),
        verifiedAt: matches ? new Date() : null,
        raw: JSON.parse(JSON.stringify({ tweet, hasContent, hasLink })),
      },
    });

    if (!matches) {
      return {
        verified: false,
        tweetId: tweet.tweetId,
        tweetUrl,
        matchedText: tweet.text,
        error: "Tweet does not contain required content or market link",
      };
    }

    return {
      verified: true,
      tweetId: tweet.tweetId,
      tweetUrl,
      matchedText: tweet.text,
    };
  } catch (error) {
    console.error("[TweetVerification] URL verification failed:", error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Check if user has already verified a tweet for a market
 */
export async function hasVerifiedTweet(userId: string, marketId: string): Promise<boolean> {
  const existing = await prisma.tweetProof.findFirst({
    where: {
      userId,
      marketId,
      verified: true,
    },
  });

  return !!existing;
}

/**
 * Get user's tweet proof for a market
 */
export async function getTweetProof(userId: string, marketId: string) {
  return prisma.tweetProof.findFirst({
    where: {
      userId,
      marketId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
