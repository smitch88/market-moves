import Link from "next/link";
import { prisma, MarketCategory, Prisma } from "@vault/database";
import { format } from "date-fns";
import {
  Button,
  Badge,
  GlassCard,
  GlassCardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vault/ui";
import { Plus, Eye, Pencil, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { getAdminEventUrl, getAdminEventEditUrl } from "@/lib/urls";
import { PublishToggle } from "@/components/admin/publish-toggle";

// Force dynamic rendering - requires database access
export const dynamic = "force-dynamic";

const CATEGORIES: MarketCategory[] = [
  "NFL", "NBA", "NHL", "MLB", "SOCCER", "UFC", "TENNIS", "GOLF",
  "ESPORTS", "POLITICS", "CRYPTO", "FINANCE", "ENTERTAINMENT", "OTHER",
];

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const category = params.category || "";
  const status = params.status || "";
  const sortBy = params.sortBy || "createdAt";
  const sortDir = params.sortDir || "desc";

  // Build where clause
  const where: Prisma.EventWhereInput = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category && category !== "all") {
    where.category = category as MarketCategory;
  }

  // Status filter - needs special handling
  if (status && status !== "all") {
    if (status === "active") {
      where.active = true;
      where.closed = false;
    } else if (status === "closed") {
      where.active = false;
    } else if (status === "settled") {
      where.closed = true;
    }
  }

  // Build orderBy
  let orderBy: Prisma.EventOrderByWithRelationInput = { createdAt: "desc" };

  if (sortBy === "title") {
    orderBy = { title: sortDir as "asc" | "desc" };
  } else if (sortBy === "startTime") {
    orderBy = { startTime: sortDir as "asc" | "desc" };
  } else if (sortBy === "createdAt") {
    orderBy = { createdAt: sortDir as "asc" | "desc" };
  } else if (sortBy === "markets") {
    orderBy = { markets: { _count: sortDir as "asc" | "desc" } };
  }

  const events = await prisma.event.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      active: true,
      closed: true,
      isPublished: true,
      startTime: true,
      createdAt: true,
      tags: true,
      markets: {
        select: {
          id: true,
          status: true,
          isPublished: true,
          seed0: true,
          seed1: true,
          pool0: true,
          pool1: true,
          _count: {
            select: { bets: { where: { status: "CONFIRMED" } } },
          },
        },
      },
      _count: {
        select: { markets: true },
      },
    },
    orderBy,
    take: 100,
  });

  // Calculate aggregations and handle in-memory sorting for volume/bets
  let eventsWithStats = events.map((event) => {
    const totalBets = event.markets.reduce((sum, m) => sum + m._count.bets, 0);
    const totalVolume = event.markets.reduce((sum, m) => {
      return sum + Number(m.seed0) + Number(m.seed1) + Number(m.pool0) + Number(m.pool1);
    }, 0);
    const marketStatuses = event.markets.map((m) => m.status);
    const hasOpen = marketStatuses.includes("OPEN");
    const allSettled = marketStatuses.every((s) => s === "SETTLED");
    const allDraft = marketStatuses.every((s) => s === "DRAFT");

    let eventStatus: "active" | "closed" | "draft" | "settled" = "draft";
    if (event.closed || allSettled) {
      eventStatus = "settled";
    } else if (!event.active) {
      eventStatus = "closed";
    } else if (hasOpen) {
      eventStatus = "active";
    } else if (allDraft) {
      eventStatus = "draft";
    }

    return { ...event, totalBets, totalVolume, eventStatus };
  });

  // Sort by volume or bets in memory
  if (sortBy === "volume") {
    eventsWithStats.sort((a, b) => {
      return sortDir === "desc" ? b.totalVolume - a.totalVolume : a.totalVolume - b.totalVolume;
    });
  } else if (sortBy === "bets") {
    eventsWithStats.sort((a, b) => {
      return sortDir === "desc" ? b.totalBets - a.totalBets : a.totalBets - b.totalBets;
    });
  }

  // Build current URL params for sorting links
  const buildSortUrl = (newSortBy: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    params.set("sortBy", newSortBy);
    if (sortBy === newSortBy) {
      params.set("sortDir", sortDir === "desc" ? "asc" : "desc");
    } else {
      params.set("sortDir", "desc");
    }
    return `/admin/events?${params.toString()}`;
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDir === "desc"
      ? <ArrowDown className="h-3 w-3 ml-1" />
      : <ArrowUp className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Events</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage prediction events and their markets
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-4">
          <form className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                name="search"
                placeholder="Search events..."
                defaultValue={search}
                className="pl-9"
              />
            </div>

            {/* Category Filter */}
            <Select name="category" defaultValue={category || "all"}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select name="status" defaultValue={status || "all"}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="closed">Inactive</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
              </SelectContent>
            </Select>

            {/* Hidden inputs to preserve sort */}
            <input type="hidden" name="sortBy" value={sortBy} />
            <input type="hidden" name="sortDir" value={sortDir} />

            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </form>
        </GlassCardContent>
      </GlassCard>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {eventsWithStats.length} event{eventsWithStats.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
        {category && ` in ${category}`}
        {status && ` with status ${status}`}
      </p>

      <GlassCard variant="solid">
        <GlassCardContent className="p-0">
          {/* Mobile Card View */}
          <div className="sm:hidden p-4 space-y-3">
            {eventsWithStats.map((event) => (
              <Link
                key={event.id}
                href={getAdminEventUrl(event.id)}
                className="block p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-1">{event.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {event.description || event.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={
                        event.eventStatus === "active"
                          ? "success"
                          : event.eventStatus === "settled"
                            ? "default"
                            : event.eventStatus === "closed"
                              ? "destructive"
                              : "secondary"
                      }
                      className="text-xs"
                    >
                      {event.eventStatus === "active"
                        ? "Active"
                        : event.eventStatus === "settled"
                          ? "Settled"
                          : event.eventStatus === "closed"
                            ? "Inactive"
                            : "Draft"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">{event.category}</Badge>
                  {event.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag.id} variant="outline" className="text-xs">
                      {tag.label}
                    </Badge>
                  ))}
                  {event.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs">+{event.tags.length - 2}</Badge>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/50 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Markets</p>
                    <p className="text-sm font-medium">{event._count.markets}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Volume</p>
                    <p className="text-sm font-medium font-mono">${event.totalVolume.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bets</p>
                    <p className="text-sm font-medium">{event.totalBets}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Published</p>
                    <p className="text-sm font-medium">{event.isPublished ? "Yes" : "No"}</p>
                  </div>
                </div>
              </Link>
            ))}
            {eventsWithStats.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">
                No events found. Try adjusting your filters.
              </p>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    <Link href={buildSortUrl("title")} className="flex items-center hover:text-foreground">
                      Event
                      <SortIcon column="title" />
                    </Link>
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Tags
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    <Link href={buildSortUrl("markets")} className="flex items-center hover:text-foreground">
                      Markets
                      <SortIcon column="markets" />
                    </Link>
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    <Link href={buildSortUrl("volume")} className="flex items-center justify-end hover:text-foreground">
                      Volume
                      <SortIcon column="volume" />
                    </Link>
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    <Link href={buildSortUrl("bets")} className="flex items-center justify-end hover:text-foreground">
                      Bets
                      <SortIcon column="bets" />
                    </Link>
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Published
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    <Link href={buildSortUrl("startTime")} className="flex items-center hover:text-foreground">
                      Start Time
                      <SortIcon column="startTime" />
                    </Link>
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground sticky right-0 bg-card">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {eventsWithStats.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors group"
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {event.description || event.slug}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary">{event.category}</Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {event.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag.label}
                          </Badge>
                        ))}
                        {event.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{event.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">{event._count.markets}</td>
                    <td className="p-4 text-right font-mono text-sm">
                      ${event.totalVolume.toLocaleString()}
                    </td>
                    <td className="p-4 text-right">{event.totalBets}</td>
                    <td className="p-4">
                      <PublishToggle
                        id={event.id}
                        type="event"
                        isPublished={event.isPublished}
                      />
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          event.eventStatus === "active"
                            ? "success"
                            : event.eventStatus === "settled"
                              ? "default"
                              : event.eventStatus === "closed"
                                ? "destructive"
                                : "secondary"
                        }
                      >
                        {event.eventStatus === "active"
                          ? "Active"
                          : event.eventStatus === "settled"
                            ? "Settled"
                            : event.eventStatus === "closed"
                              ? "Inactive"
                              : "Draft"}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {event.startTime
                        ? format(new Date(event.startTime), "MMM d, yyyy")
                        : "-"}
                    </td>
                    <td className="p-4 text-right sticky right-0 bg-card group-hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={getAdminEventUrl(event.id)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={getAdminEventEditUrl(event.id)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {eventsWithStats.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No events found. Try adjusting your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
