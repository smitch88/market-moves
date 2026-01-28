import type { Market } from "@vault/database";

// Market type classification
export type MarketType = "moneyline" | "spread" | "total" | "team-total" | "player-prop";

// Prop type for player props
export type PropType = "anytime-td" | "first-td" | "rushing" | "receiving" | "passing" | "other";

// Parse outcomes from JSON string
export function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

// Parse outcome prices from JSON string
export function parseOutcomePrices(outcomePrices: string): string[] {
  try {
    return JSON.parse(outcomePrices);
  } catch {
    return ["0.50", "0.50"];
  }
}

// Format volume for display
export function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}m`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

// Calculate market volume
export function getMarketVolume(market: Market): number {
  return (market.seed0 || 0) + (market.seed1 || 0) + (market.pool0 || 0) + (market.pool1 || 0);
}

// Extract line value from market question
// Examples: "O/U 46.5" -> 46.5, "Spread: Seahawks (-4.5)" -> 4.5
export function extractLine(question: string): number | null {
  // Match O/U pattern: "O/U 46.5" or "O/U 23.5"
  const ouMatch = question.match(/O\/U\s+(\d+\.?\d*)/i);
  if (ouMatch) return parseFloat(ouMatch[1]);

  // Match spread pattern: "(-4.5)" or "(+4.5)"
  const spreadMatch = question.match(/\(([+-]?\d+\.?\d*)\)/);
  if (spreadMatch) return Math.abs(parseFloat(spreadMatch[1]));

  // Match yards O/U pattern: "Rushing Yards O/U 75.5"
  const yardsMatch = question.match(/Yards?\s+O\/U\s+(\d+\.?\d*)/i);
  if (yardsMatch) return parseFloat(yardsMatch[1]);

  return null;
}

// Extract player name from market question
// Example: "Kenneth Walker III: Rushing Yards O/U 75.5" -> "Kenneth Walker III"
export function extractPlayerName(question: string): string | null {
  // Match pattern: "Player Name: ..."
  const colonMatch = question.match(/^([^:]+):/);
  if (colonMatch) {
    return colonMatch[1].trim();
  }
  return null;
}

// Extract team name from market question
// Example: "Seahawks Team Total: O/U 25.5" -> "Seahawks"
export function extractTeamName(question: string): string | null {
  // Match "Team Total" pattern
  const teamTotalMatch = question.match(/^(\w+)\s+Team\s+Total/i);
  if (teamTotalMatch) {
    return teamTotalMatch[1];
  }
  return null;
}

// Get team abbreviation (first 3 letters)
export function getTeamAbbreviation(teamName: string): string {
  return teamName.substring(0, 3).toUpperCase();
}

// Determine market type from question
export function getMarketType(question: string): MarketType {
  const q = question.toLowerCase();
  
  if (q.includes("vs.") || q.includes("vs ") || (q.includes("moneyline") && !q.includes("1h"))) {
    return "moneyline";
  }
  
  if (q.includes("spread")) {
    return "spread";
  }
  
  if (q.includes("team total")) {
    return "team-total";
  }
  
  if (q.includes("o/u") && !q.includes(":")) {
    return "total";
  }
  
  return "player-prop";
}

// Determine prop type for player props
export function getPropType(question: string): PropType {
  const q = question.toLowerCase();
  
  if (q.includes("anytime touchdown")) {
    return "anytime-td";
  }
  
  if (q.includes("first touchdown")) {
    return "first-td";
  }
  
  if (q.includes("rushing")) {
    return "rushing";
  }
  
  if (q.includes("receiving")) {
    return "receiving";
  }
  
  if (q.includes("passing")) {
    return "passing";
  }
  
  return "other";
}

// Check if market is an Over/Under type
export function isOverUnder(market: Market): boolean {
  const outcomes = parseOutcomes(market.outcomes);
  const firstOutcome = outcomes[0]?.toLowerCase() || "";
  return firstOutcome.includes("over") || firstOutcome.startsWith("o ");
}

// Extract short label from outcome (e.g., "Over 46.5" -> "O 46.5")
export function shortenOutcomeLabel(label: string): string {
  if (label.toLowerCase().startsWith("over")) {
    return label.replace(/^over\s*/i, "O ");
  }
  if (label.toLowerCase().startsWith("under")) {
    return label.replace(/^under\s*/i, "U ");
  }
  // For spreads like "Seahawks -4.5" -> "SEA -4.5"
  const parts = label.split(" ");
  if (parts.length >= 2 && /^[+-]?\d/.test(parts[parts.length - 1])) {
    const abbrev = parts[0].substring(0, 3).toUpperCase();
    return `${abbrev} ${parts.slice(1).join(" ")}`;
  }
  return label;
}

// Group markets by line value
export function groupMarketsByLine(markets: Market[]): Map<number, Market> {
  const map = new Map<number, Market>();
  for (const market of markets) {
    const line = extractLine(market.question);
    if (line !== null) {
      map.set(line, market);
    }
  }
  return map;
}

// Get sorted line values from markets
export function getLineValues(markets: Market[]): number[] {
  const lines: number[] = [];
  for (const market of markets) {
    const line = extractLine(market.question);
    if (line !== null && !lines.includes(line)) {
      lines.push(line);
    }
  }
  return lines.sort((a, b) => a - b);
}

// Group player prop markets by player name
export function groupByPlayer(markets: Market[]): Map<string, Market[]> {
  const map = new Map<string, Market[]>();
  for (const market of markets) {
    const player = extractPlayerName(market.question);
    if (player) {
      const existing = map.get(player) || [];
      existing.push(market);
      map.set(player, existing);
    }
  }
  return map;
}

// Group team total markets by team name
export function groupByTeam(markets: Market[]): Map<string, Market[]> {
  const map = new Map<string, Market[]>();
  for (const market of markets) {
    const team = extractTeamName(market.question);
    if (team) {
      const existing = map.get(team) || [];
      existing.push(market);
      map.set(team, existing);
    }
  }
  return map;
}
