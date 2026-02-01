"use client";

import { useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { User, ExternalLink, Lightbulb, Flame, Crown, Info, Star, Copy, Check, Link2, BarChart3 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";

export interface ProfileStat {
  label: string;
  value: string | number;
  sublabel?: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  multiplier: number;
  badges?: { badgeType: string; label: string; icon: string }[];
}

export interface ProfileHeaderCardProps {
  /** Display name for the user */
  displayName: string;
  /** URL for the profile avatar image */
  avatarUrl?: string | null;
  /** Twitter/X handle */
  handle?: string | null;
  /** Whether to show external link for handle */
  showHandleLink?: boolean;
  /** Date when user joined */
  joinedAt?: string | Date | null;
  /** Stats to display in the footer */
  stats: ProfileStat[];
  /** Callback for Request Market button */
  onRequestMarket?: () => void;
  /** Streak data for inline display */
  streak?: StreakData | null;
  /** Whether user is a certified KOL */
  isKOL?: boolean;
  /** User's referral code (for KOL captain link) */
  referralCode?: string | null;
}

// Multiplier for each day (index 0 = day 1)
const STREAK_MULTIPLIERS = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 3.0];

export function ProfileHeaderCard({
  displayName,
  avatarUrl,
  handle,
  showHandleLink = false,
  joinedAt,
  stats,
  onRequestMarket,
  streak,
  isKOL = false,
  referralCode,
}: ProfileHeaderCardProps) {
  const [captainLinkCopied, setCaptainLinkCopied] = useState(false);

  // Use handle for nicer captain links, fall back to referral code
  const captainLink = typeof window !== "undefined" && (handle || referralCode)
    ? `${window.location.origin}/c/${handle || referralCode}`
    : "";

  const handleCopyCaptainLink = async () => {
    if (!captainLink) return;
    await navigator.clipboard.writeText(captainLink);
    setCaptainLinkCopied(true);
    setTimeout(() => setCaptainLinkCopied(false), 2000);
  };

  return (
    <div className="border border-border rounded-xl p-4 flex flex-col">
      <div className="flex items-center gap-4">
        {/* Avatar with KOL badge */}
        <div className="relative flex-shrink-0">
          <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 via-green-400 to-blue-400">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                fill
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <User className="h-8 w-8 text-white/70" />
              </div>
            )}
          </div>
          {/* KOL Captain Badge */}
          {isKOL && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#df2421] flex items-center justify-center border-2 border-background">
              <Star className="h-3.5 w-3.5 text-white fill-white" />
            </div>
          )}
        </div>

        {/* Name & meta */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{displayName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {handle && (
              <>
                {showHandleLink ? (
                  <a
                    href={`https://x.com/${handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    @{handle}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    @{handle}
                  </span>
                )}
                <span className="text-muted-foreground">·</span>
              </>
            )}
            {joinedAt && (
              <span className="text-sm text-muted-foreground">
                Joined{" "}
                {format(
                  typeof joinedAt === "string" ? new Date(joinedAt) : joinedAt,
                  "MMM yyyy"
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KOL Captain Actions */}
      {isKOL && (referralCode || onRequestMarket) && (
        <div className="flex items-center gap-2 mt-3">
          {referralCode && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyCaptainLink}
              className="gap-2"
            >
              {captainLinkCopied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Copy Team Link
                </>
              )}
            </Button>
          )}
          {onRequestMarket && (
            <Button
              size="sm"
              onClick={onRequestMarket}
              className="gap-2 bg-[#df2421] hover:bg-[#bf1f1c] text-white"
            >
              <Lightbulb className="h-4 w-4" />
              Request Market
            </Button>
          )}
        </div>
      )}

      {/* Streak Section with Fire Icons */}
      {streak && (
        <div className="py-2 mt-3 border-t border-border">
          {/* Fire icons row - spans full width */}
          <div className="flex items-center justify-between">
            {STREAK_MULTIPLIERS.map((mult, index) => {
              const dayNumber = index + 1;
              const isCompleted = streak.currentStreak >= dayNumber;
              const isDay7 = dayNumber === 7;
              
              return (
                <div
                  key={dayNumber}
                  className="relative flex flex-col items-center flex-1"
                >
                  {/* Fire icon */}
                  <div
                    className={cn(
                      "relative flex items-center justify-center rounded-lg transition-all mx-auto",
                      isDay7 ? "w-10 h-10" : "w-8 h-8",
                      isCompleted
                        ? isDay7
                          ? "bg-gradient-to-br from-[#df2421]/20 to-orange-500/20 border border-[#df2421]/30"
                          : "bg-[#df2421]/10"
                        : "bg-muted/50"
                    )}
                  >
                    <Flame
                      className={cn(
                        isDay7 ? "w-5 h-5" : "w-4 h-4",
                        isCompleted
                          ? isDay7
                            ? "text-[#df2421] drop-shadow-[0_0_4px_rgba(223,36,33,0.5)]"
                            : "text-[#df2421]"
                          : "text-muted-foreground/40"
                      )}
                    />
                    {isDay7 && isCompleted && (
                      <Crown className="absolute -top-1.5 -right-1 w-3.5 h-3.5 text-yellow-500" />
                    )}
                  </div>
                  
                  {/* Multiplier label */}
                  <span
                    className={cn(
                      "text-[10px] font-medium mt-1 tabular-nums",
                      isCompleted
                        ? isDay7
                          ? "text-orange-500 font-bold"
                          : "text-orange-400"
                        : "text-muted-foreground/50"
                    )}
                  >
                    {mult}x
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Label */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Streak Multiplier</span>
              <StreakInfoModal />
            </div>
            {streak.currentStreak > 0 && (
              <span className="text-xs text-muted-foreground">
                {streak.currentStreak} day{streak.currentStreak !== 1 ? "s" : ""}
                {streak.longestStreak > streak.currentStreak && (
                  <span className="ml-1">(best: {streak.longestStreak})</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats - Modal on mobile, inline on desktop */}
      <div className={cn(
        "pt-3 mt-3 border-t border-border",
        !streak && !(isKOL && (referralCode || onRequestMarket)) && "mt-3"
      )}>
        {/* Mobile: Stats button that opens modal */}
        <div className="sm:hidden">
          <StatsModal stats={stats} displayName={displayName} />
        </div>

        {/* Desktop: Inline stats */}
        <div className="hidden sm:flex items-center justify-center gap-6">
          {stats.map((stat, index) => (
            <div key={stat.label} className="flex items-center gap-6 flex-shrink-0">
              {index > 0 && <div className="h-10 w-px bg-border" />}
              <div className="min-w-0 text-center">
                <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {stat.label}
                  {stat.sublabel && <span className="ml-1">{stat.sublabel}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Stats modal for mobile view
 */
function StatsModal({ stats, displayName }: { stats: ProfileStat[]; displayName: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <BarChart3 className="h-4 w-4" />
          View Stats
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {displayName}&apos;s Stats
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-4 pt-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50"
            >
              <span className="text-muted-foreground">{stat.label}</span>
              <div className="text-right">
                <span className="text-xl font-bold tabular-nums">{stat.value}</span>
                {stat.sublabel && (
                  <span className="text-sm text-muted-foreground ml-2">{stat.sublabel}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Info modal explaining how streaks work
 */
function StreakInfoModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
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

