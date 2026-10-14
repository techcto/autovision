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
        recurring: { usage_type: 'licensed', ...value.recurring, interval_count: 1 } }; prices.push(p); return p; },
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

test('overage prices are metered on the meters, only created with amounts, and reused on rerun', async () => {
  const products = new Map(), prices = [], meters = [];
  const client = {
    products: {
      retrieve: async id => { if (!products.has(id)) throw Object.assign(new Error('missing'), { code: 'resource_missing' }); return products.get(id); },
      create: async value => { const p = { ...value, active: true }; products.set(p.id, p); return p; },
    },
    prices: {
      list: async ({ lookup_keys }) => ({ data: prices.filter(p => lookup_keys.includes(p.lookup_key)) }),
      create: async value => { const p = { ...value, id: `price_${prices.length}`, active: true,
        recurring: { usage_type: 'licensed', ...value.recurring, interval_count: 1 } }; prices.push(p); return p; },
    },
    billing: { meters: {
      list: async function* () { yield* meters; },
      create: async value => { const m = { ...value, id: `mtr_${meters.length}`, status: 'active' }; meters.push(m); return m; },
    } },
  };
  const plain = await setup(client);
  assert.equal(plain.STRIPE_IMAGE_OVERAGE_PRICE_ID, undefined);
  const amounts = { AUTOVISION_IMAGE_OVERAGE_UNIT_CENTS: '0.5' };
  const first = await setup(client, amounts);
  const price = prices.find(p => p.id === first.STRIPE_IMAGE_OVERAGE_PRICE_ID);
  assert.equal(price.recurring.usage_type, 'metered');
  assert.equal(price.recurring.meter, first.autovision_image_units_v1);
  assert.equal(price.unit_amount_decimal, '0.5');
  assert.equal(first.STRIPE_AI_OVERAGE_PRICE_ID, undefined);
  assert.deepEqual(await setup(client, amounts), first);
  await assert.rejects(setup(client, { AUTOVISION_IMAGE_OVERAGE_UNIT_CENTS: 'abc' }), /Invalid/);
});
