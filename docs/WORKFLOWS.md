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
│  XP: 0          │
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
   - XP starts at 0
   - Admin role assigned if Twitter ID/email is in allowlist
5. User is redirected back to app with profile card visible

---

## 2. Market Discovery Flow

### Browse and Filter Events

```
┌─────────────────┐
│  Home Page (/)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Filter Bar     │
│  (Status, View, │
│  Category, Sort)│
└────────┬────────┘
         │
    ┌────┼────────────┐
    │    │            │
    ▼    ▼            ▼
┌────────┐ ┌─────────┐ ┌─────────────┐
│Featured│ │Ending   │ │Explore More │
│(6 max) │ │Soon     │ │             │
│3 cols  │ │(<48hrs) │ │ Remaining   │
│desktop │ │4-5 cols │ │ 4-5 cols    │
└────────┘ └─────────┘ └─────────────┘
```

**Home Page Layout:**
1. **Featured Section** (top): Up to 6 events in full-size cards, 3 columns on desktop
2. **Ending Soon Section** (middle): Markets closing within 48 hours, compact cards, 4-5 columns
3. **Explore More Section** (bottom): Remaining events in compact cards, 4-5 columns

**Note:** Sections only appear if they have events to display

**Sort Options:**
- Trending (most activity)
- Ending Soon (closes soonest)
- New (recently published)

**Categories:**
- All, NFL, NBA, NHL, MLB, SOCCER, UFC, TENNIS, GOLF, ESPORTS
- POLITICS, CRYPTO, FINANCE, ENTERTAINMENT, OTHER

**Special Filters:**
- Bookmarks (authenticated users only)

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
│Event  │ │ Filtered   │
│Detail │ │ Home Page  │
└───────┘ └────────────┘
```

---

## 3. Quick Bet Flow

### Place Bet from Landing Page

```
┌─────────────────┐
│  Home Page (/)  │
│  Event Grid     │
└────────┬────────┘
         │
         │ Click "Quick Bet" on event card
         ▼
┌─────────────────────┐
│  Quick Bet Modal    │
│  (Full screen mobile)│
└────────┬────────────┘
         │
         │ If multiple markets
         ▼
┌─────────────────┐
│  Market Select  │
│  List markets   │
└────────┬────────┘
         │
         │ Select market
         ▼
┌─────────────────┐
│  Outcome Select │
│  Yes/No buttons │
└────────┬────────┘
         │
         │ Select outcome
         ▼
┌─────────────────┐
│  Amount Entry   │
│  $100/$500/$1k  │
│  Max button     │
└────────┬────────┘
         │
         │ Enter amount
         ▼
┌─────────────────┐
│  Review & Buy   │
│  Shows quote    │
│  Price impact   │
└────────┬────────┘
         │
         │ Confirm
         ▼
┌─────────────────┐
│  POST /api/     │
│  trades/buy     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Success Modal  │
│  +XP animation  │
│  Share options  │
└─────────────────┘
```

**Key Features:**
- No page navigation required
- Full-screen on mobile devices
- XP animation in header
- Balance updates instantly
- Share to X for bonus XP

### Featured Hero Quick Bet

For the featured event banner:
```
┌─────────────────┐
│  Featured Banner│
│  Click "Bet"    │
└────────┬────────┘
         │
         │ If logged in
         ▼
┌─────────────────┐
│  Quick Bet Modal│
│  Skip market    │
│  selection      │
│  (go direct to  │
│   outcome step) │
└─────────────────┘
         │
         │ If not logged in
         ▼
┌─────────────────┐
│  Login Modal    │
│  via Privy      │
└─────────────────┘
```

---

## 4. Full Betting Flow (Market Page)

### Place a Bet

```
┌─────────────────┐
│  Event Detail   │
│  /m/[slug]      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Betting Panel  │
│  Select Outcome │
│  [Yes] or [No]  │
└────────┬────────┘
         │
         │ (If not authenticated → Sign In)
         ▼
