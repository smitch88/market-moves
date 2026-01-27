import { Suspense } from "react";
import { MarketGrid } from "@/components/markets/market-grid";
import { MarketGridSkeleton } from "@/components/markets/market-grid-skeleton";
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
      <main className="container mx-auto px-4 py-4 md:py-6">
        {/* Mobile filters - horizontal scroll */}
        <div className="lg:hidden mb-4">
          <Suspense>
            <MarketFilters />
          </Suspense>
        </div>

        {/* Main content with sidebar filters */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters sidebar - desktop only */}
          <aside className="hidden lg:block lg:w-48 flex-shrink-0">
            <div className="lg:sticky lg:top-20">
              <Suspense>
                <MarketFilters />
              </Suspense>
            </div>
          </aside>

          {/* Markets Grid */}
          <div className="flex-1 min-w-0">
            <Suspense fallback={<MarketGridSkeleton />}>
              <MarketGrid sort={sort} category={category} query={q} />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
