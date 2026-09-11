const fs = require('fs').promises;
const path = require('path');
const { MarkdownAdapter } = require('../../../../packages/agent-runner-core/lib/preprocessing/cleaners/markdown-adapter');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-markdown-adapter-' + Date.now());

describe('MarkdownAdapter', () => {
  let adapter;

  beforeAll(async () => {
    adapter = new MarkdownAdapter();
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('scan', () => {
    test('应递归扫描目录中的 .md 文件', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'a.md'), '# A');
      await fs.mkdir(path.join(TEST_DIR, 'sub'));
      await fs.writeFile(path.join(TEST_DIR, 'sub', 'b.md'), '# B');
      await fs.writeFile(path.join(TEST_DIR, 'c.txt'), 'not markdown');

      const files = await adapter.scan(TEST_DIR);
      expect(files.length).toBe(2);
      expect(files.every(f => f.endsWith('.md'))).toBe(true);
    });

    test('空目录应返回空数组', async () => {
      const emptyDir = path.join(TEST_DIR, 'empty');
      await fs.mkdir(emptyDir, { recursive: true });
      const files = await adapter.scan(emptyDir);
      expect(files).toEqual([]);
    });
  });

  describe('parse', () => {
    test('应提取标题', async () => {
      const filePath = path.join(TEST_DIR, 'title.md');
      await fs.writeFile(filePath, '# 我的标题\n\n内容');
      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('我的标题');
    });

    test('无标题时应使用文件名', async () => {
      const filePath = path.join(TEST_DIR, 'no-title.md');
      await fs.writeFile(filePath, '没有标题的内容');
      const doc = await adapter.parse(filePath);
      expect(doc.title).toBe('no-title');
    });

    test('应从路径提取版本', async () => {
      const versionDir = path.join(TEST_DIR, 'YashanDB v23.2');
      await fs.mkdir(versionDir, { recursive: true });
      const filePath = path.join(versionDir, 'doc.md');
      await fs.writeFile(filePath, '# 标题');
      const doc = await adapter.parse(filePath);
      expect(doc.metadata.version).toBe('v23.2');
    });

    test('应从路径提取文档类型', async () => {
      const typeDir = path.join(TEST_DIR, '特性设计');
      await fs.mkdir(typeDir, { recursive: true });
      const filePath = path.join(typeDir, 'doc.md');
      await fs.writeFile(filePath, '# 标题');
      const doc = await adapter.parse(filePath);
      expect(doc.metadata.docType).toBe('特性设计');
    });

    test('应提取作者信息', async () => {
      const filePath = path.join(TEST_DIR, 'author.md');
      await fs.writeFile(filePath, 'Created by 王五 on 2024-03-15\n\n# 标题');
      const doc = await adapter.parse(filePath);
      expect(doc.metadata.author).toBe('王五');
    });

    test('应提取关键词', async () => {
      const filePath = path.join(TEST_DIR, 'keywords.md');
      await fs.writeFile(filePath, '# TAF 故障转移设计\n\n内容涉及 YDBRD-99999');
      const doc = await adapter.parse(filePath);
      expect(doc.metadata.keywords).toContain('TAF');
      expect(doc.metadata.keywords).toContain('YDBRD-99999');
    });

    test('应计算文件 hash', async () => {
      const filePath = path.join(TEST_DIR, 'hash.md');
      await fs.writeFile(filePath, '# 标题');
      const doc = await adapter.parse(filePath);
      expect(doc.hash).toBeTruthy();
      expect(doc.hash.length).toBe(64); // SHA-256 hex
    });
  });

  describe('canHandle', () => {
    test('应接受 .md 文件', () => {
      expect(adapter.canHandle('test.md')).toBe(true);
    });

    test('应接受 .markdown 文件', () => {
      expect(adapter.canHandle('test.markdown')).toBe(true);
    });

    test('应拒绝 .txt 文件', () => {
      expect(adapter.canHandle('test.txt')).toBe(false);
    });
  });
});
