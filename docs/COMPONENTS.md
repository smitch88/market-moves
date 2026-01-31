# Vault Markets - Component Library

The `@vault/ui` package provides shared UI components used across the application.

---

## Installation

```tsx
import { Button, GlassCard, toast } from "@vault/ui";
```

---

## Core Components

### Button

Standard button with variants.

```tsx
import { Button } from "@vault/ui";

<Button variant="default">Primary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
```

**Props:**
| Prop | Type | Default |
|------|------|---------|
| variant | "default" \| "outline" \| "ghost" \| "destructive" | "default" |
| size | "sm" \| "default" \| "lg" \| "icon" | "default" |
| disabled | boolean | false |

---

### Input

Form input field.

```tsx
import { Input } from "@vault/ui";

<Input type="text" placeholder="Enter text" />
<Input type="number" min={0} max={100} />
<Input type="search" />
```

---

### Badge

Status badges and tags.

```tsx
import { Badge } from "@vault/ui";

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Destructive</Badge>
```

---

### Skeleton

Loading placeholder.

```tsx
import { Skeleton } from "@vault/ui";

<Skeleton className="h-4 w-[200px]" />
<Skeleton className="h-12 w-full" />
```

---

### Select

Dropdown select component.

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vault/ui";

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

---

## Glass Components

### GlassCard

Glassmorphic card with backdrop blur.

```tsx
import { 
  GlassCard, 
  GlassCardHeader, 
  GlassCardContent, 
  GlassCardFooter 
} from "@vault/ui";

<GlassCard variant="default">
  <GlassCardHeader>
    <h2>Title</h2>
  </GlassCardHeader>
  <GlassCardContent>
    Content here
  </GlassCardContent>
  <GlassCardFooter>
    Footer actions
  </GlassCardFooter>
</GlassCard>
```

**Variants:**
- `default` - Standard glass effect
- `elevated` - More prominent shadow

---

## Dialog Components

### Dialog

Modal dialog.

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@vault/ui";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button>Action</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Dropdown Menu

### DropdownMenu

Context menu / dropdown.

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@vault/ui";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Option 1</DropdownMenuItem>
    <DropdownMenuItem>Option 2</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Option 3</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Tabs

### Tabs

Tab navigation.

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@vault/ui";

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

---

## Avatar

### Avatar

User avatar with fallback.

```tsx
import { Avatar, AvatarImage, AvatarFallback } from "@vault/ui";

<Avatar>
  <AvatarImage src="https://..." alt="User" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

---

## Toast Notifications

### toast

Sonner toast notifications with theme support.

```tsx
import { toast } from "@vault/ui";

// Success
toast.success("Operation completed!");

// Error
toast.error("Something went wrong");

// Warning
toast.warning("Please check your input");

// Info
toast.info("New feature available");

// With description
toast.success("Saved", {
  description: "Your changes have been saved"
});
```

**Setup:**
Add `<ThemedToaster />` to your root layout:

```tsx
// In layout.tsx
import { ThemedToaster } from "@/components/providers/themed-toaster";

<ThemedToaster />
```

**Features:**
- Position: bottom-center
- Auto theme detection (light/dark)
- Rich colors
- Close button
- Modern styling

---

## Custom Components

### QuickBetModal

Modal for placing bets from the landing page.

```tsx
import { QuickBetModal } from "@/components/events/quick-bet-modal";

<QuickBetModal
  event={event}
  isOpen={isOpen}
  onClose={onClose}
  skipMarketSelection={false}
  initialMarketId={marketId}
/>
```

**Features:**
- Multi-step flow (market → outcome → amount)
- Full-screen on mobile
- XP animation integration
- Success modal with sharing

---

### XP Animation Components

Real-time XP and balance change animations.

```tsx
import { XPAnimationProvider, useXPAnimation } from "@/components/layout/xp-animation";

// Wrap your app
<XPAnimationProvider>
  <App />
</XPAnimationProvider>

// Use in components
const { queueXPGain, queueBalanceChange, flushQueue } = useXPAnimation();

// Queue animations
queueXPGain(1000);           // +1000 XP (green)
queueBalanceChange(-100);    // -$100 (red)
queueBalanceChange(500);     // +$500 (green)

// Flush queue when modal closes
flushQueue();
```

**Display Components:**

```tsx
import { AnimatedXPDisplay, AnimatedBalanceDisplay } from "@/components/layout/xp-animation";

