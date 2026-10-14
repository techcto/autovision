'use client';
import {useEffect,useMemo,useState} from 'react';
import type {InspectionResult} from '@/lib/autonomous-inspection';
import type {PipelineEvent} from '@/lib/pipeline-events';
import LivePipeline from './live-pipeline';
export default function RecordedInspection({inspection,observations}:{inspection:InspectionResult;observations?:unknown}){
 const events=useMemo(()=>{
  const result:PipelineEvent[]=[{type:'run.started'},{type:'step.started',step_id:'perception',title:'Recorded OpenCV perception'},{type:'step.completed',step_id:'perception',data:observations}];
  for(const step of inspection.trace){const id='recorded-'+step.step;result.push({type:'step.added',step_id:id,title:step.tool,summary:'Recorded execution; no inference call.'},{type:'step.started',step_id:id,title:step.tool},{type:step.status==='failed'?'step.failed':'step.completed',step_id:id,title:step.tool,summary:step.reason,data:{input:step.input,output:step.output,duration_ms:step.duration_ms}})}
  result.push({type:'step.completed',step_id:'recommendation',title:inspection.review_recommended?'Human review recommended':'Recorded review recommendation',summary:inspection.reason},{type:'run.completed'});return result;
 },[inspection,observations]);
 const [count,setCount]=useState(0),[playing,setPlaying]=useState(false);
 useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>{if(count>=events.length)setPlaying(false);else setCount(n=>n+1)},700);return()=>clearTimeout(timer)},[playing,count,events.length]);
 return <section><p className="av-kicker">CACHED INSPECTION REPORT / REPLAY</p><p className="av-fine">Real recorded tool execution. Replay pacing is illustrative; recorded durations are in the evidence. No new inference is performed.</p><div className="av-actions"><button type="button" className="av-button-secondary" onClick={()=>{if(count>=events.length)setCount(0);setPlaying(p=>!p)}}>{playing?'Pause cached pipeline':'Replay cached pipeline'}</button><button type="button" className="av-button-secondary" onClick={()=>{setPlaying(false);setCount(events.length)}}>Show complete report</button></div><LivePipeline events={events.slice(0,count)} running={playing} mode="recorded"/></section>;
}
