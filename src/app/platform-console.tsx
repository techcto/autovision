'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Drawer,{DrawerBackdrop} from './drawer';
import LivePipeline from './live-pipeline';
import {sampleUpload} from '@/lib/browser-media';
import {readPipeline} from '@/lib/browser-pipeline';
import type {PipelineEvent} from '@/lib/pipeline-events';
import type {Job} from '@/lib/jobs';
type Usage={quotaExempt?:boolean;month:string;count:number;limit:number;plan:string};
export default function Console({showBilling=false}:{showBilling?:boolean}){
 const [usage,setUsage]=useState<Usage|null>(null),[jobs,setJobs]=useState<Job[]>([]),[manual,setManual]=useState(false),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(''),[classify,setClassify]=useState(true),[enhanced,setEnhanced]=useState(false),[settingsReady,setSettingsReady]=useState(false),[modelAvailable,setModelAvailable]=useState(false),[events,setEvents]=useState<PipelineEvent[]>([]),[completedJob,setCompletedJob]=useState('');
 const pending=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  try{const [u,j]=await Promise.all([fetch('/api/v1/usage',{cache:'no-store'}),fetch('/api/v1/jobs',{cache:'no-store'})]);if(!u.ok||!j.ok)throw Error('Unable to load workspace usage and jobs');setUsage(await u.json());setJobs(await j.json());}catch(e){setError(e instanceof Error?e.message:'Unable to load jobs');}
 },[]);
 useEffect(()=>{let active=true;const task=setTimeout(()=>void load(),0),timer=setInterval(()=>void load(),10000);
  void fetch('/api/v1/settings',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{if(active){setEnhanced(v.inspection?.enabled===true);setModelAvailable(v.inspectionModelAvailable===true);setSettingsReady(true);}}).catch(()=>{if(active)setError('Inspection settings could not load. Refresh before starting a run.');});
  return()=>{active=false;clearTimeout(task);clearInterval(timer);pending.current?.abort();};
 },[load]);
 async function run(){
  setBusy(true);setError('');setEvents([]);setCompletedJob('');const controller=new AbortController();pending.current=controller;
  try{
   if(!file)throw Error('Choose an image or short video');setProgress('Preparing media');const frames=await sampleUpload(file,setProgress);controller.signal.throwIfAborted();setManual(false);setProgress('Streaming the live inspection pipeline…');
   const response=await fetch('/api/v1/jobs/run',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({frames,classify,enhanced:classify&&enhanced}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])});
   await readPipeline(response,event=>{setEvents(current=>[...current,event]);if(event.summary)setProgress(event.summary);if(event.type==='run.completed'){const result=event.data as {job_id?:string};setCompletedJob(result?.job_id??event.job_id??'');}});
   setProgress('Analysis complete. Open the saved report to review all evidence and decisions.');
  }catch(e){setError(controller.signal.aborted?'Run cancelled. Work already performed may consume quota; check job history.':e instanceof Error?e.message:'Analysis failed');}
  finally{pending.current=null;setBusy(false);await load();}
 }
 return <>
  <section className="g-card av-usage-compact"><div><h2>Workspace usage</h2>{usage&&<p>{usage.count.toLocaleString()} images processed in {usage.month}{usage.quotaExempt?' · operator workspace · no image quota':showBilling?' · '+usage.limit.toLocaleString()+' monthly limit · '+usage.plan:' · private installation'}</p>}<Link href="/settings">Manage API keys and inspection settings</Link>{showBilling&&<> · <Link href="/settings/billing">Payment plans</Link></>}</div><button className="button primary" disabled={busy} onClick={()=>{setError('');setManual(true);}}>+ Manual run</button></section>
  {(busy||events.length>0)&&<section className="g-card mb-4" aria-label="Current analysis workflow"><LivePipeline events={events} running={busy}/><p role="status">{progress}</p>{busy&&<button className="button" onClick={()=>pending.current?.abort()}>Cancel run</button>}{completedJob&&<Link className="button primary" href={'/dashboard/jobs/'+completedJob}>Open analysis report →</Link>}</section>}
  {error&&!manual&&<p role="alert" className="form-error">{error}</p>}
  <section className="g-card"><div className="av-jobs-heading"><div><h2>Recent jobs</h2><p className="muted">REST, MCP, and manual runs · up to 50 recent jobs · seven-day history</p></div><button className="button" onClick={()=>void load()}>Refresh</button></div>
   <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Preview / job</th><th>Started</th><th>User / API key</th><th>Source</th><th>Status</th><th>Images</th><th>Time</th></tr></thead><tbody>{jobs.map(job=><tr key={job.id}><td><Link className="av-job-link" href={'/dashboard/jobs/'+job.id}>{job.thumbnail?<img src={'data:image/jpeg;base64,'+job.thumbnail} alt="Job thumbnail"/>:<span className="av-job-placeholder" aria-hidden="true">▧</span>}<span>{job.id.slice(0,8)}<small>View details ↗</small></span></Link></td><td>{new Date(job.createdAt).toLocaleString()}</td><td><strong>{job.actor.label}</strong><small className="d-block text-secondary">{job.actor.kind==='api_key'?'API key · '+job.actor.id:'User'}</small></td><td>{job.source}</td><td><span className={'badge '+(job.status==='complete'?'text-bg-success':job.status==='failed'?'text-bg-danger':'text-bg-secondary')}>{job.status}</span></td><td>{job.frameCount}</td><td>{job.durationMs===undefined?'—':(job.durationMs/1000).toFixed(1)+'s'}</td></tr>)}</tbody></table>{!jobs.length&&<div className="av-job-empty"><h3>No jobs yet</h3><p>Run an image or short clip manually, or submit through REST/MCP with a key created in Settings.</p></div>}</div>
  </section>
  <DrawerBackdrop open={manual} onClose={()=>{if(!busy)setManual(false);}}/>
  <Drawer open={manual} title="Manual run" onClose={()=>{if(!busy)setManual(false);}}>
   <p className="muted">Your signed-in session authorizes this run. No API key needed.</p>
   <label className="d-block mb-3">Image or short video<input className="form-control mt-2" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={busy}/></label>
   <p className="small text-secondary">Up to 20 MB / 30 seconds. Browser samples at most 12 frames. Results and sampled previews are retained for seven days; original video is not uploaded or stored.</p>
   <label className="d-block mb-3"><input type="checkbox" checked={classify} onChange={e=>{setClassify(e.target.checked);if(!e.target.checked)setEnhanced(false);}} disabled={busy}/> Include Bedrock scene summary</label>
   <label className="d-block mb-3"><input type="checkbox" checked={enhanced} onChange={e=>setEnhanced(e.target.checked)} disabled={busy||!classify||!settingsReady}/> Enhanced AI inspection — let the Decider choose follow-up tools</label>
   <p className="small text-secondary">Starts with your workspace default; this switch controls this run only. AI-enabled frames are sent to configured Bedrock models. Follow-ups use additional quota and inference costs. No external actions are performed.</p>
   {settingsReady&&!modelAvailable&&<p className="notice">Bedrock is not configured for this deployment. Initial OpenCV analysis remains available; enhanced inspection may return unavailable and recommend human review.</p>}
   <button className="button primary" disabled={busy||!file||!settingsReady} onClick={()=>void run()}>Run analysis</button>
   <p role="status" aria-live="polite">{progress}</p>{error&&<p role="alert" className="form-error">{error}</p>}
  </Drawer>
 </>;
}
