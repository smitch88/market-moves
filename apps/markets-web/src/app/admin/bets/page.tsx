"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { GlassCard, GlassCardContent, GlassCardHeader, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@vault/ui";
import { ExternalLink, Loader2 } from "lucide-react";
import { BetStatus } from "@vault/database";
import Link from "next/link";

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

  const { data, isLoading } = useQuery({
    queryKey: ["adminBets", statusFilter, marketFilter, userFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (marketFilter) params.set("marketId", marketFilter);
      if (userFilter) params.set("userId", userFilter);

      const res = await fetch(`/api/admin/bets?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch bets");
      return res.json();
    },
  });

  const bets = data?.bets || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bets</h1>
        <p className="text-muted-foreground">View and manage all bets</p>
      </div>

      {/* Filters */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Filters</h2>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
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
              <label className="text-sm font-medium mb-2 block">Market ID</label>
              <Input
                placeholder="Filter by market ID"
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">User ID</label>
              <Input
                placeholder="Filter by user ID"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Bets Table */}
      <GlassCard>
        <GlassCardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Bets</h2>
            <span className="text-sm text-muted-foreground">{total} total</span>
          </div>
        </GlassCardHeader>
        <GlassCardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                          href={`/markets/${bet.market.slug}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {bet.market.title}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{bet.outcome.label}</span>
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
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}

