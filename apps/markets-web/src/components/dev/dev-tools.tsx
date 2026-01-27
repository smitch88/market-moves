"use client";

import { useState } from "react";
import { Bug, X, UserCog, Search, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Input,
  GlassCard,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  Separator,
} from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";

// Check at module level - this gets replaced at build time
const isDev = process.env.NODE_ENV === "development";

interface DevUser {
  id: string;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  twitterSubject: string | null;
  role: string;
  balance: number;
}

interface ImpersonationState {
  active: boolean;
  user: DevUser | null;
}

async function fetchDevUsers(): Promise<DevUser[]> {
  const res = await fetch("/api/dev/users");
  if (!res.ok) return [];
  return res.json();
}

async function fetchImpersonationState(): Promise<ImpersonationState> {
  const res = await fetch("/api/dev/impersonate");
  if (!res.ok) return { active: false, user: null };
  return res.json();
}

async function impersonateUser(twitterId: string): Promise<ImpersonationState> {
  const res = await fetch("/api/dev/impersonate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ twitterId }),
  });
  if (!res.ok) throw new Error("Failed to impersonate user");
  return res.json();
}

async function stopImpersonation(): Promise<void> {
  await fetch("/api/dev/impersonate", { method: "DELETE" });
}

export function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customTwitterId, setCustomTwitterId] = useState("");
  const queryClient = useQueryClient();

  // All hooks must be called before any conditional returns
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["dev-users"],
    queryFn: fetchDevUsers,
    enabled: isDev && isOpen,
  });

  const { data: impersonation } = useQuery({
    queryKey: ["dev-impersonation"],
    queryFn: fetchImpersonationState,
    enabled: isDev,
  });

  const impersonateMutation = useMutation({
    mutationFn: impersonateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-impersonation"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      window.location.reload();
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopImpersonation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-impersonation"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      window.location.reload();
    },
  });

  // Don't render in production - checked at build time
  if (!isDev) return null;

  const filteredUsers = users.filter(
    (user) =>
      user.handle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.twitterSubject?.includes(searchQuery)
  );

  const handleImpersonate = (twitterId: string) => {
    if (!twitterId) return;
    impersonateMutation.mutate(twitterId);
  };

  return (
    <>
      {/* Floating Button - Always visible in dev */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-[9999] p-3.5 rounded-full shadow-2xl transition-all duration-200",
          "bg-amber-500 hover:bg-amber-400 text-amber-950",
          "hover:scale-110 active:scale-95",
          "border-2 border-amber-600/50",
          impersonation?.active && "ring-4 ring-red-500 ring-offset-2 ring-offset-background animate-pulse"
        )}
        title="Dev Tools (Development Only)"
      >
        <Bug className="h-6 w-6" />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[9999] w-96 max-h-[70vh] overflow-hidden">
          <GlassCard className="border-amber-500/30 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold">Dev Tools</h3>
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30">
                  DEV
                </Badge>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Impersonation Status */}
            {impersonation?.active && impersonation.user && (
              <div className="p-4 bg-red-500/10 border-b border-red-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-red-500/50">
                      <AvatarImage src={impersonation.user.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {(impersonation.user.name || impersonation.user.handle || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-red-400">Impersonating</p>
                      <p className="text-sm">
                        {impersonation.user.name || impersonation.user.handle || "Anonymous"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                  >
                    {stopMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      "Stop"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* User Impersonation Section */}
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UserCog className="h-4 w-4" />
                <span>User Impersonation</span>
              </div>

              {/* Custom Twitter ID Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Twitter ID..."
                  value={customTwitterId}
                  onChange={(e) => setCustomTwitterId(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => handleImpersonate(customTwitterId)}
                  disabled={!customTwitterId || impersonateMutation.isPending}
                >
                  {impersonateMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Go"
                  )}
                </Button>
              </div>

              <Separator />

              {/* Search Users */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* User List */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {usersLoading ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => user.twitterSubject && handleImpersonate(user.twitterSubject)}
                      disabled={!user.twitterSubject || impersonateMutation.isPending}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                        "hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed",
                        impersonation?.user?.id === user.id && "bg-amber-500/10 border border-amber-500/30"
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {(user.name || user.handle || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {user.name || user.handle || "Anonymous"}
                          </p>
                          {user.role === "ADMIN" && (
                            <Badge variant="default" className="text-[10px] px-1 py-0">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.handle ? `@${user.handle}` : user.twitterSubject || "No Twitter"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-[#df2421]">
                          ${user.balance.toLocaleString()}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-muted/30 border-t border-border/50 text-center">
              <p className="text-xs text-muted-foreground">
                ⚠️ Dev tools only visible in development mode
              </p>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  );
}
