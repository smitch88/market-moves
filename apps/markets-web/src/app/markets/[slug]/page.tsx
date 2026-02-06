import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma, MarketCategory, EventType } from "@vault/database";
import { Header } from "@/components/layout/header";
import { MarketDetail } from "@/components/markets/market-detail";
import { MarketDetailSkeleton } from "@/components/markets/market-detail-skeleton";
import { MarketDetailErrorBoundary } from "@/components/markets/market-detail-error-boundary";
import { SportsEventView } from "@/components/sports";
import type { Metadata } from "next";

// Sports categories that should use the sports view
const SPORTS_CATEGORIES: MarketCategory[] = [
  "NFL",
  "NBA",
  "NHL",
  "MLB",
  "SOCCER",
  "UFC",
  "TENNIS",
  "GOLF",
];

// Event types that use the sports matchup view
const MATCHUP_EVENT_TYPES: EventType[] = ["MATCHUP"];

// Helper to serialize market data for client components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeMarket(market: any) {
  return {
    ...market,
    seed0: Number(market.seed0),
    seed1: Number(market.seed1),
    pool0: Number(market.pool0),
    pool1: Number(market.pool1),
    k: market.k ? Number(market.k) : null,
    reserve0: Number(market.reserve0),
    reserve1: Number(market.reserve1),
    openingPrice: market.openingPrice != null ? Number(market.openingPrice) : null,
    autoMarketConfigId: market.autoMarketConfigId ?? null,
    publishedAt: market.publishedAt?.toISOString() ?? null,
    opensAt: market.opensAt?.toISOString() ?? null,
    closesAt: market.closesAt?.toISOString() ?? null,
    resolvedAt: market.resolvedAt?.toISOString() ?? null,
    settledAt: market.settledAt?.toISOString() ?? null,
    createdAt: market.createdAt?.toISOString() ?? null,
    updatedAt: market.updatedAt?.toISOString() ?? null,
    _count: market._count ?? { bets: 0 },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeEvent(event: any) {
  return {
    ...event,
    startTime: event.startTime?.toISOString() ?? null,
    endTime: event.endTime?.toISOString() ?? null,
    createdAt: event.createdAt?.toISOString() ?? null,
    updatedAt: event.updatedAt?.toISOString() ?? null,
    markets: event.markets?.map(serializeMarket) ?? [],
  };
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await prisma.event.findFirst({
    where: { 
      slug,
      isPublished: true, // Only published events
    },
    select: { 
      title: true, 
      description: true,
      bannerUrl: true,
      markets: {
        where: { isPublished: true }, // Only published markets
        select: { question: true },
        take: 1,
      },
    },
  });

  if (!event) {
    return { title: "Event Not Found | Vault Markets" };
  }

  const title = event.title;
  const description = event.description || event.markets[0]?.question || `Predict the outcome of ${title} on Vault Markets`;
  
  // Build image array for Open Graph
  const images = event.bannerUrl 
    ? [{
        url: event.bannerUrl,
        width: 1200,
        height: 630,
        alt: title,
      }]
    : undefined;

  return {
    title: `${title} | Vault Markets`,
    description,
    openGraph: {
      type: "website",
      title: `${title} | Vault Markets`,
      description,
      images,
      siteName: "Vault777 Markets",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Vault Markets`,
      description,
      images: event.bannerUrl ? [event.bannerUrl] : undefined,
      creator: "@vault777",
    },
  };
}

export default async function MarketPage({ params }: PageProps) {
  const { slug } = await params;

  const event = await prisma.event.findFirst({
    where: { 
      slug,
      isPublished: true, // Only show published events
    },
    include: {
      tags: true,
      markets: {
        where: { isPublished: true }, // Only show published markets
        orderBy: { closesAt: "asc" },
        include: {
          _count: {
            select: { bets: true },
          },
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  // Serialize event data to convert Decimals to numbers for client components
  const serializedEvent = serializeEvent(event);

  // Determine view type based on category and event type
  const isSportsCategory = SPORTS_CATEGORIES.includes(event.category as MarketCategory);
  const isMatchupType = MATCHUP_EVENT_TYPES.includes(event.eventType as EventType);
  const useSportsView = isSportsCategory && isMatchupType;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <MarketDetailErrorBoundary>
          <Suspense fallback={<MarketDetailSkeleton />}>
            {useSportsView ? (
              <SportsEventView event={serializedEvent} />
            ) : (
              <MarketDetail event={serializedEvent} />
            )}
          </Suspense>
        </MarketDetailErrorBoundary>
      </main>
    </div>
  );
}
