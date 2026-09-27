# Three-minute demo — procurement revision, 2026-09-27

## 0:00–0:25 — A concrete task
“让一个 AI 工作流生成 Avalanche 合约活动简报，我们希望知道：交付了什么，钱花在哪里，出问题后能否只停掉一个分支。MissionGuard 把报告、服务订单和预算权限放在同一个流程里。”

## 0:25–1:05 — Real result first
Open 任务与成果. Use the recorded case for a stable sample, or generate a new live report. Show the contract address, fixed block window and transaction links. Download the Markdown report. Say: “这里是真实公开链数据，统计由确定性程序执行；当前尚未配置真实模型。” The stored example has 161 logs across 85 distinct transactions. New live runs will differ. Do not call these users, all calls or total trading volume.

## 1:05–1:45 — Orders and recoverability
Show the 1.5 DemoUSD data order and 0.5 DemoUSD verification order. Explain: “这是自建演示服务，测试币没有价值。免费报告不是已付款证明。同一任务的同一订单使用固定请求 ID，重试不能再次扣款；付款与结果交付分开记录。”
If Fuji is not deployed, keep the UI visibly unsettled. Show the local procurement execution JSON from the Evidence tab and identify it as a local EVM run.

## 1:45–2:20 — Stop one branch
Run `npm run demo:procurement` before recording and show its trace: the data child pays; a duplicate order is rejected; revoking the research parent invalidates its child; the independent verification branch still pays; task closure returns 8 of the original 10 DemoUSD. Local transaction hashes are not public explorer receipts.
Once Fuji is deployed, replace this segment with the same browser workflow using actual confirmed receipt links. Pre-create the task to avoid spending the entire pitch on wallet confirmations. Do not call a simulation a broadcast rejected transaction.

## 2:20–2:45 — Why on-chain
“资金边界在付款执行时检查。多个执行者独立提交请求，也要遵守同一任务和祖先额度。Avalanche 提供实际数据来源，Fuji 是我们验证付款的目标环境。” Show the 31 contract tests and current deployment status. State the status honestly.

## 2:45–3:00 — Product boundary
“链式委托不是我们首创。我们把任务结果、费用凭证和失败恢复做成可操作流程。它不保证服务质量，也不能撤回已确认付款。下一步验证开发者能否轻松接入自己的工作流。”

## Recording and submission gates
- Actual video still needs recording; this file is a script, not a video deliverable.
- Use `deliverables/MissionGuard-Pitch-v2.pptx`; the earlier Ready deck describes the original positioning.
- Fuji test AVAX, confirmed on-chain receipts, actual model call validation and independent developer trials remain pending.
- Keep source and site private until the entrant explicitly changes that choice.
