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
Claim a referral code after signup.

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
  }
}
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
