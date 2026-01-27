import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { Header } from "@/components/layout/header";
import { MarketDetail } from "@/components/markets/market-detail";
import { MarketDetailSkeleton } from "@/components/markets/market-detail-skeleton";
import type { Metadata } from "next";

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

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Suspense fallback={<MarketDetailSkeleton />}>
          <MarketDetail event={event} />
        </Suspense>
      </main>
    </div>
  );
}
