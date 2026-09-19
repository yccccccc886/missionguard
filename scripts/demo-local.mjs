// Real Solidity execution on an isolated local EVM. No LLM or Fuji claims.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { compile } from './compile.mjs';
compile();
const connection = await network.create('hardhat');
const { ethers } = connection;
const [owner, search, data, verify, merchant, relay] =
  await ethers.getSigners();
const U = 1000000n;
const report = {
  environment: 'Local Hardhat EVM',
  chainId: 31337,
  agentMode: 'Scripted signers, no LLM',
  generatedAt: new Date().toISOString(),
  steps: [],
};
async function deploy(name, args = []) {
  const a = JSON.parse(fs.readFileSync(`contracts/artifacts/${name}.json`));
  const c = await new ethers.ContractFactory(a.abi, a.bytecode, owner).deploy(
    ...args,
  );
  await c.waitForDeployment();
  return c;
}
const token = await deploy('DemoUSD');
const guard = await deploy('MissionGuard', [await token.getAddress()]);
const expiry = (await ethers.provider.getBlock('latest')).timestamp + 3600;
const types = {
  Payment: [
    { name: 'missionId', type: 'uint256' },
    { name: 'grantId', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'requestId', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
    { name: 'epoch', type: 'uint64' },
  ],
};
const domain = {
  name: 'MissionGuard',
  version: '1',
  chainId: 31337,
  verifyingContract: await guard.getAddress(),
};
await (await token.mint(owner.address, 10n * U)).wait();
await (await token.approve(await guard.getAddress(), 10n * U)).wait();
await (
  await guard.createMission(
    10n * U,
    expiry,
    ethers.id('Avalanche ecosystem research'),
  )
).wait();
await (await guard.setMerchant(1, merchant.address, true)).wait();
await (
  await guard.createGrant(1, 0, search.address, 8n * U, 2n * U, expiry)
).wait();
await (
  await guard
    .connect(search)
    .createGrant(1, 1, data.address, 3n * U, 2n * U, expiry)
).wait();
await (await guard.createGrant(1, 0, verify.address, 2n * U, U, expiry)).wait();
async function request(signer, grantId, amount, id) {
  const p = {
    missionId: 1,
    grantId,
    recipient: merchant.address,
    amount,
    requestId: ethers.id(id),
    deadline: expiry,
    epoch: (await guard.missions(1)).epoch,
  };
  return { p, sig: await signer.signTypedData(domain, types, p) };
}
async function step(label, fn, expected) {
  let receipt;
  let status = 'confirmed';
  let error;
  try {
    receipt = await (await fn()).wait();
  } catch (e) {
    const revert = e.data ? guard.interface.parseError(e.data) : null;
    error = revert?.name;
    if (!expected || error !== expected) throw e;
    status = 'simulation-rejected';
  }
  if (expected && status !== 'simulation-rejected')
    throw Error('Expected rejection: ' + expected);
  const m = await guard.missions(1);
  report.steps.push({
    label,
    status,
    error,
    transactionHash: receipt?.hash,
    gasUsed: receipt?.gasUsed.toString(),
    spent: ethers.formatUnits(m.spent, 6),
    remaining: ethers.formatUnits(await guard.remainingBudget(1), 6),
    withdrawn: ethers.formatUnits(m.withdrawn, 6),
  });
  console.log(label + ': ' + status + (error ? ' ' + error : ''));
}
const first = await request(search, 1, 1500000n, 'search');
await step('Search service', () =>
  guard.connect(relay).executePayment(first.p, first.sig),
);
const second = await request(data, 2, 750000n, 'data');
await step('Delegated data service', () =>
  guard.connect(relay).executePayment(second.p, second.sig),
);
const third = await request(verify, 3, 250000n, 'verify');
await step('Verification service', () =>
  guard.connect(relay).executePayment(third.p, third.sig),
);
await step(
  'Replay attempt',
  () => guard.executePayment.staticCall(first.p, first.sig),
  'RequestAlreadyUsed',
);
const pending = await request(data, 2, U, 'after-parent-revoke');
await step('Revoke research subtree', () => guard.revokeGrant(1));
await step(
  'Child attempts payment',
  () => guard.executePayment.staticCall(pending.p, pending.sig),
  'GrantInactive',
);
await step('Close mission', () => guard.revokeMission(1));
await step('Recover 7.5 DemoUSD', () => guard.withdrawRemainder(1));
assert.equal((await guard.missions(1)).spent, 2500000n);
assert.equal((await guard.missions(1)).withdrawn, 7500000n);
assert.equal(await token.balanceOf(merchant.address), 2500000n);
assert.equal(await token.balanceOf(await guard.getAddress()), 0n);
report.summary = {
  budget: '10',
  paid: '2.5',
  returned: '7.5',
  asset: 'DemoUSD',
  conservationVerified: true,
};
fs.mkdirSync('public/evidence', { recursive: true });
fs.writeFileSync(
  'public/evidence/local-demo.json',
  JSON.stringify(report, null, 2) + '\n',
);
await connection.close();
