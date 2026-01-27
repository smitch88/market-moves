import { Skeleton } from "@vault/ui";

export function MarketGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}

function MarketCardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      {/* Header with logo and title */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-5 w-full rounded" />
        </div>
      </div>

      {/* Outcome prices */}
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
      </div>

      {/* Footer meta */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  );
}
