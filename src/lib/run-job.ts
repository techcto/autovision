import {consume} from './api-keys';
import {AnalysisInput,MediaError} from './media-contract';
import {analyzeMedia} from './media-analysis';
import {Actor,Job,newJob,saveJob} from './jobs';
export async function runJob(orgId:string,actor:Actor,source:Job['source'],input:AnalysisInput){
  if(!await consume(orgId,input.frames.length))throw new MediaError('Monthly image quota reached',429);
  const job=newJob(orgId,actor,source,input.frames.length),start=Date.now();await saveJob(job);
  try{const result=await analyzeMedia(input);const thumbnail=result.thumbnail as string|undefined;delete result.thumbnail;result.privacy={...result.privacy,job_retention_days:7,thumbnail_stored:!!thumbnail};await saveJob({...job,status:'complete',durationMs:Date.now()-start,thumbnail,result});return{...result,job_id:job.id};}
  catch(e){await saveJob({...job,status:'failed',durationMs:Date.now()-start,error:e instanceof MediaError?e.message:'Analysis failed'});throw e;}
}
