import { Skeleton } from "@vault/ui";

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-48 mb-2 rounded-lg" />
        <Skeleton className="h-5 w-64 rounded-lg" />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-11 w-[280px] rounded-xl" />
        <Skeleton className="h-11 w-[160px] rounded-xl" />
        <Skeleton className="h-11 w-[200px] rounded-xl" />
      </div>

      {/* Table Header */}
      <div className="flex items-center px-4 py-2 border-b border-border/30">
        <div className="w-12" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-12 hidden sm:block" />
        <Skeleton className="h-4 w-16 ml-4" />
      </div>

      {/* List Entries */}
      <div className="divide-y divide-border/20">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="flex items-center px-4 py-3">
            {/* Rank */}
            <div className="w-12">
              <Skeleton className="h-5 w-6" />
            </div>

            {/* Avatar + Name */}
            <div className="flex-1 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-5 w-32 mb-1 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>

            {/* Level */}
            <div className="w-16 hidden sm:flex justify-center">
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>

            {/* Value */}
            <div className="w-28 flex justify-end">
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
