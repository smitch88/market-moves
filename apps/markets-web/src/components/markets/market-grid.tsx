import { prisma, MarketCategory } from "@vault/database";
import { MarketCard } from "./market-card";

interface MarketGridProps {
  sort?: string;
  category?: string;
  query?: string;
}

export async function MarketGrid({ sort = "trending", category, query }: MarketGridProps) {
  const markets = await prisma.market.findMany({
    where: {
      status: { in: ["PUBLISHED", "OPEN"] },
      ...(category && category !== "all" && {
        category: category as MarketCategory,
      }),
      ...(query && {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { question: { contains: query, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      outcomes: true,
      _count: {
        select: { bets: true },
      },
    },
    orderBy: getOrderBy(sort),
    take: 20,
  });

  if (markets.length === 0) {
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
        <p className="text-muted-foreground text-lg font-medium">No markets found</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Check back soon for new prediction markets
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {markets.map((market, index) => (
        <MarketCard key={market.id} market={market} index={index} />
      ))}
    </div>
  );
}

function getOrderBy(sort: string) {
  switch (sort) {
    case "trending":
      return { bets: { _count: "desc" as const } };
    case "ending":
      return { closesAt: "asc" as const };
    case "new":
      return { publishedAt: "desc" as const };
    default:
      return { publishedAt: "desc" as const };
  }
}
