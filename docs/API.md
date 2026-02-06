# Vault Markets - API Reference

All API routes are located in `/apps/markets-web/src/app/api/`.

---

## Authentication

Most endpoints require authentication via Privy JWT token. The token is automatically sent via:
- `privy-token` cookie (set by Privy SDK)
- `Authorization: Bearer <token>` header

---

## Public Endpoints

### GET /api/events
Fetch published events with optional filtering.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| category | string | Filter by category |
| featured | boolean | Featured events only |
| view | string | Filter view: "trending", "ending", "new", "kol-created", "bookmarks" |
| limit | number | Max results (default: 50) |

**Response:**
```json
{
  "events": [
    {
      "id": "clx...",
      "slug": "super-bowl-lix",
      "title": "Super Bowl LIX",
      "category": "NFL",
      "isPublished": true,
      "createdByKol": {
        "id": "...",
        "name": "Captain Name",
        "handle": "captain_handle",
        "profileImageUrl": "https://..."
      },
      "markets": [...]
    }
  ]
}
```

**Streaming (SSE) Response:**
When `stream: true`, the endpoint returns `text/event-stream` with events:
- `status`: string status message
- `token`: incremental text from the model
- `result`: final parsed JSON object (same shape as non-stream response `generated`)
- `error`: error message string
- `done`: boolean

The `createdByKol` field is present when the event was created by a KOL/Captain. The "kol-created" view filter returns only events that have a `createdByKol` attribution.

---

### GET /api/events/[slug]
Fetch single event by slug with all markets.

---

### GET /api/events/[slug]/markets
Fetch markets for a specific event.

**Response:**
```json
{
  "event": {
    "id": "...",
    "title": "Super Bowl LIX",
    "slug": "super-bowl-lix"
  },
  "markets": [
    {
      "id": "...",
      "question": "Who will win?",
      "outcomes": "[\"Chiefs\", \"49ers\"]",
      "stats": {
        "percent0": 55,
        "percent1": 45,
        "totalPool": 50000
      }
    }
  ]
}
```

---

### GET /api/markets/search
Search markets by title, question, or slug.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| q | string | Search query (min 2 chars) |
| limit | number | Max results (default: 8) |

---

### GET /api/leaderboard
Fetch user leaderboard with multiple metrics.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| metric | string | `xp`, `pnl`, `volume`, `creators`, or `referrals` |
| period | string | `all`, `monthly`, or `weekly` |
| page | number | Page number (default: 1) |
| pageSize | number | Results per page (default: 25) |

**Response:**
```json
{
  "entries": [
    {
      "rank": 1,
      "userId": "...",
      "handle": "username",
      "name": "Display Name",
      "profileImageUrl": "...",
      "value": 150000,
      "level": 12
    }
  ],
  "metric": "xp",
  "period": "all",
  "page": 1,
  "totalPages": 10,
  "totalUsers": 250,
  "currentUserEntry": {...},
  "snapshotRefreshedAt": "2024-01-15T12:30:00.000Z",
  "fromSnapshot": true
}
```

**PnL Snapshot Fields (for metric=pnl, period=all):**
| Field | Type | Description |
|-------|------|-------------|
| snapshotRefreshedAt | string | ISO timestamp of last snapshot refresh |
| fromSnapshot | boolean | Whether data came from pre-computed snapshot |

Note: PnL leaderboard for "all" period uses a pre-computed snapshot that refreshes every 30 minutes. If no valid snapshot exists, the API falls back to live calculation. The frontend displays "last updated" timestamp when snapshot data is used.

---

## Authenticated Endpoints

### GET /api/me
Get current user profile.

**Response:**
```json
{
  "id": "clx...",
  "privyUserId": "did:privy:...",
  "handle": "username",
  "name": "Display Name",
  "profileImageUrl": "...",
  "role": "USER",
  "balance": 10000,
  "realizedPnL": 500,
  "totalVolume": 25000,
  "referralCode": "abc123",
  "hasSeenWelcomeModal": true
}
```

---

### PATCH /api/me
Update user profile.

**Request Body:**
```json
{
  "handle": "newusername",
  "name": "New Display Name",
  "profileImageUrl": "https://..."
}
```

---

### GET /api/me/xp
Get current user's XP and level information.

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

---

### POST /api/me/redeem
Claim settled positions.

**Request Body (optional):**
```json
{
  "positionIds": ["pos_1", "pos_2"]
}
```

