# 提交表单文案

按 2026-09-30 已验证状态编写。用户已确认完成报名。下列英文可分别粘贴到对应字段。用户已授权公开，网站访问策略和 GitHub 均已改为公开。GitHub 已验证免登录访问；站点无痕浏览器访问仍待确认。项目尚未提交。

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
- 31 local contract tests and 23 application tests passed; additional crash-recovery checks cover interruptions before broadcast and after payment.
- The local production build verified real model generation, exact cache recovery, actual Fuji receipts and saved delivery recovery without another payment.

The prototype uses scripted agents, self-operated services and valueless test tokens. A real SiliconFlow Qwen2.5-7B-Instruct call interpreted the recorded Avalanche observations, with the response, source hash and token usage saved for review. The model explains data; autonomous model purchasing is not claimed. Full hosted model and browser-wallet acceptance remains pending. The code and pitch include deployment addresses, receipt links, reproducible commands and implementation limits.

## Tracks

优先选择与“身份 / 信任 / AI 基础设施”对应的选项。下拉选项尚未展示，以上是方向定位，不是对页面选项名称的确认。

## Website

演示站（已设为公开，提交前请用无痕窗口确认）：
https://missionguard-avalanche.a15632158565.chatgpt.site

GitHub（已公开，若有专用 Repository 字段填在那里）：
https://github.com/yccccccc886/missionguard

## Pitch

使用 `deliverables/MissionGuard-Pitch-v4.pptx`。v4 含真实 Fuji 结算及模型调用。旧版本不用于本次提交。

## Demo Video / Reviewer Guide

视频文件：`deliverables/MissionGuard-Demo-Evidence.mp4`，约 2 分 36 秒，中文配音及独立中文字幕。这是已记录证据的讲解，不是钱包操作录屏。

已部署的材料链接（站点已设为公开，无痕访问待确认）：

- Guide: https://missionguard-avalanche.a15632158565.chatgpt.site/submission/guide.html
- Video: https://missionguard-avalanche.a15632158565.chatgpt.site/submission/MissionGuard-Demo.mp4
- Slides: https://missionguard-avalanche.a15632158565.chatgpt.site/submission/MissionGuard-Pitch.pptx

## Public-chain evidence

Vault: https://testnet.snowtrace.io/address/0x250084921Ccc6D1b8f998B533b3477591291d94E

Data payment: https://testnet.snowtrace.io/tx/0xc4f57ed6e854d4b6d44c4a4cf761897dcc5f7e4de3609b42ef5d7b46ac7d93e6

Refund: https://testnet.snowtrace.io/tx/0xec6f92f59b07a29a76c6ed12daedf5afbc453d6a8fe63aabb25a88c2bcf987e8

## Team & Socials

填写真实团队成员和自己的有效联系方式。若独立参赛，不添加虚构队友。可选社交账号没有就留空。此文案不是已经提交或报名成功的证明。
