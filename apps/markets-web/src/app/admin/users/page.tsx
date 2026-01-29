"use client";

import { useState } from "react";
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
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@vault/ui";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Plus,
  Minus,
  Sparkles,
} from "lucide-react";

interface User {
  id: string;
  email: string | null;
  handle: string | null;
  name: string | null;
  role: string;
  balance: number;
  xp: number;
  createdAt: string;
  _count: {
    bets: number;
    positions: number;
  };
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Balance adjustment state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAddition, setIsAddition] = useState(true);

  // XP adjustment state
  const [xpDialogOpen, setXpDialogOpen] = useState(false);
  const [xpSelectedUser, setXpSelectedUser] = useState<User | null>(null);
  const [xpAmount, setXpAmount] = useState("");
  const [xpReason, setXpReason] = useState<"ADMIN_ADJUST" | "BONUS" | "PENALTY">("ADMIN_ADJUST");
  const [xpIsAddition, setXpIsAddition] = useState(true);

  // Fetch users
  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["adminUsers", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const currentPage = data?.page || page;

  // Balance adjustment mutation
  const adjustMutation = useMutation({
    mutationFn: async ({
      userId,
      delta,
      reason,
    }: {
      userId: string;
      delta: number;
      reason: string;
    }) => {
      const res = await fetch(`/api/admin/users/${userId}/balance`, {
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
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      closeAdjustDialog();
    },
  });

  // XP adjustment mutation
  const xpMutation = useMutation({
    mutationFn: async ({
      userId,
      delta,
      reason,
    }: {
      userId: string;
      delta: number;
      reason: "ADMIN_ADJUST" | "BONUS" | "PENALTY";
    }) => {
      const res = await fetch(`/api/admin/users/${userId}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to adjust XP");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      closeXpDialog();
    },
  });

  const openAdjustDialog = (user: User, isAdd: boolean) => {
    setSelectedUser(user);
    setIsAddition(isAdd);
    setAdjustAmount("");
    setAdjustReason("");
    setAdjustDialogOpen(true);
  };

  const closeAdjustDialog = () => {
    setAdjustDialogOpen(false);
    setSelectedUser(null);
    setAdjustAmount("");
    setAdjustReason("");
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    const delta = isAddition ? amount : -amount;
    adjustMutation.mutate({
      userId: selectedUser.id,
      delta,
      reason: adjustReason,
    });
  };

  const openXpDialog = (user: User, isAdd: boolean) => {
    setXpSelectedUser(user);
    setXpIsAddition(isAdd);
    setXpAmount("");
    setXpReason(isAdd ? "BONUS" : "PENALTY");
    setXpDialogOpen(true);
  };

  const closeXpDialog = () => {
    setXpDialogOpen(false);
    setXpSelectedUser(null);
    setXpAmount("");
    setXpReason("ADMIN_ADJUST");
  };

  const handleXpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!xpSelectedUser) return;

    const amount = parseInt(xpAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    const delta = xpIsAddition ? amount : -amount;
    xpMutation.mutate({
      userId: xpSelectedUser.id,
      delta,
      reason: xpReason,
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage platform users</p>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Users</h2>
            <span className="text-sm text-muted-foreground">
              {users.length > 0
                ? `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, total)} of ${total}`
                : "No users"}
            </span>
          </div>
        </GlassCardHeader>
        <GlassCardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      User
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Role
                    </th>
                    <th className="text-right p-4 font-medium text-muted-foreground">
                      Balance
                    </th>
                    <th className="text-right p-4 font-medium text-muted-foreground">
                      XP
                    </th>
                    <th className="text-right p-4 font-medium text-muted-foreground">
                      Bets
                    </th>
                    <th className="text-right p-4 font-medium text-muted-foreground">
                      Positions
                    </th>
                    <th className="text-right p-4 font-medium text-muted-foreground">
                      Joined
                    </th>
                    <th className="text-right p-4 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium">
                            {user.name || user.handle || "Anonymous"}
                          </p>
                          {user.email && (
                            <p className="text-sm text-muted-foreground">
                              {user.email}
                            </p>
                          )}
                          {user.handle && (
                            <p className="text-sm text-muted-foreground">
                              @{user.handle}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={user.role === "ADMIN" ? "default" : "secondary"}
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-mono text-[#df2421]">
                        ${user.balance.toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-mono text-purple-400">
                          {(user.xp ?? 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4 text-right">{user._count.bets}</td>
                      <td className="p-4 text-right">{user._count.positions}</td>
                      <td className="p-4 text-right text-sm text-muted-foreground">
                        {format(new Date(user.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAdjustDialog(user, true)}
                            title="Add balance"
                          >
                            <Plus className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAdjustDialog(user, false)}
                            title="Subtract balance"
                          >
                            <Minus className="h-4 w-4 text-red-500" />
                          </Button>
                          <div className="w-px h-4 bg-border mx-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openXpDialog(user, true)}
                            title="Add XP"
                          >
                            <Sparkles className="h-4 w-4 text-purple-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openXpDialog(user, false)}
                            title="Subtract XP"
                          >
                            <Sparkles className="h-4 w-4 text-purple-300 opacity-50" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No users yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        disabled={isLoading}
                        className="min-w-[40px]"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Balance Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {isAddition ? "Add" : "Subtract"} Balance
            </DialogTitle>
            <DialogDescription>
              {isAddition ? "Add to" : "Subtract from"}{" "}
              {selectedUser?.name || selectedUser?.handle || "user"}&apos;s balance.
              Current balance: ${selectedUser?.balance.toLocaleString()}
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
              {!isAddition && selectedUser && (
                <p className="text-sm text-muted-foreground">
                  New balance will be: $
                  {Math.max(
                    0,
                    selectedUser.balance - (parseInt(adjustAmount, 10) || 0)
                  ).toLocaleString()}
                </p>
              )}
              {isAddition && selectedUser && adjustAmount && (
                <p className="text-sm text-muted-foreground">
                  New balance will be: $
                  {(
                    selectedUser.balance + (parseInt(adjustAmount, 10) || 0)
                  ).toLocaleString()}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAdjustDialog}>
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
              {xpIsAddition ? "Add" : "Subtract"} XP
            </DialogTitle>
            <DialogDescription>
              {xpIsAddition ? "Add to" : "Subtract from"}{" "}
              {xpSelectedUser?.name || xpSelectedUser?.handle || "user"}&apos;s XP.
              Current XP: {(xpSelectedUser?.xp ?? 0).toLocaleString()}
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
              {xpSelectedUser && xpAmount && (
                <p className="text-sm text-muted-foreground">
                  New XP will be:{" "}
                  {Math.max(
                    0,
                    (xpSelectedUser.xp ?? 0) + (xpIsAddition ? 1 : -1) * (parseInt(xpAmount, 10) || 0)
                  ).toLocaleString()}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeXpDialog}>
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
                {xpIsAddition ? "Add" : "Subtract"} XP
              </Button>
            </DialogFooter>
            {xpMutation.isError && (
              <p className="text-destructive text-sm text-center mt-2">
                {xpMutation.error instanceof Error
                  ? xpMutation.error.message
                  : "Failed to adjust XP"}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
