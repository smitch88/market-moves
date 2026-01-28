import { prisma } from "@vault/database";
import { FeaturedEventBanner } from "./featured-event-banner";

export async function FeaturedEvents() {
  // Fetch active events with their primary markets
  const events = await prisma.event.findMany({
    where: {
      active: true,
      // Only show events that haven't ended yet
      OR: [
        { endTime: null },
        { endTime: { gt: new Date() } },
      ],
    },
    include: {
      markets: {
        where: {
          status: { in: ["PUBLISHED", "OPEN"] },
        },
        select: {
          id: true,
          question: true,
          outcomes: true,
          outcomePrices: true,
          outcomeColors: true,
          pool0: true,
          pool1: true,
          seed0: true,
          seed1: true,
          status: true,
          closesAt: true,
          _count: {
            select: { bets: true },
          },
        },
        orderBy: {
          bets: { _count: "desc" },
        },
        take: 1, // Only get the most active market
      },
    },
    orderBy: [
      { startTime: "asc" }, // Prioritize upcoming events
      { createdAt: "desc" },
    ],
    take: 5, // Show up to 5 featured events in carousel
  });

  // Filter to only events with markets and calculate aggregations
  const eventsWithData = events
    .filter((event) => event.markets.length > 0)
    .map((event) => {
      // Calculate total volume across all markets (we only have 1 here, but structure for future)
      const totalVolume = event.markets.reduce((sum, market) => {
        return (
          sum +
          (market.seed0 || 0) +
          (market.seed1 || 0) +
          (market.pool0 || 0) +
          (market.pool1 || 0)
        );
      }, 0);

      return {
        ...event,
        _aggregations: {
          totalVolume,
        },
      };
    });

  if (eventsWithData.length === 0) {
    return null;
  }

  return <FeaturedEventBanner events={eventsWithData} />;
}

export function FeaturedEventsSkeleton() {
  return (
    <div className="mb-6">
      <div className="glass-card overflow-hidden animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left Side Skeleton */}
          <div className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-14 w-14 rounded-xl bg-muted" />
              <div className="flex-1">
                <div className="h-4 w-20 bg-muted rounded mb-2" />
                <div className="h-6 w-48 bg-muted rounded" />
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 h-16 bg-muted rounded-lg" />
              <div className="flex-1 h-16 bg-muted rounded-lg" />
            </div>
            <div className="h-4 w-full bg-muted rounded mb-2" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </div>
          {/* Right Side Skeleton */}
          <div className="border-l border-border/50 bg-muted/5 p-6">
            <div className="h-4 w-48 bg-muted rounded mb-4" />
            <div className="h-[160px] bg-muted/50 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
