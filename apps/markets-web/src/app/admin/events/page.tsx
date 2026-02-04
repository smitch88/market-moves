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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vault/ui";
import { Plus, Eye, Pencil, Search, ArrowUpDown, ArrowUp, ArrowDown, Pin } from "lucide-react";
import { getAdminEventUrl, getAdminEventEditUrl } from "@/lib/urls";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { EventFlagToggle } from "@/components/admin/event-flag-toggle";

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
      pinned: true,
      featured: true,
      startTime: true,
      createdAt: true,
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
              <div
                key={event.id}
                className="p-4 rounded-lg border border-border bg-card/50"
              >
                {/* Header with actions */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={getAdminEventUrl(event.id)}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={getAdminEventEditUrl(event.id)}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
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

                {/* Title */}
                <Link href={getAdminEventUrl(event.id)} className="block mb-3 hover:text-primary transition-colors">
                  <p className="font-medium line-clamp-1">{event.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {event.description || event.slug}
                  </p>
                </Link>

                {/* Toggles and category row */}
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                    <EventFlagToggle eventId={event.id} flag="pinned" value={event.pinned} />
                  </div>
                  <Badge variant="secondary" className="text-xs">{event.category}</Badge>
                  <PublishToggle id={event.id} type="event" isPublished={event.isPublished} showLabel />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
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
                </div>
              </div>
            ))}
            {eventsWithStats.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">
                No events found. Try adjusting your filters.
              </p>
            )}
          </div>

          {/* Desktop Table View */}
          <TooltipProvider>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3 font-medium text-muted-foreground sticky left-0 bg-card z-10 w-[80px]">
                    </th>
                    <th className="text-center p-3 font-medium text-muted-foreground w-[70px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center gap-1 cursor-help">
                            <Pin className="h-3.5 w-3.5" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[200px]">Pin to &quot;Featured&quot; section on home page</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <Link href={buildSortUrl("title")} className="flex items-center hover:text-foreground">
                        Event
                        <SortIcon column="title" />
                      </Link>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      Category
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <Link href={buildSortUrl("markets")} className="flex items-center hover:text-foreground">
                        Markets
                        <SortIcon column="markets" />
                      </Link>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground">
                      <Link href={buildSortUrl("volume")} className="flex items-center justify-end hover:text-foreground">
                        Volume
                        <SortIcon column="volume" />
                      </Link>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground">
                      <Link href={buildSortUrl("bets")} className="flex items-center justify-end hover:text-foreground">
                        Bets
                        <SortIcon column="bets" />
                      </Link>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      Published
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <Link href={buildSortUrl("startTime")} className="flex items-center hover:text-foreground">
                        Start Time
                        <SortIcon column="startTime" />
                      </Link>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {eventsWithStats.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors group"
                    >
                      <td className="p-2 sticky left-0 bg-card group-hover:bg-muted/50 transition-colors z-10">
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={getAdminEventUrl(event.id)}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={getAdminEventEditUrl(event.id)}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                      <td className="p-3">
                        <EventFlagToggle
                          eventId={event.id}
                          flag="pinned"
                          value={event.pinned}
                        />
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {event.description || event.slug}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary">{event.category}</Badge>
                      </td>
                      <td className="p-3">{event._count.markets}</td>
                      <td className="p-3 text-right font-mono text-sm">
                        ${event.totalVolume.toLocaleString()}
                      </td>
                      <td className="p-3 text-right">{event.totalBets}</td>
                      <td className="p-3">
                        <PublishToggle
                          id={event.id}
                          type="event"
                          isPublished={event.isPublished}
                        />
                      </td>
                      <td className="p-3">
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
                      <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                        {event.startTime
                          ? format(new Date(event.startTime), "MMM d, yyyy")
                          : "-"}
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
          </TooltipProvider>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
