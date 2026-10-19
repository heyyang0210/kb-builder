const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { reviewDocuments } = require('../../../packages/agent-runner-core/lib/review-workbench');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { MemoryIncrementalBuildRepository, IncrementalBuildService, createIncrementalBuildHandler } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

function task(id = 'task-1', handbookId = 'HB-1', overrides = {}) {
  return {
    id, handbookId, businessVersion: 'v1', state: 'under_review', createdBy: { id: 'author' },
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
    candidate: { digest: `digest-${id}`, operations: [] },
    handbookSource: { branch: 'release', documents: [
      { documentId: 'a', filePath: 'docs/a.md', title: '甲', reviewerIds: ['reviewer'] },
      { documentId: 'b', filePath: 'docs/b.md', title: '乙', reviewerIds: ['author'] },
    ] },
    reviews: [{ id: `review-${id}`, candidateDigest: `digest-${id}`, status: 'pending', reviewerIds: ['author', 'reviewer'], submittedBy: { id: 'author' }, submittedAt: '2026-01-02T00:00:00Z', comments: [] }],
    ...overrides,
  };
}
const session = (id = 'author', actions = ['knowledge:read', 'knowledge:write', 'review:manage']) => ({ authenticated: true, user: { id, roles: ['REVIEWER'] }, allowedActions: actions });

describe('审核工作台文档投影契约', () => {
  test('文档显式指派优先于候选指派，自审要求权限且不修改输入', () => {
    const source = task(); const before = structuredClone(source);
    expect(reviewDocuments([source], 'reviewer', true).filter(row => row.assignedToMe).map(row => row.documentId)).toEqual(['a']);
    expect(reviewDocuments([source], 'author', true).filter(row => row.assignedToMe).map(row => row.documentId)).toEqual(['b']);
    expect(reviewDocuments([source], 'author', false).every(row => !row.assignedToMe)).toBe(true);
    expect(reviewDocuments([source], 'unassigned', true).every(row => !row.assignedToMe)).toBe(true);
    expect(reviewDocuments([source], 'reviewer', true)[0].assignedBy).toEqual({ id: 'author' });
    const legacy = task('legacy'); delete legacy.reviews[0].submittedBy;
    expect(reviewDocuments([legacy], 'reviewer', true)[0].assignedBy).toBeNull();
    expect(source).toEqual(before);
  });

  test('仅当前候选最新审核决定计入待办，旧候选与终态不得复活', () => {
    const source = task();
    source.reviews.unshift({ ...source.reviews[0], id: 'old-digest', candidateDigest: 'old' });
    source.reviews.push({ ...source.reviews[1], id: 'latest', status: 'approved', decision: { decidedAt: '2026-01-03' } });
    const rows = reviewDocuments([source], 'author', true);
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.reviewId === 'latest' && !row.assignedToMe && row.decidedAt === '2026-01-03')).toBe(true);
    for (const state of ['approved', 'rejected', 'published', 'mr_submitted', 'draft']) {
      expect(reviewDocuments([{ ...task(), state }], 'author', true).every(row => !row.assignedToMe)).toBe(true);
    }
    expect(reviewDocuments([{ ...task(), candidate: null }], 'author', true)).toEqual([]);
    expect(reviewDocuments([{ ...task(), reviews: [{ candidateDigest: 'wrong' }] }], 'author', true)).toEqual([]);
  });

  test('文档按候选键去重，不同任务或候选摘要保留独立历史', () => {
    const source = task(); source.handbookSource.documents.push(source.handbookSource.documents[0]);
    const another = task('task-2');
    const revised = task('task-1', 'HB-1', { candidate: { digest: 'revised', operations: [] }, reviews: [{ ...source.reviews[0], candidateDigest: 'revised' }] });
    const rows = reviewDocuments([source, source, another, revised], 'reviewer', true);
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map(row => row.id)).size).toBe(6);
    expect(rows[0].branch).toBe('release');
  });

  test('全局意见与文档锚定意见按范围统计，不串入其他文档', () => {
    const source = task(); source.reviews[0].comments = [
      { id: 'global' }, { id: 'a', anchor: { documentId: 'a' } },
      { id: 'b', anchor: { path: 'docs/b.md' } }, { id: 'other', anchor: { documentId: 'other', path: 'docs/other.md' } },
    ];
    expect(reviewDocuments([source], 'reviewer', true).map(row => row.opinionCount)).toEqual([2, 2]);
  });

  test('通用增量任务保留目标和操作文档并去重，采用审核级指派', () => {
    const source = task('generic', 'HB-1', { handbookSource: null, target: { documentIds: ['a'] }, candidate: { digest: 'digest-generic', operations: [{ documentId: 'a', path: 'docs/a.md' }, { documentId: 'b', path: 'docs/b.md' }] } });
    expect(reviewDocuments([source], 'reviewer', true).map(row => [row.documentId, row.path, row.assignedToMe, row.assignedBy])).toEqual([['a', 'docs/a.md', true, null], ['b', 'docs/b.md', true, null]]);
  });

  test('历史稀疏候选使用文档 ID 回退，改派来源优先显示实际操作者', () => {
    const generic = task('sparse', 'HB-1', {
      handbookSource: null,
      target: { documentIds: ['legacy'] },
      candidate: { digest: 'digest-sparse' },
      reviews: [{ id: 'sparse-review', candidateDigest: 'digest-sparse', status: 'pending', reviewerIds: ['reviewer'] }],
    });
    const reassigned = task('reassigned');
    reassigned.reviews[0].assignment = { updatedBy: { id: 'manager', displayName: '管理员' } };
    reassigned.reviews[0].submittedAt = undefined;
    const rows = reviewDocuments([generic, reassigned], ['reviewer'], true);
    expect(rows.find(row => row.taskId === 'sparse')).toMatchObject({
      documentId: 'legacy', path: 'legacy', title: 'legacy', assignedToMe: true,
    });
    expect(rows.filter(row => row.taskId === 'reassigned').map(row => row.assignedBy)).toEqual([
      { id: 'manager', displayName: '管理员' }, { id: 'manager', displayName: '管理员' },
    ]);
    expect(reviewDocuments([{ ...generic, reviews: undefined }], 'reviewer', true)).toEqual([]);
  });
});

