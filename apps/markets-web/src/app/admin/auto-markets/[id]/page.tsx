"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Badge,
  Button,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Input,
  Label,
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
  ArrowLeft,
  TrendingUp,
  CheckCircle,
  XCircle,
  Save,
  Clock,
  Coins,
} from "lucide-react";
import { ImageUpload } from "@/components/admin";

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
  eventBannerUrl: string | null;
  eventLogoUrl: string | null;
  cronExpression: string | null;
  lastCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { markets: number };
}

export default function AdminAutoMarketConfigDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    name: "",
    isActive: true,
    tokenName: "",
    coingeckoId: "",
    chain: "",
    feeBps: 100,
    seed0: 100000,
    seed1: 100000,
    category: "CRYPTO" as const,
    eventBannerUrl: "",
    eventLogoUrl: "",
  });

  const { data, isLoading } = useQuery<{ config: AutoMarketConfig }>({
    queryKey: ["adminAutoMarketConfig", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/auto-market-configs/${id}`);
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      const c = data.config;
      setForm({
        name: c.name,
        isActive: c.isActive,
        tokenName: c.tokenName,
        coingeckoId: c.coingeckoId,
        chain: c.chain ?? "",
        feeBps: c.feeBps,
        seed0: Number(c.seed0),
        seed1: Number(c.seed1),
        category: c.category,
        eventBannerUrl: c.eventBannerUrl ?? "",
        eventLogoUrl: c.eventLogoUrl ?? "",
      });
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/auto-market-configs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          isActive: form.isActive,
          tokenName: form.tokenName,
          coingeckoId: form.coingeckoId,
          chain: form.chain || null,
          feeBps: form.feeBps,
          seed0: form.seed0,
          seed1: form.seed1,
          category: form.category,
          eventBannerUrl: form.eventBannerUrl || null,
          eventLogoUrl: form.eventLogoUrl || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Config updated");
      queryClient.invalidateQueries({ queryKey: ["adminAutoMarketConfig", id] });
      queryClient.invalidateQueries({ queryKey: ["adminAutoMarketConfigs"] });
      setEditMode(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.config) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Config not found</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/admin/auto-markets")}>
          Back to Auto Markets
        </Button>
      </div>
    );
  }

  const config = data.config;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/auto-markets")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Auto Markets
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              {config.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {config.isActive ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactive
                </Badge>
              )}
              <Badge variant="outline">{config.tokenSymbol}</Badge>
              <Badge variant="outline">{config.timeframeLabel}</Badge>
              {config.chain && <Badge variant="outline">{config.chain}</Badge>}
            </div>
          </div>
          {editMode ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          ) : (
            <Button onClick={() => setEditMode(true)}>Edit config</Button>
          )}
        </div>
      </div>

      <GlassCard variant="solid">
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Config details</h2>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Token</Label>
              {editMode ? (
                <>
                  <Input
                    value={form.tokenName}
                    onChange={(e) => setForm((p) => ({ ...p, tokenName: e.target.value }))}
                    placeholder="Bitcoin"
                  />
                  <p className="text-xs text-muted-foreground">Symbol is fixed: {config.tokenSymbol}</p>
                </>
              ) : (
                <p className="text-sm">{config.tokenName} ({config.tokenSymbol})</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>CoinGecko ID</Label>
              {editMode ? (
                <Input
                  value={form.coingeckoId}
                  onChange={(e) => setForm((p) => ({ ...p, coingeckoId: e.target.value }))}
                  placeholder="bitcoin"
                />
              ) : (
                <p className="text-sm font-mono">{config.coingeckoId}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Timeframe</Label>
              <p className="text-sm">{config.timeframeLabel} (fixed)</p>
            </div>
            <div className="space-y-2">
              <Label>Display name</Label>
              {editMode ? (
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="BTC 15min"
                />
              ) : (
                <p className="text-sm">{config.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Chain (optional)</Label>
              {editMode ? (
                <Input
                  value={form.chain}
                  onChange={(e) => setForm((p) => ({ ...p, chain: e.target.value }))}
                  placeholder="Ethereum"
                />
              ) : (
                <p className="text-sm">{config.chain ?? "—"}</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              {editMode ? (
                <ImageUpload
                  label="Event banner (optional)"
                  value={form.eventBannerUrl}
                  onChange={(url) => setForm((p) => ({ ...p, eventBannerUrl: url }))}
                  folder="auto-markets"
                  aspectRatio="banner"
                />
              ) : (
                <>
                  <Label>Event banner</Label>
                  <p className="text-sm break-all">{config.eventBannerUrl ?? "—"}</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              {editMode ? (
                <ImageUpload
                  label="Event logo (optional)"
                  value={form.eventLogoUrl}
                  onChange={(url) => setForm((p) => ({ ...p, eventLogoUrl: url }))}
                  folder="auto-markets"
                  aspectRatio="square"
                />
              ) : (
                <>
                  <Label>Event logo</Label>
                  <p className="text-sm break-all">{config.eventLogoUrl ?? "—"}</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              {editMode ? (
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
              ) : (
                <p className="text-sm">{config.category}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Fee (bps)</Label>
              {editMode ? (
                <Input
                  type="number"
                  min={0}
                  max={10000}
                  value={form.feeBps}
                  onChange={(e) => setForm((p) => ({ ...p, feeBps: Number(e.target.value) || 100 }))}
                />
              ) : (
                <p className="text-sm">{config.feeBps}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Seed liquidity (per outcome)</Label>
              {editMode ? (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={100}
                    value={form.seed0}
                    onChange={(e) => setForm((p) => ({ ...p, seed0: Number(e.target.value) || 100000 }))}
                    placeholder="100000"
                  />
                  <Input
                    type="number"
                    min={100}
                    value={form.seed1}
                    onChange={(e) => setForm((p) => ({ ...p, seed1: Number(e.target.value) || 100000 }))}
                    placeholder="100000"
                  />
                </div>
              ) : (
                <p className="text-sm">{config.seed0.toString()} / {config.seed1.toString()}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Active</Label>
              {editMode ? (
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                />
              ) : (
                <p className="text-sm">{config.isActive ? "Yes" : "No"}</p>
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-border/50 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last created: {config.lastCreatedAt ? format(new Date(config.lastCreatedAt), "PPp") : "Never"}
            </span>
            <span>{config._count.markets} markets</span>
            <span>Created {format(new Date(config.createdAt), "PP")}</span>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
