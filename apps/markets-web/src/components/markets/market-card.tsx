"use client";

import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { Clock, TrendingUp, Users, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { Market, Event } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vault/ui";
import { getMarketUrl } from "@/lib/urls";
import { getOutcomeColors } from "@/lib/outcome-colors";

// Format date in user's local timezone
function formatDateLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

interface MarketCardProps {
  market: Market & {
    event: Pick<Event, "id" | "slug" | "title" | "category" | "bannerUrl" | "logoUrl">;
    _count: { bets: number };
  };
  index?: number;
}

// Parse outcomes from JSON string
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

// Parse outcome prices from JSON string
function parseOutcomePrices(outcomePrices: string): string[] {
  try {
    return JSON.parse(outcomePrices);
  } catch {
    return ["0.50", "0.50"];
  }
}

// Check if market was created within last 48 hours
function isNewMarket(createdAt: Date | string): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const hoursSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation < 48;
}

export function MarketCard({ market, index = 0 }: MarketCardProps) {
  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  
  // Calculate percentages from prices
  const percent0 = Math.round(parseFloat(outcomePrices[0] || "0.50") * 100);
  const percent1 = Math.round(parseFloat(outcomePrices[1] || "0.50") * 100);

  const closesAt = market.closesAt ? new Date(market.closesAt) : null;
  const isClosingSoon = closesAt && closesAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const isNew = isNewMarket(market.createdAt);

  // Calculate volume from pools
  const volume = Number(market.seed0 || 0) + Number(market.seed1 || 0) + Number(market.pool0 || 0) + Number(market.pool1 || 0);
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
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
      className="relative"
    >
      {/* Animated gradient border for new markets */}
      {isNew && (
        <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-emerald-500/50 via-cyan-500/50 to-emerald-500/50 opacity-60 blur-[2px] animate-gradient-shift" />
      )}
      
      <Link href={getMarketUrl(market.event.slug)} className="block group relative">
        <motion.div
          className={cn(
            "glass-card overflow-hidden h-full flex flex-col relative",
            isNew && "border-emerald-500/30"
          )}
          whileHover={{ 
            y: -4,
            transition: { duration: 0.2, ease: "easeOut" }
          }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Header with logo and category */}
          <div className="p-4 pb-3 flex items-start gap-3">
            {market.event.logoUrl ? (
              <motion.div 
                className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Image
                  src={market.event.logoUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                />
              </motion.div>
            ) : (
              <motion.div 
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  isNew 
                    ? "bg-gradient-to-br from-emerald-500/30 to-cyan-500/20" 
                    : "bg-gradient-to-br from-primary/30 to-primary/10"
                )}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                {isNew ? (
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-primary" />
                )}
              </motion.div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground font-medium">
                  {market.event.category}
                </span>
                {isNew && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    New
                  </motion.span>
                )}
              </div>
              <h3 className={cn(
                "font-semibold text-sm leading-tight line-clamp-2 transition-colors",
                isNew ? "group-hover:text-emerald-400" : "group-hover:text-primary"
              )}>
                {market.question}
              </h3>
            </div>
          </div>

          {/* Outcomes */}
          <div className="px-4 pb-4 flex-1 flex flex-col justify-end">
            <div className="space-y-2">
              {/* Outcome 0 */}
              <motion.div 
                className="flex items-center justify-between p-2.5 rounded-lg bg-outcome-yes/[0.08] border border-outcome-yes/20 transition-colors"
                whileHover={{ backgroundColor: "hsl(var(--outcome-yes) / 0.12)" }}
              >
                <span className="text-sm font-medium truncate pr-2">
                  {outcomes[0] || "Yes"}
                </span>
                <span className="text-sm font-bold text-outcome-yes tabular-nums">
                  {percent0}%
                </span>
              </motion.div>
              
              {/* Outcome 1 */}
              <motion.div 
                className="flex items-center justify-between p-2.5 rounded-lg bg-outcome-no/[0.08] border border-outcome-no/20 transition-colors"
                whileHover={{ backgroundColor: "hsl(var(--outcome-no) / 0.12)" }}
              >
                <span className="text-sm font-medium truncate pr-2">
                  {outcomes[1] || "No"}
                </span>
                <span className="text-sm font-bold text-outcome-no tabular-nums">
                  {percent1}%
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-1 cursor-help",
                        isClosingSoon ? "text-primary" : ""
                      )}>
                        <Clock className="h-3 w-3" />
                        <span>{format(closesAt, "MMM d")}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-card border border-border text-foreground">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Closes at (your time)</p>
                        <p className="font-medium text-xs">{formatDateLocal(closesAt)}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
