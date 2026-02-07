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
- `VaultMarket.redeem(marketId)` burns **winning** shares and releases USDC from VaultToken custody. Losing shares are intentionally left inert on-chain (zero cost, zero harm at scale). Losers never need to transact.

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

### Fund-Flow Spec (USDC Transfer Paths)

Every state-changing method that moves USDC uses the **two-transfer pattern**: collateral goes directly to `VaultToken` (custody), fees go directly to `VaultCredit` (earnings waterfall). No USDC is ever held temporarily in `VaultMarket`, `VaultCLMM`, or `VaultCLOB`.

| Operation | USDC Source | Collateral Transfer | Fee Transfer | Authoritative State |
| --- | --- | --- | --- | --- |
| **Buy (FPMM/CLMM)** | User | `USDC.transferFrom(user, VaultToken, amountNet)` | `USDC.transferFrom(user, VaultCredit, fee)` | VaultToken: `collateralLocked += amountNet` |
| **Sell (FPMM/CLMM)** | VaultToken | `VaultToken.releaseCollateral(user, usdcOut)` | `VaultToken.releaseCollateral(VaultCredit, fee)` | VaultToken: `collateralLocked -= (usdcOut + fee)` |
| **Split (user)** | User | `USDC.transferFrom(user, VaultToken, amount)` | None (no fee on split) | VaultToken: `collateralLocked += amount` |
| **Merge (user)** | VaultToken | `VaultToken.releaseCollateral(user, amount)` | None (no fee on merge) | VaultToken: `collateralLocked -= amount` |
| **Redeem (winner)** | VaultToken | `VaultToken.settle(marketId, user, shares)` → releases USDC to user | None (fee already collected at trade time) | VaultToken: `collateralLocked -= payout` |
| **claimRefund (cancelled)** | VaultToken | `VaultToken.releaseCollateral(user, refundAmount)` | None | VaultToken: `collateralLocked -= refundAmount` |
| **CLOB settlement** | Buyer | `USDC.transferFrom(buyer, seller, netAmount)` | `USDC.transferFrom(buyer, VaultCredit, fee)` | CLOB: fill status updated |
| **withdrawEarnings** | VaultCredit | `USDC.transfer(profileOwner, claimable)` | N/A (this IS the fee withdrawal) | VaultCredit: `claimable -= amount` |

> **Key invariant per call:** After every write method, `VaultToken.balanceOf(USDC) >= Σ collateralLocked[marketId]` for all active/closed markets. Fee USDC is NEVER held in VaultToken — it routes directly to VaultCredit on collection. `depositFees(marketId, amount, source)` on VaultCredit is **pure accounting** (records fee allocation to creator profile's escrow) — the USDC transfer to VaultCredit happens in the same transaction BEFORE `depositFees` is called.

> **Implementation enforcement:** Each venue contract (`VaultMarket`, `VaultCLMM`, `VaultCLOB`) performs exactly two `transferFrom` calls on buy: one for collateral (→ VaultToken), one for fee (→ VaultCredit). On sell, `VaultToken` performs the release and splits output between user and VaultCredit in a single internal `_releaseAndRoute()` function. This eliminates custody surface area in venue contracts and ensures `depositFees()` never needs to move USDC itself.

---

## Contract Architecture

### Core Contracts


| Contract      | Responsibility                                                            |
| ------------- | ------------------------------------------------------------------------- |
| `VaultToken`  | ERC-1155 outcome shares + split/merge complete sets                       |
| `VaultMarket` | Market factory + state + FPMM backstop + resolution + fee routing         |
| `VaultCLMM`   | Concentrated liquidity vault + vLP shares (Uniswap v3-style)              |
| `VaultCLOB`   | EIP-712 order settlement + batch netting                                  |
| `VaultRisk`   | Velocity tracking + surge LUT + inventory skew (protocol-liquidity only)  |
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
│  │  • _ensureProfile() (lazy, internal)                         │   │
│  │  • setCreditLimit(profileId, limit)                          │   │
│  │  • recordDebt(profileId, amount)                             │   │
│  │  • depositFees(marketId, amount, source)                     │   │
│  │  • withdrawEarnings() (auto-processes + pulls)               │   │
│  │  • withdrawEarnings()                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Libraries

All libraries are pure/view with no state modifications.


| Library       | File                      | Purpose                                                            |
| ------------- | ------------------------- | ------------------------------------------------------------------ |
| `MathLib`     | `src/lib/MathLib.sol`     | Fixed-point ops, mulDiv, sqrt (extends Solady's FixedPointMathLib) |
| `LUTLib`      | `src/lib/LUTLib.sol`      | Interpolated lookup tables for surge multipliers + decay powers    |
| `FPMMLib`     | `src/lib/FPMMLib.sol`     | Pure FPMM math: price derivation, buy/sell delta calculations      |
| `CLMMLib`     | `src/lib/CLMMLib.sol`     | Pure CLMM math: sqrt price, liquidity ↔ amounts, tick math         |
| `OrderLib`    | `src/lib/OrderLib.sol`    | EIP-712 typed data hashing, signature validation, order structs    |
| `SafeCastLib` | `src/lib/SafeCastLib.sol` | Explicit int/uint casting (critical for CLMM tick math)            |
| `MetadataLib` | `src/lib/MetadataLib.sol` | On-chain JSON construction using LibString + Base64                |
| `Errors`      | `src/lib/Errors.sol`      | Centralized error definitions (reduces bytecode duplication)       |
| `UnitLib`     | `src/lib/UnitLib.sol`     | USDC↔Share unit conversions with explicit rounding                 |


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


| Method                                                   | Returns                               | Purpose                                                                      |
| -------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| `balanceOf(address account, uint256 tokenId)`            | `uint256`                             | User's share balance (inherited)                                             |
| `balanceOfBatch(address[] accounts, uint256[] tokenIds)` | `uint256[]`                           | Batch balance query (inherited)                                              |
| `isApprovedForAll(address owner, address operator)`      | `bool`                                | Operator approval (inherited)                                                |
| `totalSupply(uint256 tokenId)`                           | `uint256`                             | Total shares minted for outcome                                              |
| `exists(uint256 tokenId)`                                | `bool`                                | Whether token ID exists                                                      |
| `getMarketTokenIds(uint256 marketId)`                    | `uint256[]`                           | All token IDs for a market                                                   |
| `decodeTokenId(uint256 tokenId)`                         | `(uint256 marketId, uint8 outcomeId)` | Parse token ID components                                                    |
| `encodeTokenId(uint256 marketId, uint8 outcomeId)`       | `uint256`                             | Build token ID: `(marketId << 8) | outcomeId`. marketId bounded to `< 2^248` |
| `uri(uint256 tokenId)`                                   | `string`                              | On-chain JSON metadata (data URI)                                            |


**Write Methods (state-changing):**


| Method                                                          | Access      | Purpose                                                                          |
| --------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `split(uint256 marketId, uint256 amount)`                       | User        | Deposit USDC → mint complete set (active markets only; reverts on `amount == 0`) |
| `merge(uint256 marketId, uint256 amount)`                       | User        | Burn complete set → withdraw USDC (reverts on `amount == 0`)                     |
| `settle(uint256 marketId, address user, uint256 winningShares)` | VaultMarket | Burn winning shares → release USDC                                               |
| `setApprovalForAll(address operator, bool approved)`            | User        | Grant/revoke operator (inherited)                                                |
| `safeTransferFrom(...)`                                         | User        | Transfer shares (inherited)                                                      |
| `safeBatchTransferFrom(...)`                                    | User        | Batch transfer (inherited)                                                       |


> **On-Chain Metadata**: The `uri()` function generates fully on-chain JSON using Solady's `LibString` and `Base64`. This eliminates centralized metadata dependencies and ensures token metadata survives independently of any API.

> **Lifecycle Gating**: `split()` MUST check `VaultMarket.isMarketActive(marketId)` and revert if the market is Paused/Resolved to prevent post-resolution minting. `merge()` remains allowed if the user holds a complete set.

> **Cross-Contract Immutability Coupling:** `VaultToken` holds an immutable reference to `VaultMarket` for lifecycle checks (`isMarketActive`) and settlement (`settle`). Since both contracts are immutable (no proxies), a new VaultMarket deployment means VaultToken must also be redeployed. Existing markets on the old VaultMarket remain fully functional on the old contract set — migrations happen at resolution boundaries, not mid-market. All contracts in a deployment cohort (VaultToken, VaultMarket, VaultCLMM, VaultCLOB, VaultRisk, VaultCredit) MUST be deployed together and reference each other via constructor-set immutable addresses.

> **Redemption Authority**: `settle()` is restricted to `VaultMarket` and is the only path to redeem **winning** shares (single-outcome payout). This avoids abusing `merge()` for post-resolution payouts.

> **ERC-1155 Receiver Hook Requirements (Reserve Desync Prevention):**
>
> Any contract that holds ERC-1155 outcome shares (`VaultMarket`, `VaultCLMM`, `VaultCLOB`) MUST implement `onERC1155Received` and `onERC1155BatchReceived` to **reject unsolicited transfers**. Without this, a user can call `VaultToken.safeTransferFrom(user, VaultMarket, tokenId, amount, "")` directly, desyncing cached FPMM reserves from actual ERC-1155 balances — breaking spot pricing, enabling inventory manipulation, and creating potential solvency edge cases.
>
> ```solidity
> // Required on VaultMarket, VaultCLMM, VaultCLOB
> function onERC1155Received(
>     address operator, address, uint256, uint256, bytes calldata
> ) external view returns (bytes4) {
>     // Only accept transfers from VaultToken initiated by this contract or authorized protocol contracts
>     if (msg.sender != address(vaultToken)) revert UnauthorizedTransfer();
>     if (operator != address(this) && !_isAuthorizedOperator(operator)) revert UnauthorizedOperator();
>     return this.onERC1155Received.selector;
> }
>
> function onERC1155BatchReceived(
>     address operator, address, uint256[] calldata, uint256[] calldata, bytes calldata
> ) external view returns (bytes4) {
>     if (msg.sender != address(vaultToken)) revert UnauthorizedTransfer();
>     if (operator != address(this) && !_isAuthorizedOperator(operator)) revert UnauthorizedOperator();
>     return this.onERC1155BatchReceived.selector;
> }
> ```
>
> **Hook design rules (reentrancy safety):**
> - Receiver hooks MUST be **minimal**: validate sender/operator, return selector. No state changes.
> - Do **NOT** put `nonReentrant` on receiver hooks — they are called *during* guarded execution (e.g., inside a `nonReentrant` `swap()` call). Adding a guard to the hook would cause self-revert.
> - `nonReentrant` goes on **state-changing user entrypoints** only: `swap`, `split`, `merge`, `addLiquidity`, `removeLiquidity`, `settleBatch`, `redeem`, `claimRefund`.
> - Enforce **checks-effects-interactions** ordering before any ERC-1155 transfer to user-controlled contracts (external recipient could have a malicious `onERC1155Received`).

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


| Constant                  | Value             | Purpose                                                                              |
| ------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `MIN_CREATOR_FEE`         | 50 bps (0.5%)     | Minimum creator fee to prevent sybil evasion                                         |
| `MAX_OUTCOMES`            | 8                 | Maximum outcomes per market to bound FPMM gas costs                                  |
| `EARNINGS_FINALITY_DELAY`          | 86400 (24 hours)  | Time after resolution before `processEarnings` is callable                           |
| `DEFAULT_GRACE_PERIOD`    | 172800 (48 hours) | Max delay after `resolutionTime` before admin fallback is allowed for oracle markets |
| `DEFAULT_STALE_TOLERANCE` | 3600 (1 hour)     | Max oracle data age for `resolveByOracle`                                            |


**Read Methods (view/pure):**


| Method                                                               | Returns                                               | Purpose                              |
| -------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| `getMarket(uint256 marketId)`                                        | `Market`                                              | Full market struct                   |
| `getMarketState(uint256 marketId)`                                   | `MarketState`                                         | Status enum (Active/Paused/Resolved) |
| `getMarketCount()`                                                   | `uint256`                                             | Total markets created                |
| `getEvent(uint256 eventId)`                                          | `Event`                                               | Event metadata struct                |
| `getEventCount()`                                                    | `uint256`                                             | Total events created                 |
| `getEventMarketCount(uint256 eventId)`                               | `uint256`                                             | Number of markets under an event     |
| `getEventMarketId(uint256 eventId, uint256 index)`                   | `uint256`                                             | Market ID by event + index           |
| `getActiveEventCount()`                                              | `uint256`                                             | Number of active events              |
| `getActiveEventId(uint256 index)`                                    | `uint256`                                             | Active event ID by index             |
| `getActiveEventIds(uint256 cursor, uint256 limit)`                   | `uint256[]`                                           | Paginated active event IDs           |
| `getActiveMarketCount()`                                             | `uint256`                                             | Number of active markets             |
| `getActiveMarketId(uint256 index)`                                   | `uint256`                                             | Active market ID by index            |
| `getActiveMarketIds(uint256 cursor, uint256 limit)`                  | `uint256[]`                                           | Paginated active market IDs          |
| `getOutcomeCount(uint256 marketId)`                                  | `uint8`                                               | Number of outcomes                   |
| `getReserves(uint256 marketId)`                                      | `uint256[]`                                           | FPMM reserves per outcome            |
| `getOutcomePrice(uint256 marketId, uint8 outcomeId)`                 | `uint256`                                             | Implied probability (WAD)            |
| `getAllPrices(uint256 marketId)`                                     | `uint256[]`                                           | All outcome prices                   |
| `quoteSwapIn(uint256 marketId, uint8 outcomeId, uint256 amountIn)`   | `(uint256 out, uint256 fee)`                          | Simulate buy with USDC               |
| `quoteSwapOut(uint256 marketId, uint8 outcomeId, uint256 amountOut)` | `(uint256 in, uint256 fee)`                           | Simulate buy for exact shares        |
| `quoteSell(uint256 marketId, uint8 outcomeId, uint256 sharesIn)`     | `(uint256 out, uint256 fee)`                          | Simulate sell shares                 |
| `getResolution(uint256 marketId)`                                    | `(uint8 winner, string evidence, uint256 resolvedAt)` | Resolution details                   |
| `getCreatorFees(uint256 marketId, address creator)`                  | `uint256`                                             | Accrued creator fees                 |
| `isMarketActive(uint256 marketId)`                                   | `bool`                                                | Can trade?                           |
| `isMarketResolved(uint256 marketId)`                                 | `bool`                                                | Has winner?                          |
| `getRedemptionAmount(uint256 marketId, address user)`                | `uint256`                                             | USDC claimable after resolution      |


**Write Methods (state-changing):**


| Method                                                     | Access         | Purpose                                                                       |
| ---------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| `createMarket(CreateMarketParams params)`                  | Admin          | Create new market                                                             |
| `createEvent(CreateEventParams params)`                    | Admin          | Create new event container                                                    |
| `updateEvent(UpdateEventParams params)`                    | Admin          | Update event metadata/flags                                                   |
| `swap(SwapParams params)`                                  | User           | Execute FPMM trade                                                            |
| `resolve(uint256 marketId, uint8 winner, string evidence)` | Admin          | Set winning outcome                                                           |
| `redeem(uint256 marketId)`                                 | User           | Burn winning shares → USDC payout. Losing shares left inert (scale design).   |
| `claimCreatorFees(uint256 marketId)`                       | Creator        | Withdraw accrued fees                                                         |
| `pauseMarket(uint256 marketId)`                            | Admin          | Emergency pause                                                               |
| `unpauseMarket(uint256 marketId)`                          | Admin          | Resume trading                                                                |
| `closeMarket(uint256 marketId)`                            | Permissionless | Transition to Closed when `block.timestamp >= resolutionTime`                 |
| `resolveByOracle(uint256 marketId)`                        | Permissionless | Resolve via configured oracle (state must be Closed, resolver != ADMIN)       |
| `cancelMarket(uint256 marketId)`                           | Admin          | Cancel market (Active/Paused/Closed → Cancelled). Enables pull-based refunds. |
| `claimRefund(uint256 marketId)`                            | User           | Claim proportional USDC refund after market cancellation                      |

> **Cancellation Refund Math (Solvency-Critical):**
>
> When a market is cancelled, each outcome share redeems at `1/N` of collateral (where N = number of outcomes). This ensures the payout vector sums to exactly 1 and the system remains solvent.
>
> ```solidity
> // claimRefund(marketId) implementation
> function claimRefund(uint256 marketId) external returns (uint256 refund) {
>     Market storage m = markets[marketId];
>     if (m.state != MarketState.Cancelled) revert MarketNotCancelled();
>     if (claimed[marketId][msg.sender]) revert AlreadyClaimed();
>     claimed[marketId][msg.sender] = true;
>
>     uint8 N = m.outcomes;
>     uint256 totalRefund;
>
>     // Each outcome share redeems at 1/N of collateral per share
>     // Users may hold unbalanced positions (e.g., only YES shares from FPMM buy)
>     for (uint8 i; i < N; i++) {
>         uint256 tokenId = encodeTokenId(marketId, i);
>         uint256 balance = vaultToken.balanceOf(msg.sender, tokenId);
>         if (balance > 0) {
>             // Round DOWN to prevent rounding profit attacks across wallets
>             totalRefund += (balance * m.collateralPerShare) / N;
>             vaultToken.burn(msg.sender, tokenId, balance); // MUST burn to prevent double-claim
>         }
>     }
>
>     if (totalRefund == 0) revert NothingToRefund();
>     vaultToken.releaseCollateral(msg.sender, totalRefund);
>     emit RefundClaimed(marketId, msg.sender, totalRefund);
>     return totalRefund;
> }
> ```
>
> **Key constraints:**
> - Payout vector: `p[i] = 1/N` for all outcomes. Sum = 1. System solvent.
> - Rounding: **always down** (`balance * collateralPerShare / N`). Dust retained in contract, sweepable by admin.
> - Shares **MUST be burned** on claim — prevents double-claim without relying solely on the `claimed` mapping.
> - Unbalanced positions: Users who bought one outcome on FPMM get proportional refund without needing to rebuild complete sets.
> - `cancelMarket()` snapshots `collateralPerShare = collateralLocked[marketId] / completeSetsOutstanding[marketId]` at cancellation time.
> - **Rounding attack mitigation:** Splitting holdings across wallets to maximize rounding gains is bounded because we round down per-wallet. Maximum rounding profit per wallet per outcome = `(N-1) wei`. With 2 outcomes, an attacker gains at most 1 wei per wallet — economically negligible.
> - **Required fuzz test:** `Σ refundPaid ≤ collateralLocked[marketId]` for all possible claim orderings.

> **Swap Direction & Deadlines**: `SwapParams` includes `isBuy` (buy vs sell) and `deadline` to prevent stale execution. `Swap` events emit `fee` and `newPrice` for indexers and analytics.

> **Sybil Resistance**: `createMarket` enforces `creatorFeeRate >= MIN_CREATOR_FEE` and requires the fee recipient to be a registered ProfileID. This prevents attackers from creating markets with 0% creator fee to bypass the recourse debt system.

> **Redemption Path**: `redeem(marketId)` burns the caller's **winning** shares only via `VaultToken.settle(marketId, user, winningShares)`, releases USDC from custody, and returns `usdcReceived`. If the caller has zero winning shares, it reverts with `NothingToRedeem`. **Losing shares are intentionally NOT burned** — they remain on-chain as inert ERC-1155 balances with zero economic value. This is a deliberate scale decision (see below).
>
> A second `redeem()` call by the same user sees zero winning balance and reverts.

> **Losing Shares: Why They Are Never Burned (Scale Design)**
>
> At 100K–1M+ users per market, burning losing shares would be pure overhead with zero economic benefit:
>
> | Approach | Gas cost at 1M losers | Benefit | Verdict |
> | --- | --- | --- | --- |
> | Push-burn (protocol iterates all losers) | ~5,100 gas × 1M = **5.1B gas** (impossible in one tx) | Clean supply | **Rejected** — requires unbounded iteration or batch infra |
> | Pull-burn (each loser calls burn) | ~5,100 gas per user × optional | Clean wallet | **Rejected** — spending gas to burn a $0 token is anti-UX |
> | Do nothing (leave inert balances) | **0 gas** | None needed | **Accepted** — zero cost, zero harm |
>
> **Why inert losing shares are safe:**
>
> - **No solvency impact**: USDC backing is determined by `collateralLocked[marketId]` and `completeSetsOutstanding[marketId]`, not by losing share `totalSupply`. The collateral for losing shares was already released to winning share holders via `settle()`.
> - **No gas impact on others**: ERC-1155 uses per-user mappings (`balances[user][tokenId]`). Dead tokens in user A's wallet cost zero gas for user B's operations. No unbounded arrays, no iteration.
> - **No enumeration risk**: There is no on-chain enumeration of all holders. `balanceOf` is O(1). The `totalSupply` counter for losing outcomes becomes a historical artifact — harmless.
> - **Supply parity invariant relaxed post-resolution**: The equal-supply-per-outcome invariant governs active/closed markets only. After resolution, winning shares are burned via `settle()` while losing shares remain — this asymmetry is expected and does not affect any solvency check.
> - **Precedent**: Gnosis Conditional Tokens (CTF), the standard used by Polymarket, also leave losing conditional tokens in wallets. This is the established pattern for prediction market protocols at scale.

> **Redemption UX (Frontend):**
>
> | User state | Frontend behavior | On-chain action |
> | --- | --- | --- |
> | Holds winning shares (± losing) | Show "Redeem $X" button with payout preview | `redeem()` → burns winning shares, pays USDC |
> | Holds only losing shares | Show "Market Lost" badge, **no action button** | **No tx needed** — shares are inert |
> | Already redeemed / no shares | Show resolved status, no action | No tx possible |
>
> **Key principle:** Users who lost should **never** be prompted or required to submit a transaction. Their shares are inert on-chain — the frontend reads the resolved market's `winningOutcome` and filters display accordingly. No gas is ever spent on $0-value operations.
>
> **Implementation:** The frontend determines display state via:
> ```
> redeemable = getRedemptionAmount(marketId, user)   // view call, no gas
> if (redeemable > 0) → show "Redeem" button
> if (redeemable == 0 && hasAnyShares) → show "Market Lost" (no action)
> if (redeemable == 0 && !hasAnyShares) → show "Resolved" (already redeemed or never participated)
> ```

> **Post-Resolution Pool Recovery (FPMM):** After resolution, the FPMM pool holds complementary outcome shares as inventory. The protocol MUST recover this value:
>
> 1. For winning shares held by the pool: call `VaultToken.settle()` to convert to USDC and route to VaultCredit (protocol treasury).
> 2. For losing shares held by the pool: leave inert (zero value, zero cost). No burning needed — the pool's losing share balances are harmless storage slots.
> 3. Implementation: `resolve()` should trigger pool inventory accounting or expose `reclaimPoolInventory(marketId)` callable by admin after resolution.
>
> **Post-Resolution CLMM LP Positions:** When a market resolves, CLMM LP positions still hold outcome tokens:
>
> 1. LPs MUST be able to call `removeLiquidity()` on resolved markets to withdraw their tokens.
> 2. LPs then call `redeem()` to burn winning shares and collect USDC, or `merge()` if they hold complete sets. Losing shares remain inert in the LP's wallet.
> 3. `removeLiquidity()` MUST NOT revert on resolved markets — only `addLiquidity()` and `swap()` should be gated by market state.

> **Market State Machine:** Valid transitions are strictly enforced:
>
> ```
> Active → Paused    (pauseMarket)
> Paused → Active    (unpauseMarket)
> Active → Closed    (closeMarket / lazy on block.timestamp >= resolutionTime)
> Paused → Closed    (closeMarket)
> Closed → Resolved  (resolve / resolveByOracle)
> Active → Resolved  (resolve — admin fast-path, skips Closed)
> Paused → Resolved  (resolve — admin fast-path)
> Active/Paused/Closed → Cancelled  (cancelMarket — admin only)
> ```
>
> **Closed** = trading disabled, awaiting resolution. **Resolved** and **Cancelled** are terminal — no transition back. `createMarket` initializes to Active. Any other transition MUST revert with `InvalidStateTransition(currentState, targetState)`.
>
> **Lazy Close:** Any write call (`swap`, `split`, `addLiquidity`) SHOULD check `block.timestamp >= market.resolutionTime` and auto-transition to Closed if still Active. Alternatively, `closeMarket(marketId)` is permissionless and callable by anyone — including the CRE resolution workflow — when `block.timestamp >= resolutionTime`.

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
enum MarketState { Active, Paused, Closed, Resolved }

enum ResolverType { ADMIN, CHAINLINK_FEED, CUSTOM_ADAPTER }

struct OracleConfig {
    ResolverType resolverType;
    address oracle;            // e.g., Chainlink AggregatorV3Interface
    bytes32 oracleData;        // encoded thresholds / ranges / outcome mapping
    uint64 staleTolerance;     // max seconds since last oracle update
    uint64 gracePeriod;        // max delay after resolutionTime before fallback
}

struct Market {
    uint256 eventId;
    uint8 outcomes;
    MarketState state;
    uint64 createdAt;         // block.timestamp at creation
    uint64 resolutionTime;    // when market closes for resolution
    uint64 finalityDeadline;   // resolvedAt + EARNINGS_FINALITY_DELAY; 0 if unresolved
    uint64 updatedAt;         // last state change
    uint64 resolvedAt;        // 0 if unresolved
    OracleConfig oracleConfig; // optional; resolverType == ADMIN if no oracle
    // ... other fields
}
```

> **On-Chain Discovery (No Indexer)**: To support fully on-chain UIs, track timestamps for events/markets and expose paginated views of **active** IDs. Avoid unbounded loops by using cursor/limit reads. Recommended view methods:
>
> - `getActiveEventCount()` / `getActiveEventId(uint256 index)`
> - `getActiveMarketCount()` / `getActiveMarketId(uint256 index)`
> - `getActiveEventIds(uint256 cursor, uint256 limit)` / `getActiveMarketIds(uint256 cursor, uint256 limit)`
>
> Maintain active ID lists with swap-and-pop on state changes (pause/resolve/endTime) to keep enumeration cheap and deterministic.
>
> **Decentralized Resolution:** Fully on-chain resolution is achieved via an oracle + CRE workflow system. A Chainlink CRE Workflow (TypeScript, running on a DON) monitors **closed but unresolved** markets and triggers settlement via `VaultResolutionConsumer`. The workflow also auto-closes expired markets. All scanning logic runs off-chain with BFT consensus on reads and writes. Indexers remain optional for low latency/UX, but all critical reads and resolution paths are possible directly on-chain. The only intentionally hybrid component is the CLOB due to latency/MEV constraints.

---

### Oracle-Based Resolution (V1.6.1)

Markets may optionally be configured with an on-chain oracle resolver. When configured, markets transition to `Closed` at `resolutionTime` and may be resolved permissionlessly via `resolveByOracle(marketId)`.

**Resolver Types:**


| Type             | Use Case                                          | Resolution Actor                    |
| ---------------- | ------------------------------------------------- | ----------------------------------- |
| `ADMIN`          | Subjective markets (politics, sports outcomes)    | Admin/multisig only                 |
| `CHAINLINK_FEED` | Objectively machine-verifiable (price thresholds) | Permissionless via oracle read      |
| `CUSTOM_ADAPTER` | Complex conditions (multi-feed, off-chain proof)  | Permissionless via adapter contract |


`**resolveByOracle(marketId)` Logic:**

```solidity
function resolveByOracle(uint256 marketId) external {
    Market storage m = markets[marketId];
    if (m.state != MarketState.Closed) revert MarketNotClosed(marketId);
    if (m.oracleConfig.resolverType == ResolverType.ADMIN) revert AdminResolutionOnly();

    // Read oracle
    (int256 answer, uint256 updatedAt) = _readOracle(m.oracleConfig);

    // Staleness check
    if (block.timestamp - updatedAt > m.oracleConfig.staleTolerance)
        revert OracleDataStale(updatedAt, m.oracleConfig.staleTolerance);

    // Snapshot time: oracle must have updated after resolutionTime
    if (updatedAt < m.resolutionTime)
        revert OracleNotYetUpdated(updatedAt, m.resolutionTime);

    // Grace period: cannot resolve too late (forces fallback to admin)
    // NOTE: Use strict > (not >=) so oracle resolution is valid AT the exact expiry second.
    // Admin resolve uses >= to unlock AT the same second. This ensures no gap and no overlap.
    if (block.timestamp > m.resolutionTime + m.oracleConfig.gracePeriod)
        revert GracePeriodExpired(m.resolutionTime, m.oracleConfig.gracePeriod);

    // Determine winner from oracle data + market thresholds
    uint8 winner = _computeWinner(m.oracleConfig, answer);

    // Resolve
    _resolve(marketId, winner, "oracle");
}
```

> **Permissionless Is a Feature:** The CRE resolution workflow provides liveness guarantees, but **anyone** can call `resolveByOracle` if oracle conditions are met. This eliminates single-point liveness failure. Gas cost is bounded and predictable (single oracle read + state update). The CRE workflow is a convenience for automated liveness, not a gatekeeper.

> **Oracle Staleness & Snapshot Semantics:** For price-based markets, the market question is defined as: *"Using the first oracle update on or after `resolutionTime`."* This prevents resolving on stale data, resolving too early, and avoids ambiguous "which timestamp counts?" disputes. The `staleTolerance` and `gracePeriod` provide bounded windows.

**Fallback Resolution:**

If oracle resolution fails (stale feed, adapter revert, grace period expired), the market remains `Closed` and falls back to admin resolution:

```
Closed → (oracle available) → resolveByOracle() → Resolved
Closed → (grace period expired, oracle unavailable) → resolve() by Admin → Resolved
```

> **Fallback Rule:** After `resolutionTime + gracePeriod`, admin `resolve()` is unlocked for oracle-configured markets. Before that deadline, only `resolveByOracle()` is permitted (prevents admin front-running the oracle). This preserves decentralization guarantees during the oracle window while ensuring markets always eventually resolve.
>
> **Grace Period Boundary Semantics (Off-by-One Trap):** The boundary between oracle resolution and admin fallback MUST be tested at the exact second of expiry:
>
> - Oracle: `block.timestamp > deadline` reverts (strict `>`, so `block.timestamp == deadline` is still valid for oracle)
> - Admin: `block.timestamp >= deadline` permits (so `block.timestamp == deadline` is the first valid admin second)
> - This means at `t == resolutionTime + gracePeriod`: **both** oracle and admin can resolve. This is safe because either produces a valid resolution.
> - **Required test:** `test_resolveAtExactGracePeriodBoundary()` — admin tries to resolve at `block.timestamp == resolutionTime + gracePeriod` (should succeed) AND at `block.timestamp == resolutionTime + gracePeriod - 1` (should revert).

> **Oracle Decimal Normalization (Critical):**
>
> Chainlink feeds return prices in varying decimal scales: ETH/USD uses 8 decimals, USDC/USD uses 8 decimals, but some feeds use 18. The market's `resolutionThreshold` MUST be stored in a **canonical scale** (e.g., 18 decimals), and `resolveByOracle()` MUST normalize the oracle answer before comparison:
>
> ```solidity
> // Inside resolveByOracle(marketId)
> (, int256 answer,, uint256 updatedAt,) = priceFeed.latestRoundData();
>
> // 1. Validate answer is positive (negative prices are nonsensical for our markets)
> if (answer <= 0) revert InvalidOracleAnswer(answer);
>
> // 2. Normalize to 18 decimals
> uint8 feedDecimals = priceFeed.decimals(); // e.g., 8
> uint256 normalizedAnswer;
> if (feedDecimals <= 18) {
>     normalizedAnswer = uint256(answer) * 10**(18 - feedDecimals);
> } else {
>     normalizedAnswer = uint256(answer) / 10**(feedDecimals - 18);
> }
>
> // 3. Compare against canonical threshold
> uint8 winner = normalizedAnswer >= market.resolutionThreshold ? YES : NO;
> ```
>
> **Why `answer <= 0` is checked:** Chainlink feeds can return negative values (e.g., during flash crashes, or for feeds like EUR/USD that can technically go negative). For prediction markets asking "Will asset X be above $Y?", a negative price is pathological — the market should fall through to admin resolution rather than auto-resolving with garbage data.
>
> **Market configuration:** `createMarket()` stores `resolutionThreshold` in 18-decimal scale and records the `feedDecimals` from the Chainlink aggregator at creation time. This prevents errors if a feed's decimal configuration changes between market creation and resolution (unlikely but possible during aggregator upgrades).

---

### CRE Workflows (Chainlink Runtime Environment)

Market resolution liveness is provided by **Chainlink CRE (Chainlink Runtime Environment) Workflows** instead of the legacy Chainlink Automation (Keepers) pattern. CRE is Chainlink's orchestration layer that runs TypeScript workflows across a Decentralized Oracle Network (DON), providing built-in BFT consensus on every operation.

**Why CRE over Keepers:**

| Aspect | Keepers (Legacy) | CRE Workflows |
| --- | --- | --- |
| Scanning logic | On-chain (`checkUpkeep`), gas-limited cursor | Off-chain in TypeScript, unbounded |
| Resolution batching | `MAX_RESOLVE` = 3 per call (gas ceiling) | No artificial limit; batch size is configurable |
| Language | Solidity-only | TypeScript (compiled to WASM) |
| Observability | Event logs only | CRE UI: logs, execution traces, metrics |
| Trigger model | Time-based polling only | Cron, HTTP webhook, EVM Log (event-driven) |
| Consensus | N/A (single tx sender) | BFT consensus on reads + writes across DON |
| Upgradability | Redeploy contract + re-register upkeep | Update workflow code, redeploy WASM binary |

#### VaultResolutionConsumer (CRE Consumer Contract)

A lightweight 7th contract (holds no funds, minimal audit surface) that implements the CRE `IReceiver` interface to receive resolution commands from the CRE workflow via the `KeystoneForwarder`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {ReceiverTemplate} from "@chainlink/cre/ReceiverTemplate.sol";
import {IVaultMarket} from "./interfaces/IVaultMarket.sol";

/// @title Vault Resolution Consumer
/// @notice CRE consumer contract that receives market resolution commands
///         from a Chainlink CRE Workflow via the KeystoneForwarder.
/// @dev Holds no funds. Only calls VaultMarket.resolveByOracle() and
///      VaultMarket.closeMarket(). Inherits ReceiverTemplate for
///      forwarder validation, workflow ID checks, and ERC165 support.
contract VaultResolutionConsumer is ReceiverTemplate {
    IVaultMarket public immutable vaultMarket;

    /// @notice Max markets per onReport call to bound gas
    uint256 public constant MAX_MARKETS_PER_REPORT = 10;

    /// @notice Action types the CRE workflow can request
    enum Action { RESOLVE, CLOSE }

    /// @notice Emitted when a resolution attempt succeeds
    event MarketResolved(uint256 indexed marketId);

    /// @notice Emitted when a close attempt succeeds
    event MarketClosed(uint256 indexed marketId);

    /// @notice Emitted when an action fails (try/catch, non-blocking)
    event ActionFailed(uint256 indexed marketId, Action action, bytes reason);

    error InvalidAction(uint8 action);
    error BatchTooLarge(uint256 length, uint256 max);

    constructor(
        address _forwarder,
        address _vaultMarket
    ) ReceiverTemplate(_forwarder) {
        vaultMarket = IVaultMarket(_vaultMarket);
    }

    /// @inheritdoc ReceiverTemplate
    /// @dev Decodes a batch of (action, marketId) pairs and executes each.
    ///      try/catch ensures one failure does not block others.
    function _processReport(bytes calldata report) internal override {
        (uint8 action, uint256[] memory marketIds) =
            abi.decode(report, (uint8, uint256[]));

        if (marketIds.length > MAX_MARKETS_PER_REPORT)
            revert BatchTooLarge(marketIds.length, MAX_MARKETS_PER_REPORT);

        for (uint256 i; i < marketIds.length; i++) {
            if (Action(action) == Action.RESOLVE) {
                try vaultMarket.resolveByOracle(marketIds[i]) {
                    emit MarketResolved(marketIds[i]);
                } catch (bytes memory reason) {
                    emit ActionFailed(marketIds[i], Action.RESOLVE, reason);
                }
            } else if (Action(action) == Action.CLOSE) {
                try vaultMarket.closeMarket(marketIds[i]) {
                    emit MarketClosed(marketIds[i]);
                } catch (bytes memory reason) {
                    emit ActionFailed(marketIds[i], Action.CLOSE, reason);
                }
            } else {
                revert InvalidAction(action);
            }
        }
    }
}
```

> **Supplementary Contract:** This is a justified exception to the "6 contracts" principle. `VaultResolutionConsumer` holds no funds, has no privileged access (calls only permissionless `resolveByOracle` and `closeMarket`), and is a ~60-line contract with minimal audit surface. It replaces the old `VaultAutomationResolver` with a cleaner separation of concerns — all scanning/decision logic lives in the off-chain CRE workflow.

#### CRE Workflow: Market Resolution (TypeScript)

The resolution workflow runs as a WASM binary on a Chainlink DON. It uses a Cron trigger to periodically scan for resolvable markets, then writes resolution commands to the consumer contract via the `KeystoneForwarder`.

```typescript
// workflows/resolution/index.ts
import {
  CronCapability, EVMClient, handler, Runner,
  type Runtime, type CronPayload,
  getNetwork, encodeCallMsg, prepareReportRequest,
  LAST_FINALIZED_BLOCK_NUMBER, bytesToHex,
} from "@chainlink/cre-sdk"
import {
  encodeFunctionData, decodeFunctionResult, zeroAddress,
  encodeAbiParameters, parseAbiParameters,
} from "viem"
import { z } from "zod"
import { VaultMarketABI } from "../contracts/abi"

// --- Config schema (validated at startup) ---
const configSchema = z.object({
  schedule:             z.string(),  // cron expression, e.g. "0 */5 * * * *"
  chainSelectorName:    z.string(),  // e.g. "ethereum-testnet-sepolia-arbitrum-1"
  isTestnet:            z.boolean(),
  vaultMarketAddress:   z.string(),  // VaultMarket contract address
  consumerAddress:      z.string(),  // VaultResolutionConsumer address
  maxResolvePerRun:     z.number().default(10),
  maxClosePerRun:       z.number().default(20),
})
type Config = z.infer<typeof configSchema>

// --- Action enum (matches Solidity) ---
const Action = { RESOLVE: 0, CLOSE: 1 } as const

// --- Callback: fires every cron tick ---
const onCronTrigger = (runtime: Runtime<Config>, _payload: CronPayload): string => {
  const config = runtime.config
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: config.isTestnet,
  })
  if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`)

  const evmClient = new EVMClient(network.chainSelector.selector)

  // 1. Scan ONLY active markets via paginated view (O(activeMarkets), not O(totalMarkets))
  //    Resolved/cancelled markets are excluded from the active list (swap-and-pop),
  //    so this scales with live markets regardless of total historical market count.
  const resolvable: bigint[] = []
  const closeable: bigint[] = []
  const PAGE_SIZE = 50n
  let cursor = 0n

  while (resolvable.length < config.maxResolvePerRun || closeable.length < config.maxClosePerRun) {
    const pageResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: config.vaultMarketAddress,
        data: encodeFunctionData({
          abi: VaultMarketABI,
          functionName: "getActiveMarketIds",
          args: [cursor, PAGE_SIZE],
        }),
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    }).result()

    const activeIds = decodeFunctionResult({
      abi: VaultMarketABI,
      functionName: "getActiveMarketIds",
      data: bytesToHex(pageResult.data),
    }) as bigint[]

    if (activeIds.length === 0) break // no more active markets

    for (const id of activeIds) {
      const marketResult = evmClient.callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: config.vaultMarketAddress,
          data: encodeFunctionData({
            abi: VaultMarketABI,
            functionName: "getMarket",
            args: [id],
          }),
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      }).result()

      const market = decodeFunctionResult({
        abi: VaultMarketABI,
        functionName: "getMarket",
        data: bytesToHex(marketResult.data),
      })

      const now = BigInt(Math.floor(Date.now() / 1000))

      // Check if market needs closing (Active + past resolutionTime)
      if (market.state === 0 /* Active */ && now >= market.resolutionTime) {
        closeable.push(id)
      }

      // Check if market is resolvable (Closed + oracle-based + within grace period)
      if (market.state === 2 /* Closed */ &&
          market.oracleConfig.resolverType !== 0 /* not ADMIN */ &&
          now <= market.resolutionTime + market.oracleConfig.gracePeriod) {
        resolvable.push(id)
      }
    }

    cursor += PAGE_SIZE
  }

  // 3. Submit close commands
  if (closeable.length > 0) {
    const closePayload = encodeAbiParameters(
      parseAbiParameters("uint8, uint256[]"),
      [Action.CLOSE, closeable],
    )
    const closeReport = runtime.report(prepareReportRequest(closePayload)).result()
    evmClient.writeReport(runtime, {
      receiver: config.consumerAddress,
      report: closeReport,
    }).result()
    runtime.log(`Closed ${closeable.length} markets: ${closeable.join(", ")}`)
  }

  // 4. Submit resolution commands
  if (resolvable.length > 0) {
    const resolvePayload = encodeAbiParameters(
      parseAbiParameters("uint8, uint256[]"),
      [Action.RESOLVE, resolvable],
    )
    const resolveReport = runtime.report(prepareReportRequest(resolvePayload)).result()
    evmClient.writeReport(runtime, {
      receiver: config.consumerAddress,
      report: resolveReport,
    }).result()
    runtime.log(`Resolved ${resolvable.length} markets: ${resolvable.join(", ")}`)
  }

  return `close=${closeable.length}, resolve=${resolvable.length}`
}

