# MissionGuard

**Task budgets for AI teams on Avalanche.** A non-upgradeable ERC20 vault with delegated spending limits, atomic shared budgets, and subtree revocation.

一个任务可以有多个 Agent 和多层子任务。每次付款都必须同时满足任务总预算、当前 Agent 及所有上级的累计额度、单笔上限、收款白名单、到期时间和签名版本。撤销上级会让所有后代的待执行付款失效。

## Start

Node.js 22.13+ and npm are required.

```sh
npm ci
npm run contracts:compile
npm run test:contracts
npm run test:ui
npm run demo:local
npm run dev
```

Open the printed local URL. The site supports Chinese and English.

## What is implemented

- Solidity escrow with EIP-712 payments and EOA/ERC-1271 agent signatures.
- Delegation up to 8 levels. Each successful leaf payment charges every ancestor in the same transaction.
- Overlapping grants share the mission ceiling. Grant limits are **not reservations** and do not promise fairness.
- Mission-scoped request IDs prevent duplicate spending across agents.
- Merchant policy changes increment the mission epoch and invalidate old signatures.
- Revocation and expiry permit the owner to recover unused funds.
- Interactive simulation of seven attack scenarios, and browser-wallet Fuji deployment and self-testing.
- Reproducible local EVM tests and a scripted multi-agent execution trace.

## Evidence and current boundaries

Read `public/evidence/contract-tests.json` for test results and source fingerprint. Run `npm run demo:local` to regenerate `public/evidence/local-demo.json`: 10 DemoUSD funded, 2.5 paid, 7.5 recovered. These are **real contract executions on a local EVM**, not Fuji receipts. Local transaction hashes have no public explorer link.

The browser simulator is an educational state machine, not cryptographic validation. The agents are deterministic signers, not a live language model. No external paid API is purchased. EIP-712 payments are a custom protocol, **not an x402 implementation**. The vault cannot determine whether a service delivered useful output. Automated tests are not an independent audit.

Fuji deployment status is recorded in `public/evidence/fuji-deployment.json`. A `not-deployed` status means public-chain evidence is still pending. The site can also deploy a personal test vault through Core or MetaMask.

## Fuji

Network: Avalanche Fuji C-Chain, chain ID **43113**. RPC: https://api.avax-test.network/ext/bc/C/rpc

Get free test AVAX from https://build.avax.network/console/primary-network/faucet. Use valueless test assets only.

```sh
npm run deploy:fuji
```

The optional CLI reads a disposable testnet key from ignored `.secrets/fuji-deployer.json`, checks the chain before sending, records deployment receipts, and resumes confirmed partial deployments. Never publish this file. The browser flow requires no key file. DemoUSD has 6 decimals and unrestricted minting. It is not Circle USDC.

## Repository map

| Path | Purpose |
| --- | --- |
| `contracts/MissionGuard.sol` | Vault, payments and delegated policy |
| `contracts/DemoUSD.sol` | Test-only ERC20 |
| `lib/guard-sdk.ts` | Typed payment schema and error decoding |
| `scripts/test-contracts.mjs` | Contract and adversarial invariant tests |
| `scripts/demo-local.mjs` | Reproducible multi-agent execution |
| `components/chain-panel.tsx` | Real Fuji wallet workflow |
| `public/evidence/architecture.md` | Protocol and threat model |
| `docs/submission.md` | Submission copy and source links |
| `docs/demo-script.md` | Three-minute pitch and demo instructions |

## Design limits

Only trusted, standard non-rebasing ERC20 tokens are supported. Incoming transfer fees are rejected, but arbitrary malicious tokens are out of scope. A compromised agent may spend its entire authorized allowance at allowed merchants until the revocation transaction executes. Revocation cannot undo already confirmed payments, and ordering of pending transactions is not guaranteed. The task budget does not cover relayer gas. The deployment has no upgrade or platform withdrawal key.

The browser keeps agent keys in memory only. A refresh loses those keys; retain the vault address and mission ID so the owner can revoke and recover the remainder. No keys are sent to a server.

MIT license. AI-assisted implementation; the entrant must understand the code and comply with the organizer's final rules before submitting.
