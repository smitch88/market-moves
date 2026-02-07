# Vault Markets — CRE Integration Summary

**Platform:** Vault Markets (on-chain prediction market protocol)
**Target Chain:** Arbitrum One (+ Arbitrum Sepolia for staging)
**Contact:** [TBD]

---

## Overview

Vault Markets is a prediction market protocol where users trade outcome shares on binary and multi-outcome events. The protocol requires several automated off-chain-to-on-chain workflows for market lifecycle management and liquidity operations. We are building on **CRE (Chainlink Runtime Environment)** to replace legacy Keeper-based automation with TypeScript workflows running on a Chainlink DON.

**Scale targets:** 200+ markets created/resolved daily, 10M+ monthly transactions, 50K+ MAU.

---

## Workflow 1: Market Lifecycle Automation

### Purpose

Prediction markets follow a state machine: **Active → Closed → Resolved**. Two transitions require automated triggering:

1. **Close**: When a market's deadline passes, it must transition from Active to Closed (permissionless on-chain call, but needs a caller)
2. **Resolve**: Once Closed, markets with a configured Chainlink price feed should auto-resolve by reading the oracle answer and submitting the resolution

No single user is incentivized to pay gas for these calls — they benefit all participants equally. CRE provides the liveness guarantee.

### Trigger

- **Primary:** Cron — every 5 minutes (`0 */5 * * * *`)
- **Enhancement (future):** EVM Log trigger on the `MarketClosed` event to attempt resolution immediately on state transition, reducing latency from ~5 min to sub-minute

### Flow

```
Cron fires
  │
  ├── EVM Read: Paginated scan of active market IDs
  │     └── For each market, read: state, deadline, oracle config
  │
  ├── Classify into two buckets:
  │     ├── Closeable: state=Active AND now >= deadline
  │     └── Resolvable: state=Closed AND oracle-type AND within grace window
  │
  ├── EVM Write (batch 1): Submit CLOSE command for eligible markets
  │     └── Consumer contract calls close transition for each market ID
  │
  └── EVM Write (batch 2): Submit RESOLVE command for eligible markets
        └── Consumer contract calls oracle-based resolution for each market ID
```

### CRE Capabilities Used

| Capability | Usage |
|---|---|
| **Cron Trigger** | Periodic scan every 5 min |
| **EVM Read** (`callContract`) | Read active market list (paginated), read per-market state and oracle config |
| **EVM Write** (`writeReport`) | Submit batched close/resolve commands to consumer contract via KeystoneForwarder |

### Handler Design

- **Input:** Cron payload (no arguments needed, schedule-driven)
- **Processing:** Stateless scan — reads all active markets from chain, classifies, and acts. No off-chain state needed between runs.
- **Output:** Two `writeReport` calls (one for closes, one for resolutions) with ABI-encoded batches of `(actionType, marketId[])`
- **Idempotency:** Safe to re-fire. Close/resolve on already-closed/resolved markets are no-ops (contract reverts silently per-market via try/catch in consumer)

### Configuration

| Parameter | Example | Purpose |
|---|---|---|
| `schedule` | `"0 */5 * * * *"` | Cron expression |
| `chainSelectorName` | `"ethereum-testnet-sepolia-arbitrum-1"` | Target chain |
| `marketContractAddress` | `"0x..."` | Protocol's market contract |
| `consumerAddress` | `"0x..."` | CRE consumer contract |
| `maxClosePerRun` | `20` | Soft cap on close batch size |
| `maxResolvePerRun` | `10` | Soft cap on resolve batch size (bounded by on-chain gas cap of 10 per report) |

### Volume Estimate

- ~200 markets resolved/day = ~40 markets per hour
- At 12 cron ticks/hour, average ~3-4 markets per run
- Peak: up to 20 closings + 10 resolutions in a single run during market deadline clusters
- EVM reads: ~50-200 `callContract` calls per run (paginated scan + per-market reads)
- EVM writes: 1-2 `writeReport` calls per run

---

## Workflow 2: Liquidity Skew Monitor

### Purpose

The protocol provides its own liquidity to seed prediction markets (automated market maker). When a market becomes heavily one-sided (e.g., 85%+ probability on one outcome), the remaining liquidity exposure generates impermanent loss with minimal offsetting fee revenue. This workflow monitors market prices and proactively withdraws protocol liquidity when skew exceeds a threshold, reducing tail-end IL by ~25%.

### Trigger

- **Primary:** Cron — every 10 minutes
- **Enhancement (future):** EVM Log trigger on large trade events (trades that move price by >5% in a single tx)

### Flow

