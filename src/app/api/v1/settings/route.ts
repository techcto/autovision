import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {store} from '@/lib/store';
import {objectGroups,detectionPresets,validateObjectLabels} from '@/lib/detection-catalog';
import {enabledAiLabels} from '@/lib/ai-detections';
import {hasAllowedOrigin} from '@/lib/request-origin';
export async function GET(req:NextRequest){
 const s=await operator(req);if(!s)return NextResponse.json({error:'unauthorized'},{status:401});
 const settings=await store.settings(s.orgId);
 return NextResponse.json({...settings,objectDetection:settings.objectDetection??{labels:enabledAiLabels()},catalog:objectGroups,presets:detectionPresets,canEdit:['root','admin'].includes(s.role)},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(req:NextRequest){
 if(!hasAllowedOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const s=await operator(req);if(!s||!['root','admin'].includes(s.role))return NextResponse.json({error:'forbidden'},{status:403});
 try{
  const v=await req.json(),current=await store.settings(s.orgId);
  if(v.objectDetection!==undefined){const labels=validateObjectLabels(v.objectDetection?.labels);await store.putSettings(s.orgId,{...current,objectDetection:{labels},updatedAt:new Date().toISOString()});}
  else{if(typeof v.notifications?.recipients!=='string'||v.notifications.recipients.length>2000||typeof v.notifications.emailEnabled!=='boolean')throw Error();await store.putSettings(s.orgId,{...current,notifications:{...current.notifications,recipients:v.notifications.recipients,emailEnabled:v.notifications.emailEnabled},updatedAt:new Date().toISOString()});}
  return NextResponse.json({saved:true});
 }catch{return NextResponse.json({error:'Invalid settings or object labels'},{status:400});}
}

