# Vault Markets - Technical Solution Documentation

## Overview

Vault Markets is a web2-based prediction market platform built with Next.js 16, React 19, and a Turborepo monorepo structure. Users can make predictions on real-world events using virtual currency ($10,000 starting balance), share their predictions on X (Twitter), and compete on leaderboards.

## Tech Stack

### Frontend
- **Next.js 16.1** - App Router with Server Components
- **React 19** - Latest React with View Transitions support
- **Tailwind CSS 3** - Utility-first styling with custom theme
- **Framer Motion** - Animations and transitions
- **Shadcn/ui** - Component primitives (New York theme)
- **Recharts** - Price charts and data visualization

### Backend
- **Prisma ORM** - Database access and migrations
- **Neon DB** - Serverless PostgreSQL
- **Privy** - Authentication (X/Twitter OAuth)

### Packages (Monorepo)
- `@vault/ui` - Shared UI components and theming
- `@vault/database` - Prisma client and schema
- `@vault/auth` - Authentication utilities
- `@vault/twitter-service` - Twitter/X API integration

---

## Application Structure

```
vault-markets/
├── apps/
│   └── markets-web/          # Next.js web application
│       └── src/
│           ├── app/          # App Router pages
│           ├── components/   # React components
│           └── lib/          # Utilities and services
├── packages/
│   ├── vault-ui/             # Shared UI components
│   ├── database/             # Prisma schema and client
│   ├── auth/                 # Authentication package
│   └── twitter-service/      # Twitter API integration
└── docs/                     # Documentation
```

---

## Pages

### Public Pages

