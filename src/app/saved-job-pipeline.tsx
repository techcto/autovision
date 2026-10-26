'use client';
import {useEffect,useMemo,useState} from 'react';
import type {PipelineEvent} from '@/lib/pipeline-events';
import LivePipeline from './live-pipeline';
export default function SavedJobPipeline({events,status}:{events:PipelineEvent[];status:string}){
 const steps=useMemo(()=>[...events,{type:status==='failed'?'run.failed':'run.completed',summary:status==='failed'?'Saved job failed; inspect the completed and failed steps.':undefined} as PipelineEvent],[events,status]);
 const [playing,setPlaying]=useState(false),[count,setCount]=useState(0);
 useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>{if(count>=steps.length)setPlaying(false);else setCount(n=>n+1);},500);return()=>clearTimeout(timer);},[count,playing,steps.length]);
 return <section className="av-detail-panel"><h2>Saved workflow and Decider steps</h2><p>Actual events retained from this job. Replay animates saved steps; it does not run new inference.</p><div className="d-flex gap-2 mb-3"><button className="button" onClick={()=>{if(!playing)setCount(0);setPlaying(p=>!p);}}>{playing?'Pause replay':'Replay saved steps'}</button><button className="button" onClick={()=>{setPlaying(false);setCount(steps.length);}}>Show all steps</button></div><LivePipeline events={playing||count>0?steps.slice(0,count):steps} running={playing} mode="recorded"/></section>;
}
