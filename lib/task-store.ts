import { env } from 'cloudflare:workers';
import type { Brief } from './procurement';
import recordedExample from '../public/evidence/research-example.json';

export function bucket(): R2Bucket {
  const store = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!store)
    throw Error('任务存储未就绪，请稍后重试。 / Task storage unavailable.');
  return store;
}
export async function loadBrief(id: string): Promise<Brief> {
  if (!/^0x[0-9a-f]{64}$/.test(id)) throw Error('Invalid task ID');
  const item = await bucket().get(`tasks/${id}.json`);
  if (!item && id === recordedExample.id) return recordedExample as Brief;
  if (!item) throw Error('任务不存在。 / Task not found.');
  return item.json<Brief>();
}
export async function saveBrief(brief: Brief): Promise<Brief> {
  await bucket().put(`tasks/${brief.id}.json`, JSON.stringify(brief), {
    httpMetadata: { contentType: 'application/json' },
    onlyIf: { etagDoesNotMatch: '*' },
  });
  return loadBrief(brief.id);
}
export function apiError(error: unknown, status = 503): Response {
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message.slice(0, 240)
          : 'Service unavailable',
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function smallBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length') ?? 0) > 4096)
    throw Error('Request too large');
  const text = await request.text();
  if (text.length > 4096) throw Error('Request too large');
  return JSON.parse(text);
}
