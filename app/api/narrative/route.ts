import { env } from 'cloudflare:workers';
import { apiError, bucket, loadBrief, smallBody } from '@/lib/task-store';
import { hashJson } from '@/lib/procurement';

function config() {
  const values = env as unknown as {
    LLM_ENABLED?: string;
    SILICONFLOW_API_KEY?: string;
    SILICONFLOW_MODEL?: string;
  };
  return {
    enabled:
      values.LLM_ENABLED === 'true' &&
      !!values.SILICONFLOW_API_KEY &&
      !!values.SILICONFLOW_MODEL,
    key: values.SILICONFLOW_API_KEY,
    model: values.SILICONFLOW_MODEL,
  };
}
export function GET() {
  const c = config();
  return Response.json(
    {
      enabled: c.enabled,
      provider: 'SiliconFlow',
      model: c.enabled ? c.model : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(request: Request) {
  try {
    const c = config();
    if (!c.enabled)
      return Response.json(
        {
          error:
            '尚未配置模型。真实数据报告仍然可用。 / Model not configured; data reports remain available.',
        },
        { status: 503 },
      );
    // Public visitors may inspect reports, but cannot spend the owner's model quota.
    if (!request.headers.get('oai-authenticated-user-id'))
      return Response.json(
        { error: 'Sign in to request model interpretation.' },
        { status: 401 },
      );
    const input = (await smallBody(request)) as {
      taskId?: string;
      language?: string;
    };
    if (!input.taskId || !['zh', 'en'].includes(input.language ?? ''))
      throw Error('Invalid request');
    const brief = await loadBrief(input.taskId);
    const cacheKey = `narratives/${hashJson({ id: brief.id, language: input.language, model: c.model })}.json`;
    const existing = await bucket().get(cacheKey);
    if (existing) return Response.json(await existing.json());
    // Only bounded public facts are sent. The model has no transaction tool or key.
    const facts = {
      contract: brief.spec.address,
      chain: brief.spec.chainId,
      blocks: [brief.spec.fromBlock, brief.spec.toBlock],
      time: [brief.startTime, brief.endTime],
      emittedLogs: brief.eventCount,
      distinctTransactionsWithLogs: brief.transactionCount,
      verification: 'same RPC, two pinned-range reads matched',
    };
    const response = await fetch(
      'https://api.siliconflow.cn/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.key}`,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: c.model,
          max_tokens: 500,
          temperature: 0.1,
          stream: false,
          messages: [
            {
              role: 'system',
              content: `Explain the supplied blockchain observation in ${input.language === 'zh' ? 'Chinese' : 'English'} in at most 150 words. Use only provided facts. Explain why log count is not all calls or users. State that this is a short observation window and a same-provider reread, not a security audit. No investment advice. No invented fees, payments, risks, trends or people. Return plain text.`,
            },
            { role: 'user', content: JSON.stringify(facts) },
          ],
        }),
      },
    );
    if (!response.ok)
      throw Error(
        `Model service unavailable (${response.status}); no interpretation produced.`,
      );
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || text.length > 10000)
      throw Error('Model returned no usable interpretation.');
    const result = {
      taskId: brief.id,
      text,
      model: c.model,
      provider: 'SiliconFlow',
      generatedAt: new Date().toISOString(),
      usage: data.usage ?? null,
      execution: 'llm-interpretation',
      sourceDataHash: brief.dataHash,
    };
    await bucket().put(cacheKey, JSON.stringify(result), {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    return Response.json(result);
  } catch (e) {
    return apiError(e);
  }
}
