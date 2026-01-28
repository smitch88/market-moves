/**
 * Sport-specific configuration system
 * 
 * This file defines the layout and behavior for each sport type.
 * To add a new sport:
 * 1. Add the sport to the MarketCategory enum in the database schema
 * 2. Create a new config object following the SportConfig interface
 * 3. Add it to the SPORT_CONFIGS record
 */

import type { Market } from "@vault/database";
import type { ComponentType } from "react";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Market category filter definition
 */
export interface MarketCategoryConfig {
  id: string;
  label: string;
  filter: (market: Market) => boolean;
}

/**
 * Section renderer type for custom market groupings
 */
export interface SectionRendererProps {
  markets: Market[];
  selectedMarketId: string | null;
  selectedOutcome: number | null;
  onSelectOutcome: (marketId: string, outcomeIndex: number) => void;
}

/**
 * Complete sport configuration
 */
export interface SportConfig {
  /** Sport identifier matching MarketCategory enum */
  id: string;
  
  /** Display name for the sport */
  name: string;
  
  /** Market categories/tabs for this sport */
  categories: MarketCategoryConfig[];
  
  /** Default team abbreviations (optional) */
  teamAbbreviations?: Record<string, string>;
  
  /** Custom section renderers per category (optional) */
  sectionRenderers?: Record<string, ComponentType<SectionRendererProps>>;
  
  /** Whether to show the line selector for spread/total markets */
  showLineSelector?: boolean;
  
  /** Header style variant */
  headerVariant?: "matchup" | "tournament" | "fighter" | "default";
}

// =============================================================================
// NFL CONFIGURATION
// =============================================================================

const NFL_TEAM_ABBREVIATIONS: Record<string, string> = {
  seahawks: "SEA",
  patriots: "NE",
  chiefs: "KC",
  eagles: "PHI",
  cowboys: "DAL",
  "49ers": "SF",
  packers: "GB",
  bills: "BUF",
  ravens: "BAL",
  bengals: "CIN",
  lions: "DET",
  dolphins: "MIA",
  jets: "NYJ",
  giants: "NYG",
  bears: "CHI",
  vikings: "MIN",
  saints: "NO",
  falcons: "ATL",
  panthers: "CAR",
  buccaneers: "TB",
  cardinals: "ARI",
  rams: "LAR",
  chargers: "LAC",
  raiders: "LV",
  broncos: "DEN",
  texans: "HOU",
  colts: "IND",
  jaguars: "JAX",
  titans: "TEN",
  commanders: "WAS",
  browns: "CLE",
  steelers: "PIT",
};

const NFL_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "game-lines",
    label: "Game Lines",
    filter: (m) => {
      const q = m.question;
      if (q.includes("1H")) return false;
      if (q.includes("vs.") && !q.includes("O/U")) return true;
      if (q.includes("Spread:")) return true;
      if (q.includes("O/U") && !q.includes("Team Total") && !q.includes(":")) return true;
      return false;
    },
  },
  {
    id: "1st-half",
    label: "1st Half",
    filter: (m) => m.question.includes("1H"),
  },
  {
    id: "team-totals",
    label: "Team Totals",
    filter: (m) => m.question.includes("Team Total"),
  },
  {
    id: "touchdowns",
    label: "Touchdowns",
    filter: (m) => m.question.includes("Touchdown"),
  },
  {
    id: "rushing",
    label: "Rushing",
    filter: (m) => m.question.includes("Rushing"),
  },
  {
    id: "receiving",
    label: "Receiving",
    filter: (m) => m.question.includes("Receiving"),
  },
];

const NFL_CONFIG: SportConfig = {
  id: "NFL",
  name: "NFL Football",
  categories: NFL_CATEGORIES,
  teamAbbreviations: NFL_TEAM_ABBREVIATIONS,
  showLineSelector: true,
  headerVariant: "matchup",
};

// =============================================================================
// NBA CONFIGURATION
// =============================================================================

const NBA_TEAM_ABBREVIATIONS: Record<string, string> = {
  lakers: "LAL",
  celtics: "BOS",
  warriors: "GSW",
  nets: "BKN",
  knicks: "NYK",
  heat: "MIA",
  bulls: "CHI",
  "76ers": "PHI",
  suns: "PHX",
  mavericks: "DAL",
  bucks: "MIL",
  nuggets: "DEN",
  clippers: "LAC",
  grizzlies: "MEM",
  cavaliers: "CLE",
  hawks: "ATL",
  raptors: "TOR",
  timberwolves: "MIN",
  pelicans: "NOP",
  kings: "SAC",
  thunder: "OKC",
  jazz: "UTA",
  pacers: "IND",
  hornets: "CHA",
  magic: "ORL",
  pistons: "DET",
  wizards: "WAS",
  rockets: "HOU",
  spurs: "SAS",
  blazers: "POR",
};

