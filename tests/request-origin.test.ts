import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasAllowedOrigin} from '../src/lib/request-origin';
test('allow Docker external port and HTTPS host without trusting forwarded hosts', () => {
  const check=(origin:string,host='localhost:8081')=>hasAllowedOrigin(new Request('http://localhost:3000/api/demo/analyze',{headers:{origin,host,'x-forwarded-host':'attacker.test'}}));
  assert.equal(check('http://localhost:8081'),true);
  assert.equal(check('https://autovision.dev','autovision.dev'),true);
  for(const origin of ['http://localhost:8082','https://attacker.test','null','file:///tmp/a','http://localhost:8081/path'])assert.equal(check(origin),false);
  assert.equal(hasAllowedOrigin(new Request('http://localhost:3000')),true);
});
