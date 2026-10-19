const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('手册生产草稿空状态与不可用状态', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/handbook-view.js');
  const app = () => read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
  const api = () => read('apps/knowledge-center-web/frontend/knowledge-center/common/api/handbook-production-api.js');

  test('无草稿明确提示尚未保存且不渲染禁用的历史按钮', () => {
    expect(view()).toContain(": server?.exists ? `已保存 v${server.draft.editVersion} · ${savedTime}` : '尚未保存为共享草稿'");
    expect(view()).toContain('const historyAction = server?.exists');
    expect(view()).not.toContain("saveState?.status === 'loadFailed' ? '草稿读取失败'");
  });

  test('非 JSON 契约标记为服务不可用且不允许正式保存', () => {
    expect(api()).toContain("code: 'DRAFT_API_UNAVAILABLE'");
    expect(api()).toContain("contentType.toLowerCase().includes('application/json')");
    expect(view()).toContain('共享草稿服务暂不可用，当前正文仍可编辑，恢复后可保存。');
    expect(view()).toContain("ui.draftLoadState?.[documentId] === 'ready'");
    expect(view()).toContain("canSaveHandbookDraft(document.id, ui) ? '' : 'disabled'");
    expect(app()).toContain("draftLoadState?.[documentId] !== 'ready'");
  });

  test('统一构建从锁定依赖复制本地 Vditor 资源', () => {
    const build = read('tools/repository/build-knowledge-center.sh');
    expect(build).toContain('node_modules/vditor/dist');
    expect(build).toContain('cp -R "$vditor_dist_rel" "$vditor_target/dist"');
    expect(build).toContain('cp "$vditor_license_rel" "$vditor_target/LICENSE"');
  });
});