// In header
<AnimatedXPDisplay />
<AnimatedBalanceDisplay />
```

**Animation Features:**
- Float-up animation
- Color-coded (green/red)
- Queue system for batching
- Flush control for modals

---

### ProfileCard

User profile dropdown in header.

```tsx
import { ProfileCard } from "@/components/layout/profile-card";

<ProfileCard />
```

**Features:**
- Avatar and balance display
- XP level indicator
- Dropdown menu (Profile, Invite, Sign Out)

---

### EventCard

Event grid card with Quick Bet and Bookmark.

```tsx
import { EventCard } from "@/components/events/event-card";

<EventCard 
  event={event}
  onQuickBet={handleQuickBet}
  isBookmarked={isBookmarked}
  onBookmarkToggle={handleBookmark}
/>
```

**Features:**
- Category badge and tags
- Date display
- Quick Bet button (authenticated)
- Bookmark toggle (authenticated)
- Click propagation prevention

---

### LeaderboardContent

Leaderboard display with tabs and pagination.

```tsx
import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";

<LeaderboardContent />
```

**Features:**
- Metric tabs (XP, PnL, Volume)
- Period selection (All, Monthly, Weekly)
- User search
- Current user position
- Animated rows

---

### MarketTimeline

Visual timeline for market status.

```tsx
import { MarketTimeline } from "@vault/ui";

<MarketTimeline 
  status="OPEN" 
  publishedAt={date}
  opensAt={date}
  closesAt={date}
  resolvedAt={date}
/>
```

---

### UserHoverCard

Hover card with user info.

```tsx
import { UserHoverCard } from "@vault/ui";

<UserHoverCard user={user}>
  <span>@username</span>
</UserHoverCard>
```

---

### BettingPanel

Market betting interface.

```tsx
import { BettingPanel } from "@/components/markets/betting-panel";

<BettingPanel
  market={market}
  userPosition={position}
  onBetPlaced={handleBet}
/>
```

**Features:**
- Outcome selection
- Amount input with presets
- Buy/Sell toggle
- Quote display
- Success modal integration

---

### SellPositionModal

Modal for selling user positions.

```tsx
import { SellPositionModal } from "@/components/profile/sell-position-modal";

<SellPositionModal
  position={position}
  market={market}
  isOpen={isOpen}
  onClose={onClose}
/>
```

---

### RedeemPositionsModal

Modal for claiming settled positions.

```tsx
import { RedeemPositionsModal } from "@/components/profile/redeem-positions-modal";

<RedeemPositionsModal
  positions={settledPositions}
  isOpen={isOpen}
  onClose={onClose}
/>
```

---

## Utility

### cn

Class name utility (clsx + tailwind-merge).

```tsx
import { cn } from "@vault/ui/lib/utils";

<div className={cn(
  "base-class",
  isActive && "active-class",
  variant === "large" && "text-lg"
)} />
```

---

## Theming

### CSS Variables

The theme uses CSS variables defined in `globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 224 71% 4%;
  --primary: 263.4 70% 50.4%;
  --outcome-yes: 145 100% 40%;
  --outcome-no: 357 100% 59%;
}

.dark {
  --background: 224 71% 4%;
  --foreground: 213 31% 91%;
}
```

### Usage

```tsx
<div className="bg-background text-foreground">
  <span className="text-primary">Primary text</span>
  <span className="text-outcome-yes">Green/Yes</span>
  <span className="text-outcome-no">Red/No</span>
</div>
```

---

## Animation Utilities

Common Framer Motion variants used in the app:

```tsx
// Staggered container
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

// Fade in up
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Float up and fade (XP animations)
const floatUpVariants = {
  initial: { opacity: 1, y: 0, scale: 1 },
  animate: {
    opacity: [1, 1, 0],
    y: [0, -8, -16],
    scale: [1, 1.05, 1],
    transition: { duration: 1.5, times: [0, 0.3, 1] }
  }
};

// Usage
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

---

## Provider Setup

Required providers in your root layout:

```tsx
// layout.tsx
import { ThemeProvider } from "next-themes";
import { XPAnimationProvider } from "@/components/layout/xp-animation";
import { ThemedToaster } from "@/components/providers/themed-toaster";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <XPAnimationProvider>
            {children}
            <ThemedToaster />
          </XPAnimationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```