// --- Workflow entry points ---
const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}
```

**Workflow Configuration (`config.staging.json`):**

```json
{
  "schedule": "0 */5 * * * *",
  "chainSelectorName": "ethereum-testnet-sepolia-arbitrum-1",
  "isTestnet": true,
  "vaultMarketAddress": "0x...",
  "consumerAddress": "0x...",
  "maxResolvePerRun": 10,
  "maxClosePerRun": 20
}
```

#### CRE Workflow Capabilities Used

| Capability | Purpose | Trigger |
| --- | --- | --- |
| **Cron Trigger** | Fire resolution scan every 5 minutes | `0 */5 * * * *` |
| **EVM Read** (`callContract`) | Read market count, market state, oracle config | Per-market |
| **EVM Write** (`writeReport`) | Submit batch close/resolve via consumer contract | Per batch |

> **Event-Driven Enhancement (Future):** Add an EVM Log trigger on `MarketClosed(uint256 indexed marketId)` to attempt resolution immediately when a market transitions to Closed, rather than waiting for the next cron tick. This provides sub-minute resolution latency for oracle-configured markets.

> **No On-Chain Gas Limits:** Unlike the legacy Keeper pattern (which was constrained by `checkUpkeep`/`performUpkeep` gas limits to scan 20 markets and resolve 3 per call), the CRE workflow performs all scanning logic off-chain in TypeScript. The only on-chain gas cost is the `writeReport` transaction, which is a single call to the consumer contract with pre-computed market IDs. `maxResolvePerRun` and `maxClosePerRun` are soft config limits for workflow execution time, not gas ceilings.

> **CRE on Arbitrum:** CRE supports Arbitrum One and Arbitrum Sepolia via chain selectors `ethereum-mainnet-arbitrum-1` (4949039107694359620) and `ethereum-testnet-sepolia-arbitrum-1` (3478487238524512106). The consumer contract requires the Chainlink `KeystoneForwarder` address for the target chain — see the [CRE Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory) for current addresses.

> **Deployment Lifecycle:**
>
> 1. Deploy `VaultResolutionConsumer` with the `KeystoneForwarder` address and `VaultMarket` address
> 2. Configure consumer permissions: `setExpectedWorkflowId()` and `setExpectedAuthor()` for production security
> 3. Build workflow: `cre workflow simulate` for local testing (uses `MockKeystoneForwarder`)
> 4. Deploy workflow: `cre workflow deploy` (Early Access) to run on a Chainlink DON
> 5. Monitor via CRE UI: execution logs, trigger history, error traces

---

### IVaultCLMM (Concentrated Liquidity)

**Read Methods (view/pure):**


| Method                                                                                     | Returns                            | Purpose                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------- |
| `getPool(uint256 marketId, uint8 outcomeId)`                                               | `Pool`                             | Pool state (sqrtPrice, liquidity, tick)       |
| `getPosition(uint256 positionId)`                                                          | `Position`                         | Position details                              |
| `getPositionsByOwner(address owner)`                                                       | `uint256[]`                        | All position IDs for user (bounded; see note) |
| `getPositionsByOwner(address owner, uint256 cursor, uint256 limit)`                        | `uint256[]`                        | Paginated position IDs for user               |
| `getLiquidityInRange(uint256 marketId, uint8 outcomeId, int24 tickLower, int24 tickUpper)` | `uint128`                          | Liquidity in tick range                       |
| `quoteSwap(uint256 marketId, uint8 outcomeId, uint256 amountIn, bool zeroForOne)`          | `(uint256 out, uint256 fee)`       | Simulate swap                                 |
| `getVLPBalance(address owner)`                                                             | `uint256`                          | User's vLP share balance                      |
| `getTotalVLP()`                                                                            | `uint256`                          | Total vLP supply                              |
| `getProtocolLiquidity(uint256 marketId)`                                                   | `uint256`                          | Protocol-owned liquidity                      |
| `getEarnedFees(uint256 positionId)`                                                        | `(uint256 token0, uint256 token1)` | Uncollected fees                              |
| `tickToPrice(int24 tick)`                                                                  | `uint256`                          | Convert tick to price (WAD)                   |
| `priceToTick(uint256 price)`                                                               | `int24`                            | Convert price to nearest tick                 |


**Write Methods (state-changing):**


| Method                                                   | Access        | Purpose                        |
| -------------------------------------------------------- | ------------- | ------------------------------ |
| `addLiquidity(AddLiquidityParams params)`                | User/Protocol | Provide concentrated liquidity |
| `removeLiquidity(RemoveLiquidityParams params)`          | Owner         | Withdraw liquidity             |
| `swap(CLMMSwapParams params)`                            | User          | Execute CLMM swap              |
| `collectFees(uint256 positionId)`                        | Owner         | Collect earned fees            |
| `collectProtocolFees(uint256 marketId, uint8 outcomeId)` | VaultCLMM     | Route POL fees to VaultCredit  |


> **CLMM Audit Priority (HIGH)**: Uniswap v3-style concentrated liquidity math is notoriously error-prone. `CLMMLib` requires:
>
> - Differential fuzz testing against Uniswap v3 reference implementation (mandatory)
> - Fuzz testing all tick/liquidity/price conversions
> - Invariant tests: `liquidity >= 0`, `price ∈ [tickLower, tickUpper]`, fee growth monotonicity
> - Casting discipline: Follow Uniswap v3 reference implementation's casting logic exactly (see SafeCast trap below)

> **CLMM SafeCast Trap (CRITICAL):** Uniswap v3 math relies on **intentional wrapping overflows** in specific places (e.g., fee growth accumulators use `unchecked` uint256 wrapping, tick bitmap uses wrapping int24 arithmetic) and strict checked casts in others (e.g., liquidity delta must not overflow int128). Do **NOT** blindly apply `SafeCastLib` to every variable in `CLMMLib`. Instead: (1) audit each cast site against the Uniswap v3 reference implementation, (2) use `SafeCastLib` only where the reference uses checked casts, (3) use `unchecked` blocks where the reference relies on wrapping, (4) document each cast site with a comment citing the Uniswap v3 source line. Incorrect checked casts on intentionally-wrapping values will cause reverts on valid operations. Incorrect unchecked casts on bounds-critical values will cause silent truncation exploits.

> **Deadlines**: `AddLiquidityParams`, `RemoveLiquidityParams`, and `CLMMSwapParams` include a `deadline` field to prevent stale execution after major price moves.

> **Protocol Fees**: `collectProtocolFees` is used for protocol-owned LP positions; fees are routed into `VaultCredit` (hardening/recourse waterfall) instead of being transferred to `msg.sender`.

> **CLMM Market State Gating:** `addLiquidity()` and `swap()` MUST check `VaultMarket.isMarketActive(marketId)` and revert on paused/resolved markets. `removeLiquidity()` and `collectFees()` remain open regardless of state so LPs can always exit.
>
> **Emergency Pause:** VaultCLMM should respect market-level pauses via `VaultMarket.isMarketActive()`. For a protocol-wide emergency, admin can pause all active markets on VaultMarket, which propagates to CLMM and FPMM. VaultCLOB is implicitly paused by the relayer ceasing to submit batches.

---

### IVaultCLOB (Order Settlement)

**Read Methods (view/pure):**


| Method                                           | Returns                      | Purpose                                          |
| ------------------------------------------------ | ---------------------------- | ------------------------------------------------ |
| `getOrderStatus(bytes32 orderHash)`              | `OrderStatus`                | Open/Filled/Cancelled                            |
| `getFilledAmount(bytes32 orderHash)`             | `uint256`                    | Amount already filled                            |
| `getRemainingAmount(bytes32 orderHash)`          | `uint256`                    | Amount still fillable                            |
| `getNonce(address user)`                         | `uint256`                    | Current nonce for user                           |
| `isValidSignature(Order order, bytes signature)` | `bool`                       | Verify order signature                           |
| `hashOrder(Order order)`                         | `bytes32`                    | Compute EIP-712 order hash                       |
| `DOMAIN_SEPARATOR()`                             | `bytes32`                    | EIP-712 domain separator (dynamic on chain fork) |
| `verifyOrder(Order order, bytes signature)`      | `(bool valid, uint8 reason)` | Full validation with reason code                 |
| `getFailedMatches(uint256 batchId)`              | `bytes32[]`                  | Order hashes that failed in batch                |
| `getFailedMatchReasons(uint256 batchId)`         | `uint8[]`                    | Reason codes per failed match                    |


**Write Methods (state-changing):**


| Method                                            | Access  | Purpose                                                                                |
| ------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `settleBatch(Order[] orders, bytes[] signatures)` | Relayer | Settle matched orders (soft reverts)                                                   |
| `cancelOrder(Order order)`                        | Maker   | Cancel single order (requires full order struct to verify `msg.sender == order.maker`) |
| `cancelOrders(Order[] orders)`                    | Maker   | Batch cancel (verifies maker on each; bounded by `MAX_CANCEL_BATCH = 20`)              |
| `incrementNonce()`                                | User    | Invalidate all pending orders                                                          |


**Events:**


| Event         | Parameters                            | Purpose                          |
| ------------- | ------------------------------------- | -------------------------------- |
| `MatchFailed` | `bytes32 orderHash, uint8 reasonCode` | Individual match failed in batch |


> **Settlement Pattern (Hard Revert):** `settleBatch` uses **hard revert** (not try/catch) for individual matches. If any single match in the batch fails (insufficient balance, cancelled order, expired, etc.), the entire batch reverts. This is the correct choice for a trusted-relayer model:
>
> - The relayer pre-validates all matches off-chain before submitting; failures indicate a bug or race condition, not adversarial input.
> - Hard revert is simpler, cheaper (~2,600 gas saved per match vs external self-call), and easier to audit.
> - On failure, the relayer removes the bad match and resubmits. Turnaround is sub-second on Arbitrum.
> - `try/catch` only catches **external** calls in Solidity. If per-match logic is internal (which it should be for gas efficiency), `try/catch` doesn't work anyway without an expensive `this._settleOneMatch(...)` self-call pattern.
> - `MatchFailed` events are NOT emitted (since the tx reverts). The relayer detects failures via simulation (`eth_call`) before submitting.
>
> **Implementation notes:**
>
> - Bound max matches per batch: `MAX_MATCHES_PER_BATCH = 50` to limit gas consumption
> - Bound per-order validation cost (compact structs, no dynamic strings)
> - Each match is atomic: both legs (buyer pays USDC, seller delivers shares) complete together or neither does

> **CLOB Fee Routing (Unified with VaultRisk):** `settleBatch` MUST call `VaultRisk.getEffectiveFee(marketId, outcomeId, isBuy)` per fill and charge the **same dynamic fee schedule** as FPMM/CLMM venues. Fees are routed to `VaultCredit.depositFees(marketId, feeAmount, FeeSource.CLOB)` so all CLOB fees enter the debt-first waterfall.
>
> **Why fee parity is critical:** If the CLOB charges a fixed 3% while FPMM charges 8%+ during surge/skew conditions, sophisticated flow routes through the cheaper venue, defeating the risk engine's protective pricing. This directly undermines IL Reduction Strategy 5 (dynamic fee uplift on high-skew markets) which depends on ALL venues charging the elevated rate. The fee schedule MUST be unified across all venues — `VaultRisk.getEffectiveFee()` is the single source of truth for fee calculation.

> **CLOB Velocity Update (Critical):** `settleBatch` MUST call `VaultRisk.updateVelocity(notional)` after processing fills. Without this, CLOB volume is invisible to the surge fee engine and attackers can route massive directional flow through the CLOB at base fees while FPMM/CLMM traders pay surge pricing. VaultCLOB must be added to the `VaultRisk.updateVelocity` whitelist alongside VaultMarket and VaultCLMM.

> **Settlement Correctness (Critical)**: The on-chain settlement MUST verify:
>
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


| Method                                                                                 | Returns      | Purpose                                |
| -------------------------------------------------------------------------------------- | ------------ | -------------------------------------- |
| `getVelocity()`                                                                        | `uint256`    | Current velocity V (WAD)               |
| `getSurgeMultiplier()`                                                                 | `uint256`    | Current surge M (WAD, 1e18 = 1x)       |
| `getInventorySkew(uint256 marketId, uint8 outcomeId)`                                  | `int256`     | Skew z_i (signed WAD)                  |
| `getEffectiveFee(uint256 marketId, uint8 outcomeId, bool isBuy)`                       | `uint256`    | Computed fee (bps)                     |
| `getBaselineFee()`                                                                     | `uint256`    | f0 baseline (300 bps)                  |
| `getMaxFee()`                                                                          | `uint256`    | f_max cap                              |
| `getRiskParams()`                                                                      | `RiskParams` | All params struct                      |
| `getLastUpdateBlock()`                                                                 | `uint256`    | Block of last velocity update          |
| `previewEffectiveFee(uint256 notional, uint256 marketId, uint8 outcomeId, bool isBuy)` | `uint256`    | Fee after hypothetical trade           |
| `getReferenceMidPrice(uint256 marketId)`                                               | `uint256`    | CLOB mid-price for inventory skew calc |


**Write Methods (state-changing):**


| Method                             | Access   | Purpose                             |
| ---------------------------------- | -------- | ----------------------------------- |
| `updateVelocity(uint256 notional)` | Internal | Called by Market/CLMM/CLOB on trade |
| `setRiskParams(RiskParams params)` | Admin    | Update risk parameters              |
| `setLUT(bytes lutData)`            | Admin    | Upload new surge LUT (validated)    |


> **LUT Validation (setLUT)**: Before accepting a new LUT, validate:
>
> - **Monotonicity**: `LUT[i] <= LUT[i+1]` for surge multipliers (fees increase with velocity)
> - **Bounds**: All values within `[1e18, f_max * 1e18]` (1x to max multiplier)
> - **Length**: Expected array length matches step count
> - **Rollback**: Keep last-known-good LUT; revert to it if validation fails
>
> A malformed LUT can brick fee calculations or create exploitable discontinuities.

> **Reference Price Oracle**: Inventory skew calculation uses CLOB mid-price (from `getReferenceMidPrice`) rather than AMM spot price. This prevents attackers from manipulating AMM reserves to artificially reduce skew penalties before large directional trades.
>
> **Mid-Price Derivation Rules** (oracle hardening):
>
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


| Method                                                 | Returns                            | Purpose                               |
| ------------------------------------------------------ | ---------------------------------- | ------------------------------------- |
| `getProfile(uint256 profileId)`                        | `Profile`                          | Full profile struct                   |
| `getProfileByWallet(address wallet)`                   | `(uint256 profileId, bool exists)` | Lookup by wallet                      |
| `getProfileWallets(uint256 profileId)`                 | `address[]`                        | All linked wallets                    |
| `getCreditLimit(uint256 profileId)`                    | `uint256`                          | Current limit                         |
| `getDebt(uint256 profileId)`                           | `uint256`                          | Outstanding debt                      |
| `getAvailableCredit(uint256 profileId)`                | `uint256`                          | limit - debt                          |
| `getEscrowedFees(uint256 profileId, uint256 marketId)` | `uint256`                          | Fees escrowed for market              |
| `getTotalEscrowedFees(uint256 profileId)`              | `uint256`                          | Total across all markets              |
| `getProfileStatus(uint256 profileId)`                  | `ProfileStatus`                    | Tier (Creator/TrustedKOL/Public)      |
| `isProfileRegistered(address wallet)`                  | `bool`                             | Has profile?                          |
| `getDebtHistory(uint256 profileId)`                    | `DebtRecord[]`                     | Historical debt records               |
| `getClaimable(uint256 profileId)`                      | `uint256`                          | Net withdrawable after debt repayment |


**Write Methods (state-changing):**


| Method                                                            | Access                          | Purpose                                                                         |
| ----------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `linkWallet(address wallet, bytes signature)`                     | User                            | Link wallet to profile (auto-creates profile if needed; requires wallet's EIP-712 consent) |
| `unlinkWallet(address wallet)`                                    | ProfileOwner                    | Remove wallet (callable by profile owner or the wallet being unlinked)          |
| `setCreditLimit(uint256 profileId, uint256 limit)`                | Admin                           | Set/update credit limit (auto-creates profile via `_ensureProfile` if needed)   |
| `recordDebt(uint256 profileId, uint256 amount)`                   | Internal                        | Add debt (called by Market)                                                     |
| `depositFees(uint256 marketId, uint256 amount, FeeSource source)` | VaultMarket/VaultCLOB/VaultCLMM | Deposit fees into debt-first waterfall                                          |
| `withdrawEarnings()`                                              | ProfileOwner                    | Auto-processes pending earnings (finality-gated), then pulls claimable funds    |
| `setProfileStatus(uint256 profileId, ProfileStatus status)`       | Admin                           | Update tier (auto-creates profile via `_ensureProfile` if needed)               |


> **Pull Pattern (Merged)**: `withdrawEarnings()` auto-processes pending earnings for up to `MAX_AUTO_PROCESS` (5) resolved markets where `block.timestamp >= finalityDeadline`, then transfers all claimable funds. This merges two transactions (`processEarnings` + `withdrawEarnings`) into one value-bearing call. For profiles with many pending markets, repeated calls process in batches. This prevents revert-on-receive attacks (pull, not push) and eliminates a purposeless intermediate transaction.
>
> **Pending Markets Data Structure (Gas Trap Prevention):**
>
> The pending markets per profile (`pendingMarkets[profileId]`) MUST use a **cursor-indexed linked list** or **swap-and-pop array** — NOT a naive array that shifts elements on deletion. Without this, `withdrawEarnings()` gas cost grows linearly with total-ever-pending markets (including already-processed ones).
>
> ```solidity
> // Recommended: swap-and-pop for O(1) removal
> mapping(uint256 => uint256[]) internal pendingMarkets; // profileId => marketId[]
> mapping(uint256 => mapping(uint256 => uint256)) internal pendingIndex; // profileId => marketId => index
>
> function _removePending(uint256 profileId, uint256 marketId) internal {
>     uint256 idx = pendingIndex[profileId][marketId];
>     uint256 lastIdx = pendingMarkets[profileId].length - 1;
>     if (idx != lastIdx) {
>         uint256 lastMarket = pendingMarkets[profileId][lastIdx];
>         pendingMarkets[profileId][idx] = lastMarket;
>         pendingIndex[profileId][lastMarket] = idx;
>     }
>     pendingMarkets[profileId].pop();
>     delete pendingIndex[profileId][marketId];
> }
> ```
>
> **Why this matters:** A prolific creator or KOL may participate in 1,000+ markets. If `pendingMarkets` is a flat array that shifts on removal, processing the first market costs O(N) to shift all subsequent elements. Over time, even `MAX_AUTO_PROCESS = 5` iterations become expensive. The swap-and-pop pattern ensures O(1) removal regardless of array size.
>
> **Cursor for `withdrawEarnings` iteration:** The `MAX_AUTO_PROCESS` loop iterates from `pendingMarkets[profileId].length - 1` downward, checking finality. Processed markets are removed via swap-and-pop. If no finalized markets remain in the first 5 checked, the function proceeds directly to the claimable balance transfer (no revert). A view function `getPendingMarketCount(profileId)` allows UIs to show progress.

> **Lazy Profile Creation**: There is no user-facing `registerProfile()`. Profiles are created atomically via `_ensureProfile(address)` when needed — triggered by admin actions (`setCreditLimit`, `setProfileStatus`) or user `linkWallet()`. Casual traders never pay gas for identity registration.

> **Fee Ingestion**: `depositFees(marketId, amount, FeeSource)` is callable by `VaultMarket` (FPMM), `VaultCLOB` (CLOB fills), and `VaultCLMM` (protocol LP fees). This ensures all venue fees flow into the debt-first waterfall.

> **Fee Events**: `depositFees` emits `FeesDeposited(marketId, amount, source)` for indexing.

> **Earnings Finality Enforcement (On-Chain):** `processEarnings()` MUST revert with `EarningsFinalityActive(marketId, finalityDeadline)` if `block.timestamp < market.finalityDeadline`. This ensures the earnings finality delay is enforced at the contract level, not just cosmetically in the UI. **Naming rationale:** This delay is NOT a dispute mechanism (there is no on-chain dispute/arbitration flow). It is a **finality buffer** that gives admins time to correct an erroneous resolution via `resolve()` override before creator/LP earnings are distributed. Calling it "dispute period" falsely implies a formal dispute process exists. `redeem()` is callable immediately after resolution since users are redeeming their own winning shares — losers never need to transact at all.

> **Wallet Link Authorization:** `linkWallet()` requires an EIP-712 signature from the wallet being linked, preventing unauthorized profile association. Without this, an attacker could link a victim's wallet to their own profile and subject the victim's earnings to the attacker's debt-first waterfall. `unlinkWallet()` is callable by either the profile owner or the wallet itself (so a wallet can always remove itself).

> **Wallet Array Gas Safety:** Profile wallets are stored for enumeration, but all state-changing functions MUST use mapping-based membership checks (`isWalletLinked[address] => profileId`), never iterate the array. On-chain enumeration is view-only via `getProfileWallets()`. Consider capping wallets per profile (e.g., `MAX_WALLETS_PER_PROFILE = 10`) to bound view-function gas.

> **Credit Line Scope:** `recordDebt()` is restricted to VaultMarket only. Credit is intentionally scoped to FPMM market creation / initial liquidity seeding. If credit is ever extended to CLMM LP seeding or CLOB margin, the ACL and debt accounting must be expanded accordingly.

---

## User Workflows

This section maps user journeys to contract calls, events, and backend integration points.

### Workflow 1: User Onboarding

**Scenario**: New user connects wallet and starts trading.

> **No on-chain registration required for casual traders.** Profiles (VaultCredit) are only needed for creators/KOLs who use credit lines and the debt-first waterfall. Regular traders interact with bare wallet addresses — `balanceOf`, `swap`, `split`, `merge`, `redeem` are all keyed by `msg.sender`, not `profileId`. Profiles are created lazily by admin actions (`setProfileStatus`, `setCreditLimit`) or when a user calls `linkWallet()`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                    │
│ 1. User connects wallet (wagmi/viem)                                        │
│ 2. Check USDC balance and allowance                                         │
│ 3. If needed, approve USDC (one-time)                                       │
│ 4. Ready to trade — no profile registration tx needed                       │
│                                                                             │
│ NOTE: Profile creation (VaultCredit) is only triggered when admin            │
│ grants creator/KOL status. Casual traders never pay gas for identity.       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS (view only — no tx, no gas)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Step 1: Check USDC balance                                               │
│ uint256 balance = usdc.balanceOf(userAddress);                              │
│                                                                             │
│ // Step 2: Check allowance for VaultToken (for split/swap)                  │
│ uint256 allowance = usdc.allowance(userAddress, address(vaultToken));       │
│                                                                             │
│ // Step 3: Optionally check profile (for creators/KOLs only)               │
│ (uint256 profileId, bool exists) =                                          │
│     vaultCredit.getProfileByWallet(userAddress);                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS (tx — only if USDC not yet approved)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ // One-time USDC approval (~25K gas, ~$0.01 on Arbitrum)                    │
│ usdc.approve(address(vaultToken), type(uint256).max);                       │
│ // This is the ONLY onboarding transaction — and it's standard ERC-20.      │
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
│ // 3. Deduct dynamic fee via VaultRisk.getEffectiveFee() per fill            │
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
│ // 2. finalityDeadline = block.timestamp + EARNINGS_FINALITY_DELAY                    │
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
│     uint256 finalityDeadline                                                 │
│ );                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ WINNER FLOW (Redemption) - callable immediately after resolution             │
│ NOTE: Losers NEVER need to transact. Losing shares are inert on-chain.      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTRACT CALLS (Winner only)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ // Step 1: Check redemption amount (view — no gas)                          │
│ uint256 redeemable = vaultMarket.getRedemptionAmount(marketId, user);       │
│ // Returns USDC payout (>0 for winners, 0 for losers)                       │
│ // Frontend: only show "Redeem" button when redeemable > 0                  │
│                                                                             │
│ // Step 2: Redeem winning shares                                            │
│ uint256 usdcReceived = vaultMarket.redeem(marketId);                        │
│                                                                             │
│ // This:                                                                    │
│ // 1. Burns winning shares via VaultToken.settle() → releases USDC          │
│ // 2. Losing shares are LEFT INERT in user's wallet (not burned)            │
│ //    - Zero economic value, zero gas cost to hold, zero harm               │
│ //    - Frontend hides them (resolved losing position = "Market Lost")      │
│ // 3. Reverts with NothingToRedeem if user has zero winning shares          │
│ //    - Losers should NEVER reach this code path (frontend gates it)        │
│ //                                                                          │
│ // SCALE: 1M+ users per market. Each winner pays ~25K gas on Arbitrum       │
│ // (~$0.01). Losers pay 0 gas. No batch/push burning. No iteration.         │
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
│ // Single call: auto-processes pending earnings + withdraws claimable funds │
│ // (processEarnings is absorbed into withdrawEarnings — no separate tx)     │
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


| Workflow         | Contracts Involved                 | Key Write Methods                        | Backend Integration          |
| ---------------- | ---------------------------------- | ---------------------------------------- | ---------------------------- |
| Create Event     | VaultMarket                        | `createEvent()`                          | Event indexing               |
| Onboarding       | USDC (ERC-20)                      | `approve()` (one-time)                   | Wallet tracking              |
| Deposit          | VaultToken, USDC                   | `split(marketId, amount)`                | Position tracking            |
| Buy (FPMM)       | VaultMarket, VaultRisk, VaultToken | `swap(SwapParams)`                       | Trade history, prices        |
| Sell (FPMM)      | VaultMarket, VaultRisk, VaultToken | `swap(SwapParams)`                       | Trade history, prices        |
| Place Order      | VaultCLOB (off-chain)              | -                                        | Orderbook                    |
| Cancel Order     | VaultCLOB                          | `cancelOrder()`                          | Orderbook                    |
| Settle Batch     | VaultCLOB, VaultToken, VaultCredit | `settleBatch()`                          | Fills, positions, fee escrow |
| Add Liquidity    | VaultCLMM, VaultToken, USDC        | `addLiquidity(AddLiquidityParams)`       | LP positions                 |
| Remove Liquidity | VaultCLMM                          | `removeLiquidity(RemoveLiquidityParams)` | LP positions                 |
| Collect Fees     | VaultCLMM                          | `collectFees()`                          | LP earnings                  |
| Resolution       | VaultMarket                        | `resolve()`                              | Market state                 |
| Redemption       | VaultMarket, VaultToken            | `redeem()`                               | PnL, positions               |
| Withdraw         | VaultToken                         | `merge()`                                | Positions                    |
| Creator Fees     | VaultCredit                        | `withdrawEarnings()`                     | Earnings, debt               |


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

// Check claimable amount (view — no gas, no tx)
uint256 claimable = vaultMarket.getRedemptionAmount(42, user);
// Returns: 250e6 for winners (user had 250 winning shares)
// Returns: 0 for losers (user held only losing shares)
// Frontend: only show "Redeem" button when claimable > 0

// Winner redeems — burns winning shares, receives USDC
uint256 received = vaultMarket.redeem(42);
// Burns winning shares via VaultToken.settle(), returns USDC
// Losing shares remain inert in user's wallet (not burned — zero cost at scale)
// Reverts with NothingToRedeem if user has zero winning shares

// LOSERS: No transaction needed. Frontend shows "Market Lost" badge.
// Losing ERC-1155 shares sit in wallet with $0 value — harmless storage slots.
// Same pattern as Polymarket/Gnosis CTF: dead conditional tokens are never burned.
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

// Profiles are created lazily — no registerProfile() call needed.
// Admin grants status, which auto-creates profile internally:
// vaultCredit.setProfileStatus(profileId, ProfileStatus.Creator);
// Or user links wallet, which auto-creates if needed:
// vaultCredit.linkWallet(walletAddress, eip712Signature);

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


| Event                  | Subgraph Entity                   | Key Fields                                             |
| ---------------------- | --------------------------------- | ------------------------------------------------------ |
| `Split`                | `Split`, `UserBalance`            | marketId, user, amount, timestamp                      |
| `Merge`                | `Merge`, `UserBalance`            | marketId, user, amount, timestamp                      |
| `TransferSingle/Batch` | `Transfer`, `UserBalance`         | from, to, tokenId, amount                              |
| `EventCreated`         | `Event`                           | eventId, eventKey, metadataURI                         |
| `EventUpdated`         | `Event`                           | eventId, metadataURI, flags                            |
| `MarketCreated`        | `Market`                          | marketId, question, outcomes, creator                  |
| `Swap`                 | `Trade`, `Market`, `UserPosition` | marketId, user, outcome, isBuy, amounts, fee, newPrice |
| `MarketResolved`       | `Market`                          | marketId, winner, evidenceUri, timestamp               |
| `Redeemed`             | `Redemption`, `UserPosition`      | marketId, user, amounts                                |
| `LiquidityAdded`       | `Position`, `Pool`                | positionId, owner, ticks, liquidity                    |
| `LiquidityRemoved`     | `Position`, `Pool`                | positionId, amounts                                    |
| `OrderFilled`          | `Order`, `Fill`                   | orderHash, maker, taker, amount, price                 |
| `BatchSettled`         | `Settlement`                      | batchId, orders, volume                                |
| `VelocityUpdated`      | `RiskMetric`                      | velocity, surge, timestamp                             |
| `ProfileRegistered`    | `Profile`                         | profileId, wallet                                      |
| `CreditUsed`           | `CreditEvent`, `Profile`          | profileId, amount, newDebt                             |
| `FeesDeposited`        | `Fees`, `Market`                  | marketId, amount, source                               |
| `EarningsProcessed`    | `Earnings`, `Profile`             | profileId, gross, debt, net                            |
| `EarningsWithdrawn`    | `Earnings`, `Profile`             | profileId, amount                                      |


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


| API Endpoint              | Contract Call                                 | Caching Strategy             |
| ------------------------- | --------------------------------------------- | ---------------------------- |
| `GET /markets`            | `getMarket()`, Subgraph                       | Cache 5s, invalidate on Swap |
| `GET /events`             | `getEventCount()`, `getEvent()`               | Cache 10s                    |
| `GET /events/:id/markets` | `getEventMarketCount()`, `getEventMarketId()` | Cache 10s                    |
| `GET /markets/:id/prices` | `getAllPrices()`                              | Cache 1s, WebSocket updates  |
| `GET /markets/:id/depth`  | `getReserves()`, CLMM queries                 | Cache 2s                     |
| `POST /orders`            | Sign only (off-chain)                         | -                            |
| `GET /orders/:hash`       | `getOrderStatus()`                            | Cache until filled           |
| `POST /quote`             | `quoteSwapIn()`                               | No cache (real-time)         |
| `GET /positions/:user`    | Subgraph + `balanceOfBatch()`                 | Cache 10s                    |
| `GET /profile/:wallet`    | `getProfileByWallet()`                        | Cache 60s                    |


### UI ↔ On-Chain Alignment (markets-web parity)

The on-chain app must preserve **current markets-web UX** (select outcome → enter dollar amount → confirm; sell by shares). The contract calls below are designed to match existing UI inputs with minimal changes.


| Current UX Action (markets-web) | Off-Chain API Today          | On-Chain Equivalent                             | Notes                                 |
| ------------------------------- | ---------------------------- | ----------------------------------------------- | ------------------------------------- |
| Buy shares with $ amount        | `POST /api/trades/buy`       | `VaultMarket.swap(SwapParams)`                  | `isBuy=true`, `amountIn=USDC(6d)`     |
| Sell shares by quantity         | `POST /api/trades/sell`      | `VaultMarket.swap(SwapParams)`                  | `isBuy=false`, `amountIn=shares(18d)` |
| Quote buy/sell                  | `GET/POST /api/trades/quote` | `quoteSwapIn/quoteSell` + `previewEffectiveFee` | Use same slippage UI                  |


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


| Event Type         | Source               | Payload                                                      |
| ------------------ | -------------------- | ------------------------------------------------------------ |
| `price_update`     | Swap event           | `{ marketId, prices, timestamp }`                            |
| `trade`            | Swap event           | `{ marketId, user, outcome, isBuy, amounts, fee, newPrice }` |
| `order_filled`     | OrderFilled event    | `{ orderHash, maker, taker, fill }`                          |
| `market_resolved`  | MarketResolved event | `{ marketId, winner }`                                       |
| `orderbook_update` | Matcher              | `{ marketId, bids, asks }`                                   |


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

## Two-App Architecture & Graduation System

### App Topology

Vault Markets operates as **two distinct frontend applications** sharing a common backend, connected by a market and user graduation pipeline:


|                  | markets-web (Predictor)                                             | markets-arena (Real Money)                            |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| **Purpose**      | Free-to-play predictor, market incubator, demand oracle             | Real-money prediction market with on-chain settlement |
| **Balance**      | Virtual ($10k starting credit)                                      | USDC (on-chain, user's wallet)                        |
| **Auth**         | Twitter OAuth via Privy                                             | Privy embedded wallet + optional external wallet      |
| **Trading**      | Off-chain CPMM (DB transactions)                                    | On-chain FPMM / CLMM / CLOB                           |
| **Positions**    | DB `Position` table                                                 | ERC-1155 `VaultToken.balanceOf`                       |
| **Settlement**   | Admin settle + user redeem (DB)                                     | Pull-based `redeem()` on-chain                        |
| **Gamification** | XP, streaks, badges, KOL competition, referrals, daily spins        | Real PnL, leaderboard (from indexer)                  |
| **Shared**       | Backend API, Postgres DB, event/market metadata, resolution sources | Backend API, Postgres DB, subgraph/indexer            |


> **Predictor as Market Intelligence:** `markets-web` is not just a game — it is a **demand oracle and price discovery engine**. Off-chain prediction data provides: (1) market viability signals (volume + unique bettors prove demand), (2) initial price discovery (crowd sentiment before real money is at stake), (3) CLMM band intelligence (where users cluster bets informs concentrated liquidity ranges), and (4) volume forecasting (off-chain trading rate predicts on-chain surge fee levels).

### Market Graduation System

Markets start in `markets-web` (free-to-play) and graduate to `markets-arena` (real money) when they prove demand.

**Graduation Criteria:**


| Criterion           | Threshold                      | Notes                                           |
| ------------------- | ------------------------------ | ----------------------------------------------- |
| Virtual volume      | $50k+                          | Proves genuine interest                         |
| Unique bettors      | 50+                            | Prevents single-user inflation                  |
| Price stability     | < 20% swing in 24h             | Market has found equilibrium                    |
| Liquidity threshold | `graduationThreshold` USDC met | From ONCHAIN_REQUIREMENTS (default: 1,000 USDC) |
| Admin approval      | Required (or auto-graduate)    | Final gate                                      |


**Graduation Flow:**

```
markets-web (off-chain)                     markets-arena (on-chain)
┌─────────────────────┐                    ┌──────────────────────┐
│ 1. Market created   │                    │                      │
│    (DRAFT → OPEN)   │                    │                      │
│                     │                    │                      │
│ 2. Users trade      │                    │                      │
│    (virtual $)      │                    │                      │
│                     │                    │                      │
│ 3. Hits graduation  │   createMarket()   │ 4. Market deployed   │
│    criteria ────────┼───────────────────►│    (Active)          │
│                     │   params seeded    │                      │
│ 5. Stays live as    │   from off-chain   │ 6. Real-money        │
│    predictor (opt.) │   price/volume     │    trading begins    │
└─────────────────────┘                    └──────────────────────┘
```

**Contract Integration:** `CreateMarketParams` already includes `initialLiquidity` and `initialPrices`. Graduation is a backend/admin operation that calls `VaultMarket.createMarket()` with parameters derived from off-chain data. No new contract changes required — the graduation logic lives in the backend.

**Post-Graduation:** The off-chain market can optionally stay live as a parallel free-to-play predictor (useful for continued signal generation) or be closed. Both versions share the same `eventId` for metadata linkage.

### User Graduation Path

Users graduate from free-to-play to real-money trading:

1. **Start in markets-web:** User signs up with Twitter OAuth, gets $10k virtual balance, earns XP, builds streaks.
2. **Graduation trigger:** User connects a wallet (Privy creates an embedded wallet on first on-chain action, or user connects MetaMask/external wallet).
3. **On-chain profile:** Created lazily via `VaultCredit._ensureProfile()` when admin grants creator/KOL status. Same Privy `userId` links both accounts. Casual traders do not need on-chain profiles.
4. **Reputation carries over:** Off-chain XP, streak length, and KOL status inform the on-chain `ProfileStatus` tier (Creator, TrustedKOL). This affects credit limits.
5. **Balance does NOT carry over:** Virtual balance stays in `markets-web`. Real USDC must be deposited via `VaultToken.split()` or direct wallet funding.

### Predictor Signal Pipeline

`markets-web` prediction data feeds market making decisions in `markets-arena` via a backend signal API (dashboard for market makers and admins, not auto-seeded):


| Signal              | Source                                                     | Use                                               |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| Price discovery     | Off-chain CPMM prices + confidence                         | Initial FPMM reserve ratios for graduated markets |
| Volume heatmap      | Volume by price bucket (e.g., bets clustered at 0.60–0.70) | Informs CLMM tick range configuration             |
| Bet distribution    | Outcome split (e.g., 65/35 Yes/No)                         | Initial FPMM seed prices                          |
| Volume velocity     | Off-chain trading rate (bets/hour)                         | Predicts on-chain surge fee levels                |
| Market health score | Composite (volume, unique users, price stability)          | Graduation readiness indicator                    |


**Signal API endpoints** (backend, read by market makers / admin dashboard):


| Endpoint                                           | Returns                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/signals/market/:id/price-discovery`      | Current off-chain prices, confidence interval, unique bettor count |
| `GET /api/signals/market/:id/volume-heatmap`       | Volume by price bucket (0.05 increments)                           |
| `GET /api/signals/market/:id/graduation-readiness` | Composite score (0–100) with per-criterion breakdown               |
| `GET /api/signals/markets/candidates`              | All markets meeting graduation criteria, sorted by readiness       |