```
Cron fires
  │
  ├── EVM Read: Get all markets where protocol has active liquidity
  │     └── For each, read: current outcome prices, protocol liquidity amount
  │
  ├── Classify:
  │     └── High-skew: any outcome price > skew threshold (e.g., 0.85)
  │           AND protocol still has liquidity deployed
  │
  └── EVM Write: Submit WITHDRAW command for high-skew markets
        └── Consumer contract calls liquidity withdrawal for each market ID
```

### CRE Capabilities Used

| Capability | Usage |
|---|---|
| **Cron Trigger** | Periodic skew check every 10 min |
| **EVM Read** (`callContract`) | Read outcome prices and protocol liquidity balances |
| **EVM Write** (`writeReport`) | Submit batched withdraw commands to consumer contract |

### Handler Design

- **Input:** Cron payload
- **Processing:** Read current prices for all protocol-LP'd markets. Compare against configurable skew threshold. Emit withdraw commands for markets that cross the threshold.
- **Output:** Single `writeReport` with `(WITHDRAW, marketId[])` payload
- **Idempotency:** Safe to re-fire. Withdrawing from already-withdrawn markets is a no-op.

### Configuration

| Parameter | Example | Purpose |
|---|---|---|
| `schedule` | `"0 */10 * * * *"` | Cron expression |
| `skewThreshold` | `0.85` | Outcome price above which LP is withdrawn (WAD scale) |
| `minLiquidityToAct` | `100e6` | Minimum protocol liquidity to bother withdrawing (USDC, 6 decimals) |

### Volume Estimate

- ~20 markets/day cross the skew threshold (10% of 200 daily markets)
- 1-5 withdraw commands per run
- EVM reads: 50-200 `callContract` calls per run
- EVM writes: 0-1 `writeReport` calls per run (many runs will have no action)

---

## Workflow 3: Concentrated Liquidity Rebalancer

### Purpose

For high-volume markets, the protocol deploys liquidity in concentrated price ranges (similar to Uniswap v3) rather than full-range positions. This provides deeper liquidity and better pricing for users but requires active management — when the market price moves near a range boundary, the position must be repositioned (removed and re-added at a new range centered on current price). This workflow automates that rebalancing.

### Trigger

- **Primary:** Cron — every 15 minutes
- **Enhancement (future):** EVM Log trigger on trades that move pool price near range boundary

### Flow

```
Cron fires
  │
  ├── EVM Read: Get all protocol concentrated liquidity positions
  │     └── For each, read: current pool price, position range bounds, liquidity amount
  │
  ├── Classify:
  │     └── Needs rebalance: price within X% of range boundary
  │           OR price has moved outside range entirely
  │
  ├── Compute new range:
  │     ├── Center on current price
  │     ├── Width based on market volatility / time to resolution
  │     └── Narrower for high-skew markets (reduce IL), wider for balanced markets (earn more fees)
  │
  └── EVM Write: Submit REBALANCE command with new range parameters
        └── Consumer contract: remove old position, add new position at computed range
```

### CRE Capabilities Used

| Capability | Usage |
|---|---|
| **Cron Trigger** | Periodic check every 15 min |
| **EVM Read** (`callContract`) | Read pool prices, position ranges, liquidity amounts |
| **EVM Write** (`writeReport`) | Submit rebalance commands (remove + re-add) to consumer contract |

### Handler Design

- **Input:** Cron payload
- **Processing:** For each protocol position, compute distance to range boundary. If within threshold, compute optimal new range based on current price and market characteristics. Bundle rebalance commands.
- **Output:** `writeReport` with `(REBALANCE, positionId, newTickLower, newTickUpper)[]` payload
- **Idempotency:** Rebalancing an already-centered position is a no-op (distance to boundary > threshold)

### Configuration

| Parameter | Example | Purpose |
|---|---|---|
| `schedule` | `"0 */15 * * * *"` | Cron expression |
| `rebalanceThreshold` | `0.10` | Trigger rebalance when price is within 10% of range boundary |
| `defaultRangeWidth` | `0.40` | Default range width (e.g., 30%-70% probability) |
| `narrowRangeWidth` | `0.20` | Narrow range for high-skew markets |

### Volume Estimate

- ~30-50 protocol concentrated positions active at any time
- ~5-10 rebalances/day (most positions stay in-range)
- EVM reads: 30-50 `callContract` calls per run
- EVM writes: 0-1 `writeReport` calls per run

---

## Workflow 4: Earnings Finalization (Future)

### Purpose

After a market resolves, there is a 24-hour finality delay before creator and liquidity provider earnings can be distributed. Once the delay passes, earnings need to be "finalized" — moving them from pending to claimable. This workflow automates that finalization so creators don't need to submit a separate transaction.

