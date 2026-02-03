# Vault Markets — On-Chain Migration Proposal

> **Prepared for**: Vault Markets  
> **Date**: February 2026  
> **Version**: 1.0

---

## Executive Summary

This proposal outlines the development scope, timeline, and investment for migrating Vault Markets from an off-chain prediction market platform to a fully on-chain, decentralized system on Arbitrum.

| Item | Details |
|------|---------|
| **Timeline** | 8-9 weeks total (includes 2 buffer weeks) |
| **Team** | 3 developers (parallel execution) |
| **Rate** | $100/hour |
| **Core Development** | 263 hours / $26,300 (estimated) |
| **Flex Hours** | Up to 80 hours / up to $8,000 (as needed) |
| **Total Development** | **Up to 343 hours / up to $34,300** |

---

## Project Overview

### Deliverables

1. **Smart Contracts** — CPMM market maker, ERC-1155 outcome tokens, order settlement, liquidity vault
2. **Indexing Infrastructure** — The Graph subgraph, webhook event processing, real-time data
3. **Frontend Integration** — Wallet connection, contract interactions, transaction flows
4. **Admin Tooling** — On-chain market creation, resolution flows, multisig integration
5. **Testnet & Mainnet Deployments** — Arbitrum Sepolia → Arbitrum One

### Key Milestones

| Milestone | Target | Deliverable |
|-----------|--------|-------------|
| **M1: Testnet Ready** | Week 2 | All contracts deployed, integrations working, audit submitted |
| **Buffer: Testnet Stabilization** | Week 3 | Address testnet issues, gather feedback (flex hours if needed) |
| **M2: Audit Complete** | Week 5 | Audit findings received and triaged |
| **M3: Audit Remediation** | Week 6 | Critical/high findings addressed |
| **Buffer: Pre-Launch Hardening** | Week 7 | Final QA, monitoring setup (flex hours if needed) |
| **M4: Mainnet Launch** | Week 8-9 | Production deployment, soft launch, public launch |

> **Note on Buffer Weeks**: Buffer time is built into the calendar for unknowns. If work is needed during buffer weeks, it draws from the flex hours pool — no additional hours are pre-committed.

---

## Phased Delivery

### Phase 1: Development Sprint (Weeks 1-2)

**Objective**: Complete core development, deploy to testnet, submit for audit

```
Week 1                              Week 2
─────────────────────────────────────────────────────────────
Contracts    ████████████████████   ████████████████
Backend      ████████████           ████████
Frontend     ████████████           ████████████
─────────────────────────────────────────────────────────────
                                    ▲ Testnet Live
                                    ▲ Audit Submitted
```

#### Phase 1 Deliverables

| Stream | Hours | Deliverables |
|--------|-------|--------------|
| **Contracts** | 72h | MarketFactory, Market (CPMM), OutcomeToken (ERC-1155), OrderSettlement, LiquidityVault, ResolverRouter, unit tests, testnet deployment |
| **Backend** | 80h | Subgraph schema + mappings, webhook endpoint, event queue, testnet infrastructure, **+ oracle/resolution R&D** |
| **Frontend** | 40h | Wallet integration, contract hooks, trading panel wiring, position display, admin flows |
| **Total** | **192h** | |

#### Backend Oracle/Resolution Exploratory (Included in Phase 1)

| Activity | Hours | Description |
|----------|-------|-------------|
| **Chainlink Integration R&D** | 8h | Evaluate Chainlink Functions, data feeds, and automation for resolution |
| **Decentralized API Design** | 4h | Architecture for trustless resolution data sourcing |
| **On-Chain Resolution Infra** | 4h | Resolution management contracts and dispute flow prototyping |
| **Total Exploratory** | **16h** | |

> This exploratory work runs parallel to Phase 1 development, investigating decentralized oracle infrastructure for market resolution.

#### Phase 1 Cost

| Item | Hours | Rate | Cost |
|------|-------|------|------|
| Core Development | 176h | $100/hr | $17,600 |
| Oracle/Resolution R&D | 16h | $100/hr | $1,600 |
| **Phase 1 Total** | **192h** | | **$19,200** |

---

### Phase 2: Audit & Iteration (Weeks 3-5)

**Objective**: Iterate on testnet feedback while audit runs in parallel

> **Includes buffer week (Week 3)** for testnet stabilization. Any work during buffer draws from flex hours.

```
Week 3                              Week 4
─────────────────────────────────────────────────────────────
Audit        ████████████████████████████████████████████████
Contracts    ████████               ████████
Backend      ████████               ████
Frontend     ████████████           ████████
─────────────────────────────────────────────────────────────
                                    ▲ Audit Report Received
```