| Route | Description |
|-------|-------------|
| `/` | Home page - Event grid with Quick Bet, search, filters, bookmarks |
| `/m/[slug]` | Event detail page with betting panel and price chart |
| `/leaderboard` | User rankings by XP, PnL, or Volume |
| `/faq` | Frequently asked questions |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/r/[code]` | Referral landing page |

### Authenticated Pages

| Route | Description |
|-------|-------------|
| `/profile` | User profile with positions, activity, bookmarks, requests, settings |
| `/u/[handle]` | Public user profile view |

### Admin Pages (Role: ADMIN)

| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard with statistics |
| `/admin/events` | Event management list |
| `/admin/events/new` | Create new event with markets |
| `/admin/events/[id]` | View event details |
| `/admin/events/[id]/edit` | Edit event |
| `/admin/events/[id]/markets/new` | Add market to event |
| `/admin/markets` | Market management list |
| `/admin/markets/[id]` | View/edit market details |
| `/admin/users` | User management |
| `/admin/bets` | Bet management with advanced filters |
| `/admin/requests` | Market request management |
| `/admin/requests/[id]` | Full review page for market requests |
| `/admin/xp` | XP system configuration |
| `/admin/resolution-sources` | Resolution source management |
| `/admin/resolution-sources/[id]` | Resolution source detail - manage data points |

---

## Data Models

### User
```prisma
model User {
  id              String   @id @default(cuid())
  privyUserId     String   @unique
  email           String?
  walletAddress   String?
  twitterSubject  String?
  handle          String?  @unique
  name            String?
  profileImageUrl String?
  role            UserRole @default(USER)
  
  // Financial
  balance       Decimal @default(10000.00) @db.Decimal(19, 2)
  balanceLocked Boolean @default(false)
  realizedPnL   Decimal @default(0.0000) @db.Decimal(19, 4)
  totalVolume   Decimal @default(0.00) @db.Decimal(19, 2)
  
  // Gamification
  xp           Int    @default(0)
  referralCode String @unique @default(cuid())
  
  // UI state
  hasSeenWelcomeModal Boolean @default(false)
}
```

### Event
```prisma
model Event {
  id          String         @id @default(cuid())
  slug        String         @unique
  title       String
  description String?
  category    MarketCategory @default(OTHER)
  eventType   EventType      @default(MATCHUP)
  bannerUrl   String?
  logoUrl     String?
  startTime   DateTime?
  endTime     DateTime?
  active      Boolean        @default(true)
  closed      Boolean        @default(false)
  featured    Boolean        @default(false)
  isPublished Boolean        @default(false)
  
  // KOL attribution - which captain created this event
  createdByKolId String?
  createdByKol   User?   @relation("KOLCreatedEvents")
  
  markets   Market[]
  tags      Tag[]
  bookmarks Bookmark[]
}
```

### Market
```prisma
model Market {
  id                  String       @id @default(cuid())
  question            String
  status              MarketStatus @default(DRAFT)
  isPublished         Boolean      @default(false)
  detailsMarkdown     String?
  resolutionSourceUrl String?
  publishedAt         DateTime?
  opensAt             DateTime?
  closesAt            DateTime?
  resolvedAt          DateTime?
  settledAt           DateTime?
  feeBps              Int          @default(100)
  
  // Configuration
  eventId         String
  displayLabel    String?
  sortOrder       Int?
  outcomes        String  @default("[\"Yes\", \"No\"]")
  outcomePrices   String  @default("[\"0.50\", \"0.50\"]")
  resolvedOutcome Int?
  
  // KOL attribution - which captain created this market
  createdByKolId String?
  createdByKol   User?  @relation("KOLCreatedMarkets")
  
  // CPMM
  pool0        Decimal @default(0.00) @db.Decimal(19, 2)
  pool1        Decimal @default(0.00) @db.Decimal(19, 2)
  seed0        Decimal @default(100000.00) @db.Decimal(19, 2)
  seed1        Decimal @default(100000.00) @db.Decimal(19, 2)
  reserve0     Decimal @default(100000) @db.Decimal(19, 2)
  reserve1     Decimal @default(100000) @db.Decimal(19, 2)
  k            Decimal? @db.Decimal(38, 4)
  pricingModel PricingModel @default(CPMM)
}
```

### Bet
```prisma
model Bet {
  id           String    @id @default(cuid())
  userId       String
  marketId     String
  amount       Decimal   @db.Decimal(19, 2)
  weight       Float     @default(1)
  payout       Decimal?  @db.Decimal(19, 2)
  status       BetStatus @default(PENDING_TWEET)
  tweetProofId String?
  confirmedAt  DateTime?
  
  // CPMM
  outcomeIndex  Int
  pricePerShare Decimal?  @db.Decimal(10, 4)
  shares        Decimal?  @db.Decimal(19, 4)
  tradeType     TradeType @default(BUY)
}
```

### Position
```prisma
model Position {
  id       String @id @default(cuid())
  userId   String
  marketId String
  
  // CPMM
  shares0  Decimal @default(0) @db.Decimal(19, 4)
  shares1  Decimal @default(0) @db.Decimal(19, 4)
  avgCost0 Decimal @default(0) @db.Decimal(10, 4)
  avgCost1 Decimal @default(0) @db.Decimal(10, 4)
  
  // Legacy
  amount0   Decimal @default(0.00) @db.Decimal(19, 2)
  amount1   Decimal @default(0.00) @db.Decimal(19, 2)
  weighted0 Float   @default(0)
  weighted1 Float   @default(0)
  
  lastBetAt DateTime?
  claimedAt DateTime?
  
  @@unique([userId, marketId])
}
```

### Financial Ledgers
```prisma
model BalanceLedger {
  id               String        @id @default(cuid())
  userId           String
  delta            Decimal       @db.Decimal(19, 2)
  balanceBefore    Decimal       @db.Decimal(19, 2)
  balanceAfter     Decimal       @db.Decimal(19, 2)
  reason           BalanceReason
  correlationId    String?
  actorAdminUserId String?
}

model PnLLedger {
  id            String    @id @default(cuid())
  userId        String
  delta         Decimal   @db.Decimal(19, 4)
  pnlBefore     Decimal   @db.Decimal(19, 4)
  pnlAfter      Decimal   @db.Decimal(19, 4)
  reason        PnLReason
  correlationId String?
  marketId      String?
  metadata      Json?
}
```

### XP System
```prisma
model XPLedger {
  id            String   @id @default(cuid())
  userId        String
  delta         Int
  xpBefore      Int
  xpAfter       Int
  reason        XPReason
  correlationId String?
  adminUserId   String?
}

