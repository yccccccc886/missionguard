'use client';
import { useState, useEffect, useRef } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  parseUnits,
  isAddress,
  keccak256,
  toHex,
  decodeEventLog,
  type Address,
  type Hex,
  type EIP1193Provider,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import {
  generatePrivateKey,
  privateKeyToAccount,
  type PrivateKeyAccount,
} from 'viem/accounts';
import {
  Wallet,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  ArrowDownToLine,
  Power,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  guardAbi,
  demoTokenAbi,
  guardBytecode,
  demoTokenBytecode,
} from '@/lib/generated/contracts';
import {
  paymentData,
  readableError,
  policyRejection,
  type Payment,
} from '@/lib/guard-sdk';
import type { Language } from '@/lib/demo-engine';
import {
  orderId,
  services,
  type Brief,
  type Service,
  type ServiceReceipt,
} from '@/lib/procurement';
const chain = avalancheFuji;
const rpc = createPublicClient({
  chain,
  transport: http('https://api.avax-test.network/ext/bc/C/rpc', {
    timeout: 15000,
    retryCount: 1,
  }),
});
const provider = () =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
const short = (a: string) => a.slice(0, 7) + '…' + a.slice(-5);
type Entry = {
  label: string;
  hash?: Hex;
  status: 'confirmed' | 'error' | 'info';
  detail?: string;
};
type Mission = readonly [
  Address,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  Hex,
];
type Manifest = {
  status: string;
  guard?: Address;
  token?: Address;
  deployer?: string;
};
export default function ChainPanel({
  lang,
  brief,
  onReceipt,
}: {
  lang: Language;
  brief?: Brief;
  onReceipt: (r: ServiceReceipt) => void;
}) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [account, setAccount] = useState<Address>();
  const [guard, setGuard] = useState<Address>();
  const [token, setToken] = useState<Address>();
  const [missionId, setMissionId] = useState('');
  const [snapshot, setSnapshot] = useState<Mission>();
  const [merchant, setMerchant] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [contractInput, setContractInput] = useState('');
  const [manifest, setManifest] = useState<Manifest>();
  const [selectedAgent, setSelectedAgent] = useState(1);
  const [branchRevoked, setBranchRevoked] = useState(false);
  const [recoveryHash, setRecoveryHash] = useState('');
  const pendingOrders = useRef(new Map<string, Hex>());
  const sessions = useRef<PrivateKeyAccount[]>([]);
  const grants = useRef<bigint[]>([]);
  const lastPayment = useRef<{ p: Payment; sig: Hex } | undefined>(undefined);
  const lock = useRef(false);
  const log = (e: Entry) => setEntries((prev) => [e, ...prev].slice(0, 40));
  useEffect(() => {
    fetch('/evidence/fuji-deployment.json')
      .then((r) => r.json())
      .then((v) => {
        const m = v as Manifest;
        if (m && typeof m.status === 'string') setManifest(m);
      })
      .catch(() => {});
    const p = provider() as
      | (EIP1193Provider & {
          on?: (name: string, cb: () => void) => void;
          removeListener?: (name: string, cb: () => void) => void;
        })
      | undefined;
    const reset = () => {
      setAccount(undefined);
      sessions.current = [];
      grants.current = [];
      lastPayment.current = undefined;
      setMessage(
        '钱包账号或网络已变化，请重新连接。 / Wallet changed; reconnect.',
      );
    };
    p?.on?.('accountsChanged', reset);
    p?.on?.('chainChanged', reset);
    return () => {
      p?.removeListener?.('accountsChanged', reset);
      p?.removeListener?.('chainChanged', reset);
    };
  }, []);
  async function act(label: string, fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      const detail = readableError(e);
      setMessage(detail);
      log({ label, status: 'error', detail });
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  async function wallet() {
    const p = provider();
    if (!p)
      throw Error(
        t(
          '请在装有 Core 或 MetaMask 的浏览器打开本站。',
          'Open this site in a browser with Core or MetaMask.',
        ),
      );
    const wc = createWalletClient({ chain, transport: custom(p) });
    const [a] = await wc.requestAddresses();
    if (!a) throw Error('No wallet account');
    if ((await wc.getChainId()) !== 43113)
      throw Error(
        t(
          '请把钱包切换至 Avalanche Fuji 测试网。',
          'Switch your wallet to Avalanche Fuji testnet.',
        ),
      );
    setAccount(a);
    // Re-check before every send in a multi-transaction setup. Switching a
    // wallet while waiting for a receipt must stop the next transaction.
    const checked = createWalletClient({
      chain,
      transport: custom({
        async request(args) {
          if (args.method === 'eth_sendTransaction') {
            const liveChain = await p.request({ method: 'eth_chainId' });
            const liveAccounts = await p.request({ method: 'eth_accounts' });
            if (
              Number(liveChain) !== 43113 ||
              liveAccounts[0]?.toLowerCase() !== a.toLowerCase()
            ) {
              throw Error(
                'Wallet changed during setup. Reconnect before continuing.',
              );
            }
          }
          return p.request(args);
        },
      }),
    });
    return { wc: checked, account: a };
  }
  async function connect() {
    const p = provider();
    if (!p)
      throw Error(
        t(
          '未检测到钱包。请用装有 Core / MetaMask 的浏览器打开链接。',
          'No wallet detected. Open the URL in a Core / MetaMask browser.',
        ),
      );
    const wc = createWalletClient({ chain, transport: custom(p) });
    const [a] = await wc.requestAddresses();
    if ((await wc.getChainId()) !== 43113) {
      try {
        await wc.switchChain({ id: 43113 });
      } catch (e) {
        if ((e as { code?: number }).code === 4902)
          await wc.addChain({ chain });
        else throw e;
      }
    }
    setAccount(a);
    setMerchant(a);
    setMessage(
      t(
        '已连接 Fuji。仅使用无价值的测试币。',
        'Connected to Fuji. Use valueless test tokens only.',
      ),
    );
  }
  async function confirmed(hash: Hex, label: string) {
    const r = await rpc.waitForTransactionReceipt({ hash, timeout: 90000 });
    if (r.status !== 'success') {
      log({ label, hash, status: 'error', detail: 'Transaction reverted' });
      throw Error('Transaction reverted: ' + hash);
    }
    log({ label, hash, status: 'confirmed' });
    return r;
  }
  async function refresh(g = guard, id = missionId) {
    if (!g || !/^\d+$/.test(id) || BigInt(id) < 1n)
      throw Error('Enter a valid mission ID');
    const m = await rpc.readContract({
      address: g,
      abi: guardAbi,
      functionName: 'missions',
      args: [BigInt(id)],
    });
    if (m[0] === '0x0000000000000000000000000000000000000000')
      throw Error('Mission not found');
    setSnapshot(m);
  }
  async function attach(address = contractInput) {
    if (!isAddress(address)) throw Error('Invalid contract address');
    const tok = await rpc.readContract({
      address,
      abi: guardAbi,
      functionName: 'token',
    });
    setGuard(address);
    setToken(tok);
    setContractInput(address);
    sessions.current = [];
    grants.current = [];
    lastPayment.current = undefined;
    setBranchRevoked(false);
    setSnapshot(undefined);
    setMissionId('');
    setMessage(
      t(
        '合约已载入。可创建自测任务，或读取已有任务。',
        'Vault loaded. Create a test mission or read an existing mission.',
      ),
    );
  }
  async function deploy() {
    const { wc, account: a } = await wallet();
    const tokReceipt = await confirmed(
      await wc.deployContract({
        account: a,
        abi: demoTokenAbi,
        bytecode: demoTokenBytecode,
      }),
      t('部署 DemoUSD', 'Deploy DemoUSD'),
    );
    if (!tokReceipt.contractAddress) throw Error('Missing token address');
    const tok = tokReceipt.contractAddress;
    setToken(tok);
    const r = await confirmed(
      await wc.deployContract({
        account: a,
        abi: guardAbi,
        bytecode: guardBytecode,
        args: [tok],
      }),
      t('部署任务金库', 'Deploy MissionGuard'),
    );
    if (!r.contractAddress) throw Error('Missing vault address');
    setGuard(r.contractAddress);
    setContractInput(r.contractAddress);
    setMissionId('');
    setSnapshot(undefined);
    sessions.current = [];
    grants.current = [];
    setMessage(
      t(
        '部署完成。DemoUSD 是可自由领取的测试代币，不是 Circle USDC。',
        'Deployed. DemoUSD is a freely mintable test token, not Circle USDC.',
      ),
    );
  }
  async function createMission() {
    if (!guard || !token) throw Error('Load or deploy a vault first');
    if (!isAddress(merchant)) throw Error('Invalid merchant address');
    const { wc, account: a } = await wallet();
    const symbol = await rpc.readContract({
      address: token,
      abi: demoTokenAbi,
      functionName: 'symbol',
    });
    if (symbol !== 'DemoUSD')
      throw Error(
        t(
          '自测向导仅支持 DemoUSD 合约。',
          'This self-test wizard supports DemoUSD only.',
        ),
      );
    const budget = parseUnits('10', 6);
    await confirmed(
      await wc.writeContract({
        account: a,
        address: token,
        abi: demoTokenAbi,
        functionName: 'mint',
        args: [a, budget],
      }),
      t('领取 10 DemoUSD', 'Mint 10 DemoUSD'),
    );
    await confirmed(
      await wc.writeContract({
        account: a,
        address: token,
        abi: demoTokenAbi,
        functionName: 'approve',
        args: [guard, budget],
      }),
      t('授权 10 DemoUSD', 'Approve 10 DemoUSD'),
    );
    const block = await rpc.getBlock();
    const expiry = block.timestamp + 3600n;
    const receipt = await confirmed(
      await wc.writeContract({
        account: a,
        address: guard,
        abi: guardAbi,
        functionName: 'createMission',
        args: [
          budget,
          expiry,
          brief?.id ?? keccak256(toHex('MissionGuard browser self-test v1')),
        ],
      }),
      t('锁定任务预算', 'Fund mission'),
    );
    let id: bigint | undefined;
    for (const l of receipt.logs) {
      try {
        const e = decodeEventLog({
          abi: guardAbi,
          data: l.data,
          topics: l.topics,
        });
        if (e.eventName === 'MissionCreated') id = e.args.missionId;
      } catch {}
    }
    if (!id) throw Error('Missing mission event');
    setMissionId(String(id));
    setBranchRevoked(false);
    sessions.current = [];
    grants.current = [];
    lastPayment.current = undefined;
    await refresh(guard, String(id));
    await confirmed(
      await wc.writeContract({
        account: a,
        address: guard,
        abi: guardAbi,
        functionName: 'setMerchant',
        args: [id, merchant, true],
      }),
      t('设置允许收款方', 'Allow merchant'),
    );
    const keys = [
      privateKeyToAccount(generatePrivateKey()),
      privateKeyToAccount(generatePrivateKey()),
      privateKeyToAccount(generatePrivateKey()),
    ];
    sessions.current = keys;
    for (let i = 0; i < keys.length; i++) {
      const r = await confirmed(
        await wc.writeContract({
          account: a,
          address: guard,
          abi: guardAbi,
          functionName: 'createGrant',
          args: [
            id,
            i === 1 ? grants.current[0] : 0n,
            keys[i].address,
            parseUnits(String([8, 3, 2][i]), 6),
            parseUnits('2', 6),
            expiry,
          ],
        }),
        t(`授权 Agent ${i + 1}`, `Authorize agent ${i + 1}`),
      );
      for (const l of r.logs) {
        try {
          const e = decodeEventLog({
            abi: guardAbi,
            data: l.data,
            topics: l.topics,
          });
          if (e.eventName === 'GrantCreated')
            grants.current[i] = e.args.grantId;
        } catch {}
      }
    }
    await refresh(guard, String(id));
    setMessage(
      t(
        '任务已就绪。Agent 密钥仅保存在本页内存；刷新后请撤销旧任务并收回余额。',
        'Ready. Agent keys exist only in page memory; after refresh, revoke the old mission and recover its balance.',
      ),
    );
  }
  async function pay(
    kind: 'normal' | 'overspend' | 'recipient' | 'replay' | 'old',
    agentIndex = selectedAgent,
  ) {
    if (!guard || !snapshot) throw Error('Load a mission first');
    const { wc, account: a } = await wallet();
    let p: Payment, sig: Hex;
    if (kind === 'replay' || kind === 'old') {
      if (!lastPayment.current)
        throw Error(
          t('请先执行一笔正常付款。', 'Execute a normal payment first.'),
        );
      ({ p, sig } = lastPayment.current);
    } else {
      if (!sessions.current[agentIndex] || !grants.current[agentIndex])
        throw Error(
          t(
            '本页无 Agent 签名密钥，请创建新任务。',
            'No session key in this page. Create a new mission.',
          ),
        );
      const m = await rpc.readContract({
        address: guard,
        abi: guardAbi,
        functionName: 'missions',
        args: [BigInt(missionId)],
      });
      const block = await rpc.getBlock();
      p = {
        missionId: BigInt(missionId),
        grantId: grants.current[agentIndex],
        recipient:
          kind === 'recipient'
            ? '0x000000000000000000000000000000000000dEaD'
            : (merchant as Address),
        amount: parseUnits(kind === 'overspend' ? '6' : '1', 6),
        requestId: keccak256(toHex(crypto.randomUUID())),
        deadline: block.timestamp + 600n,
        epoch: m[5],
      };
      sig = await sessions.current[agentIndex].signTypedData(
        paymentData(guard, 43113, p),
      );
    }
    // Simulation asks the deployed EVM, not a local JavaScript policy engine.
    try {
      await rpc.simulateContract({
        address: guard,
        abi: guardAbi,
        functionName: 'executePayment',
        args: [p, sig],
        account: a,
      });
    } catch (e) {
      const code = policyRejection(e);
      if (!code)
        throw Error(
          t('未能验证付款规则：', 'Could not verify payment policy: ') +
            readableError(e),
        );
      log({
        label: t(
          '链上模拟拒绝（未广播交易）',
          'On-chain simulation rejected (not broadcast)',
        ),
        status: 'info',
        detail: code,
      });
      setMessage(
        t(
          '合约模拟已拒绝该请求，未发送付款交易。',
          'Contract simulation rejected this request; no transaction was broadcast.',
        ),
      );
      return;
    }
    if (kind !== 'normal')
      throw Error(
        t(
          '异常请求未被拒绝，已停止广播。请检查任务配置。',
          'Unexpectedly allowed. Broadcast stopped; check mission policy.',
        ),
      );
    await confirmed(
      await wc.writeContract({
        account: a,
        address: guard,
        abi: guardAbi,
        functionName: 'executePayment',
        args: [p, sig],
      }),
      t('Agent 付款 1 DemoUSD', 'Agent pays 1 DemoUSD'),
    );
    lastPayment.current = { p, sig };
    await refresh();
  }
  async function revoke() {
    if (!guard) throw Error('Load a vault');
    const { wc, account: a } = await wallet();
    await confirmed(
      await wc.writeContract({
        account: a,
        address: guard,
        abi: guardAbi,
        functionName: 'revokeMission',
        args: [BigInt(missionId)],
      }),
      t('撤销任务授权', 'Revoke mission'),
    );
    await refresh();
  }
  async function revokeBranch() {
    if (!guard || !grants.current[0]) throw Error('Create a mission first');
    const { wc, account: a } = await wallet();
    await confirmed(
      await wc.writeContract({
        account: a,
        address: guard,
        abi: guardAbi,
        functionName: 'revokeGrant',
        args: [grants.current[0]],
      }),
      t('撤销研究分支及其下级', 'Revoke research branch and descendants'),
    );
    setBranchRevoked(true);
    await refresh();
  }
  async function fulfill(service: Service, transactionHash?: Hex) {
    if (!brief || !guard || !missionId)
      throw Error('Select a report and mission first.');
    const response = await fetch('/api/fulfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: brief.id,
        service,
        guard,
        missionId,
        transactionHash,
      }),
    });
    const data = (await response.json()) as ServiceReceipt & { error?: string };
    if (!response.ok)
      throw Error(
        data.error ??
          'Delivery unavailable. Retry delivery without paying again.',
      );
    onReceipt(data);
    log({
      label: t('服务交付已验证', 'Service delivery verified'),
      status: 'confirmed',
      hash: data.transactionHash,
      detail: services[service].label,
    });
    setMessage(
      t(
        '费用凭证已保存，可回到任务页导出。',
        'Receipt saved. Return to the task page to export.',
      ),
    );
  }
  async function purchase(service: Service) {
    if (
      !brief ||
      !guard ||
      !snapshot ||
      !manifest?.deployer ||
      manifest.status !== 'deployed' ||
      guard.toLowerCase() !== manifest.guard?.toLowerCase()
    )
      throw Error(
        t('请先载入项目已部署金库。', 'Load the deployed project vault first.'),
      );
    if (snapshot[7] !== brief.id)
      throw Error(
        t(
          '当前任务不属于这份报告，请为报告创建新任务。',
          'This mission belongs to another report; create a new mission.',
        ),
      );
    if (merchant.toLowerCase() !== manifest.deployer.toLowerCase())
      throw Error(
        t(
          '服务收款方必须是项目的演示服务地址。',
          'Use the project demo service recipient.',
        ),
      );
    const id = orderId(brief.id, service, guard, missionId);
    const alreadyPaid = await rpc.readContract({
      address: guard,
      abi: guardAbi,
      functionName: 'usedRequests',
      args: [BigInt(missionId), id],
    });
    if (alreadyPaid) {
      await fulfill(service, pendingOrders.current.get(id));
      return;
    }
    // A broadcast with uncertain outcome is reconciled, never replaced with a new order.
    const pending = pendingOrders.current.get(id);
    if (pending) {
      await confirmed(
        pending,
        t('确认已有订单付款', 'Confirm existing order payment'),
      );
      await fulfill(service, pending);
      return;
    }
    const index = services[service].agentIndex;
    if (!sessions.current[index] || !grants.current[index])
      throw Error(
        t(
          '签名会话已丢失；已付款的订单可恢复交付，新付款请创建新任务。',
          'Signing session missing. Recover paid orders, or create a new mission for new payments.',
        ),
      );
    const { wc, account: a } = await wallet();
    const m = await rpc.readContract({
      address: guard,
      abi: guardAbi,
      functionName: 'missions',
      args: [BigInt(missionId)],
    });
    const block = await rpc.getBlock();
    const payment: Payment = {
      missionId: BigInt(missionId),
      grantId: grants.current[index],
      recipient: manifest.deployer as Address,
      amount: BigInt(services[service].units),
      requestId: id,
      deadline: block.timestamp + 600n,
      epoch: m[5],
    };
    const signature = await sessions.current[index].signTypedData(
      paymentData(guard, 43113, payment),
    );
    await rpc.simulateContract({
      address: guard,
      abi: guardAbi,
      functionName: 'executePayment',
      args: [payment, signature],
      account: a,
    });
    const hash = await wc.writeContract({
      account: a,
      address: guard,
      abi: guardAbi,
      functionName: 'executePayment',
      args: [payment, signature],
    });
    pendingOrders.current.set(id, hash);
    setRecoveryHash(hash);
    await confirmed(hash, t('服务订单付款', 'Service order payment'));
    await refresh();
    await fulfill(service, hash);
  }
  async function withdraw() {
    if (!guard) throw Error('Load a vault');
    const { wc, account: a } = await wallet();
    await confirmed(
      await wc.writeContract({
        account: a,
        address: guard,
        abi: guardAbi,
        functionName: 'withdrawRemainder',
        args: [BigInt(missionId)],
      }),
      t('收回未花费资金', 'Recover remaining funds'),
    );
    await refresh();
  }
  const disabled = !!busy;
  const owner =
    !!account && snapshot?.[0].toLowerCase() === account.toLowerCase();
  return (
    <div className="chain-workspace">
      <section className="ledger chain-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">REAL TRANSACTIONS / CHAIN 43113</p>
            <h2>{t('真实 Fuji 测试网', 'Real Fuji testnet')}</h2>
          </div>
          <Button disabled={disabled} onClick={() => act('Connect', connect)}>
            <Wallet />
            {account ? short(account) : t('连接钱包', 'Connect wallet')}
          </Button>
        </div>
        <p className="notice">
          {t(
            '使用无实际价值的测试 AVAX 支付 Gas。自测资产为 DemoUSD，不是 Circle USDC；默认收款方为你的钱包，不会购买外部服务。',
            'Use valueless test AVAX for gas. Self-tests use DemoUSD, not Circle USDC. The default recipient is your wallet; no external service is purchased.',
          )}
        </p>
        {brief && (
          <div className="task-bill">
            <h3>
              {t('已选报告的采购任务', 'Procurement for the selected report')}
            </h3>
            <p className="notice break-all">
              Task: {brief.id}
              <br />
              {t(
                '创建任务时绑定此报告。服务结算需使用项目金库及下方固定收款地址。',
                'New missions bind this report. Service settlement requires the project vault and fixed recipient below.',
              )}
            </p>
            {manifest?.status === 'deployed' && manifest.deployer ? (
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  act('Use service vault', async () => {
                    await attach(manifest.guard);
                    setMerchant(manifest.deployer!);
                  })
                }
              >
                {t(
                  '使用项目服务金库与收款地址',
                  'Use project service vault & recipient',
                )}
              </Button>
            ) : (
              <p className="notice">
                {t(
                  '项目金库尚待 Fuji 部署。可先使用报告和规则模拟。',
                  'Project vault awaits Fuji deployment. Reports and policy simulations are available.',
                )}
              </p>
            )}
            <div className="action-row wrap">
              {(['activity', 'verify'] as const).map((service) => (
                <Button
                  key={service}
                  disabled={
                    disabled ||
                    !owner ||
                    !brief ||
                    manifest?.status !== 'deployed'
                  }
                  onClick={() =>
                    act('Procure ' + service, () => purchase(service))
                  }
                >
                  {services[service].label} ·{' '}
                  {Number(services[service].units) / 1e6} DemoUSD
                </Button>
              ))}
            </div>
            <details>
              <summary>
                {t(
                  '恢复已付款的服务结果（不再付款）',
                  'Recover paid service results (no new payment)',
                )}
              </summary>
              <label htmlFor="payment-hash" className="field-label">
                {t(
                  '交易哈希（可选；未填写时查询最近 2000 块）',
                  'Transaction hash (optional; searches latest 2,000 blocks if empty)',
                )}
              </label>
              <Input
                id="payment-hash"
                value={recoveryHash}
                onChange={(e) => setRecoveryHash(e.target.value)}
                placeholder="0x…"
              />
              <div className="action-row wrap">
                {(['activity', 'verify'] as const).map((service) => (
                  <Button
                    variant="outline"
                    key={service}
                    disabled={
                      disabled ||
                      !snapshot ||
                      !guard ||
                      (!!recoveryHash &&
                        !/^0x[0-9a-f]{64}$/i.test(recoveryHash))
                    }
                    onClick={() =>
                      act('Recover ' + service, () =>
                        fulfill(
                          service,
                          recoveryHash ? (recoveryHash as Hex) : undefined,
                        ),
                      )
                    }
                  >
                    {t('恢复：', 'Recover: ')}
                    {services[service].label}
                  </Button>
                ))}
              </div>
            </details>
          </div>
        )}
        <div className="chain-steps">
          <div>
            <span className="step-index">01</span>
            <h3>{t('准备测试网金库', 'Prepare a test vault')}</h3>
            <p>
              {t(
                '连接 Core / MetaMask 后，可直接部署自己的金库。',
                'Connect Core / MetaMask to deploy your own vault.',
              )}
            </p>
            <div className="action-row">
              <Button
                variant="outline"
                disabled={disabled || !account}
                onClick={() => act('Deploy', deploy)}
              >
                {t('部署自测金库', 'Deploy self-test vault')}
              </Button>
              <a
                className="text-link"
                href="https://build.avax.network/console/primary-network/faucet"
                target="_blank"
                rel="noreferrer"
              >
                {t('领取测试 AVAX', 'Get test AVAX')}
                <ExternalLink size={14} />
              </a>
            </div>
            {manifest?.status === 'deployed' && manifest.guard && (
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={() => act('Load', () => attach(manifest.guard))}
              >
                {t('载入项目已部署金库', 'Load project vault')}
              </Button>
            )}
            <label className="field-label" htmlFor="vault-address">
              {t('或载入已有金库地址', 'Or load an existing vault address')}
            </label>
            <div className="input-row">
              <Input
                disabled={disabled}
                id="vault-address"
                value={contractInput}
                onChange={(e) => setContractInput(e.target.value)}
                placeholder="0x…"
              />
              <Button
                variant="outline"
                disabled={disabled || !isAddress(contractInput)}
                onClick={() => act('Load', () => attach())}
              >
                {t('载入', 'Load')}
              </Button>
            </div>
            {guard && (
              <a
                className="text-link break-all"
                target="_blank"
                rel="noreferrer"
                href={`https://testnet.snowtrace.io/address/${guard}`}
              >
                {short(guard)}
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          <div>
            <span className="step-index">02</span>
            <h3>{t('创建 10 DemoUSD 任务', 'Create a 10 DemoUSD mission')}</h3>
            <p>
              {t(
                '依次领取、授权、托管资金，并配置三名 Agent。钱包会逐笔请求签名。',
                'Mint, approve, fund, and configure three agents. Your wallet requests each transaction individually.',
              )}
            </p>
            <label className="field-label" htmlFor="merchant">
              {t('自测收款地址', 'Self-test recipient')}
            </label>
            <Input
              disabled={disabled}
              id="merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="0x…"
            />
            <Button
              disabled={disabled || !guard || !account || !isAddress(merchant)}
              onClick={() => act('Create mission', createMission)}
            >
              {t('创建任务与 Agent', 'Create mission & agents')}
            </Button>
            <label className="field-label" htmlFor="mission-id">
              {t(
                '读取任务编号（刷新后可恢复查看）',
                'Read mission ID (also after refresh)',
              )}
            </label>
            <div className="input-row">
              <Input
                disabled={disabled}
                id="mission-id"
                inputMode="numeric"
                value={missionId}
                onChange={(e) => {
                  setMissionId(e.target.value);
                  setSnapshot(undefined);
                  sessions.current = [];
                  grants.current = [];
                  lastPayment.current = undefined;
                }}
                placeholder="1"
              />
              <Button
                variant="outline"
                disabled={disabled || !guard || !missionId}
                onClick={() => act('Refresh', () => refresh())}
              >
                <RefreshCw />
                {t('读取', 'Read')}
              </Button>
            </div>
          </div>
        </div>
        {snapshot && (
          <div className="onchain-state">
            <div>
              <span>{t('托管预算', 'Budget')}</span>
              <b>{formatUnits(snapshot[1], 6)}</b>
            </div>
            <div>
              <span>{t('已支出', 'Spent')}</span>
              <b>{formatUnits(snapshot[2], 6)}</b>
            </div>
            <div>
              <span>{t('已收回', 'Recovered')}</span>
              <b>{formatUnits(snapshot[3], 6)}</b>
            </div>
            <div>
              <span>{t('状态', 'State')}</span>
              <b>
                {snapshot[6]
                  ? t('已撤销', 'Revoked')
                  : Number(snapshot[4]) <= Date.now() / 1000
                    ? t('已过期', 'Expired')
                    : t('生效中', 'Active')}
              </b>
            </div>
          </div>
        )}
        <div className="action-row wrap">
          <label htmlFor="active-agent">
            {t('执行分支', 'Execution branch')}
          </label>
          <select
            id="active-agent"
            className="task-select"
            value={selectedAgent}
            disabled={disabled}
            onChange={(e) => setSelectedAgent(Number(e.target.value))}
          >
            <option value={0}>
              {t('研究主管 / 根授权 8', 'Research / root ceiling 8')}
            </option>
            <option value={1}>
              {t('└ 数据采集 / 子授权 3', '└ Data / child ceiling 3')}
            </option>
            <option value={2}>
              {t(
                '独立核对 / 根授权 2',
                'Independent verification / root ceiling 2',
              )}
            </option>
          </select>
        </div>
        {!!grants.current.length && (
          <p className="notice">
            {t(
              '权限树：研究主管 → 数据采集；独立核对另设根授权。上级额度由自身与下级共享，不是额外余额。',
              'Tree: research → data; verification has an independent root. Parent ceilings are shared with descendants, not additional balances.',
            )}{' '}
            {branchRevoked &&
              t(
                '研究分支已撤销；可以测试子授权拒绝与独立分支付款。',
                'Research revoked. Test child rejection and independent branch payment.',
              )}
          </p>
        )}
        <div className="action-row wrap">
          <Button
            disabled={disabled || !snapshot || !sessions.current.length}
            onClick={() => act('Pay', () => pay('normal'))}
          >
            {t('正常付款 1 DemoUSD', 'Pay 1 DemoUSD')}
          </Button>
          {(['overspend', 'recipient', 'replay'] as const).map((k, i) => (
            <Button
              key={k}
              variant="outline"
              disabled={disabled || !snapshot}
              onClick={() => act(k, () => pay(k))}
            >
              {t(
                ['测试超额', '测试非法收款', '测试重放'][i],
                ['Test overspend', 'Test recipient', 'Test replay'][i],
              )}
            </Button>
          ))}
        </div>
        <div className="action-row wrap">
          <Button
            variant="outline"
            disabled={
              disabled ||
              !owner ||
              !grants.current[0] ||
              branchRevoked ||
              snapshot?.[6]
            }
            onClick={() => act('Revoke branch', revokeBranch)}
          >
            {t('停止研究分支', 'Stop research branch')}
          </Button>
          <Button
            variant="destructive"
            disabled={disabled || !owner || snapshot?.[6]}
            onClick={() => act('Revoke', revoke)}
          >
            <Power />
            {t('撤销整个任务', 'Revoke mission')}
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !snapshot?.[6] || !lastPayment.current}
            onClick={() => act('Old authorization', () => pay('old'))}
          >
            {t('验证旧授权失效', 'Check old authorization')}
          </Button>
          <Button
            variant="outline"
            disabled={
              disabled ||
              !owner ||
              !snapshot ||
              (!snapshot[6] && Number(snapshot[4]) > Date.now() / 1000) ||
              snapshot[1] - snapshot[2] - snapshot[3] === 0n
            }
            onClick={() => act('Withdraw', withdraw)}
          >
            <ArrowDownToLine />
            {t('收回余额', 'Recover balance')}
          </Button>
        </div>
        <div role="status" aria-live="polite" className="chain-message">
          {busy && <LoaderCircle className="spin" size={16} />}{' '}
          {busy
            ? t(
                '等待钱包签名或链上确认：',
                'Awaiting wallet or confirmation: ',
              ) + busy
            : message}
        </div>
      </section>
      <section className="ledger">
        <div className="panel-heading">
          <h2>{t('真实操作记录', 'Live operation receipts')}</h2>
          <span className="mode-tag">FUJI · NOT SIMULATED</span>
        </div>
        {!entries.length ? (
          <div className="empty-state">
            <ShieldCheck />
            <p>{t('尚无链上操作', 'No on-chain operations yet')}</p>
            <span>
              {t(
                '仅确认成功的交易显示为完成。',
                'Only successful receipts are marked confirmed.',
              )}
            </span>
          </div>
        ) : (
          <div className="receipt-list">
            {entries.map((e, i) => (
              <div className="receipt" key={i}>
                <span
                  className={`result ${e.status === 'confirmed' ? 'allowed' : e.status === 'error' ? 'blocked' : 'control'}`}
                >
                  {e.status}
                </span>
                <div>
                  <strong>{e.label}</strong>
                  {e.detail && <p>{e.detail}</p>}
                  {e.hash && (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`https://testnet.snowtrace.io/tx/${e.hash}`}
                    >
                      {short(e.hash)} <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
