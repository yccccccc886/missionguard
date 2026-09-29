import { it } from 'node:test';
import assert from 'node:assert/strict';
import { requestNarrative } from '../lib/narrative';
import sample from '../public/evidence/research-example.json';
import type { Brief } from '../lib/procurement';
const brief = sample as Brief;
const config = { key: 'test-key-never-real', model: 'test/model' };
const completed = (content: unknown, finish_reason = 'stop') =>
  Response.json({
    choices: [{ finish_reason, message: { content } }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 80,
      unexpected: 'not-exported',
    },
  });
it('model adapter sends only bounded public facts and has no transaction tools', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.siliconflow.cn/v1/chat/completions');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.max_tokens, 500);
    assert.equal(body.tools, undefined);
    assert.equal(body.model, config.model);
    assert.equal(String(init?.body).includes(config.key), false);
    const facts = JSON.parse(body.messages[1].content);
    assert.equal(facts.emittedLogs, brief.eventCount);
    assert.equal(facts.networkName, 'Avalanche C-Chain');
    assert.match(facts.measurementLimits, /not all contract calls or unique users/);
    assert.equal(facts.events, undefined);
    return completed('161 logs across 85 transactions; this is not an audit.');
  };
  const result = await requestNarrative(brief, 'en', config, fetcher);
  assert.equal(calls, 1);
  assert.equal(result.sourceDataHash, brief.dataHash);
  assert.deepEqual(result.usage, { prompt_tokens: 100, completion_tokens: 80 });
});
it('rate limits and transport failures never trigger a paid fallback or fake result', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      requestNarrative(brief, 'zh', config, async () => {
        calls++;
        return new Response('provider error', { status: 429 });
      }),
    /429/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    () =>
      requestNarrative(brief, 'zh', config, async () => {
        throw Error(config.key);
      }),
    (e: Error) =>
      !e.message.includes(config.key) && /connection failed/.test(e.message),
  );
});
it('truncated, malformed, empty and key-bearing responses are rejected', async () => {
  for (const [text, reason] of [
    ['partial', 'length'],
    ['', 'stop'],
    [null, 'stop'],
    [config.key, 'stop'],
  ] as const)
    await assert.rejects(() =>
      requestNarrative(brief, 'zh', config, async () =>
        completed(text, reason),
      ),
    );
  await assert.rejects(() =>
    requestNarrative(
      brief,
      'zh',
      config,
      async () => new Response('invalid json'),
    ),
  );
});
