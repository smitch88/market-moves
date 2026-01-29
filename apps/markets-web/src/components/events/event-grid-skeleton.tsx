import { Skeleton } from "@vault/ui";

export function EventGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-sm border border-border/40 shadow-lg">
          {/* Banner skeleton */}
          <Skeleton className="h-36 w-full rounded-none" />
          
          {/* Content skeleton */}
          <div className="p-5 space-y-4">
            {/* Title */}
            <Skeleton className="h-6 w-4/5" />
            
            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            
            {/* Stats */}
            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