┌─────────────────┐
│  Enter Amount   │
│  Quick presets: │
│  $100/$500/$1k  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Toggle: Buy/Sell│
│  Show quote     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  POST /api/     │
│  trades/buy     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Success Modal  │
│  Bet ticket     │
│  Share options  │
│  +XP animation  │
└─────────────────┘
```

### Success Modal Features

After successful bet:
- Bet ticket with details (market, pick, amount, odds)
- "Share on X" button (earn +50 XP)
- Download ticket image
- Copy link button
- "Continue Browsing" to close
- XP and Balance animations in header

---

## 5. Bookmarking Flow

### Add Bookmark

```
┌─────────────────┐
│  Event Card     │
│  (Home page)    │
└────────┬────────┘
         │
         │ Click bookmark icon
         ▼
┌─────────────────┐
│  If logged in   │
│  POST /api/     │
│  bookmarks      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Icon fills     │
│  Optimistic UI  │
└─────────────────┘

         OR

┌─────────────────┐
│  If logged out  │
│  Login Modal    │
└─────────────────┘
```

### View Bookmarks

```
┌─────────────────┐
│  Home Page      │
│  Filter: "Bookmarks"│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Filtered Grid  │
│  Only bookmarked│
│  events         │
└─────────────────┘

      OR

┌─────────────────┐
│  /profile       │
│  Bookmarks Tab  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Bookmark List  │
│  Remove option  │
└─────────────────┘
```

---

## 6. Profile Management

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
    ┌────┼────┬────┬────┐
    │    │    │    │    │
    ▼    ▼    ▼    ▼    ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│Posit-││Activ-││Book- ││Reque-││Setti-│
│ions  ││ity   ││marks ││sts   ││ngs   │
└──────┘└──────┘└──────┘└──────┘└──────┘
```

**Positions Tab:**
- Active positions with current value
- P&L per position
- Sell/redeem options
- Market status indicators

**Activity Tab:**
- Recent bets list
- Transaction history
- Bet status (Confirmed, Won, Lost)

**Bookmarks Tab:**
- Saved events
- Quick navigate to event
- Remove bookmark option

**Requests Tab:**
- Submitted market requests
- Request status tracking
- Admin response notes
- "New Request" button

**Settings Tab:**
- Edit handle and display name
- Profile image URL
- Referral link and code
- Friends invited count
- Share referral on X
- Captain selection (KOL team)
  - If the user has no captain, the profile header shows a **"Choose a Captain"** button which opens the captain picker modal
  - On desktop, a pulsing captain icon button appears in the bottom-right. Clicking it opens the same modal.
  - Captain choice is a **one-time selection** (cannot be changed after set)
  - Being under a captain rolls your activity into team totals and can earn MP bonuses when your captain wins the daily competition

---

## 7. XP Animation Flow

### On Bet Placement

```
┌─────────────────┐
│  Place Bet      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API returns    │
│  xpAwarded      │
└────────┬────────┘
         │
         ├──────────────────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐  ┌─────────────────┐
│  Header XP      │  │  Header Balance │
│  +1000 XP       │  │  -$100          │
│  (green, float  │  │  (red, float    │
│   up animation) │  │   up animation) │
└─────────────────┘  └─────────────────┘
```

### XP Protection Feedback

```
┌─────────────────┐
│  Place Bet      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Check XP Status│
└────────┬────────┘
         │
    ┌────┼────┬────┐
    │    │    │    │
    ▼    ▼    ▼    ▼
┌──────┐┌────────┐┌─────────┐┌──────────┐
│Full  ││Cooldown││Diminish-││Daily Cap │
│XP    ││Active  ││ing      ││Reached   │
│      ││        ││Returns  ││          │
│+1000 ││+0 XP   ││+600 XP  ││+0 XP     │
│XP    ││(reason ││(60%     ││(reason   │
│      ││shown)  ││rate)    ││shown)    │
└──────┘└────────┘└─────────┘└──────────┘
```

