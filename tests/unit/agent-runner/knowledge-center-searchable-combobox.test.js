const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识中心动态实体组合选择器契约', () => {
  const component = read('apps/knowledge-center-web/frontend/knowledge-center/common/searchable-combobox.js');
  const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
  const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
  const styles = read('apps/knowledge-center-web/frontend/knowledge-center/common/components.css');
  const platform = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');

  test('使用渐进增强并保留原生表单值和 change 事件', () => {
    expect(component).toContain("root.querySelectorAll('select[data-searchable-select]')");
    expect(component).toContain("select.dispatchEvent(new Event('change', { bubbles: true }))");
    expect(component).toContain("select.form?.addEventListener('reset'");
    expect(component).toContain('MutationObserver');
    expect(app).toContain('markDynamicSelects(document)');
    expect(app).toContain('cleanupSearchableSelects()');
  });

  test('知识资产局部插入管理弹框后重新执行幂等增强', () => {
    expect(app).toMatch(/if \(selection\.dialogs\) root\.insertAdjacentHTML\('beforeend', selection\.dialogs\);\s*\/\/[^]*?cleanupSearchableSelects\(\);\s*markDynamicSelects\(root\);/);
    expect(app).toContain('markDynamicSelects(replacement)');
  });

  test('审核仓库上下文就绪后刷新文档深链和在线评审上下文', () => {
    expect(review).toContain('data-review-production-editor');
    expect(review).toContain('export function updateReviewWaitingEntry');
    expect(review).toContain('projection.file?.path || projection.path || projection.requestedPath');
    expect(app).toContain('updateReviewWaitingEntry(byId(\'view-root\'), appState.gitlabProjection)');
  });

  test('动态实体被标记，固定枚举不进入公共选择器清单', () => {
    for (const marker of [
      'data-asset-branch', 'data-outline-primary-domain', 'data-domain-task-assignee',
      'data-permission-role', 'data-repository-branch', 'data-review-task-select',
      'data-review-online-baseline', 'name="handbookId"', 'name="templateId"',
    ]) expect(component).toContain(marker);
    for (const fixedEnum of [
      'name="status"', 'name="language"', 'name="sourceType"', 'name="authMode"',
      'name="timeoutMs"', 'data-asset-page-size', 'data-review-opinion-filter',
    ]) expect(component).not.toContain(fixedEnum);
  });

  test('支持完整键盘和无障碍语义', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab']) expect(component).toContain(`event.key === '${key}'`);
    for (const aria of ['aria-autocomplete', 'aria-expanded', 'aria-controls', 'aria-activedescendant']) expect(component).toContain(aria);
    expect(component).toContain("setAttribute('role', 'listbox')");
    expect(component).toContain("setAttribute('role', 'option')");
    expect(styles).toContain('.searchable-combobox-listbox');
    expect(styles).toContain('@media (max-width: 700px)');
  });

  test('弹框内候选列表挂载到原生 dialog 顶层，避免指针事件被拦截', () => {
    expect(component).toContain("const overlayHost = select.closest('dialog') || document.body");
    expect(component).toContain('overlayHost.append(listbox)');
  });

  test('组合框尺寸和移动视口行为有明确门禁', () => {
    expect(styles).toContain('min-height: 40px');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('max-width: calc(100vw - 16px)');
    expect(component).toContain("window.addEventListener('resize', scheduleOpenListboxPosition)");
    expect(component).toContain("window.visualViewport?.addEventListener('resize', scheduleOpenListboxPosition)");
    expect(component).toContain("window.visualViewport?.addEventListener('scroll', scheduleOpenListboxPosition)");
  });

  test('宽度按页面场景收敛并预留显式尺寸属性', () => {
    expect(component).toContain("['compact', 'standard', 'full'].includes(value)");
    expect(component).toContain('wrapper.dataset.comboboxSize = requestedSize(select)');
    expect(styles).toContain('.asset-table .searchable-combobox');
    expect(styles).toContain('width: min(100%, 190px)');
    expect(styles).toContain('.outline-node-list-tools .searchable-combobox');
    expect(styles).toContain('width: min(100%, 220px)');
    expect(styles).toContain('.asset-dialog .searchable-combobox');
    expect(styles).toContain('.searchable-combobox[data-combobox-size="compact"]');
    expect(styles).toContain('.searchable-combobox[data-combobox-size="standard"]');
    expect(styles).toContain('.searchable-combobox[data-combobox-size="full"]');
  });

  test('32 项动态实体宽度清单完整记录', () => {
    const design = read('.codex/知识中心建设平台/03-详细设计/知识中心-前端-详细设计文档.md');
    expect(design.match(/^\| CB-\d{2} \|/gm)).toHaveLength(32);
  });

  test('用户确认的 31 行控件清单逐项有实现证据', () => {
    const files = {
      assets: read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js'),
      dashboard: read('apps/knowledge-center-web/frontend/knowledge-center/modules/dashboard/view.js'),
      outlines: read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/view.js'),
      platform: read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js'),
      production: read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/view.js'),
      handbook: read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/handbook-view.js'),
      repository: read('apps/knowledge-center-web/frontend/knowledge-center/modules/repository/view.js'),
      review: read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js'),
      templates: read('apps/knowledge-center-web/frontend/knowledge-center/modules/templates/view.js'),
    };
    const checklist = [
      ['assets', 'name="status"', 'native'], ['assets', 'name="productId"', 'combo'],
      ['assets', 'data-asset-branch', 'combo'], ['assets', 'data-asset-page-size', 'native'],
      ['assets', 'data-mapping-connection-select', 'combo'], ['assets', 'name="ownerA"', 'combo'],
      ['assets', '手册状态<select name="status"', 'native'], ['assets', '所属产品', 'combo'],
      ['dashboard', 'data-domain-task-assignee', 'combo'], ['outlines', 'data-outline-stage', 'native'],
      ['outlines', 'data-outline-primary-domain', 'combo'], ['outlines', 'data-outline-node-domain-filter', 'combo'],
      ['outlines', 'data-outline-assignment-domain-filter', 'combo'], ['outlines', 'data-domain-task-assignee', 'combo'],
      ['platform', 'name="timeoutMs"', 'native'], ['platform', 'name="leaderPrincipalId"', 'combo'],
      ['platform', 'data-principal-binding-filter', 'native'], ['platform', 'data-permission-status', 'native'],
      ['platform', 'data-permission-role', 'combo'], ['platform', 'name="authMode"', 'native'],
      ['handbook', 'name="templateId"', 'combo'], ['handbook', 'name="outlineId"', 'temporary'],
      ['production', 'name="sourceType"', 'native'], ['production', 'name="operationDocumentId"', 'combo'],
      ['production', '证据类型<select name="type"', 'native'], ['production', 'name="sourceTemplate"', 'temporary'],
      ['production', 'name="handbookId"', 'combo'], ['repository', 'data-repository-branch', 'combo'],
      ['review', 'data-review-task-select', 'combo'], ['review', 'data-review-opinion-filter', 'native'],
      ['templates', 'data-template-filter="type"', 'native'],
    ];
    expect(checklist).toHaveLength(31);
    checklist.forEach(([file, evidence]) => expect(files[file]).toContain(evidence));

    for (const marker of [
      'data-asset-branch', 'data-mapping-connection-select', 'name="ownerA"',
      'data-domain-task-assignee', 'data-outline-primary-domain', 'data-outline-node-domain-filter',
      'data-outline-assignment-domain-filter', 'name="leaderPrincipalId"', 'data-permission-role',
      'name="templateId"', 'name="operationDocumentId"', 'name="handbookId"',
      'data-repository-branch', 'data-review-task-select', 'data-review-handbook-select',
      'data-review-online-baseline', 'data-review-branch',
    ]) expect(component).toContain(marker);

    for (const marker of [
      'data-asset-page-size', 'data-outline-status-filter', 'name="timeoutMs"',
      'data-principal-binding-filter', 'data-permission-status', 'name="authMode"',
      'name="outlineId"', 'name="sourceType"', 'name="sourceTemplate"',
      'data-review-opinion-filter', 'data-template-filter',
    ]) expect(component).not.toContain(marker);
  });

  test('负责人配置位于人员管理弹窗，任务规则页不再配置负责人', () => {
    expect(platform).toContain('data-task-responsibility-dialog');
    expect(platform).toContain('PingCode 任务负责人');
    expect(platform).toContain('name="knowledgeCenterOwnerId"');
    expect(platform).toContain('data-searchable-select');
    expect(platform).not.toContain('/knowledge-center/document-tasks?tab=config');
    expect(app).toContain('saveDocumentTaskConfig({');
    expect(app).toContain('reasonOptions: appState.taskConfig.reasonOptions || []');
    const taskView = read('apps/knowledge-center-web/frontend/knowledge-center/modules/document-tasks/view.js');
    expect(taskView).not.toContain('name="defaultOwnerId"');
    expect(taskView).not.toContain('name="knowledgeCenterOwnerId"');
    expect(taskView).toContain('<legend>不涉及理由选项</legend>');
  });

  test('旧独立文档生成器不接入知识中心公共组件', () => {
    const legacy = read('apps/knowledge-center-web/frontend/document-generation-workbench.html');
    expect(legacy).not.toContain('searchable-combobox.js');
    expect(legacy).not.toContain('data-searchable-select');
  });
});
