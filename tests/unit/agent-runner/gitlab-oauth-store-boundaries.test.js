const {
  GitLabOAuthCredentialStore,
  GitLabOAuthStoreError,
  encryptionKey,
} = require('../../../packages/agent-runner-core/lib/gitlab-oauth-store');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function aggregateWith(initial) {
  let state = structuredClone(initial);
  return {
    read: () => structuredClone(state),
    transaction(mutator) { mutator(state); },
    snapshot: () => structuredClone(state),
  };
}

describe('GitLab OAuth 凭据存储边界', () => {
  const env = { NODE_ENV: 'production', KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY: 'isolated-encryption-key' };

  test('生产环境缺少加密密钥时拒绝保存，开发密钥回退仅在非生产环境可用', () => {
    expect(new GitLabOAuthStoreError('EXAMPLE', 'example').status).toBe(500);
    expect(() => encryptionKey({ NODE_ENV: 'production', KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET: 'client-secret' }))
      .toThrow(expect.objectContaining({ code: 'GITLAB_OAUTH_ENCRYPTION_KEY_REQUIRED', status: 503 }));
    expect(encryptionKey({ NODE_ENV: 'development', KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET: 'client-secret' }))
      .toEqual(encryptionKey({ NODE_ENV: 'development', KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY: 'client-secret' }));
    expect(encryptionKey({ NODE_ENV: 'production', AGENT_RUNNER_KEY: 'runner-key' }))
      .toEqual(encryptionKey({ NODE_ENV: 'production', KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY: 'runner-key' }));

    const previous = process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY;
    try {
      process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY = 'process-environment-key';
      expect(encryptionKey()).toEqual(encryptionKey({ KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY: 'process-environment-key' }));
    } finally {
      if (previous === undefined) delete process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY;
      else process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY = previous;
    }
  });

  test('旧存储缺少 accounts 时可保存、读取、更新和删除加密凭据', () => {
    const aggregate = aggregateWith({ version: 1 });
    const store = new GitLabOAuthCredentialStore({ aggregate, env });
    expect(store.get('user-a', 'connection-a')).toBeNull();
    expect(store.listForUser('user-a')).toEqual([]);

    store.save({ userId: 'user-a', connectionId: 'connection-a', host: 'https://gitlab.example/', accessToken: 'access-one' });
    expect(aggregate.snapshot().accounts).toHaveLength(1);
    expect(aggregate.snapshot().accounts[0].accessTokenEncrypted).not.toContain('access-one');
    expect(store.get('user-a', 'connection-a')).toMatchObject({ accessToken: 'access-one', refreshToken: null, host: 'https://gitlab.example' });
    expect(store.listForUser('user-a')).toMatchObject([{ accountName: null, state: 'connected' }]);

    store.save({ userId: 'user-a', connectionId: 'connection-a', host: 'https://gitlab.example', accessToken: 'access-two', refreshToken: 'refresh-two' });
    expect(aggregate.snapshot().accounts).toHaveLength(1);
    expect(store.get('user-a', 'connection-a')).toMatchObject({ accessToken: 'access-two', refreshToken: 'refresh-two' });
    expect(store.markState('user-a', 'connection-a', 'reauthorization_required')).toMatchObject({ state: 'reauthorization_required' });
    expect(store.markState('user-a', 'missing', 'reauthorization_required')).toBeNull();
    store.remove('user-a', 'connection-a');
    expect(store.get('user-a', 'connection-a')).toBeNull();
    expect(aggregate.snapshot().accounts).toEqual([]);

    const legacyWithoutAccounts = aggregateWith({ version: 1 });
    new GitLabOAuthCredentialStore({ aggregate: legacyWithoutAccounts, env }).remove('nobody', 'nothing');
    expect(legacyWithoutAccounts.snapshot().accounts).toEqual([]);
  });

  test.each(['v2.iv.tag.data', 'v1.iv.tag', 'v1.iv.tag.data'])('拒绝不完整或损坏的密文 %s', encrypted => {
    const aggregate = aggregateWith({ version: 1, accounts: [{
      userId: 'user-a', connectionId: 'connection-a',
      accessTokenEncrypted: encrypted, refreshTokenEncrypted: null,
    }] });
    const store = new GitLabOAuthCredentialStore({ aggregate, env });
    expect(() => store.get('user-a', 'connection-a'))
      .toThrow(expect.objectContaining({ code: 'GITLAB_OAUTH_CREDENTIAL_INVALID', status: 409 }));
  });

  test('文件聚合仓储重建后仍可解密，并且用户列表只投影本用户字段', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlab-oauth-store-'));
    const filePath = path.join(directory, 'credentials.json');
    try {
      const first = new GitLabOAuthCredentialStore({ filePath, env });
      first.save({ userId: 'user-a', connectionId: 'connection-a', host: 'https://gitlab.example', accessToken: 'persisted-token' });
      first.save({ userId: 'user-b', connectionId: 'connection-b', host: 'https://other.example', accessToken: 'other-token' });

      const second = new GitLabOAuthCredentialStore({ filePath, env });
      expect(second.get('user-a', 'connection-a')).toMatchObject({ accessToken: 'persisted-token' });
      second.remove('missing-user', 'missing-connection');
      expect(second.get('user-b', 'connection-b')).toMatchObject({ accessToken: 'other-token' });
      expect(second.listForUser('user-a')).toEqual([expect.objectContaining({
        userId: 'user-a', connectionId: 'connection-a', accountName: null, expiresAt: null,
        lastUsedAt: null, state: 'connected',
      })]);
      expect(second.listForUser('user-b')).toEqual([expect.objectContaining({ userId: 'user-b', connectionId: 'connection-b' })]);
      second.remove('user-a', 'connection-a');
      expect(second.get('user-a', 'connection-a')).toBeNull();
      expect(second.get('user-b', 'connection-b')).toMatchObject({ accessToken: 'other-token' });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test('默认构造器只建立仓储，不读取或写入共享凭据文件', () => {
    const previous = process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY;
    process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY = 'default-constructor-test-key';
    try {
      const store = new GitLabOAuthCredentialStore();
      expect(store.cache).toBeNull();
      expect(typeof store.aggregate.read).toBe('function');
    } finally {
      if (previous === undefined) delete process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY;
      else process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY = previous;
    }
  });

  test('空令牌不加密，空过期时间以 null 返回', () => {
    const store = new GitLabOAuthCredentialStore({ aggregate: aggregateWith({ version: 1, accounts: [] }), env });
    store.save({ userId: 'user-empty', connectionId: 'connection-empty', host: 'https://gitlab.example', accessToken: '', refreshToken: '', expiresAt: '' });
    expect(store.get('user-empty', 'connection-empty')).toMatchObject({ accessToken: null, refreshToken: null, expiresAt: null });
  });

  test('删除缺少可选 accounts 集合的旧记录不报错', () => {
    const aggregate = aggregateWith({ version: 1 });
    const store = new GitLabOAuthCredentialStore({ aggregate, env });
    store.save({ userId: 'user-a', connectionId: 'connection-a', host: 'https://gitlab.example', accessToken: 'token' });
    aggregate.transaction(payload => { delete payload.accounts; });
    store.remove('user-a', 'connection-a');
    expect(aggregate.snapshot().accounts).toEqual([]);
  });
});
