import {NextRequest} from 'next/server';import {operator} from '@/lib/operator';import {listJobs} from '@/lib/jobs';
export async function GET(request:NextRequest){const s=await operator(request);if(!s)return Response.json({error:'unauthorized'},{status:401});return Response.json(await listJobs(s.orgId),{headers:{'Cache-Control':'no-store'}});}
