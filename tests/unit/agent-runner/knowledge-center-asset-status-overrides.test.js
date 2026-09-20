const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

function jsonStore(initial) {
  let value = structuredClone(initial);
  return {
    read: jest.fn(() => structuredClone(value)),
    readAsync: jest.fn(async () => structuredClone(value)),
    write: jest.fn(next => {
      value = structuredClone(next);
      return next;
    }),
    value: () => value,
  };
}

describe('数据库模式知识资产状态覆盖', () => {
  let previousMode;
  let fixtureRoot;
  let server;
  let baseUrl;

  beforeEach(async () => {
    previousMode = process.env.KNOWLEDGE_STORAGE_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-status-overrides-'));
  });

  afterEach(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    server = null;
    if (previousMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = previousMode;
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  async function startHandler(stores) {
    const templatePath = path.join(fixtureRoot, 'template.xlsx');
    const samplePath = path.join(fixtureRoot, 'sample.xlsx');
    fs.writeFileSync(templatePath, 'template');
    fs.writeFileSync(samplePath, 'sample');
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center',
        KNOWLEDGE_CENTER_ROOT: fixtureRoot,
        KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: templatePath,
        OUTLINE_SAMPLE_PATH: samplePath,
        PINGCODE_PREFIX: '/pingcode',
        PINGCODE_ROOT: fixtureRoot,
        GITLAB_CONFIG_PATH: path.join(fixtureRoot, 'gitlab.json'),
        GITLAB_DOCUMENT_TYPES_PATH: path.join(fixtureRoot, 'rules.json'),
      },
      stores: {
        ...stores,
        brandIconStore: {},
        domainStore: { readTechDomains: () => ({ techDomains: [] }) },
      },
      moduleRegistry: { get: () => ({ authorize: async () => ({ user: { id: 'admin' }, roles: ['PLATFORM_ADMIN'], allowedActions: ['platform:manage', 'knowledge:read'] }) }) },
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {},
      proxyCleaning() {},
      proxyOutline() {},
      proxyPermission() {},
      handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }

  test('修改手册人工状态不回写关系化手册快照且列表可见', async () => {
    const knowledgeAssetsStore = jsonStore({
      handbooks: [{
        handbookId: 'DB-041',
        name: 'mysql模式运维手册',
        productId: 1,
        productName: 'DB',
        outline: { outlineId: null, bindingStatus: 'not_created' },
        documentSummary: { total: 0, published: 0, inProgress: 0 },
        assetVersion: 13,
      }],
      audits: [],
    });
    const manualStatusStore = jsonStore({ version: 1, statuses: {}, audits: [] });
    await startHandler({ knowledgeAssetsStore, manualStatusStore });

    const changed = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-041/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetStatus: 'content_building', reason: '进入内容建设', expectedVersion: 13 }),
    });
    expect(changed.status).toBe(200);
    await expect(changed.json()).resolves.toMatchObject({
      data: { status: 'content_building', manualStatus: 'content_building', systemStatus: 'asset_created', assetVersion: 14 },
    });
    expect(knowledgeAssetsStore.write).not.toHaveBeenCalled();
    expect(manualStatusStore.write).toHaveBeenCalledWith(expect.objectContaining({
      statuses: expect.objectContaining({
        'DB-041': expect.objectContaining({ manualStatus: expect.objectContaining({ value: 'content_building' }), assetVersion: 14 }),
      }),
    }));

    const listed = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks?page=1&pageSize=20`);
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      data: { items: [expect.objectContaining({ handbookId: 'DB-041', status: 'content_building', manualStatus: 'content_building', assetVersion: 14 })] },
    });

    const resolved = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-041/status/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'accept_system', expectedVersion: 14 }),
    });
    expect(resolved.status).toBe(200);
    await expect(resolved.json()).resolves.toMatchObject({
      data: { status: 'asset_created', manualStatus: null, assetVersion: 15 },
    });
    expect(knowledgeAssetsStore.write).not.toHaveBeenCalled();
    expect(manualStatusStore.write).toHaveBeenLastCalledWith(expect.objectContaining({
      statuses: expect.objectContaining({
        'DB-041': expect.objectContaining({ manualStatus: null, assetVersion: 15 }),
      }),
    }));

    const resolvedList = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks?page=1&pageSize=20`);
    expect(resolvedList.status).toBe(200);
    await expect(resolvedList.json()).resolves.toMatchObject({
      data: { items: [expect.objectContaining({ handbookId: 'DB-041', status: 'asset_created', manualStatus: null, assetVersion: 15 })] },
    });
  });
});
