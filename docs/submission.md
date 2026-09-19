# Submission draft

## Project name
MissionGuard

## Track
Identity, Trust, AI Infrastructure / 身份、信任与 AI 基础设施

## One sentence
MissionGuard gives an AI team a shared on-chain task budget, with delegated limits and revocation that apply to every sub-agent.

## 中文简介
当一个 AI 任务拆给多个 Agent 后，单独限制每个钱包并不能直接表达“整个任务最多花多少钱”。MissionGuard 把资金和授权绑定到任务：每笔付款同时检查任务总额、当前 Agent 与所有上级额度，并验证收款人、有效期和签名。用户撤销上级后，下级无法绕过撤销继续付款；任务结束后可收回余款。项目提供可操作的攻防实验室、真实合约测试和 Fuji 钱包交互入口。

## English description
MissionGuard is a task-scoped ERC20 vault for agent teams. A payment must satisfy the shared mission ceiling and every ancestor's cumulative and per-payment limits. EIP-712 signatures bind payments to the task, grant, recipient, amount, request ID, deadline and current policy. Mission-wide idempotency prevents duplicate charges across agents. Revoking a grant disables the entire subtree, and the owner can recover unused funds after mission revocation or expiry. An interactive attack lab and reproducible EVM tests make the policy directly inspectable.

## Problem and intended users
Agent-workflow developers need to delegate purchases without handing each worker an unrestricted wallet or relying exclusively on a centralized coordinator. The initial use case is a research task split into search, data retrieval and verification. Product demand remains to be validated with developers; no customer or revenue claims are made.

## Technical contribution
The focus is hierarchical task accounting: each leaf payment atomically charges every ancestor, while sibling ceilings may overlap under one funded mission. New child grants cannot reset already-used parent budgets. Subtree revocation checks ancestry at execution, including previously signed payments. Policy epochs invalidate signatures after recipient changes. The contract supports EOA and ERC-1271 agents and permissionless relay to a signature-bound recipient.

## Avalanche usage
The project targets Avalanche Fuji C-Chain, chain ID 43113. The website can deploy a DemoUSD token and MissionGuard vault through Core or MetaMask, create a funded mission, relay an agent-signed payment, simulate rejected requests, revoke and withdraw. Include the actual deployment address and confirmed receipt links only after deployment succeeds.

## Current evidence
- Local EVM contract results: `public/evidence/contract-tests.json`.
- Reproducible signed workflow: `npm run demo:local`, output `public/evidence/local-demo.json`.
- Seven browser attack scenarios, explicitly labelled simulations.
- Fuji deployment status: `public/evidence/fuji-deployment.json`. Public-chain deployment currently awaits test AVAX.

## Disclosure
The agent demonstration uses deterministic scripted signers. No live LLM or paid API purchase is claimed. DemoUSD is an unrestricted test token, not Circle USDC. Settlement is custom EIP-712, not x402. Tests are authored by the project and do not constitute an independent audit. Development is AI-assisted. The participant should confirm the organizer's AI-use and eligibility rules before submission.

## Submission fields still requiring the entrant
Team/member identity and contact details, registration approval, public GitHub repository URL, final publicly accessible demo URL, and confirmed Fuji deployment evidence. The private hosted preview is not suitable as the judges' public demo link until sharing is changed.

## Official sources checked 2026-09-19
- Event and scoring: https://build.avax.network/events/093982ed-7037-4765-a066-56a5d3cff8cb
- Registration: https://luma.com/umdyirg3
- Handbook linked by registration: https://my.feishu.cn/wiki/IlZVwrU5di0eetkZsdAcK3hSnqd

The event page requires a GitHub repository and pitch slides, with evaluation on value proposition, technical complexity and use of Avalanche. The announcement says September 30; the Hub lists October 1, 2026 at 05:59 Asia/Shanghai. Prepare to submit by September 29 and follow organizer clarification. The handbook could not be accessed by the research tools, so additional eligibility or AI-use conditions remain unverified.
