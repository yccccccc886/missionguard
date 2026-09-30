# MissionGuard

**Task procurement and receipts for AI workflows on Avalanche.** Inspect a real contract activity report, bind it to a funded mission, and reconcile service orders with exact payment receipts.

2026-09-30: 12 confirmed Fuji transactions escrowed 10 DemoUSD, paid 2 and refunded 8. Independent verification paid after research revocation. A real Qwen2.5 model call interpreted the sourced report. The local production Worker verified model caching and receipt-backed delivery recovery. All 12 Fuji receipts were rechecked today. Full hosted browser-wallet acceptance is still pending. Demo services are self-operated; no external customers or commercial payments are claimed.

Reviewer materials: [quick guide](public/submission/guide.html), [8-slide pitch](public/submission/MissionGuard-Pitch.pptx), [155-second evidence walkthrough](public/submission/MissionGuard-Demo.mp4), [submission copy](docs/submission-form.md). The guide is also served at `/submission/guide.html`; recorded evidence needs no wallet. The entrant authorized public access on September 30. GitHub is publicly readable and the Site access policy is public. Anonymous browser reachability still needs confirmation because automated Site requests receive Cloudflare 403.

一个任务可以有多个 Agent 和多层子任务。每次付款都必须同时满足任务总预算、当前 Agent 及所有上级的累计额度、单笔上限、收款白名单、到期时间和签名版本。撤销上级会让所有后代的待执行付款失效。

## Start

Node.js 22.13+ and npm are required.

```sh
npm ci
npm run contracts:compile
npm run test:contracts
npm run test:ui
npm run demo:local
npm run demo:procurement
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

The browser simulator is an educational state machine, not cryptographic validation. Payment agents are deterministic signers. Optional SiliconFlow interpretation uses a shared server-side adapter. A real Qwen2.5-7B-Instruct call was verified on September 29, with 316 input and 186 output tokens; the recorded sample has assistant factual review, with human review and hosted UI acceptance pending. It does not control payments. EIP-712 payments are a custom protocol, **not an x402 implementation**. The vault cannot determine whether a service delivered useful output. Automated tests are not an independent audit.

## Real-data and order workflow

1. Generate an Avalanche contract activity brief, or open the recorded example. Reads use a fixed 96-block window ending two blocks before the observed head. A same-provider reread checks consistency; this is not an independent audit or a guarantee of complete activity coverage.
2. The task ID commits to network, address, block range and end-block hash. Reports and verified receipts persist in Site R2 storage. Public blockchain data is not treated as private user content.
3. Once the project vault is deployed, load its fixed service recipient and create a mission bound to the report ID. The data child has a 3-unit ceiling under an 8-unit parent; verification has its own 2-unit root. The total mission ceiling is 10.
4. Service orders cost 1.5 and 0.5 **valueless DemoUSD**. Their request IDs bind task, service, vault, settlement chain and mission. Retrying the same order in the same mission cannot charge again. A fresh mission or distinct report creates a different order.
5. The fulfillment endpoint checks the trusted deployed vault, mission report binding, successful Fuji receipt, recipient, exact amount and request ID. A confirmed transfer and delivered result are separate states. Retrying fulfillment never submits a transaction. Recent lost receipts can be located in the last 2,000 blocks; older ones require the transaction hash.

The free report preview is deliberately available before settlement. Testnet payment is a demonstration of procurement accounting, not a commercial paywall. RPC failures are not labeled policy rejections. Local integration evidence is in `public/evidence/procurement-local.json`.

## Optional model interpretation

Use a model currently marked **free** in your SiliconFlow account; model availability and rate limits can change. Run `npm run model:configure` in an interactive terminal, then `npm run model:verify` for a real provider call using the same adapter as the website. The key is entered invisibly and saved only to ignored `.dev.vars`; evidence is saved to `output/model-verification.json` for factual review. Existing secret files are never overwritten. Hosted use additionally requires Site secret configuration and platform sign-in; an ordinary local preview has no platform identity. Do not commit or upload `.dev.vars`.

The adapter sends only bounded public report facts to the fixed SiliconFlow endpoint, limits output to 500 tokens, caches successful interpretations and requires a platform-authenticated user. Anonymous visitors cannot invoke it. It is disabled by default, has no signing keys or payment tools, and is not an autonomous purchasing agent. Cache misses made concurrently can still consume multiple provider calls; do not enable a paid model without a separate usage limit.

See `docs/model-setup.md` for setup and `docs/STATUS.md` for remaining submission gates.

Fuji deployment status is recorded in `public/evidence/fuji-deployment.json`. A `not-deployed` status means public-chain evidence is still pending. The site can also deploy a personal test vault through Core or MetaMask.

## Fuji

Network: Avalanche Fuji C-Chain, chain ID **43113**. RPC: https://api.avax-test.network/ext/bc/C/rpc

Get free test AVAX from https://build.avax.network/console/primary-network/faucet. Use valueless test assets only.

```sh
npm run deploy:fuji
npm run demo:fuji -- --execute
npm run verify:fuji
npm run submission:check
```

The optional CLI reads a disposable testnet key from ignored `.secrets/fuji-deployer.json`, checks the chain before sending, records deployment receipts, and resumes confirmed partial deployments. Never publish this file. The browser flow requires no key file. DemoUSD has 6 decimals and unrestricted minting. It is not Circle USDC.

The procurement CLI persists signed bytes before broadcast in an ignored private journal. Repeating a completed run sends no new transactions. Run `npm run test:fuji-run` for local crash/recovery verification and see `docs/fuji-runbook.md` for recovery boundaries. Public Fuji evidence is in `public/evidence/procurement-fuji.json`.

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
