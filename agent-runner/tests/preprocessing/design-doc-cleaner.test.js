const { DesignDocCleaner } = require('../../lib/preprocessing/cleaners/design-doc-cleaner');
const { NormalizedDocument } = require('../../lib/preprocessing/source-adapter');

describe('DesignDocCleaner', () => {
  let cleaner;

  beforeEach(() => {
    cleaner = new DesignDocCleaner();
  });

  describe('规则 1：去除 Confluence 元数据', () => {
    test('应移除 "Created by ... on ..." 行', () => {
      const doc = createDoc('Created by 张三 on 2024-01-18\n\n# 标题\n\n内容');
      const result = cleaner.cleanFile(doc);
      expect(result.content).not.toContain('Created by');
      expect(result.changes).toContain('meta_removed');
    });

    test('应移除 "Created by ..., last modified on ..." 变体', () => {
      const doc = createDoc('Created by 李四, last modified on 2024-02-20\n\n# 标题');
      const result = cleaner.cleanFile(doc);
      expect(result.content).not.toContain('Created by');
      expect(result.content).not.toContain('last modified');
    });

    test('不应移除正文中的 "Created by" 文本', () => {
      const doc = createDoc('# 标题\n\n本文档 Created by 张三 编写');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('Created by 张三');
    });
  });

  describe('规则 2：清理内部链接', () => {
    test('应将 [text](internal_url) 转为 text', () => {
      const doc = createDoc('[C驱动调研](https://conf.yasdb.com/pages/123)');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('C驱动调研');
      expect(result.content).not.toContain('conf.yasdb.com');
    });

    test('应提取 Jira 工单编号', () => {
      const doc = createDoc('[YDBRD-13369](https://jira.yasdb.com/browse/YDBRD-13369)');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('YDBRD-13369');
      expect(result.content).not.toContain('jira.yasdb.com');
    });

    test('应将裸 URL 转为标注', () => {
      const doc = createDoc('参考 https://pingcode.yasdb.com/pjm/items/123');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('[内部链接: pingcode.yasdb.com]');
    });

    test('不应影响外部链接', () => {
      const doc = createDoc('[官网](https://www.yasdb.com)');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('https://www.yasdb.com');
    });
  });

  describe('规则 3：处理图片引用', () => {
    test('应保留图片引用和 alt', () => {
      const doc = createDoc('![架构图](https://conf.yasdb.com/xxx/arch.png)');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('![架构图](https://conf.yasdb.com/xxx/arch.png)');
    });

    test('无 alt 文本时应补齐可读 alt', () => {
      const doc = createDoc('![](https://conf.yasdb.com/xxx/img.png)');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('![原始图片](https://conf.yasdb.com/xxx/img.png)');
    });

    test('图片引用应在内部链接清理之前处理', () => {
      const doc = createDoc('![架构图](https://conf.yasdb.com/xxx/arch.png)');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('![架构图](https://conf.yasdb.com/xxx/arch.png)');
    });
  });

  describe('规则 4：清理锚点链接', () => {
    test('应将 [text](#anchor) 转为 text', () => {
      const doc = createDoc('[参数说明](#21-参数配置)');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('参数说明');
      expect(result.content).not.toContain('#21');
    });

    test('不应影响外部锚点链接', () => {
      const doc = createDoc('[链接](https://example.com/page#section)');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('https://example.com/page#section');
    });
  });

  describe('规则 5：统一标题层级', () => {
    test('应将最小层级 > 1 的标题整体提升', () => {
      const doc = createDoc('## 一级标题\n\n### 二级标题');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toMatch(/^# 一级标题/m);
      expect(result.content).toMatch(/^## 二级标题/m);
    });

    test('不应改变已有 # 标题的文档', () => {
      const doc = createDoc('# 一级\n\n## 二级');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toMatch(/^# 一级/m);
      expect(result.content).toMatch(/^## 二级/m);
    });
  });

  describe('规则 6：添加 YAML 前置元数据', () => {
    test('应在文件头部添加 YAML 块', () => {
      const doc = createDoc('# 标题\n\n内容');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toMatch(/^---\n/);
      expect(result.content).toContain('title:');
      expect(result.content).toContain('version:');
      expect(result.content).toContain('---\n');
    });

    test('应包含关键词列表', () => {
      const doc = createDoc('# 标题', { keywords: ['TAF', '故障转移'] });
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('keywords:');
      expect(result.content).toContain('"TAF"');
      expect(result.content).toContain('"故障转移"');
    });
  });

  describe('表格和代码块保护', () => {
    test('应保留完整表格', () => {
      const doc = createDoc('# 标题\n\n| 参数 | 值 |\n|------|----|\n| A | 1 |');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('| 参数 | 值 |');
      expect(result.content).toContain('| A | 1 |');
    });

    test('应保留完整代码块', () => {
      const doc = createDoc('# 标题\n\n```javascript\nconst x = 1;\n```');
      const result = cleaner.cleanFile(doc);
      expect(result.content).toContain('```javascript');
      expect(result.content).toContain('const x = 1;');
    });
  });

  describe('元数据提取', () => {
    test('应从 Created by 行提取作者和日期', () => {
      const doc = createDoc('Created by 张三 on 2024-01-18\n\n# 标题');
      const result = cleaner.cleanFile(doc);
      expect(result.metadata.author).toBe('张三');
      expect(result.metadata.createdDate).toContain('2024');
    });

    test('应从路径提取版本', () => {
      const doc = createDoc('# 标题', { sourcePath: 'YashanDB v23.1/特性设计/xxx.md' });
      const result = cleaner.cleanFile(doc);
      expect(result.metadata.version).toBe('v23.1');
    });

    test('应提取 YDBRD 编号', () => {
      const doc = createDoc('# YDBRD-12345 功能设计');
      const result = cleaner.cleanFile(doc);
      expect(result.metadata.featureId).toBe('YDBRD-12345');
    });
  });

  function createDoc(content, metadata = {}) {
    return new NormalizedDocument({
      title: metadata.title || '测试文档',
      content,
      metadata: {
        sourcePath: metadata.sourcePath || 'test.md',
        sourceFormat: 'markdown',
        version: metadata.version || 'v23.1',
        docType: metadata.docType || '特性设计',
        author: metadata.author || '',
        createdDate: metadata.createdDate || '',
        keywords: metadata.keywords || [],
        ...metadata
      }
    });
  }
});