**Response:**
```json
{
  "success": true,
  "totalRedeemed": 1500,
  "totalProfit": 500,
  "positionsRedeemed": 2,
  "positions": [
    {
      "positionId": "...",
      "marketId": "...",
      "payout": 1000,
      "profit": 300,
      "isWinner": true
    }
  ]
}
```

---

## Bookmark Endpoints

### GET /api/bookmarks
Get user's bookmarked events.

**Response:**
```json
{
  "bookmarks": [
    {
      "id": "...",
      "eventId": "...",
      "event": {
        "id": "...",
        "title": "Super Bowl LIX",
        "slug": "super-bowl-lix"
      }
    }
  ]
}
```

---

### POST /api/bookmarks
Add bookmark.

**Request Body:**
```json
{
  "eventId": "event_id"
}
```

---

### DELETE /api/bookmarks
Remove bookmark.

**Request Body:**
```json
{
  "eventId": "event_id"
}
```

---

## Trading Endpoints

### POST /api/bets
Place a new bet (pari-mutuel style).

**Request Body:**
```json
{
  "marketId": "market_id",
  "outcomeIndex": 0,
  "amount": 100
}
```

**Response:**
```json
{
  "bet": {
    "id": "bet_id",
    "amount": 100,
    "shares": 185.19,
    "pricePerShare": 0.54,
    "status": "CONFIRMED"
  },
  "outcomeLabel": "Yes",
  "xpAwarded": 1000
}
```

---

### POST /api/trades/buy
Buy shares via CPMM.

**Request Body:**
```json
{
  "marketId": "market_id",
  "outcomeIndex": 0,
  "amount": 100,
  "maxSlippage": 0.05
}
```

**Response:**
```json
{
  "bet": {...},
  "quote": {
    "inputAmount": 100,
    "outputAmount": 185.19,
    "avgPrice": 0.54,
    "priceImpact": 0.02,
    "feeAmount": 1,
    "newPrices": {
      "price0": 0.55,
      "price1": 0.45
    }
  },
  "xpAwarded": 1000,
  "xpReason": null,
  "message": "Trade executed successfully!"
}
```

---

### POST /api/trades/sell
Sell shares via CPMM.

**Request Body:**
```json
{
  "marketId": "market_id",
  "outcomeIndex": 0,
  "shares": 50,
  "minProceeds": 25
}
```

**Note:** Sells do NOT earn XP (anti-abuse measure).

---

### GET /api/position/[marketId]
Get user's position in a market.

**Response:**
```json
{
  "position": {
    "shares0": 185.19,
    "shares1": 0,
    "avgCost0": 0.54,
    "avgCost1": 0,
    "value0": 200,
    "value1": 0,
    "profit0": 15,
    "profit1": 0
  }
}
```

---

### GET /api/quote
Get trade quote without executing.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| marketId | string | Market ID |
| outcomeIndex | number | 0 or 1 |
| amount | number | Trade amount |
| side | string | `buy` or `sell` |

---

## Social Endpoints

### POST /api/tweet/intent
Create tweet intent URL for bet confirmation.

**Request Body:**
```json
{
  "marketId": "market_id",
  "betId": "bet_id"
}
```

**Response:**
```json
{
  "intentUrl": "https://twitter.com/intent/tweet?text=...",
  "proofId": "proof_id",
  "requiredText": "I'm betting on...",
  "marketLink": "https://vault.markets/m/..."
}
```

---

### POST /api/tweet/verify
Verify tweet for bet confirmation.

**Request Body:**
```json
{
  "marketId": "market_id",
  "betId": "bet_id",
  "method": "timeline",
  "tweetUrl": "https://x.com/user/status/123"
}
```

---

### POST /api/share-xp
Claim XP bonus for sharing bet.

**Request Body:**
```json
{
  "betId": "bet_id"
}
```

**Response:**
```json
{
  "verified": true,
  "xpAwarded": 50,
  "message": "Tweet verified! +50 XP"
}
```

---

### POST /api/referral/claim
Claim a referral code after signup. Awards 10,000 XP to both users.

**Request Body:**
```json
{
  "referralCode": "abc123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Referral claimed successfully",
  "referrer": {
    "name": "Referrer Name",
    "handle": "referrer_handle"
  },
  "xpAwarded": 10000,
  "newXp": 10000,
  "newLevel": 3
}
```

---

## Market Request Endpoints

### POST /api/market-requests
Create a new market request.

**Request Body:**
```json
{
  "title": "Will Bitcoin reach $100k?",
  "description": "Market for BTC price prediction...",
  "sourceUrl": "https://polymarket.com/..."
}
```

**Validation:**
- Title: 5-200 characters
- Description: 20-2000 characters

