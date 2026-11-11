const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadProfile, validateProfile, ProfileError } = require('../../../packages/agent-runner-core/lib/platform-profile/profile-loader');

const repositoryRoot = path.resolve(__dirname, '../../..');
const validManifest = 'packages/platform-contracts/enterprise-profile/v1/fixtures/valid/minimal-yashandb.json';

describe('企业能力包损坏配置边界', () => {
  const minimal = () => JSON.parse(fs.readFileSync(path.join(repositoryRoot, validManifest), 'utf8'));
  test.each([
    ['必填字段', profile => { delete profile.domain; }, 'PROFILE_VALIDATION_FAILED', '/domain'],
    ['缺少元数据', profile => { profile.metadata = null; }, 'PROFILE_VALIDATION_FAILED', '/metadata'],
    ['集合类型', profile => { profile.skills = {}; }, 'PROFILE_VALIDATION_FAILED', '/skills'],
    ['敏感字段', profile => { profile.brand.nested = { token: 'fixture-only' }; }, 'PROFILE_SECRET_EXPOSED', '/brand/nested/token'],
    ['资源标识缺失', profile => { profile.skills = [{}]; }, 'PROFILE_VALIDATION_FAILED', '/skills/0/id'],
    ['资源标识非法', profile => { profile.skills = [{ id: '../outside' }]; }, 'PROFILE_VALIDATION_FAILED', '/skills/0/id'],
    ['资源重复', profile => { profile.skills = [{ id: 'same' }, { id: 'same' }]; }, 'PROFILE_VALIDATION_FAILED', '/skills/1/id'],
    ['工作区不存在', profile => { profile.modules = [{ id: 'module', workspaceRef: 'missing' }]; }, 'PROFILE_VALIDATION_FAILED', '/modules/0/workspaceRef'],
    ['能力不存在', profile => { profile.connectors = [{ id: 'connector', type: 'local-upload', capabilityRefs: ['missing'], secretRefs: [] }]; }, 'PROFILE_VALIDATION_FAILED', '/connectors/0/capabilityRefs/0'],
    ['密钥格式', profile => { profile.connectors = [{ id: 'connector', type: 'local-upload', capabilityRefs: [], secretRefs: ['plain-value'] }]; }, 'PROFILE_VALIDATION_FAILED', '/connectors/0/secretRefs/0'],
    ['版本', profile => { profile.apiVersion = 'enterprise-profile/v2'; }, 'PROFILE_VERSION_UNSUPPORTED', '/apiVersion'],
    ['类型', profile => { profile.kind = 'Other'; }, 'PROFILE_VERSION_UNSUPPORTED', '/apiVersion'],
    ['包标识', profile => { profile.metadata.id = '../invalid'; }, 'PROFILE_VALIDATION_FAILED', '/metadata'],
    ['企业标识', profile => { profile.metadata.enterpriseId = ''; }, 'PROFILE_VALIDATION_FAILED', '/metadata'],
    ['策略数组', profile => { profile.generationPolicies = {}; }, 'PROFILE_VALIDATION_FAILED', '/generationPolicies'],
    ['能力引用数组', profile => { profile.connectors = [{ id: 'connector', type: 'local-upload', secretRefs: [] }]; }, 'PROFILE_VALIDATION_FAILED', '/connectors/0'],
    ['密钥引用数组', profile => { profile.connectors = [{ id: 'connector', type: 'local-upload', capabilityRefs: [] }]; }, 'PROFILE_VALIDATION_FAILED', '/connectors/0'],
    ['未知连接器', profile => { profile.connectors = [{ id: 'connector', type: 'unknown', capabilityRefs: [], secretRefs: [] }]; }, 'PROFILE_VALIDATION_FAILED', '/connectors/0/secretRefs'],
    ['最低密钥', profile => { profile.connectors = [{ id: 'connector', type: 'pingcode', capabilityRefs: [], secretRefs: [] }]; }, 'PROFILE_VALIDATION_FAILED', '/connectors/0/secretRefs'],
  ])('%s错误返回公开错误码和配置指针', (_label, mutate, code, pointer) => {
    const profile = minimal();
    mutate(profile);
    expect(() => validateProfile(profile)).toThrow(expect.objectContaining({ code, path: pointer }));
  });

  const policyProfile = () => {
    const profile = minimal();
    profile.templates = [{ id: 'template' }];
    profile.logicalDirectories = [{ id: 'output' }];
    profile.generationPolicies = [{
      id: 'policy', enabled: true, documentTypes: ['manual'], generationModes: ['full'],
      templateRef: 'template', sourcePolicy: { mode: 'manual', requiredConfirmation: true },
      outputPolicy: { logicalDirectoryRef: 'output' }
    }];
    return profile;
  };
  test.each([
    ...['agentRefs', 'skillRefs', 'promptRefs', 'qualityRuleRefs'].map(field => [field,
      policy => { policy[field] = ['missing']; }, `/${field}/0`, 'REFERENCE_UNKNOWN']),
    ['来源连接器', policy => { policy.sourcePolicy.allowedConnectorRefs = ['missing']; }, '/sourcePolicy/allowedConnectorRefs/0', 'REFERENCE_UNKNOWN'],
    ['模板', policy => { policy.templateRef = 'missing'; }, '/templateRef', 'REFERENCE_UNKNOWN'],
    ['输出目录', policy => { policy.outputPolicy.logicalDirectoryRef = 'missing'; }, '/outputPolicy/logicalDirectoryRef', 'REFERENCE_UNKNOWN'],
    ['选源确认', policy => { policy.sourcePolicy.requiredConfirmation = false; }, '/sourcePolicy', 'SOURCE_CONFIRMATION_REQUIRED']
  ])('策略%s无效时指向具体配置位置', (_label, mutate, pointer, issueCode) => {
    const profile = policyProfile();
    mutate(profile.generationPolicies[0]);
    expect(() => validateProfile(profile)).toThrow(expect.objectContaining({
      code: 'PROFILE_VALIDATION_FAILED', issueCode, path: `/generationPolicies/0${pointer}`
    }));
  });
  test('启用策略匹配歧义被拒绝，禁用策略不占用匹配，可选引用允许省略', () => {
    const profile = policyProfile();
    expect(() => validateProfile(profile)).not.toThrow();
    profile.generationPolicies.push({ ...profile.generationPolicies[0], id: 'duplicate' });
    expect(() => validateProfile(profile)).toThrow(expect.objectContaining({
      issueCode: 'GENERATION_POLICY_AMBIGUOUS', path: '/generationPolicies/1'
    }));
    profile.generationPolicies[1].enabled = false;
    expect(() => validateProfile(profile)).not.toThrow();
  });

  let isolatedRoot;
  const schemaRef = 'packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json';
  const registry = { yashandb: 'profile.json' };
  const load = () => loadProfile({ repositoryRoot: isolatedRoot, registry, env: {} });
  beforeEach(() => {
    const output = path.join(repositoryRoot, 'runtime/test-results');
    fs.mkdirSync(output, { recursive: true });
    isolatedRoot = fs.mkdtempSync(path.join(output, 'profile-loader-boundaries-'));
    fs.mkdirSync(path.dirname(path.join(isolatedRoot, schemaRef)), { recursive: true });
    fs.copyFileSync(path.join(repositoryRoot, schemaRef), path.join(isolatedRoot, schemaRef));
    fs.writeFileSync(path.join(isolatedRoot, 'profile.json'), JSON.stringify(minimal()));
  });
  afterEach(() => fs.rmSync(isolatedRoot, { recursive: true, force: true }));

  test.each([
    ['env存在', 'env:PROFILE_TEST_KEY', { PROFILE_TEST_KEY: 'fixture-env-value' }, undefined, true],
    ['env缺失', 'env:PROFILE_TEST_KEY', {}, undefined, false],
    ['密钥已解析', 'secret:connectors/fixture', {}, () => 'fixture-resolved-value', true],
    ['密钥未解析', 'secret:connectors/fixture', {}, () => '', false]
  ])('%s仅投影配置状态且显式包选择优先', (_label, reference, env, secretResolver, configured) => {
    const profile = minimal();
    profile.connectors = [{ id: 'fixture', type: 'local-upload', enabled: true, capabilityRefs: [], secretRefs: [reference] }];
    const resource = path.join(isolatedRoot, profile.domain.manifestRef);
    fs.mkdirSync(path.dirname(resource), { recursive: true });
    fs.writeFileSync(resource, '{}');
    fs.writeFileSync(path.join(isolatedRoot, 'profile.json'), JSON.stringify(profile));
    const options = { repositoryRoot: isolatedRoot, registry, profileId: 'yashandb', env: { ...env, KNOWLEDGE_PLATFORM_PROFILE: 'unknown' }, secretResolver };
    const result = loadProfile(options);
    expect(result.context.profileId).toBe('yashandb');
    expect(result.context.connectors).toEqual([{ id: 'fixture', type: 'local-upload', enabled: true, configured }]);
    expect(JSON.stringify(result.context)).not.toMatch(/fixture-env-value|fixture-resolved-value/);
    const unresolved = loadProfile({ ...options, env: {}, secretResolver: () => '' });
    expect(unresolved.context.connectors[0].configured).toBe(false);
    expect(result.context.configFingerprint).toBe(unresolved.context.configFingerprint);
  });

  test.each([
    ['清单不存在', () => fs.unlinkSync(path.join(isolatedRoot, 'profile.json')), 'PROFILE_NOT_FOUND', 'PROFILE_FILE_UNREADABLE'],
    ['清单JSON损坏', () => fs.writeFileSync(path.join(isolatedRoot, 'profile.json'), '{broken'), 'PROFILE_PARSE_FAILED', 'JSON_PARSE_FAILED'],
    ['Schema不存在', () => fs.unlinkSync(path.join(isolatedRoot, schemaRef)), 'PROFILE_RESOURCE_NOT_FOUND', 'SCHEMA_NOT_FOUND'],
    ['Schema损坏', () => fs.writeFileSync(path.join(isolatedRoot, schemaRef), '{broken'), 'PROFILE_RESOURCE_NOT_FOUND', 'SCHEMA_NOT_FOUND'],
  ])('%s保留稳定诊断且不暴露本地路径', (_label, damage, code, issueCode) => {
    damage();
    expect(load).toThrow(expect.objectContaining({ code, issueCode, path: '/' }));
    try { load(); } catch (error) { expect(error.message).not.toContain(isolatedRoot); }
  });

  test.each(['enterprise-profile/v2', null])('Schema拒绝不支持或缺失版本%p', version => {
    const profile = minimal();
    if (version) profile.apiVersion = version;
    else delete profile.apiVersion;
    fs.writeFileSync(path.join(isolatedRoot, 'profile.json'), JSON.stringify(profile));
    expect(load).toThrow(expect.objectContaining({
      code: version ? 'PROFILE_VERSION_UNSUPPORTED' : 'PROFILE_VALIDATION_FAILED'
    }));
  });

  test('存在的目录不能作为资源文件加载', () => {
    const profile = minimal();
    fs.mkdirSync(path.join(isolatedRoot, profile.domain.manifestRef), { recursive: true });
    expect(load).toThrow(expect.objectContaining({
      code: 'PROFILE_VALIDATION_FAILED', issueCode: 'RESOURCE_NOT_FILE', path: '/domain/manifestRef'
    }));
  });

  test('资源路径格式合法但不在授权目录时拒绝加载', () => {
    const profile = minimal();
    profile.domain.manifestRef = 'knowledge/unregistered/resource.json';
    fs.writeFileSync(path.join(isolatedRoot, 'profile.json'), JSON.stringify(profile));
    expect(load).toThrow(expect.objectContaining({
      code: 'PROFILE_PATH_FORBIDDEN', issueCode: 'PATH_OUT_OF_ROOT', path: '/domain/manifestRef'
    }));
  });
});

