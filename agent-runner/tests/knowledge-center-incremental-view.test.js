const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('增量构建前端契约', () => {
  const view = () => read('frontend/knowledge-center/modules/production/view.js');
  const api = () => read('frontend/knowledge-center/common/api/incremental-api.js');
  const app = () => read('frontend/knowledge-center/app.js');

  test('使用后端冻结的资源路由和业务状态', () => {
    expect(api()).toContain("const endpoint = '/knowledge-center/api/incremental-tasks'");
    for (const pathName of ['sources', 'target', 'draft', 'checks', 'candidate', 'reviews', 'publish', 'external-evidence']) expect(api()).toContain(`'${pathName}'`);
    for (const state of ['draft', 'editing', 'checked', 'candidate_ready', 'under_review', 'approved', 'rejected', 'published']) expect(view()).toContain(`${state}:`);
  });

  test('所有写操作携带幂等键且错误不会被当成成功', () => {
    expect(api()).toContain("'Idempotency-Key': commandKey");
    expect(api()).toContain('pendingKeys.get(commandSignature)');
    expect(api()).toContain('pendingKeys.delete(commandSignature)');
    expect(api()).toContain('payload?.success === false');
    expect(api()).toContain("knowledge-center:session-expired");
    expect(api()).toContain("knowledge-center:permission-denied");
  });

  test('工作区覆盖平台内闭环并禁止伪造外部成功', () => {
    for (const label of ['来源材料', '修改范围', '增量草稿', '完整性检查', '审核与发布', '登记外部证据']) expect(view()).toContain(label);
    expect(view()).toContain('人工选择');
    expect(view()).not.toContain('GitLab（尚未接入）');
    expect(app()).toContain('expectedCandidateDigest: task?.candidate?.digest');
  });

  test('草稿、范围和外部证据字段与 DTO 一致', () => {
    for (const field of ['businessVersion', 'baselineVersionId', 'sourceType', 'documentIds', 'sectionIds', 'editVersion', 'operations', 'reference', 'note']) expect(app() + view()).toContain(field);
    expect(view()).toContain('data-incremental-review-decision="reject"');
    expect(view()).not.toContain('request_changes');
    expect(view()).toContain('data-incremental-comment-form');
    expect(view()).toContain('data-incremental-revision');
    expect(view()).toContain('task.capabilities?.canReview');
    expect(view()).toContain('task.capabilities?.canRecordEvidence');
    expect(view()).toContain('data-incremental-load-baselines');
    expect(view()).not.toContain('<input name="baselineVersionId"');
  });

  test('增量工作区使用独立响应式样式', () => {
    const html = read('frontend/knowledge-center/knowledge-center-management.html');
    const css = read('frontend/knowledge-center/modules/production/production.css');
    expect(html).toContain('./modules/production/production.css');
    expect(css).toContain('.incremental-workspace');
    expect(css).toContain('@media (max-width: 800px)');
    expect(css).toContain('@media (max-width: 560px)');
  });
});
