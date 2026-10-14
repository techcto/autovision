import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './setup-plans.mjs';

test('setup reuses plans and meters without duplicating resources', async () => {
  const products = new Map(), prices = [], meters = [];
  const client = {
    products: {
      retrieve: async id => { if (!products.has(id)) throw Object.assign(new Error('missing'), { code: 'resource_missing' }); return products.get(id); },
      create: async value => { const p = { ...value, active: true }; products.set(p.id, p); return p; },
    },
    prices: {
      list: async ({ lookup_keys }) => ({ data: prices.filter(p => lookup_keys.includes(p.lookup_key)) }),
      create: async value => { const p = { ...value, id: `price_${prices.length}`, active: true,
        recurring: { ...value.recurring, interval_count: 1, usage_type: 'licensed' } }; prices.push(p); return p; },
    },
    billing: { meters: {
      list: async function* () { yield* meters; },
      create: async value => { const m = { ...value, id: `mtr_${meters.length}`, status: 'active' }; meters.push(m); return m; },
    } },
  };
  const first = await setup(client);
  assert.deepEqual(await setup(client), first);
  assert.equal(products.size, 2);
  assert.equal(prices.length, 2);
  assert.equal(meters.length, 2);
  prices[0].unit_amount = 1;
  await assert.rejects(setup(client), /Price conflict/);
});
