const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createHandbookProductionService } = require('../../../packages/agent-runner-core/lib/handbook-production-service');

const repositoryRoot = path.resolve(__dirname, '../../..');
const editor = {
  authenticated: true,
  user: { id: 'author-1', displayName: '文档作者', roles: ['KNOWLEDGE_EDITOR'] },
  allowedActions: ['knowledge:read', 'knowledge:write'],
};

function memoryStore() {
  let state = { schemaVersion: 1, drafts: {}, attachments: {}, reviewBatches: [], idempotency: {}, audits: [] };
  return {
    read: () => structuredClone(state),
    transaction(mutator) {
      const next = structuredClone(state);
      const result = mutator(next);
      state = next;
      return structuredClone(result);
    },
  };
}

async function setup(t) {
  const attachmentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-production-api-'));
  const store = memoryStore();
  const service = createHandbookProductionService({ store, attachmentRoot });
  const authModule = {
    authorize: async () => editor,
    repository: {
      listUsers: () => [
        { id: 'author-1', displayName: '文档作者', roles: ['KNOWLEDGE_EDITOR'] },
        { id: 'reviewer-1', displayName: '独立审核人', roles: ['REVIEWER'] },
      ],
    },
  };
  const handler = createKnowledgeCenterHandler({
    config: {
      KNOWLEDGE_CENTER_PREFIX: '/knowledge-center',
      KNOWLEDGE_CENTER_ROOT: '/tmp',
      KNOWLEDGE_CENTER_ENTRY: 'index.html',
      OUTLINE_TEMPLATE_PATH: path.join(repositoryRoot, 'knowledge/outlines/大纲模板.xlsx'),
      OUTLINE_SAMPLE_PATH: path.join(repositoryRoot, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
      PINGCODE_PREFIX: '/pingcode',
      PINGCODE_ROOT: '/tmp',
      DOCUMENT_API_HOST: '127.0.0.1',
      DOCUMENT_API_PORT: 1,
      PINGCODE_API_HOST: '127.0.0.1',
      PINGCODE_API_PORT: 1,
      PLATFORM_CONTEXT_TIMEOUT_MS: 1000,
      AUTH_API_HOST: '127.0.0.1',
      AUTH_API_PORT: 1,
      GITLAB_CONFIG_PATH: '/tmp/not-used',
      GITLAB_DOCUMENT_TYPES_PATH: '/tmp/not-used',
      DATABASE_CONNECTION_CONFIG_PATH: '/tmp/not-used',
    },
    stores: {
      knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} },
      manualStatusStore: {},
      brandIconStore: {},
      domainStore: {},
    },
    moduleRegistry: { get: name => name === 'auth' ? authModule : null },
    handbookProductionService: service,
    databaseConnectionGovernance: {},
    sendFile(_filePath, res) { res.writeHead(404); res.end(); },
    proxyAuth() {},
    proxyCleaning() {},
    proxyOutline() {},
    proxyPermission() {},
    handleIncrementalBuild() {},
  });
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    server.closeIdleConnections();
    fs.rmSync(attachmentRoot, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/knowledge-center/api/production`;
  async function request(method, suffix, body, headers = {}) {
    const response = await fetch(`${baseUrl}${suffix}`, {
      method,
      headers: { accept: 'application/json', ...headers },
      body,
    });
    const contentType = response.headers.get('content-type') || '';
    return {
      status: response.status,
      body: contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer()),
    };
  }
  return { request };
}

function draftPath(suffix = '') {
  return `/handbooks/HB-1/documents/doc-1/draft${suffix}`;
}

const query = '?outlineVersionId=outline-v1&branch=main';
const json = (value, key) => ({
  body: JSON.stringify(value),
  headers: {
    'content-type': 'application/json',
    ...(key ? { 'idempotency-key': key } : {}),
  },
});

test('shared draft HTTP contract covers empty read, save, idempotency, conflict and restore', async t => {
  const api = await setup(t);
  const empty = await api.request('GET', `${draftPath()}${query}`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.data.exists, false);

  const payload = {
    outlineVersionId: 'outline-v1', branch: 'main', baselineDigest: 'baseline-a', editVersion: 0,
    markdown: '# 参数\n', htmlSnapshot: '<h1>参数</h1><script>alert(1)</script>', templateVersionId: 'template-v1', attachmentIds: [],
  };
  const firstInput = json(payload, 'save-1');
  const saved = await api.request('PUT', draftPath(), firstInput.body, firstInput.headers);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.draft.editVersion, 1);
  assert.doesNotMatch(saved.body.data.draft.revision.htmlSnapshot, /script/i);

  const replay = await api.request('PUT', draftPath(), firstInput.body, firstInput.headers);
  assert.equal(replay.body.data.draft.currentRevisionId, saved.body.data.draft.currentRevisionId);

  const conflictInput = json({ ...payload, markdown: '# 过期修改\n' }, 'save-stale');
  const conflict = await api.request('PUT', draftPath(), conflictInput.body, conflictInput.headers);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'DRAFT_VERSION_CONFLICT');
  assert.equal(conflict.body.error.details.serverDraft.editVersion, 1);

  const history = await api.request('GET', `${draftPath('/revisions')}${query}`);
  assert.equal(history.body.data.items.length, 1);
  const restoreInput = json({ outlineVersionId: 'outline-v1', branch: 'main', editVersion: 1, revisionId: history.body.data.items[0].revisionId }, 'restore-1');
  const restored = await api.request('POST', draftPath('/restore'), restoreInput.body, restoreInput.headers);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.draft.editVersion, 2);
  assert.equal(restored.body.data.draft.revision.restoredFromRevisionId, history.body.data.items[0].revisionId);
});

test('attachment and review batch HTTP contracts bind stable content and clone the work draft', async t => {
  const api = await setup(t);
  const attachment = await api.request('POST', `/handbooks/HB-1/documents/doc-1/draft-attachments${query}`, Buffer.from('image-bytes'), {
    'content-type': 'image/png',
    'x-file-name': encodeURIComponent('图片.png'),
  });
  assert.equal(attachment.status, 201, JSON.stringify(attachment.body));
  assert.equal(attachment.body.data.scanStatus, 'validated');

  const saveInput = json({
    outlineVersionId: 'outline-v1', branch: 'main', baselineDigest: 'baseline-a', editVersion: 0,
    markdown: `# 文档\n\n![图片](${attachment.body.data.stableReference})\n`, htmlSnapshot: '<h1>文档</h1>',
    attachmentIds: [attachment.body.data.attachmentId],
  }, 'save-with-attachment');
  const saved = await api.request('PUT', draftPath(), saveInput.body, saveInput.headers);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const binary = await api.request('GET', attachment.body.data.stableReference.replace('/knowledge-center/api/production', ''));
  assert.equal(binary.status, 200);
  assert.deepEqual(binary.body, Buffer.from('image-bytes'));

  const reviewers = await api.request('GET', '/handbooks/HB-1/reviewers');
  assert.equal(reviewers.status, 200);
  assert.deepEqual(reviewers.body.data.items.map(item => item.id), ['reviewer-1']);

  const batchInput = json({
    documents: [{ documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main', draftRevisionId: saved.body.data.draft.currentRevisionId, reviewerIds: ['reviewer-1'] }],
  }, 'batch-1');
  const batch = await api.request('POST', '/handbooks/HB-1/review-batches', batchInput.body, batchInput.headers);
  assert.equal(batch.status, 201, JSON.stringify(batch.body));
  assert.equal(batch.body.data.documents[0].state, 'pending');

  const current = await api.request('GET', `${draftPath()}${query}`);
  assert.equal(current.body.data.draft.editVersion, 2);
  assert.equal(current.body.data.draft.reviewState.revisionId, saved.body.data.draft.currentRevisionId);
  assert.equal(current.body.data.draft.revision.clonedFromRevisionId, saved.body.data.draft.currentRevisionId);
});
