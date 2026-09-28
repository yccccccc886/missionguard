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
  fs.existsSync('deliverables/MissionGuard-Pitch-v3.pptx'),
  'Editable v3 slides with confirmed Fuji receipts available.',
);
add(
  'model-demonstration',
  false,
  'Manual verification required: a real model call, output and usage; configuration alone is insufficient.',
);
add(
  'browser-wallet-recovery',
  false,
  'Manual verification required: actual Fuji wallet payments and recovery in the deployed UI.',
);
add(
  'video-and-developer-trials',
  false,
  'Record the final demo and obtain genuine developer feedback; no fabricated testimonials.',
);
add(
  'registration-and-judges-access',
  false,
  'Entrant must confirm registration/eligibility and approve judge access. Source and site remain private.',
);
const result = {
  checkedAt: new Date().toISOString(),
  mode: 'offline-readiness',
  readyToSubmit: checks.every((check) => check.status === 'ready'),
  checks,
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
