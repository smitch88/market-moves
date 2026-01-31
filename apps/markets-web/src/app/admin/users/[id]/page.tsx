"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Badge,
  Button,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  Input,
  Label,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  DollarSign,
  TrendingUp,
  Calendar,
  Target,
  Trophy,
  Zap,
  Activity,
  Loader2,
  Plus,
  Minus,
  Sparkles,
  Shield,
  ShieldOff,
  AlertTriangle,
  RefreshCw,
  Star,
  StarOff,
} from "lucide-react";

// X Icon component
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface UserDetailResponse {
  user: {
    id: string;
    email: string | null;
    handle: string | null;
    name: string | null;
    role: string;
    balance: number;
    xp: number;
    twitterId: string | null;
    profileImageUrl: string | null;
    createdAt: string;
    referralCode: string | null;
    isKOL: boolean;
    kolApprovedAt: string | null;
    _count: {
      bets: number;
      positions: number;
      referrals: number;
      xpTransactions: number;
      followers: number;
    };
  };
  stats: {
    totalBets: number;
    totalBetVolume: number;
    totalPayout: number;
    realizedPnL: number;
    positionsValue: number;
    positionsCount: number;
    referralsCount: number;
    xpTransactionsCount: number;
    winRate: number;
    wonBets: number;
    lostBets: number;
  };
  recentActivity: {
    bets: Array<{
      id: string;
      amount: number;
      outcome: number;
      payout: number;
      createdAt: string;
      market: {
        question: string;
        outcomes: string[];
        outcomeColors: string[];
        status: string;
        eventSlug: string | null;
        eventTitle: string | null;
      };
    }>;
    xpTransactions: Array<{
      id: string;
      amount: number;
      reason: string;
      createdAt: string;
    }>;
  };
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  // Balance adjustment state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAddition, setIsAddition] = useState(true);

  // XP adjustment state
  const [xpDialogOpen, setXpDialogOpen] = useState(false);
  const [xpAmount, setXpAmount] = useState("");
  const [xpReason, setXpReason] = useState<"ADMIN_ADJUST" | "BONUS" | "PENALTY">("ADMIN_ADJUST");
  const [xpIsAddition, setXpIsAddition] = useState(true);

  // Role change state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const { data, isLoading, error } = useQuery<UserDetailResponse>({
    queryKey: ["adminUserDetail", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("User not found");
        throw new Error("Failed to fetch user");
      }
      return res.json();
    },
  });

  // Balance adjustment mutation
  const adjustMutation = useMutation({
    mutationFn: async ({
      delta,
      reason,
    }: {
      delta: number;
      reason: string;
    }) => {
      const res = await fetch(`/api/admin/users/${id}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to adjust balance");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUserDetail", id] });
      setAdjustDialogOpen(false);
      setAdjustAmount("");
      setAdjustReason("");
    },
  });

  // XP adjustment mutation
  const xpMutation = useMutation({
    mutationFn: async ({
      delta,
      reason,
    }: {
      delta: number;
      reason: "ADMIN_ADJUST" | "BONUS" | "PENALTY";
    }) => {
      const res = await fetch(`/api/admin/users/${id}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to adjust MP");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUserDetail", id] });
      setXpDialogOpen(false);
      setXpAmount("");
      setXpReason("ADMIN_ADJUST");
    },
  });

  // Role change mutation
  const roleChangeMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to change role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUserDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setRoleDialogOpen(false);
    },
  });

  // Recalculate PnL mutation
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${id}/recalculate-pnl`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to recalculate PnL");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUserDetail", id] });
    },
  });

  // KOL status mutation
  const kolMutation = useMutation({
    mutationFn: async (grant: boolean) => {
      const res = await fetch(`/api/admin/users/${id}/kol`, {
        method: grant ? "POST" : "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to ${grant ? "grant" : "revoke"} KOL status`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUserDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
    },
  });

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount <= 0) return;
    const delta = isAddition ? amount : -amount;
    adjustMutation.mutate({ delta, reason: adjustReason });
  };

  const handleXpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(xpAmount, 10);
    if (isNaN(amount) || amount <= 0) return;
    const delta = xpIsAddition ? amount : -amount;
    xpMutation.mutate({ delta, reason: xpReason });
  };

  const handleRoleChange = () => {
    if (!data) return;
    const newRole = data.user.role === "ADMIN" ? "USER" : "ADMIN";
    roleChangeMutation.mutate(newRole);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "User not found"}
        </p>
        <Link href="/admin/users">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </Link>
      </div>
    );
  }

  const { user, stats, recentActivity } = data;
  const displayName = user.name || user.handle || "Anonymous";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Link href="/admin/users">
            <Button variant="ghost" size="icon" className="mt-0.5 sm:mt-1 h-8 w-8 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={displayName}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-border flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center text-xl sm:text-2xl font-bold flex-shrink-0">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl font-bold truncate">{displayName}</h1>
                <Badge
                  variant={user.role === "ADMIN" ? "default" : "secondary"}
                  className={user.role === "ADMIN" ? "bg-[#df2421]" : ""}
                >
                  {user.role}
                </Badge>
                {user.isKOL && (
                  <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">
                    <Star className="h-3 w-3 mr-1 fill-yellow-500" />
                    KOL
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-muted-foreground">
                {user.handle && (
                  <a
                    href={`https://x.com/${user.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <XIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span>@{user.handle}</span>
                    <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Joined</span> {format(new Date(user.createdAt), "MMM d, yyyy")}
                </span>
              </div>
              {user.email && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{user.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="text-xs sm:text-sm"
          >
            {recalculateMutation.isPending ? (
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Recalculate </span>PnL
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRoleDialogOpen(true)}
            className="text-xs sm:text-sm"
          >
            {user.role === "ADMIN" ? (
              <ShieldOff className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            ) : (
              <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            )}
            {user.role === "ADMIN" ? <><span className="hidden sm:inline">Remove </span>Admin</> : <><span className="hidden sm:inline">Make </span>Admin</>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => kolMutation.mutate(!user.isKOL)}
            disabled={kolMutation.isPending}
            className={cn(
              "text-xs sm:text-sm",
              user.isKOL && "border-yellow-500/50 text-yellow-500 hover:text-yellow-400"
            )}
          >
            {kolMutation.isPending ? (
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
            ) : user.isKOL ? (
              <StarOff className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            ) : (
              <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            )}
            {user.isKOL ? <><span className="hidden sm:inline">Remove </span>KOL</> : <><span className="hidden sm:inline">Make </span>KOL</>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsAddition(true);
              setAdjustDialogOpen(true);
            }}
            className="text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Balance
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsAddition(false);
              setAdjustDialogOpen(true);
            }}
          >
            <Minus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Subtract </span>Balance
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setXpIsAddition(true);
              setXpDialogOpen(true);
            }}
            className="text-xs sm:text-sm col-span-2 sm:col-span-1"
          >
            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-purple-500" />
            Add MP
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard variant="solid">
          <GlassCardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Balance</p>
                <p className="text-lg sm:text-2xl font-bold text-[#df2421]">
                  {formatMoney(user.balance)}
                </p>
              </div>
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
            </div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard variant="solid">
          <GlassCardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">MP</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-400">
                  {(user.xp ?? 0).toLocaleString()}
                </p>
              </div>
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
            </div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard variant="solid">
          <GlassCardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Realized P&L</p>
                <p
                  className={cn(
                    "text-lg sm:text-2xl font-bold",
                    stats.realizedPnL >= 0 ? "text-green-500" : "text-red-500"
                  )}
                >
                  {stats.realizedPnL >= 0 ? "+" : ""}
                  {formatMoney(stats.realizedPnL)}
                </p>
              </div>
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
            </div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard variant="solid">
          <GlassCardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Win Rate</p>
                <p className="text-lg sm:text-2xl font-bold">
                  {(stats.winRate * 100).toFixed(0)}%
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {stats.wonBets}W - {stats.lostBets}L
                </p>
              </div>
              <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <GlassCard variant="solid">
          <GlassCardContent className="p-3 sm:py-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Bets</p>
            <p className="text-lg sm:text-xl font-semibold">{stats.totalBets}</p>
          </GlassCardContent>
        </GlassCard>
        <GlassCard variant="solid">
          <GlassCardContent className="p-3 sm:py-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Volume</p>
            <p className="text-lg sm:text-xl font-semibold">{formatMoney(stats.totalBetVolume)}</p>
          </GlassCardContent>
        </GlassCard>
        <GlassCard variant="solid">
          <GlassCardContent className="p-3 sm:py-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Positions Value</p>
            <p className="text-lg sm:text-xl font-semibold">{formatMoney(stats.positionsValue)}</p>
          </GlassCardContent>
        </GlassCard>
        <GlassCard variant="solid">
          <GlassCardContent className="p-3 sm:py-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Open Positions</p>
            <p className="text-lg sm:text-xl font-semibold">{stats.positionsCount}</p>
          </GlassCardContent>
        </GlassCard>
        <GlassCard variant="solid" className="col-span-2 sm:col-span-1">
          <GlassCardContent className="p-3 sm:py-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Referrals</p>
            <p className="text-lg sm:text-xl font-semibold">{stats.referralsCount}</p>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Tabs for Activity */}
      <div className="bg-background rounded-xl p-4 sm:p-6">
        <Tabs defaultValue="bets" className="w-full">
          <div className="border-b border-border mb-4 sm:mb-6">
            <TabsList className="h-auto p-0 bg-transparent gap-4 sm:gap-6">
              <TabsTrigger
                value="bets"
                className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform text-xs sm:text-sm"
              >
                <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Bets ({recentActivity.bets.length})
              </TabsTrigger>
              <TabsTrigger
                value="xp"
                className="relative pb-3 px-0 bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform text-xs sm:text-sm"
              >
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                MP ({recentActivity.xpTransactions.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="bets" className="mt-0">
            {recentActivity.bets.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Activity className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No betting activity yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.bets.map((bet) => (
                  <div
                    key={bet.id}
                    className="p-3 sm:p-4 rounded-lg border border-border/50 bg-card/50 transition-all duration-200 hover:border-border hover:bg-card/80"
                  >
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{bet.market.question}</p>
                        {bet.market.eventTitle && (
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {bet.market.eventTitle}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className="inline-flex items-center gap-1.5 text-sm"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor:
                                  bet.market.outcomeColors?.[bet.outcome] || "#888",
                              }}
                            />
                            <span className="font-medium">
                              {bet.market.outcomes?.[bet.outcome] || `Outcome ${bet.outcome}`}
                            </span>
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {bet.market.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold tabular-nums">
                          {formatMoney(bet.amount)}
                        </div>
                        {bet.payout > 0 && (
                          <div className="text-sm text-green-500 tabular-nums">
                            +{formatMoney(bet.payout)}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(bet.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="xp" className="mt-0">
            {recentActivity.xpTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No MP transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.xpTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 rounded-lg border border-border/50 bg-card/50 flex items-center justify-between"
                  >
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {tx.reason.replace(/_/g, " ")}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        tx.amount >= 0 ? "text-purple-400" : "text-red-400"
                      )}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount.toLocaleString()} MP
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Balance Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {isAddition ? "Add" : "Subtract"} Balance
            </DialogTitle>
            <DialogDescription>
              {isAddition ? "Add to" : "Subtract from"} {displayName}&apos;s balance.
              Current balance: {formatMoney(user.balance)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="100"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Explain why this adjustment is being made..."
                  rows={3}
                  required
                />
              </div>
              {adjustAmount && (
                <p className="text-sm text-muted-foreground">
                  New balance will be:{" "}
                  {formatMoney(
                    isAddition
                      ? user.balance + (parseInt(adjustAmount, 10) || 0)
                      : Math.max(0, user.balance - (parseInt(adjustAmount, 10) || 0))
                  )}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={adjustMutation.isPending}
                variant={isAddition ? "default" : "destructive"}
              >
                {adjustMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isAddition ? "Add" : "Subtract"} Balance
              </Button>
            </DialogFooter>
            {adjustMutation.isError && (
              <p className="text-destructive text-sm text-center mt-2">
                {adjustMutation.error instanceof Error
                  ? adjustMutation.error.message
                  : "Failed to adjust balance"}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* XP Adjustment Dialog */}
      <Dialog open={xpDialogOpen} onOpenChange={setXpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {xpIsAddition ? "Add" : "Subtract"} MP
            </DialogTitle>
            <DialogDescription>
              {xpIsAddition ? "Add to" : "Subtract from"} {displayName}&apos;s MP.
              Current MP: {(user.xp ?? 0).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleXpSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="xpAmount">Amount</Label>
                <Input
                  id="xpAmount"
                  type="number"
                  min="1"
                  value={xpAmount}
                  onChange={(e) => setXpAmount(e.target.value)}
                  placeholder="100"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="xpReason">Reason</Label>
                <select
                  id="xpReason"
                  value={xpReason}
                  onChange={(e) => setXpReason(e.target.value as typeof xpReason)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="ADMIN_ADJUST">Admin Adjustment</option>
                  <option value="BONUS">Bonus</option>
                  <option value="PENALTY">Penalty</option>
                </select>
              </div>
              {xpAmount && (
                <p className="text-sm text-muted-foreground">
                  New MP will be:{" "}
                  {Math.max(
                    0,
                    (user.xp ?? 0) + (xpIsAddition ? 1 : -1) * (parseInt(xpAmount, 10) || 0)
                  ).toLocaleString()}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setXpDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={xpMutation.isPending}
                className={xpIsAddition ? "bg-purple-600 hover:bg-purple-700" : ""}
                variant={xpIsAddition ? "default" : "destructive"}
              >
                {xpMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {xpIsAddition ? "Add" : "Subtract"} MP
              </Button>
            </DialogFooter>
            {xpMutation.isError && (
              <p className="text-destructive text-sm text-center mt-2">
                {xpMutation.error instanceof Error
                  ? xpMutation.error.message
                  : "Failed to adjust MP"}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {user.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
            </DialogTitle>
            <DialogDescription>
              {user.role === "ADMIN" ? (
                <>
                  Are you sure you want to remove admin privileges from{" "}
                  <span className="font-medium">{displayName}</span>?
                  They will no longer have access to the admin panel.
                </>
              ) : (
                <>
                  Are you sure you want to make{" "}
                  <span className="font-medium">{displayName}</span> an administrator?
                  They will have full access to the admin panel.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">User</span>
                <span className="font-medium">{displayName}</span>
              </div>
              {user.handle && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Handle</span>
                  <span>@{user.handle}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Role</span>
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">New Role</span>
                <Badge
                  variant={user.role === "ADMIN" ? "secondary" : "default"}
                  className={user.role !== "ADMIN" ? "bg-[#df2421]" : ""}
                >
                  {user.role === "ADMIN" ? "USER" : "ADMIN"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={roleChangeMutation.isPending}
              variant={user.role === "ADMIN" ? "destructive" : "default"}
              className={user.role !== "ADMIN" ? "bg-[#df2421] hover:bg-[#bf1f1c]" : ""}
            >
              {roleChangeMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {user.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
            </Button>
          </DialogFooter>
          {roleChangeMutation.isError && (
            <p className="text-destructive text-sm text-center mt-2">
              {roleChangeMutation.error instanceof Error
                ? roleChangeMutation.error.message
                : "Failed to change role"}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
