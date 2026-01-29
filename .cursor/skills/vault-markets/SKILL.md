---
name: vault-markets
description: Vault Markets prediction market platform development. Use when working on this project's components, APIs, database models, authentication, or betting logic.
---

# Vault Markets Development

## Overview

Vault Markets is a Web2-based prediction market platform built with Next.js 16, featuring AMM (Automated Market Maker) trading mechanics, Twitter/X integration, and Privy authentication.

## Project Structure

```
vault-markets/
├── apps/
│   └── markets-web/          # Next.js 16 frontend application
│       ├── src/
│       │   ├── app/          # App Router pages and API routes
│       │   ├── components/   # React components
│       │   └── lib/          # Utilities and services
│       └── package.json
├── packages/
│   ├── vault-ui/             # Shared UI components (shadcn/ui)
│   ├── database/             # Prisma schema and client
│   ├── auth/                 # Privy authentication
│   ├── twitter-service/      # Twitter/X RapidAPI client
│   └── skills/               # Agent skills library
└── turbo.json
```

## Tech Stack

- **Framework**: Next.js 16.1 with App Router
- **React**: 18.3.x
- **Styling**: Tailwind CSS v3 + shadcn/ui (New York theme)
- **Database**: PostgreSQL via Neon + Prisma ORM
- **Auth**: Privy (Twitter/X OAuth)
- **Package Manager**: pnpm with Turborepo

## Key Patterns

### 1. Database Imports
Always import Prisma from the database package:
```typescript
import { prisma } from "@vault/database";
import type { User, Market, Bet } from "@vault/database";
```

### 2. UI Components
Import from the vault-ui package:
```typescript
import { Button, GlassCard, Skeleton } from "@vault/ui";
```

### 3. Authentication
Use auth helpers for protected routes:
```typescript
import { requireUser, requireAdmin } from "@vault/auth";

// In API route
const user = await requireUser();
const admin = await requireAdmin();
```

### 4. Server Components (Default)
Pages are Server Components by default. Add `"use client"` only when needed:
```typescript
// src/app/markets/[slug]/page.tsx - Server Component
export default async function MarketPage({ params }) {
  const { slug } = await params;
  const market = await prisma.market.findUnique({ where: { slug } });
  return <MarketDetail market={market} />;
}
```

### 5. API Routes
API routes live in `src/app/api/`:
```typescript
// src/app/api/markets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@vault/database";

export async function GET() {
  const markets = await prisma.market.findMany();
  return NextResponse.json(markets);
}
```

## Database Models

### Core Models
- `User` - Users with balance, role, Twitter info
- `Market` - Prediction markets with outcomes
- `Outcome` - Binary outcomes (A/B) for each market
- `Bet` - Individual bets with amount and weight
- `Position` - Aggregated user positions per market
- `BalanceLedger` - Audit trail for balance changes

### Market Status Flow
```
DRAFT → OPEN → CLOSED → RESOLVED → SETTLED
```

## AMM Trading

Markets use CPMM (Constant Product Market Maker):
- Buy and sell shares instantly at market prices
- Prices adjust automatically based on supply and demand
- Each winning share pays out $1 at settlement
- Platform takes a configurable fee (default 1%)
- Seed liquidity prevents extreme odds

```typescript
// Payout calculation
const totalPool = poolA + poolB;
const winningPool = outcome === "A" ? poolA : poolB;
const userShare = userBet / winningPool;
const payout = userShare * totalPool * (1 - feeBps / 10000);
```

## Environment Variables

Required in `.env`:
```env
DATABASE_URL=postgresql://...
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
RAPID_API_KEY=...
APP_URL=http://localhost:3000
```

## Commands

```bash
# Development
pnpm dev                    # Start all apps
pnpm --filter @vault/markets-web dev

# Database
pnpm --filter @vault/database db:generate  # Generate Prisma client
pnpm --filter @vault/database db:push      # Push schema to DB
pnpm --filter @vault/database db:studio    # Open Prisma Studio

# Build
pnpm build                  # Build all packages
pnpm typecheck              # Type check all packages
```

## Conventions

1. **File naming**: kebab-case for files, PascalCase for components
2. **API responses**: Always use `NextResponse.json()`
3. **Error handling**: Use try/catch with proper HTTP status codes
4. **Loading states**: Use Skeleton components from vault-ui
5. **Dark mode**: Default theme, use CSS variables for theming
6. **Glassmorphism**: Use `GlassCard` component for card styling

## When to Use This Skill

- Creating new pages or API routes
- Working with database models or queries
- Implementing betting logic
- Adding authentication checks
- Building UI components
- Understanding project architecture