---

### GET /api/me/market-requests
Get all market requests for the current user.

---

## Admin Endpoints

All admin endpoints require `role: "ADMIN"`.

### Event Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/events` | List all events |
| POST | `/api/admin/events` | Create event |
| GET | `/api/admin/events/[id]` | Get event |
| PUT | `/api/admin/events/[id]` | Update event |
| DELETE | `/api/admin/events/[id]` | Delete event |

### Market Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/markets` | List all markets |
| POST | `/api/admin/markets` | Create market |
| GET | `/api/admin/markets/[id]` | Get market |
| PUT | `/api/admin/markets/[id]` | Update market |
| POST | `/api/admin/markets/[id]/resolve` | Resolve market |
| POST | `/api/admin/markets/[id]/settle` | Settle payouts |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List users |
| GET | `/api/admin/users/[id]` | Get user |
| PATCH | `/api/admin/users/[id]` | Update user |

### Bet Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/bets` | List bets with filters |

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| pageSize | number | Results per page |
| status | string | Filter by status |
| eventId | string | Filter by event |
| userSearch | string | Search user handle/name |
| verifiedTweet | boolean | Has verified tweet |
| sortBy | string | Sort field |
| sortOrder | string | `asc` or `desc` |

### XP Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/xp/config` | Get XP config and stats |
| POST | `/api/admin/xp/config` | Update XP config |

**Config Keys:**
- `xp_per_dollar_volume` - XP per $1 wagered
- `daily_xp_cap` - Max XP per day
- `market_cooldown_seconds` - Cooldown between earning XP
- `market_volume_threshold` - Volume per tier for diminishing returns

### Market Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/requests` | List requests |
| GET | `/api/admin/requests/[id]` | Get request |
| PATCH | `/api/admin/requests/[id]` | Update request status |

### AI Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/ai/generate-market` | Generate event + markets from request |

**Request Body:**
```json
{
  "title": "string",
  "description": "string or null",
  "sourceUrl": "string or null",
  "referenceUrls": "string or null",
  "pastedText": "string or null",
  "attachments": [
    {
      "name": "string",
      "type": "string",
      "size": 123,
      "content": "string"
    }
  ],
  "stream": true
}
```

**Response:**
```json
{
  "success": true,
  "generated": {
    "event": {
      "title": "string",
      "slug": "string",
      "description": "string",
      "category": "NFL|NBA|NHL|MLB|SOCCER|UFC|TENNIS|GOLF|ESPORTS|POLITICS|CRYPTO|FINANCE|ENTERTAINMENT|OTHER",
      "eventType": "MATCHUP|PROP|TOURNAMENT|FUTURES",
      "startTime": "ISO date string or null",
      "endTime": "ISO date string or null",
      "bannerUrl": null,
      "logoUrl": null,
      "tags": ["string"]
    },
    "markets": [
      {
        "question": "string",
        "outcome0Label": "string",
        "outcome1Label": "string",
        "detailsMarkdown": "string",
        "resolutionSourceUrl": "string or null",
        "opensAt": "ISO date string",
        "closesAt": "ISO date string",
        "feeBps": 100,
        "seed0": 100000,
        "seed1": 100000
      }
    ],
    "summary": "End-user friendly resolution summary",
    "sources": ["string"],
    "reasoning": "string"
  }
}
```

### Resolution Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/resolution-sources` | List sources |
| POST | `/api/admin/resolution-sources` | Create source |
| GET | `/api/admin/resolution-sources/[id]` | Get source |
| PUT | `/api/admin/resolution-sources/[id]` | Update source |
| POST | `/api/admin/resolution-sources/[id]/data` | Add data point |

---

## Public Resolution Source API

### GET /api/resolution-sources
List all active, public resolution sources.

### GET /api/resolution-sources/:slug
Get details about a specific resolution source.

### GET /api/resolution-sources/:slug/data
Get all verified data points for a resolution source.

**Query Parameters:**
- `key` - Filter by specific key
- `marketId` - Filter by linked market
- `since` - ISO date string for effective date
- `limit` - Max results (default 100)

### GET /api/resolution-sources/:slug/data/:key
Get a specific data point by key.

---

## Dev Endpoints (Development Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dev/impersonate` | Get impersonation state |
| POST | `/api/dev/impersonate` | Start impersonating |
| DELETE | `/api/dev/impersonate` | Stop impersonating |
| GET | `/api/dev/users` | List all users |

---

## Streak & KOL Endpoints

### GET /api/me/streak
Get current user's streak information.