const NBA_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "game-lines",
    label: "Game Lines",
    filter: (m) => {
      const q = m.question;
      if (q.includes("1H") || q.includes("1Q")) return false;
      if (q.includes("vs.") && !q.includes("O/U")) return true;
      if (q.includes("Spread:")) return true;
      if (q.includes("O/U") && !q.includes("Team Total") && !q.includes(":")) return true;
      return false;
    },
  },
  {
    id: "1st-half",
    label: "1st Half",
    filter: (m) => m.question.includes("1H"),
  },
  {
    id: "1st-quarter",
    label: "1st Quarter",
    filter: (m) => m.question.includes("1Q"),
  },
  {
    id: "team-totals",
    label: "Team Totals",
    filter: (m) => m.question.includes("Team Total"),
  },
  {
    id: "points",
    label: "Points",
    filter: (m) => m.question.includes("Points O/U") || m.question.includes("Points:"),
  },
  {
    id: "rebounds",
    label: "Rebounds",
    filter: (m) => m.question.includes("Rebounds"),
  },
  {
    id: "assists",
    label: "Assists",
    filter: (m) => m.question.includes("Assists"),
  },
  {
    id: "threes",
    label: "3-Pointers",
    filter: (m) => m.question.includes("3-Point") || m.question.includes("Three"),
  },
];

const NBA_CONFIG: SportConfig = {
  id: "NBA",
  name: "NBA Basketball",
  categories: NBA_CATEGORIES,
  teamAbbreviations: NBA_TEAM_ABBREVIATIONS,
  showLineSelector: true,
  headerVariant: "matchup",
};

// =============================================================================
// MLB CONFIGURATION
// =============================================================================

const MLB_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "game-lines",
    label: "Game Lines",
    filter: (m) => {
      const q = m.question;
      if (q.includes("vs.") && !q.includes("O/U")) return true;
      if (q.includes("Run Line")) return true;
      if (q.includes("O/U") && !q.includes("Team Total") && !q.includes(":")) return true;
      return false;
    },
  },
  {
    id: "first-5",
    label: "First 5 Innings",
    filter: (m) => m.question.includes("F5") || m.question.includes("First 5"),
  },
  {
    id: "team-totals",
    label: "Team Totals",
    filter: (m) => m.question.includes("Team Total"),
  },
  {
    id: "hits",
    label: "Hits",
    filter: (m) => m.question.includes("Hits"),
  },
  {
    id: "strikeouts",
    label: "Strikeouts",
    filter: (m) => m.question.includes("Strikeout"),
  },
  {
    id: "home-runs",
    label: "Home Runs",
    filter: (m) => m.question.includes("Home Run") || m.question.includes("HR"),
  },
];

const MLB_CONFIG: SportConfig = {
  id: "MLB",
  name: "MLB Baseball",
  categories: MLB_CATEGORIES,
  showLineSelector: true,
  headerVariant: "matchup",
};

// =============================================================================
// NHL CONFIGURATION
// =============================================================================

const NHL_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "game-lines",
    label: "Game Lines",
    filter: (m) => {
      const q = m.question;
      if (q.includes("vs.") && !q.includes("O/U")) return true;
      if (q.includes("Puck Line")) return true;
      if (q.includes("O/U") && !q.includes("Team Total") && !q.includes(":")) return true;
      return false;
    },
  },
  {
    id: "period",
    label: "1st Period",
    filter: (m) => m.question.includes("1P") || m.question.includes("1st Period"),
  },
  {
    id: "team-totals",
    label: "Team Totals",
    filter: (m) => m.question.includes("Team Total"),
  },
  {
    id: "goals",
    label: "Goals",
    filter: (m) => m.question.includes("Goals") || m.question.includes("Anytime Goal"),
  },
  {
    id: "shots",
    label: "Shots",
    filter: (m) => m.question.includes("Shots"),
  },
  {
    id: "assists",
    label: "Assists",
    filter: (m) => m.question.includes("Assists"),
  },
];

const NHL_CONFIG: SportConfig = {
  id: "NHL",
  name: "NHL Hockey",
  categories: NHL_CATEGORIES,
  showLineSelector: true,
  headerVariant: "matchup",
};

// =============================================================================
// SOCCER CONFIGURATION
// =============================================================================

const SOCCER_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "match-result",
    label: "Match Result",
    filter: (m) => {
      const q = m.question;
      if (q.includes("vs.") && !q.includes("O/U")) return true;
      if (q.includes("Draw")) return true;
      return false;
    },
  },
  {
    id: "goals",
    label: "Goals",
    filter: (m) => m.question.includes("O/U") || m.question.includes("Goals"),
  },
  {
    id: "first-half",
    label: "1st Half",
    filter: (m) => m.question.includes("1H") || m.question.includes("First Half"),
  },
  {
    id: "both-teams",
    label: "Both Teams",
    filter: (m) => m.question.includes("Both Teams"),
  },
  {
    id: "scorer",
    label: "Goalscorer",
    filter: (m) => m.question.includes("Scorer") || m.question.includes("Goal:"),
  },
  {
    id: "corners",
    label: "Corners",
    filter: (m) => m.question.includes("Corner"),
  },
];

const SOCCER_CONFIG: SportConfig = {
  id: "SOCCER",
  name: "Soccer",
  categories: SOCCER_CATEGORIES,
  showLineSelector: true,
  headerVariant: "matchup",
};

