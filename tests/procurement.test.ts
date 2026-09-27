import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  encodeEventTopics,
  encodeAbiParameters,
  type Hex,
} from 'viem';
import { policyRejection } from '../lib/guard-sdk.ts';
import { guardAbi } from '../lib/generated/contracts.ts';
import { orderId, researchInput, type TaskSpec } from '../lib/procurement.ts';
import { matchPayment } from '../lib/settlement.ts';
import { normalizeLogs, createBrief } from '../lib/research.ts';

const guard = '0x1111111111111111111111111111111111111111';
const recipient = '0x2222222222222222222222222222222222222222';
const id = `0x${'12'.repeat(32)}` as Hex;
const hash = `0x${'34'.repeat(32)}` as Hex;
describe('evidence classification', () => {
  it('never calls a timeout, provider error or unknown revert a policy rejection', () => {
    assert.equal(policyRejection(new Error('timeout')), undefined);
    assert.equal(policyRejection(new BaseError('RPC unavailable')), undefined);
    const unknown = new ContractFunctionRevertedError({
      abi: guardAbi,
      data: '0xdeadbeef',
      functionName: 'executePayment',
    });
    assert.equal(policyRejection(unknown), undefined);
  });
  it('recognizes decoded policy errors through the viem cause chain', () => {
    const revert = new ContractFunctionRevertedError({
      abi: guardAbi,
      data: encodeErrorResult({ abi: guardAbi, errorName: 'GrantInactive' }),
      functionName: 'executePayment',
    });
    assert.equal(
      policyRejection(new BaseError('Simulation failed', { cause: revert })),
      'GrantInactive',
    );
  });
});
describe('procurement receipt binding', () => {
  const order = {
    taskId: id,
    service: 'activity',
    guard,
    missionId: '1',
    recipient,
  } as const;
  const requestId = orderId(id, 'activity', guard, '1');
  const topics = encodeEventTopics({
    abi: guardAbi,
    eventName: 'PaymentExecuted',
    args: { missionId: 1n, grantId: 2n, requestId },
  }) as Hex[];
  const data = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }],
    [recipient, 1500000n, hash],
  );
  const receipt = {
    status: 'success',
    logs: [{ address: guard, topics, data }],
  };
  it('same order retry uses the same on-chain request ID', () => {
    assert.equal(orderId(id, 'activity', guard, '1'), requestId);
    assert.notEqual(orderId(id, 'verify', guard, '1'), requestId);
    assert.notEqual(orderId(id, 'activity', guard, '2'), requestId);
  });
  it('accepts only the exact settled order', () =>
    assert.equal(matchPayment(receipt, order), requestId));
  it('rejects failed receipts, another service, another vault and another recipient', () => {
    assert.throws(() =>
      matchPayment({ ...receipt, status: 'reverted' }, order),
    );
    assert.throws(() => matchPayment(receipt, { ...order, service: 'verify' }));
    assert.throws(() => matchPayment(receipt, { ...order, guard: recipient }));
    assert.throws(() => matchPayment(receipt, { ...order, recipient: guard }));
  });
  it('rejects arbitrary networks and malformed addresses', () => {
    assert.throws(() => researchInput({ chainId: 1, address: guard }));
    assert.throws(() =>
      researchInput({ chainId: 43114, address: 'https://localhost' }),
    );
  });
});
describe('real-data pipeline failure boundaries', () => {
  const spec: TaskSpec = {
    version: 1,
    chainId: 43114,
    address: guard,
    fromBlock: '5',
    toBlock: '100',
    toBlockHash: hash,
  };
  const log = {
    address: guard as Hex,
    transactionHash: hash,
    blockNumber: '0x6' as Hex,
    logIndex: '0x0' as Hex,
    topics: [id],
    data: '0x' as Hex,
  };
  it('rejects duplicate, removed and out-of-range logs', () => {
    assert.throws(() => normalizeLogs([log, log], spec));
    assert.throws(() => normalizeLogs([{ ...log, removed: true }], spec));
    assert.throws(() => normalizeLogs([{ ...log, blockNumber: '0x1' }], spec));
  });
  it('includes indexed topic values in evidence hashes', () => {
    assert.notEqual(
      normalizeLogs([{ ...log, topics: [id, id] }], spec)[0].topicsHash,
      normalizeLogs([{ ...log, topics: [id, hash] }], spec)[0].topicsHash,
    );
  });
  function transport(change = false, fail = false): typeof fetch {
    let reads = 0;
    return (async (_url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      if (fail) return new Response('unavailable', { status: 503 });
      const result =
        request.method === 'eth_chainId'
          ? '0xa86a'
          : request.method === 'eth_blockNumber'
            ? '0x66'
            : request.method === 'eth_getCode'
              ? '0x1234'
              : request.method === 'eth_getLogs'
                ? ++reads === 2 && change
                  ? []
                  : [log]
                : { number: request.params[0], hash, timestamp: '0x65000000' };
      return Response.json({ jsonrpc: '2.0', id: 1, result });
    }) as typeof fetch;
  }
  it('produces an explicitly deterministic report from two matching reads', async () => {
    const report = await createBrief(43114, guard, transport());
    assert.equal(report.eventCount, 1);
    assert.equal(report.transactionCount, 1);
    assert.equal(report.execution, 'deterministic');
  });
  it('never converts upstream failure or changed data into a successful empty report', async () => {
    await assert.rejects(
      () => createBrief(43114, guard, transport(true)),
      /changed/,
    );
    await assert.rejects(
      () => createBrief(43114, guard, transport(false, true)),
      /unavailable/,
    );
  });
});
