import {notFound} from 'next/navigation';
import {adminDate,jobCounts,jobSummary,rootSession,saasMode} from '@/lib/admin';
import {listJobs} from '@/lib/jobs';
import {store} from '@/lib/store';
import {Avatar,Card,DataTable,Entity,Facts,PageHeader,PrivacyNote,Status} from '../../admin-ui';
import JobsTable from '../../jobs-table';
import OpenOrganization from '../../open-organization';
export default async function AdminOrganization({params}:{params:Promise<{id:string}>}){
 await rootSession();if(!saasMode())notFound();
 const {id}=await params,org=await store.organizationById(id);if(!org)notFound();
 const [members,jobs,subscription,products]=await Promise.all([store.membersOfOrg(id),listJobs(id),store.activeSubscriptionForOrg(id),store.products()]);
 const plan=products.find(p=>p.id===subscription?.productId)?.name??'Dev',counts=jobCounts(jobs);
 return <><PageHeader crumb={{href:'/admin/organizations',label:'Organizations'}} title={org.name} description={org.contactEmail??org.slug} avatar={<Avatar name={org.name} large/>} actions={<OpenOrganization orgId={org.id}/>}/>
 <PrivacyNote>images, frames, detections, summaries, and API keys stay inside the organization and are not shown here.</PrivacyNote>
 <Card title="Overview"><Facts items={[['Type',org.orgType],['Plan',plan+(subscription?` · ${subscription.status}`:'')],['Contact phone',org.contactPhone??'—'],['Created',adminDate(org.createdAt)],['Recent jobs',`${counts.complete} complete · ${counts.failed} failed · ${counts.running} running`]]}/></Card>
 <Card title="Members"><DataTable head={['User','Role','Status']} empty="No members." count={members.length}>{members.map(({user,membership})=><tr key={user.id}><td><Entity href={`/admin/users/${user.id}`} name={user.displayName} sub={user.username}/></td><td>{membership.role}</td><td><Status value={membership.status}/></td></tr>)}</DataTable></Card>
 <Card title="Recent jobs"><JobsTable jobs={jobs.map(jobSummary)}/></Card></>;
}
