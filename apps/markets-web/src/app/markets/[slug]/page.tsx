import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma, MarketCategory } from "@vault/database";
import { Header } from "@/components/layout/header";
import { MarketDetail } from "@/components/markets/market-detail";
import { MarketDetailSkeleton } from "@/components/markets/market-detail-skeleton";
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

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { 
      title: true, 
      bannerUrl: true,
      markets: {
        select: { question: true },
        take: 1,
      },
    },
  });

  if (!event) {
    return { title: "Event Not Found | Vault Markets" };
  }

  const question = event.markets[0]?.question || event.title;

  return {
    title: `${question} | Vault Markets`,
    description: question,
    openGraph: {
      title: question,
      description: `Predict the outcome on Vault Markets`,
      images: event.bannerUrl ? [event.bannerUrl] : undefined,
    },
  };
}

export default async function MarketPage({ params }: PageProps) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      tags: true,
      markets: {
        orderBy: { closesAt: "asc" },
      },
    },
  });

  if (!event) {
    notFound();
  }

  // Determine if this is a sports event
  const isSportsEvent = SPORTS_CATEGORIES.includes(event.category as MarketCategory);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Suspense fallback={<MarketDetailSkeleton />}>
          {isSportsEvent ? (
            <SportsEventView event={event} />
          ) : (
            <MarketDetail event={event} />
          )}
        </Suspense>
      </main>
    </div>
  );
}
