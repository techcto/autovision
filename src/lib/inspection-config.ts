export const inspectionTools=['inspect_region','enhance_low_light','assess_scene'] as const;
export type InspectionTool=typeof inspectionTools[number];
export type InspectionConfig={enabled:boolean;triggers:('person'|'dog'|'cat'|'package')[];tools:InspectionTool[];maxSteps:number;cropPadding:number;brightnessThreshold:number;claheStrength:number;model:string;sceneModel?:string;packageModel?:string;activityModel?:string};
export const defaultInspection:InspectionConfig={enabled:false,triggers:['person','dog','cat','package'],tools:[...inspectionTools],maxSteps:2,cropPadding:0.15,brightnessThreshold:60,claheStrength:2,model:'deployment_default',sceneModel:'deployment_default',packageModel:'deployment_default',activityModel:'deployment_default'};
export function validateInspection(value:unknown,allowedModels:string[]=['deployment_default']):InspectionConfig{
 if(!value||typeof value!=='object')throw Error('Invalid inspection settings');
 const v=value as Record<string,unknown>;
 const number=(key:string,min:number,max:number)=>{const n=v[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error('Invalid '+key);return n};
 if(typeof v.enabled!=='boolean'||!Array.isArray(v.triggers)||v.triggers.length>4||v.triggers.some(x=>!['person','dog','cat','package'].includes(x))||!Array.isArray(v.tools)||v.tools.length>3||v.tools.some(x=>!inspectionTools.includes(x))||typeof v.model!=='string'||!allowedModels.includes(v.model)||['sceneModel','packageModel','activityModel'].some(k=>v[k]!==undefined&&(typeof v[k]!=='string'||!allowedModels.includes(v[k] as string))))throw Error('Invalid inspection settings');
 const maxSteps=number('maxSteps',1,2);if(!Number.isInteger(maxSteps))throw Error('Invalid step limit');
 return{enabled:v.enabled,triggers:[...new Set(v.triggers)] as InspectionConfig['triggers'],tools:[...new Set(v.tools)] as InspectionTool[],maxSteps,cropPadding:number('cropPadding',0,0.5),brightnessThreshold:number('brightnessThreshold',1,128),claheStrength:number('claheStrength',1,4),model:v.model,sceneModel:(v.sceneModel as string)??'deployment_default',packageModel:(v.packageModel as string)??'deployment_default',activityModel:(v.activityModel as string)??'deployment_default'};
}
