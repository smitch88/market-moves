"use client";

import { GlassCard, Avatar, AvatarImage, AvatarFallback } from "@vault/ui";
import { Crown, Medal, Award } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { motion } from "framer-motion";

interface LeaderboardEntry {
  rank: number;
  id: string;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  balance: number;
}

interface LeaderboardContentProps {
  leaderboard: LeaderboardEntry[];
}

function formatBalance(balance: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(balance);
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return null;
}

function getRankStyle(rank: number): string {
  if (rank === 1) return "bg-gradient-to-r from-amber-500/10 to-transparent";
  if (rank === 2) return "bg-gradient-to-r from-slate-400/10 to-transparent";
  if (rank === 3) return "bg-gradient-to-r from-amber-700/10 to-transparent";
  return "";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
  },
};

export function LeaderboardContent({ leaderboard }: LeaderboardContentProps) {
  if (leaderboard.length === 0) {
    return (
      <motion.div 
        className="max-w-md mx-auto text-center py-12"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-muted-foreground">No users yet</p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="max-w-md mx-auto"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <motion.h1 
        className="text-2xl font-bold mb-6 text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        Leaderboard
      </motion.h1>
      
      <GlassCard className="overflow-hidden">
        <motion.div 
          className="divide-y divide-border/30"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {leaderboard.map((entry) => {
            const displayName = entry.name || entry.handle || "Anonymous";
            const rankIcon = getRankIcon(entry.rank);
            
            return (
              <motion.div
                key={entry.id}
                variants={itemVariants}
                whileHover={{ 
                  backgroundColor: "hsl(var(--muted) / 0.5)",
                  x: 4,
                }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "flex items-center gap-4 px-4 py-3",
                  getRankStyle(entry.rank)
                )}
              >
                {/* Rank */}
                <div className="w-8 flex items-center justify-center">
                  {rankIcon ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 260, 
                        damping: 20,
                        delay: entry.rank * 0.1 
                      }}
                    >
                      {rankIcon}
                    </motion.div>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <Avatar className="h-10 w-10 border border-border/50">
                  <AvatarImage src={entry.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm">
                    {displayName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{displayName}</p>
                  {entry.handle && entry.name && (
                    <p className="text-xs text-muted-foreground truncate">
                      @{entry.handle}
                    </p>
                  )}
                </div>

                {/* Balance */}
                <div className="text-right">
                  <motion.p 
                    className="font-bold tabular-nums text-[#df2421]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {formatBalance(entry.balance)}
                  </motion.p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </GlassCard>
    </motion.div>
  );
}
