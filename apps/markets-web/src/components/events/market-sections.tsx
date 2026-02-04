import { prisma, MarketCategory, Prisma, BetStatus } from "@vault/database";
import { getSessionUser } from "@vault/auth";
import { EventCard } from "./event-card";
import { MarketSection } from "./explore-section";
import { BookmarksEmptyState } from "./bookmarks-empty-state";

interface MarketSectionsProps {
  view?: string;
  category?: string;
  query?: string;
  sortBy?: string;
  sortDir?: string;
  status?: string;
}

export async function MarketSections({ 
  view = "trending", 
  category, 
  query,
  sortBy = "volume",
  sortDir = "desc",
  status = "open",
}: MarketSectionsProps) {
  // Handle bookmarks view
  let bookmarkedEventIds: string[] = [];
  if (view === "bookmarks") {
    const user = await getSessionUser();
    if (!user) {
      return <BookmarksEmptyState requiresLogin />;
    }
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      select: { eventId: true },
    });
    bookmarkedEventIds = bookmarks.map((b) => b.eventId);
    if (bookmarkedEventIds.length === 0) {
      return <BookmarksEmptyState />;
    }
  }

  // Fetch all events with aggregated market data
  const events = await prisma.event.findMany({
    where: {
      active: true,
      isPublished: true,
      ...(category && category !== "all" && {
        category: category as MarketCategory,
      }),
      ...(query && {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      }),
      markets: {
        some: {
          isPublished: true,
          ...getMarketStatusFilter(status),
        },
      },
      ...getViewFilter(view, bookmarkedEventIds),
    },
    include: {
      _count: {
        select: { markets: true },
      },
      createdByKol: {
        select: {
          id: true,
          name: true,
          handle: true,
          profileImageUrl: true,
        },
      },
      markets: {
        where: {
          isPublished: true,
          ...getMarketStatusFilter(status),
        },
        select: {
          id: true,
          status: true,
          seed0: true,
          seed1: true,
          pool0: true,
          pool1: true,
          closesAt: true,
          resolvedOutcome: true,
          _count: {
            select: { 
              bets: { where: { status: BetStatus.CONFIRMED } },
              tweetProofs: true,
            },
          },
        },
      },
    },
    orderBy: getViewOrderBy(view),
    take: 100, // Get more to split into sections
  });

  const eventsWithMarkets = events.filter((event) => event.markets.length > 0);

  // Transform events with aggregations
  const eventsWithAggregations = eventsWithMarkets.map((event) => {
    const totalVolume = event.markets.reduce((sum, market) => {
      return sum + Number(market.seed0 || 0) + Number(market.seed1 || 0) + Number(market.pool0 || 0) + Number(market.pool1 || 0);
    }, 0);

    const totalBets = event.markets.reduce((sum, market) => {
      return sum + market._count.bets;
    }, 0);

    const totalVerifications = event.markets.reduce((sum, market) => {
      return sum + market._count.tweetProofs;
    }, 0);

    const earliestClose = event.markets.reduce((earliest, market) => {
      if (!market.closesAt) return earliest;
      if (!earliest) return market.closesAt;
      return market.closesAt < earliest ? market.closesAt : earliest;
    }, null as Date | null);

    const { markets, createdByKol, ...eventData } = event;

    return {
      ...eventData,
      startTime: event.startTime?.toISOString() ?? null,
      endTime: event.endTime?.toISOString() ?? null,
      createdAt: event.createdAt?.toISOString() ?? null,
      updatedAt: event.updatedAt?.toISOString() ?? null,
      createdByKol: createdByKol || null,
      _aggregations: {
        totalVolume,
        totalBets,
        totalVerifications,
        earliestClose: earliestClose?.toISOString() ?? null,
      },
    };
  });

  // Split into sections with hierarchy (top-down, no duplicates):
  // 1. Featured: Events with `pinned: true` flag, sorted by user's preference
  // 2. Ending Soon: Non-pinned events ending within 48 hours, sorted by close time
  // 3. Explore More: Everything else, sorted by user's preference
  // Note: `featured` flag is used for the top banner/carousel, `pinned` is for this section

  const now = new Date();
  const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // 1. Featured (Pinned): Only events explicitly marked as pinned
  const pinnedCandidates = eventsWithAggregations.filter(e => e.pinned);
  const featuredEvents = sortEvents(pinnedCandidates, sortBy, sortDir).slice(0, 6);
  const featuredIds = new Set(featuredEvents.map(e => e.id));

  // 2. Ending Soon: Non-pinned events ending within 48 hours
  const endingSoonCandidates = eventsWithAggregations.filter(event => {
    // Exclude pinned/featured events (hierarchy)
    if (featuredIds.has(event.id)) return false;
    // Must have a close time within 48 hours
    if (!event._aggregations.earliestClose) return false;
    const closeTime = new Date(event._aggregations.earliestClose);
    return closeTime > now && closeTime <= fortyEightHoursFromNow;
  });
  // Sort by earliest close time (soonest first)
  const endingSoonEvents = [...endingSoonCandidates]
    .sort((a, b) => {
      const aClose = a._aggregations.earliestClose ? new Date(a._aggregations.earliestClose).getTime() : Infinity;
      const bClose = b._aggregations.earliestClose ? new Date(b._aggregations.earliestClose).getTime() : Infinity;
      return aClose - bClose;
    })
    .slice(0, 10);
  const endingSoonIds = new Set(endingSoonEvents.map(e => e.id));

  // 3. Explore More: Everything not in featured or ending soon
  const exploreCandidates = eventsWithAggregations.filter(
    event => !featuredIds.has(event.id) && !endingSoonIds.has(event.id)
  );
  const exploreEvents = sortEvents(exploreCandidates, sortBy, sortDir).slice(0, 20);

  // Check if we have any events at all
  if (featuredEvents.length === 0 && endingSoonEvents.length === 0 && exploreEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <h3 className="text-foreground text-xl font-bold mb-2">No events found</h3>
        <p className="text-sm text-muted-foreground">
          Check back soon for new prediction markets
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Featured Section */}
      {featuredEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Featured</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {featuredEvents.map((event, index) => (
              <EventCard key={event.id} event={event} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Ending Soon Section */}
      {endingSoonEvents.length > 0 && (
        <MarketSection title="Ending Soon" events={endingSoonEvents} />
      )}

      {/* Explore More Section */}
      {exploreEvents.length > 0 && (
        <MarketSection title="Explore More" events={exploreEvents} />
      )}
    </div>
  );
}

function getMarketStatusFilter(status: string): Prisma.MarketWhereInput {
  switch (status) {
    case "open":
      return { status: { in: ["PUBLISHED", "OPEN"] } };
    case "closed":
      return { status: { in: ["CLOSED", "RESOLVED", "SETTLED"] } };
    case "all":
    default:
      return {};
  }
}

function getViewFilter(view: string, bookmarkedEventIds?: string[]): Prisma.EventWhereInput {
  switch (view) {
    case "ending":
      return {
        markets: {
          some: {
            closesAt: { gte: new Date() },
            status: { in: ["PUBLISHED", "OPEN"] },
          },
        },
      };
    case "new":
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        createdAt: { gte: weekAgo },
      };
    case "kol-created":
      return {
        createdByKolId: { not: null },
      };
    case "bookmarks":
      return {
        id: { in: bookmarkedEventIds || [] },
      };
    case "trending":
    default:
      return {};
  }
}