**Response:**
```json
{
  "currentStreak": 5,
  "longestStreak": 12,
  "lastActiveDate": "2024-01-15T00:00:00.000Z",
  "multiplier": 1.4,
  "badges": [
    {
      "badgeType": "streak_7",
      "earnedAt": "2024-01-10T00:00:00.000Z"
    }
  ],
  "nextTier": {
    "daysNeeded": 2,
    "multiplier": 3.0,
    "badge": "streak_7"
  }
}
```

---

### GET /api/me/captain
Get user's current KOL captain.

**Response:**
```json
{
  "captain": {
    "id": "user_id",
    "name": "KOL Name",
    "handle": "kol_handle",
    "profileImageUrl": "..."
  }
}
```

---

### PUT /api/me/captain
Set or remove user's KOL captain.

**Request Body:**
```json
{
  "captainId": "kol_user_id"
}
```

Pass `null` to remove captain.

---

### GET /api/kols
List all approved KOLs (Key Opinion Leaders).

**Response:**
```json
{
  "kols": [
    {
      "id": "user_id",
      "name": "KOL Name",
      "handle": "kol_handle",
      "profileImageUrl": "...",
      "followerCount": 150,
      "kolApprovedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### GET /api/kol-bets/stream
Server-Sent Events stream for real-time KOL bet notifications.

**Event Format:**
```json
{
  "type": "kol_bet",
  "data": {
    "id": "notification_id",
    "kolUserId": "...",
    "kolHandle": "kol_handle",
    "kolName": "KOL Name",
    "kolProfileImageUrl": "...",
    "marketId": "...",
    "eventId": "...",
    "amount": 500,
    "outcomeIndex": 0,
    "outcomeLabel": "Yes",
    "createdAt": "2024-01-15T12:00:00.000Z"
  }
}
```

---

### GET /api/events/[slug]/activity
Get recent betting activity for an event (accepts slug or id).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| marketId | string | Filter to specific market |
| limit | number | Max results (default: 15, max: 50) |

**Response:**
```json
{
  "bets": [
    {
      "id": "bet_id",
      "user": {
        "id": "...",
        "name": "User Name",
        "handle": "username",
        "profileImageUrl": "...",
        "isKOL": false
      },
      "market": {
        "id": "...",
        "question": "Who will win?"
      },
      "amount": 100,
      "outcomeIndex": 0,
      "outcomeLabel": "Team A",
      "createdAt": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

---

### GET /api/events/[slug]/kols
Get top KOLs who have bet on an event (accepts slug or id).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| limit | number | Max KOLs (default: 5, max: 10) |

**Response:**
```json
{
  "kols": [
    {
      "kolUserId": "...",
      "handle": "kol_handle",
      "name": "KOL Name",
      "profileImageUrl": "...",
      "totalVolume": 5000,
      "betCount": 12
    }
  ]
}
```

---

### GET /api/leaderboard (Updated)

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| metric | string | `xp`, `pnl`, `volume`, or `creators` |
| period | string | `all`, `monthly`, or `weekly` |
| page | number | Page number (default: 1) |
| pageSize | number | Results per page (default: 25) |

The `creators` metric returns KOL rankings by follower volume with additional fields:
- `followerCount` - Number of followers
- `followerPnL` - Total follower PnL
- `followerVolume` - Total follower volume

---

## Cron Endpoints

### GET /api/cron/daily-kol-competition
Vercel Cron Job - runs daily at midnight UTC.

**Security:** Requires `CRON_SECRET` in Authorization header.

**Actions:**
1. Calculates KOL daily performance based on follower activity
2. Determines winning KOL (highest follower volume)
3. Awards 50,000 MP to winning KOL
4. Awards 5,000 MP to each follower of the winning KOL
5. Creates `DailyKOLSnapshot` records for all participants

**Response:**
```json
{
  "success": true,
  "message": "Competition complete! Winner: KOL Name",
  "summary": {
    "date": "2024-01-15",
    "winner": {
      "id": "user_id",
      "name": "KOL Name",
      "followerVolume": 50000,
      "followerPnL": 5000,
      "xpAwarded": 50000
    },
    "totalParticipants": 10,
    "followersRewarded": 150,
    "totalXpDistributed": 800000,
    "durationMs": 1234
  }
}
```

---

### GET /api/cron/refresh-pnl-snapshot
Vercel Cron Job - runs every 30 minutes.

**Security:** Requires `CRON_SECRET` in Authorization header.

**Actions:**
1. Fetches all users with realized PnL or open positions
2. Calculates total PnL (realized + unrealized) for each user
3. Atomically refreshes the `LeaderboardPnLSnapshot` table
4. Updates `LeaderboardSnapshotMeta` with refresh status

**Purpose:** Pre-computes PnL leaderboard data to improve query performance at scale. The leaderboard API uses this snapshot for "all" period PnL rankings, with automatic fallback to live calculation if no valid snapshot exists.

**Response:**
```json
{
  "success": true,
  "message": "PnL snapshot refreshed successfully",
  "summary": {
    "userCount": 1500,
    "durationMs": 4532,
    "refreshedAt": "2024-01-15T12:30:00.000Z"
  }
}
```

---

## Admin KOL Endpoints

### POST /api/admin/users/[id]/kol
Grant KOL status to a user.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "handle": "username",
    "isKOL": true,
    "kolApprovedAt": "2024-01-15T00:00:00.000Z"
  }
}
```

---

### DELETE /api/admin/users/[id]/kol
Revoke KOL status from a user.

---

### POST /api/admin/kol-competition
Manually trigger daily KOL competition (admin only).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| date | string | ISO date for specific date (optional) |

---

### GET /api/admin/kol-competition
Get recent competition history.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| days | number | Number of days (default: 7) |

---

## Admin Jobs Endpoints

### GET /api/admin/jobs/refresh-pnl-snapshot
Get the current status of the PnL leaderboard snapshot.

**Response:**
```json
{
  "success": true,
  "snapshot": {
    "lastRefresh": "2024-01-15T12:30:00.000Z",
    "userCount": 1500,
    "durationMs": 4532,
    "status": "completed",
    "error": null
  }
}
```

---

### POST /api/admin/jobs/refresh-pnl-snapshot
Manually trigger a PnL snapshot refresh from the admin panel.

**Response:**
```json
{
  "success": true,
  "message": "PnL snapshot refreshed successfully",
  "userCount": 1500,
  "durationMs": 4532,
  "refreshedAt": "2024-01-15T12:30:00.000Z"
}
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [...]
}
```

**Common Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate)
- `500` - Internal Server Error

---

## Predictor Signal Endpoints (markets-web → markets-arena)

These endpoints serve off-chain prediction data from `markets-web` as signals for market makers and admins configuring on-chain markets in `markets-arena`.

### GET /api/signals/market/:id/price-discovery

Returns current off-chain CPMM prices with confidence metrics.

**Response:**
```json
{
  "marketId": "clx...",
  "prices": [0.65, 0.35],
  "outcomes": ["Yes", "No"],
  "uniqueBettors": 127,
  "totalVolume": 85000.00,
  "confidenceScore": 0.82,
  "lastTradeAt": "2026-02-05T12:00:00Z"
}
```

### GET /api/signals/market/:id/volume-heatmap

Returns volume distribution by price bucket (0.05 increments) for CLMM band configuration.

**Response:**
```json
{
  "marketId": "clx...",
  "outcome": 0,
  "buckets": [
    { "priceMin": 0.55, "priceMax": 0.60, "volume": 12500.00, "tradeCount": 45 },
    { "priceMin": 0.60, "priceMax": 0.65, "volume": 28000.00, "tradeCount": 89 },
    { "priceMin": 0.65, "priceMax": 0.70, "volume": 19000.00, "tradeCount": 62 }
  ]
}
```

### GET /api/signals/market/:id/graduation-readiness

Returns composite graduation readiness score with per-criterion breakdown.

**Response:**
```json
{
  "marketId": "clx...",
  "readinessScore": 87,
  "criteria": {
    "virtualVolume": { "value": 72000, "threshold": 50000, "met": true },
    "uniqueBettors": { "value": 89, "threshold": 50, "met": true },
    "priceStability": { "value": 0.08, "threshold": 0.20, "met": true },
    "adminApproval": { "value": false, "threshold": true, "met": false }
  },
  "suggestedParams": {
    "initialPrices": [0.64, 0.36],
    "suggestedLiquidity": 5000,
    "suggestedClmmRange": { "lower": 0.50, "upper": 0.80 }
  }
}
```

### GET /api/signals/markets/candidates

Returns all markets meeting graduation criteria, sorted by readiness.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| minScore | number | Minimum readiness score (default: 70) |
| limit | number | Max results (default: 20) |

**Response:**
```json
{
  "candidates": [
    {
      "marketId": "clx...",
      "question": "Will BTC hit $100k by Q2 2026?",
      "readinessScore": 92,
      "virtualVolume": 120000,
      "uniqueBettors": 203,
      "currentPrices": [0.72, 0.28]
    }
  ]
}
```
