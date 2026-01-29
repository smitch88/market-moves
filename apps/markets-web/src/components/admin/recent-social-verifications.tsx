"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@vault/ui";
import {
  Loader2,
  Sparkles,
  ExternalLink,
  CheckCircle,
} from "lucide-react";
import { XIcon } from "@/components/markets/x-icon";
import { getMarketUrl } from "@/lib/urls";

interface SocialVerification {
  id: string;
  tweetUrl: string | null;
  tweetId: string | null;
  verifiedAt: string | null;
  xpEarned: number;
  user: {
    id: string;
    handle: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
  market: {
    slug: string;
    outcomes: string[];
    event: {
      slug: string;
      title: string;
    } | null;
  };
  bets: Array<{
    amount: number;
    outcomeIndex: number;
  }>;
}

interface RecentSocialVerificationsProps {
  limit?: number;
}

export function RecentSocialVerifications({ limit = 5 }: RecentSocialVerificationsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["adminSocialRecent", limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/social?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch social verifications");
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const verifications: SocialVerification[] = data?.verifications || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (verifications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <XIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No verified social posts yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {verifications.map((v) => (
        <div
          key={v.id}
          className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors -mx-6 px-6"
        >
          {/* User Avatar */}
          {v.user.avatarUrl ? (
            <Image
              src={v.user.avatarUrl}
              alt={v.user.name || v.user.handle || "User"}
              width={32}
              height={32}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0">
              <XIcon className="h-4 w-4" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {v.user.name || v.user.handle || "Anonymous"}
              </span>
              <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
              {v.xpEarned > 0 && (
                <Badge
                  variant="outline"
                  className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs px-1.5 py-0"
                >
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  +{v.xpEarned}
                </Badge>
              )}
            </div>
            <Link
              href={getMarketUrl(v.market.event?.slug || v.market.slug)}
              className="text-xs text-muted-foreground hover:text-foreground truncate block"
            >
              {v.bets[0] && (
                <>
                  ${v.bets[0].amount} on {v.market.outcomes[v.bets[0].outcomeIndex]}
                </>
              )}
            </Link>
          </div>

          {/* Tweet Link & Time */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {(v.tweetUrl || v.tweetId) && (
              <a
                href={v.tweetUrl || `https://x.com/i/web/status/${v.tweetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1DA1F2] hover:text-[#1DA1F2]/80"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {v.verifiedAt
                ? formatDistanceToNow(new Date(v.verifiedAt), { addSuffix: true })
                : "Just now"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
