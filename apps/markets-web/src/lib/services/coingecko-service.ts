const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS = 30_000; // 30 seconds to avoid rate limits

type CacheEntry = { price: number; timestamp: Date };
const priceCache = new Map<string, CacheEntry>();

export type CoinGeckoPriceResult = {
  price: number;
  timestamp: Date;
};

/**
 * Fetch current USD price for a token from CoinGecko (free tier, no API key).
 * Uses a short in-memory cache to avoid rate limits.
 */
export async function getPrice(coingeckoId: string): Promise<CoinGeckoPriceResult> {
  const cached = priceCache.get(coingeckoId);
  if (cached && Date.now() - cached.timestamp.getTime() < CACHE_TTL_MS) {
    return { price: cached.price, timestamp: cached.timestamp };
  }

  const url = new URL(`${COINGECKO_BASE}/simple/price`);
  url.searchParams.set("ids", coingeckoId);
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("include_last_updated_at", "true");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Record<
    string,
    { usd?: number; usd_last_updated_at?: number }
  >;
  const token = data[coingeckoId];
  if (!token || typeof token.usd !== "number") {
    throw new Error(`CoinGecko: no price for id "${coingeckoId}"`);
  }

  const timestamp = token.usd_last_updated_at
    ? new Date(token.usd_last_updated_at * 1000)
    : new Date();
  const result: CoinGeckoPriceResult = { price: token.usd, timestamp };
  priceCache.set(coingeckoId, result);
  return result;
}
