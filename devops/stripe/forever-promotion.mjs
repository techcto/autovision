// Explicit opt-in only. Call with an application-specific Stripe account and a
// privately supplied code; never embed production redemption codes in source.
export async function ensureForeverPromotion(client, application, code) {
  if (!['autovision', 'smartdetector'].includes(application) || !/^[A-Z0-9_-]{3,40}$/.test(code)) throw Error('Invalid application or promotion code');
  const validCoupon = coupon => coupon && !coupon.deleted && coupon.valid && coupon.percent_off === 100 && coupon.duration === 'forever' && !coupon.applies_to?.products?.length && !coupon.redeem_by && !coupon.max_redemptions;
  const matches = (await client.promotionCodes.list({ code, limit: 100 })).data;
  let promotion = matches.find(p => p.code.toUpperCase() === code);
  if (promotion) {
    const ref = promotion.promotion?.coupon;
    const coupon = typeof ref === 'string' ? await client.coupons.retrieve(ref) : ref;
    if (!promotion.active || promotion.expires_at || promotion.max_redemptions || promotion.customer || promotion.restrictions?.first_time_transaction || promotion.restrictions?.minimum_amount || !validCoupon(coupon)) throw Error('Existing promotion conflicts with unrestricted 100% forever terms');
    return { promotion, coupon };
  }
  const id = `${application}_${code.toLowerCase()}_forever`;
  let coupon;
  try { coupon = await client.coupons.retrieve(id); }
  catch (error) {
    if (error.code !== 'resource_missing') throw error;
    coupon = await client.coupons.create({ id, name: `${application} 100% discount`, percent_off: 100, duration: 'forever', metadata: { application } }, { idempotencyKey: `${id}_create` });
  }
  if (!validCoupon(coupon)) throw Error('Existing coupon conflicts with unrestricted 100% forever terms');
  promotion = await client.promotionCodes.create({ code, promotion: { type: 'coupon', coupon: id }, metadata: { application } }, { idempotencyKey: `${id}_promotion_create` });
  return { promotion, coupon };
}
