import { prisma, MarketCategory, Prisma } from "@vault/database";
import { EventCard } from "./event-card";

interface EventGridProps {
  sort?: string;
  category?: string;
  query?: string;
}

export async function EventGrid({ sort = "trending", category, query }: EventGridProps) {
  // Fetch events with aggregated market data
  const events = await prisma.event.findMany({
    where: {
      active: true,
      ...(category && category !== "all" && {
        category: category as MarketCategory,
      }),
      ...(query && {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      _count: {
        select: { markets: true },
      },
      markets: {
        where: {
          status: { in: ["PUBLISHED", "OPEN"] },
        },
        select: {
          seed0: true,
          seed1: true,
          pool0: true,
          pool1: true,
          _count: {
            select: { bets: true },
          },
        },
      },
    },
    orderBy: getOrderBy(sort),
    take: 20,
  });

  // Transform to include aggregations (convert Decimals to numbers)
  const eventsWithAggregations = events.map((event) => {
    const totalVolume = event.markets.reduce((sum, market) => {
      return sum + Number(market.seed0 || 0) + Number(market.seed1 || 0) + Number(market.pool0 || 0) + Number(market.pool1 || 0);
    }, 0);

    const totalBets = event.markets.reduce((sum, market) => {
      return sum + market._count.bets;
    }, 0);

    // Remove the markets array from the result, keep only aggregations
    // Serialize dates for client component
    const { markets, ...eventData } = event;

    return {
      ...eventData,
      startTime: event.startTime?.toISOString() ?? null,
      endTime: event.endTime?.toISOString() ?? null,
      createdAt: event.createdAt?.toISOString() ?? null,
      updatedAt: event.updatedAt?.toISOString() ?? null,
      _aggregations: {
        totalVolume,
        totalBets,
      },
    };
  });

  if (eventsWithAggregations.length === 0) {
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
      {eventsWithAggregations.map((event, index) => (
        <EventCard key={event.id} event={event} index={index} />
      ))}
    </div>
  );
}

function getOrderBy(sort: string): Prisma.EventOrderByWithRelationInput {
  switch (sort) {
    case "trending":
      return { markets: { _count: "desc" } };
    case "ending":
      return { endTime: "asc" };
    case "new":
      return { createdAt: "desc" };
    default:
      return { createdAt: "desc" };
  }
}
