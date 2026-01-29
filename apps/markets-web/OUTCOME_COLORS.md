# Outcome Colors System

## Overview
Vault Markets uses a **centralized, intelligent color system** for market outcomes instead of storing colors in the database. Colors are automatically determined based on outcome labels, providing consistent branding across the platform.

## Location
- **Color Logic**: `/apps/markets-web/src/lib/outcome-colors.ts`
- **Usage**: Import `getOutcomeColors(outcomes: string[])` or `getOutcomeColor(outcomes: string[], index: number)`

## Color Palettes

### Yes/No Markets
- **Yes**: `hsl(217 91% 60%)` (Blue) - Neutral first option
- **No**: `hsl(358 85% 58%)` (Brand Red) - Neutral second option

### Over/Under Markets
- **Over**: `hsl(217 91% 60%)` (Blue)
- **Under**: `hsl(358 85% 58%)` (Brand Red)

### Spread Markets
- **Favorite** (team with negative spread): `hsl(217 91% 60%)` (Blue)
- **Underdog** (team with positive spread): `hsl(38 92% 50%)` (Amber)

### Team Matchups
- **Team 1**: `hsl(217 91% 60%)` (Blue)
- **Team 2**: `hsl(358 85% 58%)` (Brand Red)

### Multi-Outcome Markets (3+ options)
Provides 8 distinct colors:
1. `hsl(217 91% 60%)` (Blue)
2. `hsl(358 85% 58%)` (Brand Red)
3. `hsl(271 81% 56%)` (Purple)
4. `hsl(38 92% 50%)` (Amber)
5. `hsl(189 85% 46%)` (Cyan)
6. `hsl(330 81% 60%)` (Pink)
7. `hsl(152 75% 42%)` (Emerald)
8. `hsl(25 95% 53%)` (Orange)

### Default/Generic Binary Markets
- **Primary**: `hsl(217 91% 60%)` (Blue)
- **Secondary**: `hsl(358 85% 58%)` (Brand Red)

### Design Philosophy

**Blue and Red: Neutral, Balanced Colors**
- No positive/negative connotation (unlike green/red)
- Both colors are equally weighted and professional
- Commonly used in prediction markets (Polymarket, Kalshi style)
- Works well for betting contexts where both outcomes are neutral

## How It Works

The system intelligently detects market type by analyzing outcome labels:

```typescript
import { getOutcomeColors } from "@/lib/outcome-colors";

// Example 1: Yes/No market
const outcomes = ["Yes", "No"];
const colors = getOutcomeColors(outcomes);
// Returns: ["hsl(217 91% 60%)", "hsl(358 85% 58%)"]

// Example 2: Over/Under market
const outcomes = ["Over 46.5", "Under 46.5"];
const colors = getOutcomeColors(outcomes);
// Returns: ["hsl(217 91% 60%)", "hsl(358 85% 58%)"]

// Example 3: Team matchup
const outcomes = ["Seahawks", "Patriots"];
const colors = getOutcomeColors(outcomes);
// Returns: ["hsl(217 91% 60%)", "hsl(358 85% 58%)"]
```

## Detection Logic

1. **Yes/No**: First outcome is "yes" and second is "no"
2. **Over/Under**: Outcome labels contain "over" and "under"
3. **Spread**: Outcomes contain "-" or "+" (e.g., "Team -3.5", "Team +3.5")
4. **Multi-outcome**: 3 or more options get the multi-color palette
5. **Default**: Everything else gets blue/red

## Benefits

### ✅ Consistency
All markets of the same type use the same colors across the entire platform.

### ✅ Maintainability
Update colors in one place (`outcome-colors.ts`) and all markets instantly reflect the change.

### ✅ Reduced Database Load
No need to store and query color data for every market.

### ✅ Intelligent Defaults
Colors automatically adapt to market type without manual configuration.

### ✅ Better UX
Users learn color associations (blue = option 1, red = option 2) that work consistently across all markets without implying good/bad outcomes.

## Migration Notes

**Date**: January 29, 2026
**Migration**: `20260129200000_remove_outcome_colors`

The `Market.outcomeColors` field has been removed from the database schema. All components now use the centralized color system.

### Updated Components
- `market-chart.tsx`
- `featured-event-banner.tsx`
- `quick-bet-modal.tsx`
- `market-card.tsx`
- `profile-activity.tsx`
- `profile-positions.tsx`
- `sell-position-modal.tsx`

### Backward Compatibility

For any legacy code that may still pass `outcomeColors` from the database, use the `parseOutcomeColors` function which provides backward compatibility:

```typescript
import { parseOutcomeColors } from "@/lib/outcome-colors";

// This handles both legacy database colors and new logic
const colors = parseOutcomeColors(
  market.outcomeColors, // Can be null/undefined
  outcomes // Falls back to intelligent detection
);
```

## Future Enhancements

Potential improvements to consider:

1. **Theme Integration**: ✅ **DONE** - Colors now use HSL format matching the design system and work with dark/light mode
2. **Accessibility**: Ensure all color combinations meet WCAG AA standards
3. **Custom Overrides**: Allow admins to override colors for specific events
4. **Team Colors**: For sports markets, dynamically fetch actual team brand colors
5. **Regional Variants**: Different color associations for different markets/cultures

## Color Format

All colors use **HSL (Hue, Saturation, Lightness)** format for several reasons:

- **Consistency**: Matches the design system in `globals.css`
- **Theme Support**: Works seamlessly with Tailwind's CSS variable system
- **Maintainability**: Easy to adjust brightness/saturation for dark mode
- **Accessibility**: Simpler to ensure sufficient contrast

For components that require hex colors (e.g., Recharts), use the `hslToHex()` utility:

```typescript
import { getOutcomeColors, hslToHex } from "@/lib/outcome-colors";

const outcomes = ["Yes", "No"];
const hslColors = getOutcomeColors(outcomes);
const hexColors = hslColors.map(hslToHex);
// hexColors: ["#5b8def", "#f04949"]
```

## Testing

When adding new market types, ensure:
1. Colors are visually distinct
2. Colors work in both light and dark mode
3. Color contrast is sufficient for readability
4. Color meanings are intuitive for users
