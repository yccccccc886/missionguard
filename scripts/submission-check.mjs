import fs from 'node:fs';
import { keccak256, toUtf8Bytes } from 'ethers';

// Offline readiness only: it neither publishes nor submits anything, and a
// local result must never stand in for public-chain or independent evidence.
const read = (file) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const checks = [];
const add = (name, passed, detail) =>
  checks.push({ name, status: passed ? 'ready' : 'pending', detail });
const contracts = read('public/evidence/contract-tests.json');
add(
  'contract-test-evidence',
  contracts?.passed >= 31 &&
    contracts.failed === 0 &&
    contracts.sourceHash ===
      keccak256(
        toUtf8Bytes(fs.readFileSync('contracts/MissionGuard.sol', 'utf8')),
      ),
  'Checks recorded evidence against current Solidity source; does not rerun tests or audit contracts.',
);
const local = read('public/evidence/procurement-local.json');
add(
  'local-procurement',
  local?.passed &&
    local.chainId === 31337 &&
    local.spent === '2' &&
    local.recovered === '8',
  'Local EVM only; no public explorer receipt.',
);
const deployment = read('public/evidence/fuji-deployment.json');
add(
  'fuji-deployment',
  deployment?.status === 'deployed' &&
    deployment.chainId === 43113 &&
    deployment.guard &&
    deployment.token,
  'Requires actual published deployment addresses.',
);
const fuji = read('public/evidence/procurement-fuji.json');
add(
  'fuji-procurement',
  fuji?.passed &&
    fuji.chainId === 43113 &&
    fuji.guard === deployment?.guard &&
    fuji.transactions?.length === 12 &&
    fuji.transactions.every(
      (tx) => tx.confirmed && /^0x[0-9a-f]{64}$/i.test(tx.hash),
    ) &&
    fuji.spent === '2' &&
    fuji.recovered === '8',
  'Requires the completed Fuji run; separately recheck receipts on the official RPC before submission.',
);
add(
  'pitch-slides',
  fs.existsSync('public/submission/MissionGuard-Pitch.pptx'),
  'Editable v4 slides include Fuji receipts and the recorded real model call.',
);
const model = read('public/evidence/model-example.json');
const brief = read('public/evidence/research-example.json');
add(
  'model-demonstration',
  model?.liveCall === true && model.result?.sourceDataHash === brief?.dataHash &&
    model.result?.taskId === brief?.id && model.result?.text?.length > 0 &&
    model.result?.usage?.completion_tokens > 0 && model.factualReview?.status === 'passed',
  'Actual provider response and assistant factual review; not independent human review or hosted UI acceptance.',
);
const worker = read('public/evidence/local-worker-verification.json');
add('local-production-api', worker?.passed === true && worker.modelEnabled === true && worker.receipts?.length === 2,
  'Local R2, real model, cached response and real Fuji receipt recovery. Local authentication uses an explicit test fixture.');
add('evidence-video', fs.existsSync('public/submission/MissionGuard-Demo.mp4') &&
  fs.existsSync('public/submission/MissionGuard-Demo.zh.vtt'),
  '155.6-second narrated evidence video; not a browser-wallet screen recording.');
const release = read('docs/release-status.json');
add('registration', release?.registration?.status === 'confirmed-by-user',
  'Entrant stated registration is complete on September 29. Not an independent eligibility review.');
add(
  'browser-wallet-recovery',
  release?.browserWallet?.status === 'passed',
  'Manual verification required: actual Fuji wallet payments and recovery in the deployed UI.',
);
add(
  'judges-access',
  release?.judgeAccess?.status === 'verified',
  'Site policy and repository are public with approval. Confirm anonymous browser access before submission.',
);
const result = {
  checkedAt: new Date().toISOString(),
  mode: 'offline-readiness',
  readyToSubmit: checks.every((check) => check.status === 'ready'),
  checks,
  optionalFollowUps: ['Independent developer trials are a future product-validation goal, not a completed result or verified event requirement.'],
};
fs.mkdirSync('output', { recursive: true });
fs.writeFileSync(
  'output/submission-readiness.json',
  JSON.stringify(result, null, 2) + '\n',
);
for (const check of checks)
  console.log(`${check.status.toUpperCase()}: ${check.name} — ${check.detail}`);
console.log(
  `Ready to submit: ${result.readyToSubmit}. No submission or sharing change performed.`,
);
if (process.argv.includes('--strict') && !result.readyToSubmit)
  process.exitCode = 2;
