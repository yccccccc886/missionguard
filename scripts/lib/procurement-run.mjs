import assert from 'node:assert/strict';
import { Wallet, id } from 'ethers';
import { orderId, services } from '../../lib/procurement.ts';
import { paymentTypes } from '../../lib/guard-sdk.ts';
import { matchPayment } from '../../lib/settlement.ts';
import { durableTransactions } from './durable-transactions.mjs';

// Shared by the Fuji run and its local crash/recovery test. No model controls
// these signers: this is a scripted test of the actual settlement contracts.
export async function procurementRun({
  wallet,
  token,
  vault,
  chainId,
  brief,
  state,
  save,
  afterConfirm,
}) {
  const provider = wallet.provider;
  const guard = await vault.getAddress();
  const tokenAddress = await token.getAddress();
  const identity = {
    chainId,
    guard,
    token: tokenAddress,
    owner: wallet.address,
    taskId: brief.id,
  };
  if (state.identity)
    assert.deepEqual(
      state.identity,
      identity,
      'Different run; preserve the existing journal',
    );
  else {
    state.identity = identity;
    state.expiry = (await provider.getBlock('latest')).timestamp + 86400;
    state.keys = Array.from(
      { length: 3 },
      () => Wallet.createRandom().privateKey,
    );
    state.journal = {};
    state.probes = {};
    await save();
  }
  const agents = state.keys.map((key) => new Wallet(key));
  const transact = durableTransactions({
    wallet,
    chainId,
    journal: state.journal,
    save,
    afterConfirm,
  });
  const send = async (label, contract, fn, args) =>
    transact(label, await contract[fn].populateTransaction(...args));
  const event = (receipt, name) => {
    const parsed = receipt.logs
      .filter((log) => log.address.toLowerCase() === guard.toLowerCase())
      .map((log) => {
        try {
          return vault.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === name);
    assert.ok(parsed, `Missing ${name} event`);
    return parsed.args;
  };
  await send('mint', token, 'mint', [wallet.address, 10000000n]);
  await send('approve', token, 'approve', [guard, 10000000n]);
  const created = await send('mission', vault, 'createMission', [
    10000000n,
    state.expiry,
    brief.id,
  ]);
  const missionId = event(created, 'MissionCreated').missionId;
  await send('merchant', vault, 'setMerchant', [
    missionId,
    wallet.address,
    true,
  ]);
  const root = event(
    await send('research', vault, 'createGrant', [
      missionId,
      0,
      agents[0].address,
      8000000n,
      2000000n,
      state.expiry,
    ]),
    'GrantCreated',
  ).grantId;
  const child = event(
    await send('data', vault, 'createGrant', [
      missionId,
      root,
      agents[1].address,
      3000000n,
      2000000n,
      state.expiry,
    ]),
    'GrantCreated',
  ).grantId;
  const independent = event(
    await send('verification', vault, 'createGrant', [
      missionId,
      0,
      agents[2].address,
      2000000n,
      2000000n,
      state.expiry,
    ]),
    'GrantCreated',
  ).grantId;
  // Epoch is fixed by this run's one merchant update, including after closure.
  const sign = async (service, requestOverride) => {
    const p = {
      missionId,
      grantId: service === 'activity' ? child : independent,
      recipient: wallet.address,
      amount: BigInt(services[service].units),
      requestId:
        requestOverride ?? orderId(brief.id, service, guard, String(missionId)),
      deadline: BigInt(state.expiry),
      epoch: 2n,
    };
    const signer = agents[services[service].agentIndex];
    const signature = await signer.signTypedData(
      { name: 'MissionGuard', version: '1', chainId, verifyingContract: guard },
      { Payment: [...paymentTypes.Payment] },
      p,
    );
    return [p, signature];
  };
  const activity = await sign('activity');
  const dataReceipt = await send(
    'payActivity',
    vault,
    'executePayment',
    activity,
  );
  matchPayment(
    { status: 'success', logs: dataReceipt.logs },
    {
      taskId: brief.id,
      service: 'activity',
      guard,
      missionId: String(missionId),
      recipient: wallet.address,
    },
  );
  const rejected = async (label, code, signed) => {
    if (state.probes[label]) {
      assert.equal(state.probes[label].code, code);
      return;
    }
    const block = await provider.getBlock('latest');
    let decoded;
    try {
      await vault.executePayment.staticCall(...signed, {
        blockTag: block.number,
      });
    } catch (e) {
      // A network failure or an unknown revert proves nothing.
      if (typeof e.data === 'string' && /^0x[0-9a-f]+$/i.test(e.data))
        decoded = vault.interface.parseError(e.data)?.name;
      else
        throw Error(
          `Could not verify ${label}; retry after checking RPC availability`,
        );
    }
    assert.equal(decoded, code, 'Expected an exact contract policy error');
    state.probes[label] = {
      status: 'simulation-rejected',
      code,
      blockNumber: block.number,
      blockHash: block.hash,
      checkedAt: new Date().toISOString(),
    };
    await save();
  };
  await rejected('duplicateOrder', 'RequestAlreadyUsed', activity);
  await send('revokeResearch', vault, 'revokeGrant', [root]);
  await rejected(
    'revokedDescendant',
    'GrantInactive',
    await sign('activity', id(`revoked:${guard}:${missionId}`)),
  );
  const verification = await sign('verify');
  const verifyReceipt = await send(
    'payVerification',
    vault,
    'executePayment',
    verification,
  );
  matchPayment(
    { status: 'success', logs: verifyReceipt.logs },
    {
      taskId: brief.id,
      service: 'verify',
      guard,
      missionId: String(missionId),
      recipient: wallet.address,
    },
  );
  await send('close', vault, 'revokeMission', [missionId]);
  const refund = await send('refund', vault, 'withdrawRemainder', [missionId]);
  const m = await vault.missions(missionId);
  assert.equal(m.specHash, brief.id);
  assert.equal(m.budget, 10000000n);
  assert.equal(m.spent, 2000000n);
  assert.equal(m.withdrawn, 8000000n);
  assert.equal(await vault.remainingBudget(missionId), 0n);
  assert.equal(event(refund, 'RemainderWithdrawn').amount, 8000000n);
  assert.equal((await vault.grants(root)).spent, 1500000n);
  assert.equal((await vault.grants(child)).spent, 1500000n);
  assert.equal((await vault.grants(independent)).spent, 500000n);
  return {
    environment:
      chainId === 43113
        ? 'Avalanche Fuji testnet'
        : 'Local Hardhat EVM — NOT Avalanche Fuji',
    chainId,
    generatedAt: new Date().toISOString(),
    ...identity,
    missionId: String(missionId),
    execution: 'Scripted independent signers; no model; self-operated merchant',
    budget: '10',
    spent: '2',
    recovered: '8',
    asset: 'DemoUSD (valueless)',
    transactions: Object.entries(state.journal).map(([label, tx]) => ({
      label,
      hash: tx.hash,
      confirmed: tx.confirmed,
      ...(chainId === 43113
        ? { explorer: `https://testnet.snowtrace.io/tx/${tx.hash}` }
        : {}),
    })),
    probes: state.probes,
    passed: true,
  };
}
