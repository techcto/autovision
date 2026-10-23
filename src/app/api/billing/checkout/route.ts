import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {store} from '@/lib/store';
import {stripe} from '@/lib/stripe';
import {browserOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {withBillingLock} from '@/lib/billing-lock';
import {checkoutForWorkspace,CheckoutPending} from '@/lib/billing-checkout';

export async function POST(req:NextRequest){
 const session=await operator(req);
 if(!session||!['root','admin'].includes(session.role))return NextResponse.json({error:'forbidden'},{status:403});
 if(process.env.AUTOVISION_DEPLOYMENT_MODE!=='saas')return NextResponse.json({error:'Billing is disabled for private installs'},{status:409});
 let origin:string;try{origin=browserOrigin(req);}catch{return NextResponse.json({error:'Billing origin is not configured'},{status:503});}
 if(req.headers.get('origin')!==origin)return NextResponse.json({error:'forbidden'},{status:403});
 let productId:string;
 try{const input=JSON.parse(await readBody(req,2048));if(!input||typeof input.productId!=='string'||input.productId.length>128)throw Error();productId=input.productId;}catch{return NextResponse.json({error:'Invalid checkout request'},{status:400});}
 const product=(await store.products()).find(p=>p.id===productId&&p.active&&p.monthlyPrice>0);
 if(!product)return NextResponse.json({error:'Unknown paid plan'},{status:400});
 if(!product.stripePriceId||!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:'Billing is not configured'},{status:503});
 try{
  const result=await withBillingLock(session.orgId,async()=>{
   if((await store.subscriptions(session.orgId)).some(s=>s.stripeSubscriptionId&&s.status!=='canceled'))return NextResponse.json({error:'Manage your existing subscription before starting another plan'},{status:409});
   const client=stripe(),price=await client.prices.retrieve(product.stripePriceId,{expand:['product']});
   if(!price.active||price.currency!=='usd'||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||price.recurring.usage_type!=='licensed'||price.billing_scheme!=='per_unit'||price.unit_amount!==product.monthlyPrice*100)return NextResponse.json({error:'Stripe pricing does not match this plan'},{status:503});
   const logo=(price.product as {metadata?:Record<string,string>}).metadata?.logo_file;
   const metadata={orgId:session.orgId,productId:product.id};
   const checkout=await checkoutForWorkspace(session.orgId,{mode:'subscription',branding_settings:{display_name:'AutoVision',background_color:'#f5f7fa',...(logo?{logo:{type:'file',file:logo}}:{})},line_items:[{price:product.stripePriceId,quantity:1}],metadata,subscription_data:{metadata},success_url:origin+'/settings/billing?checkout=success',cancel_url:origin+'/settings/billing?checkout=canceled'},client);
   return NextResponse.json({url:checkout.url});
  });
  return result??NextResponse.json({error:'Billing is busy. Please retry.'},{status:409});
 }catch(error){return NextResponse.json({error:error instanceof CheckoutPending?error.message:'Unable to start checkout. Please try again.'},{status:error instanceof CheckoutPending?409:503});}
}
