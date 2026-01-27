"use client";

import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { Clock, TrendingUp, Users } from "lucide-react";
import { motion } from "framer-motion";
import type { Market, Outcome } from "@vault/database";

interface MarketCardProps {
  market: Market & {
    outcomes: Outcome[];
    _count: { bets: number };
  };
  index?: number;
}

export function MarketCard({ market, index = 0 }: MarketCardProps) {
  const outcomeA = market.outcomes.find((o) => o.key === "A");
  const outcomeB = market.outcomes.find((o) => o.key === "B");

  // Calculate implied probability
  const totalPool = market.seedA + market.seedB;
  const percentA = totalPool > 0 ? Math.round((market.seedA / totalPool) * 100) : 50;
  const percentB = 100 - percentA;

  const closesAt = market.closesAt ? new Date(market.closesAt) : null;
  const isClosingSoon = closesAt && closesAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  // Format volume
  const volume = market.seedA + market.seedB;
  const formatVolume = (v: number) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <Link href={`/markets/${market.slug}`} className="block group">
        <motion.div
          className="glass-card overflow-hidden h-full flex flex-col"
          whileHover={{ 
            y: -4,
            transition: { duration: 0.2, ease: "easeOut" }
          }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Header with logo and category */}
          <div className="p-4 pb-3 flex items-start gap-3">
            {market.logoUrl ? (
              <motion.div 
                className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Image
                  src={market.logoUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                />
              </motion.div>
            ) : (
              <motion.div 
                className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <TrendingUp className="h-5 w-5 text-primary" />
              </motion.div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground font-medium mb-1">
                {market.category}
              </div>
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {market.question || market.title}
              </h3>
            </div>
          </div>

          {/* Outcomes */}
          <div className="px-4 pb-4 flex-1 flex flex-col justify-end">
            <div className="space-y-2">
              {/* Outcome A */}
              <motion.div 
                className="flex items-center justify-between p-2.5 rounded-lg bg-outcome-yes/[0.08] border border-outcome-yes/20 transition-colors"
                whileHover={{ backgroundColor: "hsl(var(--outcome-yes) / 0.12)" }}
              >
                <span className="text-sm font-medium truncate pr-2">
                  {outcomeA?.label || "Yes"}
                </span>
                <span className="text-sm font-bold text-outcome-yes tabular-nums">
                  {percentA}¢
                </span>
              </motion.div>
              
              {/* Outcome B */}
              <motion.div 
                className="flex items-center justify-between p-2.5 rounded-lg bg-outcome-no/[0.08] border border-outcome-no/20 transition-colors"
                whileHover={{ backgroundColor: "hsl(var(--outcome-no) / 0.12)" }}
              >
                <span className="text-sm font-medium truncate pr-2">
                  {outcomeB?.label || "No"}
                </span>
                <span className="text-sm font-bold text-outcome-no tabular-nums">
                  {percentB}¢
                </span>
              </motion.div>
            </div>

            {/* Meta footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{formatVolume(volume)} Vol</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{market._count.bets}</span>
                </div>
              </div>
              {closesAt && (
                <div className={`flex items-center gap-1 ${isClosingSoon ? "text-red-500" : ""}`}>
                  <Clock className="h-3 w-3" />
                  <span>{format(closesAt, "MMM d")}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
