'use client';
import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  ArrowUpRight,
  Download,
  LoaderCircle,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Language } from '@/lib/demo-engine';
import {
  networks,
  services,
  reportMarkdown,
  type Brief,
  type DataChain,
  type ServiceReceipt,
} from '@/lib/procurement';

export default function TaskPanel({
  lang,
  openChain,
  brief,
  onBrief,
  receipts,
}: {
  lang: Language;
  openChain: () => void;
  brief?: Brief;
  onBrief: (b: Brief) => void;
  receipts: ServiceReceipt[];
}) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  const [address, setAddress] = useState(
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  );
  const [chainId, setChainId] = useState<DataChain>(43114);
  const [recoverId, setRecoverId] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [example, setExample] = useState<Brief>();
  const [modelEnabled, setModelEnabled] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [narrative, setNarrative] = useState<{
    taskId: string;
    text: string;
    model: string;
    generatedAt: string;
  }>();
  useEffect(() => {
    fetch('/evidence/research-example.json')
      .then((r) => (r.ok ? (r.json() as Promise<Brief>) : undefined))
      .then((v) => {
        if (v?.id) setExample(v);
      })
      .catch(() => {});
    fetch('/api/narrative')
      .then((r) => r.json() as Promise<{ enabled?: boolean }>)
      .then((v) => setModelEnabled(v.enabled === true))
      .catch(() => {});
  }, []);
  async function interpret() {
    if (!brief || interpreting) return;
    setInterpreting(true);
    setError('');
    try {
      const response = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: brief.id, language: lang }),
      });
      const data = (await response.json()) as {
        taskId: string;
        text: string;
        model: string;
        generatedAt: string;
        error?: string;
      };
      if (!response.ok) throw Error(data.error ?? 'Model unavailable');
      setNarrative(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInterpreting(false);
    }
  }
  async function run(recover = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(
        recover
          ? `/api/tasks?id=${encodeURIComponent(recoverId.trim())}`
          : '/api/tasks',
        recover
          ? {}
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: address.trim(), chainId }),
            },
      );
      const data = (await res.json()) as Brief & { error?: string };
      if (!res.ok) throw Error(data.error ?? 'Service unavailable');
      onBrief(data);
      setRecoverId(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function download(format: 'md' | 'json') {
    if (!brief) return;
    const interpretation =
      narrative?.taskId === brief.id ? narrative : undefined;
    const text =
      format === 'md'
        ? reportMarkdown(brief) +
          (interpretation
            ? `\n## 模型解读 / Model interpretation (${interpretation.model})\n\n${interpretation.text}\n\nGenerated: ${interpretation.generatedAt}\n`
            : '')
        : JSON.stringify(
            {
              brief,
              interpretation,
              receipts: receipts.filter((r) => r.taskId === brief.id),
            },
            null,
            2,
          );
    const url = URL.createObjectURL(
      new Blob([text], {
        type:
          format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `missionguard-${brief.id.slice(2, 10)}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return (
    <div className="task-workspace">
      <section className="ledger task-order">
        <p className="eyebrow">01 / TASK ORDER</p>
        <h2>
          {t('Avalanche 合约活动简报', 'Avalanche contract activity brief')}
        </h2>
        <p className="lead">
          {t(
            '查询最近 96 个已过去的区块。先看实际结果，再体验有预算约束的测试网采购。',
            'Inspect a recent 96-block window. Review the result, then try budget-controlled testnet procurement.',
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label className="field-label" htmlFor="data-network">
            {t('数据网络（只读）', 'Data network (read only)')}
          </label>
          <select
            id="data-network"
            className="task-select"
            value={chainId}
            disabled={busy}
            onChange={(e) => setChainId(Number(e.target.value) as DataChain)}
          >
            <option value={43114}>Avalanche C-Chain</option>
            <option value={43113}>Avalanche Fuji</option>
          </select>
          <label className="field-label" htmlFor="research-address">
            {t('合约地址', 'Contract address')}
          </label>
          <Input
            id="research-address"
            value={address}
            disabled={busy}
            required
            pattern="0x[0-9a-fA-F]{40}"
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
          />
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : <FileText />}
            {t('生成真实数据简报', 'Generate live data brief')}
          </Button>
        </form>
        <p className="notice">
          {t(
            '免费读取公开数据，不需要钱包。数据由确定性程序采集，模型解读单独标注。',
            'Free public-data reads, no wallet required. Data collection is deterministic; model interpretation is labeled separately.',
          )}
        </p>
        {example && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              onBrief(example);
              setAddress(example.spec.address);
              setChainId(example.spec.chainId);
              setRecoverId(example.id);
              setError('');
            }}
          >
            {t('查看已验证的数据案例', 'View recorded data example')}
          </Button>
        )}
        <details className="task-recovery">
          <summary>{t('恢复已保存任务', 'Recover a saved task')}</summary>
          <label htmlFor="recover-task" className="field-label">
            {t('任务 ID（可从报告复制）', 'Task ID (copy from report)')}
          </label>
          <Input
            id="recover-task"
            value={recoverId}
            onChange={(e) => setRecoverId(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={busy || !/^0x[0-9a-f]{64}$/.test(recoverId.trim())}
            onClick={() => run(true)}
          >
            {t('恢复报告', 'Recover report')}
          </Button>
        </details>
        <div
          role="status"
          aria-live="polite"
          className={error ? 'task-error' : 'chain-message'}
        >
          {busy
            ? t(
                '采集事件 → 固定区块复核 → 保存报告…',
                'Collecting logs → checking pinned blocks → saving report…',
              )
            : error}
        </div>
      </section>
      <section className="ledger task-result">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">02 / DELIVERABLE</p>
            <h2>{t('成果与来源', 'Result and provenance')}</h2>
          </div>
          {brief && (
            <span className="mode-tag">
              {t('真实数据 · 非实时模型', 'REAL DATA · NO LLM')}
            </span>
          )}
        </div>
        {!brief ? (
          <div className="empty-state">
            <FileText />
            <p>
              {t(
                '选择合约，开始一次真实数据任务',
                'Choose a contract to start a real data task',
              )}
            </p>
            <span>
              {t(
                '也可查看已记录案例，无需签名或领取测试币。',
                'Or view a recorded example. No signature or test tokens needed.',
              )}
            </span>
          </div>
        ) : (
          <>
            <p className="task-address">
              <a
                href={`${networks[brief.spec.chainId].explorer}/address/${brief.spec.address}`}
                target="_blank"
                rel="noreferrer"
              >
                {brief.spec.address} <ExternalLink size={14} />
              </a>
            </p>
            <p className="notice">
              {networks[brief.spec.chainId].name} · {t('区块', 'Blocks')}{' '}
              {brief.spec.fromBlock}–{brief.spec.toBlock}
              <br />
              {brief.startTime} → {brief.endTime}
            </p>
            <div className="task-metrics">
              <div>
                <span>{t('合约发出的事件', 'Emitted logs')}</span>
                <strong>{brief.eventCount}</strong>
              </div>
              <div>
                <span>{t('涉及的不同交易', 'Distinct transactions')}</span>
                <strong>{brief.transactionCount}</strong>
              </div>
              <div>
                <span>{t('固定区块复核', 'Pinned-block check')}</span>
                <strong>
                  <Check size={25} /> {t('一致', 'Match')}
                </strong>
              </div>
            </div>
            <p className="notice">
              {t(
                '统计只覆盖发出事件的调用；不代表全部调用量、用户数或交易额。两次读取来自同一官方 RPC，不是独立审计。',
                'Counts only calls that emit logs, not all calls, users or volume. Both reads use the same official RPC; this is not an independent audit.',
              )}
            </p>
            <div className="task-transactions">
              {[...new Set(brief.events.map((e) => e.transactionHash))]
                .slice(0, 3)
                .map((hash) => (
                  <a
                    key={hash}
                    target="_blank"
                    rel="noreferrer"
                    href={`${networks[brief.spec.chainId].explorer}/tx/${hash}`}
                  >
                    {hash.slice(0, 16)}…{hash.slice(-8)}{' '}
                    <ArrowUpRight size={15} />
                  </a>
                ))}
            </div>
            <div className="action-row wrap">
              <Button variant="outline" onClick={() => download('md')}>
                <Download />
                {t('下载报告', 'Download report')}
              </Button>
              <Button variant="outline" onClick={() => download('json')}>
                {t('导出数据与账单', 'Export data & receipts')}
              </Button>
            </div>
            <details>
              <summary>
                {t('查看任务 ID、来源与哈希', 'Task ID, source and hash')}
              </summary>
              <dl className="task-provenance">
                <dt>Task ID</dt>
                <dd>{brief.id}</dd>
                <dt>Source</dt>
                <dd>{brief.source}</dd>
                <dt>Data hash</dt>
                <dd>{brief.dataHash}</dd>
                <dt>{t('采集时间', 'Collected')}</dt>
                <dd>{brief.createdAt}</dd>
              </dl>
            </details>
            <div className="task-bill">
              <h3>{t('模型解读', 'Model interpretation')}</h3>
              {narrative?.taskId === brief.id ? (
                <>
                  <p className="notice">
                    {narrative.model} · {narrative.generatedAt}
                  </p>
                  <p className="task-narrative">{narrative.text}</p>
                </>
              ) : (
                <p className="notice">
                  {modelEnabled
                    ? t(
                        '将这份报告中的公开统计交给模型解释。模型不接触签名密钥，也不执行付款。',
                        'Ask the model to explain these public statistics. It receives no signing keys and executes no payments.',
                      )
                    : t(
                        '尚未配置模型 API；上面的数据与报告仍可使用。',
                        'Model API not configured. The data and report above remain available.',
                      )}
                </p>
              )}
              <Button
                variant="outline"
                disabled={!modelEnabled || interpreting || busy}
                onClick={interpret}
              >
                {interpreting ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <FileText />
                )}
                {t('生成模型解读', 'Generate interpretation')}
              </Button>
            </div>
          </>
        )}
        <div className="task-bill">
          <p className="eyebrow">03 / PROCUREMENT RECEIPTS</p>
          <h3>{t('服务订单', 'Service orders')}</h3>
          <p className="notice">
            {t(
              '自建演示服务；报价使用无价值的 DemoUSD。免费报告不等于已付款，只有验证过的交易显示为已结算。',
              'Self-operated demo services priced in valueless DemoUSD. Free reports are not payments; only verified transactions are marked settled.',
            )}
          </p>
          {(['activity', 'verify'] as const).map((service) => {
            const receipt = receipts.find(
              (r) => r.taskId === brief?.id && r.service === service,
            );
            return (
              <div className="task-bill-row" key={service}>
                <span>{services[service].label}</span>
                <b>{Number(services[service].units) / 1e6} DemoUSD</b>
                {receipt ? (
                  <a href={receipt.explorer} target="_blank" rel="noreferrer">
                    {t('已结算 · 已交付', 'Settled · delivered')} ↗
                  </a>
                ) : (
                  <span className="muted">{t('未结算', 'Unsettled')}</span>
                )}
              </div>
            );
          })}
          <Button disabled={!brief || busy} onClick={openChain}>
            {t('配置预算并测试采购', 'Configure budget & test procurement')}{' '}
            <ArrowUpRight />
          </Button>
        </div>
      </section>
    </div>
  );
}
