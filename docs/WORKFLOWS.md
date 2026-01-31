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
    ┌────┴────┬────────┐
    │         │        │
    ▼         ▼        ▼
┌───────┐ ┌───────┐ ┌────────┐
│ Sort  │ │Category│ │Bookmarks│
│Options│ │Filter │ │Filter  │
└───┬───┘ └───┬───┘ └───┬────┘
    │         │         │
    └────┬────┴─────────┘
         │
         ▼
┌─────────────────┐
│  Filtered Grid  │
│  Event Cards    │
└─────────────────┘
```

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
- "Daily XP cap reached (50,000 XP)"
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

### Create Market

```
┌─────────────────┐
│  /admin/events  │
└────────┬────────┘
         │
         │ Click "New Event"
         ▼
┌─────────────────┐
│  /admin/events/ │
│  new            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Event Form     │
│  - Title        │
│  - Category     │
│  - Times        │
│  - Banner/Logo  │
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
