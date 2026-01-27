import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActivityRowProps {
  user: {
    handle?: string | null;
    name?: string | null;
    profileImageUrl?: string | null;
  };
  action: "bet" | "win" | "loss";
  amount: number;
  outcome: {
    label: string;
    color?: string;
  };
  timestamp: Date | string;
  className?: string;
}

export function ActivityRow({
  user,
  action,
  amount,
  outcome,
  timestamp,
  className,
}: ActivityRowProps) {
  const displayName = user.name || user.handle || "Anonymous";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const actionText = {
    bet: "placed bet on",
    win: "won on",
    loss: "lost on",
  };

  const actionColor = {
    bet: "text-foreground",
    win: "text-chart-2",
    loss: "text-destructive",
  };

  const timeAgo = formatDistanceToNow(
    typeof timestamp === "string" ? new Date(timestamp) : timestamp,
    { addSuffix: true }
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 border-b border-border/50 last:border-0",
        className
      )}
    >
      <Avatar className="h-8 w-8">
        {user.profileImageUrl && (
          <AvatarImage src={user.profileImageUrl} alt={displayName} />
        )}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">
          <span className="font-medium">{displayName}</span>
          <span className={cn("ml-1", actionColor[action])}>
            {actionText[action]}
          </span>
          <span
            className={cn(
              "ml-1 px-1.5 py-0.5 rounded text-xs font-medium",
              outcome.color || "bg-primary/20 text-primary"
            )}
          >
            {outcome.label}
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          ${amount.toLocaleString()} • {timeAgo}
        </p>
      </div>
    </div>
  );
}
