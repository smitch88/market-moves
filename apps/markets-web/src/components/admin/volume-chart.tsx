"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Loader2, TrendingUp } from "lucide-react";

type TimeRange = "1D" | "1W" | "1M" | "ALL";

const TIME_RANGE_MS: Record<TimeRange, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  ALL: Infinity,
};

interface VolumeDataPoint {
  timestamp: string;
  volume: number;
  cumulativeVolume: number;
}

interface ChartDataPoint {
  date: string;
  timestamp: string;
  value: number;
}

function formatMoney(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
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
      <div className="font-mono font-semibold text-base text-primary">
        {formatMoney(value)}
      </div>
    </div>
  );
}

export function VolumeChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [hoveredVolume, setHoveredVolume] = useState<{
    value: number;
    timestamp: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["adminVolumeHistory"],
    queryFn: async () => {
      const res = await fetch("/api/admin/volume-history");
      if (!res.ok) throw new Error("Failed to fetch volume history");
      return res.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const volumeHistory: VolumeDataPoint[] = data?.volumeHistory || [];
  const totalVolume: number = data?.totalVolume || 0;

  // Use hovered value if available, otherwise show the total
  const displayVolume = hoveredVolume ? hoveredVolume.value : totalVolume;

  // Generate chart data from volume history
  const generateChartData = (): ChartDataPoint[] => {
    if (volumeHistory.length === 0) {
      return [];
    }

    const now = Date.now();

    // Get sorted raw data points within range
    const rawChartData = volumeHistory
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
        value: point.cumulativeVolume,
      }));

    if (rawChartData.length === 0) return [];

    // Determine time range boundaries
    const rangeStart =
      timeRange === "ALL"
        ? rawChartData[0].timestamp
        : now - TIME_RANGE_MS[timeRange];
    const rangeEnd = now;

    // Number of points based on time range
    const pointCount: Record<TimeRange, number> = {
      "1D": 24,
      "1W": 42,
      "1M": 30,
      ALL: Math.min(90, Math.max(30, rawChartData.length * 2)),
    };

    const numPoints = pointCount[timeRange];
    const interval = (rangeEnd - rangeStart) / numPoints;
    const points: ChartDataPoint[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const pointTime = rangeStart + i * interval;

      // Find the latest volume value at or before this point
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
    if (hoveredVolume) {
      return format(new Date(hoveredVolume.timestamp), "MMM d, yyyy 'at' h:mm a");
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

  if (isLoading) {
    return (
      <div className="border border-border rounded-xl p-5 h-[220px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl p-5">
      {/* Header with Volume value and time range */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Total Market Volume
          </div>
          <div className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {formatMoney(displayVolume)}
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
        onMouseLeave={() => setHoveredVolume(null)}
      >
        {hasChartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onMouseMove={(state: any) => {
                if (state?.activePayload?.[0]?.payload) {
                  const { value, timestamp } = state.activePayload[0].payload;
                  setHoveredVolume({ value, timestamp });
                }
              }}
              onMouseLeave={() => setHoveredVolume(null)}
            >
              <defs>
                <linearGradient
                  id="volumeGradient"
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
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis
                hide
                domain={[
                  0,
                  (dataMax: number) => Math.max(dataMax, 0) * 1.1 || 100,
                ]}
              />
              <Tooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground))",
                  strokeWidth: 1,
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (active && payload?.[0]?.payload) {
                    const { value, timestamp } = payload[0].payload;
                    if (
                      !hoveredVolume ||
                      hoveredVolume.value !== value ||
                      hoveredVolume.timestamp !== timestamp
                    ) {
                      setTimeout(() => setHoveredVolume({ value, timestamp }), 0);
                    }
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#volumeGradient)"
                animationDuration={300}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "hsl(var(--primary))",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No volume data yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
