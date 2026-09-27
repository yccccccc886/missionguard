import { keccak256, type Hex } from 'viem';
import {
  networks,
  taskId,
  hashJson,
  type ActivityEvent,
  type Brief,
  type DataChain,
  type TaskSpec,
} from './procurement';

type RpcLog = {
  address: Hex;
  transactionHash: Hex;
  blockNumber: Hex;
  logIndex: Hex;
  topics: Hex[];
  data: Hex;
  removed?: boolean;
};
type RpcBlock = { number: Hex; hash: Hex; timestamp: Hex };
export async function rpcCall<T>(
  chain: DataChain,
  method: string,
  params: unknown[],
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(networks[chain].rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(`RPC unavailable (${response.status}); no result verified.`);
  const body = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (body.error || body.result === undefined || body.result === null)
    throw Error(`RPC ${method} failed; no result verified.`);
  return body.result;
}
export function normalizeLogs(logs: RpcLog[], spec: TaskSpec): ActivityEvent[] {
  if (!Array.isArray(logs) || logs.length > 5000)
    throw Error('Event response too large; narrow the research range.');
  const seen = new Set<string>();
  return logs
    .map((log) => {
      const block = BigInt(log.blockNumber);
      const key = `${log.transactionHash}:${log.logIndex}`;
      if (
        log.removed ||
        log.address.toLowerCase() !== spec.address.toLowerCase() ||
        block < BigInt(spec.fromBlock) ||
        block > BigInt(spec.toBlock) ||
        seen.has(key)
      )
        throw Error('Inconsistent RPC event response.');
      seen.add(key);
      return {
        transactionHash: log.transactionHash.toLowerCase() as Hex,
        blockNumber: String(block),
        logIndex: Number(BigInt(log.logIndex)),
        topic: log.topics[0] ?? ('0x' as Hex),
        topicsHash: hashJson(log.topics.map((t) => t.toLowerCase())),
        dataHash: keccak256(log.data),
      };
    })
    .sort(
      (a, b) =>
        Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) ||
        a.logIndex - b.logIndex,
    );
}
export async function createBrief(
  chainId: DataChain,
  address: Hex,
  fetcher: typeof fetch = fetch,
): Promise<Brief> {
  const call = <T>(method: string, params: unknown[]) =>
    rpcCall<T>(chainId, method, params, fetcher);
  if (BigInt(await call<Hex>('eth_chainId', [])) !== BigInt(chainId))
    throw Error('RPC chain mismatch.');
  const latest = BigInt(await call<Hex>('eth_blockNumber', []));
  if (latest < 100n) throw Error('Insufficient chain history.');
  const to = latest - 2n;
  const from = to - 95n;
  const range = [toHexNumber(from), toHexNumber(to)];
  const [start, end, code] = await Promise.all([
    call<RpcBlock>('eth_getBlockByNumber', [range[0], false]),
    call<RpcBlock>('eth_getBlockByNumber', [range[1], false]),
    call<Hex>('eth_getCode', [address, range[1]]),
  ]);
  if (code === '0x')
    throw Error(
      '该地址在所选网络没有合约代码。 / No contract code on this network.',
    );
  if (BigInt(start.number) !== from || BigInt(end.number) !== to)
    throw Error('RPC returned an unexpected block.');
  const spec: TaskSpec = {
    version: 1,
    chainId,
    address,
    fromBlock: String(from),
    toBlock: String(to),
    toBlockHash: end.hash,
  };
  const params = [{ address, fromBlock: range[0], toBlock: range[1] }];
  const first = normalizeLogs(
    await call<RpcLog[]>('eth_getLogs', params),
    spec,
  );
  const second = normalizeLogs(
    await call<RpcLog[]>('eth_getLogs', params),
    spec,
  );
  const confirmedEnd = await call<RpcBlock>('eth_getBlockByNumber', [
    range[1],
    false,
  ]);
  if (confirmedEnd.hash !== end.hash || hashJson(first) !== hashJson(second))
    throw Error('Pinned data changed between reads. Retry with a new task.');
  const counts = new Map<Hex, number>();
  for (const event of first)
    counts.set(event.topic, (counts.get(event.topic) ?? 0) + 1);
  const now = new Date().toISOString();
  return {
    id: taskId(spec),
    spec,
    createdAt: now,
    startTime: new Date(Number(BigInt(start.timestamp)) * 1000).toISOString(),
    endTime: new Date(Number(BigInt(end.timestamp)) * 1000).toISOString(),
    eventCount: first.length,
    transactionCount: new Set(first.map((l) => l.transactionHash)).size,
    eventTypes: [...counts]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count),
    events: first,
    dataHash: hashJson(first),
    source: networks[chainId].rpc,
    execution: 'deterministic',
    verification: {
      status: 'matched',
      method: 'same-provider pinned-range reread',
      checkedAt: now,
    },
  };
}
const toHexNumber = (n: bigint) => `0x${n.toString(16)}`;
