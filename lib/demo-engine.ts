export const UNIT = 1_000_000;
export type Language = 'zh' | 'en';
export type AgentId = 'search' | 'data' | 'verify';
export type Scenario =
  | 'overspend'
  | 'race'
  | 'replay'
  | 'recipient'
  | 'revoke'
  | 'parent'
  | 'stale';
export type DemoAgent = {
  id: AgentId;
  label: string;
  limit: number;
  spent: number;
  maxPerPayment: number;
  revoked: boolean;
  parent?: AgentId;
};
export type DemoEvent = {
  id: number;
  agent: string;
  amount: number;
  recipient: string;
  requestId: string;
  result: 'allowed' | 'blocked' | 'control';
  code: string;
  before: number;
  after: number;
};
export type DemoState = {
  budget: number;
  spent: number;
  withdrawn: number;
  revoked: boolean;
  epoch: number;
  used: string[];
  agents: DemoAgent[];
  events: DemoEvent[];
  scenario?: Scenario;
};
export type DemoRequest = {
  agent: AgentId;
  amount: number;
  recipient: string;
  requestId: string;
  epoch?: number;
};
export const merchants = ['Search API', 'Data API', 'Verify API'];
export function initialState(): DemoState {
  return {
    budget: 10 * UNIT,
    spent: 0,
    withdrawn: 0,
    revoked: false,
    epoch: 1,
    used: [],
    events: [],
    agents: [
      {
        id: 'search',
        label: 'SEARCH',
        limit: 5 * UNIT,
        spent: 0,
        maxPerPayment: 2 * UNIT,
        revoked: false,
      },
      {
        id: 'data',
        label: 'DATA',
        limit: 3 * UNIT,
        spent: 0,
        maxPerPayment: 2 * UNIT,
        revoked: false,
      },
      {
        id: 'verify',
        label: 'VERIFY',
        limit: 2 * UNIT,
        spent: 0,
        maxPerPayment: UNIT,
        revoked: false,
      },
    ],
  };
}
export const money = (value: number) => (value / UNIT).toFixed(2);
export function parseAmount(value: string): number {
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(value))
    throw new Error(
      '请输入最多 6 位小数的正数 / Enter a positive amount with up to 6 decimals',
    );
  const [a, b = ''] = value.split('.');
  const n = Number(a) * UNIT + Number(b.padEnd(6, '0'));
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new Error('金额必须大于零 / Amount must be positive');
  return n;
}
// Educational state machine. Signatures and consensus are verified by Solidity tests, not this simulator.
export function applyPayment(state: DemoState, r: DemoRequest): DemoState {
  const s = structuredClone(state);
  const agent = s.agents.find((a) => a.id === r.agent);
  const before = s.budget - s.spent - s.withdrawn;
  let code = 'PaymentExecuted';
  if (s.revoked) code = 'MissionInactive';
  else if (
    !Number.isSafeInteger(r.amount) ||
    r.amount <= 0 ||
    !r.requestId ||
    !agent
  )
    code = 'InvalidInput';
  else if (r.epoch !== undefined && r.epoch !== s.epoch) code = 'StalePolicy';
  else if (!merchants.includes(r.recipient)) code = 'MerchantDenied';
  else if (s.used.includes(r.requestId)) code = 'RequestAlreadyUsed';
  else if (r.amount > before) code = 'MissionBudgetExceeded';
  else {
    let a: DemoAgent | undefined = agent;
    let depth = 0;
    while (a) {
      if (++depth > 8) {
        code = 'InvalidInput';
        break;
      }
      if (a.revoked) {
        code = 'GrantInactive';
        break;
      }
      if (r.amount > a.maxPerPayment) {
        code = 'PerPaymentExceeded';
        break;
      }
      if (r.amount > a.limit - a.spent) {
        code = 'GrantBudgetExceeded';
        break;
      }
      a = a.parent ? s.agents.find((x) => x.id === a?.parent) : undefined;
    }
  }
  if (code === 'PaymentExecuted' && agent) {
    s.spent += r.amount;
    s.used.push(r.requestId);
    let a: DemoAgent | undefined = agent;
    while (a) {
      a.spent += r.amount;
      a = a.parent ? s.agents.find((x) => x.id === a?.parent) : undefined;
    }
  }
  s.events.push({
    id: s.events.length + 1,
    agent: r.agent,
    amount: r.amount,
    recipient: r.recipient,
    requestId: r.requestId,
    result: code === 'PaymentExecuted' ? 'allowed' : 'blocked',
    code,
    before,
    after: s.budget - s.spent - s.withdrawn,
  });
  return s;
}
export function revokeDemo(s: DemoState): DemoState {
  if (s.revoked) return s;
  return {
    ...s,
    revoked: true,
    epoch: s.epoch + 1,
    events: [
      ...s.events,
      {
        id: s.events.length + 1,
        agent: 'owner',
        amount: 0,
        recipient: '—',
        requestId: 'revoke',
        result: 'control',
        code: 'MissionRevoked',
        before: s.budget - s.spent,
        after: s.budget - s.spent,
      },
    ],
  };
}
export function withdrawDemo(s: DemoState): DemoState {
  if (!s.revoked || s.withdrawn) return s;
  const amount = s.budget - s.spent;
  return {
    ...s,
    withdrawn: amount,
    events: [
      ...s.events,
      {
        id: s.events.length + 1,
        agent: 'owner',
        amount,
        recipient: 'Owner',
        requestId: 'withdraw',
        result: 'control',
        code: 'RemainderWithdrawn',
        before: amount,
        after: 0,
      },
    ],
  };
}
export function normalSteps(): DemoRequest[] {
  return [
    {
      agent: 'search',
      amount: 1.5 * UNIT,
      recipient: merchants[0],
      requestId: 'search-001',
    },
    {
      agent: 'data',
      amount: 0.75 * UNIT,
      recipient: merchants[1],
      requestId: 'data-001',
    },
    {
      agent: 'verify',
      amount: 0.25 * UNIT,
      recipient: merchants[2],
      requestId: 'verify-001',
    },
  ];
}
export function runScenario(scenario: Scenario): DemoState {
  let s = initialState();
  s.scenario = scenario;
  const req: DemoRequest = {
    agent: 'search',
    amount: UNIT,
    recipient: merchants[0],
    requestId: 'attack-001',
  };
  if (scenario === 'overspend')
    return applyPayment(s, { ...req, amount: 6 * UNIT });
  if (scenario === 'recipient')
    return applyPayment(s, { ...req, recipient: 'Unknown recipient' });
  if (scenario === 'replay') return applyPayment(applyPayment(s, req), req);
  if (scenario === 'revoke')
    return applyPayment(revokeDemo(s), { ...req, epoch: 1 });
  if (scenario === 'stale') {
    s.epoch = 2;
    return applyPayment(s, { ...req, epoch: 1 });
  }
  if (scenario === 'parent') {
    s.agents[1].parent = 'search';
    s.agents[0].revoked = true;
    return applyPayment(s, { ...req, agent: 'data' });
  }
  // EVM serializes competing transactions. This replay shows the two possible-order requests.
  s.agents[0].limit = 8 * UNIT;
  s.agents[0].maxPerPayment = 8 * UNIT;
  s.agents[1].limit = 8 * UNIT;
  s.agents[1].maxPerPayment = 8 * UNIT;
  s = applyPayment(s, { ...req, amount: 6 * UNIT });
  return applyPayment(s, {
    ...req,
    agent: 'data',
    amount: 6 * UNIT,
    requestId: 'attack-002',
  });
}
export const errors: Record<string, [string, string]> = {
  PaymentExecuted: ['付款完成', 'Payment executed'],
  MissionInactive: ['任务授权已撤销或过期', 'Mission revoked or expired'],
  GrantInactive: ['Agent 或上级授权已撤销', 'Agent or ancestor revoked'],
  StalePolicy: ['授权版本已失效', 'Stale policy version'],
  MerchantDenied: ['收款方不在允许列表', 'Recipient not allowed'],
  RequestAlreadyUsed: ['请求已付款，拒绝重复扣款', 'Request already paid'],
  MissionBudgetExceeded: ['超出任务剩余预算', 'Mission budget exceeded'],
  GrantBudgetExceeded: ['超出 Agent 或上级剩余额度', 'Grant budget exceeded'],
  PerPaymentExceeded: ['超出单笔付款上限', 'Per-payment limit exceeded'],
  InvalidInput: ['无效的付款请求', 'Invalid payment request'],
  MissionRevoked: ['任务授权已撤销', 'Mission revoked'],
  RemainderWithdrawn: ['剩余资金已收回', 'Remainder withdrawn'],
};
export const scenarios: {
  id: Scenario;
  title: [string, string];
  description: [string, string];
}[] = [
  {
    id: 'overspend',
    title: ['超额付款', 'Oversized payment'],
    description: [
      '搜索 Agent 尝试单次支出 6 USDC。',
      'Search agent attempts a 6 USDC payment.',
    ],
  },
  {
    id: 'race',
    title: ['并发争抢预算', 'Race for budget'],
    description: [
      '两名 Agent 各请求 6 USDC，共享 10 USDC。',
      'Two agents request 6 USDC each from a shared 10 USDC.',
    ],
  },
  {
    id: 'replay',
    title: ['重复扣款', 'Replay a payment'],
    description: [
      '再次提交已成功执行的同一请求。',
      'Submit the same successful payment request again.',
    ],
  },
  {
    id: 'recipient',
    title: ['替换收款地址', 'Redirect funds'],
    description: [
      '把付款目标改成未经允许的地址。',
      'Replace the recipient with an unapproved address.',
    ],
  },
  {
    id: 'revoke',
    title: ['撤销后继续花钱', 'Spend after revocation'],
    description: [
      '撤销任务后尝试使用旧授权付款。',
      'Try to pay with an authorization after revocation.',
    ],
  },
  {
    id: 'parent',
    title: ['绕过上级撤销', 'Bypass a revoked parent'],
    description: [
      '上级已撤销，下级 Agent 仍尝试付款。',
      'A child tries to spend after its parent is revoked.',
    ],
  },
  {
    id: 'stale',
    title: ['使用过期策略', 'Use a stale policy'],
    description: [
      '收款策略更新后，重放旧版本授权。',
      'Use an old authorization after a policy revision.',
    ],
  },
];
