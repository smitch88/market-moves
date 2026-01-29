/**
 * Format a dollar amount with optional compact notation and sign display
 */
export function formatMoney(
  dollars: number,
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const absDollars = Math.abs(dollars);
  let formatted: string;

  if (options?.compact) {
    if (absDollars >= 1000000) {
      formatted = `${(absDollars / 1000000).toFixed(1)}m`;
    } else if (absDollars >= 1000) {
      formatted = `${(absDollars / 1000).toFixed(1)}k`;
    } else {
      formatted = absDollars.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      });
    }
  } else {
    formatted = absDollars.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (options?.showSign && dollars !== 0) {
    return dollars >= 0 ? `+$${formatted}` : `-$${formatted}`;
  }
  return dollars >= 0 ? `$${formatted}` : `-$${formatted}`;
}

/**
 * Format XP value with K/M suffixes
 */
export function formatXp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export type TimeRange = "1D" | "1W" | "1M" | "ALL";

export const TIME_RANGE_MS: Record<TimeRange, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  ALL: Infinity,
};

