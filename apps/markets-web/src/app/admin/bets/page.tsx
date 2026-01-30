"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
} from "@vault/ui";
import {
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  CheckCircle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { BetStatus } from "@vault/database";
import Link from "next/link";
import { getMarketUrl, getAdminEventUrl, getAdminMarketUrl } from "@/lib/urls";

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

const tweetStatusOptions = [
  { value: "all", label: "All Tweets" },
  { value: "verified", label: "Verified Tweets" },
  { value: "unverified", label: "Unverified Tweets" },
  { value: "has_tweet", label: "Has Tweet" },
  { value: "no_tweet", label: "No Tweet" },
];

interface Event {
  id: string;
  title: string;
}

export default function AdminBetsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [tweetStatusFilter, setTweetStatusFilter] = useState<string>("all");
  const [userSearch, setUserSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<string>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Fetch events for dropdown
  const { data: eventsData } = useQuery({
    queryKey: ["adminEvents"],
    queryFn: async () => {
      const res = await fetch("/api/admin/events?limit=100");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const events: Event[] = eventsData?.events || [];

  const { data, isLoading } = useQuery({
    queryKey: ["adminBets", statusFilter, eventFilter, tweetStatusFilter, userSearch, sortBy, sortDir, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (eventFilter !== "all") params.set("eventId", eventFilter);
      if (tweetStatusFilter !== "all") params.set("tweetStatus", tweetStatusFilter);
      if (userSearch) params.set("userSearch", userSearch);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Bets</h1>
        <p className="text-sm sm:text-base text-muted-foreground">View and manage all bets</p>
      </div>

      {/* Filters */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            {/* User Search */}
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                User (handle or name)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search @handle or name..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    handleFilterChange();
                  }}
                  className="h-9 pl-9"
                />
              </div>
            </div>

            {/* Event Filter */}
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                Event
              </label>
              <Select
                value={eventFilter}
                onValueChange={(value) => {
                  setEventFilter(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                Bet Status
              </label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="h-9">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Tweet Status Filter */}
            <div>
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                Tweet Status
              </label>
              <Select
                value={tweetStatusFilter}
                onValueChange={(value) => {
                  setTweetStatusFilter(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tweetStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        {option.value === "verified" && <CheckCircle className="h-3 w-3 text-green-500" />}
                        {option.value === "unverified" && <XCircle className="h-3 w-3 text-yellow-500" />}
                        {option.value === "has_tweet" && <MessageSquare className="h-3 w-3 text-blue-500" />}
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Spacer for alignment */}
            <div className="hidden lg:block" />

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full"
                onClick={() => {
                  setStatusFilter("all");
                  setEventFilter("all");
                  setTweetStatusFilter("all");
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
        Showing {bets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-
        {Math.min(currentPage * pageSize, total)} of {total} bet{total !== 1 ? "s" : ""}
        {userSearch && ` matching "${userSearch}"`}
        {eventFilter !== "all" && ` in selected event`}
        {statusFilter !== "all" && ` with status ${statusFilter}`}
        {tweetStatusFilter !== "all" && ` (${tweetStatusOptions.find(o => o.value === tweetStatusFilter)?.label.toLowerCase()})`}
      </p>

      {/* Bets */}
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
                    <div className="mb-3">
                      <Link
                        href={getAdminEventUrl(bet.market.event?.id)}
                        className="text-xs text-muted-foreground hover:text-primary block mb-1"
                      >
                        {bet.market.event?.title}
                      </Link>
                      <Link
                        href={getAdminMarketUrl(bet.market.id)}
                        className="text-sm font-medium hover:underline line-clamp-2 block"
                      >
                        {bet.market.question}
                      </Link>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground">Outcome</p>
                        <p className="text-sm font-medium truncate">{bet.outcomeLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-sm font-semibold font-mono">${bet.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-xs">{format(new Date(bet.createdAt), "MMM d")}</p>
                      </div>
                    </div>
                    {bet.tweetProof && (
                      <div className="mt-3 flex items-center gap-2">
                        {bet.tweetProof.verified ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-yellow-500" />
                        )}
                        <a
                          href={bet.tweetProof.tweetUrl || `https://x.com/i/web/status/${bet.tweetProof.tweetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {bet.tweetProof.verified ? "Verified Tweet" : "Unverified Tweet"}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
                {bets.length === 0 && (
                  <p className="p-8 text-center text-muted-foreground">No bets found</p>
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
                        Event / Market
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        Outcome
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        <button
                          onClick={() => handleSort("amount")}
                          className="flex items-center hover:text-foreground"
                        >
                          Amount
                          <SortIcon column="amount" />
                        </button>
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        Status
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        Tweet
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground text-sm">
                        <button
                          onClick={() => handleSort("createdAt")}
                          className="flex items-center hover:text-foreground"
                        >
                          Date
                          <SortIcon column="createdAt" />
                        </button>
                      </th>
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
                          <div>
                            <Link
                              href={getAdminEventUrl(bet.market.event?.id)}
                              className="text-xs text-muted-foreground hover:text-primary block mb-0.5"
                            >
                              {bet.market.event?.title}
                            </Link>
                            <Link
                              href={getAdminMarketUrl(bet.market.id)}
                              className="text-sm font-medium hover:underline line-clamp-1"
                            >
                              {bet.market.question}
                            </Link>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="text-xs">
                            {bet.outcomeLabel}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-sm font-mono">
                            ${bet.amount.toLocaleString()}
                          </span>
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
                          {bet.tweetProof ? (
                            <div className="flex items-center gap-2">
                              <span title={bet.tweetProof.verified ? "Verified" : "Unverified"}>
                                {bet.tweetProof.verified ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-yellow-500" />
                                )}
                              </span>
                              <a
                                href={bet.tweetProof.tweetUrl || `https://x.com/i/web/status/${bet.tweetProof.tweetId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                View
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
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
