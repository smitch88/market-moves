# Vault Markets Smart Contract Architecture

> **Version**: 1.0.0  
> **Status**: Design Complete, Implementation Pending  
> **Last Updated**: 2026-02-05  
> **Solidity Version**: 0.8.33  
> **Target Chains**: Arbitrum Sepolia (421614), Arbitrum One (42161)

## Table of Contents

- [Overview](#overview)
- [Design Principles](#design-principles)
- [Solvency and Custody](#solvency-and-custody)
- [Contract Architecture](#contract-architecture)
- [Libraries](#libraries)
- [Interface Specifications](#interface-specifications)
- [User Workflows](#user-workflows)
- [Method Examples](#method-examples)
- [Integration Points](#integration-points)
- [Modern Solidity Patterns](#modern-solidity-patterns)
- [NatSpec Standards](#natspec-standards)
- [Diagrams](#diagrams)
- [File Structure](#file-structure)
- [Deployment Strategy](#deployment-strategy)
- [Security Considerations](#security-considerations)
- [Audit Findings Summary](#audit-findings-summary)

---

## Overview

Vault Markets V1.6 is a prediction market protocol featuring:

- **Conditional tokens**: ERC-1155 outcome shares with split/merge complete sets
- **Hybrid liquidity**: CLOB (primary) + CLMM (concentrated) + FPMM (backstop)
- **Risk engine**: Dynamic fees based on velocity, surge, and inventory skew
- **Recourse advances**: Identity-bound credit lines with debt-first waterfalls

This document describes the smart contract architecture for the on-chain implementation.

---

## Design Principles

### 1. Consolidated Contracts (6 total)

Avoid "contract explosion" — consolidate related functionality into single contracts to reduce deployment costs, simplify audits, and minimize cross-contract calls.

### 2. Pure Libraries (9 total)

Extract math and pure computation into libraries. No state, no storage — just reusable logic.

### 3. Immutable Contracts

No proxies or upgradeability. Contracts are deployed as-is. "Upgrades" are handled by:
- Deploying new contract versions
- Migrating markets at resolution
- Pointing frontend to new contract set (tracked in database)

### 4. Comprehensive Reads, Minimal Writes

- **Read methods**: Everything needed for frontend display, simulation, and interop
- **Write methods**: Only essential state changes to minimize audit surface area

### 5. Modern Solidity (0.8.33)

Leverage latest language features:
- Transient storage for reentrancy guards (~100 gas vs 20,000)
- Custom errors with `revert Error(...)`
- Named mapping parameters
- File-level events in interfaces

### 6. Solady-First

Use [Solady](https://github.com/Vectorized/solady) optimized primitives wherever applicable.

---

## Solvency and Custody

**Model A — Strict Conditional Tokens (Canonical):**

- Outcome shares are minted **only** via `VaultToken.split(marketId, usdcAmount)`, which mints a **complete set** (one share of each outcome) per unit of collateral.
- Outcome shares are burned **only** via `VaultToken.merge(marketId, shareAmount)` (complete set burn).
- **No contract mints single-outcome shares directly.** All swaps (FPMM/CLMM/CLOB) trade **existing shares** and may internally call `split()` to source inventory.

**Custody source of truth:**

- `VaultToken` is the **collateral custody** contract and holds the USDC that backs complete sets.
- `VaultMarket.redeem(marketId)` burns winning shares and **releases USDC from VaultToken custody** under resolution rules.

**Per-market invariants (must hold after every write call):**

- **Complete-set collateralization:** `collateralLocked[marketId] == completeSetsOutstanding[marketId]` (scaled to USDC 6 decimals).
- **Share supply parity:** For each market, the total supply for **each outcome** equals `completeSetsOutstanding[marketId]` **plus** protocol/user inventory transfers, never net-minted outside `split()`.
- **Redemption safety:** Total USDC paid on redemption **cannot exceed** collateral locked for the market.
- **Cross-venue conservation:** CLOB/CLMM/FPMM cannot create or destroy net value except via explicit fees.
- **Equal supply across outcomes:** For each market, `totalSupply(encodeTokenId(marketId, i))` MUST be equal for all outcome indices `i`. Since shares are always minted/burned as complete sets, any deviation indicates a critical bug. This is the cheapest invariant to fuzz.

**Swap sourcing rule (FPMM/CLMM):**

- **Buy (USDC → Shares):** The contract **splits** USDC into a complete set **to itself**, transfers the purchased outcome shares to the user, and retains complementary outcomes as pool inventory.
- **Sell (Shares → USDC):** The user returns outcome shares to the pool. The contract **merges** complete sets (returned shares + pool’s complementary inventory) to free USDC, then pays the user. If the pool lacks sufficient complementary inventory to merge, the sell reverts. This is safe because any prior buy of outcome `i` left complementary shares `j≠i` in the pool, so sells are bounded by prior buy volume.

> **Sell-Side Solvency Invariant:** For each market, the pool’s balance of the *least-held* complementary outcome bounds the maximum single-outcome sell. Implementation MUST check `pool.balance[complement] >= requiredMerge` before executing and revert with `InsufficientPoolInventory` if not met.

> **Collateral Assumption:** This protocol assumes the collateral token (USDC) does **not** charge transfer fees. All solvency invariants depend on `transferFrom(amount)` delivering exactly `amount`. If the collateral is ever changed to a fee-on-transfer or rebasing token, the complete-set model breaks. This is an intentional design constraint.

---

## Contract Architecture

### Core Contracts

| Contract | Responsibility |
|----------|----------------|
| `VaultToken` | ERC-1155 outcome shares + split/merge complete sets |
| `VaultMarket` | Market factory + state + FPMM backstop + resolution + fee routing |
| `VaultCLMM` | Concentrated liquidity vault + vLP shares (Uniswap v3-style) |
| `VaultCLOB` | EIP-712 order settlement + batch netting |
| `VaultRisk` | Velocity tracking + surge LUT + inventory skew (protocol-liquidity only) |
| `VaultCredit` | ProfileID registry + credit lines + recourse debt + debt-first waterfalls |

### Contract Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL                               │
├─────────────────────────────────────────────────────────────────────┤
│  USDC (ERC-20)    Admin/Multisig    Relayer    User Wallets         │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CORE CONTRACTS                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    VaultToken (ERC-1155)                     │   │
│  │  • split(marketId, usdc) → mint complete set               │   │
│  │  • merge(marketId, shares) → burn → usdc                   │   │
│  │  • settle(marketId, user, winningShares) → payout          │   │
│  │  • balanceOf, transfer, batchTransfer                       │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │ mint/burn                             │
│            ┌────────────────┼────────────────┐                      │
│            │                │                │                      │
│            ▼                ▼                ▼                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│  │  VaultMarket    │ │   VaultCLMM     │ │   VaultCLOB     │       │
│  │  ─────────────  │ │  ─────────────  │ │  ─────────────  │       │
│  │  createEvent    │ │  addLiquidity   │ │  settleBatch    │       │
│  │  updateEvent    │ │  removeLiquidity│ │  cancelOrder    │       │
│  │  createMarket   │ │  swap           │ │  incrementNonce │       │
│  │  swap (FPMM)    │ │  collectFees    │ │                 │       │
│  │  resolve        │ │                 │ │                 │       │
│  │  redeem         │ │                 │ │                 │       │
│  └────────┬────────┘ └────────┬────────┘ └─────────────────┘       │
│           │                   │                                     │
│           │ query fee         │ query fee                           │
│           ▼                   ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                       VaultRisk                              │   │
│  │  • updateVelocity(notional)                                  │   │
│  │  • getSurgeMultiplier()                                      │   │
│  │  • getInventorySkew(marketId, outcomeId)                     │   │
│  │  • getEffectiveFee(marketId, outcomeId, isBuy)               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│           │ route fees (FPMM/CLOB/CLMM)                             │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      VaultCredit                             │   │
│  │  • registerProfile()                                         │   │
│  │  • setCreditLimit(profileId, limit)                          │   │
│  │  • recordDebt(profileId, amount)                             │   │
│  │  • depositFees(marketId, amount, source)                     │   │
│  │  • processEarnings(profileId, marketId)                      │   │
│  │  • withdrawEarnings()                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Libraries

All libraries are pure/view with no state modifications.

| Library | File | Purpose |
|---------|------|---------|
| `MathLib` | `src/lib/MathLib.sol` | Fixed-point ops, mulDiv, sqrt (extends Solady's FixedPointMathLib) |
| `LUTLib` | `src/lib/LUTLib.sol` | Interpolated lookup tables for surge multipliers + decay powers |
| `FPMMLib` | `src/lib/FPMMLib.sol` | Pure FPMM math: price derivation, buy/sell delta calculations |
| `CLMMLib` | `src/lib/CLMMLib.sol` | Pure CLMM math: sqrt price, liquidity ↔ amounts, tick math |
| `OrderLib` | `src/lib/OrderLib.sol` | EIP-712 typed data hashing, signature validation, order structs |
| `SafeCastLib` | `src/lib/SafeCastLib.sol` | Explicit int/uint casting (critical for CLMM tick math) |
| `MetadataLib` | `src/lib/MetadataLib.sol` | On-chain JSON construction using LibString + Base64 |
| `Errors` | `src/lib/Errors.sol` | Centralized error definitions (reduces bytecode duplication) |
| `UnitLib` | `src/lib/UnitLib.sol` | USDC↔Share unit conversions with explicit rounding |

### Decimal Handling (Critical)

**USDC vs Shares:**
- USDC: **6 decimals** (1 USDC = 1e6)
- Outcome Shares: **18 decimals** (1 share = 1e18)

```solidity
library UnitLib {
    uint256 internal constant USDC_DECIMALS = 6;
    uint256 internal constant SHARE_DECIMALS = 18;
    uint256 internal constant SCALE = 10 ** (SHARE_DECIMALS - USDC_DECIMALS); // 1e12

    /// @notice Convert USDC amount to share units (always exact, no rounding)
    function usdcToShares(uint256 usdc) internal pure returns (uint256) {
        return usdc * SCALE;
    }

    /// @notice Convert shares to USDC, rounding DOWN (user receives less)
    function sharesToUsdcDown(uint256 shares) internal pure returns (uint256) {
        return shares / SCALE;
    }

    /// @notice Convert shares to USDC, rounding UP (user pays more)
    function sharesToUsdcUp(uint256 shares) internal pure returns (uint256) {
        return (shares + SCALE - 1) / SCALE;
    }
}
```

> **Rounding Policy**: Always round DOWN on outputs (user receives less) and round UP on inputs (user pays more). This prevents value creation and ensures protocol solvency.
>
> **Dust Accumulation:** Rounding down on share→USDC conversions creates sub-SCALE remainders (< 1e12 wei per conversion) that accumulate in VaultToken as locked dust. This is not exploitable but grows linearly with trade count. Consider a periodic admin sweep or tracking cumulative dust per market for accounting.
>
> **Property Tests Required**: `merge(split(x)) == x` for all valid `x` (minus fees if applicable).

### Library Usage

```
Libraries (pure/view)
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ MathLib │ LUTLib  │ FPMMLib │ CLMMLib │OrderLib │
│─────────│─────────│─────────│─────────│─────────│
│ mulDiv  │interpLUT│ calcBuy │sqrtPrice│hashOrder│
│ sqrt    │powDecay │ calcSell│liquidity│verifySig│
│ wad/ray │ packLUT │ getPrice│ tickMath│ EIP-712 │
└────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘
     │         │         │         │         │
     ▼         ▼         ▼         ▼         ▼
   VaultRisk VaultRisk VaultMarket VaultCLMM VaultCLOB
```

---

## Interface Specifications

### Design Principle

**Comprehensive reads, minimal writes**

- Read methods: ~66 total — everything frontend/contracts need
- Write methods: ~32 total — minimal audit surface area
- Ratio: ~2.0x reads per write

---

### IVaultToken (ERC-1155 Outcome Shares)

**Read Methods (view/pure):**

| Method | Returns | Purpose |
|--------|---------|---------|
| `balanceOf(address account, uint256 tokenId)` | `uint256` | User's share balance (inherited) |
| `balanceOfBatch(address[] accounts, uint256[] tokenIds)` | `uint256[]` | Batch balance query (inherited) |
| `isApprovedForAll(address owner, address operator)` | `bool` | Operator approval (inherited) |
| `totalSupply(uint256 tokenId)` | `uint256` | Total shares minted for outcome |
| `exists(uint256 tokenId)` | `bool` | Whether token ID exists |
| `getMarketTokenIds(uint256 marketId)` | `uint256[]` | All token IDs for a market |
| `decodeTokenId(uint256 tokenId)` | `(uint256 marketId, uint8 outcomeId)` | Parse token ID components |
| `encodeTokenId(uint256 marketId, uint8 outcomeId)` | `uint256` | Build token ID: `(marketId << 8) \| outcomeId`. marketId bounded to `< 2^248` |
| `uri(uint256 tokenId)` | `string` | On-chain JSON metadata (data URI) |

**Write Methods (state-changing):**

| Method | Access | Purpose |
|--------|--------|---------|
| `split(uint256 marketId, uint256 amount)` | User | Deposit USDC → mint complete set (active markets only; reverts on `amount == 0`) |
| `merge(uint256 marketId, uint256 amount)` | User | Burn complete set → withdraw USDC (reverts on `amount == 0`) |
| `settle(uint256 marketId, address user, uint256 winningShares)` | VaultMarket | Burn winning shares → release USDC |
| `setApprovalForAll(address operator, bool approved)` | User | Grant/revoke operator (inherited) |
| `safeTransferFrom(...)` | User | Transfer shares (inherited) |
| `safeBatchTransferFrom(...)` | User | Batch transfer (inherited) |

> **On-Chain Metadata**: The `uri()` function generates fully on-chain JSON using Solady's `LibString` and `Base64`. This eliminates centralized metadata dependencies and ensures token metadata survives independently of any API.

> **Lifecycle Gating**: `split()` MUST check `VaultMarket.isMarketActive(marketId)` and revert if the market is Paused/Resolved to prevent post-resolution minting. `merge()` remains allowed if the user holds a complete set.

> **Cross-Contract Immutability Coupling:** `VaultToken` holds an immutable reference to `VaultMarket` for lifecycle checks (`isMarketActive`) and settlement (`settle`). Since both contracts are immutable (no proxies), a new VaultMarket deployment means VaultToken must also be redeployed. Existing markets on the old VaultMarket remain fully functional on the old contract set — migrations happen at resolution boundaries, not mid-market. All contracts in a deployment cohort (VaultToken, VaultMarket, VaultCLMM, VaultCLOB, VaultRisk, VaultCredit) MUST be deployed together and reference each other via constructor-set immutable addresses.

> **Redemption Authority**: `settle()` is restricted to `VaultMarket` and is the only path to redeem **winning** shares (single-outcome payout). This avoids abusing `merge()` for post-resolution payouts.

> **USDC Blacklist Risk (Acknowledged):** USDC has Circle admin blacklist capabilities. If a user’s address is blacklisted, `merge()`, `redeem()`, and `withdrawEarnings()` will permanently revert since they transfer USDC to `msg.sender`. This is an accepted centralization risk inherent to USDC collateral. Mitigation: expose `redeemTo(address recipient)` and `mergeTo(address recipient)` variants so users can redirect USDC to a non-blacklisted address they control. The pull pattern on `withdrawEarnings()` already allows admin intervention if needed.

> **Event Hierarchy (On-Chain)**: `VaultMarket` acts as the on-chain **Event registry**. Each Market includes `eventId` and can be grouped/filtered on-chain without relying on the indexer.
>
> ```solidity
> function uri(uint256 tokenId) public view override returns (string memory) {
>     (uint256 marketId, uint8 outcomeId) = decodeTokenId(tokenId);
>     Market memory m = vaultMarket.getMarket(marketId);
>     
>     return string.concat(
>         "data:application/json;base64,",
>         Base64.encode(bytes(string.concat(
>             '{"name":"', m.outcomes[outcomeId], ' - ', m.title, '",',
>             '"description":"Outcome share for Vault777 prediction market",',
>             '"decimals":18,',
>             '"properties":{"marketId":', LibString.toString(marketId),
>             ',"outcomeId":', LibString.toString(outcomeId),
>             ',"totalSupply":"', LibString.toString(totalSupply(tokenId)), '"}}'
>         )))
>     );
> }
> ```

---

### IVaultMarket (Markets + FPMM)

**Constants:**

| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_CREATOR_FEE` | 50 bps (0.5%) | Minimum creator fee to prevent sybil evasion |
| `MAX_OUTCOMES` | 8 | Maximum outcomes per market to bound FPMM gas costs |
| `DISPUTE_PERIOD` | 86400 (24 hours) | Time after resolution before `processEarnings` is callable |

**Read Methods (view/pure):**

| Method | Returns | Purpose |
|--------|---------|---------|
| `getMarket(uint256 marketId)` | `Market` | Full market struct |
| `getMarketState(uint256 marketId)` | `MarketState` | Status enum (Active/Paused/Resolved) |
| `getMarketCount()` | `uint256` | Total markets created |
| `getEvent(uint256 eventId)` | `Event` | Event metadata struct |
| `getEventCount()` | `uint256` | Total events created |
| `getEventMarketCount(uint256 eventId)` | `uint256` | Number of markets under an event |
| `getEventMarketId(uint256 eventId, uint256 index)` | `uint256` | Market ID by event + index |
| `getActiveEventCount()` | `uint256` | Number of active events |
| `getActiveEventId(uint256 index)` | `uint256` | Active event ID by index |
| `getActiveEventIds(uint256 cursor, uint256 limit)` | `uint256[]` | Paginated active event IDs |
| `getActiveMarketCount()` | `uint256` | Number of active markets |
| `getActiveMarketId(uint256 index)` | `uint256` | Active market ID by index |
| `getActiveMarketIds(uint256 cursor, uint256 limit)` | `uint256[]` | Paginated active market IDs |
| `getOutcomeCount(uint256 marketId)` | `uint8` | Number of outcomes |
| `getReserves(uint256 marketId)` | `uint256[]` | FPMM reserves per outcome |
| `getOutcomePrice(uint256 marketId, uint8 outcomeId)` | `uint256` | Implied probability (WAD) |
| `getAllPrices(uint256 marketId)` | `uint256[]` | All outcome prices |
| `quoteSwapIn(uint256 marketId, uint8 outcomeId, uint256 amountIn)` | `(uint256 out, uint256 fee)` | Simulate buy with USDC |
| `quoteSwapOut(uint256 marketId, uint8 outcomeId, uint256 amountOut)` | `(uint256 in, uint256 fee)` | Simulate buy for exact shares |
| `quoteSell(uint256 marketId, uint8 outcomeId, uint256 sharesIn)` | `(uint256 out, uint256 fee)` | Simulate sell shares |
| `getResolution(uint256 marketId)` | `(uint8 winner, string evidence, uint256 resolvedAt)` | Resolution details |
| `getCreatorFees(uint256 marketId, address creator)` | `uint256` | Accrued creator fees |
| `isMarketActive(uint256 marketId)` | `bool` | Can trade? |
| `isMarketResolved(uint256 marketId)` | `bool` | Has winner? |
| `getRedemptionAmount(uint256 marketId, address user)` | `uint256` | USDC claimable after resolution |

**Write Methods (state-changing):**

| Method | Access | Purpose |
|--------|--------|---------|
| `createMarket(CreateMarketParams params)` | Admin | Create new market |
| `createEvent(CreateEventParams params)` | Admin | Create new event container |
| `updateEvent(UpdateEventParams params)` | Admin | Update event metadata/flags |
| `swap(SwapParams params)` | User | Execute FPMM trade |
| `resolve(uint256 marketId, uint8 winner, string evidence)` | Admin | Set winning outcome |
| `redeem(uint256 marketId)` | User | Claim USDC for winning shares |
| `claimCreatorFees(uint256 marketId)` | Creator | Withdraw accrued fees |
| `pauseMarket(uint256 marketId)` | Admin | Emergency pause |
| `unpauseMarket(uint256 marketId)` | Admin | Resume trading |

> **Swap Direction & Deadlines**: `SwapParams` includes `isBuy` (buy vs sell) and `deadline` to prevent stale execution. `Swap` events emit `fee` and `newPrice` for indexers and analytics.

> **Sybil Resistance**: `createMarket` enforces `creatorFeeRate >= MIN_CREATOR_FEE` and requires the fee recipient to be a registered ProfileID. This prevents attackers from creating markets with 0% creator fee to bypass the recourse debt system.

> **Redemption Path**: `redeem(marketId)` calls `VaultToken.settle(marketId, user, winningShares)` to burn winning shares and release collateral from VaultToken custody. `redeem` reads the caller's winning share balance atomically — a second call sees zero balance and reverts with `NothingToRedeem`. Losing shares are not burned on redemption (users may burn them manually or leave them).

> **Post-Resolution Pool Recovery (FPMM):** After resolution, the FPMM pool holds complementary outcome shares as inventory. The protocol MUST recover this value:
> 1. For winning shares held by the pool: call `VaultToken.settle()` to convert to USDC and route to VaultCredit (protocol treasury).
> 2. For losing shares held by the pool: worthless, can be burned or left.
> 3. Implementation: `resolve()` should trigger pool inventory accounting or expose `reclaimPoolInventory(marketId)` callable by admin after resolution.
>
> **Post-Resolution CLMM LP Positions:** When a market resolves, CLMM LP positions still hold outcome tokens:
> 1. LPs MUST be able to call `removeLiquidity()` on resolved markets to withdraw their tokens.
> 2. LPs then call `redeem()` for winning shares or `merge()` if they hold complete sets.
> 3. `removeLiquidity()` MUST NOT revert on resolved markets — only `addLiquidity()` and `swap()` should be gated by market state.

> **Market State Machine:** Valid transitions are strictly enforced:
> ```
> Active → Paused    (pauseMarket)
> Paused → Active    (unpauseMarket)
> Active → Resolved  (resolve)
> Paused → Resolved  (resolve — allows resolving paused markets)
> ```
> Resolved is terminal — no transition back. `createMarket` initializes to Active. Any other transition MUST revert with `InvalidStateTransition(currentState, targetState)`.

> **Event Modeling**: Each market belongs to an `eventId`. Event metadata is kept minimal on-chain (for grouping/filtering) and points to rich off-chain metadata via `metadataURI`.

**Event Struct (minimal on-chain):**

```solidity
struct Event {
    bytes32 eventKey;     // keccak256(slug)
    string metadataURI;   // IPFS/HTTPS JSON
    uint64 startTime;
    uint64 endTime;
    bool active;
    bool closed;
    bool published;
    uint64 createdAt;     // block.timestamp at creation
    uint64 updatedAt;     // last metadata/status change
}
```

**Market Struct (excerpt):**

```solidity
struct Market {
    uint256 eventId;
    uint8 outcomes;
    MarketState state;
    uint64 createdAt;     // block.timestamp at creation
    uint64 disputeDeadline; // resolvedAt + DISPUTE_PERIOD; 0 if unresolved
    uint64 updatedAt;     // last state change
    uint64 resolvedAt;    // 0 if unresolved
    // ... other fields
}
```

> **On-Chain Discovery (No Indexer)**: To support fully on-chain UIs, track timestamps for events/markets and expose paginated views of **active** IDs. Avoid unbounded loops by using cursor/limit reads. Recommended view methods:
> - `getActiveEventCount()` / `getActiveEventId(uint256 index)`
> - `getActiveMarketCount()` / `getActiveMarketId(uint256 index)`
> - `getActiveEventIds(uint256 cursor, uint256 limit)` / `getActiveMarketIds(uint256 cursor, uint256 limit)`
>
> Maintain active ID lists with swap-and-pop on state changes (pause/resolve/endTime) to keep enumeration cheap and deterministic.
>
> **Decentralized Resolution (Future)**: The end state should allow fully on-chain resolution via an oracle + keeper system. Keepers can monitor **closed but unresolved** markets and trigger settlement or dispute flows. Indexers remain optional for low latency/UX, but all critical reads and resolution paths should be possible directly on-chain. The only intentionally hybrid component is the CLOB due to latency/MEV constraints.

---

### IVaultCLMM (Concentrated Liquidity)

**Read Methods (view/pure):**

| Method | Returns | Purpose |
|--------|---------|---------|
| `getPool(uint256 marketId, uint8 outcomeId)` | `Pool` | Pool state (sqrtPrice, liquidity, tick) |
| `getPosition(uint256 positionId)` | `Position` | Position details |
| `getPositionsByOwner(address owner)` | `uint256[]` | All position IDs for user (bounded; see note) |
| `getPositionsByOwner(address owner, uint256 cursor, uint256 limit)` | `uint256[]` | Paginated position IDs for user |
| `getLiquidityInRange(uint256 marketId, uint8 outcomeId, int24 tickLower, int24 tickUpper)` | `uint128` | Liquidity in tick range |
| `quoteSwap(uint256 marketId, uint8 outcomeId, uint256 amountIn, bool zeroForOne)` | `(uint256 out, uint256 fee)` | Simulate swap |
| `getVLPBalance(address owner)` | `uint256` | User's vLP share balance |
| `getTotalVLP()` | `uint256` | Total vLP supply |
| `getProtocolLiquidity(uint256 marketId)` | `uint256` | Protocol-owned liquidity |
| `getEarnedFees(uint256 positionId)` | `(uint256 token0, uint256 token1)` | Uncollected fees |
| `tickToPrice(int24 tick)` | `uint256` | Convert tick to price (WAD) |
| `priceToTick(uint256 price)` | `int24` | Convert price to nearest tick |

**Write Methods (state-changing):**

| Method | Access | Purpose |
|--------|--------|---------|
| `addLiquidity(AddLiquidityParams params)` | User/Protocol | Provide concentrated liquidity |
| `removeLiquidity(RemoveLiquidityParams params)` | Owner | Withdraw liquidity |
| `swap(CLMMSwapParams params)` | User | Execute CLMM swap |
| `collectFees(uint256 positionId)` | Owner | Collect earned fees |
| `collectProtocolFees(uint256 marketId, uint8 outcomeId)` | VaultCLMM | Route POL fees to VaultCredit |

> **CLMM Audit Priority (HIGH)**: Uniswap v3-style concentrated liquidity math is notoriously error-prone. `CLMMLib` requires:
> - Differential fuzz testing against Uniswap v3 reference implementation (mandatory)
> - Fuzz testing all tick/liquidity/price conversions
> - Invariant tests: `liquidity >= 0`, `price ∈ [tickLower, tickUpper]`, fee growth monotonicity
> - Explicit overflow checks on `int24`/`int128`/`uint128` casts (use `SafeCastLib`)

> **Deadlines**: `AddLiquidityParams`, `RemoveLiquidityParams`, and `CLMMSwapParams` include a `deadline` field to prevent stale execution after major price moves.

> **Protocol Fees**: `collectProtocolFees` is used for protocol-owned LP positions; fees are routed into `VaultCredit` (hardening/recourse waterfall) instead of being transferred to `msg.sender`.

> **CLMM Market State Gating:** `addLiquidity()` and `swap()` MUST check `VaultMarket.isMarketActive(marketId)` and revert on paused/resolved markets. `removeLiquidity()` and `collectFees()` remain open regardless of state so LPs can always exit.
>
> **Emergency Pause:** VaultCLMM should respect market-level pauses via `VaultMarket.isMarketActive()`. For a protocol-wide emergency, admin can pause all active markets on VaultMarket, which propagates to CLMM and FPMM. VaultCLOB is implicitly paused by the relayer ceasing to submit batches.

---

### IVaultCLOB (Order Settlement)

**Read Methods (view/pure):**

| Method | Returns | Purpose |
|--------|---------|---------|
| `getOrderStatus(bytes32 orderHash)` | `OrderStatus` | Open/Filled/Cancelled |
| `getFilledAmount(bytes32 orderHash)` | `uint256` | Amount already filled |
| `getRemainingAmount(bytes32 orderHash)` | `uint256` | Amount still fillable |
| `getNonce(address user)` | `uint256` | Current nonce for user |
| `isValidSignature(Order order, bytes signature)` | `bool` | Verify order signature |
| `hashOrder(Order order)` | `bytes32` | Compute EIP-712 order hash |
| `DOMAIN_SEPARATOR()` | `bytes32` | EIP-712 domain separator (dynamic on chain fork) |
| `verifyOrder(Order order, bytes signature)` | `(bool valid, uint8 reason)` | Full validation with reason code |
| `getFailedMatches(uint256 batchId)` | `bytes32[]` | Order hashes that failed in batch |
| `getFailedMatchReasons(uint256 batchId)` | `uint8[]` | Reason codes per failed match |

**Write Methods (state-changing):**

| Method | Access | Purpose |
|--------|--------|---------|
| `settleBatch(Order[] orders, bytes[] signatures)` | Relayer | Settle matched orders (soft reverts) |
| `cancelOrder(Order order)` | Maker | Cancel single order (requires full order struct to verify `msg.sender == order.maker`) |
| `cancelOrders(Order[] orders)` | Maker | Batch cancel (verifies maker on each) |
| `incrementNonce()` | User | Invalidate all pending orders |

**Events:**

| Event | Parameters | Purpose |
|-------|------------|---------|
| `MatchFailed` | `bytes32 orderHash, uint8 reasonCode` | Individual match failed in batch |

> **Soft Revert Pattern**: `settleBatch` uses try/catch internally. If an individual match fails (insufficient balance, cancelled order, etc.), it emits `MatchFailed` and continues processing remaining orders. This prevents DoS where one bad order blocks the entire batch.
>
> **Implementation Notes:**
> - Use compact failure codes (`uint8`) instead of dynamic strings in `MatchFailed` to prevent gas griefing
> - Bound max matches per batch (e.g., 50) to limit gas consumption
> - Bound per-order validation cost

> **CLOB Fee Routing**: `settleBatch` deducts the 3% trading fee from fills and calls `VaultCredit.depositFees(marketId, feeAmount, FeeSource.CLOB)` so that all CLOB fees enter the debt-first waterfall.

> **CLOB Velocity Update (Critical):** `settleBatch` MUST call `VaultRisk.updateVelocity(notional)` after processing fills. Without this, CLOB volume is invisible to the surge fee engine and attackers can route massive directional flow through the CLOB at base fees while FPMM/CLMM traders pay surge pricing. VaultCLOB must be added to the `VaultRisk.updateVelocity` whitelist alongside VaultMarket and VaultCLMM.

> **Settlement Correctness (Critical)**: The on-chain settlement MUST verify:
> - Matched orders share the same `(marketId, outcomeId)` and have opposite `isBuy` flags
> - Fill amount ≤ remaining order amount
> - Fill price respects both maker's limit price constraints
> - Token flows net exactly to the fill (no value leakage)
> - Relayer cannot choose arbitrary fill prices or amounts
> - `block.timestamp <= order.expiry` for each order
>
> ```solidity
> // OrderLib enforcement example
> if (fillAmount > order.amount - filledAmount[orderHash]) revert ExceedsFillable();
> if (block.timestamp > order.expiry) revert OrderExpired();
> // Price enforcement: buy orders accept fillPrice <= order.price, sell orders accept fillPrice >= order.price
> if (order.isBuy && fillPrice > order.price) revert PriceExceedsLimit();
> if (!order.isBuy && fillPrice < order.price) revert PriceBelowLimit();
> // Net transfer: buyer pays fillAmount * fillPrice, seller receives shares
> ```

---

### IVaultRisk (Risk Engine)

**Read Methods (view/pure):**

| Method | Returns | Purpose |
|--------|---------|---------|
| `getVelocity()` | `uint256` | Current velocity V (WAD) |
| `getSurgeMultiplier()` | `uint256` | Current surge M (WAD, 1e18 = 1x) |
| `getInventorySkew(uint256 marketId, uint8 outcomeId)` | `int256` | Skew z_i (signed WAD) |
| `getEffectiveFee(uint256 marketId, uint8 outcomeId, bool isBuy)` | `uint256` | Computed fee (bps) |
| `getBaselineFee()` | `uint256` | f0 baseline (300 bps) |
| `getMaxFee()` | `uint256` | f_max cap |
| `getRiskParams()` | `RiskParams` | All params struct |
| `getLastUpdateBlock()` | `uint256` | Block of last velocity update |
| `previewEffectiveFee(uint256 notional, uint256 marketId, uint8 outcomeId, bool isBuy)` | `uint256` | Fee after hypothetical trade |
| `getReferenceMidPrice(uint256 marketId)` | `uint256` | CLOB mid-price for inventory skew calc |

**Write Methods (state-changing):**

| Method | Access | Purpose |
|--------|--------|---------|
| `updateVelocity(uint256 notional)` | Internal | Called by Market/CLMM/CLOB on trade |
| `setRiskParams(RiskParams params)` | Admin | Update risk parameters |
| `setLUT(bytes lutData)` | Admin | Upload new surge LUT (validated) |

> **LUT Validation (setLUT)**: Before accepting a new LUT, validate:
> - **Monotonicity**: `LUT[i] <= LUT[i+1]` for surge multipliers (fees increase with velocity)
> - **Bounds**: All values within `[1e18, f_max * 1e18]` (1x to max multiplier)
> - **Length**: Expected array length matches step count
> - **Rollback**: Keep last-known-good LUT; revert to it if validation fails
>
> A malformed LUT can brick fee calculations or create exploitable discontinuities.

> **Reference Price Oracle**: Inventory skew calculation uses CLOB mid-price (from `getReferenceMidPrice`) rather than AMM spot price. This prevents attackers from manipulating AMM reserves to artificially reduce skew penalties before large directional trades.
>
> **Mid-Price Derivation Rules** (oracle hardening):
> - Use **last-executed-trade mid**, not quoted/resting order mid
> - Apply **TWAP over recent fills** (e.g., 5-minute window) to smooth manipulation
> - Require **minimum volume threshold** before price updates
> - Clamp **max change per block** to prevent flash manipulation
> - Enforce **sanity bounds vs FPMM spot** (e.g., mid-price must be within ±10% of FPMM; otherwise clamp or fall back)
> - If mid-price is written by a privileged actor (relayer), treat it as an oracle feed
>
> **Thin-Book Spoofing Risk**: In sparse markets, a spoofed CLOB mid-price can distort inventory skew. Always apply the sanity bound vs FPMM price before using the reference price for fee calculations.

> **Global Velocity (Design Tradeoff):** Velocity is tracked as a single global value, not per-market. This means high volume on one market surges fees on all markets. This is intentional — it provides protocol-level protection against coordinated attacks across venues and ensures the risk engine responds to total protocol throughput. The tradeoff is that unrelated markets may experience elevated fees during localized surges. Per-market velocity is a possible v2 enhancement.

---

### IVaultCredit (Profiles + Recourse)

**FeeSource enum (for fee routing):**

```solidity
enum FeeSource { FPMM, CLOB, CLMM }
```

**Read Methods (view/pure):**

| Method | Returns | Purpose |
|--------|---------|---------|
| `getProfile(uint256 profileId)` | `Profile` | Full profile struct |
| `getProfileByWallet(address wallet)` | `(uint256 profileId, bool exists)` | Lookup by wallet |
| `getProfileWallets(uint256 profileId)` | `address[]` | All linked wallets |
| `getCreditLimit(uint256 profileId)` | `uint256` | Current limit |
| `getDebt(uint256 profileId)` | `uint256` | Outstanding debt |
| `getAvailableCredit(uint256 profileId)` | `uint256` | limit - debt |
| `getEscrowedFees(uint256 profileId, uint256 marketId)` | `uint256` | Fees escrowed for market |
| `getTotalEscrowedFees(uint256 profileId)` | `uint256` | Total across all markets |
| `getProfileStatus(uint256 profileId)` | `ProfileStatus` | Tier (Creator/TrustedKOL/Public) |
| `isProfileRegistered(address wallet)` | `bool` | Has profile? |
| `getDebtHistory(uint256 profileId)` | `DebtRecord[]` | Historical debt records |
| `getClaimable(uint256 profileId)` | `uint256` | Net withdrawable after debt repayment |

**Write Methods (state-changing):**

| Method | Access | Purpose |
|--------|--------|---------|
| `registerProfile()` | User | Create profile for msg.sender |
| `linkWallet(address wallet, bytes signature)` | ProfileOwner | Add wallet to profile (requires wallet's EIP-712 consent signature) |
| `unlinkWallet(address wallet)` | ProfileOwner | Remove wallet (callable by profile owner or the wallet being unlinked) |
| `setCreditLimit(uint256 profileId, uint256 limit)` | Admin | Set/update credit limit |
| `recordDebt(uint256 profileId, uint256 amount)` | Internal | Add debt (called by Market) |
| `depositFees(uint256 marketId, uint256 amount, FeeSource source)` | VaultMarket/VaultCLOB/VaultCLMM | Deposit fees into debt-first waterfall |
| `processEarnings(uint256 profileId, uint256 marketId)` | Internal | Post-resolution accounting (gated: `block.timestamp >= market.disputeDeadline`) |
| `withdrawEarnings()` | ProfileOwner | Pull claimable funds |
| `setProfileStatus(uint256 profileId, ProfileStatus status)` | Admin | Update tier |

> **Pull Pattern**: Earnings are processed internally but not pushed to users. Instead, users call `withdrawEarnings()` to pull funds. This prevents revert-on-receive attacks where a malicious contract could block fund distribution by reverting in its receive function.

> **Fee Ingestion**: `depositFees(marketId, amount, FeeSource)` is callable by `VaultMarket` (FPMM), `VaultCLOB` (CLOB fills), and `VaultCLMM` (protocol LP fees). This ensures all venue fees flow into the debt-first waterfall.

> **Fee Events**: `depositFees` emits `FeesDeposited(marketId, amount, source)` for indexing.

> **Dispute Window Enforcement (On-Chain):** `processEarnings()` MUST revert with `DisputeWindowActive(marketId, disputeDeadline)` if `block.timestamp < market.disputeDeadline`. This ensures the dispute period is enforced at the contract level, not just cosmetically in the UI. `redeem()` is callable immediately after resolution since users are redeeming their own shares.

> **Wallet Link Authorization:** `linkWallet()` requires an EIP-712 signature from the wallet being linked, preventing unauthorized profile association. Without this, an attacker could link a victim's wallet to their own profile and subject the victim's earnings to the attacker's debt-first waterfall. `unlinkWallet()` is callable by either the profile owner or the wallet itself (so a wallet can always remove itself).

> **Credit Line Scope:** `recordDebt()` is restricted to VaultMarket only. Credit is intentionally scoped to FPMM market creation / initial liquidity seeding. If credit is ever extended to CLMM LP seeding or CLOB margin, the ACL and debt accounting must be expanded accordingly.

---

## User Workflows

This section maps user journeys to contract calls, events, and backend integration points.

### Workflow 1: User Onboarding

**Scenario**: New user connects wallet and creates a profile.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                    │
│ 1. User connects wallet (wagmi/viem)                                        │
│ 2. Check if profile exists                                                  │
│ 3. If not, prompt to register                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Step 1: Check if registered                                              │
│ bool exists = vaultCredit.isProfileRegistered(userAddress);                 │
│                                                                             │
│ // Step 2: Register if new                                                  │
│ if (!exists) {                                                              │
│     uint256 profileId = vaultCredit.registerProfile();                      │
│ }                                                                           │
│                                                                             │
│ // Step 3: Get profile details                                              │
│ Profile memory profile = vaultCredit.getProfile(profileId);                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVENTS EMITTED                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ event ProfileRegistered(uint256 indexed profileId, address indexed wallet); │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND INDEXING                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Subgraph: Index ProfileRegistered → create Profile entity                   │
│ Database: Upsert user record with profileId, wallet, createdAt              │
│ Cache: Invalidate user lookup cache                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Workflow 2: Deposit USDC & Get Shares

**Scenario**: User deposits USDC and mints a complete set of outcome shares for a market.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                    │
│ 1. User selects market and amount                                           │
│ 2. Check USDC allowance                                                     │
│ 3. If needed, approve USDC                                                  │
│ 4. Call split to mint shares                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Step 1: Check allowance                                                  │
│ uint256 allowance = usdc.allowance(user, address(vaultToken));              │
│                                                                             │
│ // Step 2: Approve if needed (one-time or per-tx)                           │
│ if (allowance < amount) {                                                   │
│     usdc.approve(address(vaultToken), type(uint256).max);                   │
│ }                                                                           │
│                                                                             │
│ // Step 3: Split USDC into complete set                                     │
│ vaultToken.split(marketId, amount);                                         │
│ // User now has `amount` of each outcome token for the market               │
│ // Reverts if market is Paused/Resolved                                     │
│                                                                             │
│ // Verify balances                                                          │
│ uint256[] memory tokenIds = vaultToken.getMarketTokenIds(marketId);         │
│ uint256[] memory balances = vaultToken.balanceOfBatch(                      │
│     [user, user, ...],  // repeated for each outcome                        │
│     tokenIds                                                                │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVENTS EMITTED                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ event Transfer(address indexed from, address indexed to, uint256 value);    │
│ // USDC transfer from user to VaultToken                                    │
│                                                                             │
│ event TransferBatch(                                                        │
│     address indexed operator,                                               │
│     address indexed from,      // address(0) for mint                       │
│     address indexed to,        // user                                      │
│     uint256[] ids,             // [tokenId0, tokenId1, ...]                 │
│     uint256[] values           // [amount, amount, ...]                     │
│ );                                                                          │
│                                                                             │
│ event Split(uint256 indexed marketId, address indexed user, uint256 amount);│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND INDEXING                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Subgraph: Index Split → update user balances, market totalSupply            │
│ Database: Update positions table with new share balances                    │
│ Cache: Update user position cache, market liquidity metrics                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Workflow 3: Buy Shares via FPMM

**Scenario**: User buys outcome shares using the FPMM (AMM backstop).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                    │
│ 1. User selects market, outcome, and USDC amount                            │
│ 2. Get quote for expected output                                            │
│ 3. Set slippage tolerance                                                   │
│ 4. Execute swap                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Step 1: Get current prices                                               │
│ uint256[] memory prices = vaultMarket.getAllPrices(marketId);               │
│ // prices[0] = 0.6e18 (60%), prices[1] = 0.4e18 (40%)                       │
│                                                                             │
│ // Step 2: Quote the swap                                                   │
│ (uint256 expectedOut, uint256 fee) = vaultMarket.quoteSwapIn(               │
│     marketId,                                                               │
│     outcomeId,    // 0 for "Yes"                                            │
│     amountIn      // 100e6 (100 USDC)                                       │
│ );                                                                          │
│ // expectedOut = 150e18 shares, fee = 3e6 (3 USDC)                          │
│                                                                             │
│ // Step 3: Calculate minOut with slippage                                   │
│ uint256 slippage = 50; // 0.5%                                              │
│ uint256 minOut = expectedOut * (10000 - slippage) / 10000;                  │
│                                                                             │
│ // Step 4: Ensure USDC approved                                             │
│ usdc.approve(address(vaultMarket), amountIn);                               │
│                                                                             │
│ // Step 5: Execute swap                                                     │
│ uint256 actualOut = vaultMarket.swap(SwapParams({                           │
│     marketId: marketId,                                                     │
│     outcomeId: 0,                                                           │
│     isBuy: true,                                                            │
│     amountIn: 100e6,                                                        │
│     minAmountOut: minOut,                                                   │
│     deadline: block.timestamp + 5 minutes                                   │
│ }));                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ INTERNAL CONTRACT FLOW                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ VaultMarket.swap():                                                         │
│   1. vaultRisk.getEffectiveFee(marketId, outcomeId, true)                   │
│      → Returns 350 bps (3.5% due to surge)                                  │
│   2. FPMMLib.calcBuyDelta(reserves, outcomeId, amountNet)                   │
│      → Returns sharesOut                                                    │
│   3. SafeTransferLib.safeTransferFrom(usdc, user, vaultToken, amountNet)    │
│   4. VaultToken.split(marketId, amountNet)                                  │
│      → Mint complete set to VaultMarket                                     │
│   5. VaultToken.safeTransferFrom(market, user, tokenId, sharesOut)          │
│      → Pool retains complementary outcomes as inventory                     │
│   6. vaultRisk.updateVelocity(amountIn) // protocol liquidity               │
│   7. depositFees(marketId, feeAmount, FeeSource.FPMM) → VaultCredit          │
│   8. emit Swap(...)                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVENTS EMITTED                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ event Swap(                                                                 │
│     uint256 indexed marketId,                                               │
│     address indexed user,                                                   │
│     uint8 outcomeId,                                                        │
│     bool isBuy,                                                             │
│     uint256 amountIn,                                                       │
│     uint256 amountOut,                                                      │
│     uint256 fee,                                                            │
│     uint256 newPrice                                                        │
│ );                                                                          │
│                                                                             │
│ event VelocityUpdated(uint256 newVelocity, uint256 surgeMultiplier);        │
│                                                                             │
│ event FeeCollected(                                                         │
│     uint256 indexed marketId,                                               │
│     uint256 protocolFee,                                                    │
│     uint256 creatorFee                                                      │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND INDEXING                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Subgraph:                                                                   │
│   - Index Swap → update Trade entity, user position, market volume          │
│   - Index VelocityUpdated → update RiskMetrics entity                       │
│   - Index FeeCollected → update fee accounting                              │
│ Database:                                                                   │
│   - Insert trade record                                                     │
│   - Update user positions                                                   │
│   - Update market price history                                             │
│ Cache:                                                                      │
│   - Update live price feed                                                  │
│   - Update market stats (volume, liquidity)                                 │
│ Webhooks:                                                                   │
│   - Notify price feed subscribers                                           │
│   - Trigger analytics pipeline                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Workflow 4: Place & Settle CLOB Order

**Scenario**: User places a limit order, matcher finds counterparty, relayer settles on-chain.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Order Signing)                                                    │
│ 1. User creates limit order                                                 │
│ 2. Sign EIP-712 typed data                                                  │
│ 3. Submit to matcher service                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ORDER STRUCTURE (EIP-712)                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ struct Order {                                                              │
│     address maker;           // 0x1234...                                   │
│     uint256 marketId;        // 1                                           │
│     uint8 outcomeId;         // 0 (Yes)                                     │
│     bool isBuy;              // true                                        │
│     uint256 price;           // 0.65e18 (limit price: max for buy, min for sell) │
│     uint256 amount;          // 100e18 (100 shares)                         │
│     uint256 nonce;           // 5                                           │
│     uint256 expiry;          // block.timestamp + 1 hours                   │
│ }                                                                           │
│                                                                             │
│ // Frontend signs:                                                          │
│ const signature = await wallet.signTypedData({                              │
│     domain: {                                                               │
│         name: "VaultCLOB",                                                  │
│         version: "1",                                                       │
│         chainId: 421614,                                                    │
│         verifyingContract: vaultClobAddress                                 │
│     },                                                                      │
│     types: { Order: [...] },                                                │
│     primaryType: "Order",                                                   │
│     message: order                                                          │
│ });                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ MATCHER SERVICE (Off-Chain)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Validate signature: vaultClob.isValidSignature(order, sig)               │
│ 2. Check nonce: vaultClob.getNonce(maker) <= order.nonce                    │
│ 3. Check balance: vaultToken.balanceOf(maker, tokenId) >= amount            │
│ 4. Add to orderbook                                                         │
│ 5. Match against existing orders                                            │
│ 6. When matched, build settlement batch                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS (Settlement)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Relayer submits batch                                                    │
│ vaultClob.settleBatch(                                                      │
│     [buyOrder, sellOrder],  // matched orders                               │
│     [buyerSig, sellerSig]   // signatures                                   │
│ );                                                                          │
│                                                                             │
│ // Internal flow:                                                           │
│ // 1. Verify all signatures                                                 │
│ // 2. Calculate net USDC and share transfers                                │
│ // 3. Deduct 3% fee on fills                                                │
│ // 4. depositFees(marketId, feeAmount, FeeSource.CLOB) → VaultCredit         │
│ // 5. Execute transfers atomically                                          │
│ // 6. Mark orders as filled                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVENTS EMITTED                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ event OrderFilled(                                                          │
│     bytes32 indexed orderHash,                                              │
│     address indexed maker,                                                  │
│     address indexed taker,                                                  │
│     uint256 filledAmount,                                                   │
│     uint256 price                                                           │
│ );                                                                          │
│                                                                             │
│ event BatchSettled(                                                         │
│     uint256 indexed batchId,                                                │
│     uint256 numOrders,                                                      │
│     uint256 totalVolume                                                     │
│ );                                                                          │
│                                                                             │
│ event FeesDeposited(                                                        │
│     uint256 indexed marketId,                                                │
│     uint256 amount,                                                         │
│     FeeSource source                                                       │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND INDEXING                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Subgraph:                                                                   │
│   - Index OrderFilled → update Order entity status                          │
│   - Index BatchSettled → link fills to batch                                │
│ Database:                                                                   │
│   - Update order status: OPEN → FILLED                                      │
│   - Insert trade records                                                    │
│   - Update user positions                                                   │
│ Matcher:                                                                    │
│   - Remove filled orders from orderbook                                     │
│   - Update best bid/ask                                                     │
│ Webhooks:                                                                   │
│   - Notify maker/taker of fill                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Workflow 5: Provide CLMM Liquidity

**Scenario**: User provides concentrated liquidity in a price range.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                    │
│ 1. User selects market, outcome, price range                                │
│ 2. Calculate required token amounts                                         │
│ 3. Approve tokens if needed                                                 │
│ 4. Add liquidity                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Step 1: Get current pool state                                           │
│ Pool memory pool = vaultClmm.getPool(marketId, outcomeId);                  │
│ // pool.sqrtPrice = current price as sqrt(P) in Q96                         │
│ // pool.tick = current tick                                                 │
│                                                                             │
│ // Step 2: Convert desired prices to ticks                                  │
│ int24 tickLower = vaultClmm.priceToTick(0.50e18); // 50%                    │
│ int24 tickUpper = vaultClmm.priceToTick(0.70e18); // 70%                    │
│                                                                             │
│ // Step 3: Approve tokens                                                   │
│ usdc.approve(address(vaultClmm), type(uint256).max);                        │
│ vaultToken.setApprovalForAll(address(vaultClmm), true);                     │
│                                                                             │
│ // Step 4: Add liquidity                                                    │
│ (uint256 positionId, uint128 liquidity, uint256 amount0, uint256 amount1)   │
│     = vaultClmm.addLiquidity(AddLiquidityParams({                           │
│         marketId: marketId,                                                 │
│         outcomeId: outcomeId,                                               │
│         tickLower: tickLower,                                               │
│         tickUpper: tickUpper,                                               │
│         amount0Desired: 100e6,    // USDC                                   │
│         amount1Desired: 100e18,   // shares                                 │
│         amount0Min: 95e6,         // slippage protection                    │
│         amount1Min: 95e18,                                                  │
│         deadline: block.timestamp + 5 minutes                               │
│     }));                                                                    │
│                                                                             │
│ // Step 5: Query position                                                   │
│ Position memory pos = vaultClmm.getPosition(positionId);                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVENTS EMITTED                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ event LiquidityAdded(                                                       │
│     uint256 indexed positionId,                                             │
│     address indexed owner,                                                  │
│     uint256 marketId,                                                       │
│     uint8 outcomeId,                                                        │
│     int24 tickLower,                                                        │
│     int24 tickUpper,                                                        │
│     uint128 liquidity,                                                      │
│     uint256 amount0,                                                        │
│     uint256 amount1                                                         │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND INDEXING                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Subgraph:                                                                   │
│   - Index LiquidityAdded → create Position entity                           │
│   - Update pool liquidity distribution                                      │
│ Database:                                                                   │
│   - Insert position record                                                  │
│   - Update user LP positions                                                │
│ Cache:                                                                      │
│   - Update pool depth charts                                                │
│   - Recalculate available liquidity per price range                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Workflow 6: Market Resolution & Redemption

**Scenario**: Admin resolves market, users redeem winning shares.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ADMIN FLOW (Resolution)                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS (Admin)                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Admin resolves market                                                    │
│ vaultMarket.resolve(                                                        │
│     marketId,                                                               │
│     winningOutcome,  // 0 for "Yes"                                         │
│     "https://evidence.uri/proof.json"                                       │
│ );                                                                          │
│                                                                             │
│ // This triggers:                                                           │
│ // 1. Market state → Resolved, resolvedAt = block.timestamp                 │
│ // 2. disputeDeadline = block.timestamp + DISPUTE_PERIOD                    │
│ // 3. Creator fees escrowed until finality                                  │
│ // 4. redeem() callable immediately; processEarnings() gated on deadline    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVENTS EMITTED (Resolution)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ event MarketResolved(                                                       │
│     uint256 indexed marketId,                                               │
│     uint8 winner,                                                           │
│     string evidenceUri,                                                     │
│     uint256 resolvedAt,                                                     │
│     uint256 disputeDeadline                                                 │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ USER FLOW (Redemption) - after dispute window                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS (User)                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Step 1: Check redemption amount                                          │
│ uint256 redeemable = vaultMarket.getRedemptionAmount(marketId, user);       │
│                                                                             │
│ // Step 2: Redeem winning shares                                            │
│ uint256 usdcReceived = vaultMarket.redeem(marketId);                        │
│                                                                             │
│ // This:                                                                    │
│ // 1. Calls VaultToken.settle(marketId, user, winningShares)                │
│ // 2. Burns winning shares and releases USDC from collateral custody         │
│ // 3. Losing shares become worthless (optional burn)                         │
│ // 4. Processes creator fees (if dispute window passed)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVENTS EMITTED (Redemption)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ event Redeemed(                                                             │
│     uint256 indexed marketId,                                               │
│     address indexed user,                                                   │
│     uint256 winningShares,                                                  │
│     uint256 losingShares,                                                   │
│     uint256 usdcReceived                                                    │
│ );                                                                          │
│                                                                             │
│ event EarningsProcessed(                                                    │
│     uint256 indexed profileId,                                              │
│     uint256 indexed marketId,                                               │
│     uint256 grossAmount,                                                    │
│     uint256 debtRepaid,                                                     │
│     uint256 netPayout                                                       │
│ );                                                                          │
│                                                                             │
│ event EarningsWithdrawn(                                                    │
│     uint256 indexed profileId,                                              │
│     uint256 amount                                                         │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND INDEXING                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Subgraph:                                                                   │
│   - Index MarketResolved → update Market entity                             │
│   - Index Redeemed → update user positions, calculate PnL                   │
│   - Index EarningsProcessed → update creator/KOL balances                   │
│   - Index EarningsWithdrawn → update payouts                               │
│ Database:                                                                   │
│   - Mark market as resolved                                                 │
│   - Calculate and store user PnL                                            │
│   - Update creator earnings                                                 │
│ Cache:                                                                      │
│   - Remove market from active markets                                       │
│   - Update leaderboard                                                      │
│ Webhooks:                                                                   │
│   - Notify users with positions                                             │
│   - Trigger PnL notifications                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Workflow 7: Creator Flow (Credit Line + Fee Collection)

**Scenario**: Creator uses credit line to seed market, collects fees after resolution.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ADMIN SETUP                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Admin grants creator status and credit line                              │
│ vaultCredit.setProfileStatus(profileId, ProfileStatus.Creator);             │
│ vaultCredit.setCreditLimit(profileId, 1000e6); // $1000 USDC                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CREATOR CREATES MARKET (with credit)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Check available credit                                                   │
│ uint256 available = vaultCredit.getAvailableCredit(profileId);              │
│                                                                             │
│ // Create market using credit for initial liquidity                         │
│ vaultMarket.createMarket(CreateMarketParams({                               │
│     question: "Will ETH hit $10k in 2026?",                                 │
│     outcomes: ["Yes", "No"],                                                │
│     resolutionTime: 1735689600,                                             │
│     creator: creatorAddress,                                                │
│     initialLiquidity: 500e6,     // from credit line                        │
│     useCredit: true                                                         │
│ }));                                                                        │
│                                                                             │
│ // This records debt against creator's profile                              │
│ // vaultCredit.recordDebt(profileId, 500e6);                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ DURING MARKET LIFETIME                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Fees accrue in escrow                                                    │
│ uint256 escrowed = vaultCredit.getEscrowedFees(profileId, marketId);        │
│                                                                             │
│ // Creator can view but cannot withdraw until resolution                    │
│ uint256 totalEscrowed = vaultCredit.getTotalEscrowedFees(profileId);        │
│ uint256 currentDebt = vaultCredit.getDebt(profileId);                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ AFTER RESOLUTION (Debt-First Waterfall)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ // System processes earnings after dispute window                           │
│ vaultCredit.processEarnings(profileId, marketId);                           │
│                                                                             │
│ // Profile owner pulls claimable funds                                      │
│ vaultCredit.withdrawEarnings();                                             │
│                                                                             │
│ // Waterfall logic:                                                         │
│ // 1. Calculate gross earnings from escrow                                  │
│ // 2. Repay debt first (100% seizure until debt = 0)                        │
│ // 3. Remainder paid to creator                                             │
│                                                                             │
│ // Example:                                                                 │
│ // - Escrowed fees: $150                                                    │
│ // - Outstanding debt: $500                                                 │
│ // - Debt repaid: $150 (all fees seized)                                    │
│ // - Remaining debt: $350                                                   │
│ // - Creator payout: $0                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVENTS EMITTED                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ event CreditUsed(                                                           │
│     uint256 indexed profileId,                                              │
│     uint256 amount,                                                         │
│     uint256 newDebt                                                         │
│ );                                                                          │
│                                                                             │
│ event EarningsProcessed(                                                    │
│     uint256 indexed profileId,                                              │
│     uint256 indexed marketId,                                               │
│     uint256 grossAmount,                                                    │
│     uint256 debtRepaid,                                                     │
│     uint256 netPayout                                                       │
│ );                                                                          │
│                                                                             │
│ event EarningsWithdrawn(                                                    │
│     uint256 indexed profileId,                                              │
│     uint256 amount                                                         │
│ );                                                                          │
│                                                                             │
│ event DebtRepaid(                                                           │
│     uint256 indexed profileId,                                              │
│     uint256 amount,                                                         │
│     uint256 remainingDebt                                                   │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Workflow Summary Table

| Workflow | Contracts Involved | Key Write Methods | Backend Integration |
|----------|-------------------|-------------------|---------------------|
| Create Event | VaultMarket | `createEvent()` | Event indexing |
| Onboarding | VaultCredit | `registerProfile()` | Profile indexing |
| Deposit | VaultToken, USDC | `split(marketId, amount)` | Position tracking |
| Buy (FPMM) | VaultMarket, VaultRisk, VaultToken | `swap(SwapParams)` | Trade history, prices |
| Sell (FPMM) | VaultMarket, VaultRisk, VaultToken | `swap(SwapParams)` | Trade history, prices |
| Place Order | VaultCLOB (off-chain) | - | Orderbook |
| Cancel Order | VaultCLOB | `cancelOrder()` | Orderbook |
| Settle Batch | VaultCLOB, VaultToken, VaultCredit | `settleBatch()` | Fills, positions, fee escrow |
| Add Liquidity | VaultCLMM, VaultToken, USDC | `addLiquidity(AddLiquidityParams)` | LP positions |
| Remove Liquidity | VaultCLMM | `removeLiquidity(RemoveLiquidityParams)` | LP positions |
| Collect Fees | VaultCLMM | `collectFees()` | LP earnings |
| Resolution | VaultMarket | `resolve()` | Market state |
| Redemption | VaultMarket, VaultToken | `redeem()` | PnL, positions |
| Withdraw | VaultToken | `merge()` | Positions |
| Creator Fees | VaultCredit | `withdrawEarnings()` | Earnings, debt |

---

## Method Examples

### VaultToken Examples

```solidity
// ============================================================
// SPLIT: Deposit USDC, get complete set of outcome shares
// ============================================================

// User deposits 100 USDC for market #1 (2 outcomes)
vaultToken.split(
    1,        // marketId
    100e6     // amount (100 USDC, 6 decimals)
);
// Result: User receives 100e18 of token #1 (Yes) and 100e18 of token #2 (No)


// ============================================================
// MERGE: Burn complete set, withdraw USDC
// ============================================================

// User returns 50 of each outcome share to get 50 USDC back
vaultToken.merge(
    1,        // marketId
    50e18     // amount (must hold this much of EACH outcome)
);
// Result: User's shares reduced by 50e18 each, receives 50 USDC


// ============================================================
// BALANCE QUERIES
// ============================================================

// Get user's balance for specific outcome
uint256 balance = vaultToken.balanceOf(
    0x1234...abcd,  // user address
    encodeTokenId(1, 0)  // marketId=1, outcomeId=0 (Yes)
);

// Batch query for multiple tokens
uint256[] memory balances = vaultToken.balanceOfBatch(
    [user, user, user],
    [encodeTokenId(1, 0), encodeTokenId(1, 1), encodeTokenId(2, 0)]
);

// Get all token IDs for a market
uint256[] memory tokenIds = vaultToken.getMarketTokenIds(1);
// Returns: [tokenId_Yes, tokenId_No]

// Decode a token ID
(uint256 marketId, uint8 outcomeId) = vaultToken.decodeTokenId(tokenIds[0]);
// Returns: (1, 0)
```

### VaultMarket Examples

```solidity
// ============================================================
// CREATE MARKET (Admin only)
// ============================================================

// Create Event container first
uint256 eventId = vaultMarket.createEvent(CreateEventParams({
    eventKey: keccak256("super-bowl-lx"),
    metadataURI: "ipfs://QmEventMeta",
    startTime: 1735689600,
    endTime: 1738291200,
    active: true,
    closed: false,
    published: true
}));

uint256 marketId = vaultMarket.createMarket(CreateMarketParams({
    eventId: eventId,
    question: "Will BTC reach $100k by end of 2026?",
    outcomes: 2,                    // Binary: Yes/No
    resolutionTime: 1735689600,     // Dec 31, 2026
    creator: 0xCreator...,
    creatorFeeRate: 100,            // 1% (in bps)
    initialLiquidity: 10000e6,      // 10,000 USDC
    initialPrices: [0.5e18, 0.5e18] // 50/50 starting odds
}));
// Returns: marketId = 42


// ============================================================
// QUOTE SWAP (View - no gas, simulation only)
// ============================================================

// Quote buying Yes shares with 100 USDC
(uint256 expectedShares, uint256 fee) = vaultMarket.quoteSwapIn(
    42,       // marketId
    0,        // outcomeId (Yes)
    100e6     // amountIn (100 USDC)
);
// Returns: expectedShares = 145.2e18, fee = 3e6 (3% fee)

// Quote selling 100 Yes shares
(uint256 expectedUsdc, uint256 fee) = vaultMarket.quoteSell(
    42,       // marketId
    0,        // outcomeId (Yes)
    100e18    // sharesIn
);
// Returns: expectedUsdc = 62.5e6, fee = 1.875e6


// ============================================================
// EXECUTE SWAP
// ============================================================

// Buy Yes shares
uint256 sharesReceived = vaultMarket.swap(SwapParams({
    marketId: 42,
    outcomeId: 0,                        // Yes
    isBuy: true,
    amountIn: 100e6,                     // 100 USDC
    minAmountOut: 140e18,                // slippage protection
    deadline: block.timestamp + 5 minutes
}));

// Sell Yes shares
uint256 usdcReceived = vaultMarket.swap(SwapParams({
    marketId: 42,
    outcomeId: 0,                        // Yes
    isBuy: false,
    amountIn: 100e18,                    // 100 shares
    minAmountOut: 60e6,                  // slippage protection
    deadline: block.timestamp + 5 minutes
}));


// ============================================================
// PRICE QUERIES
// ============================================================

// Get single outcome price
uint256 yesPrice = vaultMarket.getOutcomePrice(42, 0);
// Returns: 0.65e18 (65%)

// Get all prices
uint256[] memory prices = vaultMarket.getAllPrices(42);
// Returns: [0.65e18, 0.35e18] (Yes: 65%, No: 35%)

// Get reserves
uint256[] memory reserves = vaultMarket.getReserves(42);
// Returns: [1500e18, 2800e18] (Yes: 1500, No: 2800 shares)


// ============================================================
// RESOLUTION (Admin only)
// ============================================================

vaultMarket.resolve(
    42,                                   // marketId
    0,                                    // winner (0 = Yes)
    "https://evidence.com/btc-price.json" // evidence URI
);


// ============================================================
// REDEMPTION (After resolution)
// ============================================================

// Check claimable amount
uint256 claimable = vaultMarket.getRedemptionAmount(42, user);
// Returns: 250e6 (user had 250 winning shares)

// Claim USDC
uint256 received = vaultMarket.redeem(42);
// Calls VaultToken.settle() to burn winning shares and release USDC
```

### VaultCLMM Examples

```solidity
// ============================================================
// GET POOL STATE
// ============================================================

Pool memory pool = vaultClmm.getPool(42, 0); // market 42, Yes outcome
// pool.sqrtPriceX96 = current sqrt price in Q96 format
// pool.tick = current tick
// pool.liquidity = total active liquidity


// ============================================================
// PRICE/TICK CONVERSIONS
// ============================================================

// Convert price to tick
int24 tick = vaultClmm.priceToTick(0.65e18);  // 65% price
// Returns: tick representing 0.65

// Convert tick to price
uint256 price = vaultClmm.tickToPrice(tick);
// Returns: ~0.65e18


// ============================================================
// ADD LIQUIDITY
// ============================================================

(uint256 positionId, uint128 liquidity, uint256 amount0, uint256 amount1) = 
    vaultClmm.addLiquidity(AddLiquidityParams({
        marketId: 42,
        outcomeId: 0,                    // Yes
        tickLower: priceToTick(0.50e18), // 50% lower bound
        tickUpper: priceToTick(0.80e18), // 80% upper bound
        amount0Desired: 1000e6,          // USDC
        amount1Desired: 1000e18,         // shares
        amount0Min: 950e6,               // 5% slippage
        amount1Min: 950e18,
        deadline: block.timestamp + 5 minutes
    }));
// Returns: positionId, liquidity minted, actual amounts used


// ============================================================
// QUERY POSITIONS
// ============================================================

// Get position details
Position memory pos = vaultClmm.getPosition(positionId);
// pos.owner, pos.tickLower, pos.tickUpper, pos.liquidity, etc.

// Get all user positions
uint256[] memory positionIds = vaultClmm.getPositionsByOwner(user);

// Get uncollected fees
(uint256 fees0, uint256 fees1) = vaultClmm.getEarnedFees(positionId);


// ============================================================
// REMOVE LIQUIDITY
// ============================================================

(uint256 amount0, uint256 amount1) = vaultClmm.removeLiquidity(RemoveLiquidityParams({
    positionId: positionId,
    liquidity: liquidity / 2,  // remove half
    amount0Min: 0,
    amount1Min: 0,
    deadline: block.timestamp + 5 minutes
}));


// ============================================================
// COLLECT FEES
// ============================================================

(uint256 collected0, uint256 collected1) = vaultClmm.collectFees(positionId);
```

### VaultCLOB Examples

```solidity
// ============================================================
// ORDER STRUCTURE
// ============================================================

Order memory order = Order({
    maker: 0xMaker...,
    marketId: 42,
    outcomeId: 0,           // Yes
    isBuy: true,
    price: 0.65e18,         // limit price: max for buy, min for sell
    amount: 100e18,         // 100 shares
    nonce: 5,
    expiry: block.timestamp + 1 hours
});


// ============================================================
// HASH ORDER (for signing)
// ============================================================

bytes32 orderHash = vaultClob.hashOrder(order);


// ============================================================
// VERIFY ORDER (off-chain validation)
// ============================================================

bool valid = vaultClob.isValidSignature(order, signature);

// Detailed validation
(bool valid, uint8 reason) = vaultClob.verifyOrder(order, signature);
// reason codes: 0=OK, 1=EXPIRED, 2=INVALID_NONCE, 3=INSUFFICIENT_BALANCE, ...


// ============================================================
// QUERY ORDER STATUS
// ============================================================

OrderStatus status = vaultClob.getOrderStatus(orderHash);
// OrderStatus.Open, OrderStatus.PartiallyFilled, OrderStatus.Filled, OrderStatus.Cancelled

uint256 filled = vaultClob.getFilledAmount(orderHash);
uint256 remaining = vaultClob.getRemainingAmount(orderHash);


// ============================================================
// SETTLE BATCH (Relayer only)
// ============================================================

vaultClob.settleBatch(
    [buyOrder, sellOrder],
    [buyerSignature, sellerSignature]
);


// ============================================================
// CANCEL ORDERS
// ============================================================

// Cancel single order (requires full order struct to verify msg.sender == maker)
vaultClob.cancelOrder(order);

// Cancel multiple orders
vaultClob.cancelOrders([order1, order2, order3]);

// Invalidate ALL pending orders (emergency)
vaultClob.incrementNonce();
// All orders with nonce < newNonce are now invalid
```

### VaultRisk Examples

```solidity
// ============================================================
// QUERY RISK STATE
// ============================================================

// Current velocity (decayed trading volume)
uint256 velocity = vaultRisk.getVelocity();
// Returns: 50000e18 (WAD-scaled)

// Surge multiplier
uint256 surge = vaultRisk.getSurgeMultiplier();
// Returns: 1.5e18 (1.5x multiplier)

// Inventory skew for specific outcome
int256 skew = vaultRisk.getInventorySkew(42, 0); // market 42, Yes
// Returns: 0.1e18 (protocol is long 10% on Yes)


// ============================================================
// FEE CALCULATION
// ============================================================

// Get effective fee for a buy
uint256 fee = vaultRisk.getEffectiveFee(42, 0, true); // market 42, Yes, buy
// Returns: 450 (4.5% = 300bps base * 1.5 surge * skew adjustment)

// Preview fee after a hypothetical trade
uint256 previewFee = vaultRisk.previewEffectiveFee(
    100e6,   // notional
    42,      // marketId
    0,       // outcomeId
    true     // isBuy
);


// ============================================================
// QUERY PARAMETERS
// ============================================================

RiskParams memory params = vaultRisk.getRiskParams();
// params.f0 = 300 (baseline 3%)
// params.fMax = 1500 (max 15%)
// params.alpha = 0.97e18 (decay rate)
// params.beta = 0.995e18 (cooldown rate)
// params.gamma = ... (skew sensitivity)

uint256 lastBlock = vaultRisk.getLastUpdateBlock();
```

### VaultCredit Examples

```solidity
// ============================================================
// PROFILE MANAGEMENT
// ============================================================

// Register new profile
uint256 profileId = vaultCredit.registerProfile();

// Link additional wallet
vaultCredit.linkWallet(0xSecondWallet...);

// Query profile
(uint256 pid, bool exists) = vaultCredit.getProfileByWallet(0xUser...);
Profile memory profile = vaultCredit.getProfile(pid);

// Check registration
bool registered = vaultCredit.isProfileRegistered(0xUser...);


// ============================================================
// CREDIT LINE QUERIES
// ============================================================

// Get credit limit
uint256 limit = vaultCredit.getCreditLimit(profileId);
// Returns: 5000e6 ($5000)

// Get outstanding debt
uint256 debt = vaultCredit.getDebt(profileId);
// Returns: 1000e6 ($1000)

// Get available credit
uint256 available = vaultCredit.getAvailableCredit(profileId);
// Returns: 4000e6 ($4000)


// ============================================================
// FEE ESCROW QUERIES
// ============================================================

// Escrowed fees for specific market
uint256 escrowed = vaultCredit.getEscrowedFees(profileId, 42);

// Total escrowed across all markets
uint256 totalEscrowed = vaultCredit.getTotalEscrowedFees(profileId);


// ============================================================
// ADMIN: SET CREDIT LIMIT
// ============================================================

vaultCredit.setCreditLimit(profileId, 10000e6); // $10,000


// ============================================================
// ADMIN: UPDATE STATUS
// ============================================================

vaultCredit.setProfileStatus(profileId, ProfileStatus.TrustedKOL);
// ProfileStatus: Public, Creator, TrustedKOL
```

---

## Integration Points

### Contract → Subgraph Mappings

| Event | Subgraph Entity | Key Fields |
|-------|-----------------|------------|
| `Split` | `Split`, `UserBalance` | marketId, user, amount, timestamp |
| `Merge` | `Merge`, `UserBalance` | marketId, user, amount, timestamp |
| `TransferSingle/Batch` | `Transfer`, `UserBalance` | from, to, tokenId, amount |
| `EventCreated` | `Event` | eventId, eventKey, metadataURI |
| `EventUpdated` | `Event` | eventId, metadataURI, flags |
| `MarketCreated` | `Market` | marketId, question, outcomes, creator |
| `Swap` | `Trade`, `Market`, `UserPosition` | marketId, user, outcome, isBuy, amounts, fee, newPrice |
| `MarketResolved` | `Market` | marketId, winner, evidenceUri, timestamp |
| `Redeemed` | `Redemption`, `UserPosition` | marketId, user, amounts |
| `LiquidityAdded` | `Position`, `Pool` | positionId, owner, ticks, liquidity |
| `LiquidityRemoved` | `Position`, `Pool` | positionId, amounts |
| `OrderFilled` | `Order`, `Fill` | orderHash, maker, taker, amount, price |
| `BatchSettled` | `Settlement` | batchId, orders, volume |
| `VelocityUpdated` | `RiskMetric` | velocity, surge, timestamp |
| `ProfileRegistered` | `Profile` | profileId, wallet |
| `CreditUsed` | `CreditEvent`, `Profile` | profileId, amount, newDebt |
| `FeesDeposited` | `Fees`, `Market` | marketId, amount, source |
| `EarningsProcessed` | `Earnings`, `Profile` | profileId, gross, debt, net |
| `EarningsWithdrawn` | `Earnings`, `Profile` | profileId, amount |

### Subgraph Schema (Simplified)

```graphql
type Event @entity {
  id: ID!                    # eventId
  eventKey: Bytes!           # keccak256(slug)
  metadataURI: String
  startTime: BigInt
  endTime: BigInt
  active: Boolean!
  closed: Boolean!
  published: Boolean!
}

type Market @entity {
  id: ID!                    # marketId
  event: Event!
  question: String!
  outcomes: [String!]!
  creator: Bytes!
  state: MarketState!
  reserves: [BigInt!]!
  prices: [BigDecimal!]!
  volume: BigInt!
  createdAt: BigInt!
  resolvedAt: BigInt
  winner: Int
}

type Trade @entity {
  id: ID!                    # txHash-logIndex
  market: Market!
  user: Bytes!
  outcomeId: Int!
  isBuy: Boolean!
  amountIn: BigInt!
  amountOut: BigInt!
  fee: BigInt!
  price: BigDecimal!
  timestamp: BigInt!
  blockNumber: BigInt!
}

type UserPosition @entity {
  id: ID!                    # user-market
  user: Bytes!
  market: Market!
  balances: [BigInt!]!       # per outcome
  avgEntryPrices: [BigDecimal!]!
  realizedPnl: BigInt!
}

type Position @entity {
  id: ID!                    # positionId
  owner: Bytes!
  market: Market!
  outcomeId: Int!
  tickLower: Int!
  tickUpper: Int!
  liquidity: BigInt!
  earnedFees0: BigInt!
  earnedFees1: BigInt!
}

type Profile @entity {
  id: ID!                    # profileId
  wallets: [Bytes!]!
  status: ProfileStatus!
  creditLimit: BigInt!
  debt: BigInt!
  totalEarnings: BigInt!
}

type Order @entity {
  id: ID!                    # orderHash
  maker: Bytes!
  market: Market!
  outcomeId: Int!
  isBuy: Boolean!
  price: BigDecimal!
  amount: BigInt!
  filledAmount: BigInt!
  status: OrderStatus!
  createdAt: BigInt!
}
```

### Backend API → Contract Calls

| API Endpoint | Contract Call | Caching Strategy |
|--------------|---------------|------------------|
| `GET /markets` | `getMarket()`, Subgraph | Cache 5s, invalidate on Swap |
| `GET /events` | `getEventCount()`, `getEvent()` | Cache 10s |
| `GET /events/:id/markets` | `getEventMarketCount()`, `getEventMarketId()` | Cache 10s |
| `GET /markets/:id/prices` | `getAllPrices()` | Cache 1s, WebSocket updates |
| `GET /markets/:id/depth` | `getReserves()`, CLMM queries | Cache 2s |
| `POST /orders` | Sign only (off-chain) | - |
| `GET /orders/:hash` | `getOrderStatus()` | Cache until filled |
| `POST /quote` | `quoteSwapIn()` | No cache (real-time) |
| `GET /positions/:user` | Subgraph + `balanceOfBatch()` | Cache 10s |
| `GET /profile/:wallet` | `getProfileByWallet()` | Cache 60s |

### UI ↔ On-Chain Alignment (markets-web parity)

The on-chain app must preserve **current markets-web UX** (select outcome → enter dollar amount → confirm; sell by shares). The contract calls below are designed to match existing UI inputs with minimal changes.

| Current UX Action (markets-web) | Off-Chain API Today | On-Chain Equivalent | Notes |
|---|---|---|---|
| Buy shares with $ amount | `POST /api/trades/buy` | `VaultMarket.swap(SwapParams)` | `isBuy=true`, `amountIn=USDC(6d)` |
| Sell shares by quantity | `POST /api/trades/sell` | `VaultMarket.swap(SwapParams)` | `isBuy=false`, `amountIn=shares(18d)` |
| Quote buy/sell | `GET/POST /api/trades/quote` | `quoteSwapIn/quoteSell` + `previewEffectiveFee` | Use same slippage UI |

**Parameter mapping (keep UI behavior identical):**
- **Buy**: UI dollar input → `amountIn = dollars * 1e6` (USDC). `minAmountOut` is computed from `quoteSwapIn` minus slippage.  
- **Sell**: UI share input → `amountIn = shares * 1e18`. `minAmountOut` is computed from `quoteSell` minus slippage.  
- **Deadline**: UI must set `deadline = now + 5 minutes` to avoid stale execution.

**Approval flow (preserve UX):**
- Buy: require `USDC.approve(VaultMarket)` once.  
- Sell: require `VaultToken.setApprovalForAll(VaultMarket)` once for ERC-1155 shares.

**Events and UI updates:**
- `Swap` event includes `isBuy`, `fee`, and `newPrice` for UI price/position updates.
- UI can remain unchanged by consuming the same fields currently returned by `/api/trades/*` (via adapter).

### WebSocket Events

| Event Type | Source | Payload |
|------------|--------|---------|
| `price_update` | Swap event | `{ marketId, prices, timestamp }` |
| `trade` | Swap event | `{ marketId, user, outcome, isBuy, amounts, fee, newPrice }` |
| `order_filled` | OrderFilled event | `{ orderHash, maker, taker, fill }` |
| `market_resolved` | MarketResolved event | `{ marketId, winner }` |
| `orderbook_update` | Matcher | `{ marketId, bids, asks }` |

### Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER ACTIONS                                    │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
    ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
    │   FRONTEND    │      │    MATCHER    │      │   RELAYER     │
    │   (Next.js)   │      │   (Off-chain) │      │   (Bot)       │
    └───────┬───────┘      └───────┬───────┘      └───────┬───────┘
            │                       │                       │
            │ tx submit             │ order receive         │ settleBatch
            │                       │                       │
            ▼                       ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SMART CONTRACTS                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ VaultToken │ VaultMarket │ VaultCLMM │ VaultCLOB │ VaultRisk │ Credit   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │ events                                  │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│    SUBGRAPH     │        │    WEBHOOKS     │        │   DIRECT RPC    │
│  (The Graph)    │        │   (Alchemy)     │        │   (Fallback)    │
└────────┬────────┘        └────────┬────────┘        └────────┬────────┘
         │                          │                          │
         │ GraphQL                  │ HTTP POST                │ eth_call
         │                          │                          │
         ▼                          ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐ │
│  │   API Server  │  │    Queue      │  │    Cache      │  │   Database    │ │
│  │   (Next.js)   │  │  (BullMQ)     │  │   (Redis)     │  │  (Postgres)   │ │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘ │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                                    │ REST/WebSocket
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                    (markets-arena - real money)                              │
│                    (markets-web - free to play)                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Modern Solidity Patterns

### Compiler Configuration

```toml
# foundry.toml
[profile.default]
solc_version = "0.8.33"
evm_version = "cancun"    # Required for EIP-1153 (TSTORE/TLOAD) on Arbitrum
optimizer = true
optimizer_runs = 200
via_ir = true
```

> **EVM Version Warning**: Use `cancun` (not `osaka`) for Arbitrum deployment. Arbitrum's ArbOS 20 ("Atlas") implements Cancun EIPs including EIP-1153 for transient storage. Using an unsupported EVM target can cause `invalid opcode` errors at runtime. Always run fork tests on the exact target chain to verify opcode compatibility.

### Transient Storage for Reentrancy

Use `tstore`/`tload` instead of storage-based reentrancy guards (~100 gas vs 20,000). **Always use a contract-specific slot** (never slot `0`) to avoid cross-contract collisions:
>
> ```solidity
> // Unique slot per contract to avoid cross-contract collisions
> uint256 private constant _GUARD_SLOT = uint256(keccak256("VaultMarket.ReentrancyGuard")) - 1;
>
> modifier nonReentrant() {
>     assembly ("memory-safe") {
>         if eq(tload(_GUARD_SLOT), 2) { revert(0, 0) }
>         tstore(_GUARD_SLOT, 2)
>     }
>     _;
>     assembly ("memory-safe") { tstore(_GUARD_SLOT, 1) }
> }
> ```

### Custom Errors with revert

```solidity
error InsufficientBalance(uint256 available, uint256 required);
error MarketNotActive(uint256 marketId);

// Usage
if (balance < amount) revert InsufficientBalance(balance, amount);
if (market.state != MarketState.Active) revert MarketNotActive(marketId);
```

### Named Mapping Parameters

```solidity
mapping(address user => mapping(uint256 marketId => uint256 shares)) public balances;
mapping(bytes32 orderHash => OrderStatus status) public orderStatuses;
```

### Storage Packing Notes

**Profile (VaultCredit):** pack identity metadata and credit limits into 2 slots for gas efficiency.

```solidity
struct Profile {
    address owner;         // 160 bits
    uint64 createdAt;      // 64 bits
    uint32 status;         // enum (fits in 32 bits)
    // slot boundary
    uint128 creditLimit;   // > $1T with 6 decimals
    uint128 debt;
}
```

**Order (VaultCLOB):** `Order` is calldata-only; store fill state via mappings to avoid heavy structs.

```solidity
mapping(bytes32 orderHash => uint256 filledAmount) public filled;
mapping(bytes32 orderHash => OrderStatus status) public orderStatus;
```

### Events, Structs, Errors in Interfaces

```solidity
interface IVaultMarket {
    // Errors
    error MarketNotActive(uint256 marketId);
    error InsufficientShares(uint256 available, uint256 required);
    
    // Events  
    event MarketCreated(uint256 indexed marketId, address indexed creator, uint8 outcomes);
    event Swap(
        uint256 indexed marketId,
        address indexed user,
        uint8 outcomeId,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        uint256 newPrice
    );
    
    // Structs
    struct Market { ... }
    struct SwapParams { ... }
    
    // Functions
    function swap(SwapParams calldata params) external returns (uint256);
}
```

### Solady Integration

| Module | Usage |
|--------|-------|
| `ERC1155` | Extend for VaultToken |
| `SafeTransferLib` | All USDC transfers |
| `EIP712` + `SignatureCheckerLib` | Order signing (EOA + ERC-1271) |
| `OwnableRoles` | Admin, relayer, council roles |
| `FixedPointMathLib` | mulDiv, sqrt, ln, exp |
| `SSTORE2` | Store LUT data cheaply |
| `LibBitmap` / `LibMap` | Order nonce/fill tracking |
| `CREATE3` | Deterministic deployment addresses |
| `LibString` | On-chain string ops for metadata |
| `Base64` | Encode JSON for data URIs |
| `SafeCastLib` | Explicit int/uint casting for CLMM tick math |

---

## NatSpec Standards

### Interfaces (Full Documentation)

```solidity
/// @title Vault Market Interface
/// @author Vault777 Team
/// @notice User-facing market operations for prediction markets
/// @dev Implements FPMM backstop AMM with risk engine integration
interface IVaultMarket {
    /// @notice Thrown when market is not in active trading state
    /// @param marketId The market that is not active
    error MarketNotActive(uint256 marketId);

    /// @notice Emitted when a swap is executed
    /// @param marketId Target market
    /// @param user Trader address
    /// @param outcomeId Outcome bought/sold
    /// @param isBuy True for buy, false for sell
    /// @param amountIn Input amount
    /// @param amountOut Output amount
    /// @param fee Fee charged (USDC)
    /// @param newPrice Post-trade implied price (WAD)
    event Swap(
        uint256 indexed marketId,
        address indexed user,
        uint8 outcomeId,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        uint256 newPrice
    );

    /// @notice Parameters for executing a swap
    /// @param marketId Target market ID
    /// @param outcomeId Outcome to buy/sell
    /// @param isBuy True for buy, false for sell
    /// @param amountIn Amount of USDC (buy) or shares (sell)
    /// @param minAmountOut Minimum acceptable output (slippage protection)
    /// @param deadline Latest block timestamp for execution
    struct SwapParams {
        uint256 marketId;
        uint8 outcomeId;
        bool isBuy;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
    }

    /// @notice Execute a swap on the FPMM
    /// @param params Swap parameters
    /// @return amountOut Actual amount received
    function swap(SwapParams calldata params) external returns (uint256 amountOut);
}
```

### Implementations (Use @inheritdoc)

```solidity
/// @title Vault Market
/// @author Vault777 Team
/// @notice Implementation of IVaultMarket with FPMM backstop
contract VaultMarket is IVaultMarket, OwnableRoles {
    /// @inheritdoc IVaultMarket
    /// @dev Queries VaultRisk for effective fee before executing
    function swap(SwapParams calldata params) external returns (uint256 amountOut) {
        // implementation
    }
}
```

### Libraries (Full Documentation)

```solidity
/// @title FPMM Math Library
/// @author Vault777 Team
/// @notice Pure functions for constant-product AMM calculations
/// @dev All functions are view/pure with no state modifications
library FPMMLib {
    /// @notice Calculate shares received for a given USDC input
    /// @param reserves Current reserve balances for all outcomes
    /// @param outcomeId Target outcome to buy
    /// @param amountIn USDC amount (after fees)
    /// @return shares Number of outcome shares received
    function calcBuyShares(
        uint256[] memory reserves,
        uint8 outcomeId,
        uint256 amountIn
    ) internal pure returns (uint256 shares) {
        // implementation
    }
}
```

### Consistency Rules

1. Interface NatSpec is authoritative; implementations use `@inheritdoc`
2. All public/external functions MUST have `@notice` and `@param`/`@return`
3. All custom errors MUST have `@notice` explaining when thrown
4. All events MUST have `@notice` and `@param` for indexed params
5. All structs MUST have `@notice` on struct + `@param` on each field
6. Use `@dev` for implementation details, gas notes, invariants

---

## Diagrams

### Backend + Indexing Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARBITRUM (On-Chain)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ VaultToken | VaultMarket | VaultCLMM | VaultCLOB |        │  │
│  │ VaultRisk  | VaultCredit                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │ events                           │
└──────────────────────────────┼──────────────────────────────────┘
                               ▼
        ┌──────────────────────┴──────────────────────┐
        │                                             │
        ▼                                             ▼
┌───────────────────┐                    ┌────────────────────────┐
│  The Graph        │                    │  Alchemy Webhooks      │
│  Subgraph         │                    │  ──────────────────    │
│  ─────────────    │                    │  • Address activity    │
│  • MarketCreated  │                    │  • Pending txs         │
│  • Swap           │                    │  • Confirmations       │
│  • OrderSettled   │                    └───────────┬────────────┘
│  • FeeCollected   │                                │
└─────────┬─────────┘                                ▼
          │                              ┌────────────────────────┐
          │                              │  Persistent Queue      │
          │                              │  (Redis/BullMQ)        │
          │                              └───────────┬────────────┘
          │                                          │
          ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                           │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ API Server      │  │ CLOB Matcher    │  │ Read Cache      │  │
│  │ (Next.js)       │  │ ──────────────  │  │ (Redis)         │  │
│  │ ─────────────   │  │ • orderbook     │  │ ──────────────  │  │
│  │ /api/orders     │  │ • matching      │  │ • market state  │  │
│  │ /api/markets    │◄─┤ • batch builder │  │ • prices        │  │
│  │ /api/positions  │  │ • relayer wallet│  │ • positions     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                ▼                                │
│                    ┌───────────────────────┐                    │
│                    │  Database             │                    │
│                    │  (Neon Postgres)      │                    │
│                    └───────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                               ▲
                               │ REST/tRPC
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (markets-arena)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Next.js App                                               │  │
│  │ • wallet connect (wagmi/viem)                             │  │
│  │ • EIP-712 order signing                                   │  │
│  │ • trade UI                                                │  │
│  │ • position tracking                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Hot Path: User Buys via FPMM

```
User → VaultMarket.swap(SwapParams{ marketId, outcomeId, isBuy, amountIn, minOut, deadline })
  ├── VaultRisk.getEffectiveFee(marketId, outcomeId, BUY)
  │    └── LUTLib.interpSurge(velocity)
  │    └── MathLib.mulDiv(...)
  ├── FPMMLib.calcBuyDelta(reserves, amountNet)
  ├── USDC.transferFrom(user, vaultToken, amountNet)
  ├── VaultToken.split(marketId, amountNet)      // mint complete set to Market
  ├── VaultToken.transfer(market → user, outcomeId, sharesOut)
  ├── VaultRisk.updateVelocity(amountIn)  // if protocol liquidity
  ├── VaultCredit.depositFees(marketId, fee, FeeSource.FPMM)
  └── emit Swap(...)
```

### Hot Path: CLOB Batch Settlement

```
Relayer → VaultCLOB.settleBatch(orders[], signatures[])
  ├── for each order:
  │    └── OrderLib.hashOrder(order)
  │    └── OrderLib.validateSig(hash, sig)
  │    └── check nonce/fill status
  ├── net USDC deltas per user
  ├── fee = 3% of fill notional
  ├── VaultCredit.depositFees(marketId, fee, FeeSource.CLOB)
  ├── USDC.transferFrom(...) // netted
  ├── VaultToken.safeBatchTransferFrom(...) // shares
  └── emit BatchSettled(...)
```

---

## File Structure

```
packages/contracts/
├── CLAUDE.md              # AI rules for Solidity conventions + NatSpec
├── foundry.toml
├── remappings.txt
├── src/
│   ├── VaultToken.sol
│   ├── VaultMarket.sol
│   ├── VaultCLMM.sol
│   ├── VaultCLOB.sol
│   ├── VaultRisk.sol
│   ├── VaultCredit.sol
│   ├── lib/
│   │   ├── MathLib.sol        # Fixed-point ops, mulDiv, sqrt
│   │   ├── LUTLib.sol         # Interpolated lookup tables
│   │   ├── FPMMLib.sol        # FPMM math: price, buy/sell
│   │   ├── CLMMLib.sol        # CLMM math: sqrt price, ticks
│   │   ├── OrderLib.sol       # EIP-712 hashing, validation
│   │   ├── SafeCastLib.sol    # Explicit int/uint casting for CLMM
│   │   ├── MetadataLib.sol    # On-chain JSON generation
│   │   ├── UnitLib.sol        # USDC↔Share unit conversions
│   │   └── Errors.sol         # Centralized error definitions
│   └── interfaces/
│       ├── IVaultToken.sol    # errors, events, structs for token ops
│       ├── IVaultMarket.sol   # errors, events, Market/SwapParams structs
│       ├── IVaultCLMM.sol     # errors, events, Position structs
│       ├── IVaultCLOB.sol     # errors, events, Order struct
│       ├── IVaultRisk.sol     # errors, events, RiskParams struct
│       └── IVaultCredit.sol   # errors, events, Profile/Credit structs
├── script/
│   ├── Deploy.s.sol
│   ├── MineSalt.s.sol
│   └── Migrate.s.sol
├── test/
│   └── *.t.sol
└── deployments/
    ├── 421614/   # Arbitrum Sepolia
    └── 42161/    # Arbitrum One
```

---

## Deployment Strategy

### Immutable Contracts

Contracts are deployed without proxies. Migration strategy:

1. Deploy new contract version (`protocol-v2.json`)
2. Existing markets continue on old contracts until resolved
3. New markets created on new contracts
4. Frontend switches contract set via database config

### Deterministic Addresses (CREATE3)

Use Solady's `CREATE3` for stable addresses across chains:

```solidity
address predicted = CREATE3.predictDeterministicAddress(salt, deployer);
CREATE3.deploy(salt, creationCode, value);
```

> **Critical: Deployer Consistency**
>
> `CREATE3` address depends on the deployer's address (factory or EOA). If you change the deployer wallet or script logic, the mined salt will no longer produce the vanity address.
>
> **Requirements:**
> - Use a consistent deployer key (dedicated Ledger/Safe) for all production deployments
> - Salt mining script must include `msg.sender` in hash calculation
> - Store the `(deployer, salt)` pair alongside deployment artifacts
>
> ```solidity
> // Salt includes deployer to prevent address theft
> bytes32 salt = keccak256(abi.encodePacked(deployer, userSalt, contractName));
> ```

### Vanity Address Mining

Target: `0x777...` prefix for Vault777 branding (~4096 attempts, trivial):

```bash
pnpm contracts:mine:salt -- --pattern 777 --type hexPrefix --chain sepolia
```

### Deployment Scripts

| Script | Purpose |
|--------|---------|
| `Deploy.s.sol` | Deploy all contracts with CREATE3 |
| `MineSalt.s.sol` | Find salt for vanity address |
| `Migrate.s.sol` | Deploy new version (future) |

### Chain Configuration

| Chain | ID | RPC |
|-------|-----|-----|
| Arbitrum Sepolia | 421614 | `$ARBITRUM_SEPOLIA_RPC_URL` |
| Arbitrum One | 42161 | `$ARBITRUM_ONE_RPC_URL` |

---

## Security Considerations

### Trust Model

> **CRITICAL**: This protocol operates under a **trusted admin model**. Admin compromise = total loss event. The admin can resolve markets incorrectly, set hostile risk params, and alter credit limits. This centralization risk is explicitly accepted.

**Recommended Operational Controls:**
- Deploy Admin behind a Gnosis Safe with hardware keys
- Implement role separation using `OwnableRoles`:
  - `RESOLVER_ROLE` — market resolution only
  - `RISK_ROLE` — risk params and LUT updates only
  - `CREDIT_ROLE` — credit limits and profile status only
- Consider timelocks on dangerous parameter changes (risk params, LUT swaps)

### Access Control

- **Admin (trusted)**: Market creation, resolution, risk params, credit limits
- **Relayer**: CLOB batch settlement only (censorship/MEV surface)
- **Council**: CLMM range proposals (optional)
- **Users**: Trading, liquidity provision, profile management

**Relayer Risk:**
> `settleBatch` is relayer-only, creating censorship and MEV vectors. The relayer can choose when/which orders settle and can time settlements around price moves.
>
> **Mitigations:**
> - Publish SLA and failover relayer keys
> - Consider multi-relayer (N-of-M) design for future versions
> - On-chain emergency role rotation capability

### Explicit Access Control List (ACL)

| Contract | Method | Allowed Callers | Modifier |
|----------|--------|-----------------|----------|
| `VaultRisk` | `setRiskParams` | Admin | `onlyOwner` |
| `VaultRisk` | `setLUT` | Admin | `onlyOwner` |
| `VaultRisk` | `updateVelocity` | VaultMarket, VaultCLMM, VaultCLOB | `onlyWhitelisted` |
| `VaultCredit` | `setCreditLimit` | Admin | `onlyOwner` |
| `VaultCredit` | `setProfileStatus` | Admin | `onlyOwner` |
| `VaultCredit` | `recordDebt` | VaultMarket | `onlyMarket` |
| `VaultCredit` | `depositFees` | VaultMarket, VaultCLOB, VaultCLMM | `onlyFeeCollector` |
| `VaultCredit` | `processEarnings` | VaultMarket | `onlyMarket` |
| `VaultCLOB` | `settleBatch` | Relayer | `onlyRelayer` |
| `VaultMarket` | `createMarket` | Admin | `onlyOwner` |
| `VaultMarket` | `createEvent` | Admin | `onlyOwner` |
| `VaultMarket` | `updateEvent` | Admin | `onlyOwner` |
| `VaultMarket` | `resolve` | Admin | `onlyOwner` |
| `VaultToken` | `settle` | VaultMarket | `onlyMarket` |

**Whitelisted Caller Pattern:**

```solidity
// VaultRisk.sol
mapping(address caller => bool allowed) public whitelistedCallers;

modifier onlyWhitelisted() {
    if (!whitelistedCallers[msg.sender]) revert NotWhitelisted(msg.sender);
    _;
}

// Set during deployment
function setWhitelistedCaller(address caller, bool allowed) external onlyOwner {
    whitelistedCallers[caller] = allowed;
    emit WhitelistUpdated(caller, allowed);
}
```

**Market Caller Pattern:**

```solidity
// VaultCredit.sol
address public immutable vaultMarket;

modifier onlyMarket() {
    if (msg.sender != vaultMarket) revert NotMarket(msg.sender);
    _;
}
```

**Fee Collector Pattern:**

```solidity
// VaultCredit.sol
mapping(address caller => bool allowed) public feeCollectors;

modifier onlyFeeCollector() {
    if (!feeCollectors[msg.sender]) revert NotFeeCollector(msg.sender);
    _;
}

// Set during deployment
function setFeeCollector(address caller, bool allowed) external onlyOwner {
    feeCollectors[caller] = allowed;
    emit FeeCollectorUpdated(caller, allowed);
}
```

### Critical Vulnerabilities and Mitigations

| ID | Vulnerability | Contract | Mitigation |
|----|---------------|----------|------------|
| C1 | Batch Settlement DoS | VaultCLOB | Soft reverts with try/catch per match; emits `MatchFailed` |
| C2 | Fee Unpredictability | VaultRisk | Authoritative `previewEffectiveFee()` matches actual execution |
| C3 | Sybil Fee Evasion | VaultCredit | Enforce `MIN_CREATOR_FEE` (0.5%) to registered ProfileID |
| C4 | Price Manipulation | VaultRisk | Use CLOB mid-price as reference, not AMM spot |
| C5 | FPMM sell reverts if pool lacks complementary inventory | VaultMarket | Check `pool.balance[complement] >= requiredMerge`; revert `InsufficientPoolInventory` |
| C6 | Post-resolution pool/LP inventory stranded | VaultMarket, VaultCLMM | `reclaimPoolInventory()` for FPMM; `removeLiquidity()` stays open on resolved markets |
| C7 | CLOB order expiry not enforced on-chain | VaultCLOB | `settleBatch` checks `block.timestamp <= order.expiry`; revert `OrderExpired` |
| C8 | CLOB fill price direction unchecked | VaultCLOB | Buy: `fillPrice <= order.price`; Sell: `fillPrice >= order.price` |
| C9 | CLOB volume bypasses velocity/surge fees | VaultCLOB, VaultRisk | `settleBatch` calls `updateVelocity(notional)`; VaultCLOB added to whitelist |
| C10 | `linkWallet` has no wallet consent — unauthorized profile linking | VaultCredit | Requires EIP-712 signature from wallet being linked |
| C11 | `cancelOrder` cannot verify caller is maker (only stores hash) | VaultCLOB | Changed to accept full `Order` struct; verify `msg.sender == order.maker` |
| C12 | CLOB settlement missing cross-order validation | VaultCLOB | Matched orders must share `(marketId, outcomeId)` with opposite `isBuy` |

> **Velocity Rule (Clarification)**: Fees are computed using **pre-trade velocity** for user predictability. The `previewEffectiveFee()` method is authoritative — actual fee charged MUST match preview within tolerance. However, to prevent MEV boundary exploits (order splitting), use **interpolated LUTs** so fee changes are continuous, not step functions. Users should expect small variance (~1-2 bps) due to block timing.

### Architectural Anti-Patterns (Avoided)

| Pattern | Risk | Solution |
|---------|------|----------|
| Push Payments | Reverts lock funds | Pull pattern with `withdrawEarnings()` |
| Unchecked Math | Overflow exploits | Explicit checks on invariants, `mulDiv` for LUT |
| Fee-on-Transfer Collateral | Solvency invariant breaks | USDC-only assumption documented; no fee-on-transfer or rebasing tokens |
| Unbounded Outcome Count | Gas DoS on FPMM math | `MAX_OUTCOMES = 8` enforced in `createMarket` |

### Code Pattern Requirements

| Pattern | Requirement |
|---------|-------------|
| Transient Storage | `nonReentrant` on ALL external functions touching VaultToken |
| LUT Interpolation | Use `MathLib.mulDiv` to handle WAD scaling |
| EIP-712 Domain | Recompute `DOMAIN_SEPARATOR` if `block.chainid` changes (fork protection) |

### Risk Mitigations

| Risk | Mitigation |
|------|------------|
| LVR / News shocks | Surge multipliers with cooldown |
| Toxic flow | Inventory skew fees (CLOB mid-price reference) |
| CLMM mis-ranging | Wide-band minimum, tight-band caps |
| Sybil creators | ProfileID identity binding + MIN_CREATOR_FEE |
| Oracle risk | Evidence requirements, dispute window, FPMM sanity bounds on CLOB mid-price |
| MEV / boundary exploits | Interpolated LUTs (continuous fees, no step functions) |
| USDC blacklist | **Acknowledged** (USDC centralization risk); `redeemTo()`/`mergeTo()` rescue variants |
| Post-resolution stranded inventory | `reclaimPoolInventory()` for FPMM; `removeLiquidity()` open on resolved markets |
| Unbounded outcome gas | `MAX_OUTCOMES = 8` on `createMarket` |
| Dispute window bypass | `processEarnings()` gated on `block.timestamp >= disputeDeadline` |
| Cross-contract coupling | All contracts deployed as cohort with immutable cross-references; migration at resolution |
| Fee-on-transfer collateral | USDC-only assumption documented; invariants depend on exact-amount transfers |
| CLOB velocity bypass | `settleBatch` calls `updateVelocity`; VaultCLOB whitelisted |
| Unauthorized wallet linking | `linkWallet` requires EIP-712 consent signature from target wallet |
| Cancel order spoofing | `cancelOrder` takes full Order struct; verifies `msg.sender == maker` |
| CLOB cross-order mismatch | Settlement validates matched orders share market/outcome with opposite sides |
| No CLMM pause | CLMM gates swaps/adds via `VaultMarket.isMarketActive()` |
| Global velocity side-effect | **Intentional** design tradeoff documented; per-market velocity is v2 enhancement |

### Engineering Checklist

**Security Critical:**
- [ ] `VaultCLOB.settleBatch`: try/catch per match, emit `MatchFailed` with compact codes (uint8)
- [ ] `VaultCLOB.settleBatch`: Bound max matches per batch (~50), bound per-order validation cost
- [ ] `VaultCLOB.settleBatch`: Enforce `block.timestamp <= order.expiry` per order; revert `OrderExpired`
- [ ] `VaultCLOB.settleBatch`: Enforce fill price direction (buy: `fillPrice <= order.price`, sell: `fillPrice >= order.price`)
- [ ] `VaultCLOB`: Verify fill amount ≤ remaining, fill price respects limits, token flows net exactly
- [ ] `VaultCLOB`: Route 3% fees via `VaultCredit.depositFees(marketId, fee, FeeSource.CLOB)`
- [ ] `VaultCredit`: Pull pattern with `getClaimable()` + `withdrawEarnings()`
- [ ] `VaultCredit.processEarnings`: Revert if `block.timestamp < market.disputeDeadline`
- [ ] `VaultToken.split`: Revert if market is Paused/Resolved (lifecycle gating)
- [ ] `VaultToken.settle`: Only VaultMarket can burn winning shares and release USDC
- [ ] `VaultRisk.getInventorySkew`: Use CLOB mid-price (TWAP, min volume threshold, max change/block, ±10% FPMM sanity bound)
- [ ] `VaultRisk.setLUT`: Validate monotonicity, bounds, length; keep rollback path
- [ ] `VaultMarket.createMarket`: Enforce `MIN_CREATOR_FEE` (0.5%) to ProfileID
- [ ] `VaultMarket.createMarket`: Enforce `outcomes <= MAX_OUTCOMES (8)`
- [ ] `VaultMarket.swap` (sell): Check pool has sufficient complementary inventory to merge; revert `InsufficientPoolInventory`
- [ ] `VaultMarket.resolve`: Set `disputeDeadline = block.timestamp + DISPUTE_PERIOD`
- [ ] `VaultMarket`: Expose `reclaimPoolInventory(marketId)` for post-resolution FPMM inventory recovery
- [ ] `VaultCLMM.removeLiquidity`: MUST NOT revert on resolved markets (only gate `addLiquidity` and `swap`)
- [ ] `VaultCLMM.addLiquidity`/`swap`: Check `VaultMarket.isMarketActive(marketId)` and revert if paused/resolved
- [ ] `VaultCLOB.settleBatch`: Validate matched orders share `(marketId, outcomeId)` with opposite `isBuy`
- [ ] `VaultCLOB.cancelOrder`: Accept full `Order` struct; verify `msg.sender == order.maker`
- [ ] `VaultCredit.linkWallet`: Require EIP-712 consent signature from wallet being linked
- [ ] `VaultToken.split`/`merge`: Revert on `amount == 0`
- [ ] `VaultMarket.redeem`: Revert with `NothingToRedeem` if user has zero winning shares
- [ ] `VaultMarket`: Enforce state machine — Resolved is terminal; only valid transitions allowed
- [ ] `VaultToken.encodeTokenId`: Validate `marketId < 2^248` to prevent bit-packing collision
- [ ] `nonReentrant` on ALL external functions: `swap`, `addLiquidity`, `removeLiquidity`, `settleBatch`, `split`, `merge`, `redeem`
- [ ] `LUTLib.interpSurge`: Use `mulDiv(t, LUT[i+1] - LUT[i], 1e18)` for WAD precision
- [ ] `VaultCLOB.DOMAIN_SEPARATOR`: Dynamic recompute if `block.chainid` changes
- [ ] `previewEffectiveFee()` MUST match actual fee charged (within ~1-2 bps tolerance)

**Solvency Invariants (fuzz/property tests):**
- [ ] `totalSupply(encodeTokenId(marketId, i))` equal for all outcome indices `i` per market
- [ ] `collateralLocked[marketId] == completeSetsOutstanding[marketId]` after every write
- [ ] `merge(split(x)) == x` for all valid x
- [ ] FPMM sell bounded by pool complementary inventory
- [ ] Total USDC redeemed per market ≤ collateral locked

**Unit Conversion:**
- [ ] `UnitLib`: USDC 6 decimals ↔ Shares 18 decimals with explicit rounding
- [ ] Round DOWN on outputs (user receives less), UP on inputs (user pays more)
- [ ] Property test: `merge(split(x)) == x` for all valid x

**CLMM Math (High Priority):**
- [ ] Differential fuzz test `CLMMLib` against Uniswap v3 reference (mandatory)
- [ ] Fuzz all tick/liquidity/price conversions
- [ ] Invariants: `liquidity >= 0`, price in tick range, fee growth monotonic
- [ ] Explicit overflow checks on int24/int128/uint128 casts
- [ ] Protocol LP fees route via `VaultCredit.depositFees(marketId, fee, FeeSource.CLMM)`

**Access Control:**
- [ ] `VaultRisk.updateVelocity`: Only callable by VaultMarket/VaultCLMM/VaultCLOB (whitelisted)
- [ ] `VaultCLOB.settleBatch`: Call `VaultRisk.updateVelocity(notional)` after processing fills
- [ ] `VaultCredit.recordDebt`: Only callable by VaultMarket (`onlyMarket`)
- [ ] `VaultCredit.processEarnings`: Only callable by VaultMarket (`onlyMarket`)
- [ ] `VaultCredit.depositFees`: Only callable by VaultMarket/VaultCLOB/VaultCLMM (`onlyFeeCollector`)
- [ ] Emit events on whitelist changes for observability

**Transient Storage:**
- [ ] Each contract uses unique slot hash (e.g., `keccak256("VaultMarket.ReentrancyGuard")`)
- [ ] No slot `0` usage to avoid library collisions
- [ ] Fork test `nonReentrant` paths on exact Arbitrum environment

**Deployment:**
- [ ] `evm_version = "cancun"` in foundry.toml (NOT osaka)
- [ ] `Deploy.s.sol` uses consistent deployer key for vanity address
- [ ] Salt mining includes deployer address in hash
- [ ] Store `(deployer, salt)` pair in deployment artifacts
- [ ] CI fork tests on Arbitrum Sepolia/One

**Metadata:**
- [ ] `VaultToken.uri()` returns fully on-chain JSON (data URI)
- [ ] Metadata includes marketId, outcomeId, totalSupply

**Operational:**
- [ ] Admin behind Gnosis Safe with hardware keys
- [ ] Role separation: RESOLVER_ROLE, RISK_ROLE, CREDIT_ROLE
- [ ] Relayer failover keys documented, SLA published
- [ ] Emergency role rotation capability on-chain

### Audit Surface

- 6 contracts + 9 libraries
- ~32 write methods (minimal)
- ~68 read methods (comprehensive but view-only)
- No proxies (simpler to verify)
- Immutable contracts (no upgrade vectors)
- Fully on-chain metadata (no external dependencies)

---

## Audit Findings Summary

Architecture-level audit (pre-implementation). Severity rubric: Critical (total loss), High (significant manipulation), Medium (DoS/griefing), Low/Info (best practices).

### Critical Findings (Acknowledged)

| ID | Finding | Status |
|----|---------|--------|
| CRITICAL-01 | Admin key compromise = total loss (markets, params, credit) | **Accepted** (trusted model) + operational controls |
| CRITICAL-02 | Relayer-only CLOB = censorship/MEV vector | **Accepted** + failover keys, SLA |
| CRITICAL-03 | CLOB mid-price oracle = implicit oracle risk | **Mitigated** via TWAP, volume threshold, change caps, ±10% FPMM sanity bounds |
| CRITICAL-04 | USDC blacklist can permanently lock user funds | **Acknowledged** (USDC centralization); `redeemTo()`/`mergeTo()` rescue variants added |

### High Findings (Mitigated)

| ID | Finding | Mitigation |
|----|---------|------------|
| HIGH-01 | EVM `osaka` target unsupported on Arbitrum | Changed to `cancun`, fork tests required |
| HIGH-02 | ERC-1155 callbacks = reentrancy surface | Contract-unique transient slots, all paths guarded |
| HIGH-03 | USDC 6 decimals vs Shares 18 decimals | `UnitLib` with explicit rounding, property tests |
| HIGH-04 | CLMM tick math easy to get wrong | Differential fuzz testing vs Uniswap v3, SafeCastLib |
| HIGH-05 | FPMM sell path undocumented; pool may lack complementary inventory | Explicit sell sourcing rule + `InsufficientPoolInventory` revert |
| HIGH-06 | Post-resolution FPMM/CLMM inventory stranded | `reclaimPoolInventory()` for FPMM; `removeLiquidity()` stays open on resolved markets |
| HIGH-07 | CLOB order expiry not enforced on-chain | `block.timestamp <= order.expiry` check in `settleBatch`; `OrderExpired` revert |
| HIGH-08 | CLOB fill price direction unchecked vs Order struct | Single `price` field = limit; buy: `fillPrice <= price`, sell: `fillPrice >= price` |
| HIGH-09 | CLOB volume invisible to surge fee engine | `settleBatch` calls `updateVelocity`; VaultCLOB added to whitelist |
| HIGH-10 | `linkWallet` lacks wallet consent; unauthorized linking | EIP-712 signature required from wallet being linked |
| HIGH-11 | `cancelOrder(hash)` cannot verify maker identity | Changed to `cancelOrder(Order)` with `msg.sender == maker` check |
| HIGH-12 | CLOB matched orders not validated for same market/side | Cross-order validation: same `(marketId, outcomeId)`, opposite `isBuy` |

### Medium Findings (Addressed)

| ID | Finding | Mitigation |
|----|---------|------------|
| MEDIUM-01 | Soft-revert string griefing | Compact failure codes (uint8), bounded batches |
| MEDIUM-02 | Settlement price/amount under-specified | On-chain fill constraints documented with price direction enforcement |
| MEDIUM-03 | Risk engine whitelist liveness | Observability events on changes |
| MEDIUM-04 | Malformed LUT can brick pricing | Validation on upload (monotonicity, bounds, length) |
| MEDIUM-05 | Pre vs post velocity inconsistency | Clarified: pre-trade + interpolated LUTs |
| MEDIUM-06 | Credit sybil/identity risk | Operational (off-chain identity binding) |
| MEDIUM-07 | `processEarnings` callable before dispute window expires | On-chain gate: revert if `block.timestamp < disputeDeadline` |
| MEDIUM-08 | No max outcome count; FPMM gas DoS | `MAX_OUTCOMES = 8` enforced in `createMarket` |
| MEDIUM-09 | Cross-contract immutable coupling unclear | Documented: all contracts deploy as cohort; migration at resolution boundaries |
| MEDIUM-10 | Equal supply invariant not explicitly stated | Added: `totalSupply` must be equal across all outcomes per market |
| MEDIUM-11 | Fee-on-transfer collateral breaks solvency | Documented: USDC-only assumption; no rebasing/fee tokens |
| MEDIUM-12 | Credit line scope ambiguous | Documented: scoped to FPMM initial liquidity only via VaultMarket |
| MEDIUM-13 | No emergency pause on VaultCLMM | CLMM gates `addLiquidity`/`swap` via `VaultMarket.isMarketActive()` |
| MEDIUM-14 | `DISPUTE_PERIOD` undefined | Added as constant: 86400 (24 hours) |
| MEDIUM-15 | Market state transitions not formalized | Added explicit state machine: Active↔Paused, Active/Paused→Resolved (terminal) |
| MEDIUM-16 | `split(0)`/`merge(0)` not guarded | Zero-amount calls revert |
| MEDIUM-17 | Double redemption not explicitly guarded | `redeem` reads balance atomically; second call reverts `NothingToRedeem` |
| MEDIUM-18 | `getPositionsByOwner` unbounded return | Paginated variant added |

### Positive Design Elements

- Debt-first waterfall (100% seizure until repaid)
- Pull payments for earnings
- Explicit ACL table
- Soft revert batching
- Formal market state machine (Resolved is terminal)
- Zero-amount guards on all token operations
- EIP-712 consent on wallet linking
- Global velocity covers all venues (FPMM + CLMM + CLOB)

---

## Appendix: Recommended Parameters

| Parameter | Default | Notes |
|-----------|---------|-------|
| f0 (baseline fee) | 300 bps | 3% trading fee |
| f_max (cap) | 1500 bps | 15% max under surge |
| alpha (velocity decay) | 0.97/block | L2-tuned |
| beta (cooldown decay) | 0.995/block | Slow anti-oscillation |
| gamma (inventory skew) | tuned | Market-class dependent |
| alpha_wide (CLMM wide band) | >= 20% | Safety allocation |
| alpha_max (tight bands) | <= 40% | Cap tight-band exposure |
| Credit limit (creator) | $500-$2k | Tiered by verification |
| Credit limit (trusted KOL) | $1k-$10k | Tiered, debt-first |

---

*This document is the canonical reference for the Vault Markets smart contract architecture. Update this document when making implementation changes.*
