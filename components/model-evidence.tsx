import sample from '@/public/evidence/model-example.json';

export default function ModelEvidence({ language }: { language: 'zh' | 'en' }) {
  const zh = language === 'zh';
  return (
    <section className="ledger evidence-tests">
      <h2>{zh ? '真实模型调用样本' : 'Recorded real model response'}</h2>
      <p className="notice">
        {zh
          ? '下面是已记录的真实 API 响应，查看不会发起新调用。模型解释公开统计，不签名或付款。'
          : 'This is a recorded provider response. Viewing it makes no new model call. The model explains public statistics and cannot sign or pay.'}
      </p>
      <p className="notice">{sample.result.model} · {sample.result.generatedAt}</p>
      <blockquote className="task-narrative">{sample.result.text}</blockquote>
      <p className="notice">
        {zh ? '输入 / 输出 Token' : 'Input / output tokens'}: {sample.result.usage.prompt_tokens} / {sample.result.usage.completion_tokens}
      </p>
      <p className="notice">
        {zh
          ? '本样本已由代码助手对照源数据核对；不是独立审计，也不是线上钱包流程验收证明。'
          : 'The coding assistant checked this sample against the source data. It is not an independent audit or a browser-wallet acceptance result.'}
      </p>
      <div className="action-row wrap">
        <a className="text-link" href="/evidence/model-example.json" target="_blank" rel="noreferrer">
          {zh ? '下载原始响应与核对记录' : 'Download response and review'} ↗
        </a>
        <a className="text-link" href="/evidence/research-example.json" target="_blank" rel="noreferrer">
          {zh ? '核对源数据' : 'Inspect source data'} ↗
        </a>
      </div>
    </section>
  );
}
