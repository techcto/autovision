import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NextRequest} from 'next/server';
import {proxy} from '../src/proxy';
test('only the named homepage demo media bypasses session authentication',async()=>{
 for(const path of ['intruder','dognight','package','backyardintruder'].flatMap(id=>['/'+id+'.mp4','/demo/'+id+'-analysis.json','/demo/'+id+'-poster.jpg'])){
  const response=await proxy(new NextRequest('http://localhost:8081'+path));
  assert.equal(response.headers.get('x-middleware-next'),'1');
 }
 for(const path of ['/demo/private.json','/dashboard','/private-video.mp4']){
  assert.equal((await proxy(new NextRequest('http://localhost:8081'+path))).status,307);
 }
 assert.equal((await proxy(new NextRequest('http://localhost:8081/api/v1/jobs'))).status,401);
});
test('homepage recording matches supplied clip and contains bounded measured evidence',()=>{
 for(const clip of ['intruder','dognight','package','backyardintruder']){
 const record=JSON.parse(readFileSync(`public/demo/${clip}-analysis.json`,'utf8'));
 assert.equal(record.sha256,createHash('sha256').update(readFileSync(`public/${clip}.mp4`)).digest('hex'));
 assert.equal(record.classification.status,'complete');
 assert.ok(record.frames.length>=2&&record.frames.length<=12);
 let previous=-1,boxes=0;
 for(const frame of record.frames){
  assert.ok(frame.at_ms>previous&&frame.at_ms<=30000);previous=frame.at_ms;
  assert.match(frame.preview,/^[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(frame.preview.length<=24000);
  for(const detection of frame.detections){
   const b=detection.box;assert.ok(b.x>=0&&b.y>=0&&b.width>0&&b.height>0&&b.x+b.width<=1.001&&b.y+b.height<=1.001);
   assert.ok(['opencv','bedrock'].includes(detection.source||'opencv'));boxes++;
  }
 }
 assert.ok(boxes>0,'Use actual returned boxes, never hardcoded decorative rectangles');
 if(clip!=='intruder')assert.ok(record.frames.some((f:{detections:{label:string}[]})=>f.detections.some(d=>d.label===(clip==='dognight'?'dog':clip==='package'?'package':'person'))));
 }
});