model XPConfig {
  id          String   @id @default(cuid())
  key         String   @unique
  value       String
  description String?
  updatedBy   String?
}

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

### Social & Features
```prisma
model Bookmark {
  id        String   @id @default(cuid())
  userId    String
  eventId   String
  
  @@unique([userId, eventId])
}

model Referral {
  id                  String    @id @default(cuid())
  referrerUserId      String
  referredUserId      String    @unique
  qualifiedAt         DateTime?
  bonusEntriesAwarded Int       @default(0)
}

model TweetProof {
  id          String           @id @default(cuid())
  userId      String
  marketId    String
  method      TweetProofMethod
  tweetUrl    String?
  tweetId     String?
  verified    Boolean          @default(false)
  matchedText String?
  raw         Json?
  verifiedAt  DateTime?
}

model MarketRequest {
  id          String              @id @default(cuid())
  userId      String
  title       String
  description String
  sourceUrl   String?
  status      MarketRequestStatus @default(PENDING)
  adminNotes  String?
  reviewedAt  DateTime?
  reviewedBy  String?
}
```

---

## Features

### Authentication
- X (Twitter) OAuth via Privy
- Automatic user provisioning on first login
- Admin role assignment via Twitter ID or email allowlist
- Dev impersonation mode for testing

### Prediction Markets
- Binary outcome markets (Yes/No or custom labels)
- CPMM pricing with instant trades
- Market lifecycle: Draft → Published → Open → Closed → Resolved → Settled
- 1% default fee (configurable per market)

### XP System
- Earn XP from trading volume (10 XP per $1)
- Referral bonus (10,000 XP each)
- Share tweet bonus (50 XP)
- Level system: `level = floor(sqrt(xp / 1000))`
- Anti-abuse: daily cap, cooldowns, diminishing returns

### Quick Bet Flow
1. Click Quick Bet on event card
2. Select market (if multiple)
3. Pick outcome
4. Enter amount
5. Place bet → Success modal with sharing

### Bookmarking
- Bookmark events from landing page
- Filter events by bookmarks
- Manage bookmarks in profile

### Leaderboard
- Rankings by XP, PnL, Volume
- Time periods: All Time, Monthly, Weekly
- User search and pagination
- Current user position always visible

### Referral System
- Unique referral codes per user
- 10,000 XP bonus for both users
- Tracked in referral and XP ledgers

### Market Requests (KOL Feature)
- Users submit market ideas
- Admin review with approve/reject/create
- Status tracking in profile

---

## Theming

### Color Palette (Dark Mode)
```css
--background: 224 71% 4%;
--foreground: 213 31% 91%;
--primary: 263.4 70% 50.4%;
--outcome-yes: #00cb4e;
--outcome-no: #ff2f36;
--balance: #22C55E;
```

### Design System
- Glassmorphic cards with backdrop blur
- Subtle grid background with radial mask
- Framer Motion animations throughout
- Responsive mobile-first design

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Privy Auth
NEXT_PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# Twitter/X API (RapidAPI)
RAPIDAPI_KEY=...

# Admin Access (comma-separated)
ADMIN_TWITTER_IDS=id1,id2,id3
ADMIN_EMAILS=admin@example.com

# App
APP_URL=https://vault.markets

# Optional
OPENAI_API_KEY=...
BLOB_READ_WRITE_TOKEN=...
```

---

## Development

### Commands
```bash
pnpm install       # Install dependencies
pnpm dev           # Run development server
pnpm build         # Build for production
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
pnpm db:studio     # Open Prisma Studio
```

### Dev Tools
- Floating debug panel (development only)
- User impersonation for testing
- Quick user switching

---

## Deployment

The application is designed for deployment on Vercel with:
- Edge runtime support
- Serverless PostgreSQL (Neon)
- Environment variable management
- Automatic preview deployments
- Turborepo caching
