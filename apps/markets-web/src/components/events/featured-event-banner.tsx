"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
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
import type { Event, MarketCategory, EventType } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { getMarketUrl } from "@/lib/urls";
import { useMarketUpdates, type PriceUpdate } from "@/hooks/use-market-updates";
import { getOutcomeColors } from "@/lib/outcome-colors";
import { QuickBetModal, type MarketData } from "./quick-bet-modal";

// Partial market data that we receive from the featured events query
interface FeaturedMarket {
  id: string;
  question: string;
  outcomes: string;
  outcomePrices: string;
  pool0: number;
  pool1: number;
  seed0: number;
  seed1: number;
  closesAt?: string | null;
  _count?: { bets: number };
}

// Serialized event type (dates as strings from API)
type SerializedEvent = Omit<Event, 'createdAt' | 'updatedAt' | 'startTime' | 'endTime'> & {
  createdAt: string | null;
  updatedAt: string | null;
  startTime: string | null;
  endTime: string | null;
};

interface FeaturedEventBannerProps {
  events: Array<
    SerializedEvent & {
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
  const [livePrices, setLivePrices] = useState<Map<string, [number, number]>>(new Map());
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number | null>(null);
  
  const { authenticated, login } = usePrivy();

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
  const outcomeColors = getOutcomeColors(outcomes);

  // Use live prices if available, otherwise use static prices
  const livePrice = livePrices.get(primaryMarket.id);
  const price0 = livePrice ? livePrice[0] : parseFloat(outcomePrices[0] || "0.50");
  const price1 = livePrice ? livePrice[1] : parseFloat(outcomePrices[1] || "0.50");
  const percent0 = Math.round(price0 * 100);
  const percent1 = Math.round(price1 * 100);
  const isLive = sseStatus === "connected";

  const chartData = generateChartData(percent0, percent1);

  // Convert FeaturedMarket to MarketData format for the modal
  const getMarketDataForModal = useMemo((): MarketData | null => {
    if (!primaryMarket) return null;
    
    const pool0 = Number(primaryMarket.pool0);
    const pool1 = Number(primaryMarket.pool1);
    const seed0 = Number(primaryMarket.seed0);
    const seed1 = Number(primaryMarket.seed1);
    const total = pool0 + pool1 + seed0 + seed1;
    
    return {
      id: primaryMarket.id,
      question: primaryMarket.question,
      outcomes: primaryMarket.outcomes,
      status: "OPEN",
      closesAt: primaryMarket.closesAt || null,
      stats: {
        percent0: total > 0 ? Math.round(((pool0 + seed0) / total) * 100) : 50,
        percent1: total > 0 ? Math.round(((pool1 + seed1) / total) * 100) : 50,
        totalPool: total,
      },
    };
  }, [primaryMarket]);

  // Handle outcome button click - open bet modal or show login
  const handleOutcomeClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!authenticated) {
      login();
      return;
    }
    
