# Vault Markets - User Workflows

This document describes all user journeys and workflows in the Vault Markets application.

---

## 1. Authentication Flow

### Sign In with X (Twitter)

```
┌─────────────────┐
│  Landing Page   │
│  (Unauthenticated)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Click "Sign In"│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Privy Modal    │
│  X OAuth Flow   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Twitter Auth   │
│  Authorize App  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Provisioned│
│  Balance: $10,000│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Authenticated  │
│  Profile Card   │
└─────────────────┘
```

**Steps:**
1. User clicks "Sign In" button in header
2. Privy authentication modal opens
3. User authenticates via X (Twitter) OAuth
4. On first login, user is automatically provisioned:
   - Assigned unique ID and referral code
   - Given initial balance of $10,000
   - Admin role assigned if Twitter ID is in allowlist
5. User is redirected back to app with profile card visible

---

## 2. Market Discovery Flow

### Browse and Filter Markets

```
┌─────────────────┐
│  Home Page (/)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│ Sort  │ │Category│
│Filters│ │Filters│
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  Filtered Grid  │
│  Market Cards   │
└─────────────────┘
```

**Sort Options:**
- Trending (most bets)
- Ending Soon (closes soonest)
- New (recently published)

**Categories:**
- All
- NFL / NBA / UFC
- Entertainment
- Politics
- Crypto

### Search Markets

```
┌─────────────────┐
│  Search Bar     │
│  (Header)       │
└────────┬────────┘
         │
         │ Type query (min 2 chars)
         ▼
┌─────────────────┐
│  Debounced API  │
│  Call (300ms)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Dropdown Shows │
│  Matching Markets│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌────────────┐
│ Click │ │ Press Enter│
│Result │ │ Full Search│
└───┬───┘ └─────┬──────┘
    │           │
    ▼           ▼
┌───────┐ ┌────────────┐
│Market │ │ Filtered   │
│Detail │ │ Home Page  │
└───────┘ └────────────┘
```

---

## 3. Betting Flow

### Place a Bet

```
┌─────────────────┐
│  Market Detail  │
│  /markets/[slug]│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Betting Panel  │
│  Select Outcome │
│  [A] or [B]     │
└────────┬────────┘
         │
         │ (If not authenticated → Sign In)
         ▼
┌─────────────────┐
│  Enter Amount   │
│  Quick presets: │
│  $100/$500/$1k/Max│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  POST /api/bets │
│  Reserve Balance│
│  Status: PENDING│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tweet Step     │
│  "Post on X"    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  X Intent Opens │
│  Pre-filled Tweet│
└────────┬────────┘
         │
         │ User posts tweet
         ▼
┌─────────────────┐
│  Verify Step    │
│  Click "Verify" │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Checks     │
│  User Timeline  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│Found  │ │Not    │
│       │ │Found  │
└───┬───┘ └───┬───┘
    │         │
    ▼         ▼
┌───────┐ ┌───────────┐
│SUCCESS│ │ Retry or  │
│MODAL  │ │ Paste URL │
└───────┘ └───────────┘
```

### Success Modal

After successful bet confirmation:
- 🏆 Trophy icon with celebration animation
- Bet details (market, pick, amount)
- Share buttons:
  - "Post on X" - Share your prediction
  - Copy link button
- "Continue Browsing" to close

---

## 4. Profile Management

### View Profile

```
┌─────────────────┐
│  Click Profile  │
│  Card (Header)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Dropdown Menu  │
│  - Profile      │
│  - Invite Friends│
│  - Sign Out     │
└────────┬────────┘
         │
         │ Click "Profile"
         ▼
┌─────────────────┐
│  /profile       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│Activity│ │Settings│
│  Tab  │ │  Tab   │
└───────┘ └───────┘
```

**Activity Tab:**
- Recent bets list
- Open positions
- Bet history with status

**Settings Tab:**
- Account info (handle, email)
- Referral link and code
- Friends invited count
- Share on X button

---

## 5. Referral Flow

### Invite Friends

```
┌─────────────────┐
│  Profile Card   │
│  Dropdown Menu  │
└────────┬────────┘
         │
         │ Click "Invite Friends"
         ▼
┌─────────────────┐
│  Invite Modal   │
│  - Friends count│
│  - Referral link│
│  - Referral code│
│  - Share buttons│
└─────────────────┘
```

### Join via Referral

```
┌─────────────────┐
│  /r/[code]      │
│  Referral Page  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Shows Referrer │
│  - Avatar       │
│  - Name/Handle  │
│  - Platform benefits│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Code stored in │
│  localStorage   │
└────────┬────────┘
         │
         │ Click "Join with X"
         ▼
┌─────────────────┐
│  Privy Auth     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  POST /api/     │
│  referral/claim │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redirect to /  │
│  Referral linked│
└─────────────────┘
```

---

## 6. Admin Workflows

### Create Market

```
┌─────────────────┐
│  /admin/markets │
└────────┬────────┘
         │
         │ Click "New Market"
         ▼
┌─────────────────┐
│  /admin/markets/│
│  new            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Market Form    │
│  - Title        │
│  - Question     │
│  - Category     │
│  - Outcomes A/B │
│  - Dates        │
│  - Logo/Banner  │
│  - Details (MD) │
└────────┬────────┘
         │
         │ Submit
         ▼
┌─────────────────┐
│  Market Created │
│  Status: DRAFT  │
└─────────────────┘
```

### Market Lifecycle

```
DRAFT → PUBLISHED → OPEN → CLOSED → RESOLVED → SETTLED
  │         │         │        │         │
  │         │         │        │         └── Payouts distributed
  │         │         │        └── Winning outcome set
  │         │         └── Betting closed
  │         └── Visible, betting open
  └── Not visible
```

**Admin Actions:**
- **Publish**: Make market visible and open for betting
- **Close**: Stop accepting new bets
- **Resolve**: Set winning outcome
- **Settle**: Process payouts to winners

### Manage Users

```
┌─────────────────┐
│  /admin/users   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Table     │
│  - Handle       │
│  - Balance      │
│  - Role         │
│  - Created date │
└─────────────────┘
```

---

## 7. Leaderboard

```
┌─────────────────┐
│  /leaderboard   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Ranked Users   │
│  by Balance     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  1. 🥇 User A   │
│  2. 🥈 User B   │
│  3. 🥉 User C   │
│  4.    User D   │
│  ...            │
└─────────────────┘
```

**Features:**
- Top 3 with medal icons
- Animated row entrance
- Hover effects
- User avatars and balances

---

## 8. Dev Tools (Development Only)

### User Impersonation

```
┌─────────────────┐
│  Floating Bug   │
│  Icon (bottom)  │
└────────┬────────┘
         │
         │ Click to expand
         ▼
┌─────────────────┐
│  Dev Tools Panel│
│  - Twitter ID   │
│  - User dropdown│
│  - Impersonate  │
└────────┬────────┘
         │
         │ Select user & click Impersonate
         ▼
┌─────────────────┐
│  Cookie Set     │
│  Page Reloads   │
│  Amber badge    │
└─────────────────┘
```

**While Impersonating:**
- Amber "Impersonating" badge in header
- All API calls use impersonated user
- "Stop Impersonating" in profile dropdown
