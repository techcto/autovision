import {authenticateKey,consume} from '@/lib/api-keys';
import {readBoundedJson,validateAnalysis,MediaError} from '@/lib/media-contract';
export const runtime='nodejs';
/** Separate from runJob: biometric measurements must never enter saved jobs. */
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 try{
  const key=await authenticateKey(request.headers.get('authorization'));
  if(!key)return Response.json({error:'Invalid API key'},{status:401,headers});
  const input=validateAnalysis(await readBoundedJson(request));
  if(input.classify)throw new MediaError('Face measurements do not use AI scene classification',400);
  if(!await consume(key.tenantId,input.frames.length))return Response.json({error:'Image quota exceeded'},{status:429,headers});
  const result=await fetch((process.env.AUTOVISION_VISION_URL??'http://localhost:8000')+'/faces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({frames:input.frames}),signal:AbortSignal.timeout(45000),redirect:'error'});
  if(!result.ok)return Response.json({error:'Face measurements unavailable'},{status:result.status===400?400:503,headers});
  return Response.json(await result.json(),{headers});
 }catch(e){return Response.json({error:e instanceof MediaError?e.message:'Face measurements unavailable'},{status:e instanceof MediaError?e.status:503,headers});}
}
