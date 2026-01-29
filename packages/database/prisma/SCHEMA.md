# Prisma Schema Organization

This document explains the structure and organization of the `schema.prisma` file.

## Structure

The schema is organized into logical sections for better readability and maintainability:

### 1. **Configuration** (Top)
- Generator settings (Prisma Client output)
- Datasource configuration (PostgreSQL connection)

### 2. **Enums**
All enum types grouped together with inline documentation:
- `UserRole` - User permission levels
- `MarketStatus` - Market lifecycle states
- `EventType` - Types of events (MATCHUP, PROP, etc.)
- `MarketCategory` - Event categories (NFL, NBA, Crypto, etc.)
- `BetStatus` - Bet/trade states
- `BalanceReason` - Reasons for balance changes
- `PnLReason` - Reasons for profit/loss changes
- `TradeType` - Buy or sell
- `PricingModel` - PARI_MUTUEL or CPMM (AMM)
- `RaffleReason` - Raffle entry reasons
- `TweetProofMethod` - Social verification methods
- `AdminAction` - Admin action types for audit log
- `XPReason` - Reasons for XP changes

### 3. **User & Authentication**
- `User` - Core user model with authentication, profile, and financial data

### 4. **Financial Ledgers & Tracking**
- `BalanceLedger` - Audit trail for balance changes
- `PnLLedger` - Audit trail for profit/loss changes
- `UserPnLSnapshot` - Historical PnL snapshots for charts

### 5. **XP & Gamification**
- `XPLedger` - Audit trail for XP changes
- `XPConfig` - Configurable XP settings

### 6. **Events & Markets**
- `Tag` - Tags for categorizing events
- `Event` - Top-level container for markets
- `Market` - Individual prediction questions
- `PriceSnapshot` - Historical price data

### 7. **Betting & Trading**
- `Bet` - User bets/trades
- `Position` - User holdings in markets

### 8. **Social & Verification**
- `TweetProof` - Social verification for bets

### 9. **Referrals & Rewards**
- `Referral` - Referral tracking
- `RaffleEntry` - Raffle/giveaway entries

### 10. **Admin & System**
- `AdminActionLog` - Admin action audit trail

## Key Design Patterns

### 1. **Audit Trails**
All financial operations are tracked in ledger tables:
- `BalanceLedger` for balance changes
- `PnLLedger` for profit/loss changes
- `XPLedger` for XP changes
- `AdminActionLog` for admin actions

Each ledger includes:
- `*Before` and `*After` fields for state tracking
- `correlationId` for linking to source transactions
- `createdAt` timestamp

### 2. **Decimal Precision**
Financial values use `Decimal` type with appropriate precision:
- Currency amounts: `Decimal(19, 2)` - 2 decimal places
- Shares: `Decimal(19, 4)` - 4 decimal places for fractional shares
- Prices: `Decimal(10, 4)` - 4 decimal places for accurate pricing
- PnL: `Decimal(19, 4)` - 4 decimal places for profit/loss

### 3. **Compound Indexes**
Optimized queries with compound indexes:
- `[userId, createdAt]` - User history queries
- `[userId, status, createdAt]` - Time-based filtered queries
- `[userId, claimedAt]` - Unclaimed positions queries
- `[marketId, timestamp]` - Price history queries

### 4. **Soft Deletion**
Models use status flags instead of deletion:
- `active` flag on events
- `status` enum on markets and bets
- Cascade deletion only for dependent data (e.g., markets when event deleted)

### 5. **JSON Flexibility**
Some fields use JSON for flexibility:
- `Market.outcomes` - Array of outcome labels
- `Market.outcomePrices` - Array of prices
- `XPConfig.value` - Flexible configuration
- `*metadata` fields - Additional context

## Best Practices

1. **Always use `@db.Decimal()` for financial fields**
   - Never use `Float` or `Int` for money
   - Always specify precision: `@db.Decimal(19, 2)`

2. **Add indexes for all foreign keys**
   - Improves query performance
   - Already done for all relations

3. **Use compound indexes for common query patterns**
   - Example: `[userId, createdAt]` for user activity history

4. **Document complex fields with inline comments**
   - Use `//` for single-line comments
   - Use `///` for model-level documentation

5. **Group related fields logically**
   - Financial fields together
   - Timestamps at the end
   - Relations last

## Limitations

Prisma doesn't support:
- ❌ Multi-file schemas (everything in one file)
- ❌ Imports or includes
- ❌ Schema inheritance
- ❌ Computed fields (use client-side or database views)

## Workarounds

For better organization despite single-file limitation:
- ✅ Use clear section headers with `//` comments
- ✅ Group models by domain/feature
- ✅ Add inline documentation with `///`
- ✅ Use consistent naming conventions
- ✅ Keep enums at the top for easy reference

## Future Enhancements

When Prisma supports multi-file schemas, consider splitting into:
- `schema/base.prisma` - Config, datasource
- `schema/enums.prisma` - All enums
- `schema/users.prisma` - User and auth models
- `schema/markets.prisma` - Events, markets, bets
- `schema/ledgers.prisma` - Audit trail models
- `schema/admin.prisma` - Admin and system models
