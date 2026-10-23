import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensureForeverPromotion} from './forever-promotion.mjs';
test('forever promotion is opt-in, idempotent and unrestricted across app charges',async()=>{
 const coupons=new Map(),codes=[];const client={coupons:{retrieve:async id=>{if(!coupons.has(id))throw Object.assign(Error('missing'),{code:'resource_missing'});return coupons.get(id);},create:async input=>{const c={...input,valid:true};coupons.set(c.id,c);return c;}},promotionCodes:{list:async()=>({data:codes}),create:async input=>{const p={...input,id:'promo_local',active:true};codes.push(p);return p;}}};
 await assert.rejects(ensureForeverPromotion(client,'other','TEST100'),/Invalid/);assert.equal(codes.length,0);
 const first=await ensureForeverPromotion(client,'autovision','TEST100');assert.equal(first.coupon.duration,'forever');assert.equal(first.coupon.percent_off,100);assert.equal(first.coupon.applies_to,undefined);
 assert.deepEqual(await ensureForeverPromotion(client,'autovision','TEST100'),first);assert.equal(coupons.size,1);assert.equal(codes.length,1);
 codes[0].restrictions={first_time_transaction:true};await assert.rejects(ensureForeverPromotion(client,'autovision','TEST100'),/conflicts/);
 codes[0].restrictions={};first.coupon.duration='once';await assert.rejects(ensureForeverPromotion(client,'autovision','TEST100'),/conflicts/);
});
