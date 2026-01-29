import { prisma } from "@vault/database";
import { FeaturedEventBanner } from "./featured-event-banner";

export async function FeaturedEvents() {
  // Fetch featured events with their primary markets
  const events = await prisma.event.findMany({
    where: {
      active: true,
      featured: true, // Only show featured events
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
  // Serialize data for client components
  const eventsWithData = events
    .filter((event) => event.markets.length > 0)
    .map((event) => {
      // Calculate total volume across all markets (convert Decimals to numbers)
      const totalVolume = event.markets.reduce((sum, market) => {
        return (
          sum +
          Number(market.seed0 || 0) +
          Number(market.seed1 || 0) +
          Number(market.pool0 || 0) +
          Number(market.pool1 || 0)
        );
      }, 0);

      // Serialize markets
      const serializedMarkets = event.markets.map((market) => ({
        ...market,
        pool0: Number(market.pool0),
        pool1: Number(market.pool1),
        seed0: Number(market.seed0),
        seed1: Number(market.seed1),
        closesAt: market.closesAt?.toISOString() ?? null,
      }));

      return {
        ...event,
        startTime: event.startTime?.toISOString() ?? null,
        endTime: event.endTime?.toISOString() ?? null,
        createdAt: event.createdAt?.toISOString() ?? null,
        updatedAt: event.updatedAt?.toISOString() ?? null,
        markets: serializedMarkets,
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
    <div className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-sm border border-border/40 shadow-lg animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left Side Skeleton */}
        <div className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="h-16 w-16 rounded-xl bg-muted/50" />
            <div className="flex-1">
              <div className="h-4 w-24 bg-muted/50 rounded mb-3" />
              <div className="h-7 w-56 bg-muted/50 rounded" />
            </div>
          </div>
          <div className="flex gap-3 mb-6">
            <div className="flex-1 h-20 bg-muted/50 rounded-xl" />
            <div className="flex-1 h-20 bg-muted/50 rounded-xl" />
          </div>
          <div className="h-4 w-full bg-muted/50 rounded mb-3" />
          <div className="h-4 w-3/4 bg-muted/50 rounded" />
        </div>
        {/* Right Side Skeleton */}
        <div className="border-l border-border/30 bg-muted/5 p-8">
          <div className="h-5 w-48 bg-muted/50 rounded mb-6" />
          <div className="h-[180px] bg-muted/30 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
