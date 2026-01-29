"use client";

import { Skeleton } from "@vault/ui";

/**
 * Skeleton for the profile header card
 */
export function ProfileHeaderCardSkeleton() {
  return (
    <div className="border border-border rounded-xl p-5">
      <div className="flex items-start gap-4 mb-6">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-6 pt-4 border-t border-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the P&L chart card
 */
export function PnLChartSkeleton() {
  return (
    <div className="border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-[120px] w-full" />
    </div>
  );
}

/**
 * Full profile content skeleton with header cards and tabs
 */
export function ProfileContentSkeleton() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ProfileHeaderCardSkeleton />
        <PnLChartSkeleton />
      </div>
      <Skeleton className="h-10 w-full mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