---

## On-Chain / Off-Chain / Indexer Boundary


| Data                                 | Where It Lives                                          | Source                                              |
| ------------------------------------ | ------------------------------------------------------- | --------------------------------------------------- |
| Market metadata (question, outcomes) | On-chain (`VaultMarket.getMarket`) + DB                 | Admin creates in DB, deploys to chain at graduation |
| Event metadata                       | On-chain (`VaultMarket.getEvent`) + DB                  | Same                                                |
| FPMM reserves / prices               | On-chain (`getReserves`, `getAllPrices`)                | Contract state                                      |
| User balance (USDC)                  | On-chain (ERC-20 `balanceOf`)                           | User's wallet                                       |
| User shares                          | On-chain (ERC-1155 `balanceOf`)                         | VaultToken                                          |
| Trade history                        | Indexer/Subgraph (from `Swap` events)                   | On-chain events                                     |
| Avg cost basis                       | Indexer (computed from `Swap` events)                   | NOT on-chain                                        |
| Realized PnL                         | Indexer (from `Swap` + `Redeemed` events)               | Computed                                            |
| Unrealized PnL                       | Indexer (current price - avg cost)                      | Computed                                            |
| Volume (per user/market)             | Indexer (aggregated from events)                        | Computed                                            |
| Price history                        | Indexer (from `Swap.newPrice` field)                    | On-chain events                                     |
| Win rate                             | Indexer (from `Redeemed` events)                        | Computed                                            |
| XP / Streaks / Badges                | Backend DB only                                         | Off-chain gamification                              |
| KOL competition                      | Backend DB only                                         | Off-chain                                           |
| Referrals / Daily spins              | Backend DB only                                         | Off-chain                                           |
| Bookmarks                            | Backend DB only                                         | Off-chain                                           |
| Credit limits / Debt                 | On-chain (`VaultCredit`)                                | Contract state                                      |
| Profile / Wallets                    | On-chain (`VaultCredit`) + DB                           | Both                                                |
| Resolution sources                   | Backend DB (research trail) + On-chain (`OracleConfig`) | Both                                                |
| Off-chain prediction data            | Backend DB (`markets-web`)                              | Predictor signals                                   |


