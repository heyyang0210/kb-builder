const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');

function fixture() {
  const auth = http.createServer((req, res) => {
    const role = req.headers.cookie || '';
    if (!role) { res.writeHead(401); res.end('{}'); return; }
    const actions = role === 'edit' ? ['template:read','template:edit'] : role === 'read' ? ['template:read'] : role === 'knowledge' ? ['knowledge:write'] : [];
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ content: { allowedActions: actions, roles: role.includes('admin') ? ['PLATFORM_ADMIN'] : [], user: { id: 'test-user' } } }));
  });
  return auth;
}
async function setup() {
  const auth = fixture(); await new Promise(r => auth.listen(0, r));
  // Real route/domain HTTP, deliberately isolated authentication and persistence doubles.
  let state = { schemaVersion: 1, templates: [], audits: [] };
  const store = { read: () => structuredClone(state), transaction(mutator) { const draft = structuredClone(state); const result = mutator(draft); state = draft; return structuredClone(result); } };
  const templateStore = createTemplateStore({ store });
  const handler = createKnowledgeCenterHandler({ config: { KNOWLEDGE_CENTER_PREFIX:'/knowledge-center', KNOWLEDGE_CENTER_ROOT:'/tmp', KNOWLEDGE_CENTER_ENTRY:'index.html', PINGCODE_PREFIX:'/pingcode', PINGCODE_ROOT:'/tmp', DOCUMENT_API_HOST:'127.0.0.1', DOCUMENT_API_PORT:1, PINGCODE_API_HOST:'127.0.0.1', PINGCODE_API_PORT:1, PLATFORM_CONTEXT_TIMEOUT_MS:1000, AUTH_API_HOST:'127.0.0.1', AUTH_API_PORT:auth.address().port, GITLAB_CONFIG_PATH:'/tmp/x', GITLAB_DOCUMENT_TYPES_PATH:'/tmp/x' }, stores: { knowledgeAssetsStore: { read:()=>({handbooks:[]}), write(){} }, templateStore }, sendFile(_p,res){res.writeHead(404);res.end();}, proxyAuth(){}, proxyCleaning(){}, proxyOutline(){}, proxyPermission(){}, handleIncrementalBuild(){} });
  const server = http.createServer((req,res)=>handler(req,res)); await new Promise(r=>server.listen(0,r));
  const close = () => Promise.all([new Promise(r=>server.close(r)), new Promise(r=>auth.close(r))]);
  return { base:`http://127.0.0.1:${server.address().port}`, close, snapshot: store.read };
}
async function request(base, path, opts={}) { const r = await fetch(base+path, { ...opts, headers: { ...(opts.body ? {'content-type':'application/json'} : {}), ...(opts.headers||{}) } }); return { status:r.status, body:await r.json() }; }

test('template P1 permissions, save, conflict and validation', async t => {
  const s = await setup(); t.after(s.close);
  assert.equal((await request(s.base,'/knowledge-center/api/templates')).status, 401);
  assert.equal((await request(s.base,'/knowledge-center/api/templates',{headers:{cookie:'knowledge'}})).status, 403);
  assert.equal((await request(s.base,'/knowledge-center/api/templates',{headers:{cookie:'read'}})).status, 200);
  assert.equal((await request(s.base,'/knowledge-center/api/templates',{method:'POST',headers:{cookie:'read'},body:'{}'})).status, 403);
  const created = await request(s.base,'/knowledge-center/api/templates',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({id:'p1',name:'P1',content:'# hello'})});
  assert.equal(created.status,201);
  const saved = await request(s.base,'/knowledge-center/api/templates/p1/save',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({baseVersion:1,content:'# changed',changeSummary:'test'})});
  assert.equal(saved.status,200); assert.equal(saved.body.data.current.version,2); assert.match(saved.body.data.current.contentHash,/^sha256:/);
  assert.equal(saved.body.data.current.contentHash, `sha256:${crypto.createHash('sha256').update('# changed').digest('hex')}`);
  assert.equal((await request(s.base,'/knowledge-center/api/templates/p1',{headers:{cookie:'knowledge'}})).status,403);
  assert.equal((await request(s.base,'/knowledge-center/api/templates/p1/versions',{headers:{cookie:'knowledge'}})).status,403);
  assert.equal((await request(s.base,'/knowledge-center/api/templates/p1/save',{method:'POST',headers:{cookie:'knowledge'},body:JSON.stringify({baseVersion:2,content:'# unauthorized'})})).status,403);
  assert.equal((await request(s.base,'/knowledge-center/api/templates/p1/save',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({baseVersion:1,content:'# stale'})})).body.error.code,'TEMPLATE_VERSION_CONFLICT');
  const bad = await request(s.base,'/knowledge-center/api/templates/p1/save',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({baseVersion:2,content:'password: secretvalue123'})});
  assert.equal(bad.status,422); assert.equal((await request(s.base,'/knowledge-center/api/templates/p1',{headers:{cookie:'read'}})).body.data.currentVersion,2);
  const empty = await request(s.base,'/knowledge-center/api/templates/p1/save',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({baseVersion:2,content:'',validationStatus:'passed'})});
  assert.equal(empty.status,422);
  assert.equal((await request(s.base,'/knowledge-center/api/templates/p1/disable',{method:'POST',headers:{cookie:'edit'},body:'{}'})).status,403);
  assert.equal((await request(s.base,'/knowledge-center/api/templates/p1/disable',{method:'POST',headers:{cookie:'admin'},body:'{}'})).status,200);
  assert.equal((await request(s.base,'/knowledge-center/api/templates/p1/restore',{method:'POST',headers:{cookie:'admin'},body:'{}'})).status,200);
  const history = await request(s.base,'/knowledge-center/api/templates/p1/versions',{headers:{cookie:'read'}});
  assert.equal(history.body.data[0].content,'# hello');
  const competing = await Promise.all(['A','B'].map(text => request(s.base,'/knowledge-center/api/templates/p1/save',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({baseVersion:2,content:`# ${text}`})})));
  assert.deepEqual(competing.map(r => r.status).sort(),[200,409]);
});

