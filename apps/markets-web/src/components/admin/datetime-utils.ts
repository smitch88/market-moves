/**
 * Datetime utilities for admin forms.
 * All datetimes are stored and handled as UTC.
 * datetime-local inputs work with UTC values directly.
 */

/**
 * Format a UTC ISO date string for datetime-local input.
 * Returns the UTC time as-is (YYYY-MM-DDTHH:mm format).
 */
export function formatUtcForInput(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  try {
    // Parse and re-format to ensure consistent format
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "";
    // Return UTC time in datetime-local format
    return date.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

/**
 * Convert a datetime-local input value to UTC ISO string.
 * Treats the input value as UTC (appends Z timezone).
 */
export function inputToUtcIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // datetime-local gives us "YYYY-MM-DDTHH:mm", treat as UTC
  return `${value}:00.000Z`;
}

/**
 * Format a UTC date as local time string for display reference.
 */
export function formatUtcAsLocal(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "";
  }
}

/**
 * Get current time formatted for datetime-local input (in UTC).
 */
export function getCurrentUtcForInput(): string {
  return new Date().toISOString().slice(0, 16);
}