**XP Reasons Shown:**
- "Daily XP cap reached (100,000 XP)"
- "Market cooldown active"
- "Diminishing returns: 60% (tier 2)"
- "Volume cap reached for this market"

---

## 8. Sell Position Flow

### From Profile Page

```
┌─────────────────┐
│  Profile        │
│  Positions Tab  │
└────────┬────────┘
         │
         │ Click "Sell"
         ▼
┌─────────────────┐
│  Sell Modal     │
│  - Share count  │
│  - Current price│
│  - Proceeds     │
└────────┬────────┘
         │
         │ Confirm
         ▼
┌─────────────────┐
│  POST /api/     │
│  trades/sell    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Balance Update │
│  +$XXX animation│
│  (green)        │
│  No XP awarded  │
└─────────────────┘
```

### From Market Page

```
┌─────────────────┐
│  Market Page    │
│  Betting Panel  │
└────────┬────────┘
         │
         │ Toggle to "Sell"
         ▼
┌─────────────────┐
│  Enter shares   │
│  Shows proceeds │
└────────┬────────┘
         │
         │ Confirm
         ▼
┌─────────────────┐
│  POST /api/     │
│  trades/sell    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Balance Update │
│  +$XXX (green)  │
│  No XP (by design)│
└─────────────────┘
```

---

## 9. Redeem Winnings Flow

### Claim Settled Positions

```
┌─────────────────┐
│  Profile        │
│  Positions Tab  │
└────────┬────────┘
         │
         │ See "Claim" button on settled position
         ▼
┌─────────────────┐
│  Redeem Modal   │
│  - Winning shares│
│  - Payout amount│
│  - P&L          │
└────────┬────────┘
         │
         │ Confirm
         ▼
┌─────────────────┐
│  POST /api/     │
│  me/redeem      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Balance Update │
│  +$XXX animation│
│  Position marked│
│  as claimed     │
└─────────────────┘
```

---

## 10. Referral Flow

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
│  - Platform info│
│  - XP bonus info│
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
┌─────────────────────────┐
│  POST /api/referral/claim│
│  - Creates referral link │
│  - Awards 10,000 XP to   │
│    both users            │
│  - Logs to XPLedger      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│  Redirect to /  │
│  XP Animation:  │
│  +10,000 XP     │
└─────────────────┘
```

---

## 11. Market Request Flow (KOL Feature)

### Submit a Market Request

```
┌─────────────────┐
│  /profile       │
│  Profile Page   │
└────────┬────────┘
         │
         │ Click "Request Market" button
         ▼
┌─────────────────┐
│  Request Modal  │
│  - Title        │
│  - Description  │
│  - Source URL   │
│    (optional)   │
└────────┬────────┘
         │
         │ Submit
         ▼
┌─────────────────┐
│  POST /api/     │
│  market-requests│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Success Toast  │
│  Request saved  │
│  Status: PENDING│
└─────────────────┘
```

### Track Request Status

```
┌─────────────────┐
│  /profile       │
│  Requests Tab   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Request List   │
│  - Title        │
│  - Status badge │
│  - Admin notes  │
│  - Date         │
└─────────────────┘
```

**Request Statuses:**
- 🟡 **Pending**: Awaiting admin review
- 🟢 **Approved**: Request accepted, market will be created
- 🔴 **Rejected**: Request declined (with admin notes)
- ✨ **Created**: Market has been created from this request

---

## 12. Admin Workflows

### Create Market (with Clone Option)

```
┌─────────────────┐
│  /admin/events  │
└────────┬────────┘
         │
         │ Click "New Event"
         ▼
┌─────────────────┐
│  Clone Selector │
│  - Create Fresh │
│  - Clone Existing│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌────────────────┐
│Start  │ │Select Event    │
│Fresh  │ │to Clone        │
└───┬───┘ └───────┬────────┘
    │             │
    │             │ Pre-fill form
    │             │ with cloned data
    └──────┬──────┘
           │
           ▼