test('malformed JSON is rejected', async t => { const s=await setup(); t.after(s.close); const r=await request(s.base,'/knowledge-center/api/templates',{method:'POST',headers:{cookie:'edit'},body:'{bad'}); assert.equal(r.status,400); });

test('non-JSON media type is rejected', async t => { const s=await setup(); t.after(s.close); const r=await request(s.base,'/knowledge-center/api/templates',{method:'POST',headers:{cookie:'edit','content-type':'text/plain'},body:'{}'}); assert.equal(r.status,400); });

test('JSON objects are mandatory and authorization precedes parsing', async t => {
  const s = await setup(); t.after(s.close);
  for (const body of ['', '{}', 'null', '[]', '"text"', '42']) {
    const response = await request(s.base, '/knowledge-center/api/templates', {method:'POST',headers:{cookie:'edit','content-type':'application/json; charset=utf-8'},body});
    assert.equal(response.status,400, `body ${body}`);
    assert.equal(response.body.error.code,'TEMPLATE_INVALID_JSON');
  }
  const forbidden = await request(s.base, '/knowledge-center/api/templates', {method:'POST',headers:{cookie:'read'},body:'{invalid'});
  assert.equal(forbidden.status,403);
  assert.equal(forbidden.body.error.code,'TEMPLATE_PERMISSION_DENIED');
  assert.deepEqual(s.snapshot(), {schemaVersion:1,templates:[],audits:[]});
});

test('missing template errors and bodyless management follow P1 contract', async t => {
  const s = await setup(); t.after(s.close);
  for (const suffix of ['', '/versions']) {
    const r = await request(s.base, `/knowledge-center/api/templates/missing${suffix}`,{headers:{cookie:'read'}});
    assert.equal(r.status,404); assert.equal(r.body.error.code,'TEMPLATE_NOT_FOUND');
  }
  await request(s.base,'/knowledge-center/api/templates',{method:'POST',headers:{cookie:'admin'},body:JSON.stringify({id:'managed',content:'普通 Markdown 文本'})});
  for (const [action,status] of [['disable','disabled'],['restore','active']]) {
    const r = await request(s.base,`/knowledge-center/api/templates/managed/${action}`,{method:'POST',headers:{cookie:'admin'}});
    assert.equal(r.status,200); assert.equal(r.body.data.status,status);
  }
});

test('create/save reject non-string content without changing versions or audit', async t => {
  const s = await setup(); t.after(s.close);
  await request(s.base,'/knowledge-center/api/templates',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({id:'types',content:'# Initial'})});
  const baseline = s.snapshot();
  for (const content of [{section:'bad'},['bad'],42,true,'\u0000binary']) {
    for (const [path,payload] of [['/types/save',{baseVersion:1,content}]]) {
      const r = await request(s.base,`/knowledge-center/api/templates${path}`,{method:'POST',headers:{cookie:'edit'},body:JSON.stringify(payload)});
      assert.equal(r.status,422, `${path} content ${JSON.stringify(content)}`);
      assert.equal(r.body.error.code,'TEMPLATE_VALIDATION_FAILED');
      assert.deepEqual(s.snapshot(),baseline);
    }
  }
});

test('baseVersion is a positive integer, rejected writes preserve all state', async t => {
  const s = await setup(); t.after(s.close);
  await request(s.base,'/knowledge-center/api/templates',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({id:'versions',content:'# Initial'})});
  const baseline = s.snapshot();
  for (const baseVersion of [true, [1], '1', null, 0, -1, 1.5]) {
    const r = await request(s.base,'/knowledge-center/api/templates/versions/save',{method:'POST',headers:{cookie:'edit'},body:JSON.stringify({baseVersion,content:'# Changed'})});
    assert.equal(r.status, 409, `baseVersion ${JSON.stringify(baseVersion)}`);
    assert.equal(r.body.error.code,'TEMPLATE_VERSION_CONFLICT');
    assert.deepEqual(s.snapshot(),baseline);
  }
});

test('structured credential fields are rejected', async t => {
  const s = await setup(); t.after(s.close);
  const r = await request(s.base, '/knowledge-center/api/templates', {
    method: 'POST', headers: { cookie: 'edit' },
    body: JSON.stringify({ id: 'secret-json', content: '{"password":"secretvalue123"}' }),
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, 'TEMPLATE_VALIDATION_FAILED');
});
