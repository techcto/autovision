import {notFound} from 'next/navigation';
import {adminDate,jobCounts,rootSession,saasMode} from '@/lib/admin';
import {listJobs} from '@/lib/jobs';
import {store} from '@/lib/store';
import {Card,DataTable,Entity,PageHeader} from '../admin-ui';
export default async function AdminOrganizations(){
 await rootSession();if(!saasMode())notFound();
 const rows=await Promise.all((await store.organizations()).map(async org=>({org,members:(await store.membersOfOrg(org.id)).length,jobs:jobCounts(await listJobs(org.id))})));
 rows.sort((a,b)=>a.org.name.localeCompare(b.org.name));
 return <><PageHeader eyebrow="Directory" title="Organizations" description="Every organization is an isolated tenant with its own API keys, analysis jobs, and usage quota."/>
 <Card><DataTable head={['Organization','Type','Members','Recent jobs','Failed','Created']} empty="No organizations yet." count={rows.length}>{rows.map(({org,members,jobs})=><tr key={org.id}><td><Entity href={`/admin/organizations/${org.id}`} name={org.name} sub={org.contactEmail??org.slug}/></td><td className="muted">{org.orgType}</td><td>{members}</td><td>{jobs.complete+jobs.failed+jobs.running}</td><td>{jobs.failed}</td><td className="muted">{adminDate(org.createdAt)}</td></tr>)}</DataTable></Card></>;
}
