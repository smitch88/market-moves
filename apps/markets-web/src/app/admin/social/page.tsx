"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import {
  Badge,
  Button,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
} from "@vault/ui";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import { XIcon } from "@/components/markets/x-icon";
import { getMarketUrl } from "@/lib/urls";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface SocialVerification {
  id: string;
  tweetUrl: string | null;
  tweetId: string | null;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  method: string;
  xpEarned: number;
  user: {
    id: string;
    handle: string | null;
    name: string | null;
    avatarUrl: string | null;
    twitterId: string | null;
    totalXp: number;
  };
  market: {
    id: string;
    slug: string;
    question: string;
    outcomes: string[];
    event: {
      id: string;
      slug: string;
      title: string;
    } | null;
  };
  bets: Array<{
    id: string;
    amount: number;
    outcomeIndex: number;
    shares: number | null;
    createdAt: string;
  }>;
}

interface SocialResponse {
  verifications: SocialVerification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AdminSocialPage() {
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useQuery<SocialResponse>({
    queryKey: ["adminSocial", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/social?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch social verifications");
      return res.json();
    },
  });

  const verifications = data?.verifications || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const currentPage = data?.page || page;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Verifications</h1>
          <p className="text-muted-foreground">
            Users who shared their bets on X and earned XP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {total} verified posts
          </Badge>
        </div>
      </div>

      <GlassCard variant="solid">
        <GlassCardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XIcon className="h-5 w-5" />
              <h2 className="text-lg font-semibold">All Verifications</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {verifications.length > 0
                ? `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, total)} of ${total}`
                : "No verifications"}
            </span>
          </div>
        </GlassCardHeader>
        <GlassCardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {verifications.map((v) => (
                <div
                  key={v.id}
                  className="p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                      {v.user.avatarUrl ? (
                        <Image
                          src={v.user.avatarUrl}
                          alt={v.user.name || v.user.handle || "User"}
                          width={48}
                          height={48}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <XIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {v.user.name || v.user.handle || "Anonymous"}
                        </span>
                        {v.user.handle && (
                          <a
                            href={`https://x.com/${v.user.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-muted-foreground hover:text-foreground"
                          >
                            @{v.user.handle}
                          </a>
                        )}
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-500 border-green-500/30"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                        {v.xpEarned > 0 && (
                          <Badge
                            variant="outline"
                            className="bg-purple-500/10 text-purple-400 border-purple-500/30"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            +{v.xpEarned} XP
                          </Badge>
                        )}
                      </div>

                      {/* Market/Event Info */}
                      <Link
                        href={getMarketUrl(v.market.event?.slug || v.market.slug)}
                        className="block mt-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <span className="font-medium text-foreground">
                          {v.market.event?.title || v.market.question}
                        </span>
                      </Link>

                      {/* Bet Info */}
                      {v.bets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {v.bets.map((bet) => (
                            <Badge
                              key={bet.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              ${bet.amount} on{" "}
                              {v.market.outcomes[bet.outcomeIndex]}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Timestamp and Links */}
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {v.verifiedAt
                            ? formatDistanceToNow(new Date(v.verifiedAt), {
                                addSuffix: true,
                              })
                            : format(new Date(v.createdAt), "MMM d, yyyy")}
                        </span>
                        {v.user.twitterId && (
                          <span className="font-mono">ID: {v.user.twitterId}</span>
                        )}
                      </div>
                    </div>

                    {/* Tweet Link */}
                    <div className="flex-shrink-0">
                      {v.tweetUrl ? (
                        <a
                          href={v.tweetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-[#1DA1F2] hover:underline"
                        >
                          View Tweet
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : v.tweetId ? (
                        <a
                          href={`https://x.com/i/web/status/${v.tweetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-[#1DA1F2] hover:underline"
                        >
                          View Tweet
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {verifications.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <XIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No verified social posts yet</p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                >
                  Next
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
