"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  Button,
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
  ChevronLeft,
  ChevronRight,
  User,
  Star,
  Users,
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
  // Captain-specific fields
  followerCount?: number;
  followerPnL?: number;
  followerVolume?: number;
  isKOL?: boolean;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  metric: "xp" | "pnl" | "volume" | "creators";
  period: "all" | "monthly" | "weekly";
  page: number;
  pageSize: number;
  totalUsers: number;
  totalPages: number;
  currentUserEntry: LeaderboardEntry | null;
  updatedAt: string;
}

type Metric = "xp" | "pnl" | "volume" | "creators";
type Period = "all" | "monthly" | "weekly";

// ============================================================================
// CONSTANTS
// ============================================================================

const PAGE_SIZE = 25;

const metricTabs = [
  { label: "MP", value: "xp" as Metric, icon: Sparkles },
  { label: "PnL", value: "pnl" as Metric, icon: TrendingUp },
  { label: "Volume", value: "volume" as Metric, icon: TrendingUp },
  { label: "Captains", value: "creators" as Metric, icon: Star },
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

function formatVolume(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  } else {
    return `$${value.toLocaleString()}`;
  }
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
      staggerChildren: 0.02,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

// ============================================================================
// LEADERBOARD ROW COMPONENT
// ============================================================================

function LeaderboardRow({
  entry,
  index,
  metric,
  isCurrentUser = false,
}: {
  entry: LeaderboardEntry;
  index: number;
  metric: Metric;
  isCurrentUser?: boolean;
}) {
  const displayName = entry.name || entry.handle || `${entry.userId.slice(0, 8)}...`;
  const rankIcon = getRankIcon(entry.rank);
  // Link using handle if available, otherwise use userId
  const profileLink = entry.handle ? `/u/${entry.handle}` : `/u/${entry.userId}`;

  const content = (
    <>
      {/* Rank */}
      <div className="w-12 flex items-center gap-1.5">
        {rankIcon}
        <span
          className={cn(
            "text-sm tabular-nums",
            entry.rank <= 3 ? "font-semibold" : "text-muted-foreground"
          )}
        >
          {entry.rank}
        </span>
      </div>

      {/* Avatar + Name */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="relative">
          <Avatar className="h-10 w-10 border border-border/30">
            <AvatarImage src={entry.profileImageUrl || undefined} />
            <AvatarFallback
              className={cn(
                "bg-gradient-to-br text-white text-sm",
                getAvatarGradient(index)
              )}
            >
              {displayName[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {entry.isKOL && (
            <div className="absolute -bottom-1 -right-1 bg-[#df2421] rounded-full p-0.5 border border-background">
              <Star className="w-2.5 h-2.5 text-white fill-white" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className={cn(
            "font-medium truncate",
            isCurrentUser && "text-primary",
            "group-hover:text-primary transition-colors"
          )}>
            {displayName}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-primary/70">(You)</span>
            )}
          </p>
          {entry.handle && (
            <p className="text-xs text-muted-foreground truncate">
              @{entry.handle}
            </p>
          )}
        </div>
      </div>

      {/* Level - for XP metric */}
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

      {/* Followers - for captains metric */}
      {metric === "creators" && (
        <div className="w-20 text-center hidden sm:flex items-center justify-center gap-1">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {entry.followerCount ?? 0}
          </span>
        </div>
      )}

      {/* Value */}
      <div className="w-28 text-right">
        <span
          className={cn(
            "font-semibold tabular-nums",
            metric === "xp"
              ? "text-primary"
              : metric === "volume"
              ? "text-blue-400"
              : metric === "creators"
              ? "text-yellow-500"
              : entry.value >= 0
              ? "text-emerald-400"
              : "text-red-400"
          )}
        >
          {metric === "xp" 
            ? formatXp(entry.value) 
            : metric === "volume"
            ? formatVolume(entry.value)
            : metric === "creators"
            ? formatVolume(entry.value)
            : formatPnl(entry.value)}
        </span>
        {metric === "creators" && entry.followerPnL !== undefined && (
          <p className={cn(
            "text-xs",
            entry.followerPnL >= 0 ? "text-emerald-400/70" : "text-red-400/70"
          )}>
            {formatPnl(entry.followerPnL)} PnL
          </p>
        )}
      </div>
    </>
  );

  // Always wrap in Link - can link by handle or userId
  return (
    <motion.div variants={itemVariants}>
      <Link
        href={profileLink}
        className={cn(
          "group flex items-center px-4 py-3 transition-all duration-200",
          isCurrentUser
            ? "bg-primary/10"
            : "hover:bg-muted/50"
        )}
      >
        {content}
      </Link>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LeaderboardContent() {
  const [metric, setMetric] = useState<Metric>("xp");
  const [period, setPeriod] = useState<Period>("all");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Reset page when filters change
  const handleMetricChange = (newMetric: Metric) => {
    setMetric(newMetric);
    setPage(1);
  };

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    setPage(1);
  };

  // Fetch leaderboard data
  const { data, isLoading, error } = useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard", metric, period, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/leaderboard?metric=${metric}&period=${period}&page=${page}&pageSize=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });

  // Filter by search (client-side for current page)
  const filteredEntries = (data?.entries || []).filter((entry) => {
    if (!searchQuery) return true;
    const name = entry.name?.toLowerCase() || "";
    const handle = entry.handle?.toLowerCase() || "";
    return (
      name.includes(searchQuery.toLowerCase()) ||
      handle.includes(searchQuery.toLowerCase())
    );
  });

  // Check if current user is in the displayed entries
  const currentUserInPage = data?.currentUserEntry
    ? filteredEntries.some((e) => e.userId === data.currentUserEntry?.userId)
    : false;

  // Pagination helpers
  const totalPages = data?.totalPages || 1;
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("ellipsis");

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (page < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">Top predictors on Vault Markets</p>
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
                onClick={() => handlePeriodChange(tab.value)}
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
                onClick={() => handleMetricChange(tab.value)}
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

      {/* Search Header - Outside AnimatePresence to prevent state issues */}
      {data && !isLoading && (
        <div className="flex items-center px-4 py-3 text-xs text-muted-foreground/60 uppercase tracking-wider bg-card rounded-t-xl border border-border/50 border-b-0">
          <div className="w-12" />
          <div className="flex-1 relative">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <input
              type="text"
              placeholder={metric === "creators" ? "Search captains..." : "Search users..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-6 py-1 text-sm font-normal normal-case tracking-normal bg-transparent border-none outline-none focus:outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          {metric === "xp" && (
            <div className="w-16 text-center hidden sm:block">Level</div>
          )}
          {metric === "creators" && (
            <div className="w-20 text-center hidden sm:block">Followers</div>
          )}
          <div className="w-28 text-right">
            {metric === "xp" ? "MP" : metric === "volume" ? "Volume" : metric === "creators" ? "Vol" : "PnL"}
          </div>
        </div>
      )}

      {/* Content */}
      {data && !isLoading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${metric}-${period}-${page}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Entries */}
            <div className="bg-card rounded-b-xl border border-border/50 border-t-0 divide-y divide-border/30 overflow-hidden">
              {filteredEntries.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {searchQuery ? "No users found matching your search" : "No users found"}
                </div>
              ) : (
                filteredEntries.map((entry, index) => (
                  <LeaderboardRow
                    key={entry.userId}
                    entry={entry}
                    index={index}
                    metric={metric}
                  />
                ))
              )}
            </div>

            {/* Current User Position (if not in current page) */}
            {data.currentUserEntry && !currentUserInPage && (
              <div className="mt-4">
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground mb-2">
                  <User className="h-4 w-4" />
                  <span>Your Position</span>
                </div>
                <div className="bg-card rounded-xl border border-primary/30 overflow-hidden">
                  <LeaderboardRow
                    entry={data.currentUserEntry}
                    index={data.currentUserEntry.rank}
                    metric={metric}
                    isCurrentUser
                  />
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border/30">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({data.totalUsers} users)
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!canGoPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {getPageNumbers().map((pageNum, idx) =>
                    pageNum === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-muted-foreground"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="min-w-[36px]"
                      >
                        {pageNum}
                      </Button>
                    )
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={!canGoNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
