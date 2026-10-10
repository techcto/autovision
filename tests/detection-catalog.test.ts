import {test} from 'node:test';
import assert from 'node:assert/strict';
import {objectLabels,validateObjectLabels,detectionPresets} from '../src/lib/detection-catalog';
import {validateAnalysis} from '../src/lib/media-contract';
import {newJob,saveJob,purgeJobs,getJob} from '../src/lib/jobs';
test('catalog contains 80 common objects and three advisory extras',()=>{
 assert.equal(objectLabels.length,83);assert.equal(new Set(objectLabels).size,83);
 assert.deepEqual(validateObjectLabels(['dog','dog','package']),['dog','package']);
 assert.throws(()=>validateObjectLabels(['intruder']));assert.throws(()=>validateObjectLabels('dog'));
 assert.ok(detectionPresets.smartdetector.includes('dog'));
});
test('requests preserve explicit label selection, including empty selection',()=>{
 const image=Buffer.from([255,216,255,0]).toString('base64');
 assert.deepEqual(validateAnalysis({image,detection_labels:[]}).detection_labels,[]);
 assert.deepEqual(validateAnalysis({image,detection_labels:['dog','package']}).detection_labels,['dog','package']);
 assert.throws(()=>validateAnalysis({image,detection_labels:['unknown']}));
});
test('purge deletes only the requested organization jobs',async()=>{
 const first=newJob('purge-a',{kind:'user',id:'test',label:'test'},'manual',1);
 const second=newJob('purge-b',{kind:'user',id:'test',label:'test'},'manual',1);
 await saveJob(first);await saveJob(second);
 assert.equal(await purgeJobs('purge-a'),1);
 assert.equal(await getJob('purge-a',first.id),null);
 assert.ok(await getJob('purge-b',second.id));await purgeJobs('purge-b');
});
