import {objectLabels, ObjectLabel, detectionPresets} from './detection-catalog';
export const detectionCatalog: Record<ObjectLabel,string> = {
  ...Object.fromEntries(objectLabels.map(label=>[label,'A clearly visible '+label+'. Do not infer an object that is obscured or absent.'])) as Record<ObjectLabel,string>,
  package: 'A visible delivery parcel or cardboard shipping box, not a person or clothing.',
  smoke: 'Visible airborne smoke; do not confuse fog, steam, clouds or shadows with smoke.',
  fire: 'Visible flames; do not infer fire from warm colors or lighting alone.',
} as const;
export type AiLabel=keyof typeof detectionCatalog;
export type AiDetection={label:AiLabel;source:'bedrock';advisory:true;box:{x:number;y:number;width:number;height:number}};
export function enabledAiLabels(value=process.env.AUTOVISION_AI_DETECTIONS??detectionPresets.smartdetector.join(',')):AiLabel[]{
 return [...new Set(value.split(',').map(s=>s.trim()).filter((s):s is AiLabel=>Object.hasOwn(detectionCatalog,s)))];
}
export function parseGrounding(text:string,allowed:AiLabel[],indices:number[]){
 if(text.length>20000)throw Error('AI response too large');
 const v=JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
 if(typeof v.summary!=='string'||v.summary.length>4000||!Array.isArray(v.frames))throw Error('Invalid grounding result');
 const seen=new Set<number>();
 const frames:{frame_index:number;detections:AiDetection[]}[]=v.frames.map((f:{frame_index:number;detections:unknown[]})=>{
  if(!indices.includes(f.frame_index)||seen.has(f.frame_index)||!Array.isArray(f.detections)||f.detections.length>20)throw Error('Invalid AI frame');
  seen.add(f.frame_index);
  const detections:AiDetection[]=[];
  for(const candidate of f.detections){
   const d=candidate as {label:AiLabel;box:number[]};
   if(!d||!allowed.includes(d.label)||!Array.isArray(d.box)||d.box.length!==4)throw Error('Invalid AI detection');
   const [x1,y1,x2,y2]=d.box;
   if(!d.box.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1000)||x2<=x1||y2<=y1)throw Error('Invalid AI box');
   detections.push({label:d.label,source:'bedrock',advisory:true,box:{x:x1/1000,y:y1/1000,width:(x2-x1)/1000,height:(y2-y1)/1000}});
  }
  return {frame_index:f.frame_index,detections};
 });
 if(indices.some(i=>!seen.has(i)))throw Error('Missing AI frame');
 return {summary:v.summary as string,frames};
}
