import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { MarketForm } from "@/components/admin/market-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper to serialize market for client components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeMarket(market: any) {
  return {
    ...market,
    seed0: Number(market.seed0),
    seed1: Number(market.seed1),
    pool0: Number(market.pool0),
    pool1: Number(market.pool1),
    k: market.k ? Number(market.k) : null,
    reserve0: Number(market.reserve0),
    reserve1: Number(market.reserve1),
    publishedAt: market.publishedAt?.toISOString() ?? null,
    opensAt: market.opensAt?.toISOString() ?? null,
    closesAt: market.closesAt?.toISOString() ?? null,
    resolvedAt: market.resolvedAt?.toISOString() ?? null,
    settledAt: market.settledAt?.toISOString() ?? null,
    createdAt: market.createdAt?.toISOString() ?? null,
    updatedAt: market.updatedAt?.toISOString() ?? null,
    event: market.event ? {
      ...market.event,
      startTime: market.event.startTime?.toISOString() ?? null,
      endTime: market.event.endTime?.toISOString() ?? null,
      createdAt: market.event.createdAt?.toISOString() ?? null,
      updatedAt: market.event.updatedAt?.toISOString() ?? null,
    } : null,
  };
}

export default async function EditMarketPage({ params }: PageProps) {
  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: { event: true },
  });

  if (!market) {
    notFound();
  }

  // Serialize market for client component
  const serializedMarket = serializeMarket(market);

  // Parse the question for display
  const displayTitle = market.event?.title || market.question;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Edit Market</h1>
        <p className="text-muted-foreground">{displayTitle}</p>
      </div>

      <MarketForm market={serializedMarket} />
    </div>
  );
}
