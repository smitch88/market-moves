import { Header } from "@/components/layout/header";
import { LeaderboardSkeleton } from "@/components/leaderboard/leaderboard-skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <LeaderboardSkeleton />
      </main>
    </div>
  );
}
