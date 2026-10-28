const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./fixtures/production-writing.cjs');
const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
const suffix = '/handbooks/HB-1/documents/doc-1';
const query = new URLSearchParams(ctx);
async function pdf() {
  const browser = await require('playwright').chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<p>SELECT reference content</p>');
    return await page.pdf();
  } finally { await browser.close(); }
}
function docx() {
  const zip = new (require('adm-zip'))();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  zip.addFile('word/document.xml', Buffer.from('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>SELECT Word 引用正文</w:t></w:r></w:p></w:body></w:document>'));
  return zip.toBuffer();
}
async function upload(api, name, body, context = ctx) {
  return api.request('POST', `${suffix}/ai-sources/uploads?${new URLSearchParams(context)}`, body, { 'x-file-name': encodeURIComponent(name), 'content-type': 'application/octet-stream' });
}
async function completed(api, id) {
  for (let i = 0; i < 100; i++) {
    const response = await api.request('GET', `${suffix}/ai-jobs/${id}?${query}`);
    if (['completed','failed'].includes(response.body.data.status)) return response.body.data;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('任务未完成');
}
test('上传真实HTTP：TXT/Markdown/PDF/DOCX成功，伪造、损坏、空文件、编码及大小限制', async t => {
  const api = await setup(t);
  for (const [name, body, match] of [['a.txt', Buffer.from('文本依据'), /文本依据/],['a.md',Buffer.from('# 标题\n\n正文'),/# 标题/],['a.pdf',await pdf(),/SELECT reference content/],['a.docx',docx(),/SELECT Word 引用正文/]]) {
    const response = await upload(api, name, body);
    assert.equal(response.status, 201, name + JSON.stringify(response.body));
    assert.match(response.body.data.content, match); assert.equal(response.body.data.sourceType, 'local-document');
    assert.equal(response.body.data.contentDigest.length, 64);
  }
  for (const [name, body, status] of [['a.exe',Buffer.from('txt'),400],['a.pdf',Buffer.from('not pdf'),422],['a.docx',Buffer.from('broken zip'),422],['a.txt',Buffer.alloc(0),422],['a.txt',Buffer.from([0xff,0xfe]),422],['a.txt',Buffer.from('binary\0'),422],['a.txt',Buffer.from(' '),422],['a.txt',Buffer.alloc(262145,65),413]]) {
    const response = await upload(api,name,body); assert.equal(response.status,status,JSON.stringify(response.body));
  }
});
test('引用顺序契约：非法顺序拒绝、请求幂等冲突、正文快照顺序及跨上下文隔离', async t => {
  let captured;
  const api = await setup(t, { ai: { generate: async messages => { captured = JSON.parse(messages.at(-1).content); return {content:'修订内容',model:'deterministic'}; } } });
  const a = (await upload(api,'a.md',Buffer.from('# A'))).body.data;
  const b = (await upload(api,'b.md',Buffer.from('# B'))).body.data;
  const base = { ...ctx, operation:'polish',markdown:'原始正文',range:{start:0,end:4},editVersion:0,confirmedSourceIds:[a.sourceId,b.sourceId],requirements:'修订' };
  const start = (body,key) => api.request('POST', `${suffix}/ai-jobs`,JSON.stringify(body),{'content-type':'application/json','idempotency-key':key});
  for (const referenceOrder of ['bad',[],[a.sourceId,b.sourceId],[a.sourceId,a.sourceId,'knowledge-mcp'],[a.sourceId,'missing','knowledge-mcp']]) {
    const response = await start({...base,referenceOrder},'invalid-'+JSON.stringify(referenceOrder));
    assert.equal(response.status,400,JSON.stringify(response.body)); assert.equal(response.body.error.code,'AI_REFERENCE_ORDER_INVALID');
  }
  const referenceOrder = [b.sourceId,'knowledge-mcp',a.sourceId];
  const created = await start({...base,referenceOrder},'priority-one'); assert.equal(created.status,202,JSON.stringify(created.body));
  const id = created.body.data.jobId;
  const repeated = await start({...base,referenceOrder},'priority-one'); assert.equal(repeated.body.data.jobId,id);
  const conflict = await start({...base,referenceOrder:[a.sourceId,'knowledge-mcp',b.sourceId]},'priority-one'); assert.equal(conflict.status,409);
  const job = await completed(api,id); assert.equal(job.status,'completed',JSON.stringify(job));
  assert.deepEqual(job.referenceOrder,referenceOrder);
  assert.deepEqual(captured.sources.map(s=>s.title),['b.md','a.md']);
  const foreign = await start({...base,branch:'other',referenceOrder},'foreign-context'); assert.equal(foreign.status,404,JSON.stringify(foreign.body));
});
test('只读用户不能上传本地参考文档', async t => {
  const api = await setup(t,{session:{authenticated:true,user:{id:'reader',roles:['READER']},allowedActions:['knowledge:read']}});
  const response = await upload(api,'a.txt',Buffer.from('正文')); assert.equal(response.status,403,JSON.stringify(response.body));
});
