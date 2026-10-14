import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {store} from '@/lib/store';
import {objectGroups,detectionPresets,validateObjectLabels} from '@/lib/detection-catalog';
import {enabledAiLabels} from '@/lib/ai-detections';
import {hasAllowedOrigin} from '@/lib/request-origin';
import {defaultInspection,validateInspection} from '@/lib/inspection-config';
import {approvedModels,visionLenses} from '@/lib/vision-lenses';
import {attachOveragePrices,validateBilling} from '@/lib/usage-billing';
import {stripe} from '@/lib/stripe';
export async function GET(req:NextRequest){
 const s=await operator(req);if(!s)return NextResponse.json({error:'unauthorized'},{status:401});
 const settings=await store.settings(s.orgId);
 let models:ReturnType<typeof approvedModels>=[];
 try{models=approvedModels();}catch{/* Invalid deployment registry: show no approved models so the page still loads. */}
 return NextResponse.json({...settings,inspection:settings.inspection??defaultInspection,inspectionModels:models.map(m=>({id:m.id,label:m.label,skills:m.skills})),lenses:visionLenses,inspectionModelAvailable:models.some(m=>m.skills.includes('planning')),objectDetection:settings.objectDetection??{labels:enabledAiLabels()},catalog:objectGroups,presets:detectionPresets,canEdit:['root','admin'].includes(s.role)},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(req:NextRequest){
 if(!hasAllowedOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const s=await operator(req);if(!s||!['root','admin'].includes(s.role))return NextResponse.json({error:'forbidden'},{status:403});
 try{
  const v=await req.json(),current=await store.settings(s.orgId);
  if(v.objectDetection!==undefined||v.inspection!==undefined){const labels=v.objectDetection===undefined?current.objectDetection?.labels:validateObjectLabels(v.objectDetection?.labels);const inspection=v.inspection===undefined?current.inspection:validateInspection(v.inspection,['deployment_default',...approvedModels().map(m=>m.id)]);await store.putSettings(s.orgId,{...current,...(labels?{objectDetection:{labels}}:{}),inspection,updatedAt:new Date().toISOString()});}
  // Opting in attaches the overage prices to the Stripe subscription first; the setting is saved only if that succeeds.
  else if(v.billing!==undefined){if(process.env.AUTOVISION_DEPLOYMENT_MODE!=='saas')return NextResponse.json({error:'Billing is disabled for private installs'},{status:409});const subscription=await store.activeSubscriptionForOrg(s.orgId);let billing;try{billing=validateBilling(v.billing,subscription)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid billing settings'},{status:400})}if(billing.overageEnabled){try{await attachOveragePrices(subscription!,stripe())}catch{return NextResponse.json({error:'Stripe could not add the overage price to this subscription'},{status:502})}}await store.putSettings(s.orgId,{...current,billing,updatedAt:new Date().toISOString()})}
  else{if(typeof v.notifications?.recipients!=='string'||v.notifications.recipients.length>2000||typeof v.notifications.emailEnabled!=='boolean')throw Error();await store.putSettings(s.orgId,{...current,notifications:{...current.notifications,recipients:v.notifications.recipients,emailEnabled:v.notifications.emailEnabled},updatedAt:new Date().toISOString()});}
  return NextResponse.json({saved:true});
 }catch{return NextResponse.json({error:'Invalid settings or object labels'},{status:400});}
}

