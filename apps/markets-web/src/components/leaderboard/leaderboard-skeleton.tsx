import { GlassCard, Skeleton } from "@vault/ui";

export function LeaderboardSkeleton() {
  return (
    <div className="max-w-md mx-auto">
      <Skeleton className="h-8 w-32 mx-auto mb-6 rounded-lg" />
      
      <GlassCard className="overflow-hidden">
        <div className="divide-y divide-border/20">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              {/* Rank */}
              <Skeleton className="h-5 w-6 rounded" />
              
              {/* Avatar */}
              <Skeleton className="h-10 w-10 rounded-full" />
              
              {/* Name */}
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24 rounded" />
                {i < 3 && <Skeleton className="h-3 w-16 rounded" />}
              </div>
              
              {/* Balance */}
              <Skeleton className="h-5 w-14 rounded" />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
