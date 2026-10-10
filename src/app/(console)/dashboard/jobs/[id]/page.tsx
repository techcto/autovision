import FrameReview from './frame-review';
import Link from 'next/link';
import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {getJob} from '@/lib/jobs';
import {sessionCookie,verifySession} from '@/lib/session';
import CopyCode from '../../../../copy-code';

type Observation={type:string;value:number;detected:boolean};
type Frame=import('./frame-review').ReviewFrame;
export default async function JobDetails({params}:{params:Promise<{id:string}>}){
  const session=await verifySession((await cookies()).get(sessionCookie)?.value,process.env.AUTOVISION_SESSION_SECRET??'');
  if(!session)redirect('/login');
  const {id}=await params,job=await getJob(session.orgId,id);
  if(!job)notFound();
  const result=job.result??{},observations=(result.observations??[]) as Observation[],frames=(result.frames??[]) as Frame[];
  const classification=result.classification as {status:string;summary?:string;model?:string}|undefined;
  const metrics=result.metrics as {latency_ms?:number}|undefined;
  const limitations=(result.limitations??[]) as string[];
  return <article className="av-job-detail">
    <Link href="/dashboard" className="av-detail-back">← All analysis jobs</Link>
    <header className="av-detail-header"><div><span className="av-kicker">ANALYSIS REPORT</span><h1>Visual intelligence, explained.</h1><p>Job <code>{job.id}</code></p></div><span className={'av-detail-status '+job.status}>{job.status}</span></header>
    <div className="av-detail-meta"><div><span>Started</span><strong>{new Date(job.createdAt).toISOString().replace('T',' ').replace('.000Z',' UTC')}</strong></div><div><span>{job.actor.kind==='user'?'Run by user':'API key'}</span><strong>{job.actor.label}</strong>{job.actor.kind==='api_key'&&<small>Key reference: {job.actor.id}</small>}</div><div><span>Source</span><strong>{job.source.toUpperCase()}</strong></div><div><span>Run time</span><strong>{job.durationMs===undefined?'—':(job.durationMs/1000).toFixed(1)+' seconds'}</strong></div></div>
    {job.error&&<div className="av-detail-error" role="alert"><h2>Analysis could not complete</h2><p>{job.error}</p></div>}
    {job.status==='running'&&<p className="av-detail-notice">This job is still processing. Reload this page to see its latest results.</p>}
    <div className="av-detail-grid"><section className="av-detail-panel"><span className="av-kicker">RETAINED PREVIEW</span><h2>What we observed</h2><FrameReview frames={frames} thumbnail={job.thumbnail}/><div className="av-detail-stats"><div><strong>{job.frameCount}</strong><span>sampled image{job.frameCount===1?'':'s'}</span></div><div><strong>{metrics?.latency_ms===undefined?'—':Math.round(metrics.latency_ms)+' ms'}</strong><span>vision processing</span></div>{observations.map((o,i)=><div key={o.type+'-'+i}><strong>{o.type==='motion'?(o.value*100).toFixed(1)+'%':o.value}</strong><span>{o.type==='motion'?'peak pixel change':o.type==='person'?'maximum pedestrian detections':o.type}</span></div>)}</div></section>
    <section className="av-detail-panel av-detail-ai"><span className="av-kicker">AMAZON BEDROCK</span><h2>Scene summary</h2><span className="av-detail-ai-status">{classification?.status.replaceAll('_',' ')??'No AI summary in this result'}</span><p className="av-detail-summary">{classification?.summary??(classification?.status==='not_requested'?'AI classification was turned off for this run. The measured vision observations remain available.':classification?.status==='not_configured'?'Bedrock was not configured when this job ran.':'No AI summary is available for this job. Check the measured results below.')}</p>{classification?.model&&<p className="av-detail-note">Model: <code>{classification.model}</code></p>}<div className="av-detail-notice">AI descriptions are advisory. Detection scores are not probabilities; sampled frames can miss events. This report does not establish identity, intent, or danger.</div></section></div>
    {frames.length>0&&<section className="av-detail-panel av-detail-timeline"><span className="av-kicker">FRAME BY FRAME</span><h2>Activity timeline</h2><div className="av-detail-bars">{frames.map((f,i)=>{const motion=f.observations.find(o=>o.type==='motion')?.value??0;return <div key={i} title={(motion*100).toFixed(1)+'% changed pixels'}><div className="av-detail-bar-track"><span style={{height:Math.max(3,motion*100)+'%'}}/></div><strong>{(f.at_ms/1000).toFixed(1)}s</strong><small>{(motion*100).toFixed(1)}% change</small><small>{f.observations.find(o=>o.type==='person')?.value??0} pedestrians</small></div>;})}</div><p className="av-detail-note">Bar height shows changed pixels between samples, not threat level. The first frame has no preceding sample.</p></section>}
    {frames.some(f=>f.detections?.some(d=>d.source==='bedrock'))&&<section className="av-detail-panel"><span className="av-kicker">AI IMAGE GROUNDING</span><h2>Detected objects</h2><p className="av-detail-note">Nova Lite supplies approximate boxes on selected frames only, without calibrated confidence scores.</p>{frames.map(f=>(f.detections??[]).filter(d=>d.source==='bedrock').map((d,i)=><p key={f.at_ms+'-'+i}><strong>{d.label}</strong> at {(f.at_ms/1000).toFixed(1)}s · AI advisory</p>))}</section>}
    {limitations.length>0&&<section className="av-detail-panel"><h2>Detection limitations</h2><ul>{limitations.map(text=><li key={text}>{text}</li>)}</ul></section>}
    <section className="av-detail-panel"><span className="av-kicker">DEVELOPER VIEW</span><h2>Structured response</h2><p>Use the same result structure with REST and MCP integrations.</p><details><summary>Expand result JSON</summary><CopyCode text={JSON.stringify(result,null,2)}/></details></section>
  </article>;
}
