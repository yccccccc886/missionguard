import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  applyPayment,
  runScenario,
  normalSteps,
  revokeDemo,
  withdrawDemo,
  parseAmount,
  scenarios,
} from '../lib/demo-engine.ts';
describe('browser demonstration model', () => {
  it('normal work spends 2.5 and returns 7.5', () => {
    let s = initialState();
    for (const r of normalSteps()) s = applyPayment(s, r);
    assert.equal(s.spent, 2500000);
    s = withdrawDemo(revokeDemo(s));
    assert.equal(s.withdrawn, 7500000);
    assert.equal(s.budget, s.spent + s.withdrawn);
  });
  for (const { id } of scenarios)
    it(`${id} blocks without charging the rejected payment`, () => {
      const s = runScenario(id);
      const event = s.events.at(-1)!;
      assert.equal(event.result, 'blocked');
      assert.equal(event.after, event.before);
      assert.ok(s.spent <= s.budget);
    });
  it('strict decimal input rejects unsafe and negative numbers', () => {
    for (const n of [
      '0',
      '-1',
      '1e3',
      'NaN',
      '1.0000001',
      'Infinity',
      '99999999999',
    ])
      assert.throws(() => parseAmount(n));
    assert.equal(parseAmount('0.000001'), 1);
  });
  it('failed descendant request does not charge the parent', () => {
    const s = initialState();
    s.agents[1].parent = 'search';
    s.agents[1].spent = s.agents[1].limit;
    const out = applyPayment(s, {
      agent: 'data',
      amount: 1,
      recipient: 'Data API',
      requestId: 'x',
    });
    assert.equal(out.agents[0].spent, 0);
    assert.equal(out.spent, 0);
  });
});
