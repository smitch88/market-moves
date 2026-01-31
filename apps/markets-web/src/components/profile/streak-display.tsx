"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame, Medal, Trophy, Award, Crown, Gem, Info, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
} from "@vault/ui";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { cn } from "@vault/ui/lib/utils";

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  multiplier: number;
  nextMultiplier: number;
  daysUntilNextTier: number;
  badges: {
    badgeType: string;
    label: string;
    icon: "bronze" | "silver" | "gold" | "platinum" | "diamond";
    earnedAt: string;
  }[];
}

const BADGE_ICONS = {
  bronze: Medal,
  silver: Medal,
  gold: Trophy,
  platinum: Award,
  diamond: Gem,
};

const BADGE_COLORS = {
  bronze: "text-amber-600",
  silver: "text-slate-400",
  gold: "text-yellow-500",
  platinum: "text-violet-400",
  diamond: "text-cyan-400",
};

const BADGE_BG_COLORS = {
  bronze: "bg-amber-600/10",
  silver: "bg-slate-400/10",
  gold: "bg-yellow-500/10",
  platinum: "bg-violet-400/10",
  diamond: "bg-cyan-400/10",
};

interface StreakDisplayProps {
  className?: string;
  compact?: boolean;
}

export function StreakDisplay({ className, compact = false }: StreakDisplayProps) {
  const authFetch = useAuthFetch();

  const { data: streak, isLoading } = useQuery<StreakInfo>({
    queryKey: ["streak"],
    queryFn: async () => {
      const res = await authFetch("/api/me/streak");
      if (!res.ok) throw new Error("Failed to fetch streak");
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-16 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!streak) {
    return null;
  }

  const { currentStreak, longestStreak, multiplier, daysUntilNextTier, nextMultiplier, badges } = streak;

  // Determine flame color based on streak
  const getFlameColor = () => {
    if (currentStreak >= 7) return "text-orange-500 animate-pulse";
    if (currentStreak >= 3) return "text-orange-400";
    if (currentStreak >= 1) return "text-orange-300";
    return "text-muted-foreground";
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1.5">
          <Flame className={cn("w-4 h-4", getFlameColor())} />
          <span className="text-sm font-medium">{currentStreak}</span>
          {multiplier > 1 && (
            <span className="text-xs text-emerald-500 font-semibold">{multiplier}x</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card/50 p-4", className)}>
      {/* Main Streak Display */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              currentStreak > 0 ? "bg-orange-500/10" : "bg-muted"
            )}>
              <Flame className={cn("w-6 h-6", getFlameColor())} />
            </div>
            {currentStreak >= 7 && (
              <div className="absolute -top-1 -right-1">
                <Crown className="w-4 h-4 text-yellow-500" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{currentStreak}</span>
              <span className="text-sm text-muted-foreground">day streak</span>
              <StreakInfoModal />
            </div>
            {currentStreak > 0 && (
              <div className="text-xs text-muted-foreground">
                Best: {longestStreak} days
              </div>
            )}
          </div>
        </div>

        {/* Multiplier Badge */}
        {multiplier > 1 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-emerald-500">{multiplier}x</div>
            <div className="text-[10px] text-emerald-500/70 uppercase tracking-wider">
              MP Boost
            </div>
          </div>
        )}
      </div>

      {/* Progress to Next Tier */}
      {daysUntilNextTier > 0 && multiplier < 3 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Current: {multiplier}x</span>
            <span>Next: {nextMultiplier}x in {daysUntilNextTier} day{daysUntilNextTier > 1 ? "s" : ""}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-emerald-500 rounded-full transition-all"
              style={{
                width: `${Math.min(100, ((7 - daysUntilNextTier) / 7) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Multiplier Tiers Guide */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const isCompleted = currentStreak >= day;
          const isCurrent = currentStreak === day;
          const dayMultiplier = getMultiplierForDay(day);
          
          return (
            <div
              key={day}
              className={cn(
                "text-center py-1.5 rounded text-[10px] transition-all",
                isCompleted ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/50 text-muted-foreground",
                isCurrent && "ring-1 ring-emerald-500"
              )}
            >
              <div className="font-medium">{day}</div>
              <div className={cn(
                isCompleted ? "text-emerald-500/70" : "text-muted-foreground/70"
              )}>
                {dayMultiplier}x
              </div>
            </div>
          );
        })}
      </div>

      {/* Badges Section */}
      {badges.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
            Streak Badges
          </div>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => {
              const Icon = BADGE_ICONS[badge.icon];
              return (
                <div
                  key={badge.badgeType}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium",
                    BADGE_BG_COLORS[badge.icon],
                    BADGE_COLORS[badge.icon]
                  )}
                  title={`Earned ${new Date(badge.earnedAt).toLocaleDateString()}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{badge.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Info modal explaining how streaks work
 */
function StreakInfoModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Info className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Daily Streak System
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 text-sm">
          {/* How it works */}
          <div>
            <h4 className="font-semibold mb-2">How It Works</h4>
            <p className="text-muted-foreground">
              Place at least one bet each day to maintain your streak. The longer your streak, 
              the higher your MP (Market Points) multiplier!
            </p>
          </div>

          {/* Multiplier tiers */}
          <div>
            <h4 className="font-semibold mb-2">MP Multipliers</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                <span className="text-muted-foreground">Day 1</span>
                <span className="font-medium">1.0x</span>
              </div>
              <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                <span className="text-muted-foreground">Day 2</span>
                <span className="font-medium text-emerald-500">1.1x</span>
              </div>
              <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                <span className="text-muted-foreground">Day 3</span>
                <span className="font-medium text-emerald-500">1.2x</span>
              </div>
              <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                <span className="text-muted-foreground">Day 4</span>
                <span className="font-medium text-emerald-500">1.3x</span>
              </div>
              <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                <span className="text-muted-foreground">Day 5</span>
                <span className="font-medium text-emerald-500">1.4x</span>
              </div>
              <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                <span className="text-muted-foreground">Day 6</span>
                <span className="font-medium text-emerald-500">1.5x</span>
              </div>
              <div className="col-span-2 flex justify-between bg-orange-500/10 border border-orange-500/20 rounded px-3 py-2">
                <span className="text-orange-500 flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" /> Day 7+
                </span>
                <span className="font-bold text-orange-500">3.0x</span>
              </div>
            </div>
          </div>

          {/* Activity requirement */}
          <div>
            <h4 className="font-semibold mb-2">What Counts as Activity?</h4>
            <ul className="text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Placing a bet (buy)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Selling a position
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Redeeming winnings
              </li>
            </ul>
          </div>

          {/* Reset warning */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <h4 className="font-semibold text-red-500 mb-1">Streak Reset</h4>
            <p className="text-xs text-muted-foreground">
              If you miss a day without any trading activity, your streak resets to 0. 
              Streaks are calculated in UTC timezone and reset at midnight UTC.
            </p>
          </div>

          {/* Badges info */}
          <div>
            <h4 className="font-semibold mb-2">Streak Badges</h4>
            <p className="text-muted-foreground text-xs">
              Earn permanent badges for reaching streak milestones: 7 days, 14 days, 30 days, 
              60 days, and 100 days. These badges are displayed on your profile.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getMultiplierForDay(day: number): number {
  if (day <= 1) return 1.0;
  if (day === 2) return 1.1;
  if (day === 3) return 1.2;
  if (day === 4) return 1.3;
  if (day === 5) return 1.4;
  if (day === 6) return 1.5;
  return 3.0;
}

/**
 * Small inline streak indicator for headers/cards
 */
export function StreakIndicator({ streak, multiplier }: { streak: number; multiplier: number }) {
  if (streak <= 0) return null;

  const getFlameColor = () => {
    if (streak >= 7) return "text-orange-500";
    if (streak >= 3) return "text-orange-400";
    return "text-orange-300";
  };

  return (
    <div className="inline-flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5">
      <Flame className={cn("w-3 h-3", getFlameColor())} />
      <span className="text-xs font-medium">{streak}</span>
      {multiplier > 1 && (
        <span className="text-[10px] text-emerald-500 font-semibold">{multiplier}x</span>
      )}
    </div>
  );
}
