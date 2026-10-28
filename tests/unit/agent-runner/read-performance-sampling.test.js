'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { sampleReads } = require('../../../tools/repository/sample-read-performance.cjs');
test('HTTP sampling bounds concurrency and retains failed responses without counting them as successful P95', async t => {
  let inFlight = 0, max = 0, requests = 0;
  const server = http.createServer((_req,res) => {
    inFlight++; requests++; max = Math.max(max,inFlight);
    const status = requests % 3 === 0 ? 409 : 200;
    setTimeout(() => { inFlight--; res.writeHead(status); res.end('private-body'); }, 8);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const result = await sampleReads(`http://127.0.0.1:${server.address().port}`, { rounds: 9, concurrency: 3, timeoutMs: 1000 });
  assert.equal(result.samples.length,9); assert.equal(result.success,6); assert.equal(result.failures,3);
  assert.equal(max,3); assert.ok(result.p95Ms > 0);
  assert.ok(!JSON.stringify(result).includes('private-body'));
});
test('failed connections remain explicit failure samples and have no successful P95', async () => {
  const result = await sampleReads('http://127.0.0.1:1', { rounds: 2, concurrency: 1, timeoutMs: 100 });
  assert.equal(result.success,0); assert.equal(result.failures,2); assert.equal(result.p95Ms,null);
});
test('HTTP 200 error envelopes, HTML and malformed JSON cannot count as successful business reads', async t => {
  let cursor = 0;
  const bodies = [JSON.stringify({success:true,data:{}}), JSON.stringify({success:false,error:{message:'private failure'}}), '<html>login</html>', '{bad', JSON.stringify({data:{}})];
  const server = http.createServer((_req,res) => { res.setHeader('content-type','application/json'); res.end(bodies[cursor++]); });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const result = await sampleReads(`http://127.0.0.1:${server.address().port}`, { rounds: 5, concurrency: 1, timeoutMs: 1000, requireJsonSuccess: true });
  assert.equal(result.success,1); assert.equal(result.failures,4);
  assert.ok(result.samples.slice(1).every(s => s.status === 200 && s.errorCode === 'INVALID_BUSINESS_RESPONSE'));
  assert.ok(!JSON.stringify(result).includes('private failure'));
});
