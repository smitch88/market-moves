"use client";

import { Bookmark } from "lucide-react";
import { Button } from "@vault/ui";
import { usePrivy } from "@privy-io/react-auth";

interface BookmarksEmptyStateProps {
  requiresLogin?: boolean;
}

export function BookmarksEmptyState({ requiresLogin }: BookmarksEmptyStateProps) {
  const { login } = usePrivy();

  if (requiresLogin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Bookmark className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-foreground text-xl font-bold mb-2">Sign in to view bookmarks</h3>
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
          Sign in to save your favorite events and access them quickly.
        </p>
        <Button onClick={() => login()}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Bookmark className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-foreground text-xl font-bold mb-2">No bookmarks yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Bookmark events you're interested in to find them quickly. Click the bookmark icon on any event card to save it.
      </p>
    </div>
  );
}
