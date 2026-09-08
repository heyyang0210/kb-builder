/**
 * 审核与发布“阅读文档提出意见”真实 HTTP 门禁。
 *
 * 该用例不绕过 service，使用与生产相同的 incremental-build handler，
 * 验证阅读页提交的 document_span 锚点、候选冲突和权限边界。
 */
const http = require('http');
const { IncrementalBuildService, MemoryIncrementalBuildRepository, createIncrementalBuildHandler } = require('../lib/incremental-build-service');

const editor = { user: { id: 'reader-editor', displayName: '阅读作者' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
const contributor = { user: { id: 'reader-contributor', displayName: '协作编辑者' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
const reviewer = { user: { id: 'reader-reviewer', displayName: '审核成员' }, allowedActions: ['knowledge:read', 'knowledge:write', 'review:manage', 'publish:manage'] };
const readOnly = { user: { id: 'reader-only', displayName: '只读成员' }, allowedActions: ['knowledge:read'] };

function initialState() {
  return { schemaVersion: 1, tasks: [], publishedVersions: [{ id: 'reader-baseline', handbookId: 'DB-001', businessVersion: '23.4', current: true, contentDigest: 'reader-base' }], idempotency: {}, audits: [] };
}

async function startApi() {
  const repository = new MemoryIncrementalBuildRepository(initialState());
  const service = new IncrementalBuildService(repository);
  const handler = createIncrementalBuildHandler({ service });
  const server = http.createServer((req, res) => {
    const actor = req.headers['x-test-actor'];
    handler(req, res, actor === 'reviewer' ? reviewer : actor === 'readonly' ? readOnly : actor === 'contributor' ? contributor : editor);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function request(baseUrl, method, path, body, key, actor = 'editor') {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-test-actor': actor, ...(key ? { 'idempotency-key': key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function seed(baseUrl) {
  const task = await request(baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '阅读意见门禁', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'reader-baseline' }, 'reading-create');
  const id = task.body.data.id;
  await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/sources`, { sourceType: 'manual', label: '阅读意见', content: '验证物理规格' }, 'reading-source');
  await request(baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${id}/target`, { documentIds: ['doc/产品规格/物理规格.md'], sectionIds: ['YFS'], language: 'zh-CN' }, 'reading-target');
  await request(baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 0, content: '# 物理规格\n\nYFS 参数说明', operations: [{ type: 'update', documentId: 'doc/产品规格/物理规格.md', nodeId: 'YFS', beforeDigest: 'before', after: { content: 'YFS 参数说明' } }] }, 'reading-draft');
  await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/checks`, {}, 'reading-checks');
  const candidate = await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/candidate`, {}, 'reading-candidate');
  const review = await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews`, {}, 'reading-review');
  return { id, digest: candidate.body.data.digest, reviewId: review.body.data.id };
}

describe('审核阅读页意见闭环 API 门禁', () => {
  let api;
  beforeEach(async () => { api = await startApi(); });
  afterEach(() => new Promise(resolve => api.server.close(resolve)));

  test('阅读页 document_span 意见保留精确定位并出现在同一审核线程', async () => {
    const seeded = await seed(api.baseUrl);
    const result = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, {
      comment: '请核对 YFS 与 23.4 版本依赖', candidateDigest: seeded.digest,
      anchor: {
        documentId: 'doc/产品规格/物理规格.md', nodeId: 'YFS', anchorKind: 'document_span',
        lineRange: { startLine: 3, endLine: 3 }, charRange: { startChar: 0, endChar: 12 },
        selectedText: 'YFS 参数说明', contextBefore: '# 物理规格', contextAfter: '',
      },
    }, 'reading-comment');
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data).toMatchObject({ commentType: 'suggestion', severity: 'normal', mode: 'anchored', anchorStatus: 'valid', candidateDigest: seeded.digest, anchor: { anchorKind: 'document_span', nodeId: 'YFS', selectedText: 'YFS 参数说明' } });
    const listed = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, undefined, undefined, 'reviewer');
    expect(listed.body.data).toHaveLength(1);
  });

  test('候选摘要冲突拒绝意见且不会落库，调用方可保留原输入后重试', async () => {
    const seeded = await seed(api.baseUrl);
    const result = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, { comment: '待重试意见', candidateDigest: 'stale-digest', anchor: { documentId: 'doc/产品规格/物理规格.md', nodeId: 'YFS', anchorKind: 'document_span' } }, 'reading-conflict');
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('REVIEW_CANDIDATE_CONFLICT');
    const listed = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, undefined, undefined, 'reviewer');
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(0);
  });

  test('只读阅读角色不能提交意见', async () => {
    const seeded = await seed(api.baseUrl);
    const result = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, { comment: '越权意见', candidateDigest: seeded.digest }, 'reading-forbidden', 'readonly');
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('ACTION_FORBIDDEN');
  });

  test('知识编辑者可读取审核中候选并提出意见，但不能编辑候选', async () => {
    const seeded = await seed(api.baseUrl);
    const readable = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${seeded.id}`, undefined, undefined, 'contributor');
    expect(readable).toMatchObject({ status: 200, body: { data: { capabilities: { canComment: true, canEdit: false, canReview: false, canPublish: false } } } });
    const comment = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/comments`, { comment: '编辑者提出的普通意见', severity: 'normal', candidateDigest: seeded.digest }, 'contributor-comment', 'contributor');
    expect(comment).toMatchObject({ status: 200, body: { data: { severity: 'normal' } } });
    const update = await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${seeded.id}/draft`, { editVersion: 0, content: '越权修改', operations: [] }, 'contributor-edit', 'contributor');
    expect(update.status).toBe(404);
  });

  test('具备审核能力的账号可作出审核决定，权限由服务端能力控制', async () => {
    const seeded = await seed(api.baseUrl);
    const result = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${seeded.id}/reviews/${seeded.reviewId}/decision`, { decision: 'approve', comment: '本人复核通过' }, 'reading-self-review', 'reviewer');
    expect(result.status).toBe(200);
    expect(result.body.data.status).toBe('approved');
  });
});
