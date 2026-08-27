const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BACKEND = process.env.DOCUMENT_BACKEND || 'http://localhost:4100';
const aiRoot = 'ai-cognitive';
const htmlPath = '智能知识平台/L0_02_PyTorch核心架构.html';

function encodeSegments(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

async function get(url) {
  return fetch(new URL(url, BACKEND));
}

async function run() {
  const docId = Buffer.from(`${aiRoot}:${htmlPath}`).toString('base64');
  const contentResponse = await get(`/api/document/${encodeURIComponent(docId)}/content`);
  assert.equal(contentResponse.status, 200);
  const contentPayload = await contentResponse.json();
  assert.equal(contentPayload.success, true);
  assert.equal(contentPayload.data.ext, '.html');
  assert.match(contentPayload.data.raw_url, /\/api\/document\/raw\/ai-cognitive\//);

  const rawResponse = await get(contentPayload.data.raw_url);
  const rawBytes = Buffer.from(await rawResponse.arrayBuffer());
  assert.equal(rawResponse.status, 200);
  assert.match(rawResponse.headers.get('content-type') || '', /^text\/html;\s*charset=utf-8$/);
  assert.equal(rawResponse.headers.get('content-disposition'), 'inline');
  assert.equal(rawResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.match(rawBytes.toString('utf8'), /PyTorch核心架构/);

  const siblingResponse = await get(new URL('L0_01_数学映射.html', rawResponse.url).pathname);
  assert.equal(siblingResponse.status, 200);
  assert.match(siblingResponse.headers.get('content-type') || '', /^text\/html/);

  const knowledgeCenterPath = '03-详细设计/知识中心管理-Demo.html';
  const knowledgeCenterDocId = Buffer.from(`knowledge-center:${knowledgeCenterPath}`).toString('base64');
  const knowledgeCenterContent = await get(`/api/document/${encodeURIComponent(knowledgeCenterDocId)}/content`);
  assert.equal(knowledgeCenterContent.status, 200);
  const knowledgeCenterPayload = await knowledgeCenterContent.json();
  assert.equal(knowledgeCenterPayload.success, true);
  const knowledgeCenterRaw = await get(knowledgeCenterPayload.data.raw_url);
  assert.equal(knowledgeCenterRaw.status, 200);
  assert.match(knowledgeCenterRaw.headers.get('content-type') || '', /^text\/html/);
  assert.match(Buffer.from(await knowledgeCenterRaw.arrayBuffer()).toString('utf8'), /YashanDB 知识中心/);

  for (const relativePath of [
    'unknown/file.html',
    '智能知识平台/../L0_02_PyTorch核心架构.html',
    '智能知识平台/%252e%252e%252fREADME.md',
    '智能知识平台/'
  ]) {
    const response = await get(`/api/document/raw/${aiRoot}/${encodeSegments(relativePath)}`);
    assert.equal(response.status, 404, relativePath);
    assert.doesNotMatch(await response.text(), /data\/docs|绝对路径/);
  }

  const listResponse = await get('/api/document/list');
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  const markdownDoc = listPayload.data.find(item => String(item.ext).toLowerCase() === '.md');
  assert.ok(markdownDoc, 'registered roots should contain a Markdown document');
  const markdownContent = await get(`/api/document/${encodeURIComponent(markdownDoc.id)}/content`);
  const markdownPayload = await markdownContent.json();
  assert.equal(markdownContent.status, 200);
  assert.equal(markdownPayload.data.ext, '.md');
  assert.equal(typeof markdownPayload.data.content, 'string');

  const linkPath = path.join(__dirname, '..', 'output', `.raw-preview-test-${process.pid}`);
  try {
    fs.symlinkSync('/etc/hosts', linkPath);
    const symlinkResponse = await get('/api/document/raw/output/' + path.basename(linkPath));
    assert.equal(symlinkResponse.status, 404);
  } finally {
    try { fs.unlinkSync(linkPath); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  }

  console.log(`HTML raw preview API checks passed against ${BACKEND}`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
