export type PipelineEvent={type:'run.started'|'step.added'|'step.started'|'step.completed'|'step.failed'|'run.completed'|'run.failed';step_id?:string;title?:string;summary?:string;data?:unknown;job_id?:string;elapsed_ms?:number};
export type PipelineContext={onEvent?:(event:PipelineEvent)=>void;signal?:AbortSignal};
