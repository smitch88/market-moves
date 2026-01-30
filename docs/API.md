# Vault Markets - API Reference

All API routes are located in `/apps/markets-web/src/app/api/`.

---

## Authentication

Most endpoints require authentication via Privy JWT token. The token is automatically sent via:
- `privy-token` cookie (set by Privy SDK)
- `Authorization: Bearer <token>` header

---

## Public Endpoints

### GET /api/markets
Fetch published markets with optional filtering.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| category | string | Filter by category |
| status | string | Filter by status |
| limit | number | Max results (default: 20) |

**Response:**
```json
{
  "markets": [
    {
      "id": "clx...",
      "slug": "super-bowl-winner",
      "title": "Super Bowl LVIII Winner",
      "category": "NFL",
      "status": "OPEN",
      "outcomes": [...],
      "_count": { "bets": 42 }
    }
  ]
}
```

---

### GET /api/markets/[slug]
Fetch single market by slug.

**Response:**
```json
{
  "id": "clx...",
  "slug": "super-bowl-winner",
  "title": "Super Bowl LVIII Winner",
  "question": "Who will win?",
  "category": "NFL",
  "status": "OPEN",
  "outcomes": [
    { "id": "...", "key": "A", "label": "Chiefs" },
    { "id": "...", "key": "B", "label": "49ers" }
  ],
  "detailsMarkdown": "...",
  "closesAt": "2024-02-11T23:59:00Z"
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

**Response:**
```json
{
  "markets": [...],
  "query": "super bowl",
  "count": 3
}
```

---

### GET /api/leaderboard
Fetch user leaderboard sorted by balance.

**Response:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "id": "user_id",
      "handle": "username",
      "name": "Display Name",
      "profileImageUrl": "https://...",
      "balance": 25000
    }
  ]
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
  "profileImageUrl": "https://...",
  "role": "USER",
  "balance": 10000,
  "referralCode": "abc123",
  "_count": { "referralsGiven": 5 }
}
```

---

### POST /api/bets
Place a new bet.

**Request Body:**
```json
{
  "marketId": "market_id",
  "outcomeKey": "A",
  "amount": 100
}
```

**Response:**
```json
{
  "bet": {
    "id": "bet_id",
    "amount": 100,
    "status": "PENDING_TWEET"
  }
}
```

**Errors:**
| Code | Message |
|------|---------|
| 400 | Market is not open for betting |
| 400 | Insufficient balance |
| 404 | Market not found |
| 403 | Account is locked |

---

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
  "marketLink": "https://vault.markets/markets/..."
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

**Response (Success):**
```json
{
  "verified": true,
  "tweetId": "123456789",
  "message": "Tweet verified successfully!"
}
```

**Response (Failure):**
```json
{
  "verified": false,
  "message": "Tweet not found or does not match required content"
}
```

---

### GET /api/users/[id]/activity
Get user betting activity.

**Response:**
```json
{
  "bets": [
    {
      "id": "bet_id",
      "amount": 100,
      "status": "CONFIRMED",
      "market": { "title": "...", "slug": "..." },
      "outcome": { "label": "Yes" }
    }
  ],
  "positions": [...]
}
```

---

### POST /api/referral/claim
Claim a referral code after signup. Awards 10,000 XP to both the referrer and the referred user (equivalent to placing a $1,000 bet).

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

**Notes:**
- Both users receive 10,000 XP immediately upon claiming
- XP is logged in the XPLedger with reason `REFERRAL_BONUS`
- Each user can only claim one referral (cannot be referred by multiple users)
- Users cannot refer themselves

---

## Market Request Endpoints

### POST /api/market-requests
Create a new market request.

**Request Body:**
```json
{
  "title": "Will Bitcoin reach $100k by 2026?",
  "description": "I think this would be a great market because...",
  "sourceUrl": "https://polymarket.com/..."
}
```

**Response:**
```json
{
  "id": "req_id",
  "title": "Will Bitcoin reach $100k by 2026?",
  "description": "...",
  "sourceUrl": "https://...",
  "status": "PENDING",
  "createdAt": "2024-01-30T..."
}
```

**Validation:**
- Title: 5-200 characters
- Description: 20-2000 characters
- sourceUrl: Optional, must be valid URL
- Max 5 pending requests per user

---

### GET /api/me/market-requests
Get all market requests for the current user.

**Response:**
```json
[
  {
    "id": "req_id",
    "title": "Request title",
    "description": "...",
    "sourceUrl": "https://...",
    "status": "PENDING",
    "adminNotes": null,
    "reviewedAt": null,
    "createdAt": "2024-01-30T...",
    "reviewer": null
  }
]
```

---

## Admin Endpoints

All admin endpoints require `role: "ADMIN"`.

### GET /api/admin/markets
List all markets (including drafts).

### POST /api/admin/markets
Create new market.

**Request Body:**
```json
{
  "title": "Market Title",
  "question": "Question?",
  "category": "NFL",
  "outcomeALabel": "Yes",
  "outcomeBLabel": "No",
  "closesAt": "2024-12-31T23:59:00Z",
  "detailsMarkdown": "..."
}
```

### GET /api/admin/markets/[id]
Get market details (admin view).

### PUT /api/admin/markets/[id]
Update market.

