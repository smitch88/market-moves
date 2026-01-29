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
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <svg
            className="h-8 w-8 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-muted-foreground text-lg font-medium">No events found</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Check back soon for new prediction events
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
