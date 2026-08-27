const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadProfile, ProfileError } = require('../lib/platform-profile/profile-loader');

const repositoryRoot = path.resolve(__dirname, '../..');
const validManifest = 'contracts/enterprise-profile/v1/fixtures/valid/minimal-yashandb.json';

describe('Node 企业能力包加载器', () => {
  test('未设置环境变量时加载默认 YashanDB 且与 Python 指纹一致', () => {
    const nodeResult = loadProfile({ repositoryRoot, env: {} });
    const python = execFileSync('python3', ['-c', [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(path.join(repositoryRoot, 'scripts/pingcode/web/backend'))})`,
      'from app.platform_profile.loader import load_profile',
      `r=load_profile(repository_root=${JSON.stringify(repositoryRoot)}, env={})`,
      'print(json.dumps(dict(r["context"]), ensure_ascii=False, sort_keys=True))'
    ].join(';')], { encoding: 'utf8' });
    const pythonContext = JSON.parse(python);
    expect(pythonContext).toEqual(nodeResult.context);
    expect(nodeResult.context.configFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(nodeResult.context)).not.toContain(repositoryRoot);
  });

  test.each(['', 'unknown', '../outside'])('显式非法选择 %p 不回退默认包', profileId => {
    expect(() => loadProfile({ repositoryRoot, env: { KNOWLEDGE_PLATFORM_PROFILE: profileId } }))
      .toThrow(ProfileError);
    try {
      loadProfile({ repositoryRoot, env: { KNOWLEDGE_PLATFORM_PROFILE: profileId } });
    } catch (error) {
      expect(error.code).toBe('PROFILE_NOT_FOUND');
      expect(error.message).toMatch(/企业能力包/);
    }
  });

  test('资源缺失返回稳定中文错误且不泄露绝对路径', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kpg-profile-'));
    fs.mkdirSync(path.join(temporaryRoot, 'contracts/enterprise-profile/v1'), { recursive: true });
    fs.cpSync(path.join(repositoryRoot, 'contracts/enterprise-profile/v1/enterprise-profile.schema.json'), path.join(temporaryRoot, 'contracts/enterprise-profile/v1/enterprise-profile.schema.json'));
    fs.mkdirSync(path.join(temporaryRoot, 'profiles'), { recursive: true });
    fs.cpSync(path.join(repositoryRoot, validManifest), path.join(temporaryRoot, 'profiles/yashandb.json'));
    expect(() => loadProfile({ repositoryRoot: temporaryRoot, registry: { yashandb: 'profiles/yashandb.json' }, env: {} }))
      .toThrow(expect.objectContaining({ code: 'PROFILE_RESOURCE_NOT_FOUND', issueCode: 'RESOURCE_NOT_FOUND' }));
  });

  test('符号链接逃逸被拒绝', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kpg-profile-'));
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kpg-outside-'));
    fs.mkdirSync(path.join(temporaryRoot, 'contracts/enterprise-profile/v1'), { recursive: true });
    fs.cpSync(path.join(repositoryRoot, 'contracts/enterprise-profile/v1/enterprise-profile.schema.json'), path.join(temporaryRoot, 'contracts/enterprise-profile/v1/enterprise-profile.schema.json'));
    fs.writeFileSync(path.join(outsideRoot, 'domain.json'), '{}');
    fs.mkdirSync(path.join(temporaryRoot, 'contracts/enterprise-profile/v1/fixtures/resources'), { recursive: true });
    fs.mkdirSync(path.join(temporaryRoot, 'contracts/enterprise-profile/v1/fixtures/valid'), { recursive: true });
    fs.symlinkSync(path.join(outsideRoot, 'domain.json'), path.join(temporaryRoot, 'contracts/enterprise-profile/v1/fixtures/resources/domain.json'));
    fs.cpSync(path.join(repositoryRoot, validManifest), path.join(temporaryRoot, validManifest));
    expect(() => loadProfile({ repositoryRoot: temporaryRoot, env: {} }))
      .toThrow(expect.objectContaining({ code: 'PROFILE_PATH_FORBIDDEN', issueCode: 'SYMLINK_ESCAPE' }));
  });
});