### DELETE /api/admin/markets/[id]
Delete market (draft only).

### POST /api/admin/markets/[id]/publish
Publish market (DRAFT → PUBLISHED).

### POST /api/admin/markets/[id]/close
Close market (OPEN → CLOSED).

### POST /api/admin/markets/[id]/resolve
Resolve market with winning outcome.

**Request Body:**
```json
{
  "winningOutcomeKey": "A"
}
```

### POST /api/admin/markets/[id]/settle
Process payouts for resolved market.

---

### GET /api/admin/requests
List all market requests.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| pageSize | number | Results per page (default: 20) |
| status | string | Filter by status (PENDING, APPROVED, REJECTED, CREATED) |
| search | string | Search in title, description, or user |
| sortBy | string | Sort field (createdAt, status, title) |
| sortOrder | string | asc or desc |

**Response:**
```json
{
  "requests": [
    {
      "id": "req_id",
      "title": "Request title",
      "description": "...",
      "sourceUrl": "https://...",
      "status": "PENDING",
      "adminNotes": null,
      "reviewedAt": null,
      "createdAt": "2024-01-30T...",
      "user": {
        "id": "user_id",
        "name": "User Name",
        "handle": "username",
        "profileImageUrl": "https://..."
      },
      "reviewer": null
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

---

### GET /api/admin/requests/[id]
Get a single market request by ID.

---

### PATCH /api/admin/requests/[id]
Update a market request status.

**Request Body:**
```json
{
  "status": "APPROVED",
  "adminNotes": "Great idea! We'll create this market soon."
}
```

**Response:**
```json
{
  "id": "req_id",
  "title": "Request title",
  "status": "APPROVED",
  "adminNotes": "Great idea!...",
  "reviewedAt": "2024-01-30T...",
  "reviewer": {
    "id": "admin_id",
    "name": "Admin Name",
    "handle": "admin"
  }
}
```

---

## Dev Endpoints (Development Only)

### GET /api/dev/impersonate
Get current impersonation state.

### POST /api/dev/impersonate
Start impersonating a user.

**Request Body:**
```json
{
  "twitterId": "123456789"
}
```

### DELETE /api/dev/impersonate
Stop impersonating.

### GET /api/dev/users
List all users for dev tools.

---

## Resolution Sources (Public)

### GET /api/resolution-sources

List all active, public resolution sources.

**Response:**
```json
{
  "sources": [
    {
      "id": "string",
      "slug": "vault-markets",
      "name": "Vault Markets Official",
      "description": "Official resolution source...",
      "type": "INTERNAL | EXTERNAL | HYBRID",
      "logoUrl": "string | null",
      "websiteUrl": "string | null",
      "apiUrl": "/api/resolution-sources/vault-markets",
      "dataUrl": "/api/resolution-sources/vault-markets/data",
      "marketCount": 10,
      "verifiedDataPointCount": 25
    }
  ],
  "meta": {
    "total": 1,
    "apiVersion": "1.0"
  }
}
```

### GET /api/resolution-sources/:slug

Get details about a specific resolution source including recent data points.

### GET /api/resolution-sources/:slug/data

Get all verified data points for a resolution source.

**Query Parameters:**
- `key` - Filter by specific key
- `marketId` - Filter by linked market
- `since` - ISO date string to filter by effective date
- `limit` - Max results (default 100, max 500)

**Response:**
```json
{
  "source": {
    "slug": "vault-markets",
    "name": "Vault Markets Official",
    "type": "INTERNAL"
  },
  "dataPoints": [
    {
      "key": "superbowl_lix_winner",
      "label": "Super Bowl LIX Winner",
      "value": "Kansas City Chiefs",
      "rawValue": "Kansas City Chiefs",
      "valueType": "string",
      "effectiveAt": "2026-02-09T00:00:00Z",
      "verifiedAt": "2026-02-09T23:30:00Z",
      "linkedMarket": {
        "id": "market_id",
        "question": "Who will win Super Bowl LIX?",
        "url": "/events/super-bowl-lix"
      }
    }
  ],
  "meta": {
    "total": 1,
    "apiVersion": "1.0"
  }
}
```

### GET /api/resolution-sources/:slug/data/:key

Get a specific data point by key. This is the primary endpoint for external systems to fetch resolution data.

**Response:**
```json
{
  "source": {
    "slug": "vault-markets",
    "name": "Vault Markets Official",
    "type": "INTERNAL"
  },
  "data": {
    "key": "superbowl_lix_winner",
    "label": "Super Bowl LIX Winner",
    "value": "Kansas City Chiefs",
    "rawValue": "Kansas City Chiefs",
    "valueType": "string",
    "effectiveAt": "2026-02-09T00:00:00Z",
    "verifiedAt": "2026-02-09T23:30:00Z"
  },
  "linkedMarket": {
    "id": "market_id",
    "question": "Who will win Super Bowl LIX?",
    "status": "RESOLVED",
    "resolvedOutcome": 0,
    "outcomes": ["Kansas City Chiefs", "Philadelphia Eagles"]
  },
  "meta": {
    "apiVersion": "1.0",
    "fetchedAt": "2026-02-10T12:00:00Z"
  }
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

Common error codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