#### Phase 2 Activities

| Activity | Description |
|----------|-------------|
| **Testnet Bug Fixes** | Address issues discovered during internal/external testing |
| **UX Feedback** | Incorporate feedback from beta testers |
| **Gas Optimization** | Reduce transaction costs where possible |
| **Documentation** | User guides, API documentation |
| **Audit Prep** | Respond to auditor questions, provide context |

#### Phase 2 Breakdown

| Stream | Hours | Focus |
|--------|-------|-------|
| **Contracts** | 18h | Bug fixes, gas optimization, static analysis |
| **Backend** | 16h | Indexer fixes, performance tuning, monitoring |
| **Frontend** | 10h | UX feedback, error handling, mobile fixes |
| **Total** | **44h** | |

#### Phase 2 Cost

| Item | Hours | Rate | Cost |
|------|-------|------|------|
| Iteration & Polish | 44h | $100/hr | $4,400 |

---

### Phase 3: Audit Remediation & Launch (Weeks 6-9)

**Objective**: Address audit findings, pre-launch hardening, deploy to mainnet, launch

> **Includes buffer week (Week 7)** for pre-launch hardening. Any work during buffer draws from flex hours.

```
Week 5          Week 6          Week 7          Week 8
─────────────────────────────────────────────────────────────
Audit Fixes  ████████████████
Mainnet                      ████████
Soft Launch                              ████████████████
Public                                               ████████
─────────────────────────────────────────────────────────────
             ▲ Fixes Done    ▲ Mainnet   ▲ Soft      ▲ Public
```

#### Phase 3 Breakdown

| Stream | Hours | Focus |
|--------|-------|-------|
| **Contracts** | 11h | Audit response, mainnet deployment |
| **Backend** | 10h | Mainnet infrastructure, subgraph deployment |
| **Frontend** | 6h | Launch support, final polish |
| **Total** | **27h** | |

#### Phase 3 Deliverables

| Activity | Description |
|----------|-------------|
| **Audit Response** | Fix critical and high severity findings |
| **Final Testing** | Verify fixes, regression testing |
| **Mainnet Deployment** | Contract deployment, verification, configuration |
| **Infrastructure** | Production subgraph, monitoring, alerts |
| **Launch Support** | On-call support during soft and public launch |

#### Phase 3 Cost

| Item | Hours | Rate | Cost |
|------|-------|------|------|
| Remediation & Launch | 27h | $100/hr | $2,700 |

---

## Flex Hours (Dynamic Allocation)

> **Important**: Flex hours are a **dynamic allocation**, not a fixed commitment. These hours are available as needed for unforeseen work and are **billed only when used**. This provides budget flexibility while maintaining cost predictability.

### What Flex Hours Cover

| Category | Example Use Cases |
|----------|-------------------|
| **General Maintenance** | Dependency updates, security patches, CI/CD fixes, environment issues |
| **Audit Response Overflow** | If audit findings exceed the 6h budgeted in Phase 3 |
| **Integration Edge Cases** | Unexpected wallet behaviors, RPC issues, subgraph quirks |
| **UX Iterations** | Additional feedback cycles beyond Phase 2 allocation |
| **Exploratory / R&D** | Gas optimization research, alternative approaches, tooling |
| **Post-Launch Support** | Bug fixes, monitoring, hotfixes after mainnet launch |

### Flex Hours Budget

| Item | Hours | Rate | Max Cost |
|------|-------|------|----------|
| Flex Allocation | **Up to 80h** | $100/hr | **Up to $8,000** |

### How Flex Hours Work

```
┌────────────────────────────────────────────────────────────────┐
│  FLEX HOURS ARE                 │  FLEX HOURS ARE NOT          │
├────────────────────────────────────────────────────────────────┤
│  ✅ Available budget cap        │  ❌ A fixed cost on invoices │
│  ✅ Billed only when consumed   │  ❌ Pre-allocated to tasks   │
│  ✅ Tracked transparently       │  ❌ Guaranteed to be used    │
│  ✅ A safety net for unknowns   │  ❌ Billed if not needed     │
└────────────────────────────────────────────────────────────────┘
```

### Flex Hours Terms

| Aspect | Details |
|--------|---------|
| **Billing** | Invoiced only for hours actually worked |
| **Tracking** | Logged separately with task descriptions |
| **Approval** | Brief justification provided for each use |
| **Reporting** | Weekly summary of flex hours consumed |
| **Rollover** | Unused hours do not carry forward or require payment |
| **Reallocation** | Can be used by any team member based on need |

