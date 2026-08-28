const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');
const { loadProfile } = require('../lib/platform-profile/profile-loader');

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
    const generator = require('../lib/prompt-generator');
    const result = generator.assemblePrompt({ name: '表空间管理', part: '第一部分', chapter: '基础', desc: '管理', type: '通用基础' });
    expect(result.skillFile).toBe('../skills/00-通用生成-skill.md');
    expect(result.templateFile).toBe('../templates/01-通用基础模板.md');
    expect(result.json.enterprise_profile_id).toBe('yashandb');
    expect(result.json.config_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.prompt).toContain('YashanDB 知识中心');
    expect(result.policyTrace).toMatchObject({ id: 'generate-general', version: '1.0.0' });
    expect(result.policyTrace.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('不同文档类型使用不同的版本化生产策略', () => {
    const generator = require('../lib/prompt-generator');
    const result = generator.assemblePrompt({ name: 'SQL函数', desc: '函数语法示例', type: 'SQL/开发参考', generationMode: 'full' });
    expect(result.policyTrace.id).toBe('generate-sql-reference');
    expect(result.templateFile).toBe('../templates/06-SQL开发参考类模板.md');
    expect(result.json.source_policy.mode).toBe('manual');
  });

  test('能力包运行资源可读取且不暴露绝对路径到生成 Prompt', () => {
    const { readResource, getTrace } = require('../lib/platform-profile/runtime-profile');
    const prompt = readResource('prompts', 'planner');
    expect(prompt.content.length).toBeGreaterThan(0);
    expect(prompt.content).not.toContain(repositoryRoot);
    expect(JSON.stringify(getTrace())).not.toContain(repositoryRoot);
  });

  test('既有 Workflow 输出字段保留并追加非敏感 profile 信息', async () => {
    jest.isolateModules(() => {
      const WorkflowEngine = require('../lib/workflow-engine');
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
