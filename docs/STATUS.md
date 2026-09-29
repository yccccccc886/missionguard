# Delivery status — 2026-09-29

September 29 model update: the local key authenticated successfully. A real `Qwen/Qwen2.5-7B-Instruct` call through the shared website adapter produced a complete Chinese interpretation (316 input / 186 output tokens). `public/evidence/model-example.json` records the response and coding-assistant factual review; human review is pending. Explicit network names and measurement limits were added after rejecting an earlier response that misnamed Avalanche. Hosted runtime model use and browser-wallet acceptance remain unverified. Historical entries below describe their dates, not the latest model state.

## Implemented and verified

- Task-first Chinese/English workspace with real Avalanche C-Chain/Fuji data reads.
- Fixed 96-block report, same-provider reread, immutable task ID and evidence hash, Markdown/JSON export.
- R2 report persistence. Local API report creation and recovery verified; recorded mainnet sample: 161 logs, 85 distinct transactions.
- Exact service receipt matching and report-bound order IDs; repeat fulfillment never broadcasts a payment.
- Browser parent-child grants, selected-agent payments and parent-branch revocation. RPC failure no longer counts as successful policy rejection.
- New local-EVM procurement integration: 14 steps, 2 DemoUSD spent, 8 recovered; repeated order rejected; independent branch pays after research revocation.
- 31 contract tests, 23 application/procurement/model-adapter tests. TypeScript checks pass. Model tests use controlled responses and do not count as a live provider call.
- Browser interaction checked: real report generation, recorded example, report recovery, task-to-vault navigation; Chinese/English views inspected at desktop and mobile widths.
- Optional SiliconFlow interpretation adapter and hidden local key configuration helper. Disabled by default; no live model call claimed.
- Updated submission copy, three-minute script and v2 pitch deck.
- Private Site version 2 deployed successfully on September 27, from commit `045b23bd6872d5a1514daf88b7ec1a52f4fe342b`; GitHub remains private.
- Added a Fuji-only procurement runner with a private journal written before broadcasting, exact transaction recovery, separate agent signers and sanitized public receipts. Local fault-injection tests verify recovery before broadcast and after payment, completed-run idempotency and rejection of changed requests. No Fuji success is inferred from these local checks.
- Added offline `submission:check` and `docs/fuji-runbook.md`; missing registration, access, model and public-chain evidence remain explicit.
- Fuji contracts deployed September 28. Procurement mission #1 completed 12 real transactions: 10 DemoUSD funded, 2 paid, 8 refunded. The independent verification branch paid after the research root was revoked. `verify:fuji` independently re-fetched all 12 receipts and confirmed current mission accounting from the official RPC.
- Fuji evidence: `public/evidence/procurement-fuji.json`. Duplicate-order and revoked-descendant probes are historical read-only simulations, not broadcast failed transactions. Model use remains unverified.
- Private Site version 3 was deployed September 28 from `6df8a122489cf4cdc972bb6391b7b31f139ec14e`, with Fuji receipt links. v3 pitch slides and source archive are available.
- The local production Worker generated and recovered a fresh real report, verified both actual Fuji service receipts and recovered both stored receipts without another payment. Evidence: `output/local-api-fuji-verification.json`.
- A shared website/CLI model adapter rejects incomplete responses, avoids automatic provider fallback, limits output, sanitizes failures and saves live-call evidence only after an actual successful response. `model:verify` currently reports missing configuration and makes no API call.
- A 159.5-second Chinese narrated evidence walkthrough draft is available in `deliverables`, alongside subtitles. It is an explanation of recorded evidence, not an interactive screen recording or final submission video.

## Still required before a strong submission

- Hosted model invocation and human review of the recorded live sample. Local credentials and a real direct provider call are complete. The adapter only explains public facts; it is not an autonomous purchasing agent.
- Full browser-wallet/Fuji end-to-end verification, hosted receipt recovery, recorded video and independent developer trials. Command-line settlement is verified, but does not prove these UI/service checks.
- Registration/eligibility confirmation and final repository/site access decision. Last user preference remains private.
- September 28 hosted browser verification was blocked by the browser-control connection (`nodeRepl.fetch request failed`). September 27 local browser checks remain valid, but do not prove hosted R2 behavior.
- Direct hosted API verification received Cloudflare HTTP 403. No claim is made that hosted data storage or wallet end-to-end acceptance passed.

## Evidence boundaries

Real research data is separate from settlement. The demo services are self-operated, and test payments have no financial value. Log counts are not all calls or users. Two matching reads from one RPC are not an independent audit. R2 content and report hashes do not prove service quality. Existing tests are project-authored, not a security audit.

Only the native hosting deployment result establishes which private site version is live. Source code preparation does not itself prove deployment success.
