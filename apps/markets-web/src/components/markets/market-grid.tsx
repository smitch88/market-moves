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
        event: { category: category as MarketCategory },
      }),
      ...(query && {
        OR: [
          { question: { contains: query, mode: "insensitive" } },
          { event: { title: { contains: query, mode: "insensitive" } } },
        ],
      }),
    },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          bannerUrl: true,
          logoUrl: true,
        },
      },
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