---

## Investment Summary

### Development Costs

| Phase | Hours | Cost | Type |
|-------|-------|------|------|
| Phase 1: Development Sprint | 176h | $17,600 | Estimated |
| Phase 1: Oracle/Resolution R&D | 16h | $1,600 | Estimated |
| Phase 2: Audit & Iteration | 44h | $4,400 | Estimated |
| Phase 3: Remediation & Launch | 27h | $2,700 | Estimated |
| **Core Subtotal** | **263h** | **$26,300** | **Estimated** |
| Flex Hours (as needed) | Up to 80h | Up to $8,000 | Dynamic |
| **Maximum Total** | **Up to 343h** | **Up to $34,300** | |

> **Note**: Core hours are estimates based on scope. Actual hours tracked and billed. Flex hours billed only if used.

### Additional Costs (External)

| Item | Estimate | Notes |
|------|----------|-------|
| Smart Contract Audit | $25,000 - $50,000 | Depends on auditor and timeline |
| Infrastructure (setup) | ~$1,000 | Alchemy, The Graph, Redis |
| Infrastructure (monthly) | ~$500/mo | Ongoing hosting and services |
| Bug Bounty Fund | $10,000 - $25,000 | Paid in USDC + $VAULT tokens |

#### Bug Bounty Program Details

| Severity | USDC Reward | $VAULT Bonus | Total Value |
|----------|-------------|--------------|-------------|
| **Critical** | $5,000 - $15,000 | + 50% in $VAULT | Up to $22,500 |
| **High** | $2,000 - $5,000 | + 50% in $VAULT | Up to $7,500 |
| **Medium** | $500 - $2,000 | + 25% in $VAULT | Up to $2,500 |
| **Low** | $100 - $500 | + 25% in $VAULT | Up to $625 |

> **Why $VAULT tokens?** Aligns security researchers with long-term protocol success. Token bonus vests over 6 months to encourage ongoing participation.

### Total Project Investment

| Category | Estimated | Maximum | Notes |
|----------|-----------|---------|-------|
| Core Development | $26,300 | $26,300 | 263h estimated |
| Flex Hours | $0 | $8,000 | As needed |
| **Development Subtotal** | **$26,300** | **$34,300** | |
| Audit | $25,000 | $50,000 | External |
| Infrastructure | $2,000 | $4,000 | External |
| Bug Bounty (USDC + $VAULT) | $10,000 | $25,000 | USDC base + token bonus |
| **Total Project** | **$63,300** | **$113,300** | |

---

## Team Allocation

### Developer Roles

| Role | Focus Areas | Core Hours | Flex (shared pool) |
|------|-------------|------------|------------|
| **Dev 1: Contracts** | Smart contracts, Solidity, Foundry, security | 101h | — |
| **Dev 2: Backend** | Subgraph, indexing, infrastructure, DevOps, **oracle R&D** | 106h | — |
| **Dev 3: Frontend** | React, wallet integration, UI wiring | 56h | — |
| **Flex Pool** | Any team member, as needed | — | Up to 80h |

### Hours by Phase

| Developer | Phase 1 | Phase 1 R&D | Phase 2 | Phase 3 | Core Total |
|-----------|---------|-------------|---------|---------|------------|
| Dev 1 (Contracts) | 72h | — | 18h | 11h | 101h |
| Dev 2 (Backend) | 64h | 16h | 16h | 10h | 106h |
| Dev 3 (Frontend) | 40h | — | 10h | 6h | 56h |
| **Total** | **176h** | **16h** | **44h** | **27h** | **263h** |

> **Parallel Execution**: All 3 developers work simultaneously. Calendar time is ~2 weeks for Phase 1, not 192 hours of elapsed time.
> 
> **Phase 1 R&D**: Oracle/resolution exploratory work runs in parallel with core development during weeks 1-2.

---

## Timeline

```
        Week 1    Week 2    Week 3    Week 4    Week 5    Week 6    Week 7    Week 8    Week 9
        ─────────────────────────────────────────────────────────────────────────────────────────
Phase 1 ████████████████████
        Development Sprint
                          ▲ M1: Testnet Ready

Buffer                    ░░░░░░░░░░
                          Testnet Stabilization (flex hours if needed)

Audit                     ████████████████████████████████████████████████
                          External Audit (2-3 weeks)
                                                        ▲ M2: Audit Complete

Phase 2           ████████████████████████████████████████████████
                  Iteration & Polish

Phase 3                                                 ████████████████████
                                                        Remediation
                                                                    ▲ M3

Buffer                                                              ░░░░░░░░░░
                                                                    Pre-Launch Hardening

Launch                                                                        ████████████████
                                                                              Soft → Public
                                                                                      ▲ M4
```

