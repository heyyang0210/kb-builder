const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createProxy } = require('../../../packages/agent-runner-core/lib/proxy-utils');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

const contextPath = '/api/platform/context';
const context = {
  schemaVersion: '1', profileId: 'isolated', enterpriseId: 'test',
  configFingerprint: 'sha256:' + 'a'.repeat(64), displayName: '隔离平台',
};
const documentStats = '/api/document/stats';
const outlineList = '/api/outline/governance/list';
const workbenchSummary = '/api/workbench/summary';
const batchList = '/api/material-batches?page=1&pageSize=1';
const datasetList = '/api/datasets';
const indexStats = '/api/index/stats';
const documentProjections = {
  [documentStats]: { data: { total_documents: '6', root_count: '2' } },
  [outlineList]: { data: [{ id: 'outline-a', name: '手册大纲', nodeCount: '4' }] },
};
const materialProjections = {
  [workbenchSummary]: { counts: { all: '5', pending: '2' } },
  [batchList]: { items: [{ state: 'running' }, { state: 'done' }], total: '3' },
  [datasetList]: { items: [{ version: 'r2' }] },
  [indexStats]: { data: { knowledge_points: '9', indexedDocuments: '7' } },
};

describe('知识中心平台网关真实 HTTP 聚合', () => {
  let fixtureRoot, servers, documentResponses, materialResponses, seen, base, readPrincipals, previousModes, users;
  beforeAll(() => {
    previousModes = ['KNOWLEDGE_STORAGE_MODE', 'KNOWLEDGE_PLATFORM_CONFIG_MODE'].map(key => process.env[key]);
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'file';
  });
  afterAll(() => {
    ['KNOWLEDGE_STORAGE_MODE', 'KNOWLEDGE_PLATFORM_CONFIG_MODE'].forEach((key, index) => {
      if (previousModes[index] === undefined) delete process.env[key]; else process.env[key] = previousModes[index];
    });
  });
  async function listen(handler) {
    const server = http.createServer(handler);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    servers.push(server);
    return server.address().port;
  }
  function upstream(service, responses) {
    return (req, res) => {
      seen.push([service, req.method, req.url]);
      const entry = responses.get(req.url);
      if (!entry) { res.writeHead(503).end('isolated downstream error'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(entry));
    };
  }
  beforeEach(async () => {
    servers = [];
    const parent = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(parent, { recursive: true });
    fixtureRoot = fs.mkdtempSync(path.join(parent, 'platform-gateway-'));
    const workbook = path.join(fixtureRoot, 'startup.xlsx');
    fs.writeFileSync(workbook, '');
    seen = [];
    readPrincipals = async () => ({ items: [] });
    const handbooks = ['common', 'operator-only', 'target-only'].map(handbookId => ({ handbookId, name: handbookId }));
    const operator = { id: 'operator', visibleHandbookIds: ['common', 'operator-only'] };
    const responsible = { id: 'responsible', visibleHandbookIds: ['common', 'target-only'], roles: ['REVIEWER'] };
    users = [operator, responsible];
    documentResponses = new Map(Object.entries({ [contextPath]: context, ...documentProjections }));
    materialResponses = new Map(Object.entries({ [contextPath]: context, ...materialProjections }));
    const documentPort = await listen(upstream('document', documentResponses));
    const materialPort = await listen(upstream('material', materialResponses));
    const port = await listen(createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center',
        DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: documentPort,
        PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: materialPort,
        PLATFORM_CONTEXT_TIMEOUT_MS: 1500,
        OUTLINE_TEMPLATE_PATH: workbook, OUTLINE_SAMPLE_PATH: workbook,
      },
      proxyOutline: createProxy({
        targetHost: '127.0.0.1', targetPort: documentPort,
        pathTransform: req => req.url.slice('/knowledge-center'.length),
      }),
      stores: {
        knowledgeAssetsStore: { read: () => ({ handbooks }) }, manualStatusStore: {}, brandIconStore: {},
        domainStore: { readPrincipalsAsync: () => readPrincipals() },
      },
      documentTasksOptions: { filePath: path.join(fixtureRoot, 'tasks.json') },
      moduleRegistry: { get: name => name === 'auth' ? {
        authorize(req) {
          if (req.headers.cookie === 'fixture=member') return { user: { id: 'member' }, allowedActions: ['knowledge:read'] };
          if (req.headers.cookie === 'fixture=operator') return { user: operator, allowedActions: ['knowledge:read', 'platform:manage'] };
          if (req.headers.cookie === 'fixture=no-access') return { user: operator, allowedActions: [] };
          const action = /^fixture=(outline:(?:read|create|delete|purge))$/.exec(req.headers.cookie || '')?.[1];
          return action ? { user: { id: 'outline-operator' }, allowedActions: [action] } : null;
        },
        repository: { listUsers: async () => users },
      } : null },
      handbookProductionService: { capabilities: () => ({ canSubmitReview: true }) },
      handleIncrementalBuild: { service: {
        readState: async () => ({ tasks: [] }),
        reviewBootstrap: () => ({ documents: handbooks.map(({ handbookId }) => ({
          handbookId, documentId: handbookId, reviewId: 'review', taskId: 'task-' + handbookId,
          title: handbookId, assignedToMe: true,
        })) }),
      } },
    }));
    base = 'http://127.0.0.1:' + port + '/knowledge-center/api';
  });
  afterEach(async () => {
    await Promise.all(servers.map(server => {
      server.closeAllConnections();
      return new Promise(resolve => server.close(resolve));
    }));
    if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  async function request(endpoint, authenticated = true) {
    const res = await fetch(base + '/platform' + endpoint, { headers: authenticated ? { cookie: 'fixture=member' } : {} });
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    return { status: res.status, body: await res.json() };
  }

  test('批量模板导入保留单项创建失败并继续处理其他文件', async () => {
    const attempts = [];
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', OUTLINE_TEMPLATE_PATH: path.join(fixtureRoot, 'startup.xlsx'), OUTLINE_SAMPLE_PATH: path.join(fixtureRoot, 'startup.xlsx') },
      stores: {
        templateStore: {
          importDraft: upload => ({ draft: true, name: upload.name }),
          create: draft => {
            attempts.push(draft.name);
            if (draft.name === 'first') throw new Error('隔离存储写入失败');
            return { id: 'saved', name: draft.name };
          },
        },
        knowledgeAssetsStore: {}, manualStatusStore: {}, brandIconStore: {},
      },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: () => ({ user: { id: 'editor' }, allowedActions: ['template:edit'] }) } : null },
      handbookProductionService: {}, handleIncrementalBuild: { service: {} },
    });
    const port = await listen(handler);
    const form = new FormData();
    form.append('files', new Blob(['# first'], { type: 'text/markdown' }), 'first.md');
    form.append('files', new Blob(['# second'], { type: 'text/markdown' }), 'second.md');
    const response = await fetch(`http://127.0.0.1:${port}/knowledge-center/api/templates/import`, { method: 'POST', body: form });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(attempts).toEqual(['first', 'second']);
    expect(result.data.drafts).toEqual([
      expect.objectContaining({ clientIndex: 0, draft: false, error: { code: 'TEMPLATE_CREATE_FAILED', message: '隔离存储写入失败' } }),
      expect.objectContaining({ clientIndex: 1, draft: true, name: 'second' }),
    ]);
    expect(result.data.templates).toEqual([{ id: 'saved', name: 'second' }]);
  });

  test('数据库模式下已删除大纲阻止草稿保存', async () => {
    const queried = [], saved = [];
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    let handler;
    try {
      handler = createKnowledgeCenterHandler({
        config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', OUTLINE_TEMPLATE_PATH: path.join(fixtureRoot, 'startup.xlsx'), OUTLINE_SAMPLE_PATH: path.join(fixtureRoot, 'startup.xlsx') },
        stores: { domainStore: { readOutlineGovernanceAsync: async id => { queried.push(id); return { deletedAt: id === 'deleted' ? '2026-01-01' : null }; } }, knowledgeAssetsStore: {}, manualStatusStore: {}, brandIconStore: {} },
        moduleRegistry: { get: name => name === 'auth' ? { authorize: () => ({user:{id:'author'},allowedActions:['knowledge:write']}) } : null },
        handbookProductionService: { saveDraft: async body => { saved.push(body); return { editVersion: 2 }; } },
        handleIncrementalBuild: { service: {} },
      });
    } finally { process.env.KNOWLEDGE_STORAGE_MODE = 'file'; }
    const port = await listen(handler);
    const endpoint = `http://127.0.0.1:${port}/knowledge-center/api/production/handbooks/common/documents/doc/draft`;
    async function save(body) {
      const response = await fetch(endpoint, {method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      return {status:response.status, body:await response.json()};
    }
    expect(await save({outlineVersionId:'deleted',markdown:'内容'})).toMatchObject({status:409,body:{success:false,error:{code:'OUTLINE_DELETED'}}});
    expect(saved).toHaveLength(0);
    expect(await save({outlineVersionId:'active',markdown:'内容'})).toMatchObject({status:200,body:{data:{editVersion:2}}});
    expect(await save({markdown:'无版本'})).toMatchObject({status:200,body:{data:{editVersion:2}}});
    expect(queried).toEqual(['deleted','active']);
    expect(saved.map(item => item.markdown)).toEqual(['内容','无版本']);
  });

  test('手册审核人列表按角色、显式权限和可见范围筛选', async () => {
    users = [
      { principalId: 'reviewer', displayName: '审核员', roles: ['REVIEWER'], visibleHandbookIds: ['common'] },
      { id: 'admin', name: '管理员', roles: ['PLATFORM_ADMIN'] },
      { userId: 'delegated', loginName: '授权人', allowedActions: ['review:manage'], visibleHandbookIds: ['common'] },
      { id: 'hidden', roles: ['REVIEWER'], visibleHandbookIds: ['other'] },
      { id: 'reader', roles: ['READER'], visibleHandbookIds: ['common'] },
    ];
    const endpoint = base + '/production/handbooks/common/reviewers';
    const anonymous = await fetch(endpoint);
    expect(anonymous.status).toBe(401);
    const response = await fetch(endpoint, { headers: { cookie: 'fixture=member' } });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.capabilities).toEqual({ canSubmitReview: true });
    expect(result.data.items.map(({id, displayName}) => ({id, displayName}))).toEqual([
      {id:'reviewer',displayName:'审核员'}, {id:'admin',displayName:'管理员'}, {id:'delegated',displayName:'授权人'},
    ]);
    expect(result.data.items.every(item => item.handbookId === 'common' && item.disabled === false)).toBe(true);
  });

  test('匿名访问上下文和总览均返回 401，且不访问下游', async () => {
    for (const endpoint of ['/context', '/overview']) {
      expect(await request(endpoint, false)).toMatchObject({ status: 401, body: { success: false, error: { code: 'AUTH_REQUIRED' } } });
    }
    expect(seen).toEqual([]);
  });

  test('上下文对齐时返回可用配置，指纹不同或部分失败时可降级', async () => {
    const healthy = await request('/context');
    expect(healthy).toMatchObject({ status: 200, body: {
      status: 'ok', context, modules: { documentGeneration: { status: 'ok' }, materialProcessing: { status: 'ok' } }, errors: [],
    } });
    expect(seen).toHaveLength(2);
    expect(seen).toEqual(expect.arrayContaining([['document', 'GET', contextPath], ['material', 'GET', contextPath]]));

    materialResponses.set(contextPath, { ...context, configFingerprint: 'sha256:' + 'b'.repeat(64) });
    expect(await request('/context')).toMatchObject({ status: 200, body: {
      status: 'degraded', context, errors: [{ code: 'PROFILE_FINGERPRINT_MISMATCH' }],
    } });
    materialResponses.delete(contextPath);
    expect(await request('/context')).toMatchObject({ status: 200, body: {
      status: 'degraded', context, modules: { materialProcessing: { status: 'unavailable' } },
    } });
    documentResponses.delete(contextPath);
    const failed = await request('/context');
    expect(failed).toMatchObject({ status: 503, body: { status: 'unavailable' } });
    expect(failed.body.errors).toHaveLength(2);
    expect(failed.body.context).toBeUndefined();
  });

  test('总览通过真实 HTTP 汇总六个投影；部分失败保留其他数据', async () => {
    expect(await request('/overview')).toMatchObject({ status: 200, body: {
      status: 'ok', source: 'read-only-projection', errors: [], sections: {
        documents: { status: 'ok', data: { total: 6, roots: 2 } },
        outlines: { status: 'ok', data: { total: 1, items: [{ id: 'outline-a', nodeCount: 4 }] } },
        workbench: { status: 'ok', data: { counts: { all: 5, pending: 2 } } },
        materialBatches: { status: 'ok', data: { total: 3, active: 1 } },
        datasets: { status: 'ok', data: { total: 1, latestVersion: 'r2' } },
        knowledgeIndex: { status: 'ok', data: { knowledgePoints: 9, indexed: 7 } },
      },
    } });
    expect(seen).toHaveLength(6);
    expect(seen).toEqual(expect.arrayContaining([
      ...Object.keys(documentProjections).map(url => ['document', 'GET', url]),
      ...Object.keys(materialProjections).map(url => ['material', 'GET', url]),
    ]));

    documentResponses.delete(documentStats);
    expect(await request('/overview')).toMatchObject({ status: 200, body: {
      status: 'degraded', sections: {
        documents: { status: 'unavailable', error: { code: 'MODULE_UNAVAILABLE', retryable: true } },
        knowledgeIndex: { status: 'ok', data: { knowledgePoints: 9 } },
      },
    } });
    documentResponses.clear();
    materialResponses.clear();
    const failed = await request('/overview');
    expect(failed).toMatchObject({ status: 503, body: { status: 'unavailable' } });
    expect(failed.body.errors).toHaveLength(6);
  });

  async function workbench(cookie) {
    const response = await fetch(base + '/workbench/my-tasks/query', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ responsibleId: 'responsible', queue: 'actionable', page: 1, pageSize: 20 }),
    });
    return { status: response.status, body: await response.json() };
  }

  test('代查只返回调用方和责任人均可见的待办', async () => {
    const result = await workbench('fixture=operator');
    expect(result).toMatchObject({ status: 200, body: { success: true, data: {
      responsible: { id: 'responsible' }, operator: { id: 'operator' }, total: 1, completeness: 'complete',
      items: [{ lineage: { handbookId: 'common' }, primaryAction: { code: 'review_document' } }],
    } } });
  });

  test('工作台拒绝无读取权限的请求，任务目录故障仍展示可读审核待办', async () => {
    expect(await workbench('fixture=no-access')).toMatchObject({ status: 403, body: {
      success: false, error: { code: 'WORKBENCH_READ_FORBIDDEN' },
    } });
    readPrincipals = async () => { throw new Error('isolated directory failure'); };
    expect(await workbench('fixture=operator')).toMatchObject({ status: 200, body: { data: {
      completeness: 'partial', unavailable: ['任务管理'], total: 1,
      items: [{ lineage: { handbookId: 'common' } }],
    } } });
  });

  test.each([
    ['GET', '/catalog?handbookId=hb', 'outline:read'],
    ['GET', '/governance/o/purge-preflight', 'outline:purge'],
    ['POST', '/governance/o/purge', 'outline:purge'],
    ['POST', '/governance/o/restore', 'outline:delete'],
    ['DELETE', '/governance/o', 'outline:delete'],
    ['PUT', '/governance/o/governance', 'outline:create'],
    ['POST', '/governance/o/publish', 'outline:create'],
    ['PATCH', '/build-tasks/task/items/item', 'outline:create'],
  ])('大纲 %s %s 需要匹配动作并保留真实下游响应', async (method, suffix, action) => {
    const target = '/api/outline' + suffix;
    const body = { success: true, data: { received: suffix } };
    documentResponses.set(target, body);
    const request = role => fetch(base + '/outline' + suffix, { method, headers: { cookie: 'fixture=' + role } });
    const denied = await request('member');
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: { code: 'OUTLINE_PERMISSION_DENIED' } });
    expect(seen).toEqual([]);
    const permitted = await request(action);
    expect(permitted.status).toBe(200);
    expect(await permitted.json()).toEqual(body);
    expect(seen).toEqual([['document', method, target]]);
  });
});
