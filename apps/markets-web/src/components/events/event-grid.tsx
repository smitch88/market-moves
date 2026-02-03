import { prisma, MarketCategory, Prisma, BetStatus } from "@vault/database";
import { getSessionUser } from "@vault/auth";
import { EventCard } from "./event-card";
import { BookmarksEmptyState } from "./bookmarks-empty-state";

interface EventGridProps {
  view?: string;
  category?: string;
  query?: string;
  sortBy?: string;
  sortDir?: string;
  status?: string;
}

export async function EventGrid({ 
  view = "trending", 
  category, 
  query,
  sortBy = "volume",
  sortDir = "desc",
  status = "open",
}: EventGridProps) {
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
      // Filter events that have at least one market matching the status filter
      markets: {
        some: {
          isPublished: true,
          ...getMarketStatusFilter(status),
        },
      },
      // Apply view filters
      ...getViewFilter(view, bookmarkedEventIds),
    },
    include: {
      _count: {
        select: { markets: true },
      },
      // Include KOL creator info
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
          isPublished: true, // Only show published markets
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
              tweetProofs: true, // KOL verifications
            },
          },
        },
      },
    },
    orderBy: getViewOrderBy(view),
    take: 50, // Fetch more to allow client-side sorting
  });

  // Filter out events with no markets matching the status filter
  const eventsWithMarkets = events.filter((event) => event.markets.length > 0);

  // Transform to include aggregations (convert Decimals to numbers)
  let eventsWithAggregations = eventsWithMarkets.map((event) => {
    const totalVolume = event.markets.reduce((sum, market) => {
      return sum + Number(market.seed0 || 0) + Number(market.seed1 || 0) + Number(market.pool0 || 0) + Number(market.pool1 || 0);
    }, 0);

    const totalBets = event.markets.reduce((sum, market) => {
      return sum + market._count.bets;
    }, 0);

    // Count KOL verifications (tweet proofs)
    const totalVerifications = event.markets.reduce((sum, market) => {
      return sum + market._count.tweetProofs;
    }, 0);

    // Get earliest closing market time
    const earliestClose = event.markets.reduce((earliest, market) => {
      if (!market.closesAt) return earliest;
      if (!earliest) return market.closesAt;
      return market.closesAt < earliest ? market.closesAt : earliest;
    }, null as Date | null);

    // Remove the markets array from the result, keep only aggregations
    // Serialize dates for client component
    const { markets, createdByKol, ...eventData } = event;

    return {
      ...eventData,
      startTime: event.startTime?.toISOString() ?? null,
      endTime: event.endTime?.toISOString() ?? null,
      createdAt: event.createdAt?.toISOString() ?? null,
      updatedAt: event.updatedAt?.toISOString() ?? null,
      // Include KOL creator if present
      createdByKol: createdByKol || null,
      _aggregations: {
        totalVolume,
        totalBets,
        totalVerifications,
        earliestClose: earliestClose?.toISOString() ?? null,
      },
    };
  });

  // Apply sortBy and sortDir
  const sortedEvents = sortEvents(eventsWithAggregations, sortBy, sortDir);

  // Limit to 20 after sorting
  const finalEvents = sortedEvents.slice(0, 20);

  if (finalEvents.length === 0) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-fr">
      {finalEvents.map((event, index) => (
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
      return {}; // No status filter for "all"
  }
}

function getViewFilter(view: string, bookmarkedEventIds?: string[]): Prisma.EventWhereInput {
  switch (view) {
    case "ending":
      // Events with markets closing soon
      return {
        markets: {
          some: {
            closesAt: { gte: new Date() },
            status: { in: ["PUBLISHED", "OPEN"] },
          },
        },
      };
    case "new":
      // Events created in last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        createdAt: { gte: weekAgo },
      };
    case "kol-created":
      // Events created by KOLs/Captains
      return {
        createdByKolId: { not: null },
      };
    case "bookmarks":
      // Filter by bookmarked event IDs
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
      // Most recently created KOL events first
      return { createdAt: "desc" };
    case "trending":
    default:
      return { markets: { _count: "desc" } };
  }
}

// Generic sort function that works with any event type that has these fields
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
    // Pinned events always come first
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
        // For start date, nulls should go to the end
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