function getViewOrderBy(view: string): Prisma.EventOrderByWithRelationInput {
  switch (view) {
    case "ending":
      return { endTime: "asc" };
    case "new":
      return { createdAt: "desc" };
    case "kol-created":
      return { createdAt: "desc" };
    case "trending":
    default:
      return { markets: { _count: "desc" } };
  }
}

function sortEvents<T extends {
  startTime: string | null;
  _aggregations: {
    totalVolume: number;
    totalVerifications: number;
  };
}>(
  events: T[],
  sortBy: string,
  sortDir: string
): T[] {
  const direction = sortDir === "asc" ? 1 : -1;

  return [...events].sort((a, b) => {
    switch (sortBy) {
      case "volume":
        return (a._aggregations.totalVolume - b._aggregations.totalVolume) * direction;
      
      case "verified":
        return (a._aggregations.totalVerifications - b._aggregations.totalVerifications) * direction;
      
      case "startDate": {
        const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
        if (!a.startTime && !b.startTime) return 0;
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return (aStart - bStart) * direction;
      }
      
      default:
        return (a._aggregations.totalVolume - b._aggregations.totalVolume) * direction;
    }
  });
}

// Skeleton for loading state
export function MarketSectionsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Featured skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-24 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 bg-card/60 rounded-2xl border border-border/40 animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Ending Soon skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-card/60 rounded-xl border border-border/40 animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Explore skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-card/60 rounded-xl border border-border/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
