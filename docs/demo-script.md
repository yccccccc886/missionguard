# Three-minute demo — Fuji and model evidence revision, 2026-09-30

## 0:00–0:25 — A concrete task
“让一个 AI 工作流生成 Avalanche 合约活动简报，我们希望知道：交付了什么，钱花在哪里，出问题后能否只停掉一个分支。MissionGuard 把报告、服务订单和预算权限放在同一个流程里。”

## 0:25–1:05 — Real result first
Open 任务与成果. Use the recorded case for a stable sample, or generate a new live report. Show the contract address, fixed block window and transaction links. Download the Markdown report. Say: “这里是真实公开链数据，统计由确定性程序执行；模型解读单独标注，真实调用样本可在验证证据查看。” The stored example has 161 logs across 85 distinct transactions. New live runs will differ. Do not call these users, all calls or total trading volume.

## 1:05–1:45 — Orders and recoverability
Show the 1.5 DemoUSD data order and 0.5 DemoUSD verification order. Explain: “这是自建演示服务，测试币没有价值。免费报告不是已付款证明。同一任务的同一订单使用固定请求 ID，重试不能再次扣款；付款与结果交付分开记录。”
Open the Evidence tab's Fuji section: show the confirmed data payment and the report-bound mission. A fresh task in the UI starts unpaid; do not imply the recorded mission paid for a newly generated report.

## 1:45–2:20 — Stop one branch
Show the recorded Fuji mission #1: data payment, research-parent revocation, independent verification payment, then the 8 DemoUSD refund. Open a public receipt. Say: “这是实际 Fuji 测试网交易；重复订单和撤销子级的拒绝证据来自只读合约模拟。” Run `npm run verify:fuji` before recording to recheck receipts without new payments. If showing a new browser-wallet run, keep its mission and amounts separate from this recorded example.

## 2:20–2:45 — Why on-chain
“资金边界在付款执行时检查。多个执行者独立提交请求，也要遵守同一任务和祖先额度。Avalanche 提供实际数据来源，Fuji 已验证付款、分支撤销和退款。” Show the 31 local contract tests separately from the public Fuji receipts.

## 2:45–3:00 — Product boundary
“链式委托不是我们首创。我们把任务结果、费用凭证和失败恢复做成可操作流程。它不保证服务质量，也不能撤回已确认付款。下一步验证开发者能否轻松接入自己的工作流。”

## Recording and submission gates
- A 155.6-second narrated evidence video is available at `deliverables/MissionGuard-Demo-Evidence.mp4`; it is not an interactive wallet screen recording.
- Use `deliverables/MissionGuard-Pitch-v4.pptx` after generation; v4 includes real model evidence.
- Real model calls and local production API recovery passed. Final hosted browser-wallet acceptance is pending; external developer trials are future product validation.
- Keep source and site private until the entrant explicitly changes that choice.
