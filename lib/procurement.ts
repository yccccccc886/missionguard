import {
  getAddress,
  isAddress,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from 'viem';

export const networks = {
  43114: {
    name: 'Avalanche C-Chain',
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    explorer: 'https://snowtrace.io',
  },
  43113: {
    name: 'Avalanche Fuji',
    rpc: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorer: 'https://testnet.snowtrace.io',
  },
} as const;
export type DataChain = keyof typeof networks;
export const services = {
  activity: {
    units: '1500000',
    label: '事件采集 / Activity data',
    agentIndex: 1,
  },
  verify: {
    units: '500000',
    label: '数据复核 / Data verification',
    agentIndex: 2,
  },
} as const;
export type Service = keyof typeof services;
export type TaskSpec = {
  version: 1;
  chainId: DataChain;
  address: Address;
  fromBlock: string;
  toBlock: string;
  toBlockHash: Hex;
};
export type ActivityEvent = {
  transactionHash: Hex;
  blockNumber: string;
  logIndex: number;
  topic: Hex;
  topicsHash: Hex;
  dataHash: Hex;
};
export type Brief = {
  id: Hex;
  spec: TaskSpec;
  createdAt: string;
  startTime: string;
  endTime: string;
  eventCount: number;
  transactionCount: number;
  eventTypes: { topic: Hex; count: number }[];
  events: ActivityEvent[];
  dataHash: Hex;
  verification: { status: 'matched'; method: string; checkedAt: string };
  execution: 'deterministic';
  source: string;
};
export type ServiceReceipt = {
  taskId: Hex;
  service: Service;
  requestId: Hex;
  guard: Address;
  missionId: string;
  transactionHash: Hex;
  blockNumber: string;
  recipient: Address;
  amount: string;
  status: 'delivered';
  artifactHash: Hex;
  explorer: string;
};
export const hashJson = (value: unknown): Hex =>
  keccak256(toHex(JSON.stringify(value)));
export const taskId = (spec: TaskSpec): Hex =>
  hashJson({
    version: 1,
    chainId: spec.chainId,
    address: spec.address.toLowerCase(),
    fromBlock: spec.fromBlock,
    toBlock: spec.toBlock,
    toBlockHash: spec.toBlockHash.toLowerCase(),
  });
export function orderId(
  id: Hex,
  service: Service,
  guard: Address,
  missionId: string,
): Hex {
  if (
    !/^0x[0-9a-f]{64}$/i.test(id) ||
    !isAddress(guard) ||
    !/^[1-9][0-9]{0,30}$/.test(missionId) ||
    !Object.hasOwn(services, service)
  )
    throw Error('Invalid order');
  return hashJson({
    version: 1,
    settlementChain: 43113,
    guard: guard.toLowerCase(),
    missionId,
    taskId: id.toLowerCase(),
    service,
  });
}
export function researchInput(value: unknown): {
  chainId: DataChain;
  address: Address;
} {
  const v = value as { chainId?: unknown; address?: unknown };
  if (
    !v ||
    (v.chainId !== 43113 && v.chainId !== 43114) ||
    typeof v.address !== 'string' ||
    !isAddress(v.address)
  )
    throw Error(
      '请选择 Avalanche 网络并输入有效合约地址。 / Select an Avalanche network and valid contract address.',
    );
  return { chainId: v.chainId, address: getAddress(v.address) };
}
export function reportMarkdown(brief: Brief): string {
  const { spec } = brief;
  const explorer = networks[spec.chainId].explorer;
  return (
    `# Avalanche 合约活动简报 / Contract activity brief\n\n` +
    `- 任务 / Task: ${brief.id}\n- 网络 / Network: ${networks[spec.chainId].name} (${spec.chainId})\n- 合约 / Contract: [${spec.address}](${explorer}/address/${spec.address})\n` +
    `- 区块 / Blocks: ${spec.fromBlock}–${spec.toBlock}\n- 时间 / Time: ${brief.startTime}–${brief.endTime}\n- 数据源 / RPC: ${brief.source}\n\n` +
    `## 观察结果 / Observations\n\n该区块范围内，该合约发出 ${brief.eventCount} 条日志，涉及 ${brief.transactionCount} 笔不同交易。\nThe contract emitted ${brief.eventCount} logs across ${brief.transactionCount} distinct transactions in this block range.\n\n` +
    `这是事件日志统计，不是全部调用量、用户数、交易额或安全评级；没有发出日志的调用不在统计中。\nThis counts emitted logs, not all calls, users, volume or a security rating. Calls without logs are excluded.\n\n` +
    `## 事件类型 / Event signatures\n\n` +
    brief.eventTypes.map((x) => `- ${x.topic}: ${x.count}`).join('\n') +
    `\n\n## 可回查的交易 / Sample transactions\n\n` +
    [...new Set(brief.events.map((x) => x.transactionHash))]
      .slice(0, 10)
      .map((h) => `- [${h}](${explorer}/tx/${h})`)
      .join('\n') +
    `\n\n## 验证边界 / Verification limits\n\n` +
    `固定区块范围第二次读取结果一致；两次读取来自同一官方 RPC，并非独立数据源审计。\nA second read of the pinned block range matched. Both reads use the same official RPC; this is not an independent-source audit.\n\n` +
    `数据哈希 / Data hash: ${brief.dataHash}\n\n执行方式 / Execution: deterministic data pipeline; no LLM.\n研究数据免费读取；采购演示单独使用无价值的 Fuji DemoUSD，不能代表真实商业付费。\nResearch reads are free; procurement demonstrations separately use valueless Fuji DemoUSD, not commercial purchases.\n`
  );
}
