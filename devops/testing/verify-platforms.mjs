import assert from 'node:assert/strict';
const auto='http://127.0.0.1:8081',smart='http://127.0.0.1:8082';
class Client {
  constructor(base){this.base=base;this.cookie=''}
  async request(url,body,expected=200,headers={}){
    const r=await fetch(this.base+url,{method:body===undefined?'GET':'POST',headers:{Cookie:this.cookie,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];
    assert.equal(r.status,expected,url+' returned '+r.status);
    return r.json();
  }
}
const av=new Client(auto),sd=new Client(smart);
for(const [client,name]of[[av,'autovision'],[sd,'smartdetector']]){
  await client.request('/api/health');
  await client.request('/api/auth/login',{username:'root',password:name+'-local-change-me'});
  const org=await client.request('/api/orgs',{name:'Synthetic verification '+Date.now()},201);
  await client.request('/api/orgs/active',{orgId:org.id});
  const products=await client.request('/api/v1/products');assert.equal(products.length,3);
  await client.request('/api/billing/checkout',{productId:'starter'},503);
}
const created=await av.request('/api/v1/api-keys',{label:'Synthetic SmartDetector verification'},201);
const detector=await av.request('/api/v1/detect',{demo:true},200,{Authorization:'Bearer '+created.key});
assert.equal(detector.engine,'opencv');assert.match(detector.engine_version,/^5\./);assert.equal(detector.observations[0].detected,true);
await sd.request('/api/v1/providers',{providerKey:'autovision',name:'Synthetic vision connection',settings:{apiKey:created.key},isDefault:true});
const providers=await sd.request('/api/v1/providers');assert.equal(providers.connections[0].settings.apiKey,'configured');assert.ok(!JSON.stringify(providers).includes(created.key));
const vision=await sd.request('/api/v1/vision',{demo:true,device_id:'synthetic-camera'});assert.equal(vision.observations[0].type,'motion');
await sd.request('/api/v1/simulator',{device_id:'synthetic-smoke',type:'smoke',value:80},202);
assert.equal((await sd.request('/api/v1/incidents')).length,1);
assert.equal((await sd.request('/api/v1/devices')).length,2);
const other=await sd.request('/api/orgs',{name:'Synthetic isolated '+Date.now()},201);await sd.request('/api/orgs/active',{orgId:other.id});
assert.equal((await sd.request('/api/v1/providers')).connections.length,0);assert.equal((await sd.request('/api/v1/incidents')).length,0);assert.equal((await sd.request('/api/v1/devices')).length,0);
const unauthed=new Client(auto);await unauthed.request('/api/v1/detect',{demo:true},401);
const signedUp=new Client(smart);await signedUp.request('/api/auth/signup',{username:'synthetic-'+Date.now(),password:'SyntheticPasswordForLocalTest2026',displayName:'Synthetic test account'},201);assert.equal((await signedUp.request('/api/v1/incidents')).length,0);
const revoke=await fetch(auto+'/api/v1/api-keys',{method:'DELETE',headers:{Cookie:av.cookie,'Content-Type':'application/json'},body:JSON.stringify({hash:created.hash})});assert.equal(revoke.status,200);await av.request('/api/v1/detect',{demo:true},401,{Authorization:'Bearer '+created.key});
console.log('PASS: root login, signup, organizations, billing guards, OpenCV detection, encrypted provider connection, cross-app signals, tenant isolation, and API key revocation.');

