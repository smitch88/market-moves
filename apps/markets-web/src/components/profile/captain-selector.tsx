"use client";

import { useState } from "react";
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
import { Star, Check, X, Users, Loader2 } from "lucide-react";
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

export function CaptainSelector() {
  const [open, setOpen] = useState(false);
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

  // Set captain mutation
  const setCaptainMutation = useMutation({
    mutationFn: async (captainId: string | null) => {
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

  const handleSelectCaptain = (kolId: string) => {
    setCaptainMutation.mutate(kolId);
  };

  const handleRemoveCaptain = () => {
    setCaptainMutation.mutate(null);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Your Captain (KOL)</Label>
      <p className="text-xs text-muted-foreground">
        Follow a KOL (Key Opinion Leader) and their profile badge will appear on your profile.
        When your captain wins the daily competition, you receive a bonus!
      </p>

      {captainLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : captain ? (
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
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveCaptain}
            disabled={setCaptainMutation.isPending}
          >
            {setCaptainMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Star className="h-4 w-4 mr-2 text-[#df2421]" />
              Select a Captain
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-[#df2421]" />
                Select Your Captain
              </DialogTitle>
              <DialogDescription>
                Choose a KOL to follow. Their badge will appear on your profile.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
              {kolsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : kols.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No KOLs available yet</p>
                </div>
              ) : (
                kols.map((kol) => (
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
          </DialogContent>
        </Dialog>
      )}

      {captain && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs">
              Change Captain
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-[#df2421]" />
                Change Your Captain
              </DialogTitle>
              <DialogDescription>
                Select a different KOL to follow.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
              {kolsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : kols.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No KOLs available yet</p>
                </div>
              ) : (
                kols.map((kol) => {
                  const isCurrentCaptain = captain?.id === kol.id;
                  return (
                    <button
                      key={kol.id}
                      onClick={() => !isCurrentCaptain && handleSelectCaptain(kol.id)}
                      disabled={setCaptainMutation.isPending || isCurrentCaptain}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border",
                        isCurrentCaptain
                          ? "border-[#df2421]/50 bg-[#df2421]/5"
                          : "border-border hover:bg-muted/50",
                        "transition-colors text-left",
                        (setCaptainMutation.isPending || isCurrentCaptain) && "cursor-not-allowed"
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
                      {isCurrentCaptain && (
                        <Check className="h-4 w-4 text-[#df2421]" />
                      )}
                      {setCaptainMutation.isPending && setCaptainMutation.variables === kol.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </button>
                  );
                })
              )}
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