    // Open the bet modal with the selected outcome
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
            className="relative overflow-hidden rounded-lg border bg-white/5 backdrop-blur-md border-white/10 shadow-xl"
          >
            <Link
              href={getMarketUrl(currentEvent.slug)}
              className="block group"
            >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {/* Left Side - Event Info */}
              <div className="p-4 xs:p-6 flex flex-col">
                {/* Header */}
                <div className="mb-3 xs:mb-4">
                  {/* Category Badge */}
                  <div className="flex items-center gap-1.5 xs:gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 xs:gap-1.5 px-1.5 xs:px-2 py-0.5 rounded text-[10px] xs:text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      <span className="h-1 w-1 xs:h-1.5 xs:w-1.5 bg-primary rounded-full animate-pulse" />
                      LIVE
                    </span>
                    <span className="text-[10px] xs:text-xs text-muted-foreground font-medium truncate">
                      {currentEvent.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-base xs:text-xl font-bold leading-tight line-clamp-2">
                    {currentEvent.title}
                  </h2>
                </div>

                {/* Outcome Buttons */}
                <div className="flex items-stretch gap-2 xs:gap-3 mb-4">
                  {outcomes.slice(0, 2).map((outcome, index) => {
                    const percent = index === 0 ? percent0 : percent1;
                    const price = index === 0 ? price0 : price1;
                    const payout = index === 0 ? estimatedPayout0 : estimatedPayout1;

                    return (
                      <div key={index} className="flex-1 min-w-0 flex flex-col gap-2">
                        <motion.button
                          onClick={(e) => handleOutcomeClick(e, index)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "w-full px-2 xs:px-4 py-2 xs:py-3 rounded-xl font-semibold transition-all",
                            index === 0
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-card text-foreground border-2 border-border hover:bg-muted"
                          )}
                        >
                          <div className="flex items-center justify-center gap-1 xs:gap-2 min-w-0">
                            <span className="text-sm xs:text-base truncate min-w-0">
                              {outcome.length > 8
                                ? outcome.substring(0, 6) + "..."
                                : outcome}
                            </span>
                            <span className="text-base xs:text-lg font-bold tabular-nums flex-shrink-0">
                              {Math.round(price * 100)}%
                            </span>
                          </div>
                        </motion.button>
                        <div className="text-center text-xs xs:text-sm">
                          <span className="text-muted-foreground hidden xs:inline">$100 → </span>
                          <span className="font-semibold text-primary">
                            ${payout}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Description / News */}
                {currentEvent.description && (
                  <div className="mb-3 xs:mb-4">
                    <p className="text-xs xs:text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">News</span>
                      {" · "}
                      <span className="line-clamp-2">{currentEvent.description}</span>
                    </p>
                  </div>
                )}

                {/* Footer: Volume + Carousel Navigation */}
                <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 xs:gap-4 min-w-0">
                    <span className="text-xs xs:text-sm font-semibold flex-shrink-0">
                      {formatVolume(currentEvent._aggregations.totalVolume)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="hidden xs:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>More markets</span>
                    </button>
                  </div>

                  {/* Carousel Navigation */}
                  {events.length > 1 && (
                    <div className="flex items-center gap-1.5 xs:gap-3 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          goToPrev();
                        }}
                        className="h-6 w-6 xs:h-7 xs:w-7 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                        aria-label="Previous event"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                      </button>

                      {/* Dots */}
                      <div className="flex items-center gap-1 xs:gap-1.5">
                        {events.map((_, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCurrentIndex(index);
                            }}
                            className={cn(
                              "h-1.5 w-1.5 xs:h-2 xs:w-2 rounded-full transition-all",
                              index === currentIndex
                                ? "bg-primary w-3 xs:w-4"
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
                        className="h-6 w-6 xs:h-7 xs:w-7 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                        aria-label="Next event"
                      >
                        <ChevronRight className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Chart */}
              <div className="relative border-l border-border/50 bg-muted/5 p-3 xs:p-4 flex flex-col">
                {/* Top: Countdown + Date + Live indicator */}
                <div className="flex items-center justify-between mb-2 xs:mb-3 gap-2">
                  <div className="flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm min-w-0">
                    <Clock className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground hidden xs:inline">Begins in</span>
                    <span className="font-semibold truncate">{countdown}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
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
                  </div>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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
                        width={30}
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

                {/* Legend at bottom */}
                <div className="flex items-center justify-center gap-3 xs:gap-6 mt-2 xs:mt-3 pt-2 xs:pt-3 border-t border-border/30">
                  {outcomes.slice(0, 2).map((outcome, index) => {
                    const percent = index === 0 ? percent0 : percent1;
                    const color = outcomeColors[index] || (index === 0 ? "#22C55E" : "#EF4444");

                    return (
                      <div key={index} className="flex items-center gap-1 xs:gap-2 min-w-0">
                        <div
                          className="h-2 w-2 xs:h-2.5 xs:w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs xs:text-sm text-muted-foreground truncate max-w-[60px] xs:max-w-none">{outcome}</span>
                        <span
                          className="text-xs xs:text-sm font-bold tabular-nums flex-shrink-0"
                          style={{ color }}
                        >
                          {percent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Quick Bet Modal - skips to amount step with pre-selected market and outcome */}
      <QuickBetModal
        open={betModalOpen}
        onOpenChange={setBetModalOpen}
        eventId={currentEvent.id}
        eventTitle={currentEvent.title}
        initialMarket={getMarketDataForModal}
        initialOutcome={selectedOutcomeIndex}
      />
    </>
  );
}
