const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识中心大纲管理前端契约', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/view.js');
  test('分别展示产品、业务版本标签和大纲版本', () => {
    expect(view()).toContain('productId');
    expect(view()).toContain('businessVersionTags');
    expect(view()).toContain('outlineStructureVersion');
    expect(view()).toContain('业务版本');
    expect(view()).toContain('大纲版本');
  });
  test('未接入、真实空数据与已有数据采用不同分支', () => {
    expect(view()).toContain("source.status !== 'ok'");
    expect(view()).toContain('大纲服务不可用');
    expect(view()).toContain('尚无大纲');
    expect(view()).not.toContain('23.4.5.100');
  });
  test('从独立大纲治理接口加载列表和详情', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(api).toContain('/knowledge-center/api/outline/governance');
    expect(api).toContain('loadOutlineData');
    expect(api).toContain('encodeURIComponent(selectedId)');
  });
  test('治理子视图和逆向提取边界明确', () => {
    for (const label of ['目录', '责任', '模板', '检查', '发布']) expect(view()).toContain(label);
    expect(view()).not.toContain('Codex/Claude Code');
    expect(view()).not.toContain('不调用旧接口冒充正式治理流程');
  });
  test('上传文件由管理员创建候选并由服务端统一解析', () => {
    const source = view();
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const uploader = read('apps/knowledge-center-web/frontend/js/components/OutlineUploader.js');
    expect(source).toContain('name="file"');
    expect(source).not.toContain('name="productId"');
    expect(source).not.toContain('name="businessVersionTags"');
    for (const label of ['待完善', '待评审', '已发布']) expect(source).toContain(label);
    expect(app).not.toContain("payload.append('productId', productId)");
    expect(app).not.toContain("payload.append('businessVersionTags', JSON.stringify(businessVersionTags))");
    expect(source).toContain('outlinePermissions.create ? importArea()');
    expect(uploader).toContain('服务端未返回统一解析结果');
    expect(uploader).not.toContain('_parseMarkdown');
  });

  test('普通用户只读，管理员删除候选且目录显示编号和描述', () => {
    const source = view();
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(source).toContain('仅平台管理员可新增或删除大纲');
    expect(source).toContain('permissions.delete && canDelete(item)');
    expect(source).toContain('item.sourceId');
    expect(source).toContain('outline-tree-description');
    expect(api).toContain("method: 'DELETE'");
  });
  test('责任和模板缺口展示真实待办状态', () => {
    expect(view()).toContain('待绑定');
    expect(view()).toContain('模板版本待设置');
    expect(view()).toContain('选择知识点后配置模板');
  });
  test('列表和详情分离，详情使用按需打开的手册信息', () => {
    const source = view();
    expect(source).toContain('outlineView.isDetail');
    expect(source).not.toContain('outline-workspace');
    expect(source).toContain('data-outline-back');
    expect(source).toContain('data-outline-info-toggle');
    expect(source).toContain('outline-stage-canvas');
  });
  test('详情深链、无效手册与阶段参数有明确契约', () => {
    const navigation = read('apps/knowledge-center-web/frontend/knowledge-center/common/state/navigation.js');
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(navigation).toContain("startsWith('/knowledge-center/outlines/')");
    expect(api).toContain("status: 'not_found'");
    expect(app).toContain("url.searchParams.set('stage'");
    expect(app).toContain('outlineListState.scrollPosition');
  });
});
