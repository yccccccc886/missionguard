# 提交表单文案

按 2026-09-28 已完成状态编写。下列英文可分别粘贴到对应字段。当前网站和 GitHub 仍为私有，公开访问需要参赛者确认。

## Project Name

MissionGuard

## Short Description

Task-scoped budgets and verifiable service receipts for AI workflows on Avalanche, with branch revocation, replay protection and refunds.

## Full Description

MissionGuard helps agent-workflow developers delegate service purchases while keeping every payment within a shared task budget and linking it to a concrete result.

Our first use case is an Avalanche contract activity brief. The application reads real public-chain events, records the source and block range, and produces a downloadable report with a data hash. Service orders bind that report to a specific mission, service, vault and settlement chain.

The Solidity vault enforces the task budget and every ancestor grant's spending limits when an EIP-712 payment executes. A used order ID cannot charge the same mission twice. Owners can revoke one branch while independent work continues, then recover unused funds. The fulfillment API matches the exact successful payment receipt and supports retrying delivery without another payment.

What we have demonstrated:
- 12 confirmed Avalanche Fuji transactions: 10 DemoUSD escrowed, 2 paid and 8 refunded.
- An independent verification branch successfully paid after the research branch was revoked.
- Read-only contract simulations returned the expected errors for duplicate orders and revoked descendants.
- 31 local contract tests and 20 application tests passed; additional crash-recovery checks cover interruptions before broadcast and after payment.
- The local production build verified real Fuji receipts and recovered saved delivery records without another payment.

The prototype uses scripted agents, self-operated services and valueless test tokens. A model-interpretation adapter is implemented but not yet validated with a live model; autonomous model purchasing is not claimed. Full browser-wallet acceptance remains pending. The code and pitch include deployment addresses, receipt links, reproducible commands and implementation limits.

## Tracks

优先选择与“身份 / 信任 / AI 基础设施”对应的选项。下拉选项尚未展示，以上是方向定位，不是对页面选项名称的确认。

## Website

演示站（目前私有，公开后再作为评委访问链接）：
https://missionguard-avalanche.a15632158565.chatgpt.site

GitHub（目前私有，若后续有专用 Repository 字段填在那里）：
https://github.com/yccccccc886/missionguard

## Pitch

使用 `deliverables/MissionGuard-Pitch-v3.pptx`。v3 已加入真实 Fuji 结算证据；v2 的部署状态已过时。

## Public-chain evidence

Vault: https://testnet.snowtrace.io/address/0x250084921Ccc6D1b8f998B533b3477591291d94E

Data payment: https://testnet.snowtrace.io/tx/0xc4f57ed6e854d4b6d44c4a4cf761897dcc5f7e4de3609b42ef5d7b46ac7d93e6

Refund: https://testnet.snowtrace.io/tx/0xec6f92f59b07a29a76c6ed12daedf5afbc453d6a8fe63aabb25a88c2bcf987e8

## Team & Socials

填写真实团队成员和自己的有效联系方式。若独立参赛，不添加虚构队友。可选社交账号没有就留空。此文案不是已经提交或报名成功的证明。
