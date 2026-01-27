import { NextRequest, NextResponse } from "next/server";
import { prisma, TweetProofMethod } from "@vault/database";
import { requireUser } from "@vault/auth";
import {
  buildTweetIntentUrl,
  buildRequiredTweetText,
  buildMarketLink,
} from "@/lib/services/tweet-verification";
import { z } from "zod";

const intentSchema = z.object({
  marketId: z.string(),
  betId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { marketId, betId } = intentSchema.parse(body);

    // Get market details with event
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { 
        id: true, 
        question: true,
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

    // Build the intent URL using event slug
    const intentUrl = buildTweetIntentUrl({
      marketTitle: market.event.title,
      marketSlug: market.event.slug,
    });

    // Create a pending tweet proof record
    const tweetProof = await prisma.tweetProof.create({
      data: {
        userId: user.id,
        marketId: market.id,
        method: TweetProofMethod.TIMELINE_SCAN,
        verified: false,
      },
    });

    // If a bet ID was provided, link it to this proof
    if (betId) {
      await prisma.bet.update({
        where: { id: betId },
        data: { tweetProofId: tweetProof.id },
      });
    }

    return NextResponse.json({
      intentUrl,
      proofId: tweetProof.id,
      requiredText: buildRequiredTweetText({
        marketTitle: market.event.title,
        marketSlug: market.event.slug,
      }),
      marketLink: buildMarketLink(market.event.slug),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating tweet intent:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
