import {NextRequest} from 'next/server';import {operator} from '@/lib/operator';import {listJobs,purgeJobs} from '@/lib/jobs';
import {hasAllowedOrigin} from '@/lib/request-origin';
export async function DELETE(request:NextRequest){
 if(!hasAllowedOrigin(request))return Response.json({error:'Invalid origin'},{status:403});
 const s=await operator(request);if(!s||!['root','admin'].includes(s.role))return Response.json({error:'forbidden'},{status:403});
 try{const value=await request.json();if(value.confirmation!=='CLEAR HISTORY')return Response.json({error:'Confirmation required'},{status:400});return Response.json({deleted:await purgeJobs(s.orgId)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Could not clear all history; retry safely'},{status:503});}
}
export async function GET(request:NextRequest){const s=await operator(request);if(!s)return Response.json({error:'unauthorized'},{status:401});return Response.json(await listJobs(s.orgId),{headers:{'Cache-Control':'no-store'}});}
