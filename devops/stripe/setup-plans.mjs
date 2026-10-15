import { readFileSync } from 'node:fs';
import Stripe from 'stripe';

export const plans = [
  { id: 'starter', name: 'AutoVision Starter', cents: 4900, images: 10000, env: 'STRIPE_STARTER_PRICE_ID' },
  { id: 'scale', name: 'AutoVision Scale', cents: 19900, images: 100000, env: 'STRIPE_SCALE_PRICE_ID' },
];
// Shown in the Checkout order summary. Keep descriptions factual: what the plan includes, nothing promised beyond the app.
const describe = images => `Up to ${images.toLocaleString('en-US')} images per month: OpenCV 5 object and motion detection, sampled video timelines, optional AI scene summaries, and REST and MCP API access. Cancel anytime.`;
export const meters = ['autovision_image_units_v1', 'autovision_ai_credits_v1'];
// Per-unit overage prices on the meters. Only created when an amount (USD cents, decimals allowed) is supplied.
export const overage = [
  { id: 'images', name: 'AutoVision image overage', description: 'Per image beyond your plan allowance, only after you opt in. Billed monthly in arrears.', meter: 'autovision_image_units_v1', env: 'STRIPE_IMAGE_OVERAGE_PRICE_ID', amountEnv: 'AUTOVISION_IMAGE_OVERAGE_UNIT_CENTS' },
  { id: 'ai_credits', name: 'AutoVision AI credit overage', description: 'Per AI credit beyond your plan allowance, only after you opt in. Billed monthly in arrears.', meter: 'autovision_ai_credits_v1', env: 'STRIPE_AI_OVERAGE_PRICE_ID', amountEnv: 'AUTOVISION_AI_CREDIT_UNIT_CENTS' },
];

// Creates or reuses a product and keeps its Checkout display (name, description, image) current. Prices are never changed here.
async function ensureProduct(client, id, display, metadata, image) {
  let product;
  try { product = await client.products.retrieve(id); }
  catch (error) {
    if (error.code !== 'resource_missing') throw error;
    product = await client.products.create({ id, ...display, metadata }, { idempotencyKey: `${id}_create` });
  }
  if (product.deleted || !product.active) throw new Error(`Unavailable product: ${id}`);
  // Checkout branding needs the logo as a Stripe file ID (logo_file); the product image needs its public link.
  const logo = product.images?.length && product.metadata?.logo_file ? undefined : await image?.();
  if (product.name !== display.name || product.description !== display.description || logo)
    product = await client.products.update(id, { ...display, ...(logo ? { images: [logo.url], metadata: { ...product.metadata, logo_file: logo.file } } : {}) });
  return product;
}

// image: optional { data, name } uploaded once to Stripe and used as the product image via a public file link.
export async function setup(client, amounts = {}, image) {
  const output = {};let imageUrl;
  const productImage = image && (async () => imageUrl ??= await (async () => { const file = (await client.files.create({ purpose: 'business_logo', file: { data: image.data, name: image.name, type: 'application/octet-stream' } })).id; return { file, url: (await client.fileLinks.create({ file })).url }; })());
  for (const plan of plans) {
    const id = `autovision_${plan.id}_v1`;
    await ensureProduct(client, id, { name: plan.name, description: describe(plan.images) }, { application: 'autovision', included_image_units: String(plan.images) }, productImage);
    const lookup_key = `${id}_usd_monthly`;
    let price = (await client.prices.list({ lookup_keys: [lookup_key], limit: 2 })).data[0];
    if (price && (!price.active || price.product !== id || price.currency !== 'usd' ||
      price.unit_amount !== plan.cents || price.recurring?.interval !== 'month' ||
      price.recurring?.interval_count !== 1 || price.recurring?.usage_type !== 'licensed')) {
      throw new Error(`Price conflict: ${lookup_key}; review manually`);
    }
    if (!price) price = await client.prices.create({ product: id, currency: 'usd',
      unit_amount: plan.cents, recurring: { interval: 'month' }, lookup_key },
    { idempotencyKey: `${lookup_key}_create` });
    output[plan.env] = price.id;
  }
  const existing = [];
  for await (const meter of client.billing.meters.list({ limit: 100 })) existing.push(meter);
  for (const event_name of meters) {
    let meter = existing.find(item => item.event_name === event_name);
    if (meter && (meter.status !== 'active' || meter.default_aggregation.formula !== 'sum' ||
      meter.customer_mapping.type !== 'by_id' || meter.customer_mapping.event_payload_key !== 'stripe_customer_id' ||
      meter.value_settings.event_payload_key !== 'value')) throw new Error(`Meter conflict: ${event_name}`);
    if (!meter) meter = await client.billing.meters.create({ event_name, display_name: event_name,
      default_aggregation: { formula: 'sum' }, customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
      value_settings: { event_payload_key: 'value' } }, { idempotencyKey: `${event_name}_create` });
    output[event_name] = meter.id;
  }
  for (const o of overage) {
    const amount = amounts[o.amountEnv];
    if (amount === undefined || amount === '') continue;
    if (!/^\d{1,6}(\.\d{1,12})?$/.test(amount)) throw new Error(`Invalid ${o.amountEnv}; use USD cents, e.g. 0.5`);
    const id = `autovision_overage_${o.id}_v1`;
    await ensureProduct(client, id, { name: o.name, description: o.description }, { application: 'autovision', meter: o.meter }, productImage);
    const lookup_key = `${id}_usd_metered_${amount.replace('.', '_')}`;
    let price = (await client.prices.list({ lookup_keys: [lookup_key], limit: 2 })).data[0];
    // stripe-node returns unit_amount_decimal as a Decimal object; compare its string form.
    if (price && (!price.active || price.product !== id || price.currency !== 'usd' || String(price.unit_amount_decimal) !== amount ||
      price.recurring?.usage_type !== 'metered' || price.recurring?.meter !== output[o.meter])) throw new Error(`Price conflict: ${lookup_key}; review manually`);
    if (!price) price = await client.prices.create({ product: id, currency: 'usd', unit_amount_decimal: amount,
      recurring: { interval: 'month', usage_type: 'metered', meter: output[o.meter] }, lookup_key }, { idempotencyKey: `${lookup_key}_create` });
    output[o.env] = price.id;
  }
  return output;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--live'].includes(arg))) throw new Error('Usage: setup-plans.mjs [--apply [--live]]');
  if (!args.includes('--apply')) console.log(JSON.stringify({ mode: 'offline preview', plans, meters,
    overage, overages: 'metered prices only when AUTOVISION_IMAGE_OVERAGE_UNIT_CENTS / AUTOVISION_AI_CREDIT_UNIT_CENTS are set; export stays off until AUTOVISION_USAGE_EXPORT=enabled' }, null, 2));
  else {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || !/^(sk|rk)_(test|live)_/.test(key)) throw new Error('A Stripe secret or restricted key is required');
    if (key.includes('_live_') && !args.includes('--live')) throw new Error('Live setup requires --apply --live');
    const logo = new URL('../../public/autovision-logo-marketplace-640.png', import.meta.url);
    console.log(JSON.stringify(await setup(new Stripe(key), process.env, { data: readFileSync(logo), name: 'autovision-logo.png' }), null, 2));
  }
}