---

## Market Lifecycle Mapping (Off-Chain to On-Chain)

The off-chain system has 7 market states. The on-chain system has 5. The mapping:

```
OFF-CHAIN (markets-web)               ON-CHAIN (markets-arena)
──────────────────────                ─────────────────────────
DRAFT (admin CMS)          ─┐
PUBLISHED (visible)         │─── Pre-chain (DB only)
OPEN (free-to-play trading)─┘
                             ├── Graduation ──► Active (on-chain trading)
                             │                  Paused (emergency)
CLOSED (awaiting resolution) │                  Closed (awaiting resolution)
RESOLVED (winner set)        │                  Resolved (winner set, pull-based redeem)
SETTLED (payouts distributed)│                  (implicit — users call redeem())
CANCELLED (voided)           │                  Cancelled (admin refund, pull-based)
```

**Key differences:**

- **DRAFT / PUBLISHED** are admin CMS states. Markets exist only in the database until graduation deploys them on-chain.
- **SETTLED** has no on-chain equivalent. Settlement is implicit — users call `redeem()` (pull pattern). The indexer tracks who has redeemed.
- **CANCELLED** is a new on-chain terminal state (see below).

---

## Stats & Metrics Preservation

Every metric currently tracked in the off-chain system, mapped to its on-chain event source and indexer computation:


| Current Metric     | On-Chain Event Source                               | Indexer Computation                                         |
| ------------------ | --------------------------------------------------- | ----------------------------------------------------------- |
| User balance       | `USDC.balanceOf(user)`                              | Direct read                                                 |
| Shares per outcome | `VaultToken.balanceOf(user, tokenId)`               | Direct read                                                 |
| Avg cost per share | `Swap` events (`amountIn`, `sharesOut`)             | Weighted average from trade history (FIFO or weighted)      |
| Realized PnL       | `Swap` (sells) + `Redeemed` events                  | `sum(proceeds - costBasis)`                                 |
| Unrealized PnL     | Current price vs avg cost                           | `(currentPrice * shares) - (avgCost * shares)` per position |
| Total volume       | `Swap.amountIn` + `OrderFilled.filledAmount`        | Sum per user / per market                                   |
| Price history      | `Swap.newPrice` field                               | Time series indexed by block timestamp                      |
| Win rate           | `Redeemed` events (winning count / total positions) | Aggregated per user                                         |
| Trade count        | `Swap` + `OrderFilled` event count                  | Count per user                                              |
| Largest win        | `Redeemed.usdcReceived` - cost basis                | Max per user                                                |
| Market liquidity   | `getReserves()` + CLMM `getLiquidityInRange()`      | Direct read + aggregation                                   |
| Fee revenue        | `FeesDeposited` events                              | Sum per market / per source                                 |


> **Leaderboard computation** moves from the cron-refreshed `LeaderboardPnLSnapshot` materialized view to an indexer-computed entity. The subgraph maintains `UserStats` entities updated on every `Swap` and `Redeemed` event, providing real-time leaderboard data without cron jobs.

---

## Admin CRUD Parity

Every admin operation in the off-chain system, mapped to its on-chain equivalent:


| Off-Chain Admin Action | On-Chain Equivalent                  | Notes                                               |
| ---------------------- | ------------------------------------ | --------------------------------------------------- |
| Create Event           | `VaultMarket.createEvent()`          | On-chain at graduation time                         |
| Update Event           | `VaultMarket.updateEvent()`          | Metadata/flags                                      |
| Create Market (DRAFT)  | Backend DB only                      | Pre-chain CMS state                                 |
| Publish Market (OPEN)  | `VaultMarket.createMarket()`         | On-chain deployment IS "publish"                    |
| Close Market           | `closeMarket()` or lazy close        | Permissionless at `resolutionTime`                  |
| Resolve Market         | `resolve()` or `resolveByOracle()`   | Admin or oracle path                                |
| Settle Market          | N/A — pull-based `redeem()`          | No explicit settle step on-chain                    |
| Cancel Market          | `cancelMarket()` **(NEW)**           | Admin-only, pull-based refund                       |
| Cancel Bet (admin)     | N/A — trades are atomic on-chain     | Cannot undo a swap                                  |
| Adjust Balance         | N/A — USDC is user's wallet          | Off-chain only for virtual balance                  |
| Adjust XP              | Backend DB only                      | Off-chain gamification                              |
| Grant/Revoke KOL       | `VaultCredit.setProfileStatus()`     | On-chain profile tier                               |
| Set Credit Limit       | `VaultCredit.setCreditLimit()`       | On-chain                                            |
| Recalibrate AMM        | N/A — deterministic on-chain         | Not needed                                          |
| Resolution Sources     | Backend DB + on-chain `OracleConfig` | Research trail stays in DB; oracle is authoritative |
| AI Generate Market     | Backend only                         | Creates DRAFT in DB                                 |
| Upload Assets          | Backend only                         | IPFS / Vercel Blob                                  |
| Feature Flags          | Backend DB only                      | Off-chain                                           |
| Tag Management         | Backend DB only                      | Off-chain (events use `metadataURI` on-chain)       |


---

## Resolution Source Integration

The existing off-chain resolution source system integrates with the on-chain oracle system:

- `**ResolutionSource` / `ResolutionDataPoint` tables** stay in the backend DB as the admin's research and verification trail. This workflow is unchanged.
- **On-chain `OracleConfig**` is set per market for automated (Chainlink) resolution. The oracle is the authoritative source on-chain.
- **Admin resolution** (`resolve()`) works exactly like today: admin selects the winning outcome and provides an evidence URL. The `evidence` string parameter replaces `resolutionSourceUrl`.
- **For oracle markets:** Admin resolution is blocked until `gracePeriod` expires (prevents admin front-running the oracle). After grace period, admin fallback unlocks.
- **Verification flow preserved:** Admins still create data points, verify them, and use them as research. The on-chain oracle is a separate, automated path for machine-verifiable markets.

---

## Wallet Strategy


| Phase                         | Auth                  | Wallet                                                   | Trading UX                                                                          |
| ----------------------------- | --------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Current (markets-web)**     | Twitter OAuth (Privy) | None                                                     | Instant (DB transaction)                                                            |
| **V1 Launch (markets-arena)** | Twitter OAuth (Privy) | Privy embedded wallet (created on first on-chain action) | Tx signing per trade (Privy popup)                                                  |
| **V2 (markets-arena)**        | Same                  | ERC-4337 smart account + session keys                    | Approve session once, then trades execute without popups (bounded by time + amount) |


> **Privy Embedded Wallets:** Users authenticate with Twitter (same flow as today). Privy creates an embedded wallet behind the scenes on first on-chain interaction. No MetaMask or browser extension required. The wallet is recoverable via Privy's social recovery.

> **Session Keys (V2):** Using ERC-4337 smart accounts, users approve a "trading session" (e.g., 24 hours, max $1000 notional). During the session, the frontend signs and submits transactions via the session key without wallet popups. This restores the instant-trade UX of the off-chain system.

> **Gas Sponsorship:** Consider a paymaster on Arbitrum to cover gas fees. Arbitrum gas is already low (~$0.01-0.05 per tx), but zero-gas UX eliminates the last friction point. Cost: ~$0.01-0.05 per trade, absorbable in the 3% trading fee.

---

## Fee Model Transition


|                   | Off-Chain (markets-web)                      | On-Chain (markets-arena)                                   |
| ----------------- | -------------------------------------------- | ---------------------------------------------------------- |
| **Fee structure** | Fixed `feeBps` per market (default 100 = 1%) | Dynamic via VaultRisk (300 bps base + surge + skew)        |
| **Fee range**     | Always 1%                                    | 3%–15% depending on conditions                             |
| **Fee preview**   | N/A (fixed, known)                           | `previewEffectiveFee()` returns exact fee before execution |
| **Fee split**     | Protocol only                                | Protocol + creator (via VaultCredit debt-first waterfall)  |


**UI implications for markets-arena:**

- Show effective fee prominently before trade confirmation
- Display surge indicator when fees are elevated above baseline
- Show fee breakdown (base + surge + skew components) in advanced view
- `quoteSwapIn` / `quoteSell` already return fee amounts for display

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


| Module                           | Usage                                        |
| -------------------------------- | -------------------------------------------- |
| `ERC1155`                        | Extend for VaultToken                        |
| `SafeTransferLib`                | All USDC transfers                           |
| `EIP712` + `SignatureCheckerLib` | Order signing (EOA + ERC-1271)               |
| `OwnableRoles`                   | Admin, relayer, council roles                |
| `FixedPointMathLib`              | mulDiv, sqrt, ln, exp                        |
| `SSTORE2`                        | Store LUT data cheaply                       |
| `LibBitmap` / `LibMap`           | Order nonce/fill tracking                    |
| `CREATE3`                        | Deterministic deployment addresses           |
| `LibString`                      | On-chain string ops for metadata             |
| `Base64`                         | Encode JSON for data URIs                    |
| `SafeCastLib`                    | Explicit int/uint casting for CLMM tick math |


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
  ├── fee = VaultRisk.getEffectiveFee() per fill (dynamic, same as FPMM/CLMM)
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
│   ├── VaultResolutionConsumer.sol  # CRE consumer contract (no funds, ~60 LOC)
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
├── deployments/
│   ├── 421614/   # Arbitrum Sepolia
│   └── 42161/    # Arbitrum One
└── workflows/                     # CRE Workflow (TypeScript)
    └── resolution/
        ├── index.ts               # Main workflow: cron → scan → resolve/close
        ├── config.staging.json    # Arbitrum Sepolia config
        ├── config.production.json # Arbitrum One config
        ├── project.yaml           # CRE project config (RPCs, chain selectors)
        └── contracts/
            └── abi.ts             # VaultMarket ABI bindings (viem)
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
>
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


| Script           | Purpose                           |
| ---------------- | --------------------------------- |
| `Deploy.s.sol`   | Deploy all contracts with CREATE3 |
| `MineSalt.s.sol` | Find salt for vanity address      |
| `Migrate.s.sol`  | Deploy new version (future)       |


### Chain Configuration


| Chain            | ID     | RPC                         |
| ---------------- | ------ | --------------------------- |
| Arbitrum Sepolia | 421614 | `$ARBITRUM_SEPOLIA_RPC_URL` |
| Arbitrum One     | 42161  | `$ARBITRUM_ONE_RPC_URL`     |


---

## Gas Budget & Transaction Value Audit

> **Transaction Value Principle:** Every user-signed transaction MUST involve a real value exchange (USDC in/out, share mint/burn, position creation/destruction, or order protection). If no value changes hands, no transaction should be required. "Housekeeping" operations are either eliminated, absorbed into value-bearing calls, or delegated to permissionless CRE workflows.

### Arbitrum Gas Assumptions

All estimates use live Arbitrum One parameters as of **February 6, 2026**:

