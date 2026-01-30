"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { toast } from "@vault/ui";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

interface BookmarkButtonProps {
  eventId: string;
  className?: string;
}

export function BookmarkButton({ eventId, className }: BookmarkButtonProps) {
  const { authenticated, login } = usePrivy();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  // Fetch all bookmarked event IDs
  const { data: bookmarkData } = useQuery({
    queryKey: ["bookmarkIds"],
    queryFn: async () => {
      const res = await authFetch("/api/bookmarks/ids");
      if (!res.ok) return { eventIds: [] };
      return res.json();
    },
    enabled: authenticated,
    staleTime: 30000, // Cache for 30 seconds
  });

  const bookmarkedIds = bookmarkData?.eventIds || [];
  const isBookmarked = bookmarkedIds.includes(eventId);

  // Add bookmark mutation
  const addBookmark = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error("Failed to bookmark");
      return res.json();
    },
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["bookmarkIds"] });
      const previous = queryClient.getQueryData(["bookmarkIds"]);
      queryClient.setQueryData(["bookmarkIds"], (old: any) => ({
        eventIds: [...(old?.eventIds || []), eventId],
      }));
      return { previous };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(["bookmarkIds"], context?.previous);
      toast.error("Failed to bookmark");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarkIds"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onSuccess: () => {
      toast.success("Bookmarked!");
    },
  });

  // Remove bookmark mutation
  const removeBookmark = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/bookmarks/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove bookmark");
      return res.json();
    },
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["bookmarkIds"] });
      const previous = queryClient.getQueryData(["bookmarkIds"]);
      queryClient.setQueryData(["bookmarkIds"], (old: any) => ({
        eventIds: (old?.eventIds || []).filter((id: string) => id !== eventId),
      }));
      return { previous };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(["bookmarkIds"], context?.previous);
      toast.error("Failed to remove bookmark");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarkIds"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onSuccess: () => {
      toast.success("Bookmark removed");
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!authenticated) {
      login();
      return;
    }

    if (isBookmarked) {
      removeBookmark.mutate();
    } else {
      addBookmark.mutate();
    }
  };

  const isPending = addBookmark.isPending || removeBookmark.isPending;

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200",
        "hover:scale-110 active:scale-95",
        isBookmarked
          ? "bg-primary/20 text-primary"
          : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground",
        isPending && "opacity-50 pointer-events-none",
        className
      )}
      title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      {isBookmarked ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </button>
  );
}
