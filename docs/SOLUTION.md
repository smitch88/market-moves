# Vault Markets - Complete Solution Documentation

## Overview

Vault Markets is a web2-based prediction market platform built with Next.js 16, React 19, and a Turborepo monorepo structure. Users can make predictions on real-world events using virtual currency, share their predictions on X (Twitter), and compete on leaderboards.

## Tech Stack

### Frontend
- **Next.js 16.1** - App Router with Server Components
- **React 19** - Latest React with View Transitions support
- **Tailwind CSS 3** - Utility-first styling with custom theme
- **Framer Motion** - Animations and transitions
- **Shadcn/ui** - Component primitives (New York theme)

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
| `/` | Home page - Market grid with search, sort, and category filters |
| `/markets/[slug]` | Market detail page with betting panel |
| `/leaderboard` | User leaderboard sorted by balance |
| `/faq` | Frequently asked questions |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/r/[code]` | Referral landing page |

### Authenticated Pages

| Route | Description |
|-------|-------------|
| `/profile` | User profile with activity and settings tabs |

### Admin Pages (Role: ADMIN)

| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard |
| `/admin/events` | Event management list |
| `/admin/events/new` | Create new event with markets |
| `/admin/events/[id]` | View event details |
| `/admin/events/[id]/edit` | Edit event |
| `/admin/events/[id]/markets/new` | Add market to event |
| `/admin/markets` | Market management list |
| `/admin/markets/new` | Create new market |
| `/admin/markets/[id]` | View market details |
| `/admin/markets/[id]/edit` | Edit market |
| `/admin/users` | User management |
| `/admin/requests` | Market request management (KOL feature) |
| `/admin/requests/[id]` | Full review page - create events/markets from request |
| `/admin/resolution-sources` | Resolution source management |
| `/admin/resolution-sources/[id]` | Resolution source detail - manage data points |
| `/admin/settings` | Admin settings |

---

## Data Models

### User
```prisma
model User {
  id              String    @id @default(cuid())
  privyUserId     String    @unique
  email           String?
  walletAddress   String?
  twitterSubject  String?
  handle          String?
  name            String?
  profileImageUrl String?
  role            UserRole  @default(USER)
  balance         Int       @default(10000)
  balanceLocked   Boolean   @default(false)
  referralCode    String    @unique @default(cuid())
  // Relations...
}
```

### Market
```prisma
model Market {
  id                 String        @id @default(cuid())
  slug               String        @unique
  title              String
  question           String
  category           MarketCategory
  status             MarketStatus  @default(DRAFT)
  bannerUrl          String?
  logoUrl            String?
  detailsMarkdown    String?
  closesAt           DateTime?
  // Relations: outcomes, bets, positions
}
```

### Outcome
```prisma
model Outcome {
  id       String     @id @default(cuid())
  marketId String
  key      OutcomeKey // A or B
  label    String
  color    String?
}
```

### Bet
```prisma
model Bet {
  id          String    @id @default(cuid())
  userId      String
  marketId    String
  outcomeId   String
  amount      Int
  weight      Float     @default(1)
  payout      Int?
  status      BetStatus @default(PENDING_TWEET)
  tweetProofId String?
  confirmedAt DateTime?
}
```

### BalanceLedger
```prisma
model BalanceLedger {
  id            String        @id @default(cuid())
  userId        String
  delta         Int
  balanceBefore Int
  balanceAfter  Int
  reason        BalanceReason
  correlationId String?
}
```

### Referral
```prisma
model Referral {
  id             String    @id @default(cuid())
  referrerUserId String
  referredUserId String    @unique
  qualifiedAt    DateTime?
}
```

### MarketRequest
```prisma
model MarketRequest {
  id          String              @id @default(cuid())
  userId      String
  title       String
  description String
  sourceUrl   String?             // Optional URL to Polymarket/Kalshi
  status      MarketRequestStatus @default(PENDING)
  adminNotes  String?             // Admin response/notes
  reviewedAt  DateTime?
  reviewedBy  String?             // Admin user ID who reviewed
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
}

enum MarketRequestStatus {
  PENDING   // Awaiting admin review
  APPROVED  // Approved - market will be created
  REJECTED  // Rejected by admin
  CREATED   // Market has been created from this request
}
```

---

## Features

### Authentication
- X (Twitter) OAuth via Privy
- Automatic user provisioning on first login
- Admin role assignment via Twitter ID allowlist
- Dev impersonation mode for testing

### Prediction Markets
- Binary outcome markets (A/B)
- Dynamic pricing based on bet pool ratios
- Tweet verification for bet confirmation
- Market lifecycle: Draft → Published → Open → Closed → Resolved → Settled

### Betting Flow
1. User selects outcome (A or B)
2. User enters bet amount
3. Balance is reserved
4. User shares prediction on X
5. Tweet is verified
6. Bet is confirmed
7. Success modal with sharing options

### Leaderboard
- Users ranked by virtual balance
- Top 3 highlighted with special styling
- Animated entrance effects

### Referral System
- Unique referral codes for each user
- Dedicated landing page at `/r/[code]`
- Referral tracking and qualification on first bet
- Share via X or copy link

### Search
- Real-time search with debouncing
- Dropdown results as you type
- Search by title, question, or slug
- Full page results via URL params

### Admin Features
- Create/edit/delete markets
- Market status management
- User balance and role management
- Resolution and settlement processing
- Market request review and management

### Market Requests (KOL Feature)
- Users can submit market ideas from their profile
- Request form includes title, description, and optional reference URL
- Requests tab on profile shows status of submitted requests
- Admin area for reviewing and responding to requests
- Status workflow: Pending → Approved/Rejected/Created

---

## Theming

### Color Palette (Dark Mode)
```css
--background: 224 71% 4%;
--foreground: 213 31% 91%;
--primary: 263.4 70% 50.4%;
--outcome-yes: #00cb4e;
--outcome-no: #ff2f36;
--balance: #df2421;
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
ADMIN_EMAILS=admin@example.com,another@example.com
```

---

## Development

### Commands
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Database operations
pnpm db:push    # Push schema changes
pnpm db:seed    # Seed sample data
pnpm db:studio  # Open Prisma Studio
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
