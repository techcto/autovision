'use client';
import {useEffect,useState} from 'react';
type Detection={label:string;source?:string;box:{x:number;y:number;width:number;height:number}};
type Sample={at_ms:number;preview:string;detections:Detection[]};
type Recording={frames:Sample[];classification:{summary?:string;checked_frames?:number[]};engine:string;recordedAt:string};
export default function HeroVideoDemo({clip='intruder',title='Doorbell camera',description}:{clip?:'intruder'|'dognight'|'package'|'backyardintruder';title?:string;description?:string}){
 const [aspect,setAspect]=useState(16/9);
 const [audit,setAudit]=useState(false);
 const [record,setRecord]=useState<Recording|null>(null),[selected,setSelected]=useState(0),[at,setAt]=useState(0),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch(`/demo/${clip}-analysis.json`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Recorded analysis unavailable');return r.json()}).then(setRecord).catch(()=>{if(!controller.signal.aborted)setError('Recorded analysis unavailable. Try your own clip in the Live Lab below.');});return()=>controller.abort();},[clip]);
 // Boxes are sampled observations, not a continuous tracker. Hide between samples.
 const sample=audit?record?.frames[selected]:record?.frames.find(f=>Math.abs(f.at_ms-at*1000)<=250);
 return <section className="av-hero-demo" aria-label={`${title} video analysis demo`}>
  <div className="av-hero-demo-heading"><span className="av-kicker">{title.toUpperCase()} / RECORDED ANALYSIS</span><a href="#demo">Try your clip ↓</a></div>
  {description&&<p className="av-fine">{description}</p>}
  <div className="av-hero-demo-media" style={{aspectRatio:aspect}}>
   <video src={`/${clip}.mp4`} poster={`/demo/${clip}-poster.jpg`} autoPlay loop muted playsInline preload="metadata" onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)setAspect(v.videoWidth/v.videoHeight);}} onTimeUpdate={e=>setAt(e.currentTarget.currentTime)} aria-label={`${title} demonstration video`}/>
   {audit&&sample&&<img className="av-hero-demo-sample" src={'data:image/jpeg;base64,'+sample.preview} alt={`Analyzed sample at ${(sample.at_ms/1000).toFixed(1)} seconds`}/>}
   <div className="av-hero-demo-boxes" aria-hidden="true">{sample?.detections.map((d,i)=><div key={i} className={'av-box '+(d.source==='bedrock'?'av-box-advisory':'av-box-measured')} style={{left:`${d.box.x*100}%`,top:`${d.box.y*100}%`,width:`${d.box.width*100}%`,height:`${d.box.height*100}%`}}><span>{d.label} · {d.source==='bedrock'?'AI advisory':'OpenCV'}</span></div>)}</div>
  </div>
  <button type="button" className="av-button-secondary mt-3" disabled={!record} aria-expanded={audit} aria-controls={`audit-${title.replaceAll(' ','-')}`} onClick={()=>setAudit(!audit)}>{audit?'Back to video':'View analysis →'}</button>
  {record&&audit&&<div id={`audit-${title.replaceAll(' ','-')}`}><div className="av-hero-demo-controls">
   <button type="button" className="av-button-secondary" disabled={selected===0} onClick={()=>setSelected(selected-1)}>← Previous</button>
   <span role="status">{`Sample ${selected+1} of ${record.frames.length} · ${(sample!.at_ms/1000).toFixed(1)}s`}</span>
   <button type="button" className="av-button-secondary" disabled={selected===record.frames.length-1} onClick={()=>setSelected(selected+1)}>Next →</button>
  </div><div className="av-hero-demo-samples" aria-label="Analyzed video samples">{record.frames.map((f,i)=><button type="button" key={f.at_ms} onClick={()=>setSelected(i)} aria-pressed={selected===i} aria-label={`Show analyzed sample ${(f.at_ms/1000).toFixed(1)} seconds`}><img src={'data:image/jpeg;base64,'+f.preview} alt=""/><span>{(f.at_ms/1000).toFixed(1)}s</span></button>)}</div>
  <p className="av-hero-demo-summary">{record.classification.summary}</p><p className="av-fine">Engine: {record.engine} · Analysis recorded {new Date(record.recordedAt).toLocaleDateString()}</p></div>}
  {error&&<p role="alert">{error}</p>}
  <p className="av-fine">Precomputed AutoVision results on this supplied demo clip. Boxes appear only at sampled times, not continuous tracking. Dashed red: advisory AI grounding. Green: OpenCV detector output. No identity, intent or threat determination.</p>
 </section>;
}
