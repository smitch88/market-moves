# Vault Markets - Complete Platform Documentation

> Last Updated: January 2026

This document provides a comprehensive overview of the Vault Markets prediction market platform, covering all features, systems, and technical implementations.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Public Features](#2-public-features)
3. [Admin Features](#3-admin-features)
4. [XP & Gamification System](#4-xp--gamification-system)
5. [Social Verification (X/Twitter)](#5-social-verification-xtwitter)
6. [Trading & Market Mechanics](#6-trading--market-mechanics)
7. [Data Models](#7-data-models)
8. [API Reference](#8-api-reference)
9. [Security & Anti-Abuse](#9-security--anti-abuse)

---

## 1. Platform Overview

Vault Markets is a Web2 prediction market platform where users bet on real-world event outcomes using virtual currency ($10,000 starting balance). The platform features:

- **CPMM Trading**: Constant Product Market Maker for instant trades
- **XP Leveling System**: Gamified progression with anti-abuse protections
- **Social Sharing**: X (Twitter) verification for bets and XP bonuses
- **Referral Program**: XP rewards for inviting friends
- **Admin Panel**: Full market lifecycle management

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Server Components) |
| UI | React 19, Tailwind CSS, Framer Motion, shadcn/ui |
| Database | Prisma ORM + Neon PostgreSQL |
| Auth | Privy (X/Twitter OAuth) |
| Monorepo | Turborepo + pnpm |

---

## 2. Public Features

### 2.1 Landing Page (`/`)

The main market discovery page featuring:

- **Featured Hero Banner**: Highlighted market with live price chart and quick betting
- **Event Grid**: Filterable cards with category, status, and search filters
- **Quick Bet Modal**: Place bets without leaving the page
- **Bookmark System**: Save events for quick access

**Filters Available:**
- Categories: NFL, NBA, NHL, MLB, SOCCER, UFC, TENNIS, GOLF, ESPORTS, POLITICS, CRYPTO, FINANCE, ENTERTAINMENT, OTHER
- Status: Active, Closed
- Special: Bookmarks (authenticated users only)

### 2.2 Event/Market Pages (`/m/[slug]`)

Individual event pages with:

- **Market Details**: Question, description, resolution source
- **Betting Panel**: Outcome selection, amount input, buy/sell toggle
- **Price Chart**: Historical price movement (recharts)
- **Position Display**: User's current holdings and P&L
- **Social Sharing**: Generate and share betting tickets

### 2.3 Profile Page (`/profile`)

User dashboard with tabs:

| Tab | Description |
|-----|-------------|
| **Positions** | Active holdings with sell/redeem options |
| **Activity** | Bet history and transactions |
| **Bookmarks** | Saved events with quick remove |
| **Requests** | Market request submissions and status |
| **Settings** | Profile editing, referral link, account info |

### 2.4 Leaderboard (`/leaderboard`)

Competitive rankings with:

- **Metrics**: XP, PnL, Volume
- **Periods**: All Time, Monthly, Weekly
- **Search**: Find specific users
- **Current User Position**: Always visible if not on current page

### 2.5 Referral System (`/r/[code]`)

- Unique referral codes per user
- **10,000 XP bonus** for both referrer and referred user
- Tracked in `Referral` and `XPLedger` tables
- Social sharing integration

### 2.6 Quick Bet Flow

Streamlined betting from the landing page:

1. Click "Quick Bet" on any event card
2. Select market (if multiple exist)
3. Pick outcome (Yes/No or custom labels)
4. Enter amount with preset buttons ($100, $500, $1000, Max)
5. Place bet → Success modal with sharing options

**Mobile Experience:**
- Full-screen overlay on mobile devices
- Touch-optimized controls
- Safe area padding for iOS

---

## 3. Admin Features

### 3.1 Admin Dashboard (`/admin`)

Overview statistics:
- Total users, markets, bets
- Recent activity feed
- Quick action buttons

### 3.2 Event Management (`/admin/events`)

Full CRUD operations:
- Create events with multiple markets
- Edit event details, dates, categories
- Publish/unpublish events
- Tag management

### 3.3 Market Management (`/admin/markets`)

Market lifecycle control:

```
DRAFT → PUBLISHED → OPEN → CLOSED → RESOLVED → SETTLED
```

| Status | Description |
|--------|-------------|
| DRAFT | Created but not visible |
| PUBLISHED | Visible, accepting bets |
| OPEN | Actively trading |
| CLOSED | No new bets, awaiting resolution |
| RESOLVED | Winning outcome determined |
| SETTLED | Payouts distributed |

### 3.4 User Management (`/admin/users`)

- View all users with search/filter
- Adjust balances and XP
- Change user roles
- View betting history

### 3.5 Market Requests (`/admin/requests`)

Review user-submitted market ideas:
- Quick review: Approve/Reject with notes
- Full review: Create events/markets from request
- Status tracking: PENDING → APPROVED/REJECTED/CREATED

### 3.6 Resolution Sources (`/admin/resolution-sources`)

Manage authoritative data sources for market resolution:
- Create internal/external/hybrid sources
- Add data points with verification
- Link to markets for resolution

### 3.7 XP Configuration (`/admin/xp`)

Dynamic XP system management:
- XP per dollar rate
- Daily XP cap
- Market cooldown period
- Volume threshold for diminishing returns

### 3.8 Bet Management (`/admin/bets`)

Advanced bet filtering and analysis:
- Filter by user, event, status
- Tweet verification status
- Server-side sorting

---

## 4. XP & Gamification System

> **For complete XP documentation, see [XP_SYSTEM.md](./XP_SYSTEM.md)**

### 4.1 XP Earning

Users earn XP through:

| Action | XP Earned |
|--------|-----------|
| Trading Volume | 10 XP per $1 wagered (configurable) |
| Referral Bonus | 10,000 XP (both users) |
| Share Tweet Bonus | 20% of bet amount × XP rate (configurable) |

### 4.2 Level Calculation

```
Level = floor(sqrt(XP / 1000))

Level 1:  1,000 XP
Level 2:  4,000 XP
Level 3:  9,000 XP
Level 10: 100,000 XP
Level 20: 400,000 XP
```

### 4.3 Anti-Abuse Protections

**Three-Layer Protection System:**

1. **Daily XP Cap**
   - Default: 50,000 XP per day
   - Prevents unlimited farming
   - Configurable via admin panel

2. **Market Cooldown**
   - Default: 5 minutes between earning XP from same market
   - Prevents rapid cycling

3. **Volume-Based Diminishing Returns**
   - Default threshold: $10,000 per tier
   - XP rate decreases as volume increases in a market:

   | Volume Tier | XP Rate |
   |-------------|---------|
   | $0 - $10k | 100% |
   | $10k - $20k | 80% |
   | $20k - $30k | 60% |
   | $30k - $40k | 40% |
   | $40k - $50k | 20% |
   | $50k+ | 0% |

**Wash Trading Prevention:**
- XP is only awarded on **BUY** transactions
- SELL transactions do not earn XP
- This prevents buy→sell→buy cycling to farm XP

### 4.4 XP Tracking Tables

| Table | Purpose |
|-------|---------|
| `XPLedger` | Audit trail of all XP changes |
| `XPTradeTracker` | Per-user, per-market, per-day trade tracking |
| `XPDailyTotal` | Daily aggregates for cap enforcement |
| `XPConfig` | Dynamic configuration values |

### 4.5 XP Animation System

Real-time visual feedback:
- Animated XP/Balance indicators in header
- Float-up animation on changes
- Color-coded: Green (positive), Red (negative)
- Queued animations for modal flows

---

## 5. Social Verification (X/Twitter)

### 5.1 Tweet Verification Flow

1. User places bet
2. System generates tweet intent with market link
3. User posts tweet on X
4. User clicks "Verify" in app
5. System scans user's timeline via RapidAPI
6. If matching tweet found → Bet confirmed + XP bonus

### 5.2 Verification Methods

| Method | Description |
|--------|-------------|
| Timeline Scan | Automatically scan user's recent tweets |
| Tweet URL | User provides specific tweet URL |

### 5.3 Share XP Bonus

After placing a bet, users can share for bonus XP:
- Generate shareable betting ticket image
- Post to X with market link
- Verify tweet for 50 XP bonus (configurable)
- Tracked in `TweetProof` table

### 5.4 Betting Ticket Generation

Visual ticket includes:
- Market question
- User's pick and amount
- Current odds
- User avatar and handle
- Timestamp

Generated using `html-to-image` library for download/sharing.

---

## 6. Trading & Market Mechanics

### 6.1 CPMM (Constant Product Market Maker)

Markets use AMM-style trading:

```
k = reserve0 × reserve1 (constant)
```

**Price Calculation:**
```
price0 = reserve0 / (reserve0 + reserve1)
price1 = reserve1 / (reserve0 + reserve1)
```

### 6.2 Buying Shares

1. User specifies dollar amount
2. System calculates shares based on current price
3. Price impact computed (slippage protection)
4. Reserves updated atomically
5. Position updated with new shares + average cost

### 6.3 Selling Shares

1. User specifies shares to sell
2. System calculates proceeds based on AMM
3. Fee deducted (default 1%)
4. Balance credited
5. P&L recorded in ledger

**Important:** Sells do NOT earn XP (anti-abuse measure)

### 6.4 Settlement

When market resolves:
1. Admin sets winning outcome (0 or 1)
2. Winning shares = $1 each (minus fee)
3. Losing shares = $0
4. Users claim via `/api/me/redeem` endpoint
5. P&L recorded in `PnLLedger`

### 6.5 Position Tracking

| Field | Description |
|-------|-------------|
| `shares0` | Shares on outcome 0 |
| `shares1` | Shares on outcome 1 |
| `avgCost0` | Average cost per share (outcome 0) |
| `avgCost1` | Average cost per share (outcome 1) |
| `claimedAt` | When position was redeemed |

---

## 7. Data Models

### 7.1 Core Models

```prisma
User {
  id, privyUserId, email, walletAddress, twitterSubject
  handle, name, profileImageUrl, role
  balance (Decimal), balanceLocked, realizedPnL, totalVolume
  xp (Int), referralCode
  hasSeenWelcomeModal
}

Event {
  id, slug, title, description
  category, eventType
  bannerUrl, logoUrl, startTime, endTime
  active, closed, featured, isPublished
  markets[], tags[], bookmarks[]
}

Market {
  id, question, status, isPublished
  detailsMarkdown, resolutionSourceUrl
  opensAt, closesAt, resolvedAt, settledAt
  outcomes (JSON), outcomePrices (JSON), resolvedOutcome
  pool0, pool1, seed0, seed1, reserve0, reserve1, k
  feeBps, pricingModel
}

Bet {
  id, userId, marketId, amount, weight
  outcomeIndex, pricePerShare, shares, tradeType
  status, payout, tweetProofId, confirmedAt
}

Position {
  id, userId, marketId
  shares0, shares1, avgCost0, avgCost1
  amount0, amount1, weighted0, weighted1
  lastBetAt, claimedAt
}
```

### 7.2 Financial Ledgers

```prisma
BalanceLedger {
  userId, delta, balanceBefore, balanceAfter
  reason (INITIAL_CREDIT, BET_PLACED, SETTLEMENT_PAYOUT, etc.)
  correlationId, actorAdminUserId
}

PnLLedger {
  userId, delta, pnlBefore, pnlAfter
  reason (TRADE_SELL, REDEMPTION, ADMIN_ADJUST)
  correlationId, marketId, metadata
}

XPLedger {
  userId, delta, xpBefore, xpAfter
  reason (TRADE_VOLUME, ADMIN_ADJUST, SHARE_TWEET, REFERRAL_BONUS)
  correlationId, adminUserId
}
```

### 7.3 XP Protection Tables

```prisma
XPTradeTracker {
  userId, marketId, date
  tradeCount, totalVolume, xpEarned, lastTradeAt
  @@unique([userId, marketId, date])
}

XPDailyTotal {
  userId, date
  totalXpEarned, totalVolume, tradesCount, marketsTraded
  @@unique([userId, date])
}

XPConfig {
  key, value, description, updatedBy
}
```

### 7.4 Social & Features

```prisma
Bookmark {
  userId, eventId
  @@unique([userId, eventId])
}

Referral {
  referrerUserId, referredUserId
  qualifiedAt, bonusEntriesAwarded
}

TweetProof {
  userId, marketId, method
  tweetUrl, tweetId, verified, matchedText, raw
}

MarketRequest {
  userId, title, description, sourceUrl
  status, adminNotes, reviewedAt, reviewedBy
}
```

---

## 8. API Reference

### 8.1 Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List published events with markets |
| GET | `/api/events/[slug]` | Get event details |
| GET | `/api/events/[slug]/markets` | Get markets for event |
| GET | `/api/markets/search` | Search markets |
| GET | `/api/leaderboard` | Get rankings (XP, PnL, Volume) |
| GET | `/api/resolution-sources` | List public resolution sources |

### 8.2 Authenticated Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Get current user profile |
| PATCH | `/api/me` | Update profile (handle, name, avatar) |
| GET | `/api/me/xp` | Get XP and level info |
| POST | `/api/me/redeem` | Claim settled positions |
| GET | `/api/bookmarks` | Get user's bookmarks |
| POST | `/api/bookmarks` | Add bookmark |
| DELETE | `/api/bookmarks` | Remove bookmark |

### 8.3 Trading Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bets` | Place bet (pari-mutuel) |
| POST | `/api/trades/buy` | Buy shares (CPMM) |
| POST | `/api/trades/sell` | Sell shares (CPMM) |
| GET | `/api/position/[marketId]` | Get user position |
| GET | `/api/quote` | Get trade quote |

### 8.4 Social Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tweet/intent` | Generate tweet intent |
| POST | `/api/tweet/verify` | Verify tweet |
| POST | `/api/share-xp` | Claim share XP bonus |
| POST | `/api/referral/claim` | Claim referral code |

### 8.5 Admin Endpoints

All require `role: ADMIN`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/events` | Event CRUD |
| GET/POST | `/api/admin/markets` | Market CRUD |
| POST | `/api/admin/markets/[id]/resolve` | Resolve market |
| POST | `/api/admin/markets/[id]/settle` | Settle payouts |
| GET/PATCH | `/api/admin/users` | User management |
| GET/POST | `/api/admin/xp/config` | XP configuration |
| GET/PATCH | `/api/admin/requests` | Market requests |

---

## 9. Security & Anti-Abuse

### 9.1 Authentication

- **Privy JWT**: All authenticated requests validated via Privy token
- **Admin Allowlist**: Admin role assigned via `ADMIN_TWITTER_IDS` or `ADMIN_EMAILS` env vars
- **Session Management**: Secure cookies with HTTP-only flags

### 9.2 XP Anti-Abuse

| Protection | Implementation |
|------------|----------------|
| Daily Cap | `XPDailyTotal` table + config check |
| Cooldown | `lastTradeAt` field + time comparison |
| Diminishing Returns | Volume tiers with decreasing multipliers |
| No Sell XP | `skipXP: true` flag on sell transactions |

### 9.3 Balance Protection

- `balanceLocked` flag prevents trading during issues
- Atomic transactions for all balance changes
- Ledger audit trail for every change
- Idempotent operations via `correlationId`

### 9.4 Rate Limiting

- API rate limits via Vercel edge
- Debounced search queries (300ms)
- Tweet verification cooldowns

### 9.5 Input Validation

- Zod schemas on all API endpoints
- Prisma type safety
- XSS prevention via React

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Authentication
NEXT_PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# Twitter/X API
RAPIDAPI_KEY=...

# Admin Access
ADMIN_TWITTER_IDS=id1,id2
ADMIN_EMAILS=admin@example.com

# App
APP_URL=https://vault.markets
NODE_ENV=production

# Optional
OPENAI_API_KEY=...        # For AI market generation
BLOB_READ_WRITE_TOKEN=... # For image uploads
```

---

## Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start dev server
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm typecheck
```

---

## Deployment

Optimized for Vercel:
- Edge runtime support
- Serverless PostgreSQL (Neon)
- Environment variable management
- Automatic preview deployments
- Turborepo caching

---

*This document is maintained alongside the codebase. For implementation details, see the source code in `/apps/markets-web/src/`.*
