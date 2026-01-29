import { Suspense } from "react";
import { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";
import { LeaderboardSkeleton } from "@/components/leaderboard/leaderboard-skeleton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard | Vault Markets",
  description:
    "See the top predictors on Vault Markets. Compete for XP and climb the ranks with accurate predictions.",
  openGraph: {
    title: "Leaderboard | Vault Markets",
    description:
      "See the top predictors on Vault Markets. Compete for XP and climb the ranks.",
    type: "website",
  },
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={<LeaderboardSkeleton />}>
          <LeaderboardContent />
        </Suspense>
      </main>
    </div>
  );
}
