# Vault Markets

A Web2 prediction markets platform built with Next.js 16, React 19, and a pnpm Turborepo monorepo.

## Features

- **Prediction Markets**: Binary outcome markets with CPMM (Constant Product Market Maker) trading
- **XP Leveling System**: Gamified progression with anti-abuse protections (daily caps, cooldowns, diminishing returns)
- **Quick Bet**: Place bets directly from the landing page without navigation
- **Social Sharing**: X (Twitter) verification for bets and XP bonuses
- **Bookmarking**: Save events for quick access
- **Referral Program**: 10,000 XP bonus for both referrer and referred user
- **Leaderboard**: Rankings by XP, PnL, and Volume with time periods
- **Admin Panel**: Full market lifecycle management, user management, XP configuration

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components)
- **UI**: React 19, Tailwind CSS v3, shadcn/ui (New York), Framer Motion
- **Database**: Prisma ORM + Neon PostgreSQL
- **Auth**: Privy (X/Twitter OAuth)
- **Monorepo**: Turborepo + pnpm

## Project Structure

```
vault-markets/
├── apps/
│   └── markets-web/        # Next.js application
├── packages/
│   ├── vault-ui/           # Shared UI components
│   ├── database/           # Prisma schema + client
│   ├── auth/               # Privy auth utilities
│   └── twitter-service/    # RapidAPI Twitter integration
├── docs/                   # Documentation
│   ├── PLATFORM.md         # Complete platform documentation
│   ├── API.md              # API reference
│   ├── SOLUTION.md         # Technical overview
│   └── WORKFLOWS.md        # User journeys
├── turbo.json
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Neon PostgreSQL database

### Environment Setup

1. Copy the environment template:
   ```bash
   cp env.example .env
   ```

2. Fill in your environment variables:
   ```env
   DATABASE_URL="postgresql://..."
   PRIVY_APP_ID="your_privy_app_id"
   PRIVY_APP_SECRET="your_privy_secret"
   RAPID_API_KEY="your_rapidapi_key"
   APP_URL="http://localhost:3000"
   ADMIN_TWITTER_IDS="twitter_id_1,twitter_id_2"
   ADMIN_EMAILS="admin@example.com"
   ```

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start development server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Key Routes

### Public
| Route | Description |
|-------|-------------|
| `/` | Event grid with Quick Bet, search, filters, and bookmarks |
| `/m/[slug]` | Event detail with betting panel and price chart |
| `/leaderboard` | User rankings (XP, PnL, Volume) |
| `/profile` | User dashboard with positions, activity, bookmarks, requests |
| `/r/[code]` | Referral landing page |
| `/faq` | Frequently asked questions |

### Admin (requires ADMIN role)
| Route | Description |
|-------|-------------|
| `/admin` | Dashboard with stats |
| `/admin/events` | Event management (create, edit, publish) |
| `/admin/markets` | Market management (resolve, settle) |
| `/admin/users` | User management (roles, balances, XP) |
| `/admin/requests` | Market request review |
| `/admin/xp` | XP system configuration |
| `/admin/bets` | Bet management with filters |
| `/admin/resolution-sources` | Resolution source management |

## Market Lifecycle

```
DRAFT → PUBLISHED → OPEN → CLOSED → RESOLVED → SETTLED
```

1. **DRAFT** - Market created, not visible to users
2. **PUBLISHED/OPEN** - Market accepting bets
3. **CLOSED** - No more bets accepted (automatic at close time)
4. **RESOLVED** - Admin selects winning outcome
5. **SETTLED** - Payouts distributed to winners

## XP System

Users earn XP through:
- **Trading Volume**: 10 XP per $1 wagered
- **Referral Bonus**: 10,000 XP (both users)
- **Share Tweet**: 50 XP for verified shares

### Anti-Abuse Protections

| Protection | Default |
|------------|---------|
| Daily XP Cap | 50,000 XP |
| Market Cooldown | 5 minutes |
| Volume Diminishing Returns | $10k per tier |
| No Sell XP | Sells don't earn XP |

## CPMM Math

For trades with reserves (R0, R1):
- **Price**: `price0 = R0 / (R0 + R1)`
- **Buy**: Shares = amount / price, reserves updated
- **Sell**: Proceeds = shares × price × (1 - fee)
- **Settlement**: Winning shares = $1 each (minus fee)

## Development

```bash
# Run all packages in dev mode
pnpm dev

# Build all packages
pnpm build

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Database operations
pnpm db:generate  # Generate Prisma client
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Prisma Studio
```

## Packages

### @vault/ui
Shared UI components with dark-first design:
- Core: Button, Input, Dialog, Tabs, Select, etc.
- Custom: GlassCard, MarketTimeline, UserHoverCard
- Sonner toasts with theme support

### @vault/database
Prisma schema with models for:
- Users, Events, Markets, Bets, Positions
- BalanceLedger, PnLLedger, XPLedger
- XPTradeTracker, XPDailyTotal, XPConfig
- Referrals, Bookmarks, TweetProofs
- MarketRequests, ResolutionSources

### @vault/auth
Privy JWT verification and role guards:
- `getSessionUser()` - Get current user
- `requireUser()` - Require authenticated user
- `requireAdmin()` - Require admin role

### @vault/twitter-service
RapidAPI Twitter integration:
- Timeline scan verification
- Tweet URL verification
- Tweet intent URL generation

## Documentation

- [PLATFORM.md](docs/PLATFORM.md) - Complete platform documentation
- [XP_SYSTEM.md](docs/XP_SYSTEM.md) - XP system, levels, and anti-abuse protections
- [API.md](docs/API.md) - API endpoint reference
- [SOLUTION.md](docs/SOLUTION.md) - Technical architecture
- [WORKFLOWS.md](docs/WORKFLOWS.md) - User journey diagrams

## License

Private - All rights reserved.
