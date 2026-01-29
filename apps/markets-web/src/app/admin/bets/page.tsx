"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { GlassCard, GlassCardContent, GlassCardHeader, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from "@vault/ui";
import { ExternalLink, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { BetStatus } from "@vault/database";
import Link from "next/link";
import { getMarketUrl } from "@/lib/urls";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: BetStatus.PENDING_TWEET, label: "Pending Tweet" },
  { value: BetStatus.CONFIRMED, label: "Confirmed" },
  { value: BetStatus.WON, label: "Won" },
  { value: BetStatus.LOST, label: "Lost" },
  { value: BetStatus.REJECTED, label: "Rejected" },
  { value: BetStatus.CANCELLED, label: "Cancelled" },
];

const statusColors: Record<BetStatus, string> = {
  PENDING_TWEET: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  CONFIRMED: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  WON: "bg-green-500/20 text-green-600 dark:text-green-400",
  LOST: "bg-red-500/20 text-red-600 dark:text-red-400",
  REJECTED: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
  CANCELLED: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
};

export default function AdminBetsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [marketFilter, setMarketFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["adminBets", statusFilter, marketFilter, userFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (marketFilter) params.set("marketId", marketFilter);
      if (userFilter) params.set("userId", userFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/bets?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch bets");
      return res.json();
    },
  });

  const bets = data?.bets || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const currentPage = data?.page || page;

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Bets</h1>
        <p className="text-sm sm:text-base text-muted-foreground">View and manage all bets</p>
      </div>

      {/* Filters */}
      <GlassCard variant="solid">
        <GlassCardHeader className="p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold">Filters</h2>
        </GlassCardHeader>
        <GlassCardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="h-9 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">Market ID</label>
              <Input
                placeholder="Filter by market ID"
                value={marketFilter}
                onChange={(e) => {
                  setMarketFilter(e.target.value);
                  handleFilterChange();
                }}
                className="h-9 sm:h-10"
              />
            </div>
            <div className="sm:col-span-2 md:col-span-1">
              <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">User ID</label>
              <Input
                placeholder="Filter by user ID"
                value={userFilter}
                onChange={(e) => {
                  setUserFilter(e.target.value);
                  handleFilterChange();
                }}
                className="h-9 sm:h-10"
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Bets */}
      <GlassCard variant="solid">
        <GlassCardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold">All Bets</h2>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {bets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-
              {Math.min(currentPage * pageSize, total)} of {total}
            </span>
          </div>
        </GlassCardHeader>
        <GlassCardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden p-4 space-y-3">
                {bets.map((bet: any) => (
                  <div
                    key={bet.id}
                    className="p-4 rounded-lg border border-border bg-card/50"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {bet.user.name || bet.user.handle || "Anonymous"}
                        </p>
                        {bet.user.handle && (
                          <p className="text-xs text-muted-foreground">@{bet.user.handle}</p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                          statusColors[bet.status as BetStatus] || ""
                        }`}
                      >
                        {bet.status}
                      </span>
                    </div>
                    <Link
                      href={getMarketUrl(bet.market.event?.slug || bet.market.slug)}
                      className="text-sm font-medium hover:underline line-clamp-2 mb-3 block"
                    >
                      {bet.market.event?.title || bet.market.question}
                    </Link>
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground">Outcome</p>
                        <p className="text-sm font-medium truncate">{bet.outcomeLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-sm font-semibold">${bet.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-xs">{format(new Date(bet.createdAt), "MMM d")}</p>
                      </div>
                    </div>
                    {(bet.tweetProof?.tweetUrl || bet.tweetProof?.tweetId) && (
                      <a
                        href={bet.tweetProof.tweetUrl || `https://x.com/i/web/status/${bet.tweetProof.tweetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View Tweet
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
                {bets.length === 0 && (
                  <p className="p-8 text-center text-muted-foreground">No bets found</p>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">User</th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">Market</th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">Outcome</th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">Amount</th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">Tweet</th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.map((bet: any) => (
                      <tr
                        key={bet.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-sm">
                              {bet.user.name || bet.user.handle || "Anonymous"}
                            </p>
                            {bet.user.handle && (
                              <p className="text-xs text-muted-foreground">@{bet.user.handle}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Link
                            href={getMarketUrl(bet.market.event?.slug || bet.market.slug)}
                            className="text-sm font-medium hover:underline"
                          >
                            {bet.market.event?.title || bet.market.question}
                          </Link>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">{bet.outcomeLabel}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-sm">${bet.amount.toLocaleString()}</span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                              statusColors[bet.status as BetStatus] || ""
                            }`}
                          >
                            {bet.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {bet.tweetProof?.tweetUrl ? (
                            <a
                              href={bet.tweetProof.tweetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              View Tweet
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : bet.tweetProof?.tweetId ? (
                            <a
                              href={`https://x.com/i/web/status/${bet.tweetProof.tweetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              View Tweet
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(bet.createdAt), "MMM d, yyyy HH:mm")}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {bets.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No bets found
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
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage <= 2) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 1) {
                      pageNum = totalPages - 2 + i;
                    } else {
                      pageNum = currentPage - 1 + i;
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

