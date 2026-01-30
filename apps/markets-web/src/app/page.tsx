import { Suspense } from "react";
import {
  EventGrid,
  EventGridSkeleton,
  FeaturedEvents,
  FeaturedEventsSkeleton,
} from "@/components/events";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MarketFilters } from "@/components/markets/market-filters";

interface HomePageProps {
  searchParams: Promise<{
    q?: string;
    view?: string;
    category?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const { q, view, category, sortBy, sortDir } = params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Featured Events Banner */}
        <Suspense fallback={<FeaturedEventsSkeleton />}>
          <FeaturedEvents />
        </Suspense>

        {/* Filters - horizontal bar */}
        <Suspense>
          <MarketFilters />
        </Suspense>

        {/* Events Grid */}
        <Suspense fallback={<EventGridSkeleton />}>
          <EventGrid 
            view={view} 
            category={category} 
            query={q} 
            sortBy={sortBy}
            sortDir={sortDir}
          />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