describe('审核工作台真实 HTTP 契约与规模边界', () => {
  let root; let server; let base; let repository;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-workbench-contract-'));
    const configPath = path.join(root, 'gitlab.json');
    fs.writeFileSync(configPath, JSON.stringify({ connections: [], mappings: [] }));
    const assets = Array.from({ length: 125 }, (_, index) => ({ handbookId: `HB-${index + 1}`, name: `手册${String(index + 1).padStart(3, '0')}`, status: index === 124 ? 'handbook_published' : 'content_building' }));
    assets.push({ handbookId: 'early', status: 'outline_published' }, { handbookId: 'archived', status: 'content_building', archivedAt: '2026-01-01' });
    repository = new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [task(), task('last-page', 'HB-125'), task('hidden-archive', 'archived')], publishedVersions: [{ id: 'published-baseline', handbookId: 'HB-1', businessVersion: 'v1', current: true, content: '# 已发布整本正文' }], idempotency: {}, audits: [] });
    const service = new IncrementalBuildService(repository);
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, GITLAB_CONFIG_PATH: configPath, OUTLINE_TEMPLATE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/基本数据库管理手册大纲示例.xlsx') },
      KNOWLEDGE_ASSETS_CONFIG_PATH: configPath,
      stores: { knowledgeAssetsStore: { read: () => ({ generatedAt: 'fixture', handbooks: assets }) }, manualStatusStore: {}, brandIconStore: {}, domainStore: {} },
      moduleRegistry: { get: name => name === 'auth' ? {
        authorize: async req => ({ ...session(req.headers['x-user'] || 'author', req.headers['x-read-only'] ? ['knowledge:read'] : req.headers['x-publish'] ? ['knowledge:read', 'knowledge:write', 'review:manage', 'publish:manage'] : undefined), ...(req.headers['x-principal'] ? { principalId: Number(req.headers['x-principal']), user: { id: req.headers['x-user'] || 'author', principalId: Number(req.headers['x-principal']), roles: ['REVIEWER'] } } : {}), ...(req.headers['x-visible'] !== undefined ? { visibleHandbookIds: JSON.parse(req.headers['x-visible']) } : {}) }),
        repository: { listUsers: () => [{ id: 'usr_heyang', principalId: 178, displayName: '何阳', roles: ['REVIEWER'] }, { id: 'usr_reviewer', principalId: 179, displayName: '审核员甲', roles: ['REVIEWER'] }] },
      } : null },
      handleIncrementalBuild: createIncrementalBuildHandler({ service }), databaseConnectionGovernance: {},
      sendFile(_file, res) { res.writeHead(404); res.end(); },
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/review/bootstrap`;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });
  async function get(query = '', headers = {}) {
    const response = await fetch(base + query, { headers });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }

  test('真实 HTTP：改派单篇后待办转移，审核角色可终止误提任务并保留审计', async () => {
    const source = task('reassign-cancel', 'HB-1');
    source.handbookSource.documents = [{ documentId: 'a', filePath: 'docs/a.md', reviewerIds: ['178'] }];
    source.reviews[0].reviewerIds = ['178'];
    repository.transaction(state => state.tasks.push(source));
    const endpoint = base.replace('/review/bootstrap', `/review/tasks/${source.id}/reviews/${source.reviews[0].id}/reviewers`);
    const command = async (url, method, body, headers = {}) => {
      const response = await fetch(url, { method, headers: { 'content-type': 'application/json', 'idempotency-key': `${method}-${source.id}-${Math.random().toString(36).slice(2)}`, ...headers }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    try {
      expect((await get('?view=mine', { 'x-user': 'usr_heyang', 'x-principal': '178' })).body.data.workbench.mine.some(row => row.taskId === source.id)).toBe(true);
      expect((await command(endpoint, 'PUT', { documentId: 'a', candidateDigest: source.candidate.digest, reviewerIds: ['179'] }, { 'x-user': 'other' })).status).toBe(404);
      expect((await command(endpoint, 'PUT', { documentId: 'a', candidateDigest: source.candidate.digest, reviewerIds: ['999'] })).status).toBe(422);
      expect((await command(endpoint, 'PUT', { documentId: 'a', candidateDigest: source.candidate.digest, reviewerIds: ['179'] })).status).toBe(200);
      expect((await get('?view=mine', { 'x-user': 'usr_heyang', 'x-principal': '178' })).body.data.workbench.mine.some(row => row.taskId === source.id)).toBe(false);
      expect((await get('?view=mine', { 'x-user': 'usr_reviewer', 'x-principal': '179' })).body.data.workbench.mine.some(row => row.taskId === source.id)).toBe(true);
      const cancelUrl = base.replace('/review/bootstrap', `/incremental-tasks/${source.id}/reviews/${source.reviews[0].id}/cancel`);
      expect((await command(cancelUrl, 'POST', { candidateDigest: source.candidate.digest, reason: '误提', }, { 'x-user': 'usr_reviewer', 'x-principal': '179' })).status).toBe(200);
      expect((await get('?view=documents&handbookId=HB-1')).body.data.workbench.documents.some(row => row.taskId === source.id)).toBe(false);
      expect(repository.read().tasks.find(item => item.id === source.id).state).toBe('cancelled');
      expect(repository.read().audits.filter(item => item.taskId === source.id).map(item => item.action)).toEqual(['REVIEWERS_REASSIGNED', 'REVIEW_CANCELLED']);
      expect((await command(cancelUrl, 'POST', { candidateDigest: source.candidate.digest, reason: '再次终止' }, { 'x-user': 'usr_reviewer', 'x-principal': '179' })).status).toBe(409);
    } finally {
      repository.transaction(state => { state.tasks = state.tasks.filter(item => item.id !== source.id); });
    }
  });

  test('超过100本仍完整汇总，末页任务不丢失，排除早期和归档资产', async () => {
    const result = await get();
    expect(result.status).toBe(200);
    const data = result.body.data;
    expect(data.view).toBe('handbooks'); expect(data.detail).toBeNull();
    expect(data.workbench.handbooks).toHaveLength(125);
    expect(data.workbench.handbooks.find(item => item.handbookId === 'HB-125')).toMatchObject({ reviewCount: 2, pendingCount: 2 });
    expect(data.workbench.documents).toHaveLength(4);
    expect(data.workbench.mine.map(row => row.taskId).sort()).toEqual(['last-page', 'task-1']);
    expect(result.headers.get('cache-control')).toBe('no-store');
  });

  test('可见范围优先于所有者，空范围不泄漏计数/文档/正文', async () => {
    const limited = await get('?view=handbooks', { 'x-visible': '["HB-125"]' });
    expect(limited.body.data.workbench.handbooks.map(item => item.handbookId)).toEqual(['HB-125']);
    expect(limited.body.data.workbench.documents.every(item => item.handbookId === 'HB-125')).toBe(true);
    expect((await get('?view=mine', { 'x-visible': '[]' })).body.data.workbench).toEqual({ handbooks: [], documents: [], mine: [] });
    const denied = await get('?view=reader&taskId=task-1', { 'x-visible': '["HB-125"]' });
    expect(denied.status).toBe(404); expect(denied.body.data).toBeUndefined();
  });

  test('自审只展示显式文档；资格或指派不足不产生个人待办', async () => {
    const self = (await get('?view=mine')).body.data.workbench.mine;
    expect(self.every(row => row.documentId === 'b')).toBe(true);
    expect((await get('?view=mine', { 'x-user': 'unassigned' })).body.data.workbench.mine).toEqual([]);
    expect((await get('?view=mine', { 'x-read-only': '1' })).body.data.workbench.mine).toEqual([]);
    expect((await get('?view=mine&userId=reviewer')).body.data.workbench.mine).toEqual(self);
  });

  test('早期资产阶段有真实待审候选时仍进入工作台，归档和无待审早期资产不进入', async () => {
    repository.transaction(state => state.tasks.push(task('early-pending', 'early')));
    try {
      const data = (await get('?view=mine')).body.data.workbench;
      expect(data.handbooks.find(row => row.handbookId === 'early')).toMatchObject({ status: 'outline_published', pendingCount: 2 });
      expect(data.documents.filter(row => row.handbookId === 'early')).toHaveLength(2);
      expect(data.mine.filter(row => row.handbookId === 'early').map(row => row.documentId)).toEqual(['b']);
      expect(data.handbooks.some(row => row.handbookId === 'archived')).toBe(false);
      expect((await get('?view=mine', { 'x-visible': '[]' })).body.data.workbench.mine).toEqual([]);
    } finally {
      repository.transaction(state => { state.tasks = state.tasks.filter(item => item.id !== 'early-pending'); });
    }
  });

  test('上下文必须同时匹配手册、文档与路径；不回退到首篇', async () => {
    for (const query of [
      '?view=reader&taskId=task-1&handbookId=HB-2',
      '?view=reader&taskId=task-1&documentId=missing',
      '?view=reader&taskId=task-1&documentId=a&path=docs/b.md',
      '?view=reader&taskId=task-1&path=docs/missing.md',
    ]) expect((await get(query)).status).toBe(409);
    expect((await get('?view=unknown')).status).toBe(400);
    expect((await get('?view=reader&taskId=missing')).status).toBe(404);
    expect((await get('?view=reader&taskId=task-1&documentId=a&path=docs/a.md')).status).toBe(200);
  });

  test('读取/过滤不写入审核状态；按手册选择仍保留全局个人待办', async () => {
    const before = repository.read();
    const result = await get('?view=documents&handbookId=HB-1');
    expect(result.body.data.allItems.map(item => item.id)).toEqual(['task-1']);
    expect(result.body.data.workbench.mine).toHaveLength(2);
    await get('?view=reader&taskId=task-1&documentId=b');
    expect(repository.read()).toEqual(before);
  });

  test('列表只返回摘要，手册总览仅返回当前手册最新冻结正文，任务详情保留完整快照', async () => {
    repository.transaction(state => {
      const current = state.tasks.find(item => item.id === 'task-1');
      current.handbookSource.documents[0].markdown = '# 当前冻结正文';
      current.handbookSource.documents[0].baselineContent = '# 仓库基线正文';
      const older = task('older', 'HB-1');
      older.createdAt = '2025-01-01T00:00:00Z';
      older.updatedAt = '2025-01-02T00:00:00Z';
      older.reviews[0].submittedAt = older.updatedAt;
      older.handbookSource.documents[0].markdown = '# 旧版冻结正文';
      state.tasks.push(older);
    });
    try {
      const list = (await get('?view=documents&handbookId=HB-1')).body.data;
      expect(list.workbench.overview).toBeUndefined();
      expect(list.items.every(item => !Object.hasOwn(item, 'handbookSource'))).toBe(true);
      expect(list.allItems.every(item => !Object.hasOwn(item, 'handbookSource'))).toBe(true);
      expect(JSON.stringify(list)).not.toContain('当前冻结正文');
      expect(JSON.stringify(list)).not.toContain('仓库基线正文');

      const overview = (await get('?view=reader&handbookId=HB-1')).body.data;
      expect(overview.workbench.overview).toEqual(expect.arrayContaining([
        expect.objectContaining({ taskId: 'task-1', path: 'docs/a.md', markdown: '# 当前冻结正文' }),
      ]));
      expect(overview.workbench.overview.some(item => item.taskId === 'older')).toBe(false);
      expect(JSON.stringify(overview)).not.toContain('仓库基线正文');
      const detail = (await get('?view=reader&handbookId=HB-1&taskId=task-1&documentId=a')).body.data;
      expect(detail.workbench.overview).toBeUndefined();
      expect(detail.detail.task.handbookSource.documents[0].markdown).toBe('# 当前冻结正文');
    } finally {
      repository.transaction(state => {
        state.tasks = state.tasks.filter(item => item.id !== 'older');
        delete state.tasks.find(item => item.id === 'task-1').handbookSource.documents[0].markdown;
        delete state.tasks.find(item => item.id === 'task-1').handbookSource.documents[0].baselineContent;
      });
    }
  });

  test('人员 ID 指派在真实 HTTP 我的审核和审核决定中识别同一登录用户', async () => {
    const assigned = task('principal-assigned', 'HB-1');
    assigned.handbookSource.documents = [{ documentId: 'principal-doc', filePath: 'docs/principal.md', reviewerIds: ['178'] }];
    assigned.reviews[0].reviewerIds = ['178'];
    repository.transaction(state => state.tasks.push(assigned));
    const headers = { 'x-user': 'usr_heyang', 'x-principal': '178' };
    const mine = await get('?view=mine', headers);
    expect(mine.status).toBe(200);
    expect(mine.body.data.workbench.mine.find(row => row.taskId === assigned.id && row.documentId === 'principal-doc')).toMatchObject({ reviewerDisplay: '何阳' });
    const reader = await get(`?view=reader&taskId=${assigned.id}&documentId=principal-doc&path=docs/principal.md`, headers);
    expect(reader.status).toBe(200);
    expect(reader.body.data.detail.task.capabilities.canReview).toBe(true);
    expect((await get('?view=mine', { 'x-user': 'usr_other' })).body.data.workbench.mine.some(row => row.taskId === assigned.id)).toBe(false);
    const denied = await fetch(base.replace('/review/bootstrap', `/incremental-tasks/${assigned.id}/reviews/${assigned.reviews[0].id}/decision`), {
      method: 'POST', headers: { 'x-user': 'usr_other', 'content-type': 'application/json', 'idempotency-key': 'other-user-decision' },
      body: JSON.stringify({ decision: 'approve' }),
    });
    expect(denied.status).toBe(403);
    const response = await fetch(base.replace('/review/bootstrap', `/incremental-tasks/${assigned.id}/reviews/${assigned.reviews[0].id}/decision`), {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'idempotency-key': 'principal-assigned-decision' },
      body: JSON.stringify({ decision: 'approve' }),
    });
    expect(response.status).toBe(200);
    expect((await get('?view=mine', headers)).body.data.workbench.mine.some(row => row.taskId === assigned.id)).toBe(false);
    const decided = (await get('?view=documents&handbookId=HB-1')).body.data.workbench.documents.find(row => row.taskId === assigned.id);
    expect(decided.reviewerDisplay).toBe('何阳');
  });

  test('已审核显示实际审核人，未知人员 ID 不裸露', async () => {
    const assigned = task('display-reviewer', 'HB-1');
    assigned.handbookSource.documents = [
      { documentId: 'known-doc', filePath: 'docs/known.md', reviewerIds: ['178'] },
      { documentId: 'unknown-doc', filePath: 'docs/unknown.md', reviewerIds: ['999999'] },
    ];
    repository.transaction(state => state.tasks.push(assigned));
    try {
      const pending = (await get('?view=documents&handbookId=HB-1')).body.data.workbench.documents.filter(row => row.taskId === assigned.id);
      expect(pending.find(row => row.documentId === 'known-doc').reviewerDisplay).toBe('何阳');
      expect(pending.find(row => row.documentId === 'unknown-doc').reviewerDisplay).toBe('人员未匹配');
      repository.transaction(state => {
        const row = state.tasks.find(item => item.id === assigned.id);
        row.state = 'approved';
        row.reviews[0].status = 'approved';
        row.reviews[0].decision = { value: 'approve', decidedBy: { id: 'usr_reviewer' }, decidedAt: '2026-01-03T00:00:00Z' };
      });
      const decided = (await get('?view=documents&handbookId=HB-1')).body.data.workbench.documents.filter(row => row.taskId === assigned.id);
      expect(decided.map(row => row.reviewerDisplay)).toEqual(['审核员甲', '审核员甲']);
    } finally {
      repository.transaction(state => { state.tasks = state.tasks.filter(item => item.id !== assigned.id); });
    }
  });


  function onlineReview(scope, documentId) {
    const id = `legacy-online-${scope}`;
    const created = task(id, 'HB-1', {
      handbookSource: null, reviewMode: 'online_review', baselineVersionId: 'published-baseline',
      target: { scope, documentIds: documentId ? [documentId] : [] },
      candidate: { digest: `digest-${id}`, content: '# 已发布整本正文', operations: [] },
    });
    repository.transaction(state => { state.tasks = state.tasks.filter(item => item.id !== id); state.tasks.push(created); });
    return created;
  }

  test('历史整本在线评审保留一条明确聚合事项，阅读链接不虚构文档和文件路径', async () => {
    const created = onlineReview('handbook');
    const result = await get('?view=documents&handbookId=HB-1');
    const rows = result.body.data.workbench.documents.filter(row => row.taskId === created.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ scope: 'handbook', documentId: null, path: '' });
    expect(rows[0].title).toContain('整本手册');
    const moduleUrl = pathToFileURL(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/workbench.js')).href;
    const script = `import fs from 'node:fs'; import { reviewDocumentUrl } from ${JSON.stringify(moduleUrl)}; process.stdout.write(reviewDocumentUrl(JSON.parse(fs.readFileSync(0, 'utf8'))));`;
    const href = execFileSync(process.execPath, ['--input-type=module', '-e', script], { input: JSON.stringify(rows[0]), encoding: 'utf8' });
    const url = new URL(href, 'http://localhost');
    expect(url.searchParams.get('taskId')).toBe(created.id);
    expect(url.searchParams.has('documentId')).toBe(false);
    expect(url.searchParams.has('path')).toBe(false);
    const reader = await get(url.search);
    expect(reader.status).toBe(200);
    expect(reader.body.data.detail.task.candidate.content).toBe('# 已发布整本正文');
    expect((await get(`?view=reader&taskId=${created.id}&path=docs/reference.md`)).status).toBe(200);
  });

  test('00SQL 无差异在线审核拒绝创建，历史已批准快照发布 422 且保留任务', async () => {
    const filePath = 'doc/产品文档/开发手册/SQL参考手册/00SQL参考手册.md';
    const content = '# SQL参考手册\n\n仓库原文快照';
    repository.transaction(state => state.publishedVersions.push({
      id: 'sql-baseline', handbookId: 'HB-1', businessVersion: 'sql-v1', current: true,
      content, contentDigest: 'sql-baseline-digest',
    }));
    try {
      const createdResponse = await fetch(base.replace('/review/bootstrap', '/incremental-tasks/online-reviews'), {
        method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'sql-online-review-contract' },
        body: JSON.stringify({ handbookId: 'HB-1', businessVersion: 'sql-v1', baselineVersionId: 'sql-baseline', scope: 'document', documentId: filePath }),
      });
      expect(createdResponse.status).toBe(422);
      expect((await createdResponse.json()).error.code).toBe('GITLAB_NO_CHANGES');
      expect(repository.read().tasks.some(item => item.baselineVersionId === 'sql-baseline')).toBe(false);
      const legacy = task('sql-legacy', 'HB-1', {
        businessVersion: 'sql-v1', baselineVersionId: 'sql-baseline', reviewMode: 'online_review',
        handbookSource: null, target: { scope: 'document', documentIds: [filePath] }, state: 'approved',
        candidate: { digest: 'sql-legacy-candidate', content, operations: [] },
        reviews: [{ id: 'sql-legacy-review', candidateDigest: 'sql-legacy-candidate', status: 'approved', submittedBy: { id: 'author' }, submittedAt: '2026-01-02T00:00:00Z', comments: [], decision: { value: 'approve', decidedBy: { id: 'author' }, decidedAt: '2026-01-03T00:00:00Z' } }],
      });
      repository.transaction(state => state.tasks.push(legacy));
      const publishResponse = await fetch(base.replace('/review/bootstrap', `/incremental-tasks/${legacy.id}/publish`), {
        method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'sql-online-publish-contract', 'x-publish': '1' },
        body: JSON.stringify({ expectedCandidateDigest: legacy.candidate.digest }),
      });
      expect(publishResponse.status).toBe(422);
      expect((await publishResponse.json()).error.code).toBe('GITLAB_NO_CHANGES');
      const preserved = repository.read().tasks.find(item => item.id === legacy.id);
      expect(preserved.state).toBe('approved');
      expect(preserved.publication).toBeFalsy();
      expect(preserved.mergeRequest).toBeFalsy();
      const projection = (await get(`?view=reader&taskId=${legacy.id}&documentId=${encodeURIComponent(filePath)}`, { 'x-publish': '1' })).body.data;
      const moduleUrl = pathToFileURL(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js')).href;
      const script = `globalThis.window = { location: { search: '' } }; import { renderReviewPublishing } from ${JSON.stringify(moduleUrl)}; import fs from 'node:fs'; const projection = JSON.parse(fs.readFileSync(0, 'utf8')); process.stdout.write(renderReviewPublishing({ reviewProjection: projection, gitlabProjection: {}, reviewUi: {} }));`;
      const html = execFileSync(process.execPath, ['--input-type=module', '-e', script], { input: JSON.stringify(projection), encoding: 'utf8' });
      expect(html).toContain('data-review-publish');
      expect(html).not.toContain('查看 GitLab MR');
    } finally {
      repository.transaction(state => {
        state.tasks = state.tasks.filter(item => item.baselineVersionId !== 'sql-baseline');
        state.publishedVersions = state.publishedVersions.filter(item => item.id !== 'sql-baseline' && item.baseVersionId !== 'sql-baseline');
      });
    }
  });

  test('无handbookSource的在线文档评审也必须拒绝错配文档，不误显其他快照', async () => {
    const created = onlineReview('document', 'legacy-doc');
    const valid = await get(`?view=reader&taskId=${created.id}&documentId=legacy-doc`);
    expect(valid.status).toBe(200);
    const wrong = await get(`?view=reader&taskId=${created.id}&documentId=unrelated`);
    expect(wrong.status).toBe(409);
    expect(wrong.body.data).toBeUndefined();
    // 旧任务的opaque文档ID不等于GitLab路径；未知映射不能伪装成已验证路径。
    expect((await get(`?view=reader&taskId=${created.id}&documentId=legacy-doc&path=docs/legacy.md`)).status).toBe(200);
  });

  test('通用任务具有明确操作路径时，同时核对文档与路径配对', async () => {
    repository.transaction(state => state.tasks.push(task('mapped-generic', 'HB-1', {
      handbookSource: null, target: { documentIds: ['a', 'b'] },
      candidate: { digest: 'digest-mapped-generic', operations: [{ documentId: 'a', path: 'docs/a.md' }, { documentId: 'b', path: 'docs/b.md' }] },
    })));
    expect((await get('?view=reader&taskId=mapped-generic&documentId=a&path=docs/a.md')).status).toBe(200);
    expect((await get('?view=reader&taskId=mapped-generic&documentId=a&path=docs/missing.md')).status).toBe(409);
    expect((await get('?view=reader&taskId=mapped-generic&documentId=a&path=docs/b.md')).status).toBe(409);
    expect((await get('?view=reader&taskId=mapped-generic&path=docs/missing.md')).status).toBe(409);
  });

});
