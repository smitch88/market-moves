"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { Bookmark, Loader2, Trash2, TrendingUp, BarChart3, Clock, ExternalLink } from "lucide-react";
import { Button, toast } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { getMarketUrl } from "@/lib/urls";

interface BookmarkedEvent {
  id: string;
  eventId: string;
  createdAt: string;
  event: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    category: string;
    bannerUrl: string | null;
    logoUrl: string | null;
    startTime: string | null;
    endTime: string | null;
    active: boolean;
    isPublished: boolean;
    _count: { markets: number };
    _aggregations: {
      totalVolume: number;
      totalBets: number;
      earliestClose: string | null;
    };
  };
}

function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function ProfileBookmarks() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const res = await authFetch("/api/bookmarks");
      if (!res.ok) throw new Error("Failed to fetch bookmarks");
      return res.json();
    },
  });

  const removeBookmark = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await authFetch(`/api/bookmarks/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove bookmark");
      return res.json();
    },
    onMutate: async (eventId) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const previous = queryClient.getQueryData(["bookmarks"]);
      queryClient.setQueryData(["bookmarks"], (old: any) => ({
        bookmarks: (old?.bookmarks || []).filter(
          (b: BookmarkedEvent) => b.eventId !== eventId
        ),
      }));
      // Also update bookmarkIds
      queryClient.setQueryData(["bookmarkIds"], (old: any) => ({
        eventIds: (old?.eventIds || []).filter((id: string) => id !== eventId),
      }));
      return { previous };
    },
    onError: (err, eventId, context) => {
      queryClient.setQueryData(["bookmarks"], context?.previous);
      toast.error("Failed to remove bookmark");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkIds"] });
    },
    onSuccess: () => {
      toast.success("Bookmark removed");
    },
  });

  const bookmarks: BookmarkedEvent[] = data?.bookmarks || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Bookmark className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-foreground text-lg font-semibold mb-2">No bookmarks yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Bookmark events you're interested in to find them quickly. Click the bookmark icon on any event card to save it.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Browse Events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {bookmarks.length} bookmarked event{bookmarks.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bookmarks.map((bookmark) => {
          const event = bookmark.event;
          const endTime = event.endTime ? new Date(event.endTime) : null;
          const isEndingSoon = endTime && endTime.getTime() - Date.now() < 24 * 60 * 60 * 1000;

          return (
            <div
              key={bookmark.id}
              className="relative group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors"
            >
              {/* Banner */}
              {event.bannerUrl && (
                <div className="relative h-24 w-full overflow-hidden">
                  <Image
                    src={event.bannerUrl}
                    alt=""
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {/* Category badge */}
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    {endTime && (
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm",
                          isEndingSoon
                            ? "bg-red-500/90 text-white"
                            : "bg-black/60 text-white"
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        <span>{format(endTime, "MMM d")}</span>
                      </div>
                    )}
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/90 text-primary-foreground backdrop-blur-sm">
                      {event.category}
                    </span>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                {/* Category when no banner */}
                {!event.bannerUrl && (
                  <div className="flex items-center gap-2 mb-2">
                    {endTime && (
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                          isEndingSoon
                            ? "bg-red-500/10 text-red-500"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        <span>{format(endTime, "MMM d")}</span>
                      </div>
                    )}
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {event.category}
                    </span>
                  </div>
                )}

                <Link href={getMarketUrl(event.slug)} className="block group/link">
                  <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover/link:text-primary transition-colors">
                    {event.title}
                  </h3>
                </Link>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>{event._count.markets} markets</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>{formatVolume(event._aggregations.totalVolume)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      asChild
                    >
                      <Link href={getMarketUrl(event.slug)}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeBookmark.mutate(event.id)}
                      disabled={removeBookmark.isPending}
                    >
                      {removeBookmark.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
