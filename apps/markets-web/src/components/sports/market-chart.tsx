"use client";

import { useState, useMemo } from "react";
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

interface MarketChartProps {
  market: Market;
  selectedOutcome?: number | null;
}

type TimePeriod = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

const TIME_PERIODS: TimePeriod[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

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
  if (!outcomeColors) return ["#3B82F6", "#EF4444"]; // Blue and red defaults
  try {
    return JSON.parse(outcomeColors);
  } catch {
    return ["#3B82F6", "#EF4444"];
  }
}

// Generate mock historical data for demonstration
function generateMockData(
  currentPrice0: number,
  currentPrice1: number,
  period: TimePeriod
): { time: string; price0: number; price1: number }[] {
  const now = new Date();
  const points: { time: string; price0: number; price1: number }[] = [];

  let numPoints: number;
  let intervalMs: number;
  let formatTime: (date: Date) => string;

  switch (period) {
    case "1H":
      numPoints = 12;
      intervalMs = 5 * 60 * 1000; // 5 minutes
      formatTime = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      break;
    case "6H":
      numPoints = 12;
      intervalMs = 30 * 60 * 1000; // 30 minutes
      formatTime = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      break;
    case "1D":
      numPoints = 24;
      intervalMs = 60 * 60 * 1000; // 1 hour
      formatTime = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      break;
    case "1W":
      numPoints = 7;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      formatTime = (d) => d.toLocaleDateString([], { month: "short", day: "numeric" });
      break;
    case "1M":
      numPoints = 30;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      formatTime = (d) => d.toLocaleDateString([], { month: "short", day: "numeric" });
      break;
    case "ALL":
      numPoints = 60;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      formatTime = (d) => d.toLocaleDateString([], { month: "short", day: "numeric" });
      break;
  }

  // Generate data points working backwards from current price
  for (let i = numPoints - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * intervalMs);
    
    // Add some random variation, trending towards current price
    const progress = (numPoints - i) / numPoints;
    const basePrice0 = currentPrice0 - 15 + Math.random() * 10;
    const variation0 = (Math.random() - 0.5) * 8;
    const price0 = Math.max(5, Math.min(95, basePrice0 + variation0 + (currentPrice0 - basePrice0) * progress));
    const price1 = 100 - price0;

    points.push({
      time: formatTime(time),
      price0: Math.round(price0),
      price1: Math.round(price1),
    });
  }

  // Ensure last point matches current prices
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

  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const outcomeColors = parseOutcomeColors(market.outcomeColors);

  const price0 = parseFloat(outcomePrices[0] || "0.50");
  const price1 = parseFloat(outcomePrices[1] || "0.50");
  const percent0 = Math.round(price0 * 100);
  const percent1 = Math.round(price1 * 100);

  // Generate mock data based on current prices and selected period
  const chartData = useMemo(
    () => generateMockData(price0, price1, activePeriod),
    [price0, price1, activePeriod]
  );

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
        </div>

        {/* Chart */}
        <div className="h-[200px] w-full">
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
              onClick={() => setActivePeriod(period)}
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