// =============================================================================
// UFC CONFIGURATION
// =============================================================================

const UFC_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "winner",
    label: "Fight Winner",
    filter: (m) => {
      const q = m.question;
      if (q.includes("vs.") && !q.includes("Method") && !q.includes("Round")) return true;
      return false;
    },
  },
  {
    id: "method",
    label: "Method",
    filter: (m) => m.question.includes("Method") || m.question.includes("KO") || m.question.includes("Submission"),
  },
  {
    id: "round",
    label: "Round",
    filter: (m) => m.question.includes("Round") || m.question.includes("Distance"),
  },
  {
    id: "props",
    label: "Props",
    filter: (m) => {
      const q = m.question;
      return q.includes("Strikes") || q.includes("Takedown") || q.includes("Knockdown");
    },
  },
];

const UFC_CONFIG: SportConfig = {
  id: "UFC",
  name: "UFC / MMA",
  categories: UFC_CATEGORIES,
  showLineSelector: false,
  headerVariant: "fighter",
};

// =============================================================================
// TENNIS CONFIGURATION
// =============================================================================

const TENNIS_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "match-winner",
    label: "Match Winner",
    filter: (m) => m.question.includes("vs.") && !m.question.includes("Set") && !m.question.includes("Game"),
  },
  {
    id: "sets",
    label: "Sets",
    filter: (m) => m.question.includes("Set") || m.question.includes("Sets O/U"),
  },
  {
    id: "games",
    label: "Games",
    filter: (m) => m.question.includes("Game") || m.question.includes("Games O/U"),
  },
  {
    id: "first-set",
    label: "1st Set",
    filter: (m) => m.question.includes("1st Set") || m.question.includes("First Set"),
  },
];

const TENNIS_CONFIG: SportConfig = {
  id: "TENNIS",
  name: "Tennis",
  categories: TENNIS_CATEGORIES,
  showLineSelector: true,
  headerVariant: "matchup",
};

// =============================================================================
// GOLF CONFIGURATION
// =============================================================================

const GOLF_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "tournament-winner",
    label: "Winner",
    filter: (m) => m.question.includes("Winner") || m.question.includes("Champion"),
  },
  {
    id: "top-finish",
    label: "Top Finishes",
    filter: (m) => m.question.includes("Top") || m.question.includes("Finish"),
  },
  {
    id: "matchups",
    label: "Matchups",
    filter: (m) => m.question.includes("vs.") || m.question.includes("Matchup"),
  },
  {
    id: "round",
    label: "Round Leader",
    filter: (m) => m.question.includes("Round") || m.question.includes("Leader"),
  },
];

const GOLF_CONFIG: SportConfig = {
  id: "GOLF",
  name: "Golf",
  categories: GOLF_CATEGORIES,
  showLineSelector: false,
  headerVariant: "tournament",
};

// =============================================================================
// DEFAULT/GENERIC CONFIGURATION
// =============================================================================

const DEFAULT_CATEGORIES: MarketCategoryConfig[] = [
  {
    id: "all",
    label: "All Markets",
    filter: () => true,
  },
];

const DEFAULT_CONFIG: SportConfig = {
  id: "DEFAULT",
  name: "Markets",
  categories: DEFAULT_CATEGORIES,
  showLineSelector: true,
  headerVariant: "default",
};

// =============================================================================
// SPORT CONFIGS REGISTRY
// =============================================================================

/**
 * Registry of all sport configurations
 * Add new sports here
 */
export const SPORT_CONFIGS: Record<string, SportConfig> = {
  NFL: NFL_CONFIG,
  NBA: NBA_CONFIG,
  MLB: MLB_CONFIG,
  NHL: NHL_CONFIG,
  SOCCER: SOCCER_CONFIG,
  UFC: UFC_CONFIG,
  TENNIS: TENNIS_CONFIG,
  GOLF: GOLF_CONFIG,
  DEFAULT: DEFAULT_CONFIG,
};

/**
 * Get the configuration for a specific sport
 * Falls back to DEFAULT if sport is not found
 */
export function getSportConfig(sport: string): SportConfig {
  return SPORT_CONFIGS[sport.toUpperCase()] || SPORT_CONFIGS.DEFAULT;
}

/**
 * Get team abbreviation for a sport
 */
export function getTeamAbbreviation(teamName: string, sport: string): string {
  const config = getSportConfig(sport);
  if (config.teamAbbreviations) {
    const key = teamName.toLowerCase().replace(/[^a-z0-9]/g, "");
    return config.teamAbbreviations[key] || teamName.substring(0, 3).toUpperCase();
  }
  return teamName.substring(0, 3).toUpperCase();
}

/**
 * Get category counts for a sport's markets
 */
export function getCategoryCountsForSport(
  markets: Market[],
  sport: string
): Record<string, number> {
  const config = getSportConfig(sport);
  const counts: Record<string, number> = {};

  for (const category of config.categories) {
    counts[category.id] = markets.filter(category.filter).length;
  }

  return counts;
}
