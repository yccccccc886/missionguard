# MissionGuard: protocol and threat model

## Purpose

Enforce a shared on-chain spending boundary for a task delegated among multiple agents. Target users are developers of agent workflows that purchase APIs or other services. Demand and willingness to pay are hypotheses; no adoption metrics are claimed.

## Authorization path

1. The owner deposits a known ERC20 amount and sets an expiry and a task-specification hash.
2. The owner configures recipients and creates root grants. An agent can delegate beneath its grant.
3. A leaf agent signs a typed payment bound to the chain, vault, mission, grant, recipient, amount, request ID, deadline and policy epoch.
4. Any relayer submits it. The contract checks the task and every ancestor, updates all counters and transfers tokens atomically.
5. The owner can revoke the task or a subtree. A direct parent agent can revoke its child subtree. The owner recovers the unused balance after task revocation or expiry.

## Invariants

For a standard supported token and every mission:

`spent + withdrawn <= funded budget`

For every grant:

`spent <= grant limit`

A successful payment charges each ancestor exactly once. A rejected or reverted payment consumes neither token budget nor the request ID. Failed on-chain transactions may still cost gas.

Limits are cumulative ceilings, not escrow reservations. Siblings can have overlapping ceilings and compete for shared funds. The EVM executes transactions in order, so two competing requests cannot each consume the same remaining balance. This does not guarantee fair ordering or prevent authorized budget exhaustion.

## What the vault blocks

Over-budget transfers, per-payment violations, unknown recipients, duplicate request IDs, altered signed fields, wrong chain/vault signatures, revoked or expired ancestor grants, and stale policies. Revocation takes effect when its transaction executes.

## What the vault does not decide

Service quality, malicious allowed merchants, whether a purchase is sensible, or whether an LLM was prompt-injected. It bounds the resulting on-chain spend rather than trying to classify model intent. It does not protect a compromised mission-owner wallet, undo settled payments, fund gas, provide fairness, or support arbitrary token mechanics.

## Evidence levels

| Surface | What it proves | What it does not prove |
| --- | --- | --- |
| Browser simulation | Visible policy examples | Signature or consensus enforcement |
| Local EVM tests | Solidity execution and tested invariants | Independent audit or Fuji deployment |
| Local scripted workflow | Signing, delegated payment, revocation and refund work together | A live LLM or external service purchase |
| Fuji wallet tab | Real contract interaction when connected and funded | A successful action before its receipt confirms |

`contract-tests.json` contains the current local results and source hash. `local-demo.json` contains the local workflow. `fuji-deployment.json` declares deployment status explicitly. A contract simulation is labelled as a simulation and has no broadcast transaction hash.

## Implementation

Solidity 0.8.30, Cancun target, optimizer 200 runs. OpenZeppelin SafeERC20, ReentrancyGuard, EIP712 and SignatureChecker. No upgrade proxy or administrative withdrawal route. ERC-1271 verification uses SignatureChecker. Maximum delegation depth is eight. Payment settlement is a custom EIP-712 scheme; x402 interoperability is future work.

Task specification hashes are metadata commitments. The contract does not evaluate the specification. Agent keys are disposable and kept only in browser memory. Persistent recovery requires the owner's wallet plus contract address and mission ID.

## Avalanche fit

Fuji gives a public EVM environment for independently inspectable deployment and receipts. The implementation uses C-Chain contracts and Fuji wallets; it does not claim a custom Avalanche L1, cross-chain messaging, exclusive Avalanche functionality or measured throughput advantages. The pitch should distinguish implemented features from future integration ideas.
