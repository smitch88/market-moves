"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Badge,
  Button,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from "@vault/ui";
import {
  Loader2,
  Plus,
  RefreshCw,
  TrendingUp,
  Settings,
  Play,
  Clock,
  Coins,
} from "lucide-react";
import { ImageUpload } from "@/components/admin";

const TIMEFRAME_OPTIONS = [
  { value: 1, label: "1 minute" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 60, label: "1 hour" },
  { value: 360, label: "6 hours" },
  { value: 1440, label: "1 day" },
  { value: 10080, label: "1 week" },
  { value: 43200, label: "1 month" },
];

const CATEGORY_OPTIONS = [
  "CRYPTO",
  "FINANCE",
  "NFL",
  "NBA",
  "POLITICS",
  "ENTERTAINMENT",
  "OTHER",
] as const;

interface AutoMarketConfig {
  id: string;
  name: string;
  isActive: boolean;
  tokenSymbol: string;
  tokenName: string;
  coingeckoId: string;
  chain: string | null;
  timeframeMinutes: number;
  timeframeLabel: string;
  feeBps: number;
  seed0: { toString(): string };
  seed1: { toString(): string };
  category: string;
  cronExpression: string | null;
  lastCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { markets: number };
}

export default function AdminAutoMarketsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tokenSymbol: "",
    tokenName: "",
    coingeckoId: "",
    chain: "",
    timeframeMinutes: 15,
    timeframeLabel: "15 minutes",
    feeBps: 100,
    seed0: 100000,
    seed1: 100000,
    category: "CRYPTO" as const,
    eventBannerUrl: "",
    eventLogoUrl: "",
    isActive: true,
  });

  const { data, isLoading } = useQuery<{ configs: AutoMarketConfig[] }>({
    queryKey: ["adminAutoMarketConfigs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/auto-market-configs");
      if (!res.ok) throw new Error("Failed to fetch configs");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/auto-market-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          tokenSymbol: form.tokenSymbol,
          tokenName: form.tokenName,
          coingeckoId: form.coingeckoId,
          chain: form.chain || undefined,
          timeframeMinutes: form.timeframeMinutes,
          timeframeLabel: form.timeframeLabel,
          feeBps: form.feeBps,
          seed0: form.seed0,
          seed1: form.seed1,
          category: form.category,
          eventBannerUrl: form.eventBannerUrl || undefined,
          eventLogoUrl: form.eventLogoUrl || undefined,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Config created");
      queryClient.invalidateQueries({ queryKey: ["adminAutoMarketConfigs"] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const runCreateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/jobs/create-auto-markets", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `Created ${data.summary?.created ?? 0} market(s) in ${data.summary?.durationMs ?? 0}ms`
      );
      queryClient.invalidateQueries({ queryKey: ["adminAutoMarketConfigs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const runProcessMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/jobs/process-auto-markets", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `Processed ${data.summary?.processed ?? 0} market(s) in ${data.summary?.durationMs ?? 0}ms`
      );
      queryClient.invalidateQueries({ queryKey: ["adminAutoMarketConfigs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/auto-market-configs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success(variables.isActive ? "Config activated" : "Config deactivated");
      queryClient.invalidateQueries({ queryKey: ["adminAutoMarketConfigs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function resetForm() {
    setForm({
      name: "",
      tokenSymbol: "",
      tokenName: "",
      coingeckoId: "",
      chain: "",
      timeframeMinutes: 15,
      timeframeLabel: "15 minutes",
      feeBps: 100,
      seed0: 100000,
      seed1: 100000,
      category: "CRYPTO",
      eventBannerUrl: "",
      eventLogoUrl: "",
      isActive: true,
    });
  }

  function onTimeframeChange(minutes: number) {
    const label = TIMEFRAME_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} minutes`;
    setForm((p) => ({ ...p, timeframeMinutes: minutes, timeframeLabel: label }));
  }

  const configs = data?.configs ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            Auto Markets
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Crypto price markets: Over/Under the opening price. Created and resolved by cron.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => runCreateMutation.mutate()}
            disabled={runCreateMutation.isPending}
          >
            {runCreateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run create now
          </Button>
          <Button
            variant="outline"
            onClick={() => runProcessMutation.mutate()}
            disabled={runProcessMutation.isPending}
          >
            {runProcessMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run process now
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New config
          </Button>
        </div>
      </div>

      <GlassCard variant="solid">
        <GlassCardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Create configs per token and timeframe (1m to monthly). Cron creates markets every 5 min and processes expired ones every minute. Use &quot;Run create now&quot; / &quot;Run process now&quot; to trigger manually.
          </p>
        </GlassCardContent>
      </GlassCard>

      <GlassCard variant="solid">
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Configs ({configs.length})</h2>
        </GlassCardHeader>
        <GlassCardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No configs yet</p>
              <p className="text-sm">Add one to start creating auto-markets</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New config
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-lg border border-border bg-card/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={`/admin/auto-markets/${c.id}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{c.name}</h3>
                        {c.chain && (
                          <Badge variant="outline" className="text-muted-foreground">
                            {c.chain}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {c.tokenName} ({c.tokenSymbol}) · {c.timeframeLabel}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                        <span>CoinGecko: <code className="bg-muted px-1 py-0.5 rounded">{c.coingeckoId}</code></span>
                        <span>{c._count.markets} markets</span>
                        {c.lastCreatedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last created {formatDistanceToNow(new Date(c.lastCreatedAt), { addSuffix: true })}
                          </span>
                        )}
                      </p>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={c.isActive}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: c.id, isActive: checked })
                          }
                          disabled={toggleActiveMutation.isPending}
                        />
                        <span className={`text-xs font-medium ${c.isActive ? "text-green-500" : "text-muted-foreground"}`}>
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <Link href={`/admin/auto-markets/${c.id}`}>
                        <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              New auto-market config
            </DialogTitle>
            <DialogDescription>
              Add a token and timeframe. Markets will be created and resolved automatically.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="BTC 15min"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tokenSymbol">Token symbol *</Label>
                <Input
                  id="tokenSymbol"
                  value={form.tokenSymbol}
                  onChange={(e) => setForm((p) => ({ ...p, tokenSymbol: e.target.value.toUpperCase() }))}
                  placeholder="BTC"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tokenName">Token name *</Label>
                <Input
                  id="tokenName"
                  value={form.tokenName}
                  onChange={(e) => setForm((p) => ({ ...p, tokenName: e.target.value }))}
                  placeholder="Bitcoin"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coingeckoId">CoinGecko ID *</Label>
                <Input
                  id="coingeckoId"
                  value={form.coingeckoId}
                  onChange={(e) => setForm((p) => ({ ...p, coingeckoId: e.target.value }))}
                  placeholder="bitcoin"
                  required
                />
                <p className="text-xs text-muted-foreground">e.g. bitcoin, ethereum, solana</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chain">Chain (optional)</Label>
              <Input
                id="chain"
                value={form.chain}
                onChange={(e) => setForm((p) => ({ ...p, chain: e.target.value }))}
                placeholder="Ethereum"
              />
            </div>
            <ImageUpload
              label="Event banner (optional)"
              value={form.eventBannerUrl}
              onChange={(url) => setForm((p) => ({ ...p, eventBannerUrl: url }))}
              folder="auto-markets"
              aspectRatio="banner"
            />
            <ImageUpload
              label="Event logo (optional)"
              value={form.eventLogoUrl}
              onChange={(url) => setForm((p) => ({ ...p, eventLogoUrl: url }))}
              folder="auto-markets"
              aspectRatio="square"
            />
            <div className="space-y-2">
              <Label>Timeframe *</Label>
              <Select
                value={String(form.timeframeMinutes)}
                onValueChange={(v) => onTimeframeChange(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feeBps">Fee (bps)</Label>
                <Input
                  id="feeBps"
                  type="number"
                  min={0}
                  max={10000}
                  value={form.feeBps}
                  onChange={(e) => setForm((p) => ({ ...p, feeBps: Number(e.target.value) || 100 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((p) => ({ ...p, category: v as typeof form.category }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
              <Label htmlFor="isActive">Active (cron will create markets)</Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create config
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
