import { Skeleton, GlassCard, GlassCardContent, GlassCardHeader } from "@vault/ui";

export function MarketDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Back button */}
      <Skeleton className="h-5 w-20 mb-6 rounded" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard>
            {/* Banner */}
            <Skeleton className="h-48 w-full rounded-t-xl" />
            
            <GlassCardHeader>
              <div className="flex items-start gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-7 w-4/5 rounded-lg" />
                </div>
              </div>
            </GlassCardHeader>
            
            <GlassCardContent>
              {/* Odds display */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 text-center space-y-2">
                  <Skeleton className="h-8 w-14 mx-auto rounded-lg" />
                  <Skeleton className="h-4 w-16 mx-auto rounded" />
                </div>
                <Skeleton className="flex-1 h-2 rounded-full" />
                <div className="flex-1 text-center space-y-2">
                  <Skeleton className="h-8 w-14 mx-auto rounded-lg" />
                  <Skeleton className="h-4 w-16 mx-auto rounded" />
                </div>
              </div>
              
              {/* Meta info */}
              <div className="flex gap-6">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Details card */}
          <GlassCard>
            <GlassCardHeader>
              <Skeleton className="h-5 w-14 rounded" />
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-11/12 rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Betting panel */}
          <GlassCard>
            <GlassCardContent className="pt-6 space-y-4">
              <Skeleton className="h-5 w-28 rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 flex-1 rounded-lg" />
              </div>
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </GlassCardContent>
          </GlassCard>

          {/* Activity feed */}
          <GlassCard>
            <GlassCardContent className="pt-6 space-y-4">
              <Skeleton className="h-4 w-16 rounded" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-3 w-28 rounded" />
                  </div>
                </div>
              ))}
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
