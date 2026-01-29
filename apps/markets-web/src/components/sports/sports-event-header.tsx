"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar, TrendingUp, Zap } from "lucide-react";
import type { Event, Market } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";

interface TeamData {
  name: string;
  abbreviation: string;
  color?: string;
}

interface SportsEventHeaderProps {
  event: Event & { markets: Market[] };
}

// Parse outcomes from JSON
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Team A", "Team B"];
  }
}

function parseOutcomePrices(outcomePrices: string): string[] {
  try {
    return JSON.parse(outcomePrices);
  } catch {
    return ["0.50", "0.50"];
  }
}

// Extract team info from event/market data
function extractTeams(primaryMarket: Market | undefined): [TeamData, TeamData] {
  if (!primaryMarket) {
    return [
      { name: "Team A", abbreviation: "TMA" },
      { name: "Team B", abbreviation: "TMB" },
    ];
  }

  const outcomes = parseOutcomes(primaryMarket.outcomes);
  const team0Name = outcomes[0] || "Team A";
  const team1Name = outcomes[1] || "Team B";

  // Common NFL team abbreviations
  const teamAbbreviations: Record<string, string> = {
    seahawks: "SEA",
    patriots: "NE",
    chiefs: "KC",
    eagles: "PHI",
    cowboys: "DAL",
    "49ers": "SF",
    packers: "GB",
    bills: "BUF",
    ravens: "BAL",
    bengals: "CIN",
    lions: "DET",
    dolphins: "MIA",
    jets: "NYJ",
    giants: "NYG",
  };

  const getAbbrev = (name: string) => {
    const key = name.toLowerCase();
    return teamAbbreviations[key] || name.substring(0, 3).toUpperCase();
  };

  return [
    { name: team0Name, abbreviation: getAbbrev(team0Name), color: "#002244" },
    { name: team1Name, abbreviation: getAbbrev(team1Name), color: "#002244" },
  ];
}

// Format volume for display
function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function SportsEventHeader({ event }: SportsEventHeaderProps) {
  // Find the primary/moneyline market
  const primaryMarket = event.markets.find(
    (m) => m.question.includes("vs.") && !m.question.includes("O/U") && !m.question.includes("1H")
  ) || event.markets[0];

  const [team0, team1] = extractTeams(primaryMarket);

  // Calculate odds from primary market (capped at 1-99%)
  let percent0 = 50;
  let percent1 = 50;

  if (primaryMarket) {
    const prices = parseOutcomePrices(primaryMarket.outcomePrices);
    percent0 = Math.min(99, Math.max(1, Math.round(parseFloat(prices[0] || "0.50") * 100)));
    percent1 = Math.min(99, Math.max(1, Math.round(parseFloat(prices[1] || "0.50") * 100)));
  }

  // Calculate total volume
  const totalVolume = event.markets.reduce((sum, m) => {
    return sum + Number(m.seed0 || 0) + Number(m.seed1 || 0) + Number(m.pool0 || 0) + Number(m.pool1 || 0);
  }, 0);

  const eventDate = event.endTime || event.startTime;
  const totalMarkets = event.markets.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-card/80 border border-border/50"
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="relative p-4 sm:p-6">
        {/* Top row: Category badge + Date */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-1.5 sm:gap-2"
          >
            <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
              {event.category}
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              {totalMarkets} markets
            </span>
          </motion.div>

          {eventDate && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground"
            >
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{format(new Date(eventDate), "EEEE, MMM d • h:mm a")}</span>
              <span className="sm:hidden">{format(new Date(eventDate), "MMM d, h:mm a")}</span>
            </motion.div>
          )}
        </div>

        {/* Team matchup section */}
        <div className="flex items-center justify-between gap-2 sm:gap-6">
          {/* Team 0 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex-1 flex flex-col items-center text-center min-w-0"
          >
            <div
              className={cn(
                "w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-3",
                "bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg shadow-black/20"
              )}
            >
              <span className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
                {team0.abbreviation}
              </span>
            </div>
            <h2 className="font-bold text-sm sm:text-lg md:text-xl truncate max-w-full">{team0.name}</h2>
            <span className="text-xl sm:text-3xl font-bold text-outcome-yes mt-0.5 sm:mt-1">{percent0}%</span>
          </motion.div>

          {/* Center divider with VS */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-2 sm:gap-4 shrink-0"
          >
            <div className="relative">
              <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                <span className="text-xs sm:text-lg font-bold text-primary">VS</span>
              </div>
            </div>
            
            {/* Odds bar */}
            <div className="w-16 sm:w-32 h-1 sm:h-1.5 bg-muted/50 rounded-full overflow-hidden flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent0}%` }}
                transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-outcome-yes to-outcome-yes/80"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent1}%` }}
                transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-l from-outcome-no to-outcome-no/80"
              />
            </div>
          </motion.div>

          {/* Team 1 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex-1 flex flex-col items-center text-center min-w-0"
          >
            <div
              className={cn(
                "w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-3",
                "bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg shadow-black/20"
              )}
            >
              <span className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
                {team1.abbreviation}
              </span>
            </div>
            <h2 className="font-bold text-sm sm:text-lg md:text-xl truncate max-w-full">{team1.name}</h2>
            <span className="text-xl sm:text-3xl font-bold text-outcome-no mt-0.5 sm:mt-1">{percent1}%</span>
          </motion.div>
        </div>

        {/* Bottom stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-center gap-4 sm:gap-6 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border/50"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            <span className="text-muted-foreground">Volume</span>
            <span className="font-bold">{formatVolume(totalVolume)}</span>
          </div>
          <div className="flex sm:hidden items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            {totalMarkets} markets
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
