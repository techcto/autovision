import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAnalysis, readBoundedJson} from '../src/lib/media-contract';
const image = Buffer.from([255,216,255,0]).toString('base64');
test('single image normalizes to a frame',()=>assert.deepEqual(validateAnalysis({image}).frames,[{image,at_ms:0}]));
test('video requires bounded ascending frames',()=>{
  assert.equal(validateAnalysis({frames:[{image,at_ms:0},{image,at_ms:1000}]}).frames.length,2);
  for(const frames of [[],Array(13).fill({image,at_ms:0}),[{image,at_ms:-1}],[{image,at_ms:30001}],[{image,at_ms:0},{image,at_ms:0}]]) assert.throws(()=>validateAnalysis({frames}));
});
test('reject remote URLs, unsupported bytes and nonboolean classification',()=>{
  for(const value of [{image:'https://example.test/image.jpg'},{image:'aGVsbG8='},{image,classify:'yes'}])assert.throws(()=>validateAnalysis(value));
});
test('read limit applies without a Content-Length',async()=>{
  const request = new Request('http://localhost/api/v1/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(4_000_001)});
  await assert.rejects(readBoundedJson(request),/too large/);
  await assert.rejects(readBoundedJson(new Request('http://localhost',{method:'POST',body:'{}'})),/application\/json/);
});
