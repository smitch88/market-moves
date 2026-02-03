"use client";

import { useQuery } from "@tanstack/react-query";
import { GlassCard, GlassCardContent } from "@vault/ui";
import { Users, Loader2 } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";

interface ActiveUsersResponse {
  activeCount: number;
  breakdown: {
    "5min": number;
    "10min": number;
    "15min": number;
  };
  totalUsers: number;
  timestamp: string;
}

interface ActiveUsersCardProps {
  /** Fallback total user count (from server-side data) */
  fallbackTotalUsers?: number;
}

/**
 * Card component that displays active users count with polling.
 * Shows both "Live Now" count and total users.
 */
export function ActiveUsersCard({ fallbackTotalUsers }: ActiveUsersCardProps) {
  const { data, isLoading, isError } = useQuery<ActiveUsersResponse>({
    queryKey: ["admin-active-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/active-users");
      if (!res.ok) throw new Error("Failed to fetch active users");
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });

  const activeCount = data?.activeCount ?? 0;
  const totalUsers = data?.totalUsers ?? fallbackTotalUsers ?? 0;

  return (
    <GlassCard variant="solid">
      <GlassCardContent className="p-4 sm:pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-lg bg-muted text-chart-3 relative">
            <Users className="h-4 w-4 sm:h-6 sm:w-6" />
            {/* Pulsing dot indicator for live data */}
            {activeCount > 0 && !isLoading && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : isError ? (
              <>
                <p className="text-lg sm:text-2xl font-bold">{totalUsers}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Users</p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg sm:text-2xl font-bold">{activeCount}</p>
                  <span
                    className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      activeCount > 0
                        ? "bg-green-500/20 text-green-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    Live
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  of {totalUsers.toLocaleString()} users
                </p>
              </>
            )}
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
