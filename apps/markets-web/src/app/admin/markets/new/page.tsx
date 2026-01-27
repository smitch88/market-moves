import { MarketForm } from "@/components/admin/market-form";

export default function NewMarketPage() {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Create Market</h1>
        <p className="text-muted-foreground">Create a new prediction market</p>
      </div>

      <MarketForm />
    </div>
  );
}
