import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionCookie,verifySession} from './session';
import {store} from './store';
import {listJobs,purgeJobs,type Job} from './jobs';
import {listKeys,revokeKeys} from './api-keys';
import type {AutoVisionUser,Organization} from './model';
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
// Deletion follows Cloud's admin console: preview what goes with the record, confirm by typing DELETE, then remove it for real.
// Anything that would silently break billing or the operator's own workspace is refused instead (HTTP 409).
export class DeletionBlocked extends Error{}
export type DeletionImpact={name:string;type:'organization'|'user';blocker:string|null;subtext:string;related:{name:string;items:string[]}[]};
async function organizationBlocker(org:Organization){
 if(org.id===await store.singleDeploymentOrgId())return 'The operator workspace cannot be deleted.';
 if((await store.subscriptions(org.id)).some(s=>s.stripeSubscriptionId&&s.status!=='canceled'))return `${org.name} has a Stripe subscription that is not canceled. Cancel it from the organization's billing page first so usage is invoiced and billing stops.`;
 return null;
}
export async function organizationDeletion(id:string):Promise<DeletionImpact|null>{
 const org=await store.organizationById(id);if(!org)return null;
 const [members,keys,jobs,blocker]=await Promise.all([store.membersOfOrg(id),listKeys(id),listJobs(id),organizationBlocker(org)]);
 return {name:org.name,type:'organization',blocker,subtext:'Members lose access immediately. API keys, jobs, usage records, settings and devices are deleted with it; the users themselves are kept.',related:[{name:'Members',items:members.map(m=>m.user.displayName)},{name:'API keys',items:keys.map(k=>k.label)},{name:'Recent jobs',items:jobs.length?[`${jobs.length} job${jobs.length===1?'':'s'}`]:[]}]};
}
export async function deleteOrganization(id:string){
 const org=await store.organizationById(id);if(!org)return false;
 const blocker=await organizationBlocker(org);if(blocker)throw new DeletionBlocked(blocker);
 await revokeKeys(id);await purgeJobs(id);
 return store.deleteOrganization(id);
}
// Like Cloud: an owned organization that other active members still use passes to one of them (an admin first, then
// the longest-standing member, who becomes admin); one nobody else uses is deleted with the user.
async function userPlan(id:string){
 const user=await store.userById(id);if(!user)return null;
 const memberships=await store.orgsForUser(id),transfer:{org:Organization;to:AutoVisionUser}[]=[],remove:Organization[]=[];let blocker:string|null=null;
 for(const {org} of memberships.filter(m=>m.org.ownerId===id)){
  const heir=(await store.membersOfOrg(org.id)).filter(m=>m.user.id!==id&&m.membership.status==='active'&&m.user.status==='active').sort((a,b)=>Number(b.membership.role==='admin')-Number(a.membership.role==='admin')||a.membership.createdAt.localeCompare(b.membership.createdAt))[0];
  if(heir)transfer.push({org,to:heir.user});else{remove.push(org);blocker??=await organizationBlocker(org)}
 }
 return {user,memberships,transfer,remove,blocker};
}
export async function userDeletion(id:string):Promise<DeletionImpact|null>{
 const plan=await userPlan(id);if(!plan)return null;
 return {name:plan.user.displayName,type:'user',blocker:plan.blocker,subtext:'Deleting this user also deletes the organizations they own that nobody else uses, with all of their API keys, jobs and usage. Shared organizations they own pass to another active member.',related:[{name:'Organizations deleted',items:plan.remove.map(o=>o.name)},{name:'Ownership transferred',items:plan.transfer.map(t=>`${t.org.name} → ${t.to.displayName}`)},{name:'Memberships removed',items:plan.memberships.filter(m=>!plan.remove.some(o=>o.id===m.org.id)).map(m=>m.org.name)}]};
}
export async function deleteUserAccount(id:string){
 const plan=await userPlan(id);if(!plan)return false;
 if(plan.blocker)throw new DeletionBlocked(plan.blocker);
 const now=new Date().toISOString();
 for(const {org} of plan.memberships)await store.deleteMembership(org.id,id);
 for(const {org,to} of plan.transfer){
  await store.putOrganization({...org,ownerId:to.id});
  const m=await store.membership(org.id,to.id);if(m&&m.role!=='admin')await store.putMembership({...m,role:'admin',updatedAt:now});
 }
 for(const org of plan.remove)await deleteOrganization(org.id);
 return store.deleteUser(id);
}
