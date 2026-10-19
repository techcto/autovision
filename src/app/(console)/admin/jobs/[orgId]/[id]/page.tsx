import Link from 'next/link';
import {notFound} from 'next/navigation';
import {adminDateTime,jobSummary,rootSession,saasMode} from '@/lib/admin';
import {getJob} from '@/lib/jobs';
import {store} from '@/lib/store';
import {Card,Facts,PageHeader,PrivacyNote,Status} from '../../../admin-ui';
import {jobDuration} from '../../../jobs-table';
export default async function AdminJob({params}:{params:Promise<{orgId:string;id:string}>}){
 await rootSession();if(!saasMode())notFound();
 const {orgId,id}=await params,[org,job]=await Promise.all([store.organizationById(orgId),getJob(orgId,id)]);if(!org||!job)notFound();
 const j=jobSummary(job),runBy=j.actor.kind==='user'?<Link href={`/admin/users/${j.actor.id}`}>{j.actor.label}</Link>:<>{j.actor.label} <span className="muted">(API key)</span></>;
 return <><PageHeader crumb={{href:'/admin/jobs',label:'Jobs'}} title={<>Job <code>{j.id.slice(0,8)}</code></>} description={<Link href={`/admin/organizations/${org.id}`}>{org.name}</Link>} actions={<Status value={j.status}/>}/>
 <PrivacyNote>only job status is shown. Uploaded images, frames, detections, and summaries stay private to the organization.</PrivacyNote>
 <Card title="Status"><Facts items={[['Status',<Status key="s" value={j.status}/>],['Organization',<Link key="o" href={`/admin/organizations/${org.id}`}>{org.name}</Link>],['Source',j.source],['Run by',runBy],['Frames',j.frameCount],['Duration',jobDuration(j.durationMs)],['Started',adminDateTime(j.createdAt)],['Expires',adminDateTime(j.expiresAt)],['Job ID',<code key="id">{j.id}</code>]]}/>{j.error&&<p className="admin-error" role="alert">{j.error}</p>}</Card></>;
}