### Trigger

- **Primary:** Cron — every 30 minutes
- **Enhancement:** Could use a scheduled trigger offset from resolution time (resolve event timestamp + 24h + buffer)

### Flow

```
Cron fires
  │
  ├── EVM Read: Scan recently resolved markets where finality delay has passed
  │     └── Read: resolution timestamp, finality deadline, pending earnings state
  │
  ├── Classify:
  │     └── Finalizable: resolved AND now >= finalityDeadline AND earnings not yet processed
  │
  └── EVM Write: Submit FINALIZE command for each eligible market
        └── Consumer contract calls earnings processing for each market
```

### CRE Capabilities Used

| Capability | Usage |
|---|---|
| **Cron Trigger** | Periodic check every 30 min |
| **EVM Read** (`callContract`) | Read resolved markets and finality deadlines |
| **EVM Write** (`writeReport`) | Submit finalize commands to consumer contract |

### Volume Estimate

- ~200 markets finalized/day (24h after resolution)
- Batched into ~6-8 finalization runs per day
- EVM reads: 20-50 `callContract` calls per run
- EVM writes: 1 `writeReport` call per run

---

## Cross-Workflow Architecture

### Consumer Contract Pattern

All workflows write to lightweight **consumer contracts** on-chain that implement the CRE `IReceiver` interface (`ReceiverTemplate`). Each consumer:

- Receives signed reports from the DON via the `KeystoneForwarder`
- Decodes action type + parameters from the report payload
- Calls the appropriate protocol function(s)
- Holds no funds and has no privileged access — only calls permissionless or protocol-internal methods
- Bounded batch size per report to cap gas consumption

```
CRE DON
  │
  ├── Workflow 1 → KeystoneForwarder → ResolutionConsumer → [close / resolve]
  ├── Workflow 2 → KeystoneForwarder → LiquidityConsumer  → [withdraw LP]
  ├── Workflow 3 → KeystoneForwarder → LiquidityConsumer  → [rebalance positions]
  └── Workflow 4 → KeystoneForwarder → EarningsConsumer   → [finalize earnings]
```

### Security Model

- Each consumer is locked to a specific `workflowId` and `author` (set at deployment)
- Reports are validated by the KeystoneForwarder before reaching the consumer
- Consumer contracts are stateless — no admin keys, no upgradability, no funds held
- All underlying protocol calls are either permissionless or restricted to the consumer's address

### Estimated Total CRE Usage (at 200 markets/day scale)

| Workflow | Cron Frequency | EVM Reads/day | EVM Writes/day | Estimated LINK/month |
|---|---|---|---|---|
| Market Resolution | Every 5 min | ~30,000-50,000 | ~400 | ~$505 |
| Liquidity Skew Monitor | Every 10 min | ~10,000-20,000 | ~20 | ~$50 |
| CLMM Rebalancer | Every 15 min | ~5,000-10,000 | ~10 | ~$83 |
| Earnings Finalization | Every 30 min | ~2,000-5,000 | ~8 | ~$30 |
| **Total** | | **~50,000-85,000** | **~438** | **~$668/month** |

### Event-Driven Enhancements (Phase 2)

Once stable on cron-based triggers, we'd like to explore EVM Log triggers for lower-latency responses:

| Event | Workflow | Benefit |
|---|---|---|
| `MarketClosed(marketId)` | Resolution | Sub-minute resolution vs 5-min cron |
| `Swap(marketId, ..., newPrice)` | Skew Monitor | React to large trades immediately |
| `Swap(marketId, ..., newPrice)` | Rebalancer | Reposition before range is fully breached |

### Questions for Chainlink

1. **Batch `callContract` efficiency:** Our resolution workflow makes 50-200 sequential `callContract` reads per run. Is there a batched read pattern or multicall approach that reduces DON overhead?
2. **Cross-workflow coordination:** Workflows 2 and 3 (skew monitor + rebalancer) could share a single cron trigger and handler. Is a single workflow with multiple write targets preferred, or separate workflows for isolation?
3. **EVM Log trigger availability on Arbitrum:** What is the current status of EVM Log triggers on Arbitrum Sepolia / Arbitrum One for CRE workflows?
4. **Report size limits:** What is the maximum report payload size for `writeReport`? Our largest batch would be ~10 market IDs (320 bytes encoded) but we want to confirm headroom.
5. **DON execution timeout:** For the resolution workflow scanning 200+ markets, what is the maximum execution time per cron tick before the DON considers the run failed?
6. **Cost model:** Is CRE billing per-capability-invocation (per `callContract`, per `writeReport`), per-workflow-execution, or subscription-based? We want to model costs accurately at scale.
