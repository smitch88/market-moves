"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vault/ui";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Plus,
  Minus,
  Sparkles,
  Shield,
  ShieldOff,
  UserPlus,
  AlertTriangle,
  Search,
  Eye,
  X,
  ArrowUpDown,
  MoreHorizontal,
} from "lucide-react";

interface User {
  id: string;
  email: string | null;
  handle: string | null;
  name: string | null;
  role: string;
  balance: number;
  xp: number;
  twitterId?: string | null;
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

const roleOptions = [
  { value: "all", label: "All Roles" },
  { value: "USER", label: "Users" },
  { value: "ADMIN", label: "Admins" },
];

const sortOptions = [
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "balance_desc", label: "Highest Balance" },
  { value: "balance_asc", label: "Lowest Balance" },
  { value: "xp_desc", label: "Highest XP" },
  { value: "xp_asc", label: "Lowest XP" },
];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt_desc");

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

  // Add admin state
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false);
  const [newAdminIdentifier, setNewAdminIdentifier] = useState("");

  // Role change state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleChangeUser, setRoleChangeUser] = useState<User | null>(null);

  // Fetch users
  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["adminUsers", page, searchQuery, roleFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }
      if (sortBy) {
        const [field, order] = sortBy.split("_");
        params.set("sortBy", field);
        params.set("sortOrder", order);
      }
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

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

  // Add admin mutation
  const addAdminMutation = useMutation({
    mutationFn: async (identifier: string) => {
      // Determine if it's a Twitter ID (numeric) or handle
      const isTwitterId = /^\d+$/.test(identifier.replace("@", ""));
      const payload = isTwitterId 
        ? { twitterId: identifier }
        : { handle: identifier.replace("@", "") };

      const res = await fetch("/api/admin/users/add-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add admin");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setAddAdminDialogOpen(false);
      setNewAdminIdentifier("");
    },
  });

  // Role change mutation
  const roleChangeMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
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
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setRoleDialogOpen(false);
      setRoleChangeUser(null);
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

  const handleAddAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminIdentifier.trim()) return;
    addAdminMutation.mutate(newAdminIdentifier.trim());
  };

  const openRoleDialog = (user: User) => {
    setRoleChangeUser(user);
    setRoleDialogOpen(true);
  };

  const handleRoleChange = () => {
    if (!roleChangeUser) return;
    const newRole = roleChangeUser.role === "ADMIN" ? "USER" : "ADMIN";
    roleChangeMutation.mutate({ userId: roleChangeUser.id, role: newRole });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Users</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage platform users and administrators</p>
          </div>
          <Button onClick={() => setAddAdminDialogOpen(true)} className="w-full sm:w-auto">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Admin
          </Button>
        </div>
        
        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, handle, or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-8 w-full h-9"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-9">
              Search
            </Button>
          </form>

          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
            <SelectTrigger className="w-full sm:w-[140px] h-9">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters Indicator */}
      {(searchQuery || roleFilter !== "all") && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: &quot;{searchQuery}&quot;
              <button onClick={clearSearch} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {roleFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Role: {roleFilter}
              <button onClick={() => handleRoleFilterChange("all")} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Users Table */}
      <GlassCard variant="solid">
        <GlassCardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {roleFilter === "ADMIN" ? "Administrators" : roleFilter === "USER" ? "Users" : "All Users"}
            </h2>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {users.length > 0
                ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, total)} of ${total}`
                : "No users"}
            </span>
          </div>
        </GlassCardHeader>
        <GlassCardContent className="p-0 sm:p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden p-4 space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 rounded-lg border border-border bg-card/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/admin/users/${user.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">
                            {user.name || user.handle || "Anonymous"}
                          </p>
                          <Badge
                            variant={user.role === "ADMIN" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {user.role}
                          </Badge>
                        </div>
                        {user.handle && (
                          <p className="text-xs text-muted-foreground">@{user.handle}</p>
                        )}
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${user.id}`} className="cursor-pointer">
                              <Eye className="h-4 w-4 mr-2" />
                              View Profile
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openRoleDialog(user)} className="cursor-pointer">
                            {user.role === "ADMIN" ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-2 text-destructive" />
                                <span className="text-destructive">Remove Admin</span>
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-2" />
                                Make Admin
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Balance</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openAdjustDialog(user, true)} className="cursor-pointer">
                            <Plus className="h-4 w-4 mr-2 text-green-500" />
                            Add Balance
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAdjustDialog(user, false)} className="cursor-pointer">
                            <Minus className="h-4 w-4 mr-2 text-red-500" />
                            Subtract Balance
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Experience</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openXpDialog(user, true)} className="cursor-pointer">
                            <Plus className="h-4 w-4 mr-2 text-purple-500" />
                            Add XP
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openXpDialog(user, false)} className="cursor-pointer">
                            <Minus className="h-4 w-4 mr-2 text-purple-400" />
                            Subtract XP
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Link href={`/admin/users/${user.id}`}>
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
                        <div>
                          <p className="text-xs text-muted-foreground">Balance</p>
                          <p className="text-sm font-mono text-[#df2421]">${user.balance.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">XP</p>
                          <p className="text-sm font-mono text-purple-400">{(user.xp ?? 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bets</p>
                          <p className="text-sm font-mono">{user._count.bets}</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="p-8 text-center text-muted-foreground">No users yet</p>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
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
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors group"
                      >
                        <td className="p-4">
                          <Link href={`/admin/users/${user.id}`} className="block">
                            <div>
                              <p className="font-medium group-hover:text-[#df2421] transition-colors">
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
                          </Link>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/users/${user.id}`} className="cursor-pointer">
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Profile
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openRoleDialog(user)} className="cursor-pointer">
                                {user.role === "ADMIN" ? (
                                  <>
                                    <ShieldOff className="h-4 w-4 mr-2 text-destructive" />
                                    <span className="text-destructive">Remove Admin</span>
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Make Admin
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Balance</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openAdjustDialog(user, true)} className="cursor-pointer">
                                <Plus className="h-4 w-4 mr-2 text-green-500" />
                                Add Balance
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openAdjustDialog(user, false)} className="cursor-pointer">
                                <Minus className="h-4 w-4 mr-2 text-red-500" />
                                Subtract Balance
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Experience</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openXpDialog(user, true)} className="cursor-pointer">
                                <Plus className="h-4 w-4 mr-2 text-purple-500" />
                                Add XP
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openXpDialog(user, false)} className="cursor-pointer">
                                <Minus className="h-4 w-4 mr-2 text-purple-400" />
                                Subtract XP
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
            </>
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

      {/* Add Admin Dialog */}
      <Dialog open={addAdminDialogOpen} onOpenChange={setAddAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#df2421]" />
              Add Administrator
            </DialogTitle>
            <DialogDescription>
              Add a new admin by their Twitter handle or Twitter ID.
              The user must have already signed up on the platform.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAdminSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Twitter Handle or ID</Label>
                <Input
                  id="identifier"
                  value={newAdminIdentifier}
                  onChange={(e) => setNewAdminIdentifier(e.target.value)}
                  placeholder="@username or 123456789"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter a Twitter handle (e.g., @vaultuser) or numeric Twitter ID
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddAdminDialogOpen(false);
                  setNewAdminIdentifier("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addAdminMutation.isPending || !newAdminIdentifier.trim()}
                className="bg-[#df2421] hover:bg-[#bf1f1c]"
              >
                {addAdminMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Add Admin
              </Button>
            </DialogFooter>
            {addAdminMutation.isError && (
              <p className="text-destructive text-sm text-center mt-2">
                {addAdminMutation.error instanceof Error
                  ? addAdminMutation.error.message
                  : "Failed to add admin"}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Role Change Confirmation Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {roleChangeUser?.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
            </DialogTitle>
            <DialogDescription>
              {roleChangeUser?.role === "ADMIN" ? (
                <>
                  Are you sure you want to remove admin privileges from{" "}
                  <span className="font-medium">
                    {roleChangeUser?.name || roleChangeUser?.handle || "this user"}
                  </span>
                  ? They will no longer have access to the admin panel.
                </>
              ) : (
                <>
                  Are you sure you want to make{" "}
                  <span className="font-medium">
                    {roleChangeUser?.name || roleChangeUser?.handle || "this user"}
                  </span>{" "}
                  an administrator? They will have full access to the admin panel.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {roleChangeUser && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">User</span>
                  <span className="font-medium">
                    {roleChangeUser.name || roleChangeUser.handle || "Anonymous"}
                  </span>
                </div>
                {roleChangeUser.handle && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Handle</span>
                    <span>@{roleChangeUser.handle}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Role</span>
                  <Badge variant={roleChangeUser.role === "ADMIN" ? "default" : "secondary"}>
                    {roleChangeUser.role}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New Role</span>
                  <Badge
                    variant={roleChangeUser.role === "ADMIN" ? "secondary" : "default"}
                    className={roleChangeUser.role !== "ADMIN" ? "bg-[#df2421]" : ""}
                  >
                    {roleChangeUser.role === "ADMIN" ? "USER" : "ADMIN"}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRoleDialogOpen(false);
                setRoleChangeUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={roleChangeMutation.isPending}
              variant={roleChangeUser?.role === "ADMIN" ? "destructive" : "default"}
              className={roleChangeUser?.role !== "ADMIN" ? "bg-[#df2421] hover:bg-[#bf1f1c]" : ""}
            >
              {roleChangeMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {roleChangeUser?.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
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
