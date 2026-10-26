import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const base=process.env.AUTOVISION_EVAL_URL||'http://localhost:8086';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Localhost only; use approved development Bedrock configuration.');
if(process.env.AUTOVISION_EVAL_AI_CONSENT!=='true')throw Error('Set AUTOVISION_EVAL_AI_CONSENT=true to approve image delegation and possible Bedrock charges.');
const dataset=JSON.parse(await readFile(new URL('./agent-evaluation-cases.json',import.meta.url),'utf8'));
const results=[];
for(const sample of dataset.cases){
 const bytes=await readFile(sample.file),start=Date.now();
 const response=await fetch(base+'/api/demo/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({frames:[{image:bytes.toString('base64'),at_ms:0}],detection_labels:['person','dog','cat','package'],classify:true,enhanced:true}),signal:AbortSignal.timeout(120000)});
 const result=await response.json(),inspection=result.inspection;
 const observed=result.observations?.some(o=>o.type===sample.visible_label&&o.detected===true)??false;
 results.push({id:sample.id,input_sha256:createHash('sha256').update(bytes).digest('hex'),expected_label:sample.visible_label,expected_review:sample.expected_review,http_status:response.status,duration_ms:Date.now()-start,engine_version:result.engine_version,model:inspection?.model,status:inspection?.status??'request_failed',label_observed:observed,loop_completed:inspection?.status==='complete',review_recommended:inspection?.review_recommended??null,review_matches_policy:inspection?inspection.review_recommended===sample.expected_review:false,initial_evidence_retained:!!result.frames?.length,trace:inspection?.trace?.map(t=>({tool:t.tool,status:t.status,duration_ms:t.duration_ms,reason:t.reason})),error:result.error});
 console.log({case:sample.id,status:inspection?.status??response.status});
}
const report={recorded_at:new Date().toISOString(),source_revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),working_tree_dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),kind:'actual_local_opencv_and_configured_bedrock_or_reported_failure',labeling:dataset.labeling,notes:['No model responses or image previews are exported.','Three convenience samples are not a representative accuracy benchmark.','Unavailable model outcomes test fallback, not successful agentic reasoning.','No external action is implemented; human approval remains with the consuming application.'],summary:{cases:results.length,completed_loops:results.filter(r=>r.loop_completed).length,visible_label_matches:results.filter(r=>r.label_observed).length,review_policy_matches:results.filter(r=>r.review_matches_policy).length,unnecessary_review:results.filter(r=>r.review_recommended===true&&!r.expected_review).length,missed_review:results.filter(r=>r.review_recommended===false&&r.expected_review).length,failed_or_unavailable:results.filter(r=>!r.loop_completed).length},results};
await mkdir('docs/evaluation',{recursive:true});await writeFile('docs/evaluation/agent-evaluation.json',JSON.stringify(report,null,2)+'\n');
console.log(report.summary);