| Parameter | Value | Source |
| --- | --- | --- |
| L2 gas price (base) | **0.022 gwei** | arbiscan.io/gastracker (live) |
| L2 priority fee | **0 gwei** | arbiscan.io (live) |
| Block time | ~4 seconds | Arbitrum Nitro |
| L1 data posting (calldata component) | ~460K ArbGas fixed + 2,116/non-zero byte | Arbitrum docs |
| SSTORE (0 → non-zero, slot init) | ~20K gas | EVM opcode |
| SSTORE (non-zero → non-zero) | ~5K gas | EVM opcode |
| SLOAD | ~2.1K gas | EVM opcode |
| ERC-20 transfer | ~46K gas → ~$0.002 | arbiscan.io |
| Uniswap-style swap | ~130K gas → ~$0.006 | arbiscan.io |
| **LINK price** | **$8.86** | CoinMarketCap (live, mcap $6.27B) |
| **ETH price** | **~$2,100** | CoinMarketCap (range $1,750-$2,100) |

> **Cost formula:** `USD = gas × 0.022 gwei × 1e-9 × ETH_price`. At 0.022 gwei and ETH=$2,100: **100K gas ≈ $0.0046**. For congested estimates below, we use a **5× spike** (0.11 gwei, ETH=$2,100) = ~$0.023 per 100K gas. All costs below use the **typical** rate unless noted.

### Per-Operation Gas Estimates (User)

Every operation listed is a user-signed tx with real value exchange. Operations eliminated for violating the value principle are marked.


| Operation | Gas (L2) | USD (typical) | USD (5× spike) | Value Exchange |
| --- | --- | --- | --- | --- |
| **One-Time Setup** | | | | |
| USDC `approve(vaultToken, max)` | 46K | $0.0021 | $0.011 | Enables deposits (once per spender) |
| USDC `approve(vaultMarket, max)` | 46K | $0.0021 | $0.011 | Enables swaps (once per spender) |
| `setApprovalForAll(vaultCLMM, true)` | 46K | $0.0021 | $0.011 | Enables LP (once) |
| **Trading (FPMM)** | | | | |
| `swap()` — buy (USDC → shares) | 150K | $0.0069 | $0.035 | Receives outcome shares |
| `swap()` — sell (shares → USDC) | 150K | $0.0069 | $0.035 | Receives USDC |
| **Trading (CLOB)** | | | | |
| Sign EIP-712 order | **0** | **$0.00** | **$0.00** | Off-chain — no gas |
| `cancelOrder(Order)` | 30K | $0.0014 | $0.007 | Protects from unwanted fill |
| `cancelOrders(Order[20])` | 600K | $0.028 | $0.139 | Batch protection (max 20) |
| `incrementNonce()` | 5K | $0.0002 | $0.001 | Emergency invalidate all orders |
| **Minting / Burning** | | | | |
| `split(marketId, amount)` | 80K | $0.0037 | $0.018 | USDC → complete set shares |
| `merge(marketId, amount)` | 80K | $0.0037 | $0.018 | Complete set → USDC |
| **Redemption / Claims** | | | | |
| `redeem(marketId)` — winner | 30K | $0.0014 | $0.007 | Winning shares → USDC |
| `redeem()` — loser | **0** | **$0.00** | **$0.00** | **No tx needed** — shares inert |
| `claimRefund(marketId)` — cancelled market | 30K | $0.0014 | $0.007 | Share value → USDC refund |
| `claimCreatorFees(marketId)` | 30K | $0.0014 | $0.007 | Accrued fees → USDC |
| `withdrawEarnings()` (merged) | 50K | $0.0023 | $0.012 | Auto-processes + withdraws USDC |
| **CLMM Liquidity** | | | | |
| `addLiquidity(...)` | 200K | $0.0092 | $0.046 | Tokens → LP position + fee earning |
| `removeLiquidity(...)` | 150K | $0.0069 | $0.035 | LP position → tokens |
| `collectFees(positionId)` | 50K | $0.0023 | $0.012 | Accrued LP fees → tokens |
| **Profile (creators/KOLs only)** | | | | |
| `linkWallet(wallet, sig)` | 50K | $0.0023 | $0.012 | Associates wallet (auto-creates profile) |
| `unlinkWallet(wallet)` | 30K | $0.0014 | $0.007 | Removes wallet association |
| **Eliminated (no value)** | | | | |
| ~~`registerProfile()`~~ | ~~50K~~ | — | — | Replaced by lazy `_ensureProfile()` |
| ~~Losing share burn~~ | ~~5K×N~~ | — | — | Shares left inert (zero cost) |
| ~~`processEarnings()` standalone~~ | ~~50K~~ | — | — | Absorbed into `withdrawEarnings()` |

### Full User Journey Gas Estimates

These show total gas for end-to-end user flows, including all setup and teardown.

#### Journey 1: Casual FPMM Trader (buy → hold → redeem)

```
First trade ever (includes one-time setup):
  USDC approve (VaultMarket)          46K gas    $0.0021
  swap() buy                         150K gas    $0.0069
                                     ─────────
  Subtotal (first trade):            196K gas    $0.009

Subsequent trades (no setup):
  swap() buy                         150K gas    $0.007

Redemption (if winner):
  redeem()                            30K gas    $0.001

Redemption (if loser):
  (no transaction)                      0 gas    $0.000
                                     ─────────
  TOTAL LIFECYCLE (winner):          226K gas    $0.010
  TOTAL LIFECYCLE (loser):           196K gas    $0.009
```

> A user's entire lifetime of prediction market participation — from first approval to final redemption — costs **less than one cent**.

#### Journey 2: CLOB Trader (place limit order → fill → redeem)

```
One-time setup:
  USDC approve (VaultToken)           46K gas    $0.0021
  setApprovalForAll (VaultCLOB)       46K gas    $0.0021
                                     ─────────
  Subtotal (setup):                   92K gas    $0.004

Trading (per order):
  Sign EIP-712 order                    0 gas    $0.000  (off-chain)
  Relayer settles via settleBatch       0 gas    $0.000  (relayer pays)

Redemption (if winner):
  redeem()                            30K gas    $0.001
                                     ─────────
  TOTAL LIFECYCLE (winner):          122K gas    $0.005
  TOTAL LIFECYCLE (loser):            92K gas    $0.004
  (+ $0.000/trade — all CLOB gas paid by relayer)
```

#### Journey 3: CLMM Liquidity Provider (add → earn → remove → redeem)

```
One-time setup:
  USDC approve (VaultCLMM)            46K gas    $0.0021
  setApprovalForAll (VaultCLMM)       46K gas    $0.0021
                                     ─────────
  Subtotal (setup):                   92K gas    $0.004

Provide liquidity:
  addLiquidity()                     200K gas    $0.009

Collect fees (3 times over market life):
  collectFees() × 3                  150K gas    $0.007

Withdraw:
  removeLiquidity()                  150K gas    $0.007

Redeem outcome tokens:
  redeem()                            30K gas    $0.001
                                     ─────────
  TOTAL LP LIFECYCLE:                622K gas    $0.029
```

#### Journey 4: Market Creator (credit line → seed → collect fees)

```
Profile created lazily by admin:       0 gas    $0.000  (admin pays)

One-time wallet link:
  linkWallet(wallet, sig)             50K gas    $0.002

Withdraw earnings (after resolution):
  withdrawEarnings()                  50K gas    $0.002
                                     ─────────
  TOTAL CREATOR LIFECYCLE:           100K gas    $0.005
```

### Protocol / Admin Gas Costs

These are operational costs paid by the protocol multisig.


| Operation | Gas | USD (typical) | Frequency |
| --- | --- | --- | --- |
| **Market Lifecycle** | | | |
| `createEvent()` | 100K | $0.0046 | Per event |
| `createMarket()` (incl. FPMM init + split) | 300K | $0.0139 | Per market |
| `resolve(marketId, winner, evidence)` | 50K | $0.0023 | Per market |
| `cancelMarket(marketId)` | 50K | $0.0023 | Rare |
| `pauseMarket()` / `unpauseMarket()` | 25K | $0.0012 | Emergency |
| `closeMarket(marketId)` | 30K | $0.0014 | Via CRE (not admin) |
| **Risk Management** | | | |
| `setRiskParams(RiskParams)` | 50K | $0.0023 | Rare (tuning) |
| `setLUT(bytes lutData)` | 200K | $0.0092 | Rare (new LUT) |
| **Credit Management** | | | |
| `setProfileStatus(profileId, status)` | 50K | $0.0023 | Per creator/KOL |
| `setCreditLimit(profileId, limit)` | 25K | $0.0012 | Per creator/KOL |
| **Deployment (one-time)** | | | |
| Deploy 6 core contracts + 1 consumer | ~8M | $0.37 | Once per version |
| MineSalt (vanity addresses) | Off-chain | $0.00 | Once |

**Monthly Admin Gas at 20 markets/day:**

```
Market operations:
  createEvent (10/day)           10 × 100K = 1.0M gas/day
  createMarket (20/day)          20 × 300K = 6.0M gas/day
  resolve (20/day, admin path)   20 ×  50K = 1.0M gas/day
                                              ─────────
  Subtotal:                                   8.0M gas/day → $0.37/day

Monthly admin gas cost:                       ~$11/month
```

### Relayer Gas Costs (CLOB Settlement)

The relayer is a protocol-operated service that pays gas for CLOB batch settlement.


| Operation | Gas per match | Matches/batch | Gas/batch | USD/batch |
| --- | --- | --- | --- | --- |
| `settleBatch()` | ~50K | 2 (min) | 100K | $0.005 |
| `settleBatch()` | ~50K | 10 | 500K | $0.023 |
| `settleBatch()` | ~50K | 25 | 1.25M | $0.058 |
| `settleBatch()` | ~50K | 50 (max) | 2.5M | $0.116 |

**Per-match breakdown:**

```
settleBatch() per match                ~50K gas
  ├── OrderLib.hashOrder()             ~3K   (keccak256 + memory)
  ├── SignatureCheckerLib.verify()      ~6K   (ecrecover)
  ├── Fill validation + state update   ~10K  (SLOAD × 2 + SSTORE × 1)
  ├── SafeTransferLib (USDC)           ~25K  (ERC-20 transfer)
  ├── VaultToken.safeTransferFrom()    ~5K   (ERC-1155 transfer, warm)
  └── VaultCredit.depositFees()        ~1K   (amortized across batch)
```

**Monthly relayer cost projections:**

| CLOB Volume | Batches/day | Avg matches/batch | Gas/day | USD/day | USD/month |
| --- | --- | --- | --- | --- | --- |
| Low (1K trades) | 100 | 10 | 50M | $2.31 | **$69** |
| Medium (10K trades) | 500 | 20 | 500M | $23.10 | **$693** |
| High (100K trades) | 2,000 | 50 | 5B | $231 | **$6,930** |

> **Relayer cost is fully recoverable:** Each CLOB fill deducts fees from spread. At $10 average trade size and 10K trades/day = ~$3,000/day in protocol fees vs $23/day relayer cost = **99.2% margin**.

### CRE Workflow Costs (Chainlink LINK)

CRE workflow costs include DON consensus fees for reads/writes, paid in LINK.

> **Pricing caveat:** CRE is in Early Access (Feb 2026). Exact LINK costs per capability invocation are not yet published. Estimates below are based on Chainlink Automation v2.3 economics (gas reimbursement + node premium) and Chainlink Functions billing models. Actual CRE pricing may differ. **LINK=$8.86** as of Feb 6, 2026.

**Cost model per resolution cycle (5-minute cron):**

```
CRE Resolution Workflow — per cycle cost breakdown:

1. TRIGGER (Cron)
   DON overhead:                     negligible (internal scheduling)

2. EVM READS (market scanning via callContract)
   Paginated getActiveMarketIds():   ~4 reads (200 active / 50 per page)
   Per-market getMarket():           ~200 reads (each active market)
   Total read operations:            ~204 consensus reads
   Estimated cost:                   ~0.001 LINK per read × 204 = ~0.2 LINK

3. EVM WRITES (writeReport via KeystoneForwarder)
   Close batch (5 markets):          ~250K gas on-chain
   Resolve batch (3 markets):        ~150K gas on-chain
   DON consensus + signing:          ~80K gas overhead per write
   Total write gas:                  ~560K gas
   Gas cost at 0.022 gwei:          ~0.0000123 ETH ≈ $0.026
   Node premium (est. 30-50%):       ~$0.009-0.013
   LINK conversion + premium:        ~0.005 LINK per write × 2 = ~0.01 LINK

4. TOTAL PER CYCLE:                  ~0.21 LINK
   At LINK = $8.86:                  ~$1.86 per cycle
   (most cycles scan but find nothing to close/resolve,
    actual writes only when markets need action)
```

**Idle vs active cycle cost:**

| Cycle Type | Frequency | Reads | Writes | LINK/cycle | USD/cycle |
| --- | --- | --- | --- | --- | --- |
| Idle (no markets to act on) | ~90% of cycles | ~204 | 0 | ~0.20 | $1.77 |
| Active (close/resolve needed) | ~10% of cycles | ~204 | 1-2 | ~0.21 | $1.86 |

**Daily / Monthly CRE cost projections (cron-based, unoptimized):**

| Active Markets | Cycles/day | Avg LINK/day | USD/day (LINK=$8.86) | USD/month |
| --- | --- | --- | --- | --- |
| 50 (early) | 288 | ~14 LINK | $124 | **$3,720** |
| 200 (growth) | 288 | ~58 LINK | $514 | **$15,420** |
| 1,000 (scale) | 288 | ~290 LINK | $2,569 | **$77,070** |

> **CRE Cost Optimization Levers:**
>
> 1. **Reduce cron frequency:** 5 min → 15 min cuts costs by 3×. Markets with >48h grace periods don't need 5-minute polling.
> 2. **Event-driven triggers (EVM Log):** Replace cron with `MarketClosed` event listener — workflows fire only when needed, eliminating idle cycles entirely. Projected savings: **80-90%**.
> 3. **Reduce read scope:** Track "next resolvable time" off-chain and skip scanning when no markets are due.
> 4. **Batch reads:** Use a multicall-style contract that returns multiple market states in a single `callContract()`.
>
> **With EVM Log trigger + multicall (optimized):**
>
> | Active Markets | Triggers/day | LINK/day | USD/day (LINK=$8.86) | USD/month |
> | --- | --- | --- | --- | --- |
> | 50 | ~5 | ~0.25 | $2.22 | **$67** |
> | 200 | ~20 | ~1.0 | $8.86 | **$266** |
> | 1,000 | ~100 | ~5.0 | $44.30 | **$1,329** |

### Total Protocol Operating Cost Summary

Aggregated monthly infrastructure costs at different scale tiers (excluding liquidity capital).


| Cost Center | 50 markets/day | 200 markets/day | 1,000 markets/day |
| --- | --- | --- | --- |
| Admin gas (create/resolve) | $17 | $67 | $333 |
| Relayer gas (CLOB settlement) | $69 | $693 | $6,930 |
| CRE workflow (cron, unoptimized) | $3,720 | $15,420 | $77,070 |
| CRE workflow (event-driven, optimized) | **$67** | **$266** | **$1,329** |
| **Total (optimized)** | **$153** | **$1,026** | **$8,592** |
| **Total (unoptimized)** | $3,806 | $16,180 | $84,333 |

> **Key insight:** CRE workflow cost dominates at scale unless optimized. Moving from cron polling to event-driven triggers is critical — it reduces CRE costs by **~98%**. The relayer is the second largest cost center but is fully covered by trading fees. At LINK=$8.86 (down from ~$20 peaks), CRE automation is remarkably affordable.

### User Cost at Scale

Aggregate gas paid by users (individually — not protocol cost).


| Metric | 10K DAU | 100K DAU | 1M DAU |
| --- | --- | --- | --- |
| Avg trades/user/day | 5 | 5 | 3 |
| Total trades/day | 50K | 500K | 3M |
| Gas/trade (FPMM avg) | 150K | 150K | 150K |
| Total gas/day | 7.5B | 75B | 450B |
| Cost/trade (typical) | $0.0069 | $0.0069 | $0.0069 |
| Cost/user/day | $0.035 | $0.035 | $0.021 |
| Aggregate user gas/day | $347 | $3,465 | $20,790 |
| Aggregate user gas/month | $10,395 | $103,950 | $623,700 |

> **User gas is individually negligible.** At $0.007/trade on Arbitrum, gas is invisible to users. Even the most active trader doing 20 trades/day spends ~$0.14/day in gas.

### Gas Sponsorship (Paymaster) Economics

| DAU | Trades/day | Sponsor cost/day | Fee revenue/day ($10 avg, 3%) | Net margin |
| --- | --- | --- | --- | --- |
| 1K | 5K | $35 | $1,500 | **97.7%** |
| 10K | 50K | $347 | $15,000 | **97.7%** |
| 100K | 500K | $3,465 | $150,000 | **97.7%** |
| 1M | 3M | $20,790 | $900,000 | **97.7%** |

> **Recommendation:** Sponsor all user gas via an ERC-4337 paymaster on Arbitrum. The fee margin easily absorbs the gas cost at any scale tier, and zero-gas UX eliminates the last onboarding friction point.

---

### Scale Scenario: 50K MAU / 200 Markets per Day

> **Target deployment model:** 50,000 Monthly Active Users, 10M transactions/month, 200 markets created and resolved daily. Protocol provides all FPMM liquidity (no syndicates). All user gas sponsored via ERC-4337 Account Abstraction paymaster.

#### User Metrics

| Metric | Value | Derivation |
| --- | --- | --- |
| MAU | 50,000 | Target |
| Est. DAU (33% daily engagement) | ~17,000 | Industry avg for prediction apps |
| Total transactions/month | 10,000,000 | Target |
| Tx/user/month | 200 | 10M ÷ 50K |
| Tx/user/day (active days) | ~6.7 | 200 ÷ 30 |
| Markets/day (created) | 200 | Target |
| Markets/day (resolved) | 200+ | Target (steady state) |
| Avg market lifespan | ~5 days | Varies 1h–30d |
| Active markets at any time | ~1,000 | 200/day × 5 day avg life |

#### Transaction Mix (10M/month)

| Type | Share | Monthly | Daily | Gas/tx | On-chain? |
| --- | --- | --- | --- | --- | --- |
| FPMM swap (buy/sell) | 55% | 5,500,000 | 183,333 | 150K | Yes |
| CLOB order sign | 15% | 1,500,000 | 50,000 | 0 | **No** (off-chain) |
| Redemptions (winners) | 10% | 1,000,000 | 33,333 | 30K | Yes |
| Split / Merge | 8% | 800,000 | 26,667 | 80K | Yes |
| CLMM LP actions (add/remove/collect) | 5% | 500,000 | 16,667 | 150K avg | Yes |
| Approvals (new user setup) | 3% | 300,000 | 10,000 | 46K | Yes |
| Cancel orders (CLOB) | 2% | 200,000 | 6,667 | 30K | Yes |
| Claims (refund, creator, earnings) | 2% | 200,000 | 6,667 | 30K | Yes |
| **Total on-chain** | **85%** | **8,500,000** | **283,334** | | |
| **Total off-chain (CLOB sign)** | **15%** | **1,500,000** | **50,000** | | |

#### Gas Consumption Breakdown (Monthly)

| Transaction Type | Count/month | Gas/tx | Total gas | % of total |
| --- | --- | --- | --- | --- |
| FPMM swaps | 5,500,000 | 150K | 825.0B | **80.3%** |
| CLMM LP actions | 500,000 | 150K | 75.0B | 7.3% |
| Split / Merge | 800,000 | 80K | 64.0B | 6.2% |
| Redemptions | 1,000,000 | 30K | 30.0B | 2.9% |
| Approvals | 300,000 | 46K | 13.8B | 1.3% |
| Cancel orders | 200,000 | 30K | 6.0B | 0.6% |
| Claims | 200,000 | 30K | 6.0B | 0.6% |
| CLOB orders (off-chain) | 1,500,000 | 0 | 0 | 0.0% |
| **TOTAL** | **10,000,000** | | **1,019.8B** | **100%** |

> FPMM swaps dominate gas (80.3%). This is the primary optimization target if costs ever become a concern.

#### Cost Center 1: AA Gas Sponsorship (User Transactions)

Protocol pays all user gas via ERC-4337 paymaster.

```
Total monthly gas:              1,019.8B gas (1.02 trillion)
ETH consumed:                   1,019.8B × 0.022 gwei × 1e-9 = 22.44 ETH/month
USD cost:                       22.44 ETH × $2,100 = $47,116/month

Daily:                          $1,571/day
Per transaction (avg):          $0.0047/tx (avg 120K gas across mix)
Per user per month:             $0.94/user/month
Per user per day (active):      $0.09/user/day
```

| Metric | Value |
| --- | --- |
| Monthly AA sponsorship cost | **$47,116** |
| Cost per user per month | **$0.94** |
| Cost per transaction (avg) | **$0.0047** |
| ETH required per month | **22.44 ETH** |

#### Cost Center 2: CLOB Relayer Settlement

Relayer pays gas for settling CLOB order matches.

```
CLOB orders signed:             1,500,000/month → 50,000/day
Fill rate (est. 80%):           1,200,000 fills/month
Matches (2 sides = 1 match):   600,000 matches/month → 20,000/day
Batching (avg 25 matches/batch):800 batches/day

Gas per match:                  ~50K
Total monthly gas:              600K × 50K = 30B gas
ETH consumed:                   30B × 0.022e-9 = 0.66 ETH/month
USD cost:                       0.66 ETH × $2,100 = $1,386/month
```

| Metric | Value |
| --- | --- |
| Monthly relayer cost | **$1,386** |
| Cost per match | **$0.0023** |
| Batches per day | **800** |

#### Cost Center 3: Admin Operations (Market Lifecycle)

Protocol multisig creates, manages, and resolves markets.

```
createEvent (100/day):          100 × 100K = 10M gas/day
createMarket (200/day):         200 × 300K = 60M gas/day
resolve (admin, 50/day):         50 ×  50K = 2.5M gas/day
  (remaining 150/day via CRE)
setProfileStatus (5/day):         5 ×  50K = 0.25M gas/day
setCreditLimit (5/day):           5 ×  25K = 0.125M gas/day
                                              ─────────
Total:                                        72.9M gas/day → 2.19B gas/month

ETH consumed:                   2.19B × 0.022e-9 = 0.048 ETH/month
USD cost:                       0.048 × $2,100 = $101/month
```

| Metric | Value |
| --- | --- |
| Monthly admin gas cost | **$101** |

#### Cost Center 4: CRE Workflows (Chainlink LINK)

Automated market closing + oracle resolution via CRE DON.

