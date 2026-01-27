import { MarketDetailSkeleton } from "@/components/markets/market-detail-skeleton";
import { Header } from "@/components/layout/header";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <MarketDetailSkeleton />
      </main>
    </div>
  );
}
