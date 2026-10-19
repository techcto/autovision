import {notFound} from 'next/navigation';
import {adminDate,jobSummary,rootSession,saasMode} from '@/lib/admin';
import {listJobs} from '@/lib/jobs';
import {store} from '@/lib/store';
import {Avatar,Card,DataTable,Entity,Facts,PageHeader,PrivacyNote,Status} from '../../admin-ui';
import JobsTable from '../../jobs-table';
export default async function AdminUser({params}:{params:Promise<{id:string}>}){
 await rootSession();if(!saasMode())notFound();
 const {id}=await params,user=await store.userById(id);if(!user)notFound();
 const organizations=await Promise.all((await store.orgsForUser(id)).map(async ({org,membership})=>({org,membership,jobs:(await listJobs(org.id)).filter(j=>j.actor.kind==='user'&&j.actor.id===id).map(j=>({...jobSummary(j),organization:org.name}))})));
 const jobs=organizations.flatMap(o=>o.jobs).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return <><PageHeader crumb={{href:'/admin/users',label:'Users'}} title={user.displayName} description={user.username} avatar={<Avatar name={user.displayName} large/>} actions={<Status value={user.status}/>}/>
 <PrivacyNote>only account details and job status are shown. Uploaded images, frames, detections, and summaries stay private to the user&apos;s organizations.</PrivacyNote>
 <Card title="Account"><Facts items={[['Username',user.username],['Joined',adminDate(user.createdAt)],['Organizations',organizations.length],['Recent jobs run',jobs.length]]}/></Card>
 <Card title="Organizations"><DataTable head={['Organization','Role','Access','Jobs run']} empty="No organizations." count={organizations.length}>{organizations.map(({org,membership,jobs})=><tr key={org.id}><td><Entity href={`/admin/organizations/${org.id}`} name={org.name} sub={org.orgType}/></td><td>{membership.role}</td><td><Status value={membership.status}/></td><td>{jobs.length}</td></tr>)}</DataTable></Card>
 <Card title="Jobs run by this user"><JobsTable jobs={jobs}/></Card></>;
}
