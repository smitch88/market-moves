# Database Migration Guide: Event/Market Restructure

This guide covers the migration from the old Market -> Outcome (1:many) structure to the new Polymarket-style Event -> Market (1:many) hierarchy.

## Overview

### Before (Old Schema)
```
Market (slug, title, category, bannerUrl, logoUrl)
  └── Outcome (key: A|B, label, color)
        └── Bet (outcomeId)

Position (amountOutcomeA, amountOutcomeB)
```

### After (New Schema)
```
Event (slug, title, category, bannerUrl, logoUrl)
  └── Market (eventId, question, outcomes: JSON, outcomePrices: JSON)
        └── Bet (outcomeIndex: 0|1)

Position (amount0, amount1)
```

## Migration Strategy

There are two migration paths depending on your situation:

### Path A: Fresh Database (Development/New Deployment)

If you're starting fresh or don't have production data:

```bash
# Reset and seed with new schema
pnpm --filter @vault/database db:reset
```

This will:
1. Drop all tables
2. Create the new schema via `db push`
3. Seed sample data in the new Event/Market format

### Path B: Existing Database with Data (Production)

If you have an existing database with data to preserve:

#### Step 1: Check Migration Status

```bash
pnpm --filter @vault/database db:migrate:status
```

#### Step 2: Mark Baseline as Applied (if upgrading from db:push)

If you've been using `db push` without migrations, mark the baseline as applied:

```bash
pnpm --filter @vault/database db:migrate:resolve-baseline
```

#### Step 3: Apply the Migration

```bash
pnpm --filter @vault/database db:migrate:deploy
```

This will apply the `20260128100000_event_market_restructure` migration which:

1. Creates `Event` and `Tag` tables
2. Creates an Event for each existing Market (using market slug/title/category)
3. Migrates Outcome labels to Market.outcomes JSON
4. Converts Bet.outcomeId to Bet.outcomeIndex (A=0, B=1)
5. Renames Position columns (amountOutcomeA → amount0, etc.)
6. Calculates pool totals from confirmed bets
7. Drops the old Outcome table and OutcomeKey enum

#### Step 4: Verify Migration

```bash
pnpm --filter @vault/database db:migrate:verify
```

This runs validation checks:
- All Markets have an Event
- All Bet outcomeIndex values are 0 or 1
- Market outcomes JSON is valid
- Pool totals match confirmed bets
- Position amounts are non-negative

#### Step 5: Regenerate Prisma Client

```bash
pnpm --filter @vault/database db:generate
```

## Migration Details

### Data Transformations

| Old Field | New Field | Transformation |
|-----------|-----------|----------------|
| Market.slug | Event.slug | Copied |
| Market.title | Event.title | Copied |
| Market.category | Event.category | Copied |
| Market.bannerUrl | Event.bannerUrl | Copied |
| Market.logoUrl | Event.logoUrl | Copied |
| Market.question | Market.question | Kept (uses title if null) |
| Market.seedA | Market.seed0 | Renamed |
| Market.seedB | Market.seed1 | Renamed |
| Outcome[A].label, Outcome[B].label | Market.outcomes | `'["Label A", "Label B"]'` |
| Outcome[A].color, Outcome[B].color | Market.outcomeColors | `'["#color1", "#color2"]'` |
| Bet.outcomeId | Bet.outcomeIndex | A→0, B→1 |
| Market.resolvedOutcomeId | Market.resolvedOutcome | A→0, B→1 |
| Position.amountOutcomeA | Position.amount0 | Renamed |
| Position.amountOutcomeB | Position.amount1 | Renamed |
| Position.weightedOutcomeA | Position.weighted0 | Renamed |
| Position.weightedOutcomeB | Position.weighted1 | Renamed |

### New Fields

| Table | Field | Description |
|-------|-------|-------------|
| Market | pool0 | Sum of confirmed bets on outcome[0] |
| Market | pool1 | Sum of confirmed bets on outcome[1] |
| Event | active | Whether event is active (Polymarket style) |
| Event | closed | Whether event is closed |
| Event | startTime | When event starts (e.g., game time) |
| Event | endTime | When event ends |

### Pool Recalculation

If pool totals are incorrect after migration, run:

```bash
pnpm --filter @vault/database db:migrate:recalculate-pools
```

## Rollback

**Warning:** This migration drops the Outcome table and OutcomeKey enum. To rollback, you would need to:

1. Restore from a database backup
2. Or manually recreate the Outcome table and re-populate from Market.outcomes JSON

For production, always take a backup before migrating:

```bash
pg_dump $DATABASE_URL > backup_before_migration.sql
```

## Troubleshooting

### "Relation 'Outcome' does not exist"

The migration has already been applied. Run verification to check status.

### Pool totals are wrong

Run the recalculation script:

```bash
pnpm --filter @vault/database db:migrate:recalculate-pools
```

### "Migration failed"

1. Check the error message for specific column/constraint issues
2. Ensure you've marked the baseline as applied if upgrading from `db push`
3. Restore from backup if needed and retry

## Files Changed

- `prisma/schema.prisma` - New Event/Market schema
- `prisma/seed.ts` - Updated to seed Events with Markets
- `packages/database/scripts/migrate-verify.ts` - Verification script
- All API routes updated for new structure
- All UI components updated for new structure
