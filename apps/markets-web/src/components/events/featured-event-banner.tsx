"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  Plus,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Event } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { getMarketUrl } from "@/lib/urls";
import { useMarketUpdates, type PriceUpdate } from "@/hooks/use-market-updates";
import { QuickBetModal } from "./quick-bet-modal";

// Partial market data that we receive from the featured events query
interface FeaturedMarket {
  id: string;
  question: string;
  outcomes: string;
  outcomePrices: string;
  outcomeColors: string | null;
  pool0: number;
  pool1: number;
  seed0: number;
  seed1: number;
  _count?: { bets: number };
}

interface FeaturedEventBannerProps {
  events: Array<
    Event & {
      markets: FeaturedMarket[];
      _aggregations: {
        totalVolume: number;
      };
    }
  >;
}

function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

function parseOutcomePrices(outcomePrices: string): string[] {
  try {
    return JSON.parse(outcomePrices);
  } catch {
    return ["0.50", "0.50"];
  }
}

function parseOutcomeColors(outcomeColors: string | null): string[] {
  if (!outcomeColors) return ["#22C55E", "#EF4444"]; // Green and red
  try {
    return JSON.parse(outcomeColors);
  } catch {
    return ["#22C55E", "#EF4444"];
  }
}

function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}K`;
  return `$${v.toLocaleString()}`;
}

function formatCountdown(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff <= 0) return "Started";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Generate chart data (mock for now, can be replaced with real data)
function generateChartData(
  price0: number,
  price1: number
): Array<{ time: string; price0: number; price1: number }> {
  const data: Array<{ time: string; price0: number; price1: number }> = [];
  const now = new Date();

  for (let i = 7; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayName = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const progress = (7 - i) / 7;
    const basePrice0 = price0 - 15 + Math.random() * 10;
    const variation = (Math.random() - 0.5) * 8;
    const p0 = Math.max(
      5,
      Math.min(95, basePrice0 + variation + (price0 - basePrice0) * progress)
    );

    data.push({
      time: dayName,
      price0: Math.round(p0),
      price1: Math.round(100 - p0),
    });
  }

  // Ensure last point matches current prices
  if (data.length > 0) {
    data[data.length - 1] = {
      time: data[data.length - 1]!.time,
      price0: Math.round(price0),
      price1: Math.round(price1),
    };
  }

  return data;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
  outcomes: string[];
}

function CustomTooltip({ active, payload, label, outcomes }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-medium">{outcomes[index]}:</span>
          <span className="font-bold tabular-nums">{entry.value}%</span>
        </div>
      ))}
    </div>
  );
}

export function FeaturedEventBanner({ events }: FeaturedEventBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState("");
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState(0);
  const [livePrices, setLivePrices] = useState<Map<string, [number, number]>>(new Map());

  const currentEvent = events[currentIndex];

  // Get the primary market (first one or the one with most bets)
  const primaryMarket = useMemo(() => {
    if (!currentEvent?.markets?.length) return null;
    return currentEvent.markets.reduce((best, m) =>
      (m._count?.bets || 0) > (best._count?.bets || 0) ? m : best
    );
  }, [currentEvent]);

  // Memoized callback for price updates to prevent hook recreation
  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    setLivePrices((prev) => {
      const next = new Map(prev);
      next.set(update.marketId, update.prices);
      return next;
    });
  }, []);

  // Subscribe to real-time price updates
  const { status: sseStatus } = useMarketUpdates({
    eventId: currentEvent?.id,
    enabled: !!currentEvent,
    onPriceUpdate: handlePriceUpdate,
  });

  // Update countdown every second
  useEffect(() => {
    if (!currentEvent?.startTime) return;

    const update = () => {
      setCountdown(formatCountdown(new Date(currentEvent.startTime!)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [currentEvent?.startTime]);

  // Auto-rotate carousel
  useEffect(() => {
    if (events.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [events.length]);

  if (!currentEvent || !primaryMarket) return null;

  const outcomes = parseOutcomes(primaryMarket.outcomes);
  const outcomePrices = parseOutcomePrices(primaryMarket.outcomePrices);
  const outcomeColors = parseOutcomeColors(primaryMarket.outcomeColors);

  // Use live prices if available, otherwise use static prices
  const livePrice = livePrices.get(primaryMarket.id);
  const price0 = livePrice ? livePrice[0] : parseFloat(outcomePrices[0] || "0.50");
  const price1 = livePrice ? livePrice[1] : parseFloat(outcomePrices[1] || "0.50");
  const percent0 = Math.round(price0 * 100);
  const percent1 = Math.round(price1 * 100);
  const isLive = sseStatus === "connected";

  const chartData = generateChartData(percent0, percent1);

  // Handle outcome button click
  const handleOutcomeClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedOutcomeIndex(index);
    setBetModalOpen(true);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + events.length) % events.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % events.length);
  };

  // Calculate estimated payouts ($100 bet)
  const estimatedPayout0 = price0 > 0 ? Math.round(100 / price0) : 0;
  const estimatedPayout1 = price1 > 0 ? Math.round(100 / price1) : 0;

  return (
    <>
      <div className="relative mb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentEvent.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-card overflow-hidden"
          >
            <Link
              href={getMarketUrl(currentEvent.slug)}
              className="block group"
            >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {/* Left Side - Event Info */}
              <div className="p-6 flex flex-col">
                {/* Header: Logo + Category */}
                <div className="flex items-start gap-4 mb-4">
                  {/* Event Logo */}
                  <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-muted/50 flex-shrink-0 border border-white/10">
                    {currentEvent.logoUrl ? (
                      <Image
                        src={currentEvent.logoUrl}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Category Badge */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
                        LIVE
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {currentEvent.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors">
                      {currentEvent.title}
                    </h2>
                  </div>
                </div>

                {/* Outcome Buttons */}
                <div className="flex items-stretch gap-2 mb-4">
                  {outcomes.slice(0, 2).map((outcome, index) => {
                    const percent = index === 0 ? percent0 : percent1;
                    const payout = index === 0 ? estimatedPayout0 : estimatedPayout1;
                    const color = outcomeColors[index] || "#888";

                    return (
                      <motion.button
                        key={index}
                        onClick={(e) => handleOutcomeClick(e, index)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-lg border-2 transition-colors",
                          index === 0
                            ? "bg-outcome-yes/10 border-outcome-yes/50 hover:border-outcome-yes hover:bg-outcome-yes/20"
                            : "bg-outcome-no/10 border-outcome-no/50 hover:border-outcome-no hover:bg-outcome-no/20"
                        )}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {outcome.length > 6
                              ? outcome.substring(0, 3).toUpperCase()
                              : outcome}
                          </span>
                          <motion.span
                            key={`${index}-${percent}`}
                            initial={{ scale: 1.1, color: "#fff" }}
                            animate={{ scale: 1, color }}
                            className="text-lg font-bold tabular-nums"
                            style={{ color }}
                          >
                            {percent}%
                          </motion.span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          $100 → <span className="text-foreground font-medium">${payout}</span>
                        </p>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Description / News */}
                {currentEvent.description && (
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">News</span>
                      {" · "}
                      <span className="line-clamp-2">{currentEvent.description}</span>
                    </p>
                  </div>
                )}

                {/* Footer: Volume + Carousel Navigation */}
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold">
                      {formatVolume(currentEvent._aggregations.totalVolume)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>More markets</span>
                    </button>
                  </div>

                  {/* Carousel Navigation */}
                  {events.length > 1 && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          goToPrev();
                        }}
                        className="h-7 w-7 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                        aria-label="Previous event"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* Dots */}
                      <div className="flex items-center gap-1.5">
                        {events.map((_, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCurrentIndex(index);
                            }}
                            className={cn(
                              "h-2 w-2 rounded-full transition-all",
                              index === currentIndex
                                ? "bg-primary w-4"
                                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                            )}
                            aria-label={`Go to event ${index + 1}`}
                          />
                        ))}
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          goToNext();
                        }}
                        className="h-7 w-7 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                        aria-label="Next event"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Chart */}
              <div className="relative border-l border-border/50 bg-muted/5">
                {/* Top: Countdown + Date + Live indicator */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Begins in</span>
                    <span className="font-semibold">{countdown}</span>
                    {currentEvent.startTime && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {formatDateTime(new Date(currentEvent.startTime))}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isLive ? (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <Wifi className="h-3 w-3" />
                        <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <WifiOff className="h-3 w-3" />
                      </span>
                    )}
                    <span className="text-lg font-bold text-primary">
                      Vault
                    </span>
                  </div>
                </div>

                {/* Price Labels */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 space-y-4">
                  {outcomes.slice(0, 2).map((outcome, index) => {
                    const percent = index === 0 ? percent0 : percent1;
                    const color = outcomeColors[index] || (index === 0 ? "#22C55E" : "#EF4444");

                    return (
                      <div key={index} className="text-right">
                        <p className="text-xs text-muted-foreground">{outcome}</p>
                        <p
                          className="text-xl font-bold tabular-nums"
                          style={{ color }}
                        >
                          {percent}%
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Chart */}
                <div className="h-[220px] pt-12 pb-4 pr-20 pl-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) => `${v}%`}
                        width={35}
                        tickCount={5}
                      />
                      <Tooltip content={<CustomTooltip outcomes={outcomes} />} />
                      <Line
                        type="monotone"
                        dataKey="price0"
                        stroke={outcomeColors[0] || "#22C55E"}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="price1"
                        stroke={outcomeColors[1] || "#EF4444"}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Quick Bet Modal */}
      <QuickBetModal
        open={betModalOpen}
        onOpenChange={setBetModalOpen}
        event={currentEvent}
        market={primaryMarket}
        selectedOutcomeIndex={selectedOutcomeIndex}
      />
    </>
  );
}