> **Legend**: ████ = Active work (core hours) | ░░░░ = Buffer time (flex hours if needed)

### Milestone Dates (Estimated)

| Milestone | Target | Dependencies |
|-----------|--------|--------------|
| M1: Testnet Ready | End of Week 2 | Development complete |
| Buffer: Testnet Stabilization | Week 3 | — |
| M2: Audit Complete | End of Week 5 | Audit firm availability |
| M3: Audit Remediation | End of Week 6 | Audit findings severity |
| Buffer: Pre-Launch Hardening | Week 7 | — |
| M4: Mainnet Launch | Week 8-9 | Clean remediation, QA sign-off |

---

## Assumptions & Dependencies

### Assumptions

1. **Existing UI**: Current frontend components are 90%+ reusable — minimal new UI development required
2. **Audit Availability**: Audit firm can begin within 1 week of code freeze
3. **Audit Duration**: 2-3 week turnaround for audit report
4. **No Major Findings**: Audit does not reveal architectural issues requiring redesign
5. **Infrastructure Access**: Alchemy, The Graph, and hosting accounts are provisioned

### Dependencies

| Dependency | Owner | Required By |
|------------|-------|-------------|
| Audit firm booked | Client | Week 1 |
| Arbitrum Sepolia ETH | Client | Week 1 |
| Testnet USDC faucet | Dev Team | Week 1 |
| Production infrastructure | Dev Team | Week 5 |
| Bug bounty scope approved | Client | Week 5 |

---

## Risk Factors

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Audit delays | Timeline slip | Medium | Book audit early, have backup auditor |
| Critical audit findings | Cost increase | Medium | Budget flex hours for response |
| Testnet issues | Timeline slip | Low | 3 devs can swarm blockers |
| Gas costs higher than expected | UX impact | Low | Optimize during Phase 2 |
| Scope creep | Budget overrun | Medium | Defer non-MVP features to v2 |

---

## Payment Terms

### Core Development Payment Schedule

| Milestone | Percentage | Amount | Trigger |
|-----------|------------|--------|---------|
| Project Kickoff | 30% | $7,890 | Contract signed |
| Testnet Delivery (M1) | 30% | $7,890 | Testnet deployed, audit submitted |
| Mainnet Launch (M4) | 30% | $7,890 | Mainnet live |
| Project Completion | 10% | $2,630 | 2 weeks post-launch support complete |
| **Core Total** | **100%** | **$26,300** | |

### Flex Hours Billing

| Aspect | Details |
|--------|---------|
| **Billing Frequency** | Monthly in arrears |
| **Invoice Format** | Itemized with task descriptions and hours |
| **Rate** | $100/hour |
| **Maximum** | Up to 80 hours ($8,000) total |
| **Unused Hours** | Not billed |


---

## Acceptance Criteria

### M1: Testnet Ready

- [ ] All smart contracts deployed to Arbitrum Sepolia
- [ ] Contracts verified on Arbiscan
- [ ] Subgraph deployed and indexing events
- [ ] Frontend can execute trades via wallet
- [ ] Admin can create markets via multisig
- [ ] Audit codebase submitted to auditor

### M2: Audit Complete

- [ ] Audit report received
- [ ] Findings categorized by severity
- [ ] Remediation plan documented

### M3: Audit Remediation

- [ ] All critical findings addressed
- [ ] All high findings addressed
- [ ] Medium/low findings triaged (fix or accept risk)
- [ ] Re-review by auditor (if required)

### M4: Mainnet Launch

- [ ] Contracts deployed to Arbitrum One
- [ ] Contracts verified on Arbiscan
- [ ] Subgraph live on The Graph Network
- [ ] Production infrastructure operational
- [ ] Monitoring and alerts configured
- [ ] Soft launch completed with allowlist
- [ ] Public launch announcement ready

---

## Next Steps

1. **Review & Questions** — Review this proposal; schedule call for questions
2. **Audit Booking** — Secure audit slot (recommend booking ASAP)
3. **Contract Signing** — Execute agreement and initial payment
4. **Kickoff** — Project kickoff meeting, environment setup
5. **Sprint Start** — Begin Phase 1 development

---

## Contact

For questions about this proposal, please contact:

**[Your Name / Company]**  
Email: [email]  
Schedule a call: [calendly link]

---

*This proposal is valid for 30 days from the date above.*
