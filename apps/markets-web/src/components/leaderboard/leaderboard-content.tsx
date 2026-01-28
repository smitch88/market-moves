"use client";

import { useState } from "react";
import { 
  Avatar, 
  AvatarImage, 
  AvatarFallback,
  Button,
  Input,
} from "@vault/ui";
import { Search, Sparkles, DollarSign } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { motion } from "framer-motion";

interface LeaderboardEntry {
  rank: number;
  id: string;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  balance: number;
  xp: number;
  pnl: number;
}

interface LeaderboardContentProps {
  leaderboard: LeaderboardEntry[];
}

const leaderboardTabs = [
  { label: "XP", value: "xp", icon: Sparkles },
  { label: "PnL", value: "pnl", icon: DollarSign },
];

function formatXp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M XP`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K XP`;
  }
  return `${value.toLocaleString()} XP`;
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

// Generate gradient colors for avatars
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
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const }
  },
};

export function LeaderboardContent({ leaderboard }: LeaderboardContentProps) {
  const [activeTab, setActiveTab] = useState<"xp" | "pnl">("xp");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeaderboard = leaderboard
    .filter((entry) => {
      if (!searchQuery) return true;
      const name = entry.name?.toLowerCase() || "";
      const handle = entry.handle?.toLowerCase() || "";
      return name.includes(searchQuery.toLowerCase()) || handle.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      // Sort by the active tab's metric
      if (activeTab === "xp") {
        return b.xp - a.xp;
      }
      return b.pnl - a.pnl;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1, // Re-rank based on current sort
    }));

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
      <motion.h1 
          className="text-2xl font-bold mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
      >
        Leaderboard
      </motion.h1>
      
        {/* Tabs */}
        <motion.div 
          className="flex items-center gap-2 mb-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center bg-muted/30 rounded-lg p-1">
            {leaderboardTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab(tab.value as "xp" | "pnl")}
                  className={cn(
                    "h-9 px-5 rounded-md text-sm font-medium transition-all gap-2",
                    activeTab === tab.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </motion.div>

        {/* Search Input */}
        <motion.div 
          className="relative mb-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-transparent border-border/30 h-10"
          />
        </motion.div>

        {/* Table Header */}
        <motion.div 
          className="flex items-center px-4 py-2 text-sm text-muted-foreground border-b border-border/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="w-16" />
          <div className="flex-1" />
          <div className="w-32 text-right">
            {activeTab === "xp" ? "XP" : "PnL"}
          </div>
        </motion.div>

        {/* Leaderboard Entries */}
        <motion.div 
          className="divide-y divide-border/20"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredLeaderboard.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No users found
            </div>
          ) : (
            filteredLeaderboard.map((entry, index) => {
              const displayName = entry.name || entry.handle || entry.id.slice(0, 20) + "...";
            
            return (
              <motion.div
                key={entry.id}
                variants={itemVariants}
                  whileHover={{ backgroundColor: "hsl(var(--muted) / 0.3)" }}
                  className="flex items-center px-4 py-3 transition-colors"
              >
                {/* Rank */}
                  <div className="w-8 text-sm text-muted-foreground tabular-nums">
                      {entry.rank}
                </div>

                {/* Avatar */}
                  <div className="w-8 mr-3">
                    <Avatar className="h-10 w-10 border border-border/30">
                  <AvatarImage src={entry.profileImageUrl || undefined} />
                      <AvatarFallback className={cn(
                        "bg-gradient-to-br text-white text-sm",
                        getAvatarGradient(index)
                      )}>
                    {displayName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                  </div>

                {/* Name */}
                  <div className="flex-1 min-w-0 ml-2">
                  <p className="font-medium truncate">{displayName}</p>
                </div>

                  {/* Value based on active tab */}
                  <div className="w-32 text-right">
                    <span className={cn(
                      "font-semibold tabular-nums",
                      activeTab === "xp" 
                        ? "text-primary"
                        : entry.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {activeTab === "xp" 
                        ? formatXp(entry.xp)
                        : formatPnl(entry.pnl)
                      }
                    </span>
                  </div>
              </motion.div>
            );
            })
          )}
        </motion.div>

      </div>
    </div>
  );
}
