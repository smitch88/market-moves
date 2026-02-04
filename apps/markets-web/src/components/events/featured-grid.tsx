import { prisma, MarketCategory, Prisma, BetStatus } from "@vault/database";
import { getSessionUser } from "@vault/auth";
import { EventCard } from "./event-card";
import { BookmarksEmptyState } from "./bookmarks-empty-state";

interface FeaturedGridProps {
  view?: string;
  category?: string;
  query?: string;
  sortBy?: string;
  sortDir?: string;
  status?: string;
}

export async function FeaturedGrid({ 
  view = "trending", 
  category, 
  query,
  sortBy = "volume",
  sortDir = "desc",
  status = "open",
}: FeaturedGridProps) {
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

  // Fetch events with aggregated market data
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
    take: 50,
  });

  const eventsWithMarkets = events.filter((event) => event.markets.length > 0);

  let eventsWithAggregations = eventsWithMarkets.map((event) => {
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

  const sortedEvents = sortEvents(eventsWithAggregations, sortBy, sortDir);
  // Featured section: max 6 events
  const featuredEvents = sortedEvents.slice(0, 6);

  if (featuredEvents.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
      {featuredEvents.map((event, index) => (
        <EventCard key={event.id} event={event} index={index} />
      ))}
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
  pinned: boolean;
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
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

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
export function FeaturedGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-72 bg-card/60 rounded-2xl border border-border/40 animate-pulse"
        />
      ))}
    </div>
  );
}
