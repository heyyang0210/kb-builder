const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  GitLabConnectorError,
  upsertConnection,
  readConfig,
  listBranches,
  listTree,
  readFile,
  upsertMapping,
  findMapping,
  authorizeMappedRequest,
} = require('../lib/gitlab-connector');

describe('GitLab connector', () => {
  let file;
  beforeEach(() => { file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gitlab-')), 'connections.json'); });
  afterEach(() => { fs.rmSync(path.dirname(file), { recursive: true, force: true }); delete process.env.GITLAB_TOKEN_ci_ref; });

  test('stores only credential reference and defaults to disabled', () => {
    const item = upsertConnection({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc', credentialRef: 'ci-ref' }, file);
    expect(item.mode).toBe('disabled');
    expect(item.credentialConfigured).toBe(true);
    expect(item.authMode).toBe('service_account');
    expect(item.purpose).toBe('read');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).connections[0].token).toBeUndefined();
  });

  test('projects legacy connections with derived display fields', () => {
    fs.writeFileSync(file, JSON.stringify({ connections: [{ id: 'legacy', name: 'legacy', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc', mode: 'production', credentialRef: null }] }));
    const item = require('../lib/gitlab-connector').sanitizeConnection(readConfig(file).connections[0]);
    expect(item).toMatchObject({ baseUrl: 'https://git-tools.yasdb.com', projectPath: 'cod-doc/yasdoc', authMode: 'user_oauth', purpose: 'read', credentialConfigured: false, status: 'pending' });
  });

  test('service account requires a credential reference and OAuth clears legacy references', () => {
    expect(() => upsertConnection({ name: 'service', host: 'https://git-tools.yasdb.com', project: 'cod-doc/service', authMode: 'service_account' }, file)).toThrow(expect.objectContaining({ code: 'GITLAB_CREDENTIAL_REF_REQUIRED' }));
    const service = upsertConnection({ name: 'service', host: 'https://git-tools.yasdb.com', project: 'cod-doc/service', credentialRef: 'service_read', authMode: 'service_account' }, file);
    const oauth = upsertConnection({ id: service.id, name: 'service', host: 'https://git-tools.yasdb.com', project: 'cod-doc/service', authMode: 'user_oauth' }, file);
    expect(oauth).toMatchObject({ authMode: 'user_oauth', credentialConfigured: false });
    expect(readConfig(file).connections[0].credentialRef).toBeNull();
  });

  test('disabled connector refuses remote calls', async () => {
    upsertConnection({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc', credentialRef: 'ci_ref' }, file);
    await expect(listBranches({ ...readConfig(file).connections[0] })).rejects.toMatchObject({ code: 'GITLAB_CONNECTOR_DISABLED' });
  });

  test('reads branches, tree and file through GitLab API', async () => {
    upsertConnection({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc-sandbox', credentialRef: 'ci_ref', mode: 'sandbox' }, file);
    process.env.GITLAB_TOKEN_ci_ref = 'secret';
    const calls = [];
    global.fetch = jest.fn(async url => {
      calls.push(url);
      if (url.includes('/branches')) return { ok: true, text: async () => JSON.stringify([{ name: 'master', protected: true, commit: { id: 'abc' } }]) };
      if (url.includes('/tree')) return { ok: true, text: async () => JSON.stringify([{ name: '_index.md', path: 'doc/_index.md', type: 'blob' }]) };
      return { ok: true, text: async () => JSON.stringify({ file_path: 'doc/_index.md', encoding: 'base64', content: Buffer.from('# docs').toString('base64'), commit_id: 'abc' }) };
    });
    const connection = readConfig(file).connections[0];
    await expect(listBranches(connection)).resolves.toEqual([{ name: 'master', protected: true, commitSha: 'abc', webUrl: null }]);
    await expect(listTree(connection, 'master')).resolves.toEqual([{ name: '_index.md', path: 'doc/_index.md', type: 'blob', id: undefined, mode: undefined }]);
    await expect(readFile(connection, 'master', 'doc/_index.md')).resolves.toMatchObject({ content: '# docs', commitId: 'abc' });
    expect(calls.every(url => url.startsWith('https://git-tools.yasdb.com/api/v4/projects/cod-doc%2Fyasdoc-sandbox'))).toBe(true);
  });

  test('uses per-user OAuth access token when provided', async () => {
    const connection = { host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc-sandbox', mode: 'sandbox', credentialRef: null };
    let headers;
    global.fetch = jest.fn(async (_url, options) => {
      headers = options.headers;
      return { ok: true, text: async () => JSON.stringify([{ name: 'master', commit: { id: 'oauth-commit' } }]) };
    });
    await listBranches(connection, { accessToken: 'oauth-token' });
    expect(headers.Authorization).toBe('Bearer oauth-token');
    expect(headers['PRIVATE-TOKEN']).toBeUndefined();
  });

  test('guides users to OAuth when no user token or service credential exists', async () => {
    const connection = { host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc', mode: 'production', credentialRef: null };
    await expect(listBranches(connection)).rejects.toMatchObject({
      code: 'GITLAB_OAUTH_REQUIRED',
      message: '请先连接 GitLab 账号',
      status: 401,
    });
  });

  test('rejects unsafe paths', async () => {
    const connection = { host: 'https://git-tools.yasdb.com', project: 'x', mode: 'sandbox', credentialRef: 'ci_ref' };
    process.env.GITLAB_TOKEN_ci_ref = 'secret';
    await expect(readFile(connection, 'master', '../etc/passwd')).rejects.toMatchObject({ code: 'GITLAB_PATH_INVALID' });
  });

  test('rejects traversal inside an authorized mapping root', () => {
    const mapping = { enabledBranches: ['master'], zhPaths: ['doc/产品文档/产品描述'], enPaths: [] };
    expect(() => authorizeMappedRequest(mapping, 'master', 'zh', 'doc/产品文档/产品描述/../其他手册/_index.md')).toThrow(expect.objectContaining({ code: 'GITLAB_PATH_INVALID' }));
  });

  test('handbook mapping restricts branch, language and repository path', () => {
    const connection = upsertConnection({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc-sandbox', credentialRef: 'ci_ref', mode: 'sandbox' }, file);
    const mapping = upsertMapping('DB-001', { connectionId: connection.id, defaultBranch: 'master', enabledBranches: ['master', 'br23.4.14'], zhPaths: ['doc/产品文档/数据库管理'], enPaths: ['doc/Manuals/Database Administration'] }, file, { idempotencyKey: 'mapping-1', operatorId: 'admin' });
    expect(findMapping('DB-001', file).mapping).toEqual(mapping);
    expect(mapping.enabledBranches).toEqual(['master', 'br23.4.14']);
    expect(authorizeMappedRequest(mapping, 'br23.4.14', 'zh', 'doc/产品文档/数据库管理/_index.md')).toBe('doc/产品文档/数据库管理/_index.md');
    expect(() => authorizeMappedRequest(mapping, 'dev', 'zh', 'doc/产品文档/数据库管理/_index.md')).toThrow(expect.objectContaining({ code: 'GITLAB_BRANCH_NOT_ALLOWED' }));
    expect(() => authorizeMappedRequest(mapping, 'master', 'zh', 'doc/产品文档/安装/_index.md')).toThrow(expect.objectContaining({ code: 'GITLAB_PATH_FORBIDDEN' }));
  });

  test('legacy enabled branches are normalized to the selected branch', () => {
    const connection = upsertConnection({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc-sandbox', mode: 'sandbox' }, file);
    const mapping = upsertMapping('DB-001', { connectionId: connection.id, defaultBranch: 'release', enabledBranches: ['master', 'release', 'dev'], zhPaths: ['doc'], enPaths: [] }, file);
    expect(mapping.defaultBranch).toBe('release');
    expect(mapping.enabledBranches).toEqual(['master', 'release', 'dev']);
  });

  test('configuration writes require unique idempotency keys when provided', () => {
    upsertConnection({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc' }, file, { idempotencyKey: 'request-1' });
    expect(() => upsertConnection({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc' }, file, { idempotencyKey: 'request-1' })).toThrow(expect.objectContaining({ code: 'IDEMPOTENCY_REPLAY' }));
  });

  test('sandbox mode refuses the configured production repository', () => {
    expect(() => upsertConnection({ name: 'unsafe', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc', mode: 'sandbox' }, file)).toThrow(expect.objectContaining({ code: 'GITLAB_SANDBOX_PROJECT_REQUIRED' }));
  });
});
