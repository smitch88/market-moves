"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Input,
  Badge,
} from "@vault/ui";
import {
  Search,
  Sparkles,
  TrendingUp,
  Calendar,
  Clock,
  Trophy,
  Medal,
  Award,
  Loader2,
} from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// TYPES
// ============================================================================

interface LeaderboardEntry {
  rank: number;
  userId: string;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  value: number;
  level?: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  metric: "xp" | "pnl";
  period: "all" | "monthly" | "weekly";
  totalUsers: number;
  updatedAt: string;
}

type Metric = "xp" | "pnl";
type Period = "all" | "monthly" | "weekly";

// ============================================================================
// CONSTANTS
// ============================================================================

const metricTabs = [
  { label: "XP", value: "xp" as Metric, icon: Sparkles },
  { label: "PnL", value: "pnl" as Metric, icon: TrendingUp },
];

const periodTabs = [
  { label: "All Time", value: "all" as Period, icon: Trophy },
  { label: "Monthly", value: "monthly" as Period, icon: Calendar },
  { label: "Weekly", value: "weekly" as Period, icon: Clock },
];

// ============================================================================
// HELPERS
// ============================================================================

function formatXp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function formatPnl(value: number): string {
  const absValue = Math.abs(value);
  let formatted: string;
  if (absValue >= 1_000_000) {
    formatted = `$${(absValue / 1_000_000).toFixed(1)}M`;
  } else if (absValue >= 1_000) {
    formatted = `$${(absValue / 1_000).toFixed(1)}K`;
  } else {
    formatted = `$${absValue.toLocaleString()}`;
  }
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function getAvatarGradient(index: number): string {
  const gradients = [
    "from-violet-500 to-purple-600",
    "from-cyan-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-pink-400 to-rose-500",
    "from-amber-400 to-orange-500",
    "from-indigo-400 to-violet-500",
  ];
  return gradients[index % gradients.length];
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-400" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-300" />;
  if (rank === 3) return <Award className="h-4 w-4 text-amber-600" />;
  return null;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function LeaderboardContent() {
  const [metric, setMetric] = useState<Metric>("xp");
  const [period, setPeriod] = useState<Period>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch leaderboard data
  const { data, isLoading, error } = useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard", metric, period],
    queryFn: async () => {
      const res = await fetch(
        `/api/leaderboard?metric=${metric}&period=${period}&limit=100`
      );
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });

  // Filter by search
  const filteredEntries = (data?.entries || []).filter((entry) => {
    if (!searchQuery) return true;
    const name = entry.name?.toLowerCase() || "";
    const handle = entry.handle?.toLowerCase() || "";
    return (
      name.includes(searchQuery.toLowerCase()) ||
      handle.includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top predictors on Vault Markets
        </p>
      </motion.div>

      {/* Filters Row */}
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {/* Period Tabs */}
        <div className="flex items-center bg-muted/30 backdrop-blur-sm rounded-xl p-1.5 border border-border/30">
          {periodTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = period === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setPeriod(tab.value)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activePeriod"
                    className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Metric Tabs */}
        <div className="flex items-center bg-muted/30 backdrop-blur-sm rounded-xl p-1.5 border border-border/30">
          {metricTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = metric === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setMetric(tab.value)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeMetric"
                    className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/30 border-border/30 h-11 rounded-xl"
          />
        </div>
      </motion.div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            Failed to load leaderboard. Please try again.
          </p>
        </div>
      )}

      {/* Content */}
      {data && !isLoading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${metric}-${period}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Table Header */}
            <div className="flex items-center px-4 py-2 text-sm text-muted-foreground border-b border-border/30">
              <div className="w-12" />
              <div className="flex-1" />
              {metric === "xp" && (
                <div className="w-16 text-center hidden sm:block">Level</div>
              )}
              <div className="w-28 text-right">
                {metric === "xp" ? "XP" : "PnL"}
              </div>
            </div>

            {/* Entries */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-border/20"
            >
              {filteredEntries.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No users found
                </div>
              ) : (
                filteredEntries.map((entry, index) => {
                  const displayName =
                    entry.name || entry.handle || "Anonymous";
                  const rankIcon = getRankIcon(entry.rank);

                  return (
                    <motion.div
                      key={entry.userId}
                      variants={itemVariants}
                      className="flex items-center px-4 py-3 transition-colors hover:bg-muted/20 rounded-lg"
                    >
                      {/* Rank */}
                      <div className="w-12 flex items-center gap-1.5">
                        {rankIcon}
                        <span
                          className={cn(
                            "text-sm tabular-nums",
                            entry.rank <= 3
                              ? "font-semibold"
                              : "text-muted-foreground"
                          )}
                        >
                          {entry.rank}
                        </span>
                      </div>

                      {/* Avatar + Name */}
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 border border-border/30">
                          <AvatarImage
                            src={entry.profileImageUrl || undefined}
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
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {displayName}
                          </p>
                          {entry.handle && (
                            <p className="text-xs text-muted-foreground truncate">
                              @{entry.handle}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Level */}
                      {metric === "xp" && (
                        <div className="w-16 text-center hidden sm:block">
                          <Badge
                            variant="outline"
                            className="text-xs border-border/30 bg-transparent"
                          >
                            Lvl {entry.level ?? 0}
                          </Badge>
                        </div>
                      )}

                      {/* Value */}
                      <div className="w-28 text-right">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            metric === "xp"
                              ? "text-primary"
                              : entry.value >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          )}
                        >
                          {metric === "xp"
                            ? formatXp(entry.value)
                            : formatPnl(entry.value)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>

            {/* Stats Footer */}
            {data.totalUsers > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center text-sm text-muted-foreground pt-4"
              >
                Showing {filteredEntries.length} of {data.totalUsers} users
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
