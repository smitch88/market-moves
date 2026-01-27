/**
 * Centralized URL utilities for consistent routing across the app.
 * 
 * URL conventions:
 * - /markets/[slug] - Market/prediction detail page
 * - /admin/markets/[id] - Admin market management
 */

/**
 * Generate the public URL for a market/prediction page
 */
export function getMarketUrl(slug: string): string {
  return `/markets/${slug}`;
}

/**
 * Generate the URL for a market in admin
 */
export function getAdminMarketUrl(id: string): string {
  return `/admin/markets/${id}`;
}

/**
 * Generate the URL for editing a market in admin
 */
export function getAdminMarketEditUrl(id: string): string {
  return `/admin/markets/${id}/edit`;
}

/**
 * Generate a share URL for a market
 */
export function getMarketShareUrl(slug: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/markets/${slug}`;
}

/**
 * Generate a Twitter share intent URL
 */
export function getTwitterShareUrl(params: {
  text: string;
  url: string;
  via?: string;
}): string {
  const searchParams = new URLSearchParams({
    text: params.text,
    url: params.url,
    ...(params.via && { via: params.via }),
  });
  return `https://twitter.com/intent/tweet?${searchParams.toString()}`;
}

/**
 * Generate API endpoint URL for fetching market data
 */
export function getMarketApiUrl(slug: string): string {
  return `/api/markets/${slug}`;
}

/**
 * Generate API endpoint URL for fetching markets list
 */
export function getMarketsApiUrl(params?: {
  limit?: number;
  offset?: number;
  category?: string;
  active?: boolean;
  closed?: boolean;
}): string {
  if (!params) return "/api/markets";
  
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());
  if (params.category) searchParams.set("category", params.category);
  if (params.active !== undefined) searchParams.set("active", params.active.toString());
  if (params.closed !== undefined) searchParams.set("closed", params.closed.toString());
  
  const query = searchParams.toString();
  return query ? `/api/markets?${query}` : "/api/markets";
}
