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
      "markets": [...]
    }
  ]
}
```

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
| metric | string | `xp`, `pnl`, or `volume` |
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
  "currentUserEntry": {...}
}
```

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
- Max 5 pending requests per user

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
