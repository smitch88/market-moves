/**
 * Centralized outcome color configuration for the entire platform.
 * Provides consistent colors for market outcomes based on market type and outcome labels.
 */

export interface OutcomeColorConfig {
  primary: string;
  secondary: string;
}

/**
 * Get colors for a market's outcomes based on the outcome labels.
 * This provides intelligent color selection based on common patterns.
 */
export function getOutcomeColors(outcomes: string[]): string[] {
  if (outcomes.length === 0) return [DEFAULT_COLORS.primary, DEFAULT_COLORS.secondary];
  if (outcomes.length === 1) return [DEFAULT_COLORS.primary];
  
  const firstOutcome = outcomes[0].toLowerCase();
  const secondOutcome = outcomes[1]?.toLowerCase() || "";

  // Yes/No markets
  if (firstOutcome === "yes" && secondOutcome === "no") {
    return [YES_NO_COLORS.yes, YES_NO_COLORS.no];
  }

  // Over/Under markets
  if (
    (firstOutcome.includes("over") && secondOutcome.includes("under")) ||
    (firstOutcome.startsWith("o ") || firstOutcome.startsWith("u "))
  ) {
    return [OVER_UNDER_COLORS.over, OVER_UNDER_COLORS.under];
  }

  // Spread markets (e.g., "Team -3.5", "Team +3.5")
  if (
    (firstOutcome.includes("-") || firstOutcome.includes("+")) &&
    (secondOutcome.includes("-") || secondOutcome.includes("+"))
  ) {
    return [SPREAD_COLORS.favorite, SPREAD_COLORS.underdog];
  }

  // Team matchups (two different teams)
  // Use balanced blue shades for competitive matchups
  if (outcomes.length === 2 && !firstOutcome.includes("yes") && !firstOutcome.includes("no")) {
    return [MATCHUP_COLORS.team1, MATCHUP_COLORS.team2];
  }

  // Multi-outcome markets (3+ options)
  if (outcomes.length >= 3) {
    return MULTI_OUTCOME_COLORS.slice(0, outcomes.length);
  }

  // Default fallback
  return [DEFAULT_COLORS.primary, DEFAULT_COLORS.secondary];
}

/**
 * Get a single color for a specific outcome by index
 */
export function getOutcomeColor(outcomes: string[], index: number): string {
  const colors = getOutcomeColors(outcomes);
  return colors[index] || DEFAULT_COLORS.primary;
}

/**
 * Convert HSL color string to RGB hex format (for compatibility with older components)
 * @param hsl - HSL color string in format "hsl(h s% l%)"
 * @returns RGB hex color string in format "#RRGGBB"
 */
export function hslToHex(hsl: string): string {
  // Extract h, s, l values
  const match = hsl.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (!match) return hsl; // Return as-is if not HSL format
  
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ============================================================================
// COLOR PALETTES
// Matches the website's design system from globals.css
// Blue and Red for neutral, balanced representation (no positive/negative implication)
// ============================================================================

/**
 * Default colors for generic binary markets
 * Uses blue and brand red - neutral colors without positive/negative connotation
 */
export const DEFAULT_COLORS = {
  primary: "hsl(217 91% 60%)", // Blue - neutral first option
  secondary: "hsl(358 85% 58%)", // Brand red - neutral second option
} as const;

/**
 * Yes/No markets - Blue for Yes, Red for No
 * Neutral colors that don't imply good/bad
 */
export const YES_NO_COLORS = {
  yes: "hsl(217 91% 60%)", // Blue
  no: "hsl(358 85% 58%)", // Brand red
} as const;

/**
 * Over/Under markets - Blue for Over, Red for Under
 */
export const OVER_UNDER_COLORS = {
  over: "hsl(217 91% 60%)", // Blue
  under: "hsl(358 85% 58%)", // Brand red
} as const;

/**
 * Spread markets - Blue for favorite, Amber for underdog
 */
export const SPREAD_COLORS = {
  favorite: "hsl(217 91% 60%)", // Blue
  underdog: "hsl(38 92% 50%)", // Amber
} as const;

/**
 * Team matchup markets - Blue vs Red for competitive balance
 */
export const MATCHUP_COLORS = {
  team1: "hsl(217 91% 60%)", // Blue
  team2: "hsl(358 85% 58%)", // Brand red
} as const;

/**
 * Multi-outcome markets (3+ options)
 * Provides a diverse, accessible color palette matching design system
 */
export const MULTI_OUTCOME_COLORS = [
  "hsl(217 91% 60%)", // Blue
  "hsl(358 85% 58%)", // Brand red
  "hsl(271 81% 56%)", // Purple
  "hsl(38 92% 50%)", // Amber
  "hsl(189 85% 46%)", // Cyan
  "hsl(330 81% 60%)", // Pink
  "hsl(152 75% 42%)", // Emerald (for multi-option only)
  "hsl(25 95% 53%)", // Orange
] as const;

/**
 * Legacy function for backwards compatibility
 * @deprecated Use getOutcomeColors instead
 */
export function parseOutcomeColors(
  outcomeColors: string | null | undefined,
  outcomes?: string[]
): string[] {
  // If colors are provided in the database (legacy), use them
  if (outcomeColors) {
    try {
      return JSON.parse(outcomeColors);
    } catch {
      // Fall through to new logic
    }
  }

  // Use new centralized logic
  if (outcomes && outcomes.length > 0) {
    return getOutcomeColors(outcomes);
  }

  return [DEFAULT_COLORS.primary, DEFAULT_COLORS.secondary];
}
