import { Skeleton } from "@vault/ui";

export function EventGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="relative overflow-hidden rounded-lg border bg-white/5 backdrop-blur-md border-white/10 shadow-xl">
          {/* Banner skeleton */}
          <Skeleton className="h-32 w-full rounded-none" />
          
          {/* Content skeleton */}
          <div className="p-4 space-y-3">
            {/* Title */}
            <Skeleton className="h-6 w-3/4" />
            
            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            
            {/* Stats */}
            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