```
Markets to close via CRE:       200/day (when resolution time passes)
Markets to resolve via CRE:     150/day (oracle markets, auto-resolved)
Total CRE-driven actions:       350/day

── EVENT-DRIVEN APPROACH (optimized) ──

Close workflow triggers:         ~200/day (on resolution time expiry)
  Reads per trigger:             2 reads (verify state)
  LINK per trigger:              ~0.005 LINK
Resolve workflow triggers:       ~150/day (on oracle data available)
  Reads per trigger:             3 reads (verify state + oracle data)
  LINK per trigger:              ~0.007 LINK

Write batches (10 markets each):
  Close batches:                 200 ÷ 10 = 20 writes/day
  Resolve batches:               150 ÷ 10 = 15 writes/day
  LINK per write:                ~0.01 LINK

Daily LINK consumption:
  Read costs:   200 × 0.005 + 150 × 0.007   = 2.05 LINK/day
  Write costs:  35 × 0.01                     = 0.35 LINK/day
  Total:                                       = 2.40 LINK/day

On-chain gas for writes:
  35 batches × 250K gas avg     = 8.75M gas/day
  ETH: 8.75M × 0.022e-9        = 0.000193 ETH/day ≈ $0.40/day

── CRON APPROACH (unoptimized, 5-min interval) ──

Active markets to scan:          ~1,000 (200/day × 5-day avg life)
Cycles per day:                  288
Reads per cycle (w/ multicall):  ~20 multicall reads (vs 1,004 raw)
LINK per cycle:                  ~0.02 LINK (multicall) or ~1.0 LINK (raw)
Write LINK:                      same 0.35 LINK/day

Cron daily cost (multicall):     288 × 0.02 + 0.35 = 6.11 LINK/day
Cron daily cost (raw reads):     288 × 1.0 + 0.35 = 288.35 LINK/day
```

| Approach | LINK/day | USD/day | USD/month | Feasibility |
| --- | --- | --- | --- | --- |
| Event-driven + multicall | 2.40 | $21.26 | **$638** | **Recommended** |
| Cron + multicall | 6.11 | $54.13 | **$1,624** | Acceptable |
| Cron + raw reads | 288.35 | $2,555 | **$76,650** | Too expensive |

#### Cost Center 5: Protocol-Owned Liquidity (No Syndicates)

Protocol seeds all FPMM markets with its own capital.

```
Markets created:                 200/day
Seed liquidity per market:       $250 USDC average
                                 (range $100-$500 based on expected volume)
Daily capital deployed:          200 × $250 = $50,000/day

Market lifespan (avg):           5 days
Capital in flight at any time:   $50,000 × 5 = $250,000 locked

Capital returned on resolution:  $250,000 rotating (not consumed)
Monthly capital rotation:        200 × 30 × $250 = $1,500,000 deployed + returned

── IMPERMANENT LOSS (the real cost of LP) ──

Binary FPMM IL mechanics:
  - Market starts at 50/50, resolves to 100/0
  - LP holds equal shares of both outcomes at deployment
  - As trading skews the pool, LP accumulates losing-side tokens
  - Theoretical max IL for binary FPMM: ~29.3% (100% skew)
  - Average IL (mix of close and skewed markets): ~12-15%

Monthly IL (expected loss):
  Total liquidity deployed:      $1,500,000/month (6,000 markets × $250)
  Average IL rate:               12.5%
  Gross IL:                      $1,500,000 × 12.5% = $187,500/month

── LP ECONOMICS NOTE ──

The 3% trading fee (from VaultRisk) routes ENTIRELY to VaultCredit.depositFees()
for the debt-first waterfall — it does NOT stay in the FPMM pool. The LP
earns from FPMM pool share dynamics (natural spread), but in a fee-extracted
FPMM this is minimal. The primary LP cost is IL.

Protocol-owned liquidity is the "cost of doing business" — without it, there
are no FPMM swaps and no fee revenue. The $187,500/month IL enables the
$1,675,000/month in fee revenue (a 8.9× return on IL).
```

| Metric | Value |
| --- | --- |
| Capital required (locked, revolving) | **$250,000** |
| Monthly capital rotation | **$1,500,000** deployed + returned |
| Monthly IL (expected loss) | **$187,500** (12.5% avg on rotated capital) |
| IL as % of fee revenue | **11.2%** ($187K / $1,675K) |
| Return on IL | **8.9×** (every $1 of IL enables $8.90 in fees) |

> **IL is the dominant protocol cost but earns a 9× return in fee revenue.** Without protocol-owned LP, there is no FPMM market and no trading fee income. The $250K locked capital (+ $187K monthly IL) enables $1,675K in monthly protocol fees — a capital-efficient model that eliminates the need for external LP incentives, yield farming programs, or syndicate revenue-sharing agreements.

#### IL Reduction Strategies

IL is 79% of protocol costs. These five strategies compound to reduce IL by ~56%, from $187,500 to ~$82K/month.

**Strategy 1: Adaptive Seed Sizing (Volume-Proportional)**

Instead of seeding every market at a flat $250, tier seed capital based on expected volume using off-chain prediction data from `markets-web` (the graduation pipeline).

```
Current:   6,000 markets × $250 flat        = $1,500,000/month deployed
Optimized: 6,000 markets × $200 weighted avg = $1,200,000/month deployed

Tier breakdown:
  Low-interest (40% of markets):    $50-100 seed    (niche, low-volume)
  Medium (40%):                     $150-250 seed   (standard markets)
  High-interest (20%):              $300-500 seed   (trending, high-demand)

IL savings:  ($1,500K - $1,200K) × 12.5% = $37,500/month (-20%)
```

> **Implementation:** `createMarket()` already accepts liquidity parameters. The off-chain market creation pipeline (admin) simply passes different seed amounts based on the `markets-web` graduation score. No contract changes needed.

**Strategy 2: CRE-Managed Early LP Withdrawal on High Skew**

When a market's FPMM price skews past a threshold (e.g., >85% one outcome), the protocol's remaining IL exposure is mostly locked in but the remaining risk (85%→100%) has minimal fee generation (few traders bet on the trailing side). CRE can proactively withdraw protocol LP.

```
Binary FPMM IL curve:
  At 50/50: IL = 0%
  At 70/30: IL ≈ 4.5%
  At 85/15: IL ≈ 13.2%
  At 95/5:  IL ≈ 22.4%
  At 100/0: IL ≈ 29.3%

Without withdrawal:  average IL = 12.5% (markets resolve at various skews)
With withdrawal at 85% skew:  IL capped at ~13.2% for pulled markets

Impact: Markets that would have drifted from 85% → 100% now cap at 85%.
  ~30% of markets reach >85% skew before resolution.
  Those markets save avg ~10% IL (from 20% → 13.2%).
  Net savings: $1,200K × 0.30 × (0.20 - 0.132) = $24,480/month

After withdrawal, the CLOB provides remaining liquidity.
```

> **CRE Workflow: Liquidity Rebalancer**
>
> ```typescript
> // workflows/liquidity/index.ts (simplified)
> // Cron: every 15 minutes
> // For each active market with protocol LP:
> //   1. Read FPMM price via callContract
> //   2. If price > 0.85 or price < 0.15:
> //      → writeReport(WITHDRAW, marketId) to a VaultLiquidityConsumer
> //   3. Consumer calls VaultMarket internal LP withdrawal
> ```
>
> **Cost:** ~0.5 LINK/day additional CRE overhead (~$4.43/day, $133/month). Net savings after CRE cost: ~$24,350/month.

**Strategy 3: Seed at Market Price, Not 50/50 — DEFERRED**

> **Status: Deferred.** This strategy requires a contract change (`FPMMLib.initWithPrices`) for a marginal ~10% IL reduction. The four selected strategies achieve 67% IL reduction without it. Revisit for v2 if additional IL reduction is needed.

<details>
<summary>Deferred design (click to expand)</summary>

The `markets-web` graduation pipeline provides off-chain price discovery before markets go on-chain. If the crowd sentiment suggests 70/30, seeding the FPMM at 50/50 means the LP immediately takes IL as the first trades correct the price. Seeding at 70/30 eliminates this "corrective IL."

```
Without market-price seeding:
  LP enters at 50/50 → first $500 of trades correct to 70/30 → LP eats the move
  Corrective IL: ~4.5% on seed capital for 20% mispricing

With market-price seeding:
  LP enters at 70/30 → no correction needed → IL only from NEW information
  ~50% of markets benefit from pre-priced seeding (those with strong crowd signal)
  Avg corrective IL eliminated: ~3% on those markets

Savings: $1,200K × 0.50 × 0.03 = $18,000/month (-15% on remaining IL)
```

**Implementation:** `createMarket()` with `initialPrices` parameter. The FPMM is initialized with unequal token ratios matching the target price. The off-chain pipeline reads the `markets-web` consensus price and passes it during creation. Requires a contract enhancement: `FPMMLib.initWithPrices(uint256[] prices, uint256 liquidity)` instead of the current equal-weight init.

</details>

**Strategy 4: CLMM for Protocol-Owned Liquidity (Concentrated Ranges)**

Instead of full-range FPMM liquidity (which is exposed to IL across the entire 0→1 price space), deploy protocol-owned liquidity via **VaultCLMM** in a concentrated range around the current price. When price moves outside the range, the LP is automatically out-of-range and stops accumulating IL.

```
Full-range FPMM:   LP exposed across entire [0, 1] price space → max IL 29.3%
Concentrated CLMM: LP in [0.30, 0.70] range → IL capped at range boundary

When price exits range:
  - LP holds 100% of one token type (fully converted)
  - No additional IL accrues beyond the range boundary
  - CLOB takes over as sole liquidity source for extreme prices

Estimated IL reduction: 25-35% vs full-range FPMM
Net impact: $1,200K × (0.125 × 0.70) = $105,000 IL (vs $150,000 without)
Additional savings: ~$45,000/month

CRE manages repositioning:
  1. Deploy CLMM position at market creation
  2. Every 15 min: check if price near range boundary
  3. If out of range: optionally redeploy at new range centered on current price
  4. Near resolution (price approaching 0 or 1): withdraw, don't redeploy
```

> **Architecture fit:** VaultCLMM already supports `addLiquidity()` and `removeLiquidity()` for protocol positions via `getProtocolLiquidity()` and `collectProtocolFees()`. The CRE rebalancer workflow (Strategy 2) can be extended to also manage CLMM repositioning. This is essentially an **on-chain liquidity management agent** powered by CRE.
>
> **Tradeoff:** Concentrated LP provides deeper liquidity in-range (better prices for users, more fees) but zero liquidity out-of-range. For highly volatile markets, wider ranges or FPMM fallback may be needed. The optimal strategy is CLMM for popular markets + thin FPMM backstop for tail liquidity.

**Strategy 5: Dynamic Fee Uplift on High-Skew Markets**

VaultRisk already has inventory skew fees (`getInventorySkew`, `getEffectiveFee`). Amplify the skew component for markets approaching resolution with high directional conviction. This captures more fee revenue from the trades that cause the most IL.

```
Current fee structure:
  fee = baseFee × surgeMultiplier × (1 + skewPenalty)
  Typical effective fee: 2.5-4% depending on conditions

Enhanced for IL coverage:
  fee = baseFee × surgeMultiplier × (1 + skewPenalty × ilMultiplier)
  Where ilMultiplier scales with market age and skew:
    - Young market, low skew:   ilMultiplier = 1.0× (no change)
    - Old market, high skew:    ilMultiplier = 1.5-2.0×
    - Near resolution, >80% skew: ilMultiplier = 2.5×

Impact: Higher fees on the exact trades causing the most IL.
  Estimated additional fee capture: $55M × 0.3% uplift × 30% of volume = $49,500/month
  This directly offsets IL.
```

> **Implementation:** Add `ilMultiplier(marketId)` to `VaultRisk.getEffectiveFee()`. Reads market creation time, resolution time, and current skew to compute the multiplier. Pure math — no additional storage writes. LUT can encode the multiplier curve.

**Combined IL Reduction Impact (Strategies 1, 2, 4, 5)**

> Strategy 3 (market-price seeding via `FPMMLib.initWithPrices`) is deferred — it requires a contract change for marginal benefit. The selected four strategies provide 67% IL reduction without it.

| Strategy | Mechanism | IL reduction | Monthly savings | Requires |
| --- | --- | --- | --- | --- |
| 1. Adaptive seeding | Less capital exposed | -20% (capital) | $37,500 | Off-chain pipeline only |
| 2. Early withdrawal (>85% skew) | Cap tail IL, CRE managed | -13% (rate) | $19,500 | CRE workflow + consumer |
| 4. CLMM concentrated LP | Bounded range IL | -15% (rate) | $19,575 | CRE rebalancer (uses existing CLMM) |
| 5. Dynamic fee uplift | Fee revenue offsets IL | ~$50K offset | $49,500 | VaultRisk LUT param |
| **Combined** | **Multiplicative + offset** | | **~$125,942** | |

```
Baseline monthly IL:                         $187,500

Strategy 1 — Adaptive seeding:
  Capital deployed: $1,500K → $1,200K/month (tiered by demand)
  New IL base: $1,200K × 12.5% =            $150,000

Strategy 2 — Early withdrawal at >85% skew:
  IL rate reduction: 12.5% × 0.87 =         10.875%
  New IL: $1,200K × 10.875% =               $130,500

Strategy 4 — CLMM concentrated ranges:
  IL rate reduction: 10.875% × 0.85 =       9.24%
  New IL: $1,200K × 9.24% =                 $110,925

Strategy 5 — Fee uplift offset:
  Additional fee capture:                    -$49,500
  Net IL after offset:                       $61,425

CRE rebalancer cost:                         +$133

NET OPTIMIZED IL:                            ~$61,558/month
SAVINGS vs BASELINE:                         $125,942/month (67.2% reduction)
```

> **Implementation path:** Strategy 1 (adaptive seeding) is a **zero code change** — purely an off-chain pipeline decision. Strategy 5 (fee uplift) is a VaultRisk LUT parameter update. Strategy 2 (CRE early withdrawal) needs a new `VaultLiquidityConsumer` contract + CRE workflow. Strategy 4 (CLMM for protocol LP) is the most complex, requiring the CRE rebalancer to manage concentrated positions, but uses existing VaultCLMM methods (`addLiquidity`, `removeLiquidity`, `getProtocolLiquidity`).
>
> **Recommended rollout order:** 1 → 5 → 2 → 4 (escalating complexity, each independently valuable).

#### Cost Center 6: Infrastructure (Off-Chain)

Estimated hosting and service costs not covered by on-chain gas.

| Service | Est. cost/month | Notes |
| --- | --- | --- |
| CLOB relayer server | $200 | Dedicated instance, low latency |
| CLOB matcher / orderbook engine | $300 | In-memory matching, WebSocket feeds |
| Backend API (market data, indexer) | $500 | Graph node or custom indexer |
| Frontend hosting (CDN) | $100 | Static site, Vercel/Cloudflare |
| Database (off-chain metadata) | $200 | Market descriptions, images, event data |
| Monitoring / alerting | $100 | Grafana, PagerDuty |
| CRE CLI / workflow deployment | $50 | Build + deploy pipeline |
| **Total infrastructure** | **$1,450/month** | |

#### Full Monthly P&L (50K MAU, 200 markets/day)

> **Fee structure assumption:** VaultRisk charges a dynamic 3% fee on all trades. All fees route through `VaultCredit.depositFees()` into the debt-first waterfall. Creator share = `MIN_CREATOR_FEE` (0.5%). Protocol retains 2.5%. LP income/loss from protocol-owned FPMM liquidity is separate from fee revenue — it manifests as IL on the locked capital.

```
╔═══════════════════════════════════════════════════════════════════╗
║                    MONTHLY OPERATING SUMMARY                      ║
║                50K MAU · 200 markets/day · 10M tx/month           ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  REVENUE                                                          ║
║  ────────────────────────────────────────────────────────────────  ║
║  Total trading fees collected (3% on $67M)     +$2,010,000        ║
║    ├── FPMM: $55M × 3%                        +$1,650,000        ║
║    └── CLOB: $12M × 3%                          +$360,000        ║
║  Less: creator share (0.5% of volume)            -$335,000        ║
║                                                 ──────────        ║
║  Net protocol fee revenue:                     +$1,675,000        ║
║                                                                   ║
║  COSTS                                                            ║
║  ────────────────────────────────────────────────────────────────  ║
║  Impermanent loss (protocol LP on $250K)         -$187,500        ║
║  AA gas sponsorship (8.5M on-chain txs)           -$47,116        ║
║  CLOB relayer gas (600K matches)                   -$1,386        ║
║  Admin gas (create/resolve 6K markets)               -$101        ║
║  CRE workflows (72 LINK, event-driven)               -$638        ║
║  Infrastructure (servers, hosting)                 -$1,450        ║
║                                                 ──────────        ║
║  Total costs:                                    -$238,191        ║
║                                                                   ║
║  ════════════════════════════════════════════════════════════════  ║
║  NET MONTHLY P&L:                              +$1,436,809        ║
║  Operating margin:                                   85.8%        ║
║                                                                   ║
║  CAPITAL REQUIREMENTS                                             ║
║  ────────────────────────────────────────────────────────────────  ║
║  Locked LP capital (revolving):                    $250,000       ║
║  ETH for AA paymaster (monthly):              22.44 ETH           ║
║  ETH for relayer (monthly):                    0.66 ETH           ║
║  LINK for CRE (monthly):                     72 LINK              ║
║  Total crypto reserves needed:               ~$50,000 buffer      ║
║                                                                   ║
║  UNIT ECONOMICS                                                   ║
║  ────────────────────────────────────────────────────────────────  ║
║  Revenue per MAU:                              $33.50/month       ║
║  Cost per MAU:                                  $4.76/month       ║
║  LTV contribution per MAU:                     $28.74/month       ║
║  Cost per on-chain tx (gas only):                 $0.0055         ║
║  Protocol margin per tx (all-in):              $0.144 (85.8%)     ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

#### Cost Breakdown by Category

| Category | Monthly | % of total cost | $/tx |
| --- | --- | --- | --- |
| Impermanent loss (protocol LP) | $187,500 | **78.7%** | $0.019 |
| AA gas sponsorship | $47,116 | **19.8%** | $0.005 |
| CLOB relayer gas | $1,386 | 0.6% | $0.0001 |
| Infrastructure | $1,450 | 0.6% | $0.0001 |
| CRE workflows (LINK) | $638 | 0.3% | $0.0001 |
| Admin gas | $101 | <0.1% | $0.00001 |
| **Total** | **$238,191** | **100%** | **$0.024** |

> **IL is 79% of costs.** Protocol-owned liquidity's impermanent loss dominates all other cost centers combined. Gas costs (AA + relayer + admin + CRE) total only $49,241/month — just 2.9% of revenue. This means the protocol's profitability hinges on trading volume (fee revenue) and market diversity (IL averaging), not on gas economics.

#### P&L Comparison: Baseline vs IL-Optimized (Strategies 1, 2, 4, 5)

| Line Item | Baseline | IL-Optimized | Delta |
| --- | --- | --- | --- |
| **Revenue** | | | |
| Trading fees (3% on $67M) | +$2,010,000 | +$2,059,500 | +$49,500 (Strat 5 fee uplift) |
| Less: creator share (0.5%) | -$335,000 | -$335,000 | — |
| **Net revenue** | **$1,675,000** | **$1,724,500** | **+$49,500** |
| **Costs** | | | |
| Impermanent loss | -$187,500 | -$61,558 | +$125,942 (Strats 1+2+4+5) |
| AA gas sponsorship | -$47,116 | -$47,116 | — |
| CRE workflows (resolution + rebalancer) | -$638 | -$771 | -$133 (Strat 2+4 CRE) |
| CLOB relayer | -$1,386 | -$1,386 | — |
| Admin gas | -$101 | -$101 | — |
| Infrastructure | -$1,450 | -$1,450 | — |
| **Total costs** | **-$238,191** | **-$112,382** | **+$125,809** |
| | | | |
| **NET P&L** | **$1,436,809** | **$1,612,118** | **+$175,309** |
| **Margin** | **85.8%** | **93.5%** | **+7.7pp** |
| **Cost per MAU** | **$4.76** | **$2.25** | **-53%** |
| **Breakeven avg trade** | **$1.42** | **$0.65** | **-54%** |

```
╔═══════════════════════════════════════════════════════════════════╗
║              IL-OPTIMIZED MONTHLY OPERATING SUMMARY               ║
║                50K MAU · 200 markets/day · 10M tx/month           ║
║              Strategies 1 (adaptive seed) + 2 (CRE withdraw)     ║
║              + 4 (CLMM ranges) + 5 (fee uplift)                  ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  REVENUE                                                          ║
║  ────────────────────────────────────────────────────────────────  ║
║  Total trading fees (3% on $67M + uplift)    +$2,059,500          ║
║  Less: creator share (0.5%)                    -$335,000          ║
║                                                ──────────         ║
║  Net protocol fee revenue:                   +$1,724,500          ║
║                                                                   ║
║  COSTS                                                            ║
║  ────────────────────────────────────────────────────────────────  ║
║  Impermanent loss (optimized, net of offset)    -$61,558          ║
║    ├── Gross IL ($1.2M × 9.24%):     $110,925                    ║
║    └── Fee uplift offset:            -$49,500                     ║
║    └── CRE rebalancer:                  +$133                     ║
║  AA gas sponsorship (8.5M on-chain txs)         -$47,116          ║
║  CRE workflows (resolution)                       -$638           ║
║  CLOB relayer gas (600K matches)                 -$1,386          ║
║  Admin gas (create/resolve 6K markets)             -$101          ║
║  Infrastructure (servers, hosting)               -$1,450          ║
║                                                ──────────         ║
║  Total costs:                                  -$112,382          ║
║                                                                   ║
║  ════════════════════════════════════════════════════════════════  ║
║  NET MONTHLY P&L:                            +$1,612,118          ║
║  Operating margin:                                 93.5%          ║
║                                                                   ║
║  CAPITAL REQUIREMENTS                                             ║
║  ────────────────────────────────────────────────────────────────  ║
║  Locked LP capital (revolving):                  $200,000         ║
║    (reduced from $250K via adaptive seeding)                      ║
║  ETH for AA paymaster (monthly):            22.44 ETH             ║
║  ETH for relayer (monthly):                  0.66 ETH             ║
║  LINK for CRE (monthly):                   74 LINK                ║
║    (72 resolution + 2 rebalancer)                                 ║
║  Total crypto reserves needed:             ~$48,000 buffer        ║
║                                                                   ║
║  UNIT ECONOMICS                                                   ║
║  ────────────────────────────────────────────────────────────────  ║
║  Revenue per MAU:                            $34.49/month         ║
║  Cost per MAU:                                $2.25/month         ║
║  LTV contribution per MAU:                   $32.24/month         ║
║  Cost per on-chain tx (gas only):               $0.0055           ║
║  Protocol margin per tx (all-in):            $0.161 (93.5%)       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

#### Cost Breakdown by Category (IL-Optimized)

| Category | Baseline | IL-Optimized | % of opt cost | Change |
| --- | --- | --- | --- | --- |
| Impermanent loss | $187,500 | $61,558 | **54.8%** | -67.2% |
| AA gas sponsorship | $47,116 | $47,116 | **41.9%** | — |
| CLOB relayer gas | $1,386 | $1,386 | 1.2% | — |
| Infrastructure | $1,450 | $1,450 | 1.3% | — |
| CRE workflows (LINK) | $638 | $771 | 0.7% | +20.8% |
| Admin gas | $101 | $101 | <0.1% | — |
| **Total** | **$238,191** | **$112,382** | **100%** | **-52.8%** |

> **IL drops from 79% to 55% of costs.** With the four strategies active, AA gas sponsorship rises to 42% of costs — the two are now roughly balanced. Gas costs remain structurally fixed by Arbitrum's L2 pricing. The combined effect: **total costs cut by 53%, margin up 7.7 percentage points, and breakeven avg trade drops from $1.42 to $0.65** — making the protocol viable for sub-dollar micro-bet markets.

