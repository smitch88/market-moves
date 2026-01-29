"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Market } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { getOutcomeColors } from "@/lib/outcome-colors";

interface MarketChartProps {
  market: Market & { event?: { slug: string } };
  selectedOutcome?: number | null;
}

type TimePeriod = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

const TIME_PERIODS: TimePeriod[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

interface PriceSnapshot {
  price0: number;
  price1: number;
  pool0: number;
  pool1: number;
  timestamp: string;
}

interface ChartDataPoint {
  time: string;
  price0: number;
  price1: number;
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

function formatTimestamp(timestamp: string, period: TimePeriod): string {
  const date = new Date(timestamp);
  
  switch (period) {
    case "1H":
    case "6H":
    case "1D":
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    case "1W":
    case "1M":
    case "ALL":
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

// Generate mock data when no real data is available
function generateMockData(
  currentPrice0: number,
  currentPrice1: number,
  period: TimePeriod
): ChartDataPoint[] {
  const now = new Date();
  const points: ChartDataPoint[] = [];

  let numPoints: number;
  let intervalMs: number;

  switch (period) {
    case "1H":
      numPoints = 12;
      intervalMs = 5 * 60 * 1000;
      break;
    case "6H":
      numPoints = 12;
      intervalMs = 30 * 60 * 1000;
      break;
    case "1D":
      numPoints = 24;
      intervalMs = 60 * 60 * 1000;
      break;
    case "1W":
      numPoints = 7;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case "1M":
      numPoints = 30;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case "ALL":
      numPoints = 60;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
  }

  for (let i = numPoints - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * intervalMs);
    const progress = (numPoints - i) / numPoints;
    const basePrice0 = currentPrice0 - 15 + Math.random() * 10;
    const variation0 = (Math.random() - 0.5) * 8;
    const price0 = Math.max(5, Math.min(95, basePrice0 + variation0 + (currentPrice0 - basePrice0) * progress));
    const price1 = 100 - price0;

    points.push({
      time: formatTimestamp(time.toISOString(), period),
      price0: Math.round(price0),
      price1: Math.round(price1),
    });
  }

  if (points.length > 0) {
    points[points.length - 1] = {
      time: points[points.length - 1]!.time,
      price0: Math.round(currentPrice0 * 100),
      price1: Math.round(currentPrice1 * 100),
    };
  }

  return points;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
  outcomes: string[];
}

function CustomTooltip({ active, payload, label, outcomes }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-foreground font-medium">
            {outcomes[index] || `Outcome ${index + 1}`}:
          </span>
          <span className="font-bold tabular-nums">{entry.value}%</span>
        </div>
      ))}
    </div>
  );
}

export function MarketChart({ market, selectedOutcome }: MarketChartProps) {
  const [activePeriod, setActivePeriod] = useState<TimePeriod>("1D");
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const outcomeColors = getOutcomeColors(outcomes);

  const price0 = parseFloat(outcomePrices[0] || "0.50");
  const price1 = parseFloat(outcomePrices[1] || "0.50");
  const percent0 = Math.round(price0 * 100);
  const percent1 = Math.round(price1 * 100);

  // Fetch price history when period changes
  useEffect(() => {
    async function fetchPriceHistory() {
      setIsLoading(true);
      setError(null);

      try {
        // Use event slug if available, otherwise use a placeholder
        const slug = market.event?.slug || "unknown";
        const url = `/api/markets/${slug}/history?period=${activePeriod}&marketId=${market.id}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error("Failed to fetch price history");
        }

        const data = await response.json();
        setSnapshots(data.snapshots || []);
      } catch (err) {
        console.error("Error fetching price history:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setSnapshots([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPriceHistory();
  }, [market.id, market.event?.slug, activePeriod]);

  // Append real-time price updates to chart data
  useEffect(() => {
    // When prices change, add a new data point to show real-time updates
    const now = new Date();
    if (snapshots.length > 0 && !isLoading) {
      const lastSnapshot = snapshots[snapshots.length - 1];
      const lastPrice0 = lastSnapshot?.price0 || 0.5;
      const lastPrice1 = lastSnapshot?.price1 || 0.5;
      
      // Only add if prices have actually changed
      if (Math.abs(lastPrice0 - price0) > 0.001 || Math.abs(lastPrice1 - price1) > 0.001) {
        setSnapshots(prev => [
          ...prev,
          {
            price0,
            price1,
            pool0: 0, // We don't have pool data from props
            pool1: 0,
            timestamp: now.toISOString(),
          }
        ]);
        setLastUpdateTime(now);
      }
    }
  }, [price0, price1, isLoading]); // Only depend on prices, not snapshots

  // Transform snapshots to chart data, or use mock data as fallback
  const chartData = useMemo((): ChartDataPoint[] => {
    if (snapshots.length === 0) {
      // No real data, generate mock data
      return generateMockData(price0, price1, activePeriod);
    }

    // Use real data
    return snapshots.map((snapshot) => ({
      time: formatTimestamp(snapshot.timestamp, activePeriod),
      price0: Math.round(snapshot.price0 * 100),
      price1: Math.round(snapshot.price1 * 100),
    }));
  }, [snapshots, price0, price1, activePeriod]);

  // Calculate Y-axis domain with some padding
  const yMin = Math.max(0, Math.min(...chartData.map((d) => Math.min(d.price0, d.price1))) - 10);
  const yMax = Math.min(100, Math.max(...chartData.map((d) => Math.max(d.price0, d.price1))) + 10);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="pt-4 space-y-4">
        {/* Current Prices Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {outcomes.map((outcome, index) => {
              const percent = index === 0 ? percent0 : percent1;
              const color = outcomeColors[index] || (index === 0 ? "#3B82F6" : "#EF4444");
              const isSelected = selectedOutcome === index;

              return (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className={cn(
                      "font-medium text-sm",
                      isSelected && "text-primary"
                    )}
                  >
                    {outcome}
                  </span>
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color }}
                  >
                    {percent}%
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {lastUpdateTime && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
            {snapshots.length === 0 && !isLoading && (
              <span className="text-xs text-muted-foreground">Simulated data</span>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="h-[200px] w-full relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                domain={[yMin, yMax]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) => `${value}%`}
                width={45}
              />
              <ReferenceLine
                y={50}
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              <Tooltip
                content={<CustomTooltip outcomes={outcomes} />}
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="price0"
                stroke={outcomeColors[0] || "#3B82F6"}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: outcomeColors[0] || "#3B82F6",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
              <Line
                type="monotone"
                dataKey="price1"
                stroke={outcomeColors[1] || "#EF4444"}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: outcomeColors[1] || "#EF4444",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Period Selector */}
        <div className="flex items-center justify-end gap-1">
          {TIME_PERIODS.map((period) => (
            <button
              key={period}
              onClick={(e) => {
                e.stopPropagation();
                setActivePeriod(period);
              }}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                activePeriod === period
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
