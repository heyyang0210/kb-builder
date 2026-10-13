const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const frontend = 'apps/knowledge-center-web/frontend';

describe('知识中心关闭 X 控件', () => {
  test('平台关闭按钮不用文字 X，删除和移除控件不继承关闭样式', () => {
    const files = [
      'knowledge-center/knowledge-center-management.html',
      'knowledge-center/modules/cleaning/view.js',
      'knowledge-center/modules/templates/view.js',
      'knowledge-center/modules/platform-admin/view.js',
      'document-generation-workbench.html',
    ];
    for (const file of files) {
      const source = read(`${frontend}/${file}`);
      expect(source).not.toMatch(/aria-label="关闭[^"]*"[^>]*>(?:×|✕|&times;)/);
    }
    const base = read(`${frontend}/knowledge-center/common/base.css`);
    expect(base).toContain('button.icon-button[aria-label^="关闭"]');
    expect(base).not.toContain('[aria-label^="移除"]');
    expect(base).not.toContain('[aria-label^="删除"]');
  });

  test('同源独立工作台使用本地 Lucide 和主题红色', () => {
    const source = read(`${frontend}/document-generation-workbench.html`);
    expect(source).toContain('/knowledge-center/common/vendor/lucide.min.js');
    expect(source).toContain('--close-color: #b42318');
    expect((source.match(/class="modal-close"/g) || [])).toHaveLength(4);
    expect((source.match(/data-lucide="x" aria-hidden="true"/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});
