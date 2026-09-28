import { env } from 'cloudflare:workers';
import { apiError, bucket, loadBrief, smallBody } from '@/lib/task-store';
import { hashJson } from '@/lib/procurement';
import { narrativeVersion, requestNarrative } from '@/lib/narrative';

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
    if (!input.taskId || (input.language !== 'zh' && input.language !== 'en'))
      throw Error('Invalid request');
    const brief = await loadBrief(input.taskId);
    const cacheKey = `narratives/${hashJson({ id: brief.id, language: input.language, model: c.model, version: narrativeVersion })}.json`;
    const existing = await bucket().get(cacheKey);
    if (existing) return Response.json(await existing.json());
    const result = await requestNarrative(brief, input.language, {
      key: c.key!,
      model: c.model!,
    });
    await bucket().put(cacheKey, JSON.stringify(result), {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    const saved = await bucket().get(cacheKey);
    if (!saved)
      throw Error('Interpretation storage unavailable; please retry.');
    return Response.json(await saved.json());
  } catch (e) {
    return apiError(e);
  }
}
