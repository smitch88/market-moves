# Sport-Specific Layout System

## Overview

The sports view system is now configuration-based, allowing each sport to have its own categories, team abbreviations, and layout behavior.

## File Structure

```
src/components/sports/
├── sport-configs.ts          # Sport configurations registry
├── sports-event-view.tsx     # Main view with dynamic rendering
├── sports-event-header.tsx   # Event header component
├── market-category-tabs.tsx  # Category tabs
├── sports-market-row.tsx     # Market row components
├── market-chart.tsx          # Expandable chart dropdown
├── line-selector.tsx         # Line value selector
├── sports-betting-sidebar.tsx # Betting panel
└── market-utils.ts           # Shared utilities
```

## How It Works

### 1. Sport Configuration (`sport-configs.ts`)

Each sport has a `SportConfig` object:

```typescript
interface SportConfig {
  id: string;                              // Sport identifier (matches MarketCategory)
  name: string;                            // Display name
  categories: MarketCategoryConfig[];      // Category tabs
  teamAbbreviations?: Record<string, string>;  // Team name → abbreviation
  showLineSelector?: boolean;              // Enable line selector for spreads/totals
  headerVariant?: "matchup" | "tournament" | "fighter" | "default";
}
```

### 2. Market Categories

Each category defines:
- `id`: Unique identifier
- `label`: Display name in tabs
- `filter`: Function to match markets

Example:
```typescript
{
  id: "touchdowns",
  label: "Touchdowns",
  filter: (m) => m.question.includes("Touchdown")
}
```

### 3. Dynamic Rendering

The `SportsEventView` component:
1. Detects sport from `event.category`
2. Loads the appropriate `SportConfig`
3. Renders categories as tabs
4. Maps category ID to appropriate section renderer
5. Passes expand/collapse state to all rows

### 4. Expandable Market Rows

Every market row can now be clicked to expand and show:
- Probability distribution bars
- Pool sizes for each outcome
- Total volume and prediction count
- 24h change indicator (placeholder)

## Supported Sports

| Sport | Categories |
|-------|------------|
| **NFL** | Game Lines, 1st Half, Team Totals, Touchdowns, Rushing, Receiving |
| **NBA** | Game Lines, 1st Half, 1st Quarter, Team Totals, Points, Rebounds, Assists, 3-Pointers |
| **MLB** | Game Lines, First 5 Innings, Team Totals, Hits, Strikeouts, Home Runs |
| **NHL** | Game Lines, 1st Period, Team Totals, Goals, Shots, Assists |
| **Soccer** | Match Result, Goals, 1st Half, Both Teams, Goalscorer, Corners |
| **UFC** | Fight Winner, Method, Round, Props |
| **Tennis** | Match Winner, Sets, Games, 1st Set |
| **Golf** | Winner, Top Finishes, Matchups, Round Leader |

## Adding a New Sport

### Step 1: Add to Database Schema

```prisma
enum MarketCategory {
  // ...existing
  ESPORTS
}
```

### Step 2: Create Config in `sport-configs.ts`

```typescript
const ESPORTS_CONFIG: SportConfig = {
  id: "ESPORTS",
  name: "Esports",
  categories: [
    {
      id: "match",
      label: "Match Winner",
      filter: (m) => m.question.includes("vs.")
    },
    {
      id: "maps",
      label: "Maps",
      filter: (m) => m.question.includes("Map")
    },
    // ... more categories
  ],
  teamAbbreviations: {
    "team liquid": "TL",
    "faze clan": "FAZE",
    // ...
  },
  showLineSelector: true,
  headerVariant: "matchup",
};
```

### Step 3: Register in `SPORT_CONFIGS`

```typescript
export const SPORT_CONFIGS: Record<string, SportConfig> = {
  // ...existing
  ESPORTS: ESPORTS_CONFIG,
};
```

### Step 4: Add to `SPORTS_CATEGORIES` in page.tsx

```typescript
const SPORTS_CATEGORIES: MarketCategory[] = [
  // ...existing
  "ESPORTS",
];
```

That's it! The new sport will automatically:
- Use the correct categories
- Render the appropriate market types
- Support expand/collapse for charts
- Use custom team abbreviations

## Features

### Line Selector
- Click arrows to navigate between lines
- Click any line value to select it
- Drag left/right to change values
- Keyboard arrow keys support
- Auto-centers on active line

### Expandable Charts
- Click any market row to expand
- Shows probability distribution
- Displays pool sizes
- Animated expand/collapse
- Only one expanded at a time

### Consistent Styling
- All buttons: Fixed 120px width
- Unified hover/active states
- Primary color for selection
- Smooth animations throughout
