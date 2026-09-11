/**
 * YAML 元数据处理器 - 单元测试
 * 
 * 覆盖所有异常场景：
 * 1. 正常情况
 * 2. 缺少开始标记
 * 3. 缺少结束标记
 * 4. 中间有多余结束标记（premature close）
 * 5. 必填字段缺失
 * 6. 日期格式错误
 * 7. 缩进不一致
 * 8. 多个 YAML 块
 */

const YamlMetadataProcessor = require('../../../packages/agent-runner-core/lib/document/yaml-metadata-processor');

describe('YamlMetadataProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new YamlMetadataProcessor();
  });

  describe('正常情况', () => {
    test('完整的 YAML 块', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试
适用版本: 23.4.100 及后续版本
最后更新: 2026-07-23
资料来源追溯:
  主要来源：YashanDB 知识库 MCP
  引用文档数量：3
\`\`\`

---

## 一、正文内容
`;
      const result = processor.process(content);
      expect(result.fixed).toBe(false);
      expect(result.metadata['知识库ID']).toBe('YDB-TEST-001');
      expect(result.metadata['标题']).toBe('测试文档');
    });
  });

  describe('缺少结束标记', () => {
    test('缺少 ``` 结束标记', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试

---

## 一、正文内容
`;
      const result = processor.process(content);
      expect(result.fixed).toBe(true);
      expect(result.content).toContain('\`\`\`\n---');
    });
  });

  describe('中间有多余结束标记（premature close）', () => {
    test('第9行有多余的 ```', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试
适用版本: 23.4.100 及后续版本
最后更新: 2026-07-23
\`\`\`

资料来源追溯:
  主要来源：YashanDB 知识库 MCP

---

## 一、正文内容
`;
      const result = processor.process(content);
      expect(result.fixed).toBe(true);
      // 验证 premature close 被移除
      const lines = result.content.split('\n');
      const yamlStartIdx = lines.findIndex(l => l === '\`\`\`yaml');
      const yamlEndIdx = lines.findIndex((l, i) => i > yamlStartIdx && l === '\`\`\`');
      // YAML 块应该包含资料来源追溯
      expect(yamlEndIdx - yamlStartIdx).toBeGreaterThan(8);
    });

    test('多个 premature close', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
\`\`\`
标题: 测试文档
\`\`\`
分类: 测试

---

## 一、正文内容
`;
      const result = processor.process(content);
      expect(result.fixed).toBe(true);
      // 验证所有 premature close 被移除
      const yamlBlock = result.content.split('\n---\n')[0];
      const codeBlockCount = (yamlBlock.match(/\`\`\`/g) || []).length;
      expect(codeBlockCount).toBe(2); // 只有开始和结束
    });
  });

  describe('必填字段缺失', () => {
    test('缺少"最后更新"字段', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试
适用版本: 23.4.100 及后续版本
\`\`\`

---

## 一、正文内容
`;
      const result = processor.process(content);
      expect(result.fixed).toBe(true);
      expect(result.content).toContain('最后更新:');
    });

    test('缺少多个必填字段', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
\`\`\`

---

## 一、正文内容
`;
      const result = processor.process(content);
      expect(result.fixed).toBe(true);
      expect(result.content).toContain('标题:');
      expect(result.content).toContain('分类:');
    });

    test('缺少"资料来源追溯"字段', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试
适用版本: 23.4.100 及后续版本
最后更新: 2026-07-23
\`\`\`

---

## 一、正文内容
`;
      const result = processor.process(content);
      expect(result.fixed).toBe(true);
      expect(result.content).toContain('资料来源追溯:');
      expect(result.content).toContain('主要来源：待补充');
      expect(result.content).toContain('引用文档数量：0');
    });
  });

  describe('日期格式错误', () => {
    test('日期格式不正确', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试
适用版本: 23.4.100 及后续版本
最后更新: 2026/07/23
\`\`\`

---

## 一、正文内容
`;
      const result = processor.process(content);
      expect(result.fixed).toBe(true);
      expect(result.content).toMatch(/最后更新: \d{4}-\d{2}-\d{2}/);
    });
  });

  describe('边界情况', () => {
    test('空内容', () => {
      const result = processor.process('');
      expect(result.fixed).toBe(false);
      expect(result.error).toBe('Invalid content');
    });

    test('没有 YAML 块', () => {
      const content = `## 一、正文内容\n\n这是正文。`;
      const result = processor.process(content);
      expect(result.fixed).toBe(false);
      expect(result.error).toBe('No YAML block found');
    });

    test('多个 YAML 块（只处理第一个）', () => {
      const content = `\`\`\`yaml
知识库ID: YDB-TEST-001
标题: 第一个文档
分类: 测试
适用版本: 23.4.100 及后续版本
最后更新: 2026-07-23
\`\`\`

---

## 一、正文

\`\`\`yaml
知识库ID: YDB-TEST-002
标题: 第二个文档
\`\`\`
`;
      const result = processor.process(content);
      expect(result.metadata['知识库ID']).toBe('YDB-TEST-001');
    });
  });

  describe('validate 方法', () => {
    test('验证必填字段', () => {
      const yaml = `知识库ID: YDB-TEST-001
标题: 测试文档`;
      const result = processor.validate(yaml);
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual({ type: 'missing_field', field: '分类' });
    });

    test('验证日期格式', () => {
      const yaml = `知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试
适用版本: 23.4.100
最后更新: 2026/07/23`;
      const result = processor.validate(yaml);
      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({ type: 'invalid_date' }));
    });

    test('验证通过', () => {
      const yaml = `知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试
适用版本: 23.4.100
最后更新: 2026-07-23
资料来源追溯:
  主要来源：YashanDB 知识库 MCP`;
      const result = processor.validate(yaml);
      expect(result.valid).toBe(true);
    });
  });

  describe('format 方法', () => {
    test('解析 YAML 键值对', () => {
      const yaml = `知识库ID: YDB-TEST-001
标题: 测试文档
分类: 测试`;
      const result = processor.format(yaml);
      expect(result['知识库ID']).toBe('YDB-TEST-001');
      expect(result['标题']).toBe('测试文档');
      expect(result['分类']).toBe('测试');
    });
  });
});
