'use client';
import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ArrowUpRight,
  Play,
  Bot,
  Terminal,
  Wallet,
  Activity,
  LockKeyhole,
  RotateCcw,
  ArrowDownToLine,
  Power,
  Check,
  ShieldAlert,
  FileCheck2,
  Languages,
  Download,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import ChainPanel from '@/components/chain-panel';
import TaskPanel from '@/components/task-panel';
import type { Brief, ServiceReceipt } from '@/lib/procurement';
import {
  initialState,
  applyPayment,
  normalSteps,
  revokeDemo,
  withdrawDemo,
  runScenario,
  scenarios,
  errors,
  money,
  parseAmount,
  type DemoState,
  type DemoRequest,
  type AgentId,
  type Language,
  type Scenario,
} from '@/lib/demo-engine';

type Evidence = {
  environment: string;
  generatedAt: string;
  sourceHash: string;
  passed: number;
  failed: number;
  tests: { name: string; status: string; durationMs?: number }[];
};
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export default function Home() {
  const [lang, setLang] = useState<Language>('zh');
  const l = lang === 'zh' ? 0 : 1;
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const [tab, setTab] = useState('task');
  const [brief, setBrief] = useState<Brief>();
  const [serviceReceipts, setServiceReceipts] = useState<ServiceReceipt[]>([]);
  const [running, setRunning] = useState(false);
  const active = useRef(true);
  const [agent, setAgent] = useState<AgentId>('search');
  const [amount, setAmount] = useState('1.00');
  const [recipient, setRecipient] = useState('Search API');
  const [formError, setFormError] = useState('');
  const [evidence, setEvidence] = useState<Evidence>();
  const commit = (s: DemoState) => {
    stateRef.current = s;
    setState(s);
    return s;
  };
  useEffect(() => {
    active.current = true;
    const saved = localStorage.getItem('missionguard-language');
    if (saved === 'en' || saved === 'zh') setLang(saved);
    fetch('/evidence/contract-tests.json')
      .then((r) => {
        if (!r.ok) throw Error('Unavailable');
        return r.json();
      })
      .then((v) => {
        const e = v as Evidence;
        if (e && Number.isInteger(e.passed) && Array.isArray(e.tests))
          setEvidence(e);
      })
      .catch(() => {});
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const context = (document as unknown as { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    const tools = [
      {
        name: 'read_demo_state',
        description:
          'Read the visible MissionGuard browser simulation. No real funds or blockchain transactions.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({ mode: 'browser-simulation', ...stateRef.current }),
      },
      {
        name: 'run_demo_attack',
        description:
          'Reset the browser simulation and run a named attack scenario. Changes only simulated funds and visible demo state.',
        inputSchema: {
          type: 'object',
          properties: {
            scenario: { type: 'string', enum: scenarios.map((x) => x.id) },
          },
          required: ['scenario'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input: unknown) => {
          const p = input as { scenario?: Scenario };
          if (
            !p ||
            !scenarios.some((s) => s.id === p.scenario) ||
            Object.keys(p).some((k) => k !== 'scenario')
          )
            throw Error('Invalid scenario');
          const out = runScenario(p.scenario!);
          stateRef.current = out;
          setState(out);
          setTab('arena');
          return {
            mode: 'browser-simulation',
            result: out.events.at(-1),
            remaining: out.budget - out.spent - out.withdrawn,
          };
        },
      },
    ];
    for (const tool of tools)
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: life.signal }),
        ).catch(() => {});
      } catch {}
    return () => life.abort();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);
  function language() {
    const next = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    localStorage.setItem('missionguard-language', next);
  }
  async function demo() {
    if (running) return;
    setRunning(true);
    setTab('mission');
    commit(initialState());
    const pause = () => new Promise((r) => setTimeout(r, 500));
    try {
      for (const r of normalSteps()) {
        await pause();
        if (!active.current) return;
        commit(applyPayment(stateRef.current, r));
      }
      await pause();
      if (!active.current) return;
      commit(applyPayment(stateRef.current, normalSteps()[0]));
      await pause();
      if (!active.current) return;
      commit(revokeDemo(stateRef.current));
      await pause();
      if (!active.current) return;
      commit(
        applyPayment(stateRef.current, {
          ...normalSteps()[0],
          requestId: 'after-revoke',
        }),
      );
      await pause();
      if (active.current) commit(withdrawDemo(stateRef.current));
    } finally {
      if (active.current) setRunning(false);
    }
  }
  function attack(id: Scenario) {
    if (running) return;
    setFormError('');
    commit(runScenario(id));
    setTab('arena');
  }
  function submit() {
    try {
      const r: DemoRequest = {
        agent,
        amount: parseAmount(amount),
        recipient,
        requestId: 'custom-' + crypto.randomUUID(),
        epoch: state.epoch,
      };
      commit(applyPayment(stateRef.current, r));
      setFormError('');
    } catch (e) {
      setFormError(String((e as Error).message));
    }
  }
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            project: 'MissionGuard',
            mode: 'browser-simulation',
            exportedAt: new Date().toISOString(),
            ...state,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'missionguard-simulation.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  const remaining = state.budget - state.spent - state.withdrawn;
  const blocked = state.events.filter((e) => e.result === 'blocked').length;
  const last = state.events.at(-1);
  const ledger = (
    <section className="ledger">
      <div className="panel-heading">
        <div>
          <h2>{t('执行记录', 'Execution trace')}</h2>
          <p className="microcopy">
            {t(
              '浏览器模拟，无真实签名或资金转移。',
              'Browser simulation. No real signatures or funds move.',
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          disabled={!state.events.length || running}
          onClick={download}
        >
          <Download size={15} />
          {t('导出', 'Export')}
        </Button>
      </div>
      {!state.events.length ? (
        <div className="empty-state">
          <Terminal size={24} />
          <p>{t('等待任务启动', 'Waiting for your mission')}</p>
          <span>
            {t(
              '运行演示，或在攻防实验室发送付款请求。',
              'Run the demo or send a request in the attack lab.',
            )}
          </span>
        </div>
      ) : (
        <Table className="trace-table">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>AGENT</TableHead>
              <TableHead>{t('请求金额', 'AMOUNT')}</TableHead>
              <TableHead>{t('结果', 'RESULT')}</TableHead>
              <TableHead>{t('触发规则', 'RULE')}</TableHead>
              <TableHead>{t('金库余额', 'BALANCE')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="muted mono">
                  {String(e.id).padStart(2, '0')}
                </TableCell>
                <TableCell className="mono">{e.agent.toUpperCase()}</TableCell>
                <TableCell className="mono">{money(e.amount)}</TableCell>
                <TableCell>
                  <span className={`result ${e.result}`}>
                    {e.result === 'allowed' ? (
                      <Check size={12} />
                    ) : e.result === 'blocked' ? (
                      <ShieldAlert size={12} />
                    ) : (
                      <LockKeyhole size={12} />
                    )}{' '}
                    {e.result === 'allowed'
                      ? t('通过', 'PAID')
                      : e.result === 'blocked'
                        ? t('拦截', 'BLOCKED')
                        : t('控制', 'CONTROL')}
                  </span>
                </TableCell>
                <TableCell>
                  <span>{errors[e.code]?.[l] ?? e.code}</span>
                  <small>{e.code}</small>
                </TableCell>
                <TableCell className="mono">{money(e.after)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
  return (
    <main className="console">
      <header className="topbar">
        <a className="brand" href="/">
          <ShieldCheck size={27} />
          <span>
            MISSION<span className="muted">GUARD</span>
          </span>
        </a>
        <div className="top-right">
          <span className="network">
            <i /> AVALANCHE / FUJI
          </span>
          <Button
            variant="ghost"
            onClick={language}
            aria-label={t('Switch to English', '切换中文')}
          >
            <Languages size={16} />
            {lang === 'zh' ? 'EN' : '中文'}
          </Button>
        </div>
      </header>
      <section className="page-heading">
        <div>
          <p className="eyebrow">TASK PROCUREMENT / AVALANCHE</p>
          <h1>
            {t('交付任务。', 'Deliver the work.')}
            <span>
              {t('每笔花费，有据可查。', 'Account for every payment.')}
            </span>
          </h1>
          <p className="lead">
            {t(
              '任务成果、服务订单与预算权限，在同一个工作台。',
              'Task results, service orders and budget permissions in one workspace.',
            )}
          </p>
        </div>
        <Button className="primary-action" disabled={running} onClick={demo}>
          {running ? <LoaderCircle className="spin" /> : <Play size={16} />}{' '}
          {running
            ? t('正在运行演示', 'Running demo')
            : t('运行资金规则模拟', 'Run policy simulation')}
        </Button>
      </section>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="console-tabs" variant="line">
          <TabsTrigger value="task">
            <FileCheck2 />
            {t('任务与成果', 'Work & results')}
          </TabsTrigger>
          <TabsTrigger value="mission">
            <Activity />
            {t('规则模拟', 'Simulation')}
          </TabsTrigger>
          <TabsTrigger value="arena">
            <Terminal />
            {t('攻防实验室', 'Attack lab')}
          </TabsTrigger>
          <TabsTrigger value="chain">
            <Wallet />
            {t('链上金库', 'On-chain vault')}
          </TabsTrigger>
          <TabsTrigger value="evidence">
            <FileCheck2 />
            {t('验证证据', 'Evidence')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="task" keepMounted>
          <TaskPanel
            lang={lang}
            openChain={() => setTab('chain')}
            brief={brief}
            onBrief={setBrief}
            receipts={serviceReceipts}
          />
        </TabsContent>
        <TabsContent value="mission">
          <div className="workspace">
            <section className="mission-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    MISSION / 001 · BROWSER SIMULATION
                  </span>
                  <h2>
                    {t('Avalanche 生态研究', 'Avalanche ecosystem research')}
                  </h2>
                </div>
                <span className={`status ${state.revoked ? 'revoked' : ''}`}>
                  <i />
                  {state.withdrawn
                    ? t('已收回余额', 'Recovered')
                    : state.revoked
                      ? t('授权已撤销', 'Revoked')
                      : running
                        ? t('执行中', 'Running')
                        : t('就绪', 'Ready')}
                </span>
              </div>
              <div className="budget-row">
                <div>
                  <p className="label">{t('任务总预算', 'Mission budget')}</p>
                  <p className="big-number">
                    {money(state.budget).split('.')[0]}
                    <span>.{money(state.budget).split('.')[1]}</span>
                    <small>SIMULATED USDC</small>
                  </p>
                </div>
                <div className="budget-meta">
                  <span>
                    {t('已支出', 'Spent')}
                    <b>{money(state.spent)}</b>
                  </span>
                  <span>
                    {t('可用余额', 'Available')}
                    <b>{money(remaining)}</b>
                  </span>
                  {state.withdrawn > 0 && (
                    <span>
                      {t('已收回', 'Recovered')}
                      <b className="green">{money(state.withdrawn)}</b>
                    </span>
                  )}
                </div>
              </div>
              <Progress
                value={(state.spent / state.budget) * 100}
                aria-label={t('任务预算使用比例', 'Budget utilization')}
              />
              <div className="flow-label">
                <LockKeyhole size={14} />
                {t(
                  '任务金库 · 每笔支出同时检查总额与上级额度',
                  'Mission vault · Every payment checks all ancestor limits',
                )}
              </div>
              <div className="agents">
                {state.agents.map((a, i) => (
                  <article
                    className={`agent ${a.revoked ? 'agent-revoked' : ''}`}
                    key={a.id}
                  >
                    <div className="agent-top">
                      <span className="agent-icon">
                        <Bot size={21} />
                      </span>
                      <span className="muted mono">0{i + 1}</span>
                    </div>
                    <p className="eyebrow">
                      {a.label}
                      {a.parent ? ' ↳ ' + a.parent.toUpperCase() : ''}
                    </p>
                    <h3>
                      {t(
                        ['搜索 Agent', '数据 Agent', '核验 Agent'][i],
                        ['Search agent', 'Data agent', 'Verify agent'][i],
                      )}
                    </h3>
                    <p className="agent-budget">
                      {money(a.limit - a.spent)}
                      <small>USDC</small>
                    </p>
                    <p className="muted">
                      {t('支出', 'Spent')} {money(a.spent)} / {t('限额', 'Cap')}{' '}
                      {money(a.limit)}
                    </p>
                    <Progress
                      value={(a.spent / a.limit) * 100}
                      aria-label={`${a.label} budget`}
                    />
                  </article>
                ))}
              </div>
              <div className="mission-controls">
                <Button
                  variant="outline"
                  disabled={running || state.revoked}
                  onClick={() => commit(revokeDemo(state))}
                >
                  <Power />
                  {t('撤销授权', 'Revoke')}
                </Button>
                <Button
                  variant="outline"
                  disabled={running || !state.revoked || !!state.withdrawn}
                  onClick={() => commit(withdrawDemo(state))}
                >
                  <ArrowDownToLine />
                  {t('收回余额', 'Recover balance')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={running}
                  onClick={() => commit(initialState())}
                >
                  <RotateCcw />
                  {t('重置演示', 'Reset demo')}
                </Button>
              </div>
            </section>
            <aside className="rules-panel">
              <p className="eyebrow">ENFORCED BY CONTRACT</p>
              <h2>{t('授权边界', 'Permission boundary')}</h2>
              {[
                t('任务总额不可突破', 'Shared mission ceiling'),
                t('子任务继承上级额度', 'Inherited parent limits'),
                t('仅向允许的服务付款', 'Approved recipients only'),
                t('付款请求不可重复使用', 'Replay-proof requests'),
                t('撤销后旧授权失效', 'Revocable permissions'),
              ].map((rule, i) => (
                <div className="rule" key={i}>
                  <span>0{i + 1}</span>
                  <ShieldCheck size={17} />
                  {rule}
                </div>
              ))}
              <p className="boundary">
                {t(
                  '额度是累计支出上限，不代表预留资金。金库保护已托管资金，不判断服务质量。',
                  'Limits are cumulative ceilings, not reserved funds. The vault protects escrowed funds; it does not verify service quality.',
                )}
              </p>
            </aside>
          </div>
          {ledger}
          <div className="evidence-strip">
            <ShieldCheck size={18} />
            <span>
              {evidence
                ? t(
                    `本地 EVM：${evidence.passed} 项测试通过`,
                    `Local EVM: ${evidence.passed} tests passed`,
                  )
                : t('查看合约测试证据', 'Inspect contract evidence')}
            </span>
            <Button variant="link" onClick={() => setTab('evidence')}>
              {t('查看验证证据', 'View evidence')}
              <ChevronRight />
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="arena">
          <div className="section-intro">
            <div>
              <p className="eyebrow">TRY TO BREAK THE BOUNDARY</p>
              <h2>
                {t('把恶意请求交给金库。', 'Challenge the spending boundary.')}
              </h2>
              <p className="lead">
                {t(
                  '选择场景会重置模拟任务。这里重放资金规则；真实合约结果见验证证据。',
                  'Each scenario resets the simulation. Contract execution is independently tested in Evidence.',
                )}
              </p>
            </div>
            <span className="mode-tag">{t('模拟实验', 'SIMULATION')}</span>
          </div>
          <div className="arena-layout">
            <section className="scenario-grid">
              {scenarios.map((s, i) => (
                <button
                  disabled={running}
                  className={`scenario ${state.scenario === s.id ? 'selected' : ''}`}
                  key={s.id}
                  onClick={() => attack(s.id)}
                >
                  <div>
                    <span className="mono">0{i + 1}</span>
                    <ArrowUpRight size={18} />
                  </div>
                  <h3>{s.title[l]}</h3>
                  <p>{s.description[l]}</p>
                </button>
              ))}
            </section>
            <aside className="attack-result">
              <p className="eyebrow">POLICY RESULT</p>
              {last?.result === 'blocked' ? (
                <ShieldCheck className="result-icon" size={45} />
              ) : (
                <Terminal className="result-icon" size={45} />
              )}
              <h2>
                {last
                  ? errors[last.code]?.[l]
                  : t('等待请求', 'Awaiting request')}
              </h2>
              <p className="mono result-code">{last?.code ?? 'READY'}</p>
              <div className="result-stats">
                <span>
                  {t('已支出', 'Spent')}
                  <b>{money(state.spent)}</b>
                </span>
                <span>
                  {t('金库余额', 'Vault balance')}
                  <b>{money(remaining)}</b>
                </span>
                <span>
                  {t('拦截次数', 'Blocked requests')}
                  <b>{blocked}</b>
                </span>
              </div>
              <p className="boundary">
                {t(
                  '被拒绝的付款不会改变预算。真实链上失败交易仍可能消耗 Gas。',
                  'Rejected payments do not consume the token budget. Failed on-chain transactions may still cost gas.',
                )}
              </p>
              <Button
                variant="outline"
                disabled={running}
                onClick={() => commit(initialState())}
              >
                <RotateCcw />
                {t('恢复初始任务', 'Reset mission')}
              </Button>
            </aside>
          </div>
          <section className="ledger custom-request">
            <div>
              <h2>{t('自定义付款请求', 'Custom payment request')}</h2>
              <p className="microcopy">
                {t(
                  '允许的收款服务：Search API、Data API、Verify API。',
                  'Allowed recipients: Search API, Data API, Verify API.',
                )}
              </p>
            </div>
            <div className="request-fields">
              <label>
                <span>Agent</span>
                <Select
                  value={agent}
                  onValueChange={(v) => setAgent(v as AgentId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                <span>{t('金额（USDC）', 'Amount (USDC)')}</span>
                <Input
                  aria-label="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label>
                <span>{t('收款服务', 'Recipient')}</span>
                <Input
                  aria-label="Recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </label>
              <Button disabled={running} onClick={submit}>
                {t('发送模拟请求', 'Send simulated request')}
                <ArrowUpRight />
              </Button>
            </div>
            {formError && (
              <p className="error-text" role="alert">
                {formError}
              </p>
            )}
          </section>
          {ledger}
        </TabsContent>
        <TabsContent value="chain" keepMounted>
          <ChainPanel
            lang={lang}
            brief={brief}
            onReceipt={(r) =>
              setServiceReceipts((old) => [
                ...old.filter((x) => x.requestId !== r.requestId),
                r,
              ])
            }
          />
        </TabsContent>
        <TabsContent value="evidence">
          <div className="section-intro">
            <div>
              <p className="eyebrow">VERIFIABLE, NOT JUST VISIBLE</p>
              <h2>
                {t(
                  '每个安全主张，都有验证范围。',
                  'Every security claim has a test boundary.',
                )}
              </h2>
              <p className="lead">
                {t(
                  '测试结果来自真实编译的 Solidity 合约，在本地 EVM 中执行。',
                  'Results come from compiled Solidity contracts executed in a local EVM.',
                )}
              </p>
            </div>
            <a
              className="text-link"
              href="/evidence/contract-tests.json"
              download
            >
              <Download size={16} />
              {t('下载原始报告', 'Download report')}
            </a>
          </div>
          <div className="evidence-overview">
            <div>
              <span className="eyebrow">CONTRACT TESTS</span>
              <strong>
                {evidence?.passed ?? '—'}
                <small> / {evidence?.tests.length ?? '—'}</small>
              </strong>
              <p>{t('已通过', 'Passed')}</p>
            </div>
            <div>
              <span className="eyebrow">TEST ENVIRONMENT</span>
              <h3>Hardhat EVM</h3>
              <p>
                {t('本地链 ID 31337，非 Fuji', 'Local chain 31337, not Fuji')}
              </p>
            </div>
            <div>
              <span className="eyebrow">SOURCE FINGERPRINT</span>
              <p className="break-all mono">
                {evidence?.sourceHash ?? 'Loading…'}
              </p>
              <p>
                {evidence?.generatedAt
                  ? new Date(evidence.generatedAt).toISOString()
                  : ''}
              </p>
            </div>
          </div>
          <section className="ledger evidence-tests">
            <h2>{t('真实数据与任务采购', 'Real data and task procurement')}</h2>
            <p className="notice">
              {t(
                '公开链数据报告可直接查看。报告绑定订单的付款、重复请求拒绝、分支撤销及 8 DemoUSD 退款已在本地 EVM 验证；不作为 Fuji 交易证据。',
                'Public-chain data reports are available to inspect. Report-bound payment, duplicate rejection, branch revocation and an 8 DemoUSD refund were verified on a local EVM, not Fuji.',
              )}
            </p>
            <div className="action-row wrap">
              <a
                className="text-link"
                href="/evidence/research-example.json"
                target="_blank"
                rel="noreferrer"
              >
                {t('真实数据案例', 'Real-data example')} ↗
              </a>
              <a
                className="text-link"
                href="/evidence/procurement-local.json"
                target="_blank"
                rel="noreferrer"
              >
                {t('本地采购执行记录', 'Local procurement trace')} ↗
              </a>
            </div>
          </section>
          <section className="ledger evidence-tests">
            <h2>{t('合约验证清单', 'Contract verification')}</h2>
            {evidence ? (
              <div>
                {evidence.tests.map((test, i) => (
                  <div className="test-line" key={test.name}>
                    <span className="muted mono">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Check
                      size={16}
                      className={
                        test.status === 'passed' ? 'green' : 'error-text'
                      }
                    />
                    <span>{test.name}</span>
                    <span className="mono muted">
                      {test.durationMs ?? '—'} ms
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="notice">
                {t('尚未载入测试报告。', 'Test report has not loaded.')}
              </p>
            )}
          </section>
          <section className="ledger limitations">
            <h2>{t('当前边界与复现方法', 'Limits and reproduction')}</h2>
            <p>
              {t(
                '合约不识别提示注入，也不验证服务是否值得购买。Agent 即使被操控，也只能在有效授权内支出。被允许的恶意商家仍可能收到授权范围内的资金。',
                'The contract does not detect prompt injection or judge service value. A compromised agent remains limited by its active grants. A malicious approved merchant can still receive authorized payments.',
              )}
            </p>
            <p>
              {t(
                '撤销以交易进入链上的执行顺序为准，不能撤回已完成付款。模拟 Agent 为可重放的测试执行器，不宣称由大模型自主生成。',
                'Revocation takes effect in on-chain execution order and cannot reverse completed payments. Demo agents are reproducible test runners, not claimed autonomous LLM outputs.',
              )}
            </p>
            <p>
              {t(
                '合约尚未经独立安全审计。测试报告不会证明所有攻击均已覆盖。',
                'The contract has not undergone an independent security audit. Test results do not prove complete attack coverage.',
              )}
            </p>
            <code>
              npm ci
              <br />
              npm run test:contracts
              <br />
              npm run test:ui
              <br />
              npm run demo:local
              <br />
              npm run build
            </code>
            <div className="action-row">
              <a
                className="text-link"
                href="/evidence/architecture.md"
                target="_blank"
              >
                {t('架构与威胁模型', 'Architecture & threat model')}
                <ArrowUpRight size={14} />
              </a>
              <a
                className="text-link"
                href="/evidence/local-demo.json"
                target="_blank"
              >
                {t('完整本地执行记录', 'Local execution trace')}
                <ArrowUpRight size={14} />
              </a>
              <a
                className="text-link"
                href="/evidence/fuji-deployment.json"
                target="_blank"
              >
                {t('Fuji 部署状态', 'Fuji deployment status')}
                <ArrowUpRight size={14} />
              </a>
            </div>
          </section>
        </TabsContent>
      </Tabs>
      <div className="sr-only" role="status" aria-live="polite">
        {last ? errors[last.code]?.[l] : ''}
      </div>
      <footer>
        <span>MISSIONGUARD · BUILDATHON 2026</span>
        <a href="https://build.avax.network/" target="_blank" rel="noreferrer">
          Built for Avalanche <ArrowUpRight size={14} />
        </a>
      </footer>
    </main>
  );
}
