const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRenderer() {
  const file = path.join(__dirname, '..', '..', '..', '..', 'apps/knowledge-center-web/frontend/knowledge-center/modules/repository/view.js');
  const source = fs.readFileSync(file, 'utf8')
    .replace("import { escapeHtml } from '../../common/utils/dom.js';", "const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\\"/g, '&quot;');")
    .replace('export function renderRepository', 'function renderRepository')
    .replace('export { safeMarkdown, treeHierarchy };', 'globalThis.safeMarkdown = safeMarkdown;');
  const context = { globalThis: {}, window: {}, encodeURIComponent };
  vm.runInNewContext(source, context);
  return context.globalThis.safeMarkdown;
}

describe('知识中心管理平台 Markdown 渲染门禁', () => {
  const render = loadRenderer();

  test('完整渲染标题、列表、任务列表、引用、分隔线、表格和代码语言', () => {
    const html = render('# 标题\n\n1. 第一项\n   - [x] 已完成\n   - [ ] 待处理\n\n> 重要说明\n\n---\n\n| 参数 | 说明 |\n| :--- | ---: |\n| `YAS_PORT` | **端口** |\n\n```sql\nSELECT 1;\n```');
    for (const expected of ['<h1>标题</h1>', '<ol>', 'type="checkbox"', '<blockquote>', '<hr>', '<table>', 'data-language="sql"', 'language-sql']) expect(html).toContain(expected);
    expect(html).toContain('</ol>');
    expect((html.match(/<ol>/g) || []).length).toBe((html.match(/<\/ol>/g) || []).length);
    expect((html.match(/<ul>/g) || []).length).toBe((html.match(/<\/ul>/g) || []).length);
  });

  test('产品物理规格文档中的 YFS 空 span 渲染为可跳转锚点', () => {
    const html = render('### 文件系统\n\n<span id="YFS" name="YFS"></span>\n\nYFS 物理规格说明。', 'doc/产品文档/产品描述/产品规格/物理规格.md');
    expect(html).toContain('<span id="YFS" name="YFS" class="repository-anchor" aria-hidden="true"></span>');
    expect(html).not.toContain('&lt;span id=&quot;YFS&quot;');
    expect(html).toContain('YFS 物理规格说明');
  });

  test('锚点白名单拒绝事件、样式、非法标识和非空 HTML', () => {
    const html = render('<span id="YFS" onclick="alert(1)"></span>\n<span id="bad id"></span>\n<span id="SAFE"></span><script>alert(1)</script>');
    expect(html).toContain('&lt;span id=&quot;YFS&quot; onclick=&quot;alert(1)&quot;&gt;&lt;/span&gt;');
    expect(html).toContain('&lt;span id=&quot;bad id&quot;&gt;&lt;/span&gt;');
    expect(html).toContain('<span id="SAFE" name="SAFE" class="repository-anchor" aria-hidden="true"></span>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('相对链接和图片使用手册上下文，危险协议只作为文本输出', () => {
    const html = render('[参数](../config.md) ![图](./img/a.png) [危险](javascript:alert(1)) & <tag>', 'docs/install.md', { handbookId: 'DB-001', branch: 'master', language: 'zh' });
    expect(html).toContain('/knowledge-center/assets/DB-001/repository');
    expect(html).toContain('path=docs%2Fimg%2Fa.png');
    expect(html).not.toContain('javascript:alert');
    expect(html).toContain('&lt;');
  });

  test('代码块和特殊字符不会丢失或注入 HTML', () => {
    const html = render('普通 & <标签>\n\n```\n<div>不执行</div>\n```');
    expect(html).toContain('普通 &amp; &lt;标签&gt;');
    expect(html).toContain('&lt;div&gt;不执行&lt;/div&gt;');
    expect(html).not.toContain('<div>不执行</div>');
  });
});
