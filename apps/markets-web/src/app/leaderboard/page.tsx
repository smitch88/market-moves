import { Suspense } from "react";
import { prisma } from "@vault/database";
import { Header } from "@/components/layout/header";
import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";
import { LeaderboardSkeleton } from "@/components/leaderboard/leaderboard-skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leaderboard | Vault Markets",
  description: "Top predictors on Vault Markets",
};

async function getLeaderboardData() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      handle: true,
      name: true,
      profileImageUrl: true,
      balance: true,
    },
    orderBy: {
      balance: "desc",
    },
    take: 50,
  });

  return users.map((user, index) => ({
    rank: index + 1,
    ...user,
  }));
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboardData();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={<LeaderboardSkeleton />}>
          <LeaderboardContent leaderboard={leaderboard} />
        </Suspense>
      </main>
    </div>
  );
}
