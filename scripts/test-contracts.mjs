import assert from 'node:assert/strict';
import fs from 'node:fs';
import { network } from 'hardhat';
import { compile } from './compile.mjs';
compile();
const connection = await network.create('hardhat');
const { ethers } = connection;
const signers = await ethers.getSigners();
const [owner, agent, merchant, attacker, child, relayer] = signers;
const U = 1000000n;
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
const results = [];
const artifact = (name) =>
  JSON.parse(fs.readFileSync('contracts/artifacts/' + name + '.json', 'utf8'));
async function deploy(name, args = []) {
  const a = artifact(name);
  const c = await new ethers.ContractFactory(a.abi, a.bytecode, owner).deploy(
    ...args,
  );
  await c.waitForDeployment();
  return c;
}
async function fixture(tokenName = 'DemoUSD') {
  const token = await deploy(tokenName);
  const guard = await deploy('MissionGuard', [await token.getAddress()]);
  await (await token.mint(owner.address, 1000n * U)).wait();
  await (await token.approve(await guard.getAddress(), 1000n * U)).wait();
  const now = (await ethers.provider.getBlock('latest')).timestamp;
  const expiry = now + 3600;
  await (
    await guard.createMission(10n * U, expiry, ethers.id('ecosystem research'))
  ).wait();
  await (await guard.setMerchant(1, merchant.address, true)).wait();
  await (
    await guard.createGrant(1, 0, agent.address, 10n * U, 10n * U, expiry)
  ).wait();
  return {
    token,
    guard,
    expiry,
    domain: {
      name: 'MissionGuard',
      version: '1',
      chainId: 31337,
      verifyingContract: await guard.getAddress(),
    },
  };
}
let sequence = 0;
async function payment(f, overrides = {}, signer = agent, domain = f.domain) {
  const m = await f.guard.missions(1);
  const p = {
    missionId: 1,
    grantId: 1,
    recipient: merchant.address,
    amount: U,
    requestId: ethers.id('request-' + ++sequence),
    deadline: f.expiry,
    epoch: m.epoch,
    ...overrides,
  };
  return { p, sig: await signer.signTypedData(domain, types, p) };
}
async function send(f, s) {
  return (await f.guard.connect(relayer).executePayment(s.p, s.sig)).wait();
}
async function rejects(f, s, name) {
  await assert.rejects(
    () => f.guard.connect(relayer).executePayment.staticCall(s.p, s.sig),
    (e) => {
      let data = e.data;
      if (typeof data === 'object') data = data.data;
      const parsed = data ? f.guard.interface.parseError(data) : null;
      assert.equal(parsed?.name, name, e.shortMessage ?? String(e));
      return true;
    },
  );
}
async function test(name, fn) {
  const start = performance.now();
  try {
    await fn();
    results.push({
      name,
      status: 'passed',
      durationMs: Math.round(performance.now() - start),
    });
    console.log('PASS ' + name);
  } catch (e) {
    results.push({ name, status: 'failed', error: String(e) });
    console.error('FAIL ' + name + '\n' + e.stack);
  }
}
await test('valid EIP-712 payment transfers exact amount and updates mission and grant', async () => {
  const f = await fixture();
  const s = await payment(f);
  const r = await send(f, s);
  assert.equal(await f.token.balanceOf(merchant.address), U);
  assert.equal((await f.guard.missions(1)).spent, U);
  assert.equal((await f.guard.grants(1)).spent, U);
  assert.equal(await f.guard.remainingBudget(1), 9n * U);
  assert.ok(
    r.logs.some((l) => {
      try {
        return f.guard.interface.parseLog(l)?.name === 'PaymentExecuted';
      } catch {
        return false;
      }
    }),
  );
});
await test('unauthorized recipient rejected', async () => {
  const f = await fixture();
  await rejects(
    f,
    await payment(f, { recipient: attacker.address }),
    'MerchantDenied',
  );
});
await test('tampered recipient invalidates signature even if allowlisted', async () => {
  const f = await fixture();
  await f.guard.setMerchant(1, attacker.address, true);
  const s = await payment(f);
  s.p.recipient = attacker.address;
  await rejects(f, s, 'InvalidSignature');
});
await test('tampered amount invalidates signature', async () => {
  const f = await fixture();
  const s = await payment(f);
  s.p.amount = 2n * U;
  await rejects(f, s, 'InvalidSignature');
});
await test('wrong agent cannot sign another grant', async () => {
  const f = await fixture();
  await rejects(f, await payment(f, {}, attacker), 'InvalidSignature');
});
await test('chain-bound signature rejects another chain', async () => {
  const f = await fixture();
  await rejects(
    f,
    await payment(f, {}, agent, { ...f.domain, chainId: 43113 }),
    'InvalidSignature',
  );
});
await test('contract-bound signature rejects another vault', async () => {
  const f = await fixture();
  await rejects(
    f,
    await payment(f, {}, agent, {
      ...f.domain,
      verifyingContract: attacker.address,
    }),
    'InvalidSignature',
  );
});
await test('expired payment rejected at deadline boundary', async () => {
  const f = await fixture();
  const block = await ethers.provider.getBlock('latest');
  await rejects(
    f,
    await payment(f, { deadline: block.timestamp }),
    'SignatureExpired',
  );
});
await test('same request cannot charge twice', async () => {
  const f = await fixture();
  const s = await payment(f);
  await send(f, s);
  await rejects(f, s, 'RequestAlreadyUsed');
  assert.equal(await f.token.balanceOf(merchant.address), U);
});
await test('request ID is shared across agents in the same mission', async () => {
  const f = await fixture();
  await f.guard.createGrant(1, 0, child.address, 10n * U, 10n * U, f.expiry);
  const s = await payment(f);
  await send(f, s);
  await rejects(
    f,
    await payment(f, { grantId: 2, requestId: s.p.requestId }, child),
    'RequestAlreadyUsed',
  );
});
await test('zero amount and zero request ID rejected', async () => {
  const f = await fixture();
  await rejects(f, await payment(f, { amount: 0 }), 'InvalidInput');
  await rejects(
    f,
    await payment(f, { requestId: ethers.ZeroHash }),
    'InvalidInput',
  );
});
await test('mission budget enforced even when agent ceilings overlap', async () => {
  const f = await fixture();
  await f.guard.createGrant(1, 0, child.address, 10n * U, 10n * U, f.expiry);
  await send(f, await payment(f, { amount: 7n * U }));
  await rejects(
    f,
    await payment(f, { grantId: 2, amount: 4n * U }, child),
    'MissionBudgetExceeded',
  );
  assert.equal(await f.guard.remainingBudget(1), 3n * U);
});
await test('same-block concurrent competing payments cannot overspend', async () => {
  const f = await fixture();
  await f.guard.createGrant(1, 0, child.address, 10n * U, 10n * U, f.expiry);
  const a = await payment(f, { amount: 6n * U });
  const b = await payment(f, { grantId: 2, amount: 6n * U }, child);
  await ethers.provider.send('evm_setAutomine', [false]);
  try {
    const txA = await f.guard
      .connect(owner)
      .executePayment(a.p, a.sig, { gasLimit: 600000 });
    const txB = await f.guard
      .connect(attacker)
      .executePayment(b.p, b.sig, { gasLimit: 600000 });
    await ethers.provider.send('evm_mine', []);
    const rA = await ethers.provider.getTransactionReceipt(txA.hash);
    const rB = await ethers.provider.getTransactionReceipt(txB.hash);
    assert.equal(rA.blockNumber, rB.blockNumber);
    assert.equal(Number(rA.status) + Number(rB.status), 1);
    assert.equal((await f.guard.missions(1)).spent, 6n * U);
    assert.equal(await f.token.balanceOf(merchant.address), 6n * U);
  } finally {
    await ethers.provider.send('evm_setAutomine', [true]);
  }
});
await test('per-agent ceiling prevents spending another agent budget', async () => {
  const f = await fixture();
  await f.guard.createGrant(1, 0, child.address, 2n * U, 2n * U, f.expiry);
  await send(f, await payment(f, { grantId: 2, amount: 2n * U }, child));
  await rejects(
    f,
    await payment(f, { grantId: 2 }, child),
    'GrantBudgetExceeded',
  );
});
await test('per-payment limit is enforced', async () => {
  const f = await fixture();
  await f.guard.createGrant(1, 0, child.address, 5n * U, U, f.expiry);
  await rejects(
    f,
    await payment(f, { grantId: 2, amount: 2n * U }, child),
    'PerPaymentExceeded',
  );
});
await test('delegated payment charges every ancestor exactly once', async () => {
  const f = await fixture();
  await f.guard
    .connect(agent)
    .createGrant(1, 1, child.address, 4n * U, 4n * U, f.expiry);
  await send(f, await payment(f, { grantId: 2, amount: 2n * U }, child));
  assert.equal((await f.guard.grants(1)).spent, 2n * U);
  assert.equal((await f.guard.grants(2)).spent, 2n * U);
  assert.equal((await f.guard.missions(1)).spent, 2n * U);
});
await test('siblings share parent ceiling; a new child cannot reset parent spending', async () => {
  const f = await fixture();
  await f.guard.createGrant(1, 0, child.address, 3n * U, 3n * U, f.expiry);
  await f.guard
    .connect(child)
    .createGrant(1, 2, agent.address, 3n * U, 3n * U, f.expiry);
  await send(f, await payment(f, { grantId: 3, amount: 2n * U }));
  await f.guard
    .connect(child)
    .createGrant(1, 2, attacker.address, 3n * U, 3n * U, f.expiry);
  await rejects(
    f,
    await payment(f, { grantId: 4, amount: 2n * U }, attacker),
    'GrantBudgetExceeded',
  );
});
await test('parent revocation invalidates existing descendant signatures', async () => {
  const f = await fixture();
  await f.guard
    .connect(agent)
    .createGrant(1, 1, child.address, 4n * U, 4n * U, f.expiry);
  const s = await payment(f, { grantId: 2 }, child);
  await f.guard.revokeGrant(1);
  await rejects(f, s, 'GrantInactive');
});
await test('mission revocation invalidates all signed payments', async () => {
  const f = await fixture();
  const s = await payment(f);
  await f.guard.revokeMission(1);
  await rejects(f, s, 'MissionInactive');
});
await test('merchant policy revision invalidates old signatures', async () => {
  const f = await fixture();
  const s = await payment(f);
  await f.guard.setMerchant(1, attacker.address, false);
  await rejects(f, s, 'StalePolicy');
  await send(f, await payment(f));
});
await test('owner-only controls reject unrelated callers', async () => {
  const f = await fixture();
  for (const fn of [
    () => f.guard.connect(attacker).setMerchant(1, attacker.address, true),
    () => f.guard.connect(attacker).revokeMission(1),
    () => f.guard.connect(attacker).revokeGrant(1),
    () =>
      f.guard
        .connect(attacker)
        .createGrant(1, 0, attacker.address, U, U, f.expiry),
    () => f.guard.connect(attacker).withdrawRemainder(1),
  ])
    await assert.rejects(fn);
});
await test('delegation cannot widen limit, per-payment ceiling, or expiry', async () => {
  const f = await fixture();
  for (const args of [
    [11n * U, U, f.expiry],
    [U, 2n * U, f.expiry],
    [U, U, f.expiry + 1],
  ])
    await assert.rejects(() =>
      f.guard.connect(agent).createGrant(1, 1, child.address, ...args),
    );
});
await test('cross-mission parent grant rejected', async () => {
  const f = await fixture();
  await f.guard.createMission(5n * U, f.expiry, ethers.ZeroHash);
  await assert.rejects(() =>
    f.guard.createGrant(2, 1, child.address, U, U, f.expiry),
  );
  await rejects(
    f,
    await payment(f, { missionId: 2, epoch: 1 }),
    'InvalidInput',
  );
});
await test('grant depth is bounded to eight', async () => {
  const f = await fixture();
  let parent = 1;
  for (let i = 2; i <= 8; i++) {
    await f.guard.createGrant(1, parent, agent.address, U, U, f.expiry);
    parent = i;
  }
  await assert.rejects(() =>
    f.guard.createGrant(1, 8, agent.address, U, U, f.expiry),
  );
});
await test('withdrawal requires revocation or expiry; returns only remainder once', async () => {
  const f = await fixture();
  await assert.rejects(() => f.guard.withdrawRemainder(1));
  await send(f, await payment(f, { amount: 3n * U }));
  await f.guard.revokeMission(1);
  await f.guard.withdrawRemainder(1);
  assert.equal(await f.token.balanceOf(owner.address), 997n * U);
  assert.equal(await f.token.balanceOf(await f.guard.getAddress()), 0n);
  await assert.rejects(() => f.guard.withdrawRemainder(1));
});
await test('mission expiry rejects payments and allows owner withdrawal', async () => {
  const f = await fixture();
  const s = await payment(f);
  await ethers.provider.send('evm_setNextBlockTimestamp', [f.expiry]);
  await ethers.provider.send('evm_mine', []);
  await rejects(f, s, 'MissionInactive');
  await f.guard.withdrawRemainder(1);
  assert.equal(await f.token.balanceOf(owner.address), 1000n * U);
});
await test('failed token transfer rolls back all budgets and request consumption', async () => {
  const f = await fixture('SwitchToken');
  const s = await payment(f);
  await f.token.setFail(true);
  await assert.rejects(() => send(f, s));
  assert.equal((await f.guard.missions(1)).spent, 0n);
  assert.equal((await f.guard.grants(1)).spent, 0n);
  assert.equal(await f.guard.usedRequests(1, s.p.requestId), false);
  await f.token.setFail(false);
  await send(f, s);
});
await test('reentrant token callback cannot execute a second payment', async () => {
  const f = await fixture('SwitchToken');
  const s = await payment(f);
  const nested = await payment(f);
  await f.token.arm(
    await f.guard.getAddress(),
    f.guard.interface.encodeFunctionData('executePayment', [
      nested.p,
      nested.sig,
    ]),
  );
  await send(f, s);
  assert.equal((await f.guard.missions(1)).spent, U);
  assert.equal(await f.guard.usedRequests(1, nested.p.requestId), false);
});
await test('ERC-1271 contract agent signature is accepted', async () => {
  const f = await fixture();
  const ca = await deploy('ContractAgent', [agent.address]);
  await f.guard.createGrant(1, 0, await ca.getAddress(), U, U, f.expiry);
  await send(f, await payment(f, { grantId: 2 }));
  assert.equal((await f.guard.grants(2)).spent, U);
});
await test('cross-mission accounting survives payment and withdrawal', async () => {
  const f = await fixture();
  await f.guard.createMission(5n * U, f.expiry, ethers.ZeroHash);
  await send(f, await payment(f, { amount: 2n * U }));
  await f.guard.revokeMission(1);
  await f.guard.withdrawRemainder(1);
  assert.equal(await f.token.balanceOf(await f.guard.getAddress()), 5n * U);
  assert.equal(await f.guard.remainingBudget(2), 5n * U);
});
await test('100 adversarial requests preserve budget and token conservation', async () => {
  const f = await fixture();
  let accepted = 0n;
  let seed = 123456;
  for (let i = 0; i < 100; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const amount = BigInt((seed % 900000) + 1);
    const s = await payment(f, { amount });
    try {
      await send(f, s);
      accepted += amount;
    } catch {}
    const m = await f.guard.missions(1);
    assert.equal(m.spent, accepted);
    assert.ok(m.spent <= m.budget);
    assert.equal(
      await f.token.balanceOf(await f.guard.getAddress()),
      m.budget - m.spent,
    );
    assert.equal(await f.token.balanceOf(merchant.address), accepted);
  }
});
const report = {
  project: 'MissionGuard',
  environment: 'Local Hardhat EVM — NOT Avalanche Fuji',
  chainId: 31337,
  generatedAt: new Date().toISOString(),
  solidity: JSON.parse(fs.readFileSync('contracts/artifacts/MissionGuard.json'))
    .compiler,
  sourceHash: ethers.keccak256(
    ethers.toUtf8Bytes(fs.readFileSync('contracts/MissionGuard.sol', 'utf8')),
  ),
  passed: results.filter((x) => x.status === 'passed').length,
  failed: results.filter((x) => x.status === 'failed').length,
  tests: results,
};
fs.mkdirSync('public/evidence', { recursive: true });
fs.writeFileSync(
  'public/evidence/contract-tests.json',
  JSON.stringify(report, null, 2),
);
console.log(`\n${report.passed}/${results.length} tests passed.`);
await connection.close();
if (report.failed) process.exitCode = 1;
