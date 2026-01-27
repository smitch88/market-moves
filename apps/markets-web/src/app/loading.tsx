import { MarketGridSkeleton } from "@/components/markets/market-grid-skeleton";
import { Header } from "@/components/layout/header";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 space-y-2">
          <div className="h-10 w-64 bg-muted/50 rounded animate-pulse" />
          <div className="h-6 w-96 bg-muted/30 rounded animate-pulse" />
        </div>
        <MarketGridSkeleton />
      </main>
    </div>
  );
}
