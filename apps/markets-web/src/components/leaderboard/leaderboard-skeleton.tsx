import { Skeleton } from "@vault/ui";

export function LeaderboardSkeleton() {
  return (
    <div className="flex-1 min-w-0">
      {/* Title */}
      <Skeleton className="h-8 w-40 mb-6 rounded-lg" />

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      {/* Search Input */}
      <Skeleton className="h-10 w-full mb-4 rounded-lg" />

      {/* Table Header */}
      <div className="flex items-center px-4 py-2 border-b border-border/30">
        <div className="w-16" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Leaderboard Entries */}
      <div className="divide-y divide-border/20">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center px-4 py-3">
            {/* Rank */}
            <Skeleton className="h-4 w-6 mr-2" />

            {/* Avatar */}
            <Skeleton className="h-10 w-10 rounded-full mr-3" />

            {/* Name */}
            <div className="flex-1">
              <Skeleton className="h-5 w-32 rounded" />
            </div>

            {/* Value */}
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
