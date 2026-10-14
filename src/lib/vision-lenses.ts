export const visionLenses=[
 {id:'yolox',name:'YOLOX objects',kind:'model',status:'implemented',purpose:'OpenCV 5 COCO object boxes; person, pets, vehicles and selected common objects.'},
 {id:'inspect_region',name:'Crop and re-detect',kind:'inspection_tool',status:'implemented',purpose:'Inspect an existing region with the same pinned YOLOX model.'},
 {id:'enhance_low_light',name:'CLAHE low-light contrast',kind:'inspection_tool',status:'implemented',purpose:'Enhance luminance and rerun detection; cannot recover missing detail.'},
 {id:'scene',name:'AI scene assessment',kind:'ai_skill',status:'implemented',purpose:'Visible scene description with uncertainty; deployment-approved Bedrock model.'},
 {id:'package',name:'AI package assessment',kind:'ai_skill',status:'implemented',purpose:'Focused advisory package presence and occlusion assessment; not a trained package detector.'},
 {id:'activity',name:'AI visible activity',kind:'ai_skill',status:'implemented',purpose:'Describe visible actions without inferring intent, identity or danger; a still frame cannot establish motion.'},
 {id:'yunet',name:'YuNet face detection',kind:'model',status:'separate_api',purpose:'Explicit /api/v1/faces measurement; not automatically available to this inspection loop.'},
 {id:'sface',name:'SFace embeddings',kind:'model',status:'separate_api',purpose:'Explicit sensitive biometric measurement; consuming app owns consent and matching.'},
 {id:'ocr',name:'Text/OCR — PP-OCR + CRNN',kind:'model_family',status:'planned',purpose:'Future licensed, pinned and validated adapter; not executable today.'},
 {id:'segmentation',name:'Segmentation — EfficientSAM / PP-HumanSeg',kind:'model_family',status:'planned',purpose:'Future mask output adapter; not executable today.'},
 {id:'tracking',name:'Tracking — VitTrack',kind:'model_family',status:'planned',purpose:'Future temporal tracking adapter; not executable today.'},
 {id:'pose',name:'Pose — MediaPipe Pose',kind:'model_family',status:'planned',purpose:'Future keypoint adapter; not executable today.'},
 {id:'nanodet',name:'NanoDet alternative detector',kind:'model',status:'planned',purpose:'Future benchmarked detector alternative; not executable today.'},
] as const;
export type AiSkill='planning'|'scene'|'package'|'activity';
export type ApprovedModel={id:string;label:string;modelId:string;skills:AiSkill[]};
export function approvedModels():ApprovedModel[]{
 const baseline=process.env.AUTOVISION_VISION_MODEL_ID;
 const models:ApprovedModel[]=baseline?[{id:'deployment_default',label:'Deployment default',modelId:baseline,skills:['planning','scene','package','activity']}]:[];
 const raw=process.env.AUTOVISION_AI_MODELS_JSON;if(!raw)return models;
 try{const entries=JSON.parse(raw);if(!Array.isArray(entries)||entries.length>8)throw Error();for(const v of entries){if(!v||typeof v.id!=='string'||!/^[-a-z0-9_]{1,40}$/.test(v.id)||v.id==='deployment_default'||models.some(m=>m.id===v.id)||typeof v.label!=='string'||v.label.length>80||typeof v.modelId!=='string'||v.modelId.length>300||!Array.isArray(v.skills)||!v.skills.length||v.skills.some((s:unknown)=>!['planning','scene','package','activity'].includes(String(s))))throw Error();models.push({id:v.id,label:v.label,modelId:v.modelId,skills:v.skills})}}catch{throw Error('Invalid deployment AI model registry')}
 return models;
}
export function resolveModel(id:string,skill:AiSkill){return approvedModels().find(m=>m.id===id&&m.skills.includes(skill))?.modelId;}
