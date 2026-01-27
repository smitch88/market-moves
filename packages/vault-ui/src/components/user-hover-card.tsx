"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { CalendarDays, TrendingUp, Wallet } from "lucide-react";
import { cn } from "../lib/utils";

interface UserHoverCardProps {
  children: React.ReactNode;
  user: {
    handle?: string | null;
    name?: string | null;
    profileImageUrl?: string | null;
    createdAt?: Date | string | null;
  };
  stats?: {
    positions?: number;
    profit?: number;
    volume?: number;
  };
  className?: string;
}

export function UserHoverCard({
  children,
  user,
  stats,
  className,
}: UserHoverCardProps) {
  const displayName = user.name || user.handle || "Anonymous";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className={cn("w-72", className)} align="start">
        <div className="flex gap-4">
          <Avatar className="h-12 w-12">
            {user.profileImageUrl && (
              <AvatarImage src={user.profileImageUrl} alt={displayName} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-semibold">{displayName}</h4>
            {user.handle && (
              <p className="text-sm text-muted-foreground">@{user.handle}</p>
            )}
            {joinedDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                <span>Joined {joinedDate}</span>
              </div>
            )}
          </div>
        </div>

        {stats && (
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.positions ?? 0}</p>
              <p className="text-xs text-muted-foreground">Positions</p>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  "text-lg font-semibold",
                  stats.profit && stats.profit > 0 && "text-chart-2",
                  stats.profit && stats.profit < 0 && "text-destructive"
                )}
              >
                {stats.profit !== undefined
                  ? `${stats.profit >= 0 ? "+" : ""}$${Math.abs(stats.profit).toLocaleString()}`
                  : "$0"}
              </p>
              <p className="text-xs text-muted-foreground">Profit/Loss</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">
                ${(stats.volume ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Volume</p>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
