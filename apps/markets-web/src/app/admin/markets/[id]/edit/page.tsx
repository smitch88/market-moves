import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { MarketForm } from "@/components/admin/market-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMarketPage({ params }: PageProps) {
  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: { outcomes: true },
  });

  if (!market) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Edit Market</h1>
        <p className="text-muted-foreground">{market.title}</p>
      </div>

      <MarketForm market={market} />
    </div>
  );
}
