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
  const market = await prisma.market.findUnique({
    where: { slug },
    select: { title: true, question: true, bannerUrl: true },
  });

  if (!market) {
    return { title: "Market Not Found | Vault Markets" };
  }

  return {
    title: `${market.question || market.title} | Vault Markets`,
    description: market.question || market.title,
    openGraph: {
      title: market.question || market.title,
      description: `Predict the outcome on Vault Markets`,
      images: market.bannerUrl ? [market.bannerUrl] : undefined,
    },
  };
}

export default async function MarketPage({ params }: PageProps) {
  const { slug } = await params;

  const market = await prisma.market.findUnique({
    where: { slug },
    include: {
      outcomes: true,
    },
  });

  if (!market) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Suspense fallback={<MarketDetailSkeleton />}>
          <MarketDetail market={market} />
        </Suspense>
      </main>
    </div>
  );
}