describe('Node 企业能力包加载器', () => {
  test('未设置环境变量时加载默认 YashanDB 且与 Python 指纹一致', () => {
    const nodeResult = loadProfile({ repositoryRoot, env: {} });
    const python = execFileSync('python3', ['-c', [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(path.join(repositoryRoot, 'apps/pingcode-api'))})`,
      'from app.platform_profile.loader import load_profile',
      `r=load_profile(repository_root=${JSON.stringify(repositoryRoot)}, env={})`,
      'print(json.dumps(dict(r["context"]), ensure_ascii=False, sort_keys=True))'
    ].join(';')], { encoding: 'utf8' });
    const pythonContext = JSON.parse(python);
    expect(pythonContext).toEqual(nodeResult.context);
    expect(nodeResult.context.configFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(nodeResult.resources).toHaveLength(35);
    expect(nodeResult.resources).toEqual(expect.arrayContaining([
      ...['continue-technical-document', 'extract-document-cases', 'execute-yashandb-cases', 'compare-case-results', 'render-test-report'].map(id =>
        expect.objectContaining({ reference: `knowledge/skills/${id}/SKILL.md`, digest: expect.stringMatching(/^[0-9a-f]{64}$/) })),
    ]));
    expect(nodeResult.context.brand.icon).toEqual({
      alt: 'YashanDB 知识中心',
      resourceRef: 'config/knowledge-center/branding/default-icon.png'
    });
    expect(nodeResult.context.connectors).toEqual([
      { configured: true, enabled: true, id: 'local-upload', type: 'local-upload' },
      { configured: false, enabled: true, id: 'pingcode', type: 'pingcode' },
      { configured: false, enabled: true, id: 'mcp', type: 'mcp' }
    ]);
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
    fs.mkdirSync(path.join(temporaryRoot, 'packages/platform-contracts/enterprise-profile/v1'), { recursive: true });
    fs.cpSync(path.join(repositoryRoot, 'packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json'), path.join(temporaryRoot, 'packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json'));
    fs.mkdirSync(path.join(temporaryRoot, 'knowledge/profiles'), { recursive: true });
    fs.cpSync(path.join(repositoryRoot, validManifest), path.join(temporaryRoot, 'knowledge/profiles/yashandb.json'));
    expect(() => loadProfile({ repositoryRoot: temporaryRoot, registry: { yashandb: 'knowledge/profiles/yashandb.json' }, env: {} }))
      .toThrow(expect.objectContaining({ code: 'PROFILE_RESOURCE_NOT_FOUND', issueCode: 'RESOURCE_NOT_FOUND' }));
  });

  test('符号链接逃逸被拒绝', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kpg-profile-'));
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kpg-outside-'));
    fs.mkdirSync(path.join(temporaryRoot, 'packages/platform-contracts/enterprise-profile/v1'), { recursive: true });
    fs.cpSync(path.join(repositoryRoot, 'packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json'), path.join(temporaryRoot, 'packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json'));
    fs.writeFileSync(path.join(outsideRoot, 'domain.json'), '{}');
    fs.mkdirSync(path.join(temporaryRoot, 'packages/platform-contracts/enterprise-profile/v1/fixtures/resources'), { recursive: true });
    fs.mkdirSync(path.join(temporaryRoot, 'packages/platform-contracts/enterprise-profile/v1/fixtures/valid'), { recursive: true });
    fs.symlinkSync(path.join(outsideRoot, 'domain.json'), path.join(temporaryRoot, 'packages/platform-contracts/enterprise-profile/v1/fixtures/resources/domain.json'));
    fs.cpSync(path.join(repositoryRoot, validManifest), path.join(temporaryRoot, validManifest));
    expect(() => loadProfile({ repositoryRoot: temporaryRoot, registry: { yashandb: validManifest }, env: {} }))
      .toThrow(expect.objectContaining({ code: 'PROFILE_PATH_FORBIDDEN', issueCode: 'SYMLINK_ESCAPE' }));
  });
});
