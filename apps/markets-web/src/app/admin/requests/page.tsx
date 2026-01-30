"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import {
  Badge,
  Button,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vault/ui";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Search,
  X,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
  User,
  FileEdit,
} from "lucide-react";

interface MarketRequest {
  id: string;
  title: string;
  description: string;
  sourceUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CREATED";
  adminNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    profileImageUrl: string | null;
  };
  reviewer?: {
    id: string;
    name: string | null;
    handle: string | null;
  } | null;
}

interface RequestsResponse {
  requests: MarketRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CREATED", label: "Created" },
];

const sortOptions = [
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "status_asc", label: "Status A-Z" },
  { value: "status_desc", label: "Status Z-A" },
];

const statusConfig = {
  PENDING: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: XCircle,
  },
  CREATED: {
    label: "Market Created",
    color: "bg-primary/10 text-primary border-primary/20",
    icon: Sparkles,
  },
};

export default function AdminRequestsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt_desc");

  // Fetch requests
  const { data, isLoading } = useQuery<RequestsResponse>({
    queryKey: ["adminRequests", page, searchQuery, statusFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (sortBy) {
        const [field, order] = sortBy.split("_");
        params.set("sortBy", field);
        params.set("sortOrder", order);
      }
      const res = await fetch(`/api/admin/requests?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch requests");
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

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  const requests = data?.requests || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const currentPage = data?.page || page;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Lightbulb className="h-7 w-7 text-primary" />
              Market Requests
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Review and manage market requests from users
            </p>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by title, description, or user..."
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

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
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
      {(searchQuery || statusFilter !== "all") && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: &quot;{searchQuery}&quot;
              <button onClick={clearSearch} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Status: {statusFilter}
              <button onClick={() => handleStatusFilterChange("all")} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Requests Table */}
      <GlassCard variant="solid">
        <GlassCardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {statusFilter !== "all" ? `${statusFilter} Requests` : "All Requests"}
            </h2>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {requests.length > 0
                ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, total)} of ${total}`
                : "No requests"}
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
                {requests.map((request) => {
                  const config = statusConfig[request.status];
                  const StatusIcon = config.icon;

                  return (
                    <Link
                      key={request.id}
                      href={`/admin/requests/${request.id}`}
                      className="block p-4 rounded-lg border border-border bg-card/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2 mb-1">{request.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>by {request.user.name || request.user.handle || "Anonymous"}</span>
                            <span>·</span>
                            <span>{format(new Date(request.createdAt), "MMM d")}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(request.createdAt), "MMM d, yyyy")}
                        </span>
                        <span className="text-xs text-primary font-medium flex items-center gap-1">
                          <FileEdit className="h-3 w-3" />
                          Review
                        </span>
                      </div>
                    </Link>
                  );
                })}
                {requests.length === 0 && (
                  <p className="p-8 text-center text-muted-foreground">No requests yet</p>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium text-muted-foreground">Title</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Submitted</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => {
                      const config = statusConfig[request.status];
                      const StatusIcon = config.icon;

                      return (
                        <tr
                          key={request.id}
                          className="border-b border-border/50 hover:bg-muted/50 transition-colors group cursor-pointer"
                          onClick={() => router.push(`/admin/requests/${request.id}`)}
                        >
                          <td className="p-4 max-w-md">
                            <p className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                              {request.title}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {request.description}
                            </p>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {request.user.profileImageUrl ? (
                                <Image
                                  src={request.user.profileImageUrl}
                                  alt={request.user.name || "User"}
                                  width={28}
                                  height={28}
                                  className="rounded-full"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium">
                                  {request.user.name || request.user.handle || "Anonymous"}
                                </p>
                                {request.user.handle && (
                                  <p className="text-xs text-muted-foreground">@{request.user.handle}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </td>
                          <td className="p-4 text-right text-sm text-muted-foreground">
                            {format(new Date(request.createdAt), "MMM d, yyyy")}
                          </td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                asChild
                                size="sm"
                                variant="default"
                                className="h-8"
                              >
                                <Link href={`/admin/requests/${request.id}`}>
                                  <FileEdit className="h-3.5 w-3.5 mr-1" />
                                  Review
                                </Link>
                              </Button>
                              {request.sourceUrl && (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                >
                                  <a
                                    href={request.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {requests.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No requests yet
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
    </div>
  );
}