┌─────────────────┐
│  Event Form     │
│  - Title (Copy) │
│  - Category     │
│  - Times        │
│  - Banner/Logo  │
│  - Tags         │
└────────┬────────┘
         │
         │ Submit
         ▼
┌─────────────────┐
│  Add Markets    │
│  - Question     │
│  - Outcomes     │
│  - Dates        │
│  - Details      │
└────────┬────────┘
         │
         │ Publish
         ▼
┌─────────────────┐
│  Event & Markets│
│  Live on site   │
└─────────────────┘
```

**Clone Features:**
- Select existing event/market to use as template
- Pre-fills form with cloned data (title appended with "(Copy)")
- Generates unique slug automatically
- Tags and settings are copied
- Dates are not copied (should be set fresh)
- First market from event is also cloned

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
- **Publish**: Make event/market visible and open for betting
- **Close**: Stop accepting new bets
- **Resolve**: Set winning outcome
- **Settle**: Process payouts to winners

### XP Configuration

```
┌─────────────────┐
│  /admin/xp      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Config Panel   │
│  - XP per dollar│
│  - Daily cap    │
│  - Cooldown     │
│  - Volume thresh│
└────────┬────────┘
         │
         │ Update values
         ▼
┌─────────────────┐
│  POST /api/     │
│  admin/xp/config│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stats Panel    │
│  - Total XP     │
│  - Active users │
│  - Daily activity│
└─────────────────┘
```

### Review Market Requests

**Quick Review:**
```
┌─────────────────┐
│  /admin/requests│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Request Table  │
│  Click "Review" │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Review Dialog  │
│  - Set status   │
│  - Add notes    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PATCH /api/    │
│  admin/requests │
└─────────────────┘
```

**Full Review (Create Event):**
```
┌─────────────────┐
│  /admin/requests│
│  /[id]          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Full Form      │
│  - Event fields │
│  - Markets      │
│  - Status update│
└────────┬────────┘
         │
         │ Create
         ▼
┌─────────────────┐
│  Event created  │
│  Request → CREATED│
│  Redirect to    │
│  event page     │
└─────────────────┘
```

---

## 13. Leaderboard

```
┌─────────────────┐
│  /leaderboard   │
└────────┬────────┘
         │
    ┌────┼────┬────┐
    │    │    │    │
    ▼    ▼    ▼    ▼
┌───────┐┌───────┐┌───────┐
│ XP    ││ PnL   ││Volume │
│Tab    ││Tab    ││Tab    │
└───┬───┘└───┬───┘└───┬───┘
    │        │        │
    └────┬───┴────────┘
         │
         ▼
