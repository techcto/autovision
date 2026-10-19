import {notFound} from 'next/navigation';
import {directoryJobs,jobCounts,rootSession,saasMode} from '@/lib/admin';
import {Card,PageHeader} from '../admin-ui';
import JobsTable from '../jobs-table';
export default async function AdminJobs(){
 await rootSession();if(!saasMode())notFound();
 const jobs=await directoryJobs(),counts=jobCounts(jobs);
 return <><PageHeader eyebrow="Directory" title="Jobs" description="Status of recent analysis jobs across every organization, within the 7-day retention window. Images and results stay inside each organization."/>
 <div className="admin-stats"><div className="card g-card"><span>Complete</span><strong>{counts.complete}</strong></div><div className="card g-card"><span>Failed</span><strong>{counts.failed}</strong></div><div className="card g-card"><span>Running</span><strong>{counts.running}</strong></div></div>
 <Card><JobsTable jobs={jobs}/></Card></>;
}
