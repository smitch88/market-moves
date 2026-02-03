"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
} from "@vault/ui";
import { Star, Users, Loader2, Sparkles, Search } from "lucide-react";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { cn } from "@vault/ui/lib/utils";

interface KOL {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
  isKOL: boolean;
  kolApprovedAt: string | null;
  followerCount: number;
}

interface Captain {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
  isKOL: boolean;
}

export const CAPTAIN_ONBOARDING_DISMISS_KEY = "vault:captain-onboarding:dismissedAt";
export const CAPTAIN_ONBOARDING_DISMISS_MS = 24 * 60 * 60 * 1000; // 24h

interface CaptainStanding {
  userId: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
  followerCount?: number;
}

export function CaptainSelector({
  autoPrompt = false,
  mode = "settings",
  triggerLabel,
  enabled = true,
  dialogClassName,
  triggerIconOnly = false,
  triggerClassName,
  onDismiss,
}: {
  autoPrompt?: boolean;
  mode?: "settings" | "buttonOnly" | "floating";
  triggerLabel?: string;
  enabled?: boolean;
  dialogClassName?: string;
  triggerIconOnly?: boolean;
  triggerClassName?: string;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  // Fetch current captain
  const { data: captainData, isLoading: captainLoading } = useQuery({
    queryKey: ["my-captain"],
    queryFn: async () => {
      const res = await authFetch("/api/me/captain");
      if (!res.ok) throw new Error("Failed to fetch captain");
      return res.json() as Promise<{ captain: Captain | null }>;
    },
    enabled,
  });

  // Fetch available KOLs
  const { data: kolsData, isLoading: kolsLoading } = useQuery({
    queryKey: ["available-kols"],
    queryFn: async () => {
      const res = await fetch("/api/kols");
      if (!res.ok) throw new Error("Failed to fetch KOLs");
      return res.json() as Promise<{ kols: KOL[] }>;
    },
    enabled: open, // Only fetch when dialog is open
  });

  // Fetch captain standings (sorted like leaderboard)
  const { data: standingsData, isLoading: standingsLoading } = useQuery({
    queryKey: ["captain-standings"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard?metric=creators&period=all&page=1&pageSize=50");
      if (!res.ok) throw new Error("Failed to fetch captain standings");
      return res.json() as Promise<{ entries: CaptainStanding[] }>;
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  // Set captain mutation
  const setCaptainMutation = useMutation({
    mutationFn: async (captainId: string) => {
      const res = await authFetch("/api/me/captain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captainId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to set captain");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-captain"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    },
  });

  const captain = captainData?.captain;
  const kols = kolsData?.kols || [];

  const standings = (standingsData?.entries || []).map((e) => ({
    id: e.userId,
    name: e.name ?? null,
    handle: e.handle ?? null,
    profileImageUrl: e.profileImageUrl ?? null,
    followerCount: e.followerCount ?? 0,
  }));

  const captainChoices =
    standings.length > 0
      ? standings
      : [...kols]
          .sort((a, b) => (b.followerCount ?? 0) - (a.followerCount ?? 0))
          .map((k) => ({
            id: k.id,
            name: k.name ?? null,
            handle: k.handle ?? null,
            profileImageUrl: k.profileImageUrl ?? null,
            followerCount: k.followerCount ?? 0,
          }));

  const filteredCaptainChoices = captainChoices.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.name ?? "").toLowerCase();
    const handle = (c.handle ?? "").toLowerCase();
    return name.includes(q) || handle.includes(q);
  });

  const handleSelectCaptain = (kolId: string) => {
    setCaptainMutation.mutate(kolId);
  };

  const shouldAutoPrompt = useMemo(() => {
    if (!autoPrompt) return false;
    if (typeof window === "undefined") return false;
    const dismissedAtRaw = window.localStorage.getItem(CAPTAIN_ONBOARDING_DISMISS_KEY);
    const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : 0;
    if (!dismissedAt || Number.isNaN(dismissedAt)) return true;
    return Date.now() - dismissedAt > CAPTAIN_ONBOARDING_DISMISS_MS;
  }, [autoPrompt]);

  useEffect(() => {
    if (captainLoading) return;
    if (captain) return;
    if (!shouldAutoPrompt) return;
    setOpen(true);
  }, [captainLoading, captain, shouldAutoPrompt]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearchQuery("");
  };

  const handleNotNow = () => {
    setOpen(false);
    setSearchQuery("");
    if (!captain && typeof window !== "undefined") {
      window.localStorage.setItem(CAPTAIN_ONBOARDING_DISMISS_KEY, String(Date.now()));
    }
    onDismiss?.();
  };

  return (
    <div className={mode === "settings" ? "space-y-3" : undefined}>
      {mode === "settings" && (
        <>
          <Label className="text-sm font-medium">Your Captain (KOL)</Label>
          <p className="text-xs text-muted-foreground">
            Choose a captain (Key Opinion Leader) to be on their team. Team totals show up on the
            leaderboard, and when your captain wins the daily competition, followers receive an MP bonus.
            Captain selection is a one-time choice.
          </p>
        </>
      )}

      {captainLoading ? (
        mode === "settings" ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : null
      ) : captain ? (
        mode === "settings" ? (
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={captain.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {(captain.name || captain.handle || "K")
                      .substring(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-[#df2421] rounded-full p-0.5 border border-background">
                  <Star className="w-2.5 h-2.5 text-white fill-white" />
                </div>
              </div>
              <div>
                <p className="font-medium text-sm">
                  {captain.name || captain.handle || "KOL"}
                </p>
                {captain.handle && (
                  <p className="text-xs text-muted-foreground">@{captain.handle}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Locked in (one-time selection)
                </p>
              </div>
            </div>
          </div>
        ) : null
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant={mode === "settings" ? "outline" : "default"}
              size={mode === "settings" ? "default" : mode === "floating" ? "icon" : "sm"}
              className={cn(
                mode === "settings" ? "w-full" : undefined,
                triggerClassName
              )}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  mode === "settings" ? "text-[#df2421]" : "text-white"
                )}
              />
              {!triggerIconOnly && (
                <span className="ml-2">
                  {triggerLabel ?? (mode === "settings" ? "Select a Captain" : "Choose a Captain")}
                </span>
              )}
              {triggerIconOnly && (
                <span className="sr-only">
                  {triggerLabel ?? "Choose a Captain"}
                </span>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className={cn("max-w-md", dialogClassName)}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-[#df2421]" />
                Choose Your Captain (One-Time)
              </DialogTitle>
              <DialogDescription>
                Captains lead teams. Your trading activity rolls up into their team totals on the leaderboard.
                If your captain wins the daily competition, followers receive an MP bonus.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-2">
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <p>
                  <span className="font-medium text-foreground">Team totals</span> are based on combined follower
                  performance (volume / PnL).
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <p>
                  <span className="font-medium text-foreground">MP bonus</span>: when your captain wins the daily
                  competition, followers receive a bonus.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Note: you can only choose a captain once.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search captains by name or username..."
                className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
              {standingsLoading || kolsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCaptainChoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{searchQuery ? "No captains match your search" : "No captains available yet"}</p>
                </div>
              ) : (
                filteredCaptainChoices.map((kol) => (
                  <button
                    key={kol.id}
                    onClick={() => handleSelectCaptain(kol.id)}
                    disabled={setCaptainMutation.isPending}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border border-border",
                      "hover:bg-muted/50 transition-colors text-left",
                      setCaptainMutation.isPending && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={kol.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {(kol.name || kol.handle || "K")
                            .substring(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-[#df2421] rounded-full p-0.5 border border-background">
                        <Star className="w-2.5 h-2.5 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {kol.name || kol.handle || "KOL"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {kol.handle && <span>@{kol.handle}</span>}
                        <span>•</span>
                        <span>{kol.followerCount} followers</span>
                      </div>
                    </div>
                    {setCaptainMutation.isPending && setCaptainMutation.variables === kol.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleNotNow}
                disabled={setCaptainMutation.isPending}
              >
                Not now
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Small captain badge to display on profile avatars
 */
export function CaptainBadge({ captain }: { captain: Captain | null }) {
  if (!captain) return null;

  return (
    <div 
      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background overflow-hidden"
      title={`Following ${captain.name || captain.handle || "KOL"}`}
    >
      <Avatar className="h-full w-full">
        <AvatarImage src={captain.profileImageUrl || undefined} />
        <AvatarFallback className="bg-[#df2421] text-[8px]">
          <Star className="w-2.5 h-2.5 text-white fill-white" />
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
