import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionCookie,verifySession} from './session';
import {store} from './store';
import {listJobs,type Job} from './jobs';
import type {AutoVisionUser} from './model';
export const saasMode=()=>process.env.AUTOVISION_DEPLOYMENT_MODE==='saas';
// Layouts are not re-rendered on every navigation, so each admin page calls this itself.
export async function rootSession(){const s=await verifySession((await cookies()).get(sessionCookie)?.value,process.env.AUTOVISION_SESSION_SECRET??'');if(!s)redirect('/login');if(s.role!=='root')redirect('/settings');return s}
// Admin views expose job status only: never thumbnails, frames, detections, or summaries.
export type JobSummary={id:string;orgId:string;status:Job['status'];source:Job['source'];actor:Job['actor'];frameCount:number;durationMs?:number;error?:string;createdAt:string;expiresAt:string};
export const jobSummary=(j:Job):JobSummary=>({id:j.id,orgId:j.orgId,status:j.status,source:j.source,actor:j.actor,frameCount:j.frameCount,durationMs:j.durationMs,error:j.error,createdAt:j.createdAt,expiresAt:new Date(j.ttl*1000).toISOString()});
export async function directoryJobs(){
 const orgs=await store.organizations();
 return (await Promise.all(orgs.map(async org=>(await listJobs(org.id)).map(j=>({...jobSummary(j),organization:org.name}))))).flat().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export const jobCounts=(jobs:{status:Job['status']}[])=>({complete:jobs.filter(j=>j.status==='complete').length,failed:jobs.filter(j=>j.status==='failed').length,running:jobs.filter(j=>j.status==='running').length});
// Users are indexed by username only, so the directory is built from organization memberships.
export async function directoryUsers(){
 const users=new Map<string,{user:AutoVisionUser;organizations:number}>();
 for(const members of await Promise.all((await store.organizations()).map(o=>store.membersOfOrg(o.id))))for(const {user} of members)users.set(user.id,{user,organizations:(users.get(user.id)?.organizations??0)+1});
 return [...users.values()].sort((a,b)=>a.user.displayName.localeCompare(b.user.displayName));
}
export const adminDate=(v?:string)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}):'—';
export const adminDateTime=(v?:string)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
