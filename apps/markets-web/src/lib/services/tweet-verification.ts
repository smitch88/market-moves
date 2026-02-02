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
 * Extract the market path from a URL (e.g., "/markets/super-bowl-2027" from full URL)
 */
function extractMarketPath(url: string): string {
  try {
    // Try parsing as full URL first
    const parsed = new URL(url);
    return parsed.pathname; // e.g., "/markets/super-bowl-2027"
  } catch {
    // If not a valid URL, assume it's already a path or slug
    return url.startsWith("/") ? url : `/${url}`;
  }
}

/**
 * Verify that tweet content matches expected requirements
 * - Checks for content match (case-insensitive)
 * - Checks for link match using just the path/slug, ignoring base URL
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

  // Extract just the market path from the expected link (ignore base URL)
  // e.g., "https://vault.markets/markets/super-bowl" -> "/markets/super-bowl"
  const marketPath = extractMarketPath(expectedLink).toLowerCase();
  
  // Check if tweet contains the market path (works with any base URL)
  // This matches: vault.markets/markets/slug, localhost:3000/markets/slug, etc.
  const hasLink = tweetText.toLowerCase().includes(marketPath);

  // Must have either content OR link for now (can be stricter later)
  const matches = hasContent || hasLink;

  return { matches, hasContent, hasLink };
}

// ============================================================================
// VERIFICATION SERVICE
// ============================================================================

/**
 * Check if a tweet has already been used for XP
 */
async function isTweetAlreadyUsedForXP(tweetId: string): Promise<boolean> {
  const existing = await prisma.xPLedger.findFirst({
    where: {
      reason: "SHARE_TWEET",
      correlationId: {
        endsWith: `-tweet-${tweetId}`,
      },
    },
  });
  return !!existing;
}

/**
 * Verify tweet by scanning user's timeline
 * Skips tweets that have already been used for XP to find an unused one
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
    let foundUsedTweet = false;

    for (const tweet of tweets) {
      const { matches, hasContent, hasLink } = verifyTweetContent(
        tweet.text,
        expectedContent,
        expectedLink
      );

      if (matches) {
        // Check if this tweet was already used for XP
        const alreadyUsed = await isTweetAlreadyUsedForXP(tweet.tweetId);
        if (alreadyUsed) {
          foundUsedTweet = true;
          continue; // Skip this tweet and look for another one
        }

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

    // Provide a more helpful error message
    if (foundUsedTweet) {
      return {
        verified: false,
        error: "Found a matching tweet but it was already used for XP. Please share a new tweet!",
      };
    }

    return {
      verified: false,
      error: "No matching tweet found in user timeline",
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

    // Check if this tweet was already used for XP (before fetching tweet details)
    const alreadyUsed = await isTweetAlreadyUsedForXP(tweetId);
    if (alreadyUsed) {
      return {
        verified: false,
        error: "This tweet has already been used for XP. Please share a new tweet!",
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
