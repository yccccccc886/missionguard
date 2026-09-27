import { createBrief } from '@/lib/research';
import { researchInput } from '@/lib/procurement';
import { apiError, loadBrief, saveBrief, smallBody } from '@/lib/task-store';
export async function POST(request: Request) {
  try {
    const { chainId, address } = researchInput(await smallBody(request));
    return Response.json(await saveBrief(await createBrief(chainId, address)), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(request: Request) {
  try {
    return Response.json(
      await loadBrief(new URL(request.url).searchParams.get('id') ?? ''),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e, 404);
  }
}
