const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = jest.requireActual('child_process');

jest.mock('child_process', () => ({ execFileSync: jest.fn(), execFile: jest.fn() }));
const { execFileSync, execFile } = require('child_process');
const { DatabaseAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');

const rejection = code => ({ success: false, error: {
  code, message: '记录 handbook-production/state 引用了已删除的大纲版本 outline_A，不能保存关联生产数据',
  details: { namespace: 'handbook-production', key: 'state', outlineVersionId: 'outline_A' },
} });
const store = () => new DatabaseAggregateStore('handbook-production', 'state', {}, { baseUrl: 'http://127.0.0.1:14210' });

describe('错误定位信息', () => {
  test.each(['OUTLINE_DELETED', 'OUTLINE_NOT_FOUND', 'REVISION_CONFLICT'])('同步聚合请求保留业务冲突 %s', code => {
    const payload = rejection(code);
    execFileSync.mockReturnValue(JSON.stringify(payload));
    expect(() => store().execute([])).toThrow(expect.objectContaining({ code, status: 409, details: payload.error.details, message: payload.error.message }));
  });

  test('异步聚合请求保留引用定位信息与冲突状态', async () => {
    const payload = rejection('OUTLINE_DELETED');
    execFile.mockImplementation((_cmd, _args, _options, callback) => {
      callback(null, JSON.stringify(payload));
      return {};
    });
    await expect(store().executeAsync([])).rejects.toMatchObject({ status: 409, code: 'OUTLINE_DELETED', details: payload.error.details });
  });

  test('数据库故障仍返回 503', () => {
    execFileSync.mockReturnValue(JSON.stringify(rejection('DATABASE_UNAVAILABLE')));
    expect(() => store().execute([])).toThrow(expect.objectContaining({ status: 503 }));
  });

  test('代码块增强失败报告数量，保留正文且不记录内容', () => {
    const file = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/markdown/database-enhancer.js');
    const source = fs.readFileSync(file, 'utf8')
      .replace("import rules from './rules/yashandb-rules.js';", 'const rules = { categories: {} };')
      .replace('export function enhanceDatabaseMarkdown', 'function enhanceDatabaseMarkdown');
    const warn = jest.fn();
    const context = { console: { warn } };
    vm.runInNewContext(source, context);
    const html = '<pre class="repository-code" data-language="sql" data-scroll-region="panel"><code class="language-sql">SELECT private_data;</code></pre>';
    expect(context.enhanceDatabaseMarkdown(html).html).toBe(html);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('MARKDOWN_CODE_ENHANCEMENT_FAILED'), { unenhancedCodeBlockCount: 1 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private_data');
    warn.mockClear();
    context.enhanceDatabaseMarkdown('<p>正常正文</p>');
    expect(warn).not.toHaveBeenCalled();
  });
});

 test('旧目录迁移后安装失败明确报告发布和恢复错误', () => {
  const root = path.resolve(__dirname, '../../..');
  const scratch = fs.mkdtempSync(path.join(root, 'runtime/error-diagnostics-deploy-'));
  try {
    const candidate = path.join(scratch, 'releases/test');
    for (const dir of ['runtime', 'bin', 'config/knowledge-center', 'config/yashandb', 'releases/test']) fs.mkdirSync(path.join(scratch, dir), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'config/knowledge-center/.env'), '');
    fs.writeFileSync(path.join(scratch, 'config/yashandb/service.env'), '');
    fs.mkdirSync(path.join(candidate, 'config/knowledge-center'), { recursive: true });
    fs.mkdirSync(path.join(candidate, 'config/yashandb'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'knowledge-center.sh'), '#!/bin/bash\n[[ "$1" == stop ]] && exit 0\nexit 7\n', { mode: 0o755 });
    fs.writeFileSync(path.join(candidate, 'knowledge-center.sh'), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
    fs.writeFileSync(path.join(scratch, 'bin/npm'), '#!/bin/bash\nexit 19\n', { mode: 0o755 });
    const script = fs.readFileSync(path.join(root, 'tools/deployment/sync-production.sh'), 'utf8');
    const body = script.split("<<'REMOTE'\n")[2].split('\nREMOTE')[0];
    const result = spawnSync('bash', ['-s', '--', scratch, 'test', 'apply'], { input: body, encoding: 'utf8', env: { ...process.env, PATH: `${scratch}/bin:${process.env.PATH}` }, timeout: 10000 });
    expect(result.status).toBe(19);
    const output = result.stdout + result.stderr;
    for (const text of ['DEPLOYMENT_FAILED', '阶段=安装依赖', '退出码=19', 'DEPLOYMENT_RECOVERY_RUNTIME_MISSING', 'DEPLOYMENT_RECOVERY_FAILED', '退出码=7', `${scratch}/shared/runtime`]) expect(output).toContain(text);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