#### Sensitivity Analysis

| Variable | Change | Net Revenue | Monthly P&L (baseline) | Monthly P&L (IL-opt) |
| --- | --- | --- | --- | --- |
| **Base case** | As modeled | $1,675,000 | **$1,436,809** (85.8%) | **$1,612,118** (93.5%) |
| ETH price 2× ($4,200) | Gas costs double | $1,675,000 | $1,388,194 (82.9%) | $1,563,503 (90.7%) |
| Gas spike 5× (0.11 gwei) | Gas costs 5× | $1,675,000 | $1,242,349 (74.2%) | $1,417,658 (82.2%) |
| LINK 3× ($26.58) | CRE cost 3× | $1,675,000 | $1,435,557 (85.7%) | $1,610,576 (93.4%) |
| IL spike to 20% | Avg IL rate doubles | $1,675,000 | $1,324,309 (79.1%) | $1,545,563 (89.6%) |
| Avg trade $5 | Revenue halved | $862,250 | $599,309 (71.6%) | $749,868 (87.0%) |
| Avg trade $2 (micro-bets) | Revenue ~80% lower | $344,900 | $96,809 (28.9%) | $232,518 (67.4%) |
| 50% fewer trades | Volume halved | $862,250 | $599,309 (71.6%) | $749,868 (87.0%) |
| Gas 5× + trade $5 | Combined stress | $862,250 | $404,849 (48.3%) | $555,408 (64.4%) |
| Gas 5× + ETH 2× + trade $5 | Extreme worst case | $862,250 | $161,774 (19.3%) | $312,333 (36.2%) |

> **IL optimization transforms the stress scenarios.** With baseline IL, the $2 micro-bet scenario barely breaks even at 29% margin. With strategies 1+2+4+5, the same scenario achieves **67% margin**. The extreme worst case (gas 5× + ETH 2× + avg trade $5) moves from a tight 19% margin to a comfortable **36%**.
>
> **CRE/LINK costs remain negligible** at $8.86/LINK — even a 3× LINK price increase adds only $1.5K/month. After IL optimization, **AA gas sponsorship** ($47K/month, 42% of costs) is now the largest single cost center, but it is structurally immovable (set by Arbitrum L2 pricing) and completely covered by fee revenue at any realistic volume tier.

#### Bet Size Benchmarking: Myriad Markets Comparable Analysis

The previous estimates used a **$10 average trade size** as a conservative placeholder. Myriad Markets — a decentralized prediction market on Base that launched March 2025 — provides the most directly comparable benchmark for Vault Markets: a new platform with diverse market types (crypto, pop culture, politics), no whale-dominated election flow, and a high-frequency micro-bet user base.

**Myriad Markets Platform Metrics (Mar 2025 – Jan 2026):**

| Metric | Value | Notes |
| --- | --- | --- |
| Total cumulative volume (7mo) | $18M+ | March–October 2025 milestone |
| Total users | 511,000+ | Registered accounts (includes dormant) |
| Total trades (7mo) | 5M | Through October 2025 |
| Total trades (10mo) | 6.3M | Through ~January 2026 |
| Monthly volume (Oct 2025) | $4.2M | Post-summer cooldown |
| Monthly volume (Jul 2025) | $7.52M | Growth-phase peak |
| Monthly volume (growth peak) | $14M+ | 94% surge Jul→Sep |
| Weekly volume (Jan 2026) | $1.8M | ~$7.2M/month annualized |
| Peak daily volume | $360K | Spike days |
| Hourly burst volume | >$100K | High-velocity automated markets |

**Implied Average Trade Size by Phase:**

| Phase | Volume | Trades | Avg Trade | Reasoning |
| --- | --- | --- | --- | --- |
| All-time blend (7mo) | $18M | 5M | **$3.60** | Hardest number: cumulative ÷ total trades |
| Growth phase (est.) | ~$35M (Jul–Dec) | ~3.5M | **~$10** | Higher-value markets as platform matures |
| Current (Jan 2026, est.) | $7.2M/mo | ~500K/mo | **~$14** | Weekly $1.8M; lower trade count, higher avg |

> **Key insight:** Myriad's all-time average of **$3.60/trade** reflects a platform designed for high-frequency micro-bets with a large base of casual users. The average increases significantly as the platform matures — growth-phase estimates suggest **$10–$14/trade** for engaged, recurring users. Unlike Polymarket (where whale-driven election markets inflate averages to $178–$292), Myriad's numbers are organic retail flow on diverse market types — exactly the traffic profile Vault Markets would see at launch.

**Myriad User Engagement Comparison:**

| Metric | Myriad (observed) | Vault Markets (model) | Notes |
| --- | --- | --- | --- |
| Total users | 511K | 50K MAU | VM measures active, Myriad total signups |
| Est. MAU (10–15% of signups) | ~51–77K | 50K | Comparable active base |
| Trades/MAU/month | ~9–14 | ~134 | VM assumes high-frequency FPMM + CLOB |
| Volume/user (lifetime, 7mo) | $35 | TBD | Low due to large dormant base |

> **Engagement gap:** Our 50K MAU model assumes 134 fee-generating trades/user/month vs Myriad's ~9–14. This is by design — Vault Markets' dual AMM (FPMM + CLOB) with automated market creation targets power-user engagement. However, if per-user frequency is closer to Myriad's, the effective trade count would be ~700K/month (not 6.7M), which still generates profitable volume at $5+ avg trades.

**Vault Markets Conservative Model (50% of Myriad):**

We apply a **50% haircut** to Myriad benchmarks across all phases to account for: (1) Vault being newer than Myriad at the 50K MAU milestone, (2) no established viral market categories yet, (3) crypto-winter dampening speculative activity.

| VM Phase | Myriad Ref. | VM Est. (50%) | Applies When |
| --- | --- | --- | --- |
| Launch (Year 1) | $3.60 (all-time) | **$1.80** | First 6 months, user acquisition phase |
| Growth (Year 1–2) | $10 (growth) | **$5** | 10K–50K MAU, diverse markets |
| Mature (Year 2+) | $14 (current) | **$7** | 50K+ MAU, established categories |

