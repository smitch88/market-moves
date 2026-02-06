import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/auto-markets/[configId]/latest
 * Returns the latest (most recently created) market for a given auto-market config.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const { configId } = await params;

  if (!configId) {
    return NextResponse.json({ error: "Missing configId" }, { status: 400 });
  }

  // Find the most recent market for this config that is published
  const latestMarket = await prisma.market.findFirst({
    where: {
      autoMarketConfigId: configId,
      isPublished: true,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      question: true,
      status: true,
      closesAt: true,
      event: {
        select: {
          slug: true,
          title: true,
        },
      },
    },
  });

  if (!latestMarket) {
    return NextResponse.json({ error: "No market found" }, { status: 404 });
  }

  return NextResponse.json({
    marketId: latestMarket.id,
    question: latestMarket.question,
    status: latestMarket.status,
    closesAt: latestMarket.closesAt?.toISOString() ?? null,
    eventSlug: latestMarket.event.slug,
    eventTitle: latestMarket.event.title,
  });
}
