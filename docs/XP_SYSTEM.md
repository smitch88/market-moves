# Vault Markets - XP System Documentation

> Complete guide to the Experience Points (XP) system, including earning mechanics, anti-abuse protections, and administration.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Earning XP](#2-earning-xp)
3. [Level System](#3-level-system)
4. [Anti-Abuse Protections](#4-anti-abuse-protections)
5. [Share Bonus System](#5-share-bonus-system)
6. [Referral XP](#6-referral-xp)
7. [Admin Configuration](#7-admin-configuration)
8. [Database Schema](#8-database-schema)
9. [API Reference](#9-api-reference)
10. [Frontend Integration](#10-frontend-integration)

---

## 1. Overview

The XP system gamifies the Vault Markets experience by rewarding users for trading activity, social sharing, and referrals. Users earn XP to level up, compete on leaderboards, and demonstrate their engagement with the platform.

### Key Features

- **Volume-based XP**: Earn XP proportional to trading volume
- **Share bonuses**: Percentage-based XP for sharing bets on X (Twitter)
- **Referral rewards**: Both parties earn XP when referral codes are used
- **Anti-abuse protections**: Daily caps, cooldowns, and diminishing returns
- **Dynamic configuration**: All settings adjustable via admin panel

---

## 2. Earning XP

### 2.1 Trading Volume

Users earn XP when they **buy** shares in prediction markets.

| Setting | Default | Description |
|---------|---------|-------------|
| `xp_per_dollar_volume` | 10 | XP earned per $1 of trading volume |

**Example:**
- $100 bet → 1,000 XP (at 10 XP per dollar)
- $500 bet → 5,000 XP
- $1,000 bet → 10,000 XP

**Important:** XP is only awarded on **BUY** transactions. Selling shares does NOT earn XP. This prevents wash trading where users would buy and sell repeatedly to farm XP.

### 2.2 XP Award Flow

```
User places bet ($100)
        │
        ▼
Check daily cap remaining
        │
        ├── Cap reached? → 0 XP, return reason
        │
        ▼
Check market cooldown
        │
        ├── On cooldown? → 0 XP, return reason
        │
        ▼
Calculate volume tier multiplier
        │
        ├── Tier 0 (100%) → Full XP
        ├── Tier 1 (80%)  → 80% XP
        ├── Tier 2 (60%)  → 60% XP
        ├── Tier 3 (40%)  → 40% XP
        ├── Tier 4 (20%)  → 20% XP
        └── Tier 5+ (0%)  → 0 XP
        │
        ▼
Apply cap to daily limit if needed
        │
        ▼
Award XP atomically
        │
        ▼
Update tracking tables
        │
        ▼
Return result with XP awarded
```

---

## 3. Level System

### 3.1 Level Calculation

Levels are calculated using a quadratic formula:

```
Level = floor(sqrt(XP / 1000))
```

### 3.2 XP Requirements Per Level

| Level | XP Required | XP for Next Level |
|-------|-------------|-------------------|
| 0 | 0 | 1,000 |
| 1 | 1,000 | 3,000 |
| 2 | 4,000 | 5,000 |
| 3 | 9,000 | 7,000 |
| 4 | 16,000 | 9,000 |
| 5 | 25,000 | 11,000 |
| 10 | 100,000 | 21,000 |
| 15 | 225,000 | 31,000 |
| 20 | 400,000 | 41,000 |

### 3.3 Level Info API Response

```json
{
  "xp": 25000,
  "level": 5,
  "currentLevelXp": 25000,
  "nextLevelXp": 36000,
  "xpInCurrentLevel": 0,
  "xpNeededForNext": 11000,
  "progress": 0
}
```

---

## 4. Anti-Abuse Protections

The XP system includes a **three-layer protection system** to prevent abuse and wash trading.

### 4.1 Daily XP Cap

| Setting | Default | Description |
|---------|---------|-------------|
| `daily_xp_cap` | 50,000 | Maximum XP a user can earn per day from trading |

- Prevents unlimited XP farming
- Resets at midnight UTC
- Equivalent to $5,000 volume at default rate (10 XP/$)

### 4.2 Market Cooldown

| Setting | Default | Description |
|---------|---------|-------------|
| `market_cooldown_seconds` | 60 | Seconds before earning XP again from the same market |

- Prevents rapid cycling within a single market
- Default is 1 minute between XP-earning trades
- Each market has its own independent cooldown (cooldown only applies to the specific market, not across all markets)

### 4.3 Volume-Based Diminishing Returns

| Setting | Default | Description |
|---------|---------|-------------|
| `market_volume_threshold` | 10,000 | Volume per tier before XP rate decreases |

**How It Works:**

Instead of limiting by trade count (which penalizes smaller, multiple trades), the system uses cumulative volume per market per day:

| Volume Tier | Cumulative Volume | XP Rate |
|-------------|-------------------|---------|
| Tier 0 | $0 - $10,000 | 100% |
| Tier 1 | $10,000 - $20,000 | 80% |
| Tier 2 | $20,000 - $30,000 | 60% |
| Tier 3 | $30,000 - $40,000 | 40% |
| Tier 4 | $40,000 - $50,000 | 20% |
| Tier 5+ | $50,000+ | 0% |

**Volume Cap:** `threshold × 5 = $50,000` per market per day (with default settings)

**Example:**
- User has already traded $15,000 in Market A today (Tier 1)
- They place another $5,000 bet
- XP earned: $5,000 × 80% × 10 XP/$ = 4,000 XP

**Why Volume-Based?**
- Fairer than trade count: $100 in one trade = $100 in 5 trades
- Rewards genuine trading activity
- Prevents micro-trade XP farming

### 4.4 Buy-Only XP

XP is **only awarded on BUY transactions**, not sells. This prevents:
- Buy $1,000 → Sell $990 → Buy $990 → Sell $980 → etc.
- Users would lose money but gain unlimited XP without this protection

---

## 5. Share Bonus System

Users can earn bonus XP by sharing their bets on X (Twitter).

### 5.1 Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `share_bonus_percent` | 20 | Percentage of bet amount awarded as XP bonus |

### 5.2 Calculation

```
Share XP = Bet Amount × (share_bonus_percent / 100) × xp_per_dollar
```

**Examples:**

| Bet Amount | Share Bonus (20%) | XP Rate (10/$) | XP Earned |
|------------|-------------------|----------------|-----------|
| $100 | 20% | 10 | 200 XP |
| $500 | 20% | 10 | 1,000 XP |
| $1,000 | 20% | 10 | 2,000 XP |
| $5,000 | 20% | 10 | 10,000 XP |

### 5.3 Share Flow

```
User places bet
        │
        ▼
Success modal appears
        │
        ▼
User clicks "Share on X"
        │
        ▼
Tweet intent opens with:
  - Bet details
  - Market link
  - @VaultMarkets mention
        │
        ▼
User posts tweet
        │
        ▼
User clicks "Verify Tweet"
        │
        ▼
System verifies via:
  ├── Timeline scan (automatic)
  └── Tweet URL (manual)
        │
        ▼
XP awarded if verified
```

### 5.4 Verification Methods

1. **Timeline Scan** (Automatic)
   - Scans user's recent tweets via RapidAPI
   - Looks for market link and @VaultMarkets mention
   - Preferred method for users with linked Twitter

2. **Tweet URL** (Manual)
   - User pastes tweet URL directly
   - Used when timeline scan fails
   - Used for users without linked Twitter

### 5.5 Anti-Duplicate Protections

- Each bet can only claim share XP once
- Each tweet can only be used for XP once
- Correlation ID: `share-{betId}-tweet-{tweetId}`

---

## 6. Referral XP

Both the referrer and referred user earn XP when a referral code is used.

### 6.1 Reward Amount

| Recipient | XP Awarded |
|-----------|------------|
| Referrer | 10,000 XP |
| Referred User | 10,000 XP |

### 6.2 Referral Flow

```
Referrer shares link: vault.markets/r/{code}
        │
        ▼
New user visits link
        │
        ▼
Code stored in localStorage
        │
        ▼
User signs up via X OAuth
        │
        ▼
POST /api/referral/claim
        │
        ▼
Both users receive 10,000 XP
        │
        ▼
XP logged with reason: REFERRAL_BONUS
```

### 6.3 Restrictions

- Users can only be referred once
- Users cannot refer themselves
- Referral must be claimed before first bet

---

## 7. Admin Configuration

### 7.1 Admin XP Page

Located at `/admin/xp`, this page allows administrators to:

- View XP statistics (total awarded, users with XP, averages)
- Configure all XP settings
- View daily activity charts
- Understand protection mechanisms

### 7.2 Configurable Settings

| Key | Type | Range | Description |
|-----|------|-------|-------------|
| `xp_per_dollar_volume` | int | 1-100 | XP per $1 volume |
| `daily_xp_cap` | int | 1,000-1,000,000 | Max daily XP |
| `market_cooldown_seconds` | int | 0-3,600 | Cooldown between trades |
| `market_volume_threshold` | int | 10-100,000 | Volume per tier |
| `share_bonus_percent` | int | 0-100 | Share bonus percentage |

### 7.3 Configuration API

**GET `/api/admin/xp/config`**
```json
{
  "config": {
    "xpPerDollar": 10,
    "dailyXpCap": 50000,
    "marketCooldownSeconds": 60,
    "marketVolumeThreshold": 10000,
    "shareBonusPercent": 20
  },
  "stats": {
    "totalXPAwarded": 5000000,
    "usersWithXP": 1500,
    "averageXP": 3333,
    "medianLevel": 2
  },
  "dailyStats": [...]
}
```

**POST `/api/admin/xp/config`**
```json
{
  "xpPerDollar": 15,
  "shareBonusPercent": 25
}
```

---

## 8. Database Schema

### 8.1 User XP Field

```prisma
model User {
  xp Int @default(0)  // Total XP earned
}
```

### 8.2 XP Ledger (Audit Trail)

```prisma
model XPLedger {
  id            String   @id @default(cuid())
  userId        String
  delta         Int      // XP change (+/-)
  xpBefore      Int
  xpAfter       Int
  reason        XPReason
  correlationId String?  // For idempotency
  adminUserId   String?  // If admin adjustment
  createdAt     DateTime @default(now())
}

enum XPReason {
  TRADE_VOLUME    // From trading
  ADMIN_ADJUST    // Admin correction
  BONUS           // Promotional bonus
  SHARE_TWEET     // Share verification
  REFERRAL_BONUS  // Referral reward
}
```

### 8.3 Trade Tracker (Per-Market Daily)

```prisma
model XPTradeTracker {
  id          String   @id @default(cuid())
  userId      String
  marketId    String
  date        DateTime @db.Date
  tradeCount  Int      @default(0)
  totalVolume Decimal  @default(0) @db.Decimal(20, 2)
  xpEarned    Int      @default(0)
  lastTradeAt DateTime @default(now())
  
  @@unique([userId, marketId, date])
}
```

### 8.4 Daily Total (Per-User)

```prisma
model XPDailyTotal {
  id            String   @id @default(cuid())
  userId        String
  date          DateTime @db.Date
  totalXpEarned Int      @default(0)
  totalVolume   Decimal  @default(0) @db.Decimal(20, 2)
  tradesCount   Int      @default(0)
  marketsTraded Int      @default(0)
  
  @@unique([userId, date])
}
```

### 8.5 Configuration Table

```prisma
model XPConfig {
  id          String   @id @default(cuid())
  key         String   @unique
  value       String
  description String?
  updatedBy   String?
  updatedAt   DateTime @updatedAt
}
```

---

## 9. API Reference

### 9.1 Public Endpoints

#### GET `/api/me/xp`
Get current user's XP and level info.

**Response:**
```json
{
  "xp": 25000,
  "level": 5,
  "currentLevelXp": 25000,
  "nextLevelXp": 36000,
  "xpInCurrentLevel": 0,
  "xpNeededForNext": 11000,
  "progress": 0
}
```

#### GET `/api/xp/share-config`
Get share bonus configuration (for UI display).

**Response:**
```json
{
  "shareBonusPercent": 20,
  "xpPerDollar": 10
}
```

### 9.2 Trading XP (Automatic)

XP is automatically awarded when placing bets via:
- `POST /api/trades/buy` - CPMM trading
- `POST /api/bets` - Pari-mutuel betting

**Response includes:**
```json
{
  "bet": {...},
  "xpAwarded": 1000,
  "xpReason": "Diminishing returns: 80% (tier 1)"
}
```

### 9.3 Share XP

#### POST `/api/bets/{id}/share-xp`
Verify share tweet and claim XP bonus.

**Request:**
```json
{
  "method": "timeline",  // or "url"
  "tweetUrl": "https://x.com/user/status/123"  // if method=url
}
```

**Response:**
```json
{
  "verified": true,
  "xpAwarded": 200,
  "newXp": 25200,
  "newLevel": 5,
  "leveledUp": false,
  "tweetId": "123456789",
  "message": "+200 XP for sharing!",
  "shareBonusPercent": 20
}
```

### 9.4 Referral XP

#### POST `/api/referral/claim`
Claim referral code and receive XP.

**Request:**
```json
{
  "referralCode": "abc123"
}
```

**Response:**
```json
{
  "success": true,
  "referrer": { "name": "User", "handle": "username" },
  "xpAwarded": 10000,
  "newXp": 10000,
  "newLevel": 3
}
```

### 9.5 Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/xp/config` | Get config and stats |
| POST | `/api/admin/xp/config` | Update configuration |

---

## 10. Frontend Integration

### 10.1 XP Animation System

The app includes a real-time XP animation system that shows changes in the header.

**Provider Setup:**
```tsx
import { XPAnimationProvider } from "@/components/layout/xp-animation";

<XPAnimationProvider>
  <App />
</XPAnimationProvider>
```

**Using Animations:**
```tsx
const { queueXPGain, queueBalanceChange, flushQueue } = useXPAnimation();

// Queue animations (shown when flushed)
queueXPGain(1000);       // +1,000 XP (green)
queueBalanceChange(-100); // -$100 (red)

// Flush queue (triggers display)
flushQueue();
```

### 10.2 Fetching Share Config

```tsx
const { data: shareConfig } = useQuery({
  queryKey: ["shareXPConfig"],
  queryFn: async () => {
    const res = await fetch("/api/xp/share-config");
    return res.json();
  },
  staleTime: 60000, // Cache 1 minute
});

const shareBonusPercent = shareConfig?.shareBonusPercent ?? 20;
```

### 10.3 Display Components

```tsx
// In bet confirmation modals
<span>Claim +{shareBonusPercent}% XP bonus for sharing on X</span>

// After claiming
<span>+{claimedXPAmount.toLocaleString()} XP Claimed!</span>
```

### 10.4 Level Display

```tsx
import { getLevelInfo } from "@/lib/services/xp-service";

const levelInfo = getLevelInfo(user.xp);

<div>
  Level {levelInfo.level}
  <ProgressBar value={levelInfo.progress} />
  {levelInfo.xpInCurrentLevel} / {levelInfo.xpNeededForNext} XP
</div>
```

---

## Configuration Summary

| Setting | Key | Default | Range |
|---------|-----|---------|-------|
| XP per Dollar | `xp_per_dollar_volume` | 10 | 1-100 |
| Daily Cap | `daily_xp_cap` | 50,000 | 1K-1M |
| Market Cooldown | `market_cooldown_seconds` | 60 (1 min) | 0-3600 |
| Volume Threshold | `market_volume_threshold` | $10,000 | $10-$100K |
| Share Bonus | `share_bonus_percent` | 20% | 0-100% |
| Referral Bonus | (hardcoded) | 10,000 XP | N/A |

---

## Quick Reference

### XP Sources
- **Trading**: `amount × xp_per_dollar` (buy only)
- **Sharing**: `amount × share_bonus_percent% × xp_per_dollar`
- **Referral**: 10,000 XP (both parties)

### Protections Applied
1. Daily cap (50,000 XP)
2. Market cooldown (1 minute per market)
3. Volume diminishing returns (per $10K tier)
4. Buy-only (no sell XP)

### Level Formula
```
Level = floor(sqrt(XP / 1000))
XP for Level N = N² × 1000
```

---

*This document is maintained alongside the codebase. For implementation details, see `/apps/markets-web/src/lib/services/xp-service.ts`.*
