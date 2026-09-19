# Three-minute demo and pitch

## 0:00–0:25 — Problem
“如果我给 AI 团队十美元做一次研究，把搜索、数据和核验交给不同 Agent，怎么保证总共只花十美元？任务拆得越细，单个钱包的限额越难表达整个任务的边界。MissionGuard 把预算和授权放在同一个链上任务里。”

## 0:25–0:55 — Normal workflow
Open the task tab and run the full browser demo. State explicitly: “这是交互模拟，接下来会展示真实合约证据。” It pays 1.5, 0.75 and 0.25, rejects a duplicate, revokes and returns 7.5. Explain that rejected payments do not consume the token budget.

## 0:55–1:25 — Two differentiators
Open the race scenario: two agents each request six against a shared ten. Only one can fit. Then open parent revocation: a child's existing authorization fails after revoking its parent. Explain that child limits are ceilings, not reserved balances. No “first ever” claim.

## 1:25–2:05 — Contract evidence
Show the Evidence tab and the same-block concurrency test. Open `local-demo.json` or run `npm run demo:local`: it executes real Solidity with EIP-712 signers on a local EVM. Distinguish local execution hashes from public Fuji transactions.

Once Fuji is funded and deployed, replace this segment with the real wallet flow: load the project vault, create a 10 DemoUSD task, execute one payment, simulate replay rejection, revoke, verify old permission fails, and withdraw. Pre-create the task before the live pitch to avoid many wallet confirmations. Show one confirmed receipt on the testnet explorer. Never describe an RPC simulation as a broadcast transaction.

## 2:05–2:35 — Why a contract and why Avalanche
“多个执行者可以独立提交付款，但任务总额和授权树由同一份合约核算。我们选择 Avalanche Fuji 验证这个资金边界，评委可以查看合约地址和交易回执。” If Fuji evidence is still unavailable, say it is the target environment and show the deployment workflow, not a claim of completed deployment.

## 2:35–3:00 — Scope and next step
“这个版本验证的是付款权限，不判断 AI 答案质量。下一步把它接到真实 Agent 服务采购流程，并验证开发者是否愿意用任务预算替代共享私钥。今天已经能检验共享预算、层级授权和撤销后的资金回收。”

## Likely judge questions

**Can an injected agent still spend money?** Yes, within its remaining permissions at allowed recipients. The vault bounds loss; it does not detect prompt injection or verify intent.

**Why not one cap per wallet?** A mission spans multiple agents. Hierarchical accounting enforces the shared task cap and ancestor limits even when workers independently relay transactions.

**Does revocation win against a pending payment?** No guaranteed ordering. Revocation blocks payments executed after it. Already settled payments are final.

**Is it x402?** No. This version uses custom EIP-712 settlement. Interoperability is future work.

**Is it a real LLM agent?** The reproducible demo uses scripted signers. The contract accepts signatures regardless of how the agent chose an action.

**Is it production-ready?** No. It is a hackathon prototype with adversarial tests, not an independently audited custody product.

## Recording checklist
Use a clean browser with sufficient text size, start from a reset task, and record the sequence above without displaying keys or wallet recovery phrases. Keep the mode labels visible. Show real receipt links only when confirmed. Record one full take and export a 1080p MP4. The script is prepared; an actual screen recording has not yet been produced.
