"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Input,
  Button,
} from "@vault/ui";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Gift,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
} from "lucide-react";
import Link from "next/link";

export default function AdminDailySpinsPage() {
  const [userSearch, setUserSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<string>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["adminDailySpins", userSearch, sortBy, sortDir, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userSearch) params.set("userId", userSearch);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/daily-spins?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch daily spins");
      return res.json();
    },
  });

  const spins = data?.spins || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const currentPage = data?.page || page;
  const stats = data?.stats;

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDir === "desc"
      ? <ArrowDown className="h-3 w-3 ml-1" />
      : <ArrowUp className="h-3 w-3 ml-1" />;
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Gift className="h-7 w-7 text-primary" />
          Daily Spins
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">Monitor daily spin activity and rewards</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <GlassCard variant="solid">
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Today&apos;s Spins</p>
                  <p className="text-xl font-bold">{stats.todaySpins.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(stats.todayRewards)} paid</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          <GlassCard variant="solid">
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">This Week</p>
                  <p className="text-xl font-bold">{stats.weekSpins.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(stats.weekRewards)} paid</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          <GlassCard variant="solid">
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Paid Out</p>
                  <p className="text-xl font-bold">{formatMoney(stats.totalRewards)}</p>
                  <p className="text-xs text-muted-foreground">{stats.totalSpins.toLocaleString()} spins</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          <GlassCard variant="solid">
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Value</p>
                  <p className="text-xl font-bold">{formatMoney(stats.expectedValue)}</p>
                  <p className="text-xs text-muted-foreground">per spin</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      )}

      {/* Reward Distribution */}
      {stats?.rewardDistribution && stats.rewardDistribution.length > 0 && (
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h3 className="font-semibold">Reward Distribution</h3>
          </GlassCardHeader>
          <GlassCardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {stats.rewardDistribution.map((tier: { amount: number; count: number }) => (
                <div key={tier.amount} className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-lg font-bold text-primary">{formatMoney(tier.amount)}</p>
                  <p className="text-sm text-muted-foreground">{tier.count.toLocaleString()} spins</p>
                  <p className="text-xs text-muted-foreground">
                    {((tier.count / stats.totalSpins) * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Filters */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                User ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by user ID..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 pl-9"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  setUserSearch("");
                  setSortBy("createdAt");
                  setSortDir("desc");
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {spins.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-
        {Math.min(currentPage * pageSize, total)} of {total} spin{total !== 1 ? "s" : ""}
        {userSearch && ` for user "${userSearch}"`}
      </p>

      {/* Spins Table */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden p-4 space-y-3">
                {spins.map((spin: {
                  id: string;
                  user: { id: string; name: string | null; handle: string | null };
                  reward: number;
                  spinDate: string;
                  createdAt: string;
                }) => (
                  <div
                    key={spin.id}
                    className="p-4 rounded-lg border border-border bg-card/50"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/admin/users/${spin.user.id}`}
                          className="font-medium text-sm truncate hover:text-primary"
                        >
                          {spin.user.name || spin.user.handle || "Anonymous"}
                        </Link>
                        {spin.user.handle && (
                          <p className="text-xs text-muted-foreground">@{spin.user.handle}</p>
                        )}
                      </div>
                      <span className="text-lg font-bold text-green-500">
                        {formatMoney(spin.reward)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(spin.createdAt), "MMM d, yyyy HH:mm")}
                    </div>
                  </div>
                ))}
                {spins.length === 0 && (
                  <p className="p-8 text-center text-muted-foreground">No spins found</p>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        User
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        <button
                          onClick={() => handleSort("reward")}
                          className="flex items-center hover:text-foreground"
                        >
                          Reward
                          <SortIcon column="reward" />
                        </button>
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        Spin Date
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        <button
                          onClick={() => handleSort("createdAt")}
                          className="flex items-center hover:text-foreground"
                        >
                          Created At
                          <SortIcon column="createdAt" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {spins.map((spin: {
                      id: string;
                      user: { id: string; name: string | null; handle: string | null };
                      reward: number;
                      spinDate: string;
                      createdAt: string;
                    }) => (
                      <tr
                        key={spin.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4">
                          <Link 
                            href={`/admin/users/${spin.user.id}`}
                            className="hover:text-primary"
                          >
                            <p className="font-medium text-sm">
                              {spin.user.name || spin.user.handle || "Anonymous"}
                            </p>
                            {spin.user.handle && (
                              <p className="text-xs text-muted-foreground">@{spin.user.handle}</p>
                            )}
                          </Link>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-green-500 font-mono">
                            {formatMoney(spin.reward)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">
                            {format(new Date(spin.spinDate), "MMM d, yyyy")}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(spin.createdAt), "MMM d, yyyy HH:mm:ss")}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {spins.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          No spins found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border">
              <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="h-8 px-2 sm:px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Previous</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        disabled={isLoading}
                        className="min-w-[32px] sm:min-w-[40px] h-8"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                  className="h-8 px-2 sm:px-3"
                >
                  <span className="hidden sm:inline mr-1">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}


