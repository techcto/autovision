import type {PipelineEvent} from './pipeline-events';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const text=(v:unknown)=>typeof v==='string'?v.replace(/data:image\/[^\s"']+/g,'[image omitted]').slice(0,240):'';
function observations(value:unknown){const r=row(value);const labels=list(r.observations).flatMap(v=>{const o=row(v);return o.detected===true?[text(o.type)]:[]}).slice(0,8);const frames=list(r.frames);const dark=frames.some(f=>Number(row(row(f).quality).brightness)<60);return [dark?'dark frame measured':'',labels.length?'observed '+labels.join(', '):''].filter(Boolean).join('; ')||'measurements returned';}
export function mcpSummary(value:unknown){
 const r=row(value),inspection=row(r.inspection);
 const steps=['OpenCV '+text(r.engine_version)+': '+observations(r)];
 for(const item of list(inspection.trace).slice(0,8)){const t=row(item);steps.push(text(t.tool)+(t.status==='failed'?' rejected/failed: '+text(t.reason):t.tool==='finish'?': '+text(t.reason):': '+observations(row(t.output).result??t.output)));}
 if(inspection.review_recommended===true)steps.push('Human review recommended');
 else if(inspection.status==='complete')steps.push('Inspection complete; recommendation is advisory');
 else steps.push('Inspection: '+text(inspection.status||'not_requested'));
 for(const hint of list(r.next_steps).slice(0,3))steps.push('Next step: '+text(hint));
 steps.push('Job: '+text(r.job_id));
 return steps.join(' → ')+'\nDetailed measurements and trace are in structuredContent. No external action was taken.';
}
export function progressMessage(event:PipelineEvent){
 const label=text(event.title||event.step_id||event.type).replaceAll('_',' ');
 return `${label}: ${event.type.split('.').at(-1)}${event.summary?' — '+text(event.summary):''}`;
}
