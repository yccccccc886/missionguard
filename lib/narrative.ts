import type { Brief } from './procurement';

export const narrativeVersion = 1;
export async function requestNarrative(
  brief: Brief,
  language: 'zh' | 'en',
  config: { key: string; model: string },
  fetcher: typeof fetch = fetch,
) {
  if (!config.key || !/^[A-Za-z0-9._/-]{2,120}$/.test(config.model))
    throw Error('Invalid model configuration.');
  const facts = {
    contract: brief.spec.address,
    chain: brief.spec.chainId,
    blocks: [brief.spec.fromBlock, brief.spec.toBlock],
    time: [brief.startTime, brief.endTime],
    emittedLogs: brief.eventCount,
    distinctTransactionsWithLogs: brief.transactionCount,
    verification: 'same RPC, two pinned-range reads matched',
  };
  let response: Response;
  try {
    response = await fetcher('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: config.model,
        max_tokens: 500,
        temperature: 0.1,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `Explain the supplied blockchain observation in ${language === 'zh' ? 'Chinese' : 'English'} in at most 150 words. Use only provided facts. Explain why log count is not all calls or users. State that this is a short observation window and a same-provider reread, not a security audit. No investment advice. No invented fees, payments, risks, trends or people. Return plain text.`,
          },
          { role: 'user', content: JSON.stringify(facts) },
        ],
      }),
    });
  } catch {
    throw Error(
      'Model connection failed or timed out; no interpretation produced.',
    );
  }
  if (!response.ok)
    throw Error(
      `Model service unavailable (${response.status}); no interpretation produced.`,
    );
  let data: {
    choices?: { finish_reason?: string; message?: { content?: unknown } }[];
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  };
  try {
    data = await response.json();
  } catch {
    throw Error('Model returned an invalid response.');
  }
  const choice = data?.choices?.[0];
  if (choice?.finish_reason !== 'stop')
    throw Error('Model did not return a completed interpretation.');
  const text =
    typeof choice.message?.content === 'string'
      ? choice.message.content.trim()
      : '';
  if (!text || text.length > 10000 || text.includes(config.key))
    throw Error('Model returned no usable interpretation.');
  const tokens = (value: unknown) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? value
      : null;
  return {
    taskId: brief.id,
    text,
    model: config.model,
    provider: 'SiliconFlow',
    generatedAt: new Date().toISOString(),
    usage: {
      prompt_tokens: tokens(data.usage?.prompt_tokens),
      completion_tokens: tokens(data.usage?.completion_tokens),
    },
    execution: 'llm-interpretation' as const,
    sourceDataHash: brief.dataHash,
  };
}
