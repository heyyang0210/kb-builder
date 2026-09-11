const { SemanticChunker } = require('../../../../packages/agent-runner-core/lib/preprocessing/chunkers/semantic-chunker');

describe('SemanticChunker', () => {
  let chunker;

  beforeEach(() => {
    chunker = new SemanticChunker({ minTokens: 50, maxTokens: 300 });
  });

  describe('基本分块', () => {
    test('短文档应生成单个 chunk', () => {
      const content = '# 标题\n\n简短内容';
      const chunks = chunker.chunkFile(content, { title: '测试', version: 'v23.1' });
      expect(chunks.length).toBe(1);
    });

    test('长文档应按标题切分', () => {
      const content = `# 文档标题

## 第一章

${'内容'.repeat(100)}

## 第二章

${'内容'.repeat(100)}`;
      const chunks = chunker.chunkFile(content, { title: '测试', version: 'v23.1' });
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('保护块', () => {
    test('不应在表格内部切分', () => {
      const content = `# 标题

| 参数 | 值 |
|------|----|
| A | 1 |
| B | 2 |

后续内容`;
      const chunks = chunker.chunkFile(content, { title: '测试' });
      // 表格应该完整保留在某个 chunk 中
      const tableChunk = chunks.find(c => c.content.includes('| 参数 | 值 |'));
      expect(tableChunk).toBeDefined();
      expect(tableChunk.content).toContain('| A | 1 |');
      expect(tableChunk.content).toContain('| B | 2 |');
    });

    test('不应在代码块内部切分', () => {
      const content = `# 标题

\`\`\`javascript
const x = 1;
const y = 2;
const z = 3;
\`\`\`

后续内容`;
      const chunks = chunker.chunkFile(content, { title: '测试' });
      const codeChunk = chunks.find(c => c.content.includes('```javascript'));
      expect(codeChunk).toBeDefined();
      expect(codeChunk.content).toContain('const x = 1;');
      expect(codeChunk.content).toContain('const z = 3;');
    });
  });

  describe('上下文前缀', () => {
    test('每个 chunk 应包含上下文前缀', () => {
      const content = '# 标题\n\n内容';
      const chunks = chunker.chunkFile(content, { title: '测试文档', version: 'v23.1', docType: '特性设计' });
      expect(chunks[0].content).toContain('source_doc:');
      expect(chunks[0].content).toContain('version:');
      expect(chunks[0].content).toContain('📄');
    });

    test('chunk_id 应使用稳定 doc_id 和序号', () => {
      const content = '# 标题\n\n内容';
      const chunks = chunker.chunkFile(content, { title: 'TAF设计', version: 'v23.1' });
      expect(chunks[0].chunkId).toMatch(/^doc-[a-f0-9]{12}-chunk-000$/);
      expect(chunks[0].chunkId).toContain('chunk-000');
      expect(chunks[0].metadata.legacyChunkId).toContain('v23.1');
    });

    test('相同标题但不同源文件应生成不同 chunk_id', () => {
      const content = '# 相同标题\n\n这是足够长的正文内容，用于验证不同源文件不会发生 chunk 标识冲突。';
      const first = chunker.chunkFile(content, {
        title: '相同标题', version: 'v1', docType: '设计', originalFile: '/a/doc.docx'
      });
      const second = chunker.chunkFile(content, {
        title: '相同标题', version: 'v1', docType: '设计', originalFile: '/b/doc.pptx'
      });
      expect(first[0].chunkId).not.toBe(second[0].chunkId);
    });
  });

  describe('章节路径追踪', () => {
    test('应正确追踪章节路径', () => {
      const content = `# 文档

## 第一章

${'内容行\n'.repeat(30)}

### 1.1 小节

${'内容行\n'.repeat(30)}

## 第二章

${'内容行\n'.repeat(30)}`;
      const chunks = chunker.chunkFile(content, { title: '测试' });
      // 应该有多个 chunk
      expect(chunks.length).toBeGreaterThan(1);
      // 至少有一个 chunk 的 sectionPath 包含 "第一章"
      const hasChapter1 = chunks.some(c => c.sectionPath.includes('第一章'));
      expect(hasChapter1).toBe(true);
    });
  });

  describe('Token 估算', () => {
    test('中文字符应按 1.5 token/字估算', () => {
      const tokens = chunker.estimateTokens('这是一个测试');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(10);
    });

    test('英文单词应按 1.3 token/词估算', () => {
      const tokens = chunker.estimateTokens('this is a test');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(10);
    });

    test('混合文本应正确估算', () => {
      const tokens = chunker.estimateTokens('这是 test 测试');
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('Overlap 应用', () => {
    test('多 chunk 文档应应用 overlap', () => {
      const content = `# 文档

## 第一章

${'内容行\n'.repeat(50)}

## 第二章

${'内容行\n'.repeat(50)}`;
      const chunks = chunker.chunkFile(content, { title: '测试' });
      if (chunks.length > 1) {
        // 第二个 chunk 应该包含 overlap 标记
        expect(chunks[1].content).toContain('接上文');
      }
    });
  });
});
