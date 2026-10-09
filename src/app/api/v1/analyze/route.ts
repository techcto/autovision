import {authenticateKey} from '@/lib/api-keys';
import {runJob} from '@/lib/run-job';
import {readBoundedJson, validateAnalysis, MediaError} from '@/lib/media-contract';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const key = await authenticateKey(request.headers.get('authorization'));
    if (!key) return Response.json({error:'invalid API key'},{status:401});
    const input = validateAnalysis(await readBoundedJson(request));
    return Response.json(await runJob(key.tenantId,{kind:'api_key',id:key.hash.slice(0,12),label:key.label},'rest',input),{headers:{'Cache-Control':'no-store'}});
  } catch (e) {return Response.json({error:e instanceof MediaError?e.message:'Analysis unavailable'}, {status:e instanceof MediaError?e.status:503});}
}
