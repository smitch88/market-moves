"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Input,
  toast,
  Skeleton,
} from "@vault/ui";
import { Save, RefreshCw, Shield, Clock, TrendingDown, Zap } from "lucide-react";

// Simple Card components for admin UI
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
}

function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}

function CardDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-muted-foreground ${className}`}>{children}</p>;
}

function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

interface XPConfig {
  xpPerDollar: number;
  dailyXpCap: number;
  marketCooldownSeconds: number;
  marketVolumeThreshold: number;
}

interface XPStats {
  totalXPAwarded: number;
  usersWithXP: number;
  averageXP: number;
  medianLevel: number;
}

interface DailyStat {
  date: string;
  totalXpAwarded: number;
  uniqueUsers: number;
  totalTrades: number;
}

export default function AdminXPPage() {
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<XPConfig | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-xp-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/xp/config");
      if (!res.ok) throw new Error("Failed to fetch XP config");
      return res.json() as Promise<{
        config: XPConfig;
        stats: XPStats;
        dailyStats: DailyStat[];
      }>;
    },
  });

  // Initialize local config when data loads
  if (data?.config && !localConfig) {
    setLocalConfig(data.config);
  }

  const updateMutation = useMutation({
    mutationFn: async (config: Partial<XPConfig>) => {
      const res = await fetch("/api/admin/xp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to update config");
      return res.json();
    },
    onSuccess: () => {
      toast.success("XP configuration updated");
      queryClient.invalidateQueries({ queryKey: ["admin-xp-config"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    },
  });

  const handleSave = () => {
    if (!localConfig) return;
    updateMutation.mutate(localConfig);
  };

  const handleReset = () => {
    if (data?.config) {
      setLocalConfig(data.config);
    }
  };

  const hasChanges = localConfig && data?.config && (
    localConfig.xpPerDollar !== data.config.xpPerDollar ||
    localConfig.dailyXpCap !== data.config.dailyXpCap ||
    localConfig.marketCooldownSeconds !== data.config.marketCooldownSeconds ||
    localConfig.marketVolumeThreshold !== data.config.marketVolumeThreshold
  );

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">
          Failed to load XP configuration
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">XP Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage XP rewards and anti-abuse protections
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || updateMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))
        ) : data?.stats ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {data.stats.totalXPAwarded.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total XP Awarded</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {data.stats.usersWithXP.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Users with XP</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {data.stats.averageXP.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Average XP</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  Level {data.stats.medianLevel}
                </div>
                <div className="text-sm text-muted-foreground">Median Level</div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Configuration Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* XP Rate */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <CardTitle>XP Rate</CardTitle>
            </div>
            <CardDescription>
              Amount of XP awarded per $1 of trading volume
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  value={localConfig?.xpPerDollar ?? ""}
                  onChange={(e) =>
                    setLocalConfig((prev) =>
                      prev ? { ...prev, xpPerDollar: parseInt(e.target.value) || 0 } : null
                    )
                  }
                  min={1}
                  max={100}
                  className="w-32"
                />
                <span className="text-muted-foreground">XP per $1 volume</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Current: $100 bet = {((localConfig?.xpPerDollar ?? 10) * 100).toLocaleString()} XP
            </p>
          </CardContent>
        </Card>

        {/* Daily Cap */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <CardTitle>Daily XP Cap</CardTitle>
            </div>
            <CardDescription>
              Maximum XP a user can earn per day from trading
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  value={localConfig?.dailyXpCap ?? ""}
                  onChange={(e) =>
                    setLocalConfig((prev) =>
                      prev ? { ...prev, dailyXpCap: parseInt(e.target.value) || 0 } : null
                    )
                  }
                  min={1000}
                  max={1000000}
                  className="w-40"
                />
                <span className="text-muted-foreground">XP per day</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Equivalent to ${((localConfig?.dailyXpCap ?? 50000) / (localConfig?.xpPerDollar ?? 10)).toLocaleString()} daily volume
            </p>
          </CardContent>
        </Card>

        {/* Market Cooldown */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <CardTitle>Market Cooldown</CardTitle>
            </div>
            <CardDescription>
              Time before a user can earn XP again in the same market
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  value={localConfig?.marketCooldownSeconds ?? ""}
                  onChange={(e) =>
                    setLocalConfig((prev) =>
                      prev ? { ...prev, marketCooldownSeconds: parseInt(e.target.value) || 0 } : null
                    )
                  }
                  min={0}
                  max={3600}
                  className="w-32"
                />
                <span className="text-muted-foreground">seconds</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {localConfig?.marketCooldownSeconds
                ? `${Math.floor((localConfig.marketCooldownSeconds) / 60)} minutes ${(localConfig.marketCooldownSeconds) % 60} seconds`
                : "No cooldown"}
            </p>
          </CardContent>
        </Card>

        {/* Volume Threshold */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-purple-500" />
              <CardTitle>Diminishing Returns</CardTitle>
            </div>
            <CardDescription>
              Volume per tier before XP rate decreases (fairer than trade count)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={localConfig?.marketVolumeThreshold ?? ""}
                  onChange={(e) =>
                    setLocalConfig((prev) =>
                      prev ? { ...prev, marketVolumeThreshold: parseInt(e.target.value) || 0 } : null
                    )
                  }
                  min={10}
                  max={10000}
                  className="w-32"
                />
                <span className="text-muted-foreground">per tier</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              XP rate decreases per ${localConfig?.marketVolumeThreshold ?? 100} traded: 100% → 80% → 60% → 40% → 20% → 0%
            </p>
            <p className="text-xs text-muted-foreground">
              Total cap: ${((localConfig?.marketVolumeThreshold ?? 100) * 5).toLocaleString()} per market/day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Stats Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily XP Activity (Last 7 Days)</CardTitle>
          <CardDescription>
            XP awarded and trading activity per day
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : data?.dailyStats && data.dailyStats.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                <div>Date</div>
                <div className="text-right">XP Awarded</div>
                <div className="text-right">Users</div>
                <div className="text-right">Trades</div>
              </div>
              {data.dailyStats.map((day) => (
                <div key={day.date} className="grid grid-cols-4 gap-4 text-sm">
                  <div>{new Date(day.date).toLocaleDateString()}</div>
                  <div className="text-right font-medium">
                    {day.totalXpAwarded.toLocaleString()}
                  </div>
                  <div className="text-right">{day.uniqueUsers}</div>
                  <div className="text-right">{day.totalTrades}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No activity data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Protection Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>Anti-Abuse Protections</CardTitle>
          <CardDescription>
            How the XP system prevents wash trading and abuse
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                Daily XP Cap
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Users can only earn up to {(localConfig?.dailyXpCap ?? 50000).toLocaleString()} XP per day,
                preventing unlimited farming.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Market Cooldown
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                After trading in a market, users must wait {localConfig?.marketCooldownSeconds ?? 300} seconds
                before earning XP from that market again.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-purple-500" />
                Volume-Based Diminishing Returns
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                XP rate decreases based on cumulative volume per market per day.
                After ${((localConfig?.marketVolumeThreshold ?? 100) * 5).toLocaleString()}, no more XP from that market.
                This is fairer than trade count—$100 in one trade = $100 in 5 trades.
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <h4 className="font-semibold text-amber-600 dark:text-amber-400">
              Note: XP is only earned on buys, not sells
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              Selling shares does not award XP. This prevents wash trading where users
              would buy and sell repeatedly to farm XP without taking real positions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
