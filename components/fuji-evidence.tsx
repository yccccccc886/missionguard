import trace from '@/public/evidence/procurement-fuji.json';

export default function FujiEvidence({ language }: { language: 'zh' | 'en' }) {
  const zh = language === 'zh';
  const labels: Record<string, [string, string]> = {
    mint: ['领取 DemoUSD', 'Mint DemoUSD'],
    approve: ['授权托管', 'Approve escrow'],
    mission: ['绑定报告并托管 10', 'Bind report and escrow 10'],
    merchant: ['设置服务收款方', 'Set service recipient'],
    research: ['研究分支授权', 'Research root grant'],
    data: ['采集子级授权', 'Data child grant'],
    verification: ['独立核对授权', 'Independent verification grant'],
    payActivity: ['采集付款 1.5', 'Activity payment 1.5'],
    revokeResearch: ['撤销研究分支', 'Revoke research branch'],
    payVerification: ['独立核对付款 0.5', 'Independent payment 0.5'],
    close: ['关闭任务', 'Close mission'],
    refund: ['退回余款 8', 'Refund remaining 8'],
  };
  return (
    <section className="ledger evidence-tests">
      <h2>
        {zh ? 'Fuji 真实采购回执' : 'Confirmed Fuji procurement receipts'}
      </h2>
      <p className="notice">
        {zh
          ? '12 笔交易已确认：托管 10、支付 2、退回 8 DemoUSD。撤销研究分支后，独立核对仍可付款。脚本代理、自建服务、无价值测试币；不是模型自主采购。'
          : '12 confirmed transactions: 10 escrowed, 2 paid and 8 DemoUSD refunded. Independent verification paid after research revocation. Scripted agents, self-operated services and valueless test tokens; no autonomous model purchases.'}
      </p>
      <p className="notice">
        {zh
          ? '另外两次只读模拟分别返回 RequestAlreadyUsed 与 GrantInactive；它们不是已广播的失败交易。'
          : 'Two additional read-only simulations returned RequestAlreadyUsed and GrantInactive. They are not broadcast failed transactions.'}
      </p>
      <p className="notice">
        {zh ? '任务' : 'Mission'} #{trace.missionId} · Fuji 43113 ·{' '}
        {trace.generatedAt}
      </p>
      <div className="action-row wrap">
        <a
          className="text-link"
          href="/evidence/procurement-fuji.json"
          target="_blank"
          rel="noreferrer"
        >
          {zh ? '下载完整证据' : 'Download full evidence'} ↗
        </a>
        <a
          className="text-link"
          href={`https://testnet.snowtrace.io/address/${trace.guard}`}
          target="_blank"
          rel="noreferrer"
        >
          {zh ? '查看金库合约' : 'View vault contract'} ↗
        </a>
      </div>
      {trace.transactions.map((transaction, index) => (
        <div className="test-line" key={transaction.hash}>
          <span className="muted mono">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="green">✓</span>
          <span>
            {labels[transaction.label]?.[zh ? 0 : 1] ?? transaction.label}
          </span>
          <a
            className="text-link mono"
            href={transaction.explorer}
            target="_blank"
            rel="noreferrer"
          >
            {zh ? '回执' : 'Receipt'} ↗
          </a>
        </div>
      ))}
    </section>
  );
}
