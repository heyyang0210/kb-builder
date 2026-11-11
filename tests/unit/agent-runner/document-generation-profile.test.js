const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../../..');
const { loadProfile } = require('../../../packages/agent-runner-core/lib/platform-profile/profile-loader');

beforeAll(() => {
  const loaded = loadProfile({ repositoryRoot, env: {} });
  Object.defineProperty(global, '__KNOWLEDGE_PLATFORM_CONTEXT__', { value: loaded.context, configurable: true });
  Object.defineProperty(global, '__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__', {
    value: loaded,
    configurable: true
  });
});

afterAll(() => {
  delete global.__KNOWLEDGE_PLATFORM_CONTEXT__;
  delete global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__;
});

describe('文档生成企业能力包接入', () => {
  test('Prompt Generator 使用登记的 Skill、模板和 profile 追溯信息', () => {
    const generator = require('../../../packages/agent-runner-core/lib/prompt-generator');
    const result = generator.assemblePrompt({ name: '表空间管理', part: '第一部分', chapter: '基础', desc: '管理', type: '通用基础' });
    expect(result.skillFile).toBe('../knowledge/skills/00-通用生成-skill.md');
    expect(result.templateFile).toBe('../knowledge/templates/01-通用基础模板.md');
    expect(result.json.enterprise_profile_id).toBe('yashandb');
    expect(result.json.config_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.prompt).toContain('YashanDB 知识中心');
    expect(result.policyTrace).toMatchObject({ id: 'generate-general', version: '1.0.0' });
    expect(result.policyTrace.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('不同文档类型使用不同的版本化生产策略', () => {
    const generator = require('../../../packages/agent-runner-core/lib/prompt-generator');
    const result = generator.assemblePrompt({ name: 'SQL函数', desc: '函数语法示例', type: 'SQL/开发参考', generationMode: 'full' });
    expect(result.policyTrace.id).toBe('generate-sql-reference');
    expect(result.templateFile).toBe('../knowledge/templates/06-SQL开发参考类模板.md');
    expect(result.json.source_policy.mode).toBe('manual');
  });

  test('能力包运行资源可读取且不暴露绝对路径到生成 Prompt', () => {
    const { readResource, getTrace } = require('../../../packages/agent-runner-core/lib/platform-profile/runtime-profile');
    const prompt = readResource('prompts', 'planner');
    expect(prompt.content.length).toBeGreaterThan(0);
    expect(prompt.content).not.toContain(repositoryRoot);
    expect(JSON.stringify(getTrace())).not.toContain(repositoryRoot);
  });

  test('既有 Workflow 输出字段保留并追加非敏感 profile 信息', async () => {
    jest.isolateModules(() => {
      const WorkflowEngine = require('../../../packages/agent-runner-core/lib/workflow-engine');
      const engine = new WorkflowEngine({});
      return engine.createWorkflow({ inputData: { knowledge_point: { name: '测试' } } }).then(taskId => {
        const output = engine.getWorkflow(taskId);
        expect(output.task_id).toBe(taskId);
        expect(output.status).toBe('created');
        expect(output.steps).toBeDefined();
        expect(output.profile.profileId).toBe('yashandb');
        expect(JSON.stringify(output)).not.toContain('secret:');
        expect(JSON.stringify(output)).not.toContain(repositoryRoot);
      });
    });
  });
});

// Public API boundaries also apply before an enterprise profile is installed.
describe('企业能力包运行时与提示词兼容边界', () => {
  const runtime = require('../../../packages/agent-runner-core/lib/platform-profile/runtime-profile');
  const generator = require('../../../packages/agent-runner-core/lib/prompt-generator');
  let descriptors;
  const setGlobal = (key, value) => Object.defineProperty(global, key, { value, configurable: true });
  beforeEach(() => {
    descriptors = ['__KNOWLEDGE_PLATFORM_CONTEXT__', '__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__']
      .map(key => [key, Object.getOwnPropertyDescriptor(global, key)]);
  });
  afterEach(() => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(global, key, descriptor);
      else delete global[key];
    }
  });
  test('未安装运行时和独立公共上下文的回退边界', () => {
    delete global.__KNOWLEDGE_PLATFORM_CONTEXT__;
    delete global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__;
    expect(runtime.getPublicContext()).toBeNull();
    expect(runtime.getTrace()).toBeNull();
    expect(runtime.getBrand()).toEqual({});
    expect(() => runtime.getResource('skills', 'missing')).toThrow('未登记资源：skills/missing');
    expect(() => runtime.getResourceByReference('missing.md')).toThrow('未登记资源：missing.md');
    expect(() => runtime.getGenerationPolicy('缺失')).toThrow(expect.objectContaining({ code: 'GENERATION_POLICY_NOT_FOUND' }));
    const context = { profileId: 'coverage', enterpriseId: 'fixture', configFingerprint: 'sha256:test', brand: { productName: '测试平台' } };
    setGlobal('__KNOWLEDGE_PLATFORM_CONTEXT__', context);
    expect(runtime.getPublicContext()).toBe(context);
    expect(runtime.getBrand()).toBe(context.brand);
    expect(runtime.getTrace()).toEqual({ profileId: 'coverage', enterpriseId: 'fixture', configFingerprint: 'sha256:test' });
    expect(Object.isFrozen(runtime.getTrace())).toBe(true);
  });
  test('资源登记缺失、未解析和manifestRef别名均有稳定契约', () => {
    setGlobal('__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__', {
      profile: { skills: [{ id: 'alias', version: '2', manifestRef: 'fixture.md' }, { id: 'unresolved', resourceRef: 'absent.md' }] },
      resources: [{ reference: 'fixture.md', path: '/fixture/resource.md' }]
    });
    expect(() => runtime.getResource('templates', 'missing')).toThrow('未登记资源：templates/missing');
    expect(() => runtime.getResource('skills', 'missing')).toThrow('未登记资源：skills/missing');
    expect(() => runtime.getResource('skills', 'unresolved')).toThrow('资源未解析：skills/unresolved');
    expect(runtime.getResource('skills', 'alias')).toEqual({ id: 'alias', version: '2', reference: 'fixture.md', path: '/fixture/resource.md' });
    expect(Object.isFrozen(runtime.getResource('skills', 'alias'))).toBe(true);
    expect(runtime.getResourceByReference('fixture.md')).toEqual({ reference: 'fixture.md', path: '/fixture/resource.md' });
    expect(Object.isFrozen(runtime.getResourceByReference('fixture.md'))).toBe(true);
  });
  test('策略别名、显示名称、禁用、模式不匹配及歧义', () => {
    const policy = { id: 'first', enabled: true, documentTypes: ['general'], documentTypeNames: ['资料类型'], displayName: '开发参考', generationModes: ['incremental'] };
    setGlobal('__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__', { profile: { generationPolicies: [policy] } });
    expect(runtime.getGenerationPolicy('资料类型')).toEqual(policy);
    expect(runtime.getGenerationPolicy('开发')).toEqual(policy);
    expect(Object.isFrozen(runtime.getGenerationPolicy('general'))).toBe(true);
    expect(() => runtime.getGenerationPolicy('general', 'full')).toThrow(expect.objectContaining({ code: 'GENERATION_POLICY_NOT_FOUND' }));
    expect(() => runtime.getGenerationPolicy('general', 'incremental', 'missing')).toThrow(expect.objectContaining({ code: 'GENERATION_POLICY_NOT_FOUND' }));
    setGlobal('__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__', { profile: { generationPolicies: [
      { ...policy, enabled: false }, { ...policy, id: 'second', documentTypeNames: undefined }, { ...policy, id: 'third' }
    ] } });
    expect(() => runtime.getGenerationPolicy('general')).toThrow(expect.objectContaining({ code: 'GENERATION_POLICY_AMBIGUOUS' }));
    expect(runtime.getGenerationPolicy('general', 'incremental', 'second').id).toBe('second');
    expect(() => runtime.getGenerationPolicy('未知')).toThrow(expect.objectContaining({ code: 'GENERATION_POLICY_NOT_FOUND' }));
  });
  test.each([
    ['第一部分', undefined, '../output/数据库基础/01-基础入门/'],
    ['第八部分 专题', undefined, '../output/数据库基础/08-架构设计与实践/'],
    ['第九部分', undefined, '../output/通用/'],
    ['兼容性领域', 'DDL语法', '../output/业务领域/兼容性领域/01-DDL兼容性/'],
    ['兼容性领域', '未分类', '../output/业务领域/兼容性领域//'],
    ['性能调优', undefined, '../output/业务领域/性能调优//'],
    ['高可用和备份恢复', undefined, '../output/业务领域/高可用和备份恢复//'],
    ['共享集群', undefined, '../output/业务领域/共享集群//'],
    ['一、入门/简介', undefined, '../output/上传大纲/一_入门_简介/'],
    ['2. SQL', undefined, '../output/上传大纲/2__SQL/'],
    [undefined, undefined, '../output/通用/']
  ])('输出路径契约 %s/%s', (part, chapter, expected) => {
    expect(generator.getOutputPath({ part, chapter })).toBe(expected);
  });
  test('无策略兼容模式保留四类引用及未知类型回退', () => {
    delete global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__;
    delete global.__KNOWLEDGE_PLATFORM_CONTEXT__;
    const result = generator.assemblePrompt({ name: '测试', type: '未知', targetDb: '测试库',
      refMcp: 'mcp查询', refDesign: '设计资料', refOracle: 'oracle资料', refTest: '测试资料' });
    expect(result.policyTrace).toBeNull();
    expect(result.skillFile).toBe('../knowledge/skills/00-通用生成-skill.md');
    expect(result.templateFile).toBe('../knowledge/templates/01-通用基础模板.md');
    expect(result.json.target_db).toBe('测试库');
    expect(result.json.references).toEqual({ mcp_query: 'mcp查询', design_doc: '设计资料', oracle_ref: 'oracle资料', test_cases: '测试资料' });
    expect(result.json).not.toHaveProperty('enterprise_profile_id');
    expect(result.prompt).toContain('YashanDB 知识中心');
    setGlobal('__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__', {
      profile: {}, resources: [
        { reference: 'knowledge/skills/00-通用生成-skill.md', path: '/fixture/skill.md' },
        { reference: 'knowledge/templates/01-通用基础模板.md', path: '/fixture/template.md' }
      ]
    });
    expect(generator.assemblePrompt({ name: '测试', type: '未知' }).policyTrace).toBeNull();
  });
});
