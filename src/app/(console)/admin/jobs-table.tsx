import Link from 'next/link';
import {adminDateTime,type JobSummary} from '@/lib/admin';
import {DataTable,Status} from './admin-ui';
export const jobDuration=(ms?:number)=>ms===undefined?'—':ms<1000?`${ms} ms`:`${(ms/1000).toFixed(1)} s`;
export default function JobsTable({jobs}:{jobs:(JobSummary&{organization?:string})[]}){
 const org=jobs.some(j=>j.organization);
 return <DataTable head={['Job',...(org?['Organization']:[]),'Status','Source','Run by','Frames','Duration','Started']} empty="No jobs in the 7-day retention window." count={jobs.length}>{jobs.map(j=><tr key={j.orgId+j.id}><td><Link href={`/admin/jobs/${j.orgId}/${j.id}`}><code>{j.id.slice(0,8)}</code></Link></td>{org&&<td><Link href={`/admin/organizations/${j.orgId}`}>{j.organization}</Link></td>}<td><Status value={j.status}/></td><td>{j.source}</td><td>{j.actor.label}</td><td>{j.frameCount}</td><td className="muted">{jobDuration(j.durationMs)}</td><td className="muted">{adminDateTime(j.createdAt)}</td></tr>)}</DataTable>;
}
