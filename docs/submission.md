# Submission draft

## Project name
MissionGuard

## Track
Identity, Trust, AI Infrastructure / 身份、信任与 AI 基础设施

## One sentence
MissionGuard connects an AI workflow's task result to service orders, verifiable payment receipts and a shared on-chain budget.

## 中文简介
MissionGuard 为 AI 工作流提供任务采购与费用凭证。首个场景是 Avalanche 合约活动简报：读取真实链上事件，保存带区块范围、来源与数据哈希的报告，再把服务订单绑定到任务预算。付款需满足共享任务上限及所有上级授权；同一订单重试不能再次扣款，已付款服务可单独重试获取结果。用户可以停止一个授权分支，让独立分支继续执行，并在任务结束后收回余款。Fuji 已完成 12 笔真实测试交易：托管 10 DemoUSD、支付 2、退款 8；真实 Qwen 模型调用已完成，完整线上钱包验收仍待完成。

## English description
MissionGuard connects task results, service orders and spending permissions for AI workflows. Its first use case produces a sourced Avalanche contract activity brief from real public-chain data. Orders bind the report, service, mission, settlement chain and vault. EIP-712 payments enforce the shared mission ceiling and every ancestor's limits; retrying the same order in the same mission cannot charge again. A fulfillment endpoint verifies exact successful payment receipts and supports result recovery without another payment. Owners can stop one branch while independent work continues and recover unused funds. A confirmed 12-transaction Fuji run escrowed 10 DemoUSD, paid 2 and refunded 8; a real Qwen2.5 model call is recorded, with full hosted browser-wallet acceptance still pending.

## Problem and intended users
Agent-workflow developers need to delegate purchases without handing each worker an unrestricted wallet or relying exclusively on a centralized coordinator. The initial use case is a research task split into search, data retrieval and verification. Product demand remains to be validated with developers; no customer or revenue claims are made.

## Technical contribution
The implementation combines report-bound orders, exact receipt validation, recoverable delivery and hierarchical task accounting. Each leaf payment atomically charges every ancestor; policy epochs invalidate old recipient authorizations. The contract supports EOA and ERC-1271 agents. Chained delegation and spending caps also exist in other products: no protocol-first claim is made. The product hypothesis is that placing deliverables and receipts in one workflow reduces integration and debugging effort; this still needs developer validation.

## Avalanche usage
Research reads use Avalanche's official C-Chain or Fuji RPC, with a fixed 96-block range and same-provider consistency reread. Settlement runs on Fuji, chain ID 43113. The browser supports task creation, parent-child grants, branch revocation, order payment and refunds. The scripted Fuji workflow has confirmed public receipts; browser-wallet acceptance remains a separate pending check. No custom Avalanche L1 or mainnet transaction execution is claimed.

## Current evidence
- Real public-chain sample: `public/evidence/research-example.json`; 161 emitted logs across 85 distinct transactions in the recorded 96-block sample, not all contract calls or users.
- Report-bound local purchase flow: `npm run demo:procurement`; 2 DemoUSD spent and 8 recovered, with duplicate-order rejection and an independent branch continuing after parent revocation.
- Application and procurement regression suite: `npm run test:ui`, 23 tests.
- Local EVM contract results: `public/evidence/contract-tests.json`.
- Reproducible signed workflow: `npm run demo:local`, output `public/evidence/local-demo.json`.
- Seven browser attack scenarios, explicitly labelled simulations.
- Fuji deployment: `public/evidence/fuji-deployment.json`; procurement: `public/evidence/procurement-fuji.json`. `npm run verify:fuji` rechecks all 12 successful receipts and mission accounting without submitting transactions.
- [Fuji vault](https://testnet.snowtrace.io/address/0x250084921Ccc6D1b8f998B533b3477591291d94E), [data payment](https://testnet.snowtrace.io/tx/0xc4f57ed6e854d4b6d44c4a4cf761897dcc5f7e4de3609b42ef5d7b46ac7d93e6), [8 DemoUSD refund](https://testnet.snowtrace.io/tx/0xec6f92f59b07a29a76c6ed12daedf5afbc453d6a8fe63aabb25a88c2bcf987e8).

## Disclosure
Payment agents use deterministic scripted signers. The shared model adapter has a verified live Qwen2.5-7B-Instruct response; it cannot sign or pay. Demo services are self-operated, and DemoUSD is an unrestricted valueless test token, not Circle USDC. No commercial purchase, external customer or autonomous model purchasing is claimed. Settlement is custom EIP-712, not x402. Tests are project-authored, not an independent audit. Development is AI-assisted. Confirm the organizer's eligibility and AI-use rules before submission.

## Submission fields still requiring the entrant
Team/member identity and contact details, registration approval, public GitHub repository URL, and final publicly accessible demo URL. The private hosted preview is not suitable as the judges' public demo link until sharing is changed. Fuji receipts, real-model evidence, v4 pitch and a narrated evidence video are available. The entrant has confirmed registration. Browser-wallet acceptance and judge access remain pending.

## Official sources checked 2026-09-24
- Event and scoring: https://build.avax.network/events/093982ed-7037-4765-a066-56a5d3cff8cb
- Registration: https://luma.com/umdyirg3
- Handbook linked by registration: https://my.feishu.cn/wiki/IlZVwrU5di0eetkZsdAcK3hSnqd

The event page requires a GitHub repository and pitch slides, with evaluation on value proposition, technical complexity and use of Avalanche. The announcement says September 30; the Hub lists October 1, 2026 at 05:59 Asia/Shanghai. Prepare to submit by September 29 and follow organizer clarification. The handbook could not be accessed by the research tools, so additional eligibility or AI-use conditions remain unverified.
