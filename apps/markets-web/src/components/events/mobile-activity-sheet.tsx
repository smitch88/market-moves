"use client";

import { useRef, useCallback, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback, Badge } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { Activity, Star, Loader2, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// TYPES
// ============================================================================

interface ActivityBet {
  id: string;
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    profileImageUrl: string | null;
    isKOL: boolean;
  };
  market: {
    id: string;
    question: string;
  };
  amount: number;
  outcomeIndex: number;
  outcomeLabel: string;
  createdAt: string;
}

interface ActivityResponse {
  bets: ActivityBet[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface MobileActivitySheetProps {
  eventSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatAmount(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function getAvatarGradient(index: number): string {
  const gradients = [
    "from-violet-500 to-purple-600",
    "from-cyan-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-pink-400 to-rose-500",
    "from-amber-400 to-orange-500",
  ];
  return gradients[index % gradients.length];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MobileActivitySheet({
  eventSlug,
  isOpen,
  onClose,
}: MobileActivitySheetProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Infinite query for activity
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery<ActivityResponse>({
    queryKey: ["event-activity-infinite", eventSlug],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (pageParam) params.set("cursor", pageParam as string);

      const res = await fetch(`/api/events/${eventSlug}/activity?${params}`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isOpen,
  });

  // Flatten all pages into single array
  const allBets = data?.pages.flatMap((page) => page.bets) || [];

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isFetchingNextPage || !hasNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const threshold = 100;

    if (scrollHeight - scrollTop - clientHeight < threshold) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-card rounded-t-2xl border-t border-border/50 max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Activity</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 -m-2 hover:bg-muted/50 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content - scrollable */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto overscroll-contain"
            >
              {error ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Failed to load activity
                </div>
              ) : isLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : allBets.length === 0 ? (
                <div className="p-8 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Be the first to place a bet!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {allBets.map((bet, index) => {
                    const displayName =
                      bet.user.name || bet.user.handle || bet.user.id.slice(0, 8);
                    const profileLink = bet.user.handle
                      ? `/u/${bet.user.handle}`
                      : `/u/${bet.user.id}`;
                    const timeAgo = formatDistanceToNow(new Date(bet.createdAt), {
                      addSuffix: true,
                    });

                    return (
                      <div
                        key={bet.id}
                        className="px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <Link href={profileLink} className="flex-shrink-0" onClick={onClose}>
                            <div className="relative">
                              <Avatar className="h-10 w-10 border border-border/30">
                                <AvatarImage
                                  src={bet.user.profileImageUrl || undefined}
                                />
                                <AvatarFallback
                                  className={cn(
                                    "bg-gradient-to-br text-white text-sm",
                                    getAvatarGradient(index)
                                  )}
                                >
                                  {displayName[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {bet.user.isKOL && (
                                <div className="absolute -bottom-0.5 -right-0.5 bg-[#df2421] rounded-full p-0.5 border border-background">
                                  <Star className="w-2.5 h-2.5 text-white fill-white" />
                                </div>
                              )}
                            </div>
                          </Link>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                href={profileLink}
                                className="font-medium text-sm hover:text-primary transition-colors truncate"
                                onClick={onClose}
                              >
                                {displayName}
                              </Link>
                              {bet.user.isKOL && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4 border-[#df2421]/50 text-[#df2421]"
                                >
                                  Captain
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              Bet{" "}
                              <span className="text-emerald-400 font-medium">
                                {formatAmount(bet.amount)}
                              </span>{" "}
                              on{" "}
                              <span className="text-foreground/80 font-medium">
                                {bet.outcomeLabel}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-1">
                              {bet.market.question}
                            </p>
                          </div>

                          {/* Time */}
                          <span className="text-xs text-muted-foreground/60 flex-shrink-0 whitespace-nowrap">
                            {timeAgo}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Loading more indicator */}
                  {isFetchingNextPage && (
                    <div className="py-4 flex justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}

                  {/* End of list */}
                  {!hasNextPage && allBets.length > 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground/50">
                      No more activity
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