┌─────────────────┐
│  Period Select  │
│  All/Month/Week │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Ranked Users   │
│  1. 🥇 User A   │
│  2. 🥈 User B   │
│  3. 🥉 User C   │
│  4.    User D   │
│  ...            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Your Position  │
│  (always shown) │
└─────────────────┘
```

**Features:**
- Top 3 with medal styling
- Animated row entrance
- Hover effects
- User avatars and stats
- Search users
- Pagination
- Current user always visible
- Tabs include: XP (MP), PnL, Volume, Captains (Team Stats), Referrals
- Team Stats view (Captains)
  - Captains are ranked by follower (team) totals
  - Vol and PnL shown are based on combined follower performance (not the captain alone)

---

## 14. Dev Tools (Development Only)

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
│  - User dropdown│
│  - Impersonate  │
└────────┬────────┘
         │
         │ Select & impersonate
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

---

## 15. Automated crypto market lifecycle

Crypto price markets (Over/Under the opening price) are created and fully resolved by crons. No manual steps are required after config is set.

**Setup (admin):** Create one or more `AutoMarketConfig` entries via `POST /api/admin/auto-market-configs` (token symbol, CoinGecko id, timeframe: 1 / 5 / 15 / 60 / 360 minutes, optional chain label, fee/liquidity). Configs can be toggled with `PATCH .../auto-market-configs/[id]` (e.g. `isActive: false`).

**Create cron (every 5 min):** For each active config whose timeframe window is due, the cron fetches the current token price from CoinGecko, creates an event and a binary market (Over/Under the opening price; outcomes are e.g. "Over $97,500" / "Under $97,500"), stores the opening price on the market, and publishes the market (OPEN). Event slug is unique per token/timeframe/window (e.g. `btc-15min-2026-02-06-1445`).

**Process cron (every minute):** Finds OPEN markets that have `autoMarketConfigId` and `closesAt` in the past. For each: fetches closing price from CoinGecko, closes the market (refunds any pending bets), resolves (Over wins if closing price ≥ opening price, else Under wins), then settles (marks bets WON/LOST, creates raffle entries, referral bonuses). Users redeem winnings via the normal redeem flow.

**Flow summary:** Config → Create cron (event + market + publish) → OPEN → users bet → Process cron (close → resolve → settle) → SETTLED → users redeem.

---

## Market Graduation Workflow

Markets graduate from `markets-web` (free-to-play) to `markets-arena` (real money on-chain).

```
┌──────────────────────────────────────────────────────────┐
│  MARKETS-WEB (Free-to-Play)                              │
│                                                          │
│  1. Admin creates market (DRAFT → PUBLISHED → OPEN)      │
│  2. Users trade with virtual balance                     │
│  3. Volume, unique bettors, price stability tracked      │
│  4. Market hits graduation criteria:                     │
│     - $50k+ virtual volume                               │
│     - 50+ unique bettors                                 │
│     - Price stability (< 20% swing in 24h)               │
│  5. Flagged as graduation candidate                      │
└──────────────────────┬───────────────────────────────────┘
                       │ Admin reviews / approves
                       ▼
┌──────────────────────────────────────────────────────────┐
│  GRADUATION (Backend)                                    │
│                                                          │
│  1. Reads off-chain CPMM prices + volume data            │
│  2. Calls VaultMarket.createEvent() (if new event)       │
│  3. Calls VaultMarket.createMarket() with:               │
│     - initialPrices seeded from off-chain CPMM prices    │
│     - initialLiquidity from protocol vault / creator credit│
│     - OracleConfig if applicable                         │
│  4. Market is now Active on-chain                        │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  MARKETS-ARENA (Real Money)                              │
│                                                          │
│  - Market appears for real-money USDC trading            │
│  - FPMM / CLMM / CLOB venues available                  │
│  - Off-chain market optionally stays live as predictor   │
└──────────────────────────────────────────────────────────┘
```

---

## User Graduation Workflow

Users graduate from free-to-play to real-money trading.

```
┌─────────────────────────────────────────────────────────┐
│  MARKETS-WEB USER                                       │
│                                                         │
│  1. Signs up with Twitter OAuth (Privy)                 │
│  2. Gets $10,000 virtual balance                        │
│  3. Trades, earns XP, builds streaks                    │
│  4. Builds reputation (KOL status, referrals)           │
└──────────────────────┬──────────────────────────────────┘
                       │ User clicks "Go Real" / connects wallet
                       ▼
┌─────────────────────────────────────────────────────────┐
│  WALLET ONBOARDING                                      │
│                                                         │
│  1. Privy creates embedded wallet (or user connects     │
│     external wallet like MetaMask)                      │
│  2. VaultCredit.registerProfile() creates on-chain      │
│     identity (same Privy userId links both accounts)    │
│  3. Off-chain XP/streak/KOL status informs on-chain     │
│     ProfileStatus tier (affects credit limits)          │
│  4. Virtual balance does NOT carry over                 │
│  5. User must deposit USDC for real trading             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  MARKETS-ARENA USER                                     │
│                                                         │
│  - Trades with real USDC on-chain                       │
│  - Positions are ERC-1155 outcome tokens                │
│  - PnL is real                                          │
│  - Can still use markets-web for free-to-play           │
└─────────────────────────────────────────────────────────┘
```