**Planning estimate for 50K MAU model: $5/trade** (50% of Myriad's growth-phase average)

> **Compared to prior benchmarks:** Polymarket's whale-inflated averages ($178 non-election, $292 broad) produced a 50% haircut estimate of ~$33/trade — likely too optimistic for a new platform without established whale flow. Myriad's organic micro-bet data produces a much more conservative **$5/trade** that better reflects real decentralized prediction market behavior at comparable scale.

**Revenue Projections at Myriad-Benchmarked Bet Sizes (IL-Optimized, 50K MAU)**

All scenarios use 10M tx/month (6.7M fee-generating), 200 markets/day, IL-optimized costs of $112,382/month.

| Avg Trade | Benchmark Ref. | Monthly Volume | Net Revenue | Monthly P&L | Margin | Rev/MAU |
| --- | --- | --- | --- | --- | --- | --- |
| $1.80 | 50% Myriad all-time | $12.1M | $310,410 | $198,028 | **63.8%** | $6.21 |
| $3.60 | Myriad all-time (no cut) | $24.1M | $620,820 | $508,438 | **81.9%** | $12.42 |
| **$5** | **50% Myriad growth** | **$33.5M** | **$862,250** | **$749,868** | **87.0%** | **$17.25** |
| $7 | 50% Myriad mature | $46.9M | $1,207,150 | $1,094,768 | **90.7%** | $24.14 |
| $10 | Original model | $67.0M | $1,724,500 | $1,612,118 | **93.5%** | $34.49 |
| $12 | Myriad mature (no cut) | $80.4M | $2,069,400 | $1,957,018 | **94.6%** | $41.39 |

```
Revenue derivation (at $5 benchmark):
  FPMM:  5.5M trades × $5 = $27.5M
  CLOB:  1.2M fills × $5  =  $6.0M
  Total volume:               $33.5M

  Gross fees (3%):           $1,005,000
  Less creator (0.5%):        -$167,500
  Net protocol fees:           $837,500
  Fee uplift (Strat 5):        +$24,750
  Net revenue:                 $862,250

  Costs (IL-opt):             -$112,382
  NET P&L:                    $749,868  (87.0% margin)
```

> **Critical difference from whale-market benchmarking:** At Myriad-comparable bet sizes, costs represent **13% of revenue** (vs <2% at Polymarket-derived $33 estimates). The IL optimization strategies (1+2+4+5) become essential — without them, costs would be $238K/month (28% of revenue at $5 avg trade), cutting margin to 72%. IL optimization is not optional at micro-bet scale.

**Stress Test at $5 Avg Trade (IL-Optimized)**

| Scenario | Net Revenue | Monthly P&L | Margin |
| --- | --- | --- | --- |
| **Base ($5 avg)** | **$862,250** | **$749,868** | **87.0%** |
| Gas spike 5× | $862,250 | $555,456 | 64.4% |
| Gas 5× + ETH 2× | $862,250 | $312,441 | 36.2% |
| IL spike to 20% | $862,250 | $688,310 | 79.8% |
| Volume halved (5M tx/mo) | $431,125 | $318,743 | 73.9% |
| Avg trade grows to $10 | $1,724,500 | $1,612,118 | 93.5% |
| Avg trade drops to $2 | $344,900 | $232,518 | 67.4% |
| Avg trade drops to $1 | $172,450 | $60,068 | 34.8% |
| Gas 5× + trade $2 | $344,900 | $38,106 | 11.0% |
| Gas 5× + ETH 2× + trade $2 | $344,900 | -$204,909 | **-59.4%** |

> **At $5 avg trade, the protocol is profitable across all single-variable stresses.** The only scenario that produces a loss is the extreme triple-stress: 5× gas price + 2× ETH price + avg trade dropping 60% to $2 simultaneously. Even then, the loss (-$205K/month) is bounded and recoverable. The most likely downside — avg trade settling at $2–$3 instead of $5 — still yields $233K–$508K monthly P&L at 67–82% margin.

**Key Takeaway: Micro-Bet Unit Economics Are Viable but Cost-Sensitive**

| Metric | At $10 (original) | At $5 (Myriad-benchmarked) | At $2 (ultra-conservative) |
| --- | --- | --- | --- |
| Monthly revenue | $1,724,500 | $862,250 | $344,900 |
| Monthly costs (IL-opt) | $112,382 | $112,382 | $112,382 |
| Cost as % of revenue | 6.5% | **13.0%** | **32.6%** |
| P&L | $1,612,118 | $749,868 | $232,518 |
| Revenue-to-cost ratio | 15:1 | **7.7:1** | **3.1:1** |
| Cost per MAU vs Revenue/MAU | $2.25 vs $34.49 | $2.25 vs $17.25 | $2.25 vs $6.90 |

> **At Myriad-comparable bet sizes, costs are meaningful but manageable.** Unlike whale-market benchmarks where costs were negligible at <2% of revenue, Myriad's micro-bet reality puts costs at 13% — a healthy SaaS-like cost structure. The protocol's fixed-cost infrastructure model (gas + IL) still provides strong operating leverage: doubling average trade size from $5 to $10 doubles revenue while costs remain at $112K. The **critical threshold is ~$0.65/trade** (breakeven) — everything above generates margin. At $5 avg trade, the protocol earns **$7.70 for every $1 it spends**. The business priority is clear: drive average trade size above $5 through market quality, user engagement, and category expansion, rather than obsessing over cost reduction.

### Findings & Fixes

#### Fix 1: Lazy Profile Registration (Eliminate `registerProfile()` as User Action)

**Problem:** `registerProfile()` is a standalone transaction that creates a VaultCredit profile. Casual traders don't need profiles — profiles are only required for the credit line system (creators, KOLs). Asking every user to pay ~50K gas for an identity they may never use violates the value principle.

**Fix:** Remove `registerProfile()` as a user-facing action. Profiles are created lazily:

- **Creators:** Profile auto-created during `createMarket()` when `useCredit: true` (admin triggers)
- **KOLs:** Profile auto-created during `setProfileStatus()` (admin triggers)
- **Wallet linking:** `linkWallet()` auto-creates profile if none exists for the caller
- **Casual traders:** No profile needed. Trading (swap, split, merge, CLOB orders) works with bare wallet addresses. `balanceOf`, `redeem`, `merge` are keyed by `msg.sender`, not `profileId`.

> **Implementation:** `VaultCredit._ensureProfile(address wallet)` internal helper. Called by `linkWallet`, `setCreditLimit`, `setProfileStatus`. Creates profile atomically if `!isProfileRegistered(wallet)`. No user-facing `registerProfile()` method.

#### Fix 2: Bound `cancelOrders()` Batch Size

**Problem:** `cancelOrders(Order[] orders)` accepts an unbounded array. A user submitting 1000 cancellations would consume ~30M gas, potentially exceeding block limits.

**Fix:** Add `MAX_CANCEL_BATCH = 20` constant. Revert with `BatchTooLarge(orders.length, MAX_CANCEL_BATCH)` if exceeded. Users needing to cancel more can call `incrementNonce()` (5K gas, invalidates all orders) or make multiple bounded calls.

```solidity
uint256 public constant MAX_CANCEL_BATCH = 20;

function cancelOrders(Order[] calldata orders) external {
    if (orders.length > MAX_CANCEL_BATCH) revert BatchTooLarge(orders.length, MAX_CANCEL_BATCH);
    for (uint256 i; i < orders.length; i++) {
        _cancelOrder(orders[i]); // verifies msg.sender == order.maker
    }
}
```

#### Fix 3: `processEarnings()` Caller & Automation

**Problem:** `processEarnings(profileId, marketId)` is gated on `block.timestamp >= market.finalityDeadline`. Who calls it? If each creator/KOL must call it themselves, that's a transaction with no direct value exchange (the value comes from the subsequent `withdrawEarnings()`). At 100 creators per market, that's 100 unpaid txs.

**Fix:** Absorb `processEarnings` into `withdrawEarnings()` automatically:

```solidity
function withdrawEarnings() external {
    uint256 profileId = _getProfileId(msg.sender);

    // Auto-process any unprocessed markets where finality delay has passed
    uint256[] memory pending = _getPendingMarkets(profileId);
    for (uint256 i; i < pending.length && i < MAX_AUTO_PROCESS; i++) {
        if (block.timestamp >= markets[pending[i]].finalityDeadline) {
            _processEarnings(profileId, pending[i]);
        }
    }

    // Then withdraw all claimable funds
    uint256 claimable = _getClaimable(profileId);
    if (claimable == 0) revert NothingToWithdraw();
    _transfer(msg.sender, claimable);
}
```

This collapses two transactions (processEarnings + withdrawEarnings) into one value-bearing call. The `MAX_AUTO_PROCESS` cap (e.g., 5) prevents gas spikes. For profiles with many pending markets, repeated `withdrawEarnings()` calls process in batches.

> **Alternatively:** Add `processEarnings` to the CRE resolution workflow. After the finality delay expires, the workflow calls `processEarnings(profileId, marketId)` for all affected profiles via a second consumer contract action. This removes the burden from users entirely.

#### Fix 4: CRE Resolution Workflow — Paginated Scanning

**Problem:** The current CRE workflow iterates `for (let i = 1n; i <= totalMarkets; i++)`. At 10K+ markets, this is 10K EVM read calls through the CRE DON — expensive in execution time even though reads are off-chain.

**Fix:** Use `getActiveMarketIds(cursor, limit)` for paginated scanning of only active/closed markets. Resolved and cancelled markets are excluded from the active list (swap-and-pop on state changes), so the scan stays proportional to live markets only.

```typescript
// BEFORE (O(totalMarkets) — scans resolved/cancelled markets too):
for (let i = 1n; i <= totalMarkets; i++) { ... }

// AFTER (O(activeMarkets) — only live markets, paginated):
let cursor = 0n
const PAGE_SIZE = 50n
while (true) {
  const activeIds = evmClient.callContract(runtime, {
    call: encodeCallMsg({
      from: zeroAddress,
      to: config.vaultMarketAddress,
      data: encodeFunctionData({
        abi: VaultMarketABI,
        functionName: "getActiveMarketIds",
        args: [cursor, PAGE_SIZE],
      }),
    }),
    blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
  }).result()

  const ids = decodeFunctionResult({ ... }) as bigint[]
  if (ids.length === 0) break

  for (const id of ids) {
    // Check close/resolve conditions for each active market
  }
  cursor += PAGE_SIZE
}
```

> **Scale:** If protocol has 10K total markets but only 200 active, the workflow makes ~4 paginated reads + 200 market reads = ~204 EVM calls vs. 10K. This scales permanently because resolved markets never re-enter the active list.

#### Fix 5: VaultResolutionConsumer — On-Chain Batch Cap

**Problem:** The consumer contract loops over `marketIds.length` with try/catch. If CRE sends 100 IDs, that's 100 cross-contract calls (~50K each = 5M gas). No on-chain cap.

**Fix:** Add `MAX_MARKETS_PER_REPORT` constant to bound gas per `onReport` call:

```solidity
uint256 public constant MAX_MARKETS_PER_REPORT = 10;

function _processReport(bytes calldata report) internal override {
    (uint8 action, uint256[] memory marketIds) =
        abi.decode(report, (uint8, uint256[]));

    if (marketIds.length > MAX_MARKETS_PER_REPORT)
        revert BatchTooLarge(marketIds.length, MAX_MARKETS_PER_REPORT);

    // ... loop with try/catch
}
```

The CRE workflow respects this cap via `maxResolvePerRun` / `maxClosePerRun` config, and submits multiple reports if needed.

### Operations That Do NOT Require User Transactions

| Operation | Current | Recommendation |
| --- | --- | --- |
| Market closing (past resolutionTime) | Permissionless `closeMarket()` or lazy close | CRE workflow auto-closes; lazy close on next user swap is free |
| Oracle resolution | Permissionless `resolveByOracle()` | CRE workflow auto-resolves via consumer contract |
| Earnings processing | Separate `processEarnings()` tx | Absorbed into `withdrawEarnings()` (Fix 3) |
| Profile creation (casual traders) | `registerProfile()` tx | Eliminated — profiles created lazily by admin actions (Fix 1) |
| Losing share cleanup | Was `burnResolved()` tx | Eliminated — shares left inert (prior decision) |
| CLOB order placement | Off-chain EIP-712 signature | **Already gas-free** ✅ — settled by relayer |
| CLOB order matching | Off-chain matcher | **Already gas-free** ✅ — settled by relayer |

### Cross-Contract Gas Breakdowns (Hot Paths)

Detailed opcode-level gas accounting for the most frequently called user operations.

**1. FPMM Buy (`swap` with `isBuy: true`)** — most gas-intensive user action:

```
VaultMarket.swap()                           ~150K total gas
  ├── VaultRisk.getEffectiveFee()            ~8K  (SLOAD × 3 + LUT interp)
  ├── FPMMLib.calcBuyDelta()                 ~5K  (pure math, no SLOAD)
  ├── SafeTransferLib.safeTransferFrom()     ~25K (USDC transfer in)
  ├── VaultToken.split()                     ~45K (SSTORE × 2 + ERC-1155 batch mint)
  ├── VaultToken.safeTransferFrom()          ~25K (ERC-1155 transfer unwanted leg)
  ├── VaultRisk.updateVelocity()             ~8K  (SSTORE × 1)
  ├── VaultCredit.depositFees()              ~20K (SSTORE × 2 + event)
  └── emit Swap(...)                         ~4K  (log with 4 indexed topics)
  ─ calldata overhead (L1 posting):          ~10K (est. 120 bytes tx data)
```

**2. Redeem (`redeem(marketId)`)** — winner claims payout:

```
VaultMarket.redeem()                         ~30K total gas
  ├── _requireResolved(marketId)             ~2K  (SLOAD × 1)
  ├── VaultToken.balanceOf(sender, winId)    ~3K  (SLOAD × 1)
  ├── require(balance > 0) NothingToRedeem   ~0.1K (branch)
  ├── VaultToken.burn(sender, winId, balance)~10K (SSTORE × 1 + event)
  ├── SafeTransferLib.safeTransfer(USDC)     ~8K  (USDC transfer out)
  └── emit Redeemed(...)                     ~3K  (log with 3 indexed topics)
  ─ calldata overhead (L1 posting):          ~4K  (est. 36 bytes tx data)
```

**3. CLOB Settlement (`settleBatch` per match)** — relayer-paid:

```
VaultCLOB.settleBatch() — per match          ~50K gas
  ├── OrderLib.hashOrder(maker)              ~3K  (keccak256, memory alloc)
  ├── SignatureCheckerLib.verify(maker)       ~6K  (ecrecover)
  ├── OrderLib.hashOrder(taker)              ~3K  (keccak256, memory alloc)
  ├── SignatureCheckerLib.verify(taker)       ~6K  (ecrecover)
  ├── _validateAndFill()                     ~10K (SLOAD × 2 nonce/fills, SSTORE × 1)
  ├── SafeTransferLib (USDC ↔ shares)        ~15K (1-2 transfers depending on side)
  ├── VaultCredit.depositFees()              ~5K  (amortized fee deposit)
  └── emit OrderFilled(...)                  ~2K  (log)
  ─ calldata per match (L1 posting):         ~15K (est. 330 bytes: 2 orders + sigs)
```

**4. Add Liquidity (`addLiquidity`)** — LP position creation:

```
VaultCLMM.addLiquidity()                     ~200K total gas
  ├── _validateRange(tickLower, tickUpper)    ~3K  (pure math)
  ├── VaultToken.safeTransferFrom() × 2      ~50K (move 2 token types to CLMM)
  ├── _mintPosition(NFT or struct)            ~45K (SSTORE × 3: position, ticks, bitmap)
  ├── _updateTick(lower) + _updateTick(upper) ~20K (SSTORE × 2 tick state)
  ├── _updateLiquidity(range)                ~30K (SSTORE × 1 + sqrt math)
  ├── SafeTransferLib.safeTransferFrom(USDC) ~25K (USDC collateral transfer)
  ├── VaultRisk.updateVelocity()             ~8K  (SSTORE × 1)
  └── emit LiquidityAdded(...)               ~4K  (log)
  ─ calldata overhead (L1 posting):          ~15K (est. 200 bytes)
```

**5. CRE Consumer Report (`_processReport` — close 5 markets)** — CRE-paid:

```
VaultResolutionConsumer._processReport()     ~250K total gas
  ├── abi.decode(report)                     ~3K  (calldata → memory)
  ├── BatchTooLarge check                    ~0.2K (branch)
  └── loop × 5:
      ├── VaultMarket.closeMarket(id)        ~45K per call
      │   ├── _requireActive(id)             ~2K  (SLOAD × 1)
      │   ├── _checkResolutionTime()         ~1K  (comparison)
      │   ├── state = Closed                 ~5K  (SSTORE × 1)
      │   ├── _removeFromActiveList()        ~5K  (swap-and-pop, SSTORE × 2)
      │   └── emit MarketClosed(...)         ~3K  (log)
      └── try/catch overhead                 ~2K  per iteration
  ─ KeystoneForwarder overhead:              ~30K (signature verification + routing)
  ─ TOTAL: 5 × 47K + 30K + 3K ≈            ~268K
```

> **Arbitrum Cost at current prices (Feb 6, 2026):** 150K gas × 0.022 gwei × ETH/$2,100 = **~$0.007 per trade**. Even during 5× congestion spikes (0.11 gwei), cost stays under $0.035. All hot paths are optimized to minimize SSTORE operations (the most expensive L2 opcode).

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
>
> - Publish SLA and failover relayer keys
> - Consider multi-relayer (N-of-M) design for future versions
> - On-chain emergency role rotation capability

### Explicit Access Control List (ACL)


| Contract      | Method             | Allowed Callers                   | Modifier                                             |
| ------------- | ------------------ | --------------------------------- | ---------------------------------------------------- |
| `VaultRisk`   | `setRiskParams`    | Admin                             | `onlyOwner`                                          |
| `VaultRisk`   | `setLUT`           | Admin                             | `onlyOwner`                                          |
| `VaultRisk`   | `updateVelocity`   | VaultMarket, VaultCLMM, VaultCLOB | `onlyWhitelisted`                                    |
| `VaultCredit` | `setCreditLimit`   | Admin                             | `onlyOwner`                                          |
| `VaultCredit` | `setProfileStatus` | Admin                             | `onlyOwner`                                          |
| `VaultCredit` | `recordDebt`       | VaultMarket                       | `onlyMarket`                                         |
| `VaultCredit` | `depositFees`      | VaultMarket, VaultCLOB, VaultCLMM | `onlyFeeCollector`                                   |
| `VaultCredit` | `processEarnings`  | VaultMarket                       | `onlyMarket`                                         |
| `VaultCLOB`   | `settleBatch`      | Relayer                           | `onlyRelayer`                                        |
| `VaultMarket` | `createMarket`     | Admin                             | `onlyOwner`                                          |
| `VaultMarket` | `createEvent`      | Admin                             | `onlyOwner`                                          |
| `VaultMarket` | `updateEvent`      | Admin                             | `onlyOwner`                                          |
| `VaultMarket` | `resolve`          | Admin                             | `onlyOwner` (oracle markets: only after gracePeriod) |
| `VaultMarket` | `cancelMarket`     | Admin                             | `onlyOwner` (Active/Paused/Closed → Cancelled)       |
| `VaultMarket` | `resolveByOracle`  | Permissionless                    | Requires state == Closed, resolver != ADMIN          |
| `VaultMarket` | `closeMarket`      | Permissionless                    | Requires `block.timestamp >= resolutionTime`         |
| `VaultToken`  | `settle`           | VaultMarket                       | `onlyMarket`                                         |


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


| ID  | Vulnerability                                                     | Contract               | Mitigation                                                                            |
| --- | ----------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| C1  | Batch Settlement DoS                                              | VaultCLOB              | Soft reverts with try/catch per match; emits `MatchFailed`                            |
| C2  | Fee Unpredictability                                              | VaultRisk              | Authoritative `previewEffectiveFee()` matches actual execution                        |
| C3  | Sybil Fee Evasion                                                 | VaultCredit            | Enforce `MIN_CREATOR_FEE` (0.5%) to registered ProfileID                              |
| C4  | Price Manipulation                                                | VaultRisk              | Use CLOB mid-price as reference, not AMM spot                                         |
| C5  | FPMM sell reverts if pool lacks complementary inventory           | VaultMarket            | Check `pool.balance[complement] >= requiredMerge`; revert `InsufficientPoolInventory` |
| C6  | Post-resolution pool/LP inventory stranded                        | VaultMarket, VaultCLMM | `reclaimPoolInventory()` for FPMM; `removeLiquidity()` stays open on resolved markets |
| C7  | CLOB order expiry not enforced on-chain                           | VaultCLOB              | `settleBatch` checks `block.timestamp <= order.expiry`; revert `OrderExpired`         |
| C8  | CLOB fill price direction unchecked                               | VaultCLOB              | Buy: `fillPrice <= order.price`; Sell: `fillPrice >= order.price`                     |
| C9  | CLOB volume bypasses velocity/surge fees                          | VaultCLOB, VaultRisk   | `settleBatch` calls `updateVelocity(notional)`; VaultCLOB added to whitelist          |
| C10 | `linkWallet` has no wallet consent — unauthorized profile linking | VaultCredit            | Requires EIP-712 signature from wallet being linked                                   |
| C11 | `cancelOrder` cannot verify caller is maker (only stores hash)    | VaultCLOB              | Changed to accept full `Order` struct; verify `msg.sender == order.maker`             |
| C12 | CLOB settlement missing cross-order validation                    | VaultCLOB              | Matched orders must share `(marketId, outcomeId)` with opposite `isBuy`               |


> **Velocity Rule (Clarification)**: Fees are computed using **pre-trade velocity** for user predictability. The `previewEffectiveFee()` method is authoritative — actual fee charged MUST match preview within tolerance. However, to prevent MEV boundary exploits (order splitting), use **interpolated LUTs** so fee changes are continuous, not step functions. Users should expect small variance (~1-2 bps) due to block timing.

### Architectural Anti-Patterns (Avoided)


| Pattern                    | Risk                      | Solution                                                               |
| -------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Push Payments              | Reverts lock funds        | Pull pattern with `withdrawEarnings()`                                 |
| Unchecked Math             | Overflow exploits         | Explicit checks on invariants, `mulDiv` for LUT                        |
| Fee-on-Transfer Collateral | Solvency invariant breaks | USDC-only assumption documented; no fee-on-transfer or rebasing tokens |
| Unbounded Outcome Count    | Gas DoS on FPMM math      | `MAX_OUTCOMES = 8` enforced in `createMarket`                          |


### Code Pattern Requirements


| Pattern           | Requirement                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| Transient Storage | `nonReentrant` on ALL external functions touching VaultToken              |
| LUT Interpolation | Use `MathLib.mulDiv` to handle WAD scaling                                |
| EIP-712 Domain    | Recompute `DOMAIN_SEPARATOR` if `block.chainid` changes (fork protection) |


### Risk Mitigations


| Risk                               | Mitigation                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| LVR / News shocks                  | Surge multipliers with cooldown                                                           |
| Toxic flow                         | Inventory skew fees (CLOB mid-price reference)                                            |
| CLMM mis-ranging                   | Wide-band minimum, tight-band caps                                                        |
| Sybil creators                     | ProfileID identity binding + MIN_CREATOR_FEE                                              |
| Oracle risk                        | Evidence requirements, earnings finality delay, FPMM sanity bounds on CLOB mid-price       |
| MEV / boundary exploits            | Interpolated LUTs (continuous fees, no step functions)                                    |
| USDC blacklist                     | **Acknowledged** (USDC centralization risk); `redeemTo()`/`mergeTo()` rescue variants     |
| Post-resolution stranded inventory | `reclaimPoolInventory()` for FPMM; `removeLiquidity()` open on resolved markets           |
| Unbounded outcome gas              | `MAX_OUTCOMES = 8` on `createMarket`                                                      |
| Earnings finality bypass           | `processEarnings()` gated on `block.timestamp >= finalityDeadline`                         |
| Cross-contract coupling            | All contracts deployed as cohort with immutable cross-references; migration at resolution |
| Fee-on-transfer collateral         | USDC-only assumption documented; invariants depend on exact-amount transfers              |
| CLOB velocity bypass               | `settleBatch` calls `updateVelocity`; VaultCLOB whitelisted                               |
| Unauthorized wallet linking        | `linkWallet` requires EIP-712 consent signature from target wallet                        |
| Cancel order spoofing              | `cancelOrder` takes full Order struct; verifies `msg.sender == maker`                     |
| CLOB cross-order mismatch          | Settlement validates matched orders share market/outcome with opposite sides              |
| No CLMM pause                      | CLMM gates swaps/adds via `VaultMarket.isMarketActive()`                                  |
| Global velocity side-effect        | **Intentional** design tradeoff documented; per-market velocity is v2 enhancement         |


### Engineering Checklist

**Security Critical:**

- `VaultCLOB.settleBatch`: try/catch per match, emit `MatchFailed` with compact codes (uint8)
- `VaultCLOB.settleBatch`: Bound max matches per batch (~50), bound per-order validation cost
- `VaultCLOB.settleBatch`: Enforce `block.timestamp <= order.expiry` per order; revert `OrderExpired`
- `VaultCLOB.settleBatch`: Enforce fill price direction (buy: `fillPrice <= order.price`, sell: `fillPrice >= order.price`)
- `VaultCLOB`: Verify fill amount ≤ remaining, fill price respects limits, token flows net exactly
- `VaultCLOB`: Route dynamic fees (via `VaultRisk.getEffectiveFee()`) to `VaultCredit.depositFees(marketId, fee, FeeSource.CLOB)`
- `VaultCredit`: Pull pattern with `getClaimable()` + `withdrawEarnings()`
- `VaultCredit.processEarnings`: Revert if `block.timestamp < market.finalityDeadline`
- `VaultToken.split`: Revert if market is Paused/Resolved (lifecycle gating)
- `VaultToken.settle`: Only VaultMarket can burn winning shares and release USDC
- `VaultRisk.getInventorySkew`: Use CLOB mid-price (TWAP, min volume threshold, max change/block, ±10% FPMM sanity bound)
- `VaultRisk.setLUT`: Validate monotonicity, bounds, length; keep rollback path
- `VaultMarket.createMarket`: Enforce `MIN_CREATOR_FEE` (0.5%) to ProfileID
- `VaultMarket.createMarket`: Enforce `outcomes <= MAX_OUTCOMES (8)`
- `VaultMarket.swap` (sell): Check pool has sufficient complementary inventory to merge; revert `InsufficientPoolInventory`
- `VaultMarket.resolve`: Set `finalityDeadline = block.timestamp + EARNINGS_FINALITY_DELAY`
- `VaultMarket`: Expose `reclaimPoolInventory(marketId)` for post-resolution FPMM inventory recovery
- `VaultCLMM.removeLiquidity`: MUST NOT revert on resolved markets (only gate `addLiquidity` and `swap`)
- `VaultCLMM.addLiquidity`/`swap`: Check `VaultMarket.isMarketActive(marketId)` and revert if paused/resolved
- `VaultCLOB.settleBatch`: Validate matched orders share `(marketId, outcomeId)` with opposite `isBuy`
- `VaultCLOB.cancelOrder`: Accept full `Order` struct; verify `msg.sender == order.maker`
- `VaultCredit.linkWallet`: Require EIP-712 consent signature from wallet being linked
- `VaultToken.split`/`merge`: Revert on `amount == 0`
- `VaultMarket.redeem`: Burns winning shares, pays USDC. Reverts with `NothingToRedeem` if user has zero winning shares. Losing shares are intentionally left inert (not burned) — at 1M+ users, burning $0-value tokens is pure gas waste. Frontend gates the "Redeem" button behind `getRedemptionAmount > 0` so losers never reach this code path.
- `VaultMarket`: Enforce state machine — Active/Paused/Closed/Resolved/Cancelled; Resolved and Cancelled are terminal
- `VaultMarket.cancelMarket`: Admin-only; state → Cancelled; snapshot collateral for pro-rata refunds
- `VaultMarket.claimRefund`: Pull-based; user reclaims proportional USDC from cancelled market; revert if already claimed
- `VaultMarket.closeMarket`: Permissionless; require `block.timestamp >= resolutionTime`
- `VaultMarket.resolveByOracle`: Require Closed + oracle staleness/snapshot/grace checks
- `VaultMarket.resolve` (admin): For oracle markets, block until `block.timestamp >= resolutionTime + gracePeriod` (use `>=`)
- `VaultMarket.resolveByOracle`: Use strict `>` for grace check (`block.timestamp > deadline` reverts); at `==` both oracle and admin are valid
- Test: `test_resolveAtExactGracePeriodBoundary()` — admin at `deadline` succeeds, admin at `deadline - 1` reverts, oracle at `deadline` succeeds, oracle at `deadline + 1` reverts
- `VaultMarket.swap`/`split`: Auto-close if `block.timestamp >= resolutionTime` (lazy transition)
- `VaultCredit.linkWallet`: Use mapping-based membership; cap `MAX_WALLETS_PER_PROFILE`
- `VaultToken.encodeTokenId`: Validate `marketId < 2^248` to prevent bit-packing collision
- `nonReentrant` on ALL external functions: `swap`, `addLiquidity`, `removeLiquidity`, `settleBatch`, `split`, `merge`, `redeem`
- `LUTLib.interpSurge`: Use `mulDiv(t, LUT[i+1] - LUT[i], 1e18)` for WAD precision
- `VaultCLOB.DOMAIN_SEPARATOR`: Dynamic recompute if `block.chainid` changes
- `previewEffectiveFee()` MUST match actual fee charged (within ~1-2 bps tolerance)

**Solvency Invariants (fuzz/property tests):**

- `totalSupply(encodeTokenId(marketId, i))` equal for all outcome indices `i` per market
- `collateralLocked[marketId] == completeSetsOutstanding[marketId]` after every write
- `merge(split(x)) == x` for all valid x
- FPMM sell bounded by pool complementary inventory
- Total USDC redeemed per market ≤ collateral locked

**Unit Conversion:**

- `UnitLib`: USDC 6 decimals ↔ Shares 18 decimals with explicit rounding
- Round DOWN on outputs (user receives less), UP on inputs (user pays more)
- Property test: `merge(split(x)) == x` for all valid x

**CLMM Math (High Priority):**

- Differential fuzz test `CLMMLib` against Uniswap v3 reference (mandatory)
- Fuzz all tick/liquidity/price conversions
- Invariants: `liquidity >= 0`, price in tick range, fee growth monotonic
- Casting discipline: audit each cast in `CLMMLib` against Uniswap v3 reference; use `SafeCastLib` only where reference uses checked casts; use `unchecked` where reference relies on wrapping; document each site with v3 source line citation
- Protocol LP fees route via `VaultCredit.depositFees(marketId, fee, FeeSource.CLMM)`

**Access Control:**

- `VaultRisk.updateVelocity`: Only callable by VaultMarket/VaultCLMM/VaultCLOB (whitelisted)
- `VaultCLOB.settleBatch`: Call `VaultRisk.updateVelocity(notional)` after processing fills
- `VaultCredit.recordDebt`: Only callable by VaultMarket (`onlyMarket`)
- `VaultCredit.processEarnings`: Only callable by VaultMarket (`onlyMarket`)
- `VaultCredit.depositFees`: Only callable by VaultMarket/VaultCLOB/VaultCLMM (`onlyFeeCollector`)
- Emit events on whitelist changes for observability

**Transient Storage:**

- Each contract uses unique slot hash (e.g., `keccak256("VaultMarket.ReentrancyGuard")`)
- No slot `0` usage to avoid library collisions
- Fork test `nonReentrant` paths on exact Arbitrum environment

**Deployment:**

- `evm_version = "cancun"` in foundry.toml (NOT osaka)
- `Deploy.s.sol` uses consistent deployer key for vanity address
- Salt mining includes deployer address in hash
- Store `(deployer, salt)` pair in deployment artifacts
- CI fork tests on Arbitrum Sepolia/One

**Metadata:**

- `VaultToken.uri()` returns fully on-chain JSON (data URI)
- Metadata includes marketId, outcomeId, totalSupply

**Operational:**

- Admin behind Gnosis Safe with hardware keys
- Role separation: RESOLVER_ROLE, RISK_ROLE, CREDIT_ROLE
- Relayer failover keys documented, SLA published
- Emergency role rotation capability on-chain

### Audit Surface

- 6 core contracts + 1 CRE resolution consumer + 9 libraries + 1 CRE workflow (TypeScript)
- ~35 write methods (minimal)
- ~68 read methods (comprehensive but view-only)
- No proxies (simpler to verify)
- Immutable contracts (no upgrade vectors)
- Fully on-chain metadata (no external dependencies)

---

## Audit Findings Summary

Architecture-level audit (pre-implementation). Severity rubric: Critical (total loss), High (significant manipulation), Medium (DoS/griefing), Low/Info (best practices).

### Critical Findings (Acknowledged)


| ID          | Finding                                                     | Status                                                                                 |
| ----------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| CRITICAL-01 | Admin key compromise = total loss (markets, params, credit) | **Accepted** (trusted model) + operational controls                                    |
| CRITICAL-02 | Relayer-only CLOB = censorship/MEV vector                   | **Accepted** + failover keys, SLA                                                      |
| CRITICAL-03 | CLOB mid-price oracle = implicit oracle risk                | **Mitigated** via TWAP, volume threshold, change caps, ±10% FPMM sanity bounds         |
| CRITICAL-04 | USDC blacklist can permanently lock user funds              | **Acknowledged** (USDC centralization); `redeemTo()`/`mergeTo()` rescue variants added |


### High Findings (Mitigated)


| ID      | Finding                                                            | Mitigation                                                                                                                                              |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH-01 | EVM `osaka` target unsupported on Arbitrum                         | Changed to `cancun`, fork tests required                                                                                                                |
| HIGH-02 | ERC-1155 callbacks = reentrancy surface                            | Contract-unique transient slots, all paths guarded                                                                                                      |
| HIGH-03 | USDC 6 decimals vs Shares 18 decimals                              | `UnitLib` with explicit rounding, property tests                                                                                                        |
| HIGH-04 | CLMM tick math easy to get wrong                                   | Differential fuzz testing vs Uniswap v3; **SafeCast trap**: do NOT blindly apply checked casts — follow v3 wrapping/checked logic exactly per cast site |
| HIGH-05 | FPMM sell path undocumented; pool may lack complementary inventory | Explicit sell sourcing rule + `InsufficientPoolInventory` revert                                                                                        |
| HIGH-06 | Post-resolution FPMM/CLMM inventory stranded                       | `reclaimPoolInventory()` for FPMM; `removeLiquidity()` stays open on resolved markets                                                                   |
| HIGH-07 | CLOB order expiry not enforced on-chain                            | `block.timestamp <= order.expiry` check in `settleBatch`; `OrderExpired` revert                                                                         |
| HIGH-08 | CLOB fill price direction unchecked vs Order struct                | Single `price` field = limit; buy: `fillPrice <= price`, sell: `fillPrice >= price`                                                                     |
| HIGH-09 | CLOB volume invisible to surge fee engine                          | `settleBatch` calls `updateVelocity`; VaultCLOB added to whitelist                                                                                      |
| HIGH-10 | `linkWallet` lacks wallet consent; unauthorized linking            | EIP-712 signature required from wallet being linked                                                                                                     |
| HIGH-11 | `cancelOrder(hash)` cannot verify maker identity                   | Changed to `cancelOrder(Order)` with `msg.sender == maker` check                                                                                        |
| HIGH-12 | CLOB matched orders not validated for same market/side             | Cross-order validation: same `(marketId, outcomeId)`, opposite `isBuy`                                                                                  |


### Medium Findings (Addressed)


| ID        | Finding                                                              | Mitigation                                                                               |
| --------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| MEDIUM-01 | Soft-revert string griefing                                          | Compact failure codes (uint8), bounded batches                                           |
| MEDIUM-02 | Settlement price/amount under-specified                              | On-chain fill constraints documented with price direction enforcement                    |
| MEDIUM-03 | Risk engine whitelist liveness                                       | Observability events on changes                                                          |
| MEDIUM-04 | Malformed LUT can brick pricing                                      | Validation on upload (monotonicity, bounds, length)                                      |
| MEDIUM-05 | Pre vs post velocity inconsistency                                   | Clarified: pre-trade + interpolated LUTs                                                 |
| MEDIUM-06 | Credit sybil/identity risk                                           | Operational (off-chain identity binding)                                                 |
| MEDIUM-07 | `processEarnings` callable before earnings finality expires           | On-chain gate: revert if `block.timestamp < finalityDeadline`                             |
| MEDIUM-08 | No max outcome count; FPMM gas DoS                                   | `MAX_OUTCOMES = 8` enforced in `createMarket`                                            |
| MEDIUM-09 | Cross-contract immutable coupling unclear                            | Documented: all contracts deploy as cohort; migration at resolution boundaries           |
| MEDIUM-10 | Equal supply invariant not explicitly stated                         | Added: `totalSupply` must be equal across all outcomes per market                        |
| MEDIUM-11 | Fee-on-transfer collateral breaks solvency                           | Documented: USDC-only assumption; no rebasing/fee tokens                                 |
| MEDIUM-12 | Credit line scope ambiguous                                          | Documented: scoped to FPMM initial liquidity only via VaultMarket                        |
| MEDIUM-13 | No emergency pause on VaultCLMM                                      | CLMM gates `addLiquidity`/`swap` via `VaultMarket.isMarketActive()`                      |
| MEDIUM-14 | `EARNINGS_FINALITY_DELAY` undefined                                           | Added as constant: 86400 (24 hours)                                                      |
| MEDIUM-15 | Market state transitions not formalized                              | Added explicit state machine: Active↔Paused, Active/Paused→Resolved (terminal)           |
| MEDIUM-16 | `split(0)`/`merge(0)` not guarded                                    | Zero-amount calls revert                                                                 |
| MEDIUM-17 | Double redemption not explicitly guarded                             | `redeem` reads winning balance atomically; second call reverts `NothingToRedeem` (balance is zero) |
| MEDIUM-18 | `getPositionsByOwner` unbounded return                               | Paginated variant added                                                                  |
| MEDIUM-19 | Wallet linking creates unbounded arrays (gas bomb)                   | Mapping-based membership; view-only enumeration; `MAX_WALLETS_PER_PROFILE` cap           |
| MEDIUM-20 | No `Closed` state; resolution timing ambiguous                       | Added `Closed` state with lazy transition at `resolutionTime`; formal state machine      |
| MEDIUM-21 | Grace period off-by-one (`>` vs `>=`) can lock or overlap resolution | Oracle uses `>` (valid at `==`), admin uses `>=` (valid at `==`); boundary test required |


### Positive Design Elements

- Debt-first waterfall (100% seizure until repaid)
- Pull payments for earnings
- Explicit ACL table
- Soft revert batching
- Formal market state machine (Resolved is terminal)
- Zero-amount guards on all token operations
- EIP-712 consent on wallet linking
- Global velocity covers all venues (FPMM + CLMM + CLOB)
- Permissionless oracle resolution with admin fallback
- Chainlink CRE Workflow for resolution liveness (off-chain scanning, BFT consensus, no funds held in consumer)
- Explicit Closed state separates trading cessation from resolution
- Oracle staleness + snapshot semantics prevent stale/ambiguous resolutions

---

## Appendix: Recommended Parameters


| Parameter                   | Default     | Notes                   |
| --------------------------- | ----------- | ----------------------- |
| f0 (baseline fee)           | 300 bps     | 3% trading fee          |
| f_max (cap)                 | 1500 bps    | 15% max under surge     |
| alpha (velocity decay)      | 0.97/block  | L2-tuned                |
| beta (cooldown decay)       | 0.995/block | Slow anti-oscillation   |
| gamma (inventory skew)      | tuned       | Market-class dependent  |
| alpha_wide (CLMM wide band) | >= 20%      | Safety allocation       |
| alpha_max (tight bands)     | <= 40%      | Cap tight-band exposure |
| Credit limit (creator)      | $500-$2k    | Tiered by verification  |
| Credit limit (trusted KOL)  | $1k-$10k    | Tiered, debt-first      |


---

*This document is the canonical reference for the Vault Markets smart contract architecture. Update this document when making implementation changes.*