import Link from "next/link";
import { prisma, MarketStatus, Prisma } from "@vault/database";
import { format } from "date-fns";
import {
  Button,
  Badge,
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
import { Plus, Eye, Pencil, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { getAdminMarketUrl, getAdminMarketEditUrl, getAdminEventUrl } from "@/lib/urls";
import { PublishToggle } from "@/components/admin/publish-toggle";

// Force dynamic rendering - requires database access
export const dynamic = "force-dynamic";

// Helper to parse outcomes
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

interface PageProps {
  searchParams: Promise<{
    search?: string;
    eventId?: string;
    status?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function AdminMarketsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const eventId = params.eventId || "";
  const status = params.status || "";
  const sortBy = params.sortBy || "createdAt";
  const sortDir = params.sortDir || "desc";

  // Build where clause
  const where: Prisma.MarketWhereInput = {};

  if (search) {
    where.OR = [
      { question: { contains: search, mode: "insensitive" } },
      { event: { title: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (eventId && eventId !== "all") {
    where.eventId = eventId;
  }

  if (status && status !== "all") {
    where.status = status as MarketStatus;
  }

  // Build orderBy - handle volume specially since it's computed
  let orderBy: Prisma.MarketOrderByWithRelationInput = { createdAt: "desc" };
  
  if (sortBy === "bets") {
    orderBy = { bets: { _count: sortDir as "asc" | "desc" } };
  } else if (sortBy === "closesAt") {
    orderBy = { closesAt: sortDir as "asc" | "desc" };
  } else if (sortBy === "createdAt") {
    orderBy = { createdAt: sortDir as "asc" | "desc" };
  } else if (sortBy === "question") {
    orderBy = { question: sortDir as "asc" | "desc" };
  }

  // Fetch individual markets
  const markets = await prisma.market.findMany({
    where,
    select: {
      id: true,
      question: true,
      outcomes: true,
      status: true,
      isPublished: true,
      closesAt: true,
      createdAt: true,
      seed0: true,
      seed1: true,
      pool0: true,
      pool1: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          category: true,
        },
      },
      _count: {
        select: { 
          bets: { where: { status: "CONFIRMED" } },
          positions: true,
        },
      },
    },
    orderBy,
    take: 100,
  });

  // Calculate volume for each market and sort by volume if needed
  let marketsWithVolume = markets.map((market) => {
    const volume = Number(market.seed0) + Number(market.seed1) + Number(market.pool0) + Number(market.pool1);
    return { ...market, volume };
  });

  // Sort by volume in memory if requested
  if (sortBy === "volume") {
    marketsWithVolume.sort((a, b) => {
      return sortDir === "desc" ? b.volume - a.volume : a.volume - b.volume;
    });
  }

  // Fetch events for filter dropdown
  const events = await prisma.event.findMany({
    select: {
      id: true,
      title: true,
    },
    orderBy: { title: "asc" },
  });

  // Build current URL params for sorting links
  const buildSortUrl = (newSortBy: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (eventId) params.set("eventId", eventId);
    if (status) params.set("status", status);
    params.set("sortBy", newSortBy);
    // Toggle direction if same column, otherwise default to desc
    if (sortBy === newSortBy) {
      params.set("sortDir", sortDir === "desc" ? "asc" : "desc");
    } else {
      params.set("sortDir", "desc");
    }
    return `/admin/markets?${params.toString()}`;
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
          <h1 className="text-2xl sm:text-3xl font-bold">Markets</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage individual prediction markets
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event & Market
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
                placeholder="Search markets..."
                defaultValue={search}
                className="pl-9"
              />
            </div>

            {/* Event Filter */}
            <Select name="eventId" defaultValue={eventId || "all"}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
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
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="SETTLED">Settled</SelectItem>
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
        Showing {marketsWithVolume.length} market{marketsWithVolume.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
        {eventId && ` in selected event`}
        {status && ` with status ${status}`}
      </p>

      <GlassCard variant="solid">
        <GlassCardContent className="p-0">
          {/* Mobile Card View */}
          <div className="md:hidden p-4 space-y-3">
            {marketsWithVolume.map((market) => {
              const outcomes = parseOutcomes(market.outcomes);
              return (
                <div
                  key={market.id}
                  className="p-4 rounded-lg border border-border bg-card/50"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2">{market.question}</p>
                      <Link 
                        href={getAdminEventUrl(market.event.id)}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        {market.event.title}
                      </Link>
                    </div>
                    <Badge
                      variant={
                        market.status === "OPEN"
                          ? "success"
                          : market.status === "SETTLED"
                            ? "default"
                            : market.status === "RESOLVED"
                              ? "default"
                              : "secondary"
                      }
                      className="flex-shrink-0"
                    >
                      {market.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge variant="outline" className="text-xs">{outcomes[0]}</Badge>
                    <Badge variant="outline" className="text-xs">{outcomes[1]}</Badge>
                    <Badge variant="secondary" className="text-xs">{market.event.category}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div>
                      <p className="text-muted-foreground">Volume</p>
                      <p className="font-mono font-medium">${market.volume.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bets</p>
                      <p className="font-medium">{market._count.bets}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Published</p>
                      <PublishToggle
                        id={market.id}
                        type="market"
                        isPublished={market.isPublished}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={getAdminMarketUrl(market.id)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={getAdminMarketEditUrl(market.id)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
            {marketsWithVolume.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">
                No markets found. Try adjusting your filters.
              </p>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    <Link href={buildSortUrl("question")} className="flex items-center hover:text-foreground">
                      Market
                      <SortIcon column="question" />
                    </Link>
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Event
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Outcomes
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Published
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Status
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
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    <Link href={buildSortUrl("closesAt")} className="flex items-center justify-end hover:text-foreground">
                      Closes
                      <SortIcon column="closesAt" />
                    </Link>
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground sticky right-0 bg-card">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {marketsWithVolume.map((market) => {
                  const outcomes = parseOutcomes(market.outcomes);

                  return (
                    <tr
                      key={market.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors group"
                    >
                      <td className="p-4">
                        <p className="font-medium text-sm max-w-xs truncate">
                          {market.question}
                        </p>
                      </td>
                      <td className="p-4">
                        <Link 
                          href={getAdminEventUrl(market.event.id)}
                          className="text-sm text-muted-foreground hover:text-primary truncate max-w-[150px] block"
                        >
                          {market.event.title}
                        </Link>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {market.event.category}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {outcomes[0]}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {outcomes[1]}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4">
                        <PublishToggle
                          id={market.id}
                          type="market"
                          isPublished={market.isPublished}
                        />
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            market.status === "OPEN"
                              ? "success"
                              : market.status === "SETTLED"
                                ? "default"
                                : market.status === "RESOLVED"
                                  ? "default"
                                  : "secondary"
                          }
                        >
                          {market.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-mono text-sm">
                        ${market.volume.toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        {market._count.bets}
                      </td>
                      <td className="p-4 text-right text-sm text-muted-foreground">
                        {market.closesAt
                          ? format(new Date(market.closesAt), "MMM d, yyyy")
                          : "-"}
                      </td>
                      <td className="p-4 text-right sticky right-0 bg-card group-hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={getAdminMarketUrl(market.id)}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={getAdminMarketEditUrl(market.id)}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {marketsWithVolume.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No markets found. Try adjusting your filters.
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
