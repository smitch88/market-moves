import { Skeleton, GlassCard, GlassCardContent } from "@vault/ui";

export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <GlassCard>
        <GlassCardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <Skeleton className="h-24 w-24 rounded-full" />
            
            {/* User info */}
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-40 rounded-lg" />
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            
            {/* Balance */}
            <div className="text-center space-y-2">
              <Skeleton className="h-3 w-14 mx-auto rounded" />
              <Skeleton className="h-9 w-20 mx-auto rounded-lg" />
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border/30">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-7 w-10 mx-auto rounded-lg" />
                <Skeleton className="h-3 w-14 mx-auto rounded" />
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Tabs */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-44 rounded-lg" />
        
        <GlassCard>
          <GlassCardContent className="pt-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-28 rounded" />
                </div>
              </div>
            ))}
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
