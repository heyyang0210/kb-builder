const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const g = require('../../../packages/agent-runner-core/lib/gitlab-connector');
const root = path.resolve(__dirname, '../../../runtime/test-results/gitlab-boundary-fixtures');
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const code = value => expect.objectContaining({ code: value });
let file;
beforeEach(() => { fs.mkdirSync(root, { recursive: true }); file = path.join(root, 'config.json'); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('GitLab真实配置边界', () => {
  const input = extra => ({ name: 'fixture', host: 'https://git-tools.yasdb.com', project: 'test/docs', ...extra });
  test('读取空缺/非数组/损坏配置及事务锁冲突和释放', () => {
    expect(g.readConfig(file)).toEqual({ connections: [], mappings: [], idempotency: [], audit: [] });
    fs.writeFileSync(file, JSON.stringify({ connections: {}, mappings: null, idempotency: 1, audit: 'x' }));
    expect(g.readConfig(file)).toEqual({ connections: [], mappings: [], idempotency: [], audit: [] });
    fs.writeFileSync(file, '{'); expect(() => g.readConfig(file)).toThrow(code('GITLAB_CONFIG_UNAVAILABLE'));
    expect(() => g.upsertConnection(input(), file)).toThrow(code('GITLAB_CONFIG_UNAVAILABLE')); expect(fs.existsSync(`${file}.lock`)).toBe(false);
    fs.rmSync(file); fs.writeFileSync(`${file}.lock`, 'occupied');
    expect(() => g.upsertConnection(input(), file)).toThrow(code('GITLAB_CONFIG_BUSY'));
    fs.rmSync(`${file}.lock`); expect(g.upsertConnection(input(), file).name).toBe('fixture');
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });
  test.each([
    {}, { host: 'not a url', project: 'p' }, { host: 'ftp://host', project: 'p' }, { host: 'http://user:pass@host', project: 'p' },
    { host: 'http://host?secret=x', project: 'p' }, { host: 'http://host#x', project: 'p' }, { host: 'http://host/wrong', project: 'p' },
  ])('拒绝无效地址 %#', value => expect(() => g.normalizeGitLabAddress(value)).toThrow(code('GITLAB_CONFIG_INVALID')));
  test('项目URL规范化、模式门禁和安全投影', () => {
    expect(g.normalizeGitLabAddress({ baseUrl: 'https://host/group/p///', projectPath: '/group/p/' })).toMatchObject({ baseUrl: 'https://host', projectPath: 'group/p' });
    expect(() => g.upsertConnection(input({ host: 'https://unlisted.test' }), file)).toThrow(code('GITLAB_HOST_NOT_ALLOWED'));
    expect(() => g.upsertConnection(input({ baseUrl: 'http://git-tools.yasdb.com', projectPath: 'test/docs' }), file)).toThrow(code('GITLAB_HTTPS_REQUIRED'));
    const saved = g.upsertConnection(input({ credentialRef: 'fixture', purpose: 'read_write' }), file);
    const changed = g.upsertConnection(input({ id: saved.id, authMode: 'invalid', purpose: 'invalid' }), file);
    expect(changed).toMatchObject({ authMode: 'service_account', purpose: 'read_write', credentialConfigured: true });
    expect(changed.credentialRef).toBeUndefined();
    expect(g.sanitizeConnection(null)).toBeNull();
    expect(g.sanitizeConnection({ host: 'h', project: 'p', status: 'inactive', credentialConfigured: true, lastVerification: { status: 'failed' } })).toMatchObject({ status: 'disabled', verificationStatus: 'failed', authMode: 'service_account' });
  });
  test('验证、状态更新、映射幂等及失效关联', () => {
    const c = g.upsertConnection(input({ pathPrefix: '/docs/' }), file);
    expect(() => g.recordVerification('missing', {}, file)).toThrow(code('GITLAB_CONNECTION_NOT_FOUND'));
    expect(() => g.setConnectionStatus(c.id, 'invalid', file)).toThrow(code('GITLAB_STATUS_INVALID'));
    expect(() => g.setConnectionStatus('missing', 'active', file)).toThrow(code('GITLAB_CONNECTION_NOT_FOUND'));
    expect(g.recordVerification(c.name, { status: 'verified' }, file, { operatorId: 'admin' }).status).toBe('verified');
    expect(g.setConnectionStatus(c.id, 'inactive', file).status).toBe('disabled');
    expect(g.setConnectionStatus(c.name, 'active', file).status).toBe('verified');
    expect(g.findConnection(c.name, file).id).toBe(c.id); expect(() => g.findConnection('missing', file)).toThrow(code('GITLAB_CONNECTION_NOT_FOUND'));
    expect(() => g.upsertMapping('', {}, file)).toThrow(code('GITLAB_MAPPING_INVALID'));
    expect(() => g.upsertMapping('hb', {}, file)).toThrow(code('GITLAB_MAPPING_INVALID'));
    expect(() => g.upsertMapping('hb', { connectionId: 'absent' }, file)).toThrow(code('GITLAB_CONNECTION_NOT_FOUND'));
    expect(() => g.upsertMapping('hb', { connectionId: c.id, zhPaths: ['other'] }, file)).toThrow(code('GITLAB_PATH_FORBIDDEN'));
    expect(() => g.upsertMapping('hb', { connectionId: c.id, zhPaths: ['docs/../other'] }, file)).toThrow(code('GITLAB_PATH_INVALID'));
    const m = g.upsertMapping('hb', { connectionId: c.id, selectedBranch: 'release', enabledBranches: [' ', null, 'release', 'release'], zhPaths: ['docs', 'docs/a', 'docs'], enPaths: null }, file, { idempotencyKey: 'first' });
    expect(m).toMatchObject({ defaultBranch: 'release', enabledBranches: ['release'], zhPaths: ['docs', 'docs/a'], enPaths: [] });
    expect(() => g.upsertMapping('hb', { connectionId: c.id }, file, { idempotencyKey: 'first' })).toThrow(code('IDEMPOTENCY_REPLAY'));
    expect(g.upsertMapping('hb', { connectionId: c.id, zhPaths: ['docs'] }, file).defaultBranch).toBe('master');
    expect(() => g.findMapping('missing', file)).toThrow(code('GITLAB_MAPPING_NOT_FOUND'));
    const config = g.readConfig(file); config.connections = []; g.writeConfig(config, file);
    expect(() => g.findMapping('hb', file)).toThrow(code('GITLAB_CONNECTION_NOT_FOUND'));
    expect(() => g.authorizeMappedRequest({ enabledBranches: ['main'], enPaths: [], zhPaths: ['docs'] }, 'main', 'en', 'docs/a')).toThrow(code('GITLAB_LANGUAGE_NOT_MAPPED'));
  });
});

describe('GitLab默认配置路径隔离', () => {
  test('所有默认路径均指向隔离配置', () => {
    jest.isolateModules(() => {
      jest.doMock('../../../packages/agent-runner-core/lib/config-registry', () => ({ CONFIG_PATHS: { gitlabConnections: file } }));
      const connector = require('../../../packages/agent-runner-core/lib/gitlab-connector');
      expect(connector.readConfig().connections).toEqual([]);
      connector.writeConfig({ connections: [], mappings: [], idempotency: [], audit: [] });
      const c = connector.upsertConnection({ id: 'named', host: 'https://git-tools.yasdb.com', project: 'test/docs' });
      expect(c.name).toBe('named');
      expect(connector.upsertConnection({ host: 'https://git-tools.yasdb.com', project: 'test/other' }).name).toBe('default');
      connector.recordVerification(c.id, { status: 'failed' });
      connector.setConnectionStatus(c.id, 'inactive', undefined, { operatorId: 'operator' });
      connector.upsertMapping('hb', { connectionId: c.id });
      expect(connector.findMapping('hb').connection.id).toBe(c.id);
      expect(connector.findConnection(c.id).status).toBe('inactive');
      expect(() => connector.upsertMapping('other', { connectionId: c.id, zhPaths: [null] })).toThrow(code('GITLAB_PATH_INVALID'));
    });
    jest.dontMock('../../../packages/agent-runner-core/lib/config-registry');
  });
});

describe('GitLab真实HTTP协议和交付边界', () => {
  let server, connection, handle, calls;
  const opts = { accessToken: 'fixture-only-oauth' };
  beforeEach(async () => {
    calls = []; handle = () => ({ body: [] });
    server = http.createServer(async (req, res) => {
      let text = ''; for await (const b of req) text += b;
      const url = new URL(req.url, 'http://gitlab');
      const call = { method: req.method, url, headers: req.headers, body: text ? JSON.parse(text) : null }; calls.push(call);
      const result = handle(call);
      if (result.disconnect) return req.socket.destroy();
      res.statusCode = result.status || 200;
      res.end(result.raw === undefined ? JSON.stringify(result.body) : result.raw);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    connection = { host: `http://127.0.0.1:${server.address().port}`, project: 'group/docs', mode: 'sandbox', purpose: 'read_write', defaultBranch: 'main', status: 'active' };
  });
  afterEach(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); delete process.env.GITLAB_TOKEN_fixture_ref; });
  test.each([[401, 'GITLAB_UNAUTHORIZED'], [403, 'GITLAB_FORBIDDEN'], [404, 'GITLAB_NOT_FOUND'], [500, 'GITLAB_REQUEST_FAILED']])('上游%s分类', async (status, expected) => {
    handle = () => ({ status, raw: 'not-json' }); await expect(g.request(connection, '/test', opts)).rejects.toMatchObject({ code: expected, status });
  });
  test('scope不足、错误描述、断连及凭证门禁', async () => {
    handle = () => ({ status: 403, body: { error: 'insufficient_scope' } }); await expect(g.request(connection, '/test', opts)).rejects.toMatchObject({ code: 'GITLAB_INSUFFICIENT_SCOPE' });
    handle = () => ({ status: 400, body: { message: 'upstream message' } }); await expect(g.request(connection, '/test', opts)).rejects.toMatchObject({ message: 'upstream message' });
    handle = () => ({ disconnect: true }); await expect(g.request(connection, '/test', opts)).rejects.toMatchObject({ code: 'GITLAB_UNAVAILABLE', status: 502 });
    await expect(g.request({ ...connection, status: 'inactive' }, '/test', opts)).rejects.toMatchObject({ code: 'GITLAB_CONNECTION_INACTIVE' });
    await expect(g.request(connection, '/test')).rejects.toMatchObject({ code: 'GITLAB_OAUTH_REQUIRED' });
    await expect(g.request({ ...connection, credentialRef: 'fixture-ref' }, '/test')).rejects.toMatchObject({ code: 'GITLAB_CREDENTIAL_UNAVAILABLE' });
    process.env.GITLAB_TOKEN_fixture_ref = 'service-fixture'; handle = () => ({ body: { ok: true } });
    expect(await g.request({ ...connection, credentialRef: 'fixture-ref' }, '/test')).toEqual({ ok: true });
    expect(calls.at(-1).headers['private-token']).toBe('service-fixture'); expect(calls.at(-1).headers.authorization).toBeUndefined();
  });
  test('分支目录与提交分页、投影及上限', async () => {
    handle = ({ url }) => ({ body: Number(url.searchParams.get('page')) === 1 ? Array.from({ length: 100 }, (_, i) => ({ name: `b${i}` })) : [{ name: 'last', protected: true, commit: { id: 'sha' }, web_url: 'http://fixture/branch' }] });
    const branches = await g.listBranches(connection, opts); expect(branches).toHaveLength(101); expect(branches[0].commitSha).toBeNull();
    expect(calls[0].headers.authorization).toBe('Bearer fixture-only-oauth'); expect(calls[0].url.pathname).toContain('group%2Fdocs');
    handle = ({ url }) => ({ body: Number(url.searchParams.get('page')) === 1 ? Array.from({ length: 100 }, () => ({ name: 'file', path: 'docs/a.md', type: 'blob' })) : [] });
    expect(await g.listTree(connection, '', 'docs', opts)).toHaveLength(100); expect(calls.at(-1).url.searchParams.get('ref')).toBe('main'); expect(calls.at(-1).url.searchParams.get('path')).toBe('docs');
    handle = () => ({ body: Array.from({ length: 1001 }, () => ({ name: 'b' })) });
    await expect(g.listBranches(connection, opts)).rejects.toMatchObject({ code: 'GITLAB_BRANCHES_TOO_LARGE' });
    await expect(g.listTree(connection, 'main', '', opts)).rejects.toMatchObject({ code: 'GITLAB_TREE_TOO_LARGE' });
    handle = () => ({ body: Array.from({ length: 20 }, (_, i) => ({ short_id: `short${i}`, title: 'title' })) });
    const commits = await g.listCommits(connection, '', opts); expect(commits).toHaveLength(100); expect(commits[0]).toMatchObject({ sha: 'short0', webUrl: null });
    handle = () => ({ body: [{ id: 'full', short_id: 'short', web_url: 'http://fixture/commit' }] });
    expect((await g.listCommits(connection, 'release', opts))[0]).toMatchObject({ sha: 'full', webUrl: 'http://fixture/commit' });
  });
  test('文件类型、编码、缺正文回退与大小上限', async () => {
    handle = () => ({ body: {} });
    expect(await g.readFile(connection, '', 'docs/a.md', opts)).toMatchObject({ ref: 'main', path: 'docs/a.md', content: '', encoding: 'utf-8', blobId: null, commitId: null });
    handle = () => ({ body: { encoding: 'base64' } }); expect((await g.readFile(connection, 'main', 'docs/a.png', opts)).size).toBe(0);
    await expect(g.readFile(connection, 'main', 'docs/a.txt', opts)).rejects.toMatchObject({ code: 'GITLAB_FILE_TYPE_NOT_ALLOWED' });
    handle = () => ({ body: { content: 'x'.repeat(g.MAX_FILE_BYTES + 1) } }); await expect(g.readFile(connection, 'main', 'docs/a.md', opts)).rejects.toMatchObject({ code: 'GITLAB_FILE_TOO_LARGE' });
  });
  test('图片编码错误、读取异常及托管清单直接使用', async () => {
    expect(() => g.extractMarkdownResources('<img src="%xy.png">', 'docs/a.md')).toThrow(code('GITLAB_RESOURCE_PATH_INVALID'));
    handle = () => ({ status: 503, body: {} }); await expect(g.readDocumentResources(connection, 'main', { markdown: '![](a.png)', filePath: 'docs/a.md' }, opts)).rejects.toMatchObject({ code: 'GITLAB_REQUEST_FAILED' });
    const managed = { path: 'docs/a.png', size: 3, contentDigest: 'frozen' };
    expect(await g.readDocumentResources(connection, 'main', { markdown: '![](a.png)', filePath: 'docs/a.md' }, { ...opts, managedResources: [managed] })).toEqual([managed]);
  });
  function setupDelivery(overrides = {}) {
    const image = Buffer.from('fixture-image'); const resource = { path: 'docs/image.png', size: image.length, contentDigest: digest(image), delivery: 'create' };
    const document = { action: 'update', filePath: 'docs/a.md', markdown: '# new\n![](image.png)', baselineContent: '# old', resources: [resource] };
    const input = { taskId: 'boundary', branch: 'main', commitSha: 'base', candidateDigest: 'frozen', title: 'fixture', documents: [document], ...overrides };
    const files = new Map([['docs/a.md', Buffer.from('# old')]]); const writes = [];
    let work = false, mr = null;
    handle = call => {
      const endpoint = call.url.pathname.split('/projects/group%2Fdocs')[1];
      if (call.method !== 'GET') writes.push(call);
      if (endpoint === '/merge_requests' && call.method === 'GET') return { body: mr ? [mr] : [] };
      if (endpoint === '/repository/branches/main') return { body: { commit: { id: 'base' } } };
      if (endpoint.startsWith('/repository/branches/') && call.method === 'GET') return work ? { body: { commit: { id: 'work' } } } : { status: 404, body: {} };
      if (endpoint === '/repository/branches' && call.method === 'POST') { work = true; return { body: { name: 'work' } }; }
      if (endpoint.startsWith('/repository/files/')) {
        const name = decodeURIComponent(endpoint.slice('/repository/files/'.length)); const bytes = files.get(name);
        return bytes ? { body: { encoding: 'base64', content: bytes.toString('base64'), commit_id: 'file-commit' } } : { status: 404, body: {} };
      }
      if (endpoint === '/repository/commits') { for (const a of call.body.actions) files.set(a.file_path, Buffer.from(a.content, a.encoding === 'base64' ? 'base64' : 'utf8')); return { body: { id: 'commit' } }; }
      if (endpoint === '/merge_requests' && call.method === 'POST') { mr = { iid: 1, web_url: 'http://fixture/mr/1', state: 'opened', source_branch: call.body.source_branch, target_branch: call.body.target_branch, description: call.body.description }; return { body: mr }; }
      return { status: 500, body: { message: endpoint } };
    };
    return { input, image, resource, files, writes, original: handle };
  }
  test('托管图片真实上传、正文提交和MR重试回读', async () => {
    const f = setupDelivery(); const options = { ...opts, loadResource: async () => f.image };
    const mr = await g.submitDocumentMergeRequest(connection, f.input, options); expect(mr.iid).toBe(1);
    expect(f.files.get('docs/image.png')).toEqual(f.image); expect(f.files.get('docs/a.md').toString()).toBe(f.input.documents[0].markdown);
    expect(f.writes.find(c => c.url.pathname.endsWith('/commits')).body.actions).toEqual(expect.arrayContaining([expect.objectContaining({ encoding: 'base64', action: 'create' })]));
    expect((await g.submitDocumentMergeRequest(connection, f.input, options)).iid).toBe(1); expect(f.writes.filter(c => c.url.pathname.endsWith('/merge_requests'))).toHaveLength(1);
  });
  test('冻结清单不匹配及同路径资源冲突在远端写入前拒绝', async () => {
    const f = setupDelivery(); f.input.documents[0].resources = [];
    await expect(g.submitDocumentMergeRequest(connection, f.input, opts)).rejects.toMatchObject({ code: 'GITLAB_RESOURCE_READBACK_FAILED' }); expect(f.writes).toHaveLength(0);
    f.input.documents[0].resources = [f.resource];
    f.input.documents.push({ ...f.input.documents[0], filePath: 'docs/b.md', resources: [{ ...f.resource, contentDigest: 'different' }] });
    await expect(g.submitDocumentMergeRequest(connection, f.input, opts)).rejects.toMatchObject({ code: 'GITLAB_RESOURCE_PATH_CONFLICT' }); expect(f.writes).toHaveLength(0);
  });
  test.each(['missing-reader', 'wrong-delivery', 'not-buffer', 'empty', 'oversize', 'size', 'digest'])('托管资源%s拒绝', async mode => {
    const f = setupDelivery(); let loadResource = async () => f.image;
    if (mode === 'missing-reader') loadResource = null;
    if (mode === 'wrong-delivery') f.resource.delivery = 'existing';
    if (mode === 'not-buffer') loadResource = async () => 'text';
    if (mode === 'empty') loadResource = async () => Buffer.alloc(0);
    if (mode === 'oversize') loadResource = async () => Buffer.alloc(g.MAX_FILE_BYTES + 1);
    if (mode === 'size') loadResource = async () => Buffer.from('x');
    if (mode === 'digest') loadResource = async () => Buffer.alloc(f.image.length);
    await expect(g.submitDocumentMergeRequest(connection, f.input, { ...opts, loadResource })).rejects.toMatchObject({ code: ['missing-reader', 'wrong-delivery'].includes(mode) ? 'GITLAB_RESOURCE_READBACK_FAILED' : 'GITLAB_RESOURCE_SNAPSHOT_CHANGED' });
    expect(f.writes).toHaveLength(0);
  });
  test('仓库图片一致直接复用，不同图片和上游异常拒绝', async () => {
    const f = setupDelivery(); f.files.set(f.resource.path, f.image);
    await expect(g.submitDocumentMergeRequest(connection, f.input, opts)).resolves.toMatchObject({ iid: 1 });
    expect(f.writes.find(c => c.url.pathname.endsWith('/commits')).body.actions).toHaveLength(1);
    const bad = setupDelivery(); bad.files.set(bad.resource.path, Buffer.from('wrong'));
    await expect(g.submitDocumentMergeRequest(connection, bad.input, opts)).rejects.toMatchObject({ code: 'GITLAB_RESOURCE_READBACK_FAILED' });
    expect(bad.writes).toHaveLength(0);
    const failure = setupDelivery(); handle = call => call.url.pathname.includes('/files/docs%2Fimage.png') ? { status: 503, body: {} } : failure.original(call);
    await expect(g.submitDocumentMergeRequest(connection, failure.input, opts)).rejects.toMatchObject({ code: 'GITLAB_REQUEST_FAILED' });
  });
  test('无正文变化与无效人员拒绝', async () => {
    const f = setupDelivery(); f.input.documents[0].markdown = f.input.documents[0].baselineContent;
    await expect(g.submitDocumentMergeRequest(connection, f.input, opts)).rejects.toMatchObject({ code: 'GITLAB_NO_CHANGES' });
    for (const participants of [{ assignees: [] }, { assignees: [{ gitlabId: 1 }], reviewers: [{ gitlabId: -1 }] }]) await expect(g.submitDocumentMergeRequest(connection, { ...f.input, participants }, opts)).rejects.toMatchObject({ code: 'GITLAB_PARTICIPANTS_INVALID' });
  });
  test.each(['create', 'branch-race', 'branch-error', 'file-error', 'mr-response-lost', 'mr-error'])('交付故障与恢复 %s', async mode => {
    const f = setupDelivery(); f.input.documents[0].resources = []; f.input.documents[0].markdown = '# new';
    if (mode === 'create') { f.input.documents[0].action = 'create'; f.input.documents[0].baselineContent = null; f.files.delete('docs/a.md'); }
    let raced = false;
    handle = call => {
      const endpoint = call.url.pathname;
      if (mode === 'branch-race' && endpoint.endsWith('/repository/branches') && call.method === 'POST') { f.original(call); raced = true; return { status: 409, body: {} }; }
      if (mode === 'branch-error' && endpoint.endsWith('/repository/branches') && call.method === 'POST') return { status: 503, body: {} };
      if (mode === 'file-error' && endpoint.includes('/repository/files/')) return { status: 403, body: {} };
      if (mode === 'mr-response-lost' && endpoint.endsWith('/merge_requests') && call.method === 'POST') { f.original(call); return { disconnect: true }; }
      if (mode === 'mr-error' && endpoint.endsWith('/merge_requests') && call.method === 'POST') return { status: 503, body: {} };
      return f.original(call);
    };
    if (['branch-error', 'mr-error', 'file-error'].includes(mode)) await expect(g.submitDocumentMergeRequest(connection, f.input, opts)).rejects.toMatchObject({ code: mode === 'file-error' ? 'GITLAB_FORBIDDEN' : 'GITLAB_REQUEST_FAILED' });
    else expect((await g.submitDocumentMergeRequest(connection, f.input, opts)).state).toBe('opened');
    if (mode === 'branch-race') expect(raced).toBe(true);
  });
  test.each(['same', 'size', 'digest', 'delivery', 'document-path'])('共享资源路径%s', async mode => {
    const f = setupDelivery(); f.files.set(f.resource.path, f.image);
    const other = { ...f.input.documents[0], filePath: 'docs/b.md', resources: [{ ...f.resource }] };
    if (mode === 'size') other.resources[0].size++;
    if (mode === 'digest') other.resources[0].contentDigest = 'different';
    if (mode === 'delivery') other.resources[0].delivery = 'existing';
    if (mode === 'document-path') other.filePath = f.resource.path;
    f.input.documents.push(other); f.files.set(other.filePath, Buffer.from('# old'));
    if (mode === 'same') expect((await g.submitDocumentMergeRequest(connection, f.input, opts)).iid).toBe(1);
    else { await expect(g.submitDocumentMergeRequest(connection, f.input, opts)).rejects.toMatchObject({ code: 'GITLAB_RESOURCE_PATH_CONFLICT' }); expect(f.writes).toHaveLength(0); }
  });
  test.each(['ok', 'missing-sha', 'missing-file', 'file-error', 'changed-body', 'moving-head', 'missing-id', 'closed', 'different-candidate', 'participants'])('已有MR回读 %s', async mode => {
    const f = setupDelivery(); const doc = f.input.documents[0]; doc.resources = []; doc.markdown = '# new';
    f.files.set(doc.filePath, Buffer.from(mode === 'changed-body' ? '# changed' : doc.markdown));
    const previous = { iid: mode === 'missing-id' ? null : 3, web_url: 'http://fixture/mr/3', state: mode === 'closed' ? 'closed' : 'merged', source_branch: 'knowledge-review/boundary', target_branch: 'main', description: mode === 'different-candidate' ? 'different' : '审核候选：frozen' };
    let headReads = 0;
    if (mode === 'participants') f.input.participants = { assignees: [{ gitlabId: 2 }], reviewers: [{ gitlabId: 4 }] };
    handle = call => {
      const endpoint = call.url.pathname;
      if (endpoint.endsWith('/merge_requests')) return { body: [previous] };
      if (endpoint.endsWith('/merge_requests/3')) return { body: { assignees: [{ id: 2 }], reviewers: [{ id: 4 }] } };
      if (endpoint.endsWith('/branches/main')) { headReads++; return { body: mode === 'missing-sha' ? {} : { commit: { id: mode === 'moving-head' && headReads > 1 ? 'moved' : 'base' } } }; }
      if (endpoint.includes('/files/') && ['missing-file', 'file-error'].includes(mode)) return { status: mode === 'missing-file' ? 404 : 503, body: {} };
      return f.original(call);
    };
    const errors = { 'missing-sha': 'GITLAB_MR_RESPONSE_INVALID', 'missing-file': 'GITLAB_SOURCE_CHANGED', 'file-error': 'GITLAB_REQUEST_FAILED', 'changed-body': 'GITLAB_SOURCE_CHANGED', 'moving-head': 'GITLAB_BASELINE_CHANGED', 'missing-id': 'GITLAB_MR_CANDIDATE_CONFLICT', closed: 'GITLAB_MR_CLOSED', 'different-candidate': 'GITLAB_MR_CANDIDATE_CONFLICT' };
    if (errors[mode]) await expect(g.submitDocumentMergeRequest(connection, f.input, opts)).rejects.toMatchObject({ code: errors[mode] });
    else expect((await g.submitDocumentMergeRequest(connection, f.input, opts)).state).toBe('merged');
    expect(f.writes).toHaveLength(0);
  });
  test.each(['ok', 'opened', 'scope', 'missing-sha', 'missing-file', 'file-error', 'changed-body', 'moving-head', 'resource'])('交付刷新 %s', async mode => {
    const f = setupDelivery(); const doc = f.input.documents[0]; doc.resources = []; doc.markdown = '# new';
    f.files.set(doc.filePath, Buffer.from(mode === 'changed-body' ? '# changed' : doc.markdown));
    const input = { ...f.input, mergeRequest: { iid: 3, sourceBranch: 'knowledge-review/boundary', webUrl: 'http://fixture/mr/3' } };
    let heads = 0;
    if (mode === 'resource') { doc.markdown = '![](image.png)'; f.files.set(doc.filePath, Buffer.from(doc.markdown)); f.files.set(f.resource.path, f.image); }
    handle = call => {
      const endpoint = call.url.pathname;
      if (endpoint.endsWith('/merge_requests/3')) return { body: { iid: 3, state: mode === 'opened' ? 'opened' : 'merged', source_branch: mode === 'scope' ? 'wrong' : input.mergeRequest.sourceBranch, target_branch: 'main' } };
      if (endpoint.endsWith('/branches/main')) { heads++; return { body: mode === 'missing-sha' ? {} : { commit: { id: mode === 'moving-head' && heads > 1 ? 'moved' : 'base' } } }; }
      if (endpoint.includes('/files/') && ['missing-file', 'file-error'].includes(mode)) return { status: mode === 'missing-file' ? 404 : 503, body: {} };
      return f.original(call);
    };
    const errors = { scope: 'GITLAB_MR_CANDIDATE_CONFLICT', 'missing-sha': 'GITLAB_MR_RESPONSE_INVALID', 'missing-file': 'GITLAB_DELIVERY_READBACK_FAILED', 'file-error': 'GITLAB_REQUEST_FAILED', 'changed-body': 'GITLAB_DELIVERY_READBACK_FAILED', 'moving-head': 'GITLAB_BASELINE_CHANGED', resource: 'GITLAB_RESOURCE_READBACK_FAILED' };
    if (errors[mode]) await expect(g.readMergeRequestDelivery(connection, input, opts)).rejects.toMatchObject({ code: errors[mode] });
    else { const result = await g.readMergeRequestDelivery(connection, input, opts); expect(result.webUrl).toBe(input.mergeRequest.webUrl); if (mode === 'ok') expect(result.readback.status).toBe('consistent'); }
    expect(f.writes).toHaveLength(0);
  });
  test('读取参数和图片引用错误', async () => {
    for (const input of [null, {}, { mergeRequest: { iid: 1 } }, { mergeRequest: { iid: 1 }, documents: [] }]) await expect(g.readMergeRequestDelivery(connection, input, opts)).rejects.toMatchObject({ code: 'GITLAB_DELIVERY_CONTEXT_INVALID' });
    for (const reference of ['http://remote/image.png', '#fragment', '', '/image.png']) expect(() => g.extractMarkdownResources(`<img src="${reference}">`, 'docs/a.md')).toThrow(code('GITLAB_RESOURCE_DELIVERY_UNSUPPORTED'));
    expect(() => g.extractMarkdownResources('<picture><source srcset="a.png 1x"></picture>', 'a.md')).toThrow(code('GITLAB_RESOURCE_DELIVERY_UNSUPPORTED'));
    for (const reference of ['%00.png', '%5Cbad.png', '%2Fimage.png', '../../image.png']) expect(() => g.extractMarkdownResources(`<img src="${reference}">`, 'docs/a.md')).toThrow(code('GITLAB_RESOURCE_PATH_INVALID'));
    expect(() => g.extractMarkdownResources('![](a.txt)', 'a.md')).toThrow(code('GITLAB_RESOURCE_TYPE_NOT_ALLOWED'));
    expect(g.extractMarkdownResources('`![](code.png)`\n\n<pre><img src="code.png"></pre>\n\n![alt](a.png?x=1#f)\n![](a.png)', 'docs/a.md')).toEqual([{ path: 'docs/a.png', alt: '' }]);
  });
  test('公开默认参数门禁、空图片和默认资源读取', async () => {
    expect(g.extractMarkdownResources(null, 'a.md')).toEqual([]);
    expect(() => g.authorizeMappedRequest({ enabledBranches: ['main'], zhPaths: ['docs'] }, 'main', 'zh')).toThrow(code('GITLAB_PATH_INVALID'));
    await expect(g.submitDocumentMergeRequest({ ...connection, purpose: 'read' }, {})).rejects.toMatchObject({ code: 'GITLAB_WRITE_REQUIRED' });
    await expect(g.submitDocumentMergeRequest(connection, {})).rejects.toMatchObject({ code: 'GITLAB_NO_CHANGES' });
    await expect(g.readMergeRequestDelivery(connection, null)).rejects.toMatchObject({ code: 'GITLAB_DELIVERY_CONTEXT_INVALID' });
    process.env.GITLAB_TOKEN_fixture_ref = 'service-fixture'; const service = { ...connection, credentialRef: 'fixture-ref' };
    handle = () => ({ body: [] }); expect(await g.listCommits(service, 'main')).toEqual([]);
    expect(await g.readDocumentResources(service, 'main', { filePath: 'a.md', markdown: '' })).toEqual([]);
    handle = () => ({ status: 404, body: {} });
    await expect(g.readDocumentResources(service, 'main', { filePath: 'a.md', markdown: '![](a.svg)' })).rejects.toMatchObject({ code: 'GITLAB_RESOURCE_READBACK_FAILED' });
    handle = () => ({ body: { encoding: 'utf8', content: '<svg/>' } });
    expect((await g.readDocumentResources(service, 'main', { filePath: 'a.md', markdown: '![](a.svg)' }))[0].contentDigest).toBe(digest('<svg/>'));
  });
  test.each(['baseline', 'branch-read', 'existing-work', 'already-written', 'source-changed', 'commit-readback', 'target-changed', 'invalid-mr', 'participants-mismatch', 'participants-create', 'svg-resource'])('提交守卫 %s', async mode => {
    const f = setupDelivery(); const doc = f.input.documents[0]; doc.markdown = '# new'; delete doc.resources;
    if (mode === 'already-written') f.files.set(doc.filePath, Buffer.from(doc.markdown));
    if (mode === 'source-changed') f.files.set(doc.filePath, Buffer.from('# other'));
    if (mode.startsWith('participants')) f.input.participants = { assignees: [{ gitlabId: 2 }, { gitlabId: 1 }], reviewers: [{ gitlabId: 4 }] };
    if (mode === 'svg-resource') { const svg = Buffer.from('<svg/>'); f.resource.path = 'docs/image.svg'; f.resource.size = svg.length; f.resource.contentDigest = digest(svg); doc.markdown = '![](image.svg)'; doc.resources = [f.resource]; f.files.set(f.resource.path, svg); }
    let heads = 0, fileReads = 0;
    handle = call => {
      const endpoint = call.url.pathname;
      if (endpoint.endsWith('/branches/main')) { heads++; if (mode === 'baseline' || mode === 'target-changed' && heads > 1) return { body: { commit: { id: 'different' } } }; }
      if (endpoint.includes('/branches/knowledge-review')) {
        if (mode === 'branch-read') return { status: 503, body: {} };
        if (['existing-work', 'already-written'].includes(mode)) return { body: { commit: { id: 'work' } } };
      }
      if (endpoint.includes('/files/')) {
        if (mode === 'commit-readback' && ++fileReads > 1) return { body: { content: '# wrong' } };
        if (mode === 'svg-resource' && endpoint.includes('image.svg')) return { body: { content: '<svg/>' } };
      }
      if (mode === 'invalid-mr' && endpoint.endsWith('/merge_requests') && call.method === 'POST') return { body: {} };
      if (endpoint.endsWith('/merge_requests/1')) return { body: mode === 'participants-mismatch' ? {} : { assignees: [{ id: 1 }, { id: 2 }], reviewers: [{ id: 4 }] } };
      return f.original(call);
    };
    const errors = { baseline: 'GITLAB_BASELINE_CHANGED', 'branch-read': 'GITLAB_REQUEST_FAILED', 'source-changed': 'GITLAB_SOURCE_CHANGED', 'commit-readback': 'GITLAB_SOURCE_CHANGED', 'target-changed': 'GITLAB_BASELINE_CHANGED', 'invalid-mr': 'GITLAB_MR_RESPONSE_INVALID', 'participants-mismatch': 'GITLAB_MR_PARTICIPANTS_CONFLICT' };
    if (errors[mode]) await expect(g.submitDocumentMergeRequest(connection, f.input, opts)).rejects.toMatchObject({ code: errors[mode] });
    else expect((await g.submitDocumentMergeRequest(connection, f.input, opts)).iid).toBe(1);
    if (mode === 'already-written') expect(f.writes.some(c => c.url.pathname.endsWith('/commits'))).toBe(false);
  });
});
