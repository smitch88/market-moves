# Vault Markets

A Web2 prediction markets platform built with Next.js 16, React 19, and a pnpm Turbo monorepo.

## Features

- **Prediction Markets**: Create and participate in 2-outcome prediction markets
- **AMM Settlement**: Automated Market Maker with instant trading and $1 per winning share payouts
- **Tweet Verification**: RapidAPI-powered tweet verification for bet confirmation
- **Admin Panel**: Full market management with create, resolve, and settle workflows
- **SSR-First**: Server-side rendered pages with optimized loading states

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v3, shadcn/ui (New York)
- **Database**: Prisma + Neon Postgres
- **Auth**: Privy (Email + Twitter OAuth + Wallet placeholder)
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
├── turbo.json
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Neon Postgres database

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
   ```

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed sample data (optional)
cd packages/database && npx prisma db seed

# Start development server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Key Routes

### Public
- `/` - Market grid with search and filters
- `/markets/[slug]` - Market detail with betting panel
- `/profile` - User profile with activity and settings

### Admin (requires ADMIN role)
- `/admin` - Dashboard with stats
- `/admin/markets` - Market management
- `/admin/markets/new` - Create new market
- `/admin/markets/[id]` - Market detail + resolve/settle
- `/admin/users` - User management
- `/admin/settings` - Platform configuration

## Market Lifecycle

1. **DRAFT** - Market created, not visible to users
2. **PUBLISHED/OPEN** - Market accepting bets
3. **CLOSED** - No more bets accepted (automatic at kickoff time)
4. **RESOLVED** - Admin selects winning outcome
5. **SETTLED** - Payouts distributed (one-time, idempotent)

## AMM Math

For a CPMM (Constant Product Market Maker) with:
- Pool A = seedA + Σ(bets on A)
- Pool B = seedB + Σ(bets on B)
- Fee = feeBps / 10000 (default 4%)

If outcome A wins:
```
payout_per_user = (user_stake / Pool_A) * (Total_Pool * (1 - fee))
```

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
```

## Packages

### @vault/ui
Shared UI components with dark-first glassmorphism design:
- Button, Input, Dialog, Tabs, etc.
- GlassCard, MarketTimeline, UserHoverCard
- Market-specific components

### @vault/database
Prisma schema with models for:
- Users, Markets, Outcomes
- Bets, Positions, BalanceLedger
- Referrals, RaffleEntries, TweetProofs
- AdminActionLog for audit trail

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

## License

Private - All rights reserved.
