const express = require('express');
const fs = require('fs');
const path = require('path');
const { createDocumentTaskRouter } = require('../../../packages/agent-runner-core/routes/document-tasks');

describe('范围确认的 GitLab 实时状态门禁', () => {
  let server, base, directory, remoteState, remoteError, remoteReads;
  const review = {
    id: 'review-mr', handbookId: 'h1', state: 'mr_submitted',
    handbookSource: { branch: '23.4', documents: [{ documentId: 'd1', branch: '23.4' }] },
    mergeRequest: { iid: 7, webUrl: 'https://gitlab.example/mr/7' },
    deliveryObservation: { state: 'opened', observedAt: '2020-01-01T00:00:00Z' },
    reviews: [{ status: 'approved' }], candidate: { digest: 'candidate-1' },
    completion: { status: 'pending', label: '待合并回读' },
  };
  const context = req => {
    const id = req.get('x-test-user') || 'owner';
    return {
      session: { user: { id, principalId: id, allowedActions: id === 'outsider' ? ['knowledge:read']
        : ['knowledge:read', 'knowledge:write', ...(id === 'owner' ? ['platform:manage'] : [])] } },
      people: ['owner', 'book-owner', 'writer'].map(personId => ({ id: personId, displayName: personId })),
      handbooks: [{ id: 'h1', name: '手册一', ownerId: 'book-owner' }],
      catalog: async () => ({ outlineVersionId: 'v1', versions: ['23.4'], documents: [{ id: 'd1', name: '安装' }], chapters: [] }),
      reviewService: { get: () => review, list: () => [{ id: review.id }] },
      readScopeMergeRequest: async () => {
        remoteReads++;
        if (remoteError) throw remoteError;
        return { state: remoteState, observedAt: new Date().toISOString(), targetCommit: remoteState === 'merged' ? 'commit-1' : null };
      },
    };
  };
  beforeEach(async () => {
    const root = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(root, { recursive: true });
    directory = fs.mkdtempSync(path.join(root, 'scope-mr-'));
    remoteState = 'opened'; remoteError = null; remoteReads = 0;
    const app = express();
    app.use('/api', createDocumentTaskRouter({ filePath: path.join(directory, 'state.json'), defaultOwnerId: 'owner', context }));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  let sequence = 0;
  async function request(method, suffix, body, user = 'owner') {
    const response = await fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': user,
      'Idempotency-Key': `scope-mr-${++sequence}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, ...await response.json() };
  }
  async function setup() {
    const tasks = [{ number: 'P-1', title: '安装', ownerId: 'writer', status: '关闭', startTime: '2000-01-01' }];
    const preview = await request('POST', '/import?preview=true', { tasks });
    expect(preview.status).toBe(200);
    await request('POST', '/import', { tasks, digest: preview.data.digest });
    let task = (await request('GET', '/P-1')).data;
    task = (await request('PUT', '/P-1/decomposition', { expectedRevision: task.revision, confirm: true,
      ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'book-owner' }] })).data;
    task = (await request('PUT', '/P-1/handbooks/h1', { expectedRevision: task.revision, confirm: true,
      impact: 'involved', targetVersion: '23.4', documents: [{ id: 'd1', ownerId: 'writer' }] }, 'book-owner')).data;
    task = (await request('POST', '/P-1/documents/d1/link', { expectedRevision: task.revision, handbookId: 'h1', reviewTaskId: review.id }, 'writer')).data;
    const change = await request('POST', '/P-1/scope-changes', { expectedRevision: task.revision, level: 'handbook',
      handbookId: 'h1', reason: '调整文档范围', affectedDocuments: [{ handbookId: 'h1', documentId: 'd1' }] }, 'book-owner');
    expect(change.status).toBe(200);
    return { task: (await request('GET', '/P-1')).data, change: change.data,
      proposed: { impact: 'not_involved', reasonId: 'covered', targetVersion: '23.4', documents: [] } };
  }

  test('预览后 MR 状态改变时必须重新预览', async () => {
    const { task, change, proposed } = await setup();
    const preview = await request('POST', `/P-1/scope-changes/${change.id}/preview`, { proposed }, 'book-owner');
    expect(preview.data.items[0]).toMatchObject({ mrState: 'opened', canConfirm: false, draftStatus: 'saved', reviewStatus: 'approved' });
    remoteState = 'closed';
    const confirm = await request('POST', `/P-1/scope-changes/${change.id}/confirm`, {
      expectedRevision: task.revision, proposed, impactDigest: preview.data.impactDigest,
    }, 'book-owner');
    expect(confirm).toMatchObject({ status: 409, error: { code: 'IMPACT_STALE' } });
    expect(remoteReads).toBe(2);
  });

  test('GitLab 不可读时阻断确认；无权访问不触发远端读取', async () => {
    const { task, change, proposed } = await setup();
    const unauthorized = await request('POST', `/P-1/scope-changes/${change.id}/confirm`, {
      expectedRevision: task.revision, proposed, impactDigest: 'ignored',
    }, 'outsider');
    expect(unauthorized.status).toBe(403);
    expect(remoteReads).toBe(0);
    remoteError = new Error('连接超时');
    const preview = await request('POST', `/P-1/scope-changes/${change.id}/preview`, { proposed }, 'book-owner');
    expect(preview).toMatchObject({ status: 503, error: { code: 'MR_STATUS_UNAVAILABLE' } });
    const confirm = await request('POST', `/P-1/scope-changes/${change.id}/confirm`, {
      expectedRevision: task.revision, proposed, impactDigest: 'unavailable',
    }, 'book-owner');
    expect(confirm).toMatchObject({ status: 503, error: { code: 'MR_STATUS_UNAVAILABLE' } });
    const unchanged = (await request('GET', '/P-1')).data;
    expect(unchanged.revision).toBe(task.revision);
    expect(unchanged.scopeChanges.find(item => item.id === change.id).status).toBe('reported');
    expect(remoteReads).toBe(2);
  });
});
