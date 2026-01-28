"use client";

import { MarketChart } from "@/components/sports/market-chart";
import type { Market, Event } from "@vault/database";

interface AdminPriceChartProps {
  market: Market & { event: Event };
}

export function AdminPriceChart({ market }: AdminPriceChartProps) {
  return <MarketChart market={market} />;
}
