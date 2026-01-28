import { Suspense } from "react";
import {
  EventGrid,
  EventGridSkeleton,
  FeaturedEvents,
  FeaturedEventsSkeleton,
} from "@/components/events";
import { Header } from "@/components/layout/header";
import { MarketFilters } from "@/components/markets/market-filters";

interface HomePageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    category?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const { q, sort, category } = params;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Featured Events Banner */}
        <Suspense fallback={<FeaturedEventsSkeleton />}>
          <FeaturedEvents />
        </Suspense>

        {/* Filters - horizontal bar */}
        <div className="mb-6">
          <Suspense>
            <MarketFilters />
          </Suspense>
        </div>

        {/* Events Grid */}
        <Suspense fallback={<EventGridSkeleton />}>
          <EventGrid sort={sort} category={category} query={q} />
        </Suspense>
      </main>
    </div>
  );
}
