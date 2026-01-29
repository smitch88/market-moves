"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@vault/ui/lib/utils";
import { formatMoney, TimeRange, TIME_RANGE_MS } from "./profile-utils";

export interface PnLDataPoint {
  timestamp: string;
  value: number;
}

export interface PnLChartProps {
  /** Total PnL value to display */
  totalPnL: number;
  /** Raw PnL history data points */
  pnlHistory?: Array<{
    timestamp: string;
    realizedPnL: number;
    unrealizedPnL: number;
  }>;
  /** Pre-computed chart data (for simple mode) */
  chartData?: Array<{ date: string; timestamp: string; value: number }>;
  /** Enable interactive hover mode with value updates in header */
  interactive?: boolean;
  /** Custom label for the time range display */
  timeRangeLabel?: string;
}

interface ChartDataPoint {
  date: string;
  timestamp: string;
  value: number;
}

function ChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0].value;
  const timestamp = payload[0].payload.timestamp;
  const time = format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-xl">
      <div className="text-xs text-muted-foreground mb-1">{time}</div>
      <div
        className={cn(
          "font-mono font-semibold text-base",
          value >= 0 ? "text-green-500" : "text-red-500"
        )}
      >
        {value >= 0 ? "+" : ""}$
        {value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
}

export function PnLChart({
  totalPnL,
  pnlHistory,
  chartData: precomputedChartData,
  interactive = false,
  timeRangeLabel,
}: PnLChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [hoveredPnL, setHoveredPnL] = useState<{
    value: number;
    timestamp: string;
  } | null>(null);

  const isPositive = totalPnL >= 0;

  // Use hovered value if available and interactive mode, otherwise show the total
  const displayPnL = interactive && hoveredPnL ? hoveredPnL.value : totalPnL;
  const displayIsPositive = displayPnL >= 0;

  // Generate chart data from pnlHistory if not precomputed
  const generateChartData = (): ChartDataPoint[] => {
    if (precomputedChartData) {
      return precomputedChartData;
    }

    if (!pnlHistory || pnlHistory.length === 0) {
      return [];
    }

    const now = Date.now();

    // Get sorted raw data points within range
    const rawChartData = pnlHistory
      .filter((point) => {
        if (timeRange === "ALL") return true;
        return now - new Date(point.timestamp).getTime() <= TIME_RANGE_MS[timeRange];
      })
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      .map((point) => ({
        timestamp: new Date(point.timestamp).getTime(),
        value: point.realizedPnL + point.unrealizedPnL,
      }));

    // Determine time range boundaries
    const rangeStart =
      timeRange === "ALL"
        ? rawChartData.length > 0
          ? rawChartData[0].timestamp
          : now - 7 * 24 * 60 * 60 * 1000
        : now - TIME_RANGE_MS[timeRange];
    const rangeEnd = now;

    // Number of points based on time range
    const pointCount: Record<TimeRange, number> = {
      "1D": 24, // 1 per hour
      "1W": 42, // 1 every 4 hours
      "1M": 30, // 1 per day
      ALL: Math.min(90, Math.max(30, rawChartData.length * 2)), // Dynamic
    };

    const numPoints = pointCount[timeRange];
    const interval = (rangeEnd - rangeStart) / numPoints;
    const points: ChartDataPoint[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const pointTime = rangeStart + i * interval;

      // Find the latest P&L value at or before this point
      let value = 0;
      for (const dataPoint of rawChartData) {
        if (dataPoint.timestamp <= pointTime) {
          value = dataPoint.value;
        } else {
          break;
        }
      }

      points.push({
        date: format(
          new Date(pointTime),
          timeRange === "1D" ? "h:mm a" : "MMM d"
        ),
        timestamp: new Date(pointTime).toISOString(),
        value,
      });
    }

    return points;
  };

  const chartData = generateChartData();
  const hasChartData = chartData.length > 1;

  const getTimeRangeLabel = () => {
    if (interactive && hoveredPnL) {
      return format(new Date(hoveredPnL.timestamp), "MMM d, yyyy 'at' h:mm a");
    }
    if (timeRangeLabel) {
      return timeRangeLabel;
    }
    switch (timeRange) {
      case "1D":
        return "Past 24 Hours";
      case "1W":
        return "Past 7 Days";
      case "1M":
        return "Past 30 Days";
      default:
        return "All-Time";
    }
  };

  return (
    <div className="border border-border rounded-xl p-5">
      {/* Header with P&L value and time range */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                displayIsPositive ? "bg-green-500" : "bg-red-500"
              )}
            />
            Profit/Loss
          </div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums tracking-tight",
              displayIsPositive ? "text-green-500" : "text-red-500"
            )}
          >
            {formatMoney(displayPnL, { showSign: false })}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {getTimeRangeLabel()}
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {(["1D", "1W", "1M", "ALL"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none",
                timeRange === range
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        className="h-[120px] -mx-2"
        onMouseLeave={() => interactive && setHoveredPnL(null)}
      >
        {hasChartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              onMouseMove={
                interactive
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ? (state: any) => {
                      if (state?.activePayload?.[0]?.payload) {
                        const { value, timestamp } =
                          state.activePayload[0].payload;
                        setHoveredPnL({ value, timestamp });
                      }
                    }
                  : undefined
              }
              onMouseLeave={
                interactive ? () => setHoveredPnL(null) : undefined
              }
            >
              <defs>
                <linearGradient
                  id="pnlGradientPositive"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient
                  id="pnlGradientNegative"
                  x1="0"
                  y1="1"
                  x2="0"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              {interactive && (
                <YAxis
                  hide
                  domain={[
                    "dataMin",
                    (dataMax: number) => Math.max(dataMax, 0) * 1.1 || 0.1,
                  ]}
                />
              )}
              <Tooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground))",
                  strokeWidth: 1,
                  ...(interactive ? {} : { strokeDasharray: "4 4" }),
                }}
                content={
                  interactive
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? ({ active, payload }: any) => {
                        if (active && payload?.[0]?.payload) {
                          const { value, timestamp } = payload[0].payload;
                          if (
                            !hoveredPnL ||
                            hoveredPnL.value !== value ||
                            hoveredPnL.timestamp !== timestamp
                          ) {
                            setTimeout(
                              () => setHoveredPnL({ value, timestamp }),
                              0
                            );
                          }
                        }
                        return null;
                      }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    : (props: any) => <ChartTooltipContent {...props} />
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "hsl(var(--primary))" : "#ef4444"}
                strokeWidth={interactive ? 2 : 2.5}
                fill={
                  isPositive
                    ? "url(#pnlGradientPositive)"
                    : "url(#pnlGradientNegative)"
                }
                animationDuration={interactive ? 300 : 800}
                dot={false}
                activeDot={
                  interactive
                    ? {
                        r: 5,
                        fill: isPositive ? "hsl(var(--primary))" : "#ef4444",
                        stroke: "hsl(var(--background))",
                        strokeWidth: 2,
                      }
                    : undefined
                }
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No trading history yet
          </div>
        )}
      </div>
    </div>
  );
}

