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
    test('空文本无 token，纯符号文本仍有体积', () => {
      expect(chunker.estimateTokens('')).toBe(0);
      expect(chunker.estimateTokens('1234 | --')).toBeGreaterThan(0);
    });
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

  describe('结构块边界与不完整输入', () => {
    test('相邻段落超过上限时在最后一个弱边界切分，正文与章节不丢失', () => {
      const bounded = new SemanticChunker({ minTokens: 10, maxTokens: 35 });
      const blocks = [
        { type: 'heading', level: 1, text: '章节', content: '# 章节\n', protected: false },
        ...['甲', '乙', '丙'].map(text => ({ type: 'paragraph', content: text.repeat(8) + '\n', protected: false }))
      ];
      const before = structuredClone(blocks);
      const chunks = bounded.splitIntoChunks(blocks, {});
      expect(chunks).toHaveLength(2);
      expect(chunks.map(chunk => chunk.blocks)).toEqual([blocks.slice(0, 3), blocks.slice(3)]);
      expect(chunks.map(chunk => chunk.tokens)).toEqual([30, 13]);
      expect(chunks.map(chunk => chunk.sectionPath)).toEqual([['章节'], ['章节']]);
      expect(chunks.flatMap(chunk => chunk.blocks)).toEqual(before);
      chunks[1].sectionPath.push('子节');
      expect(chunks[0].sectionPath).toEqual(['章节']);
      expect(blocks).toEqual(before);
    });

    test('空结构块没有虚构分块，非相邻段落不视为弱边界', () => {
      expect(chunker.splitIntoChunks([], {})).toEqual([]);
      expect(chunker.findLastWeakBoundary([
        { type: 'paragraph' }, { type: 'heading' }, { type: 'paragraph' }
      ])).toBe(-1);
    });

    test.each([
      ['```sql\nSELECT 1;\n```', 'code'],
      ['```sql\nSELECT 1;', 'code'],
      ['| 参数 | 值 |\n| --- | --- |', 'table'],
    ])('文档以保护块开始时保留全部内容 %#', (content, type) => {
      const defaults = new SemanticChunker();
      const blocks = defaults.parseBlocks(content);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({ type, protected: true, startLine: 0 });
      expect(defaults.chunkFile(content, { title: '输入边界' })[0].bodyContent).toBe(content + '\n');
    });

    test.each([
      ['短。', '前缀\n---\n正文'],
      ['这是足够长的上文句子。', '未携带分隔符的正文'],
    ])('没有长句或上下文前缀时不插入重叠 %#', (bodyContent, content) => {
      const chunks = [{ bodyContent }, { content, tokens: 7 }];
      chunker.applyOverlap(chunks);
      expect(chunks[1]).toEqual({ content, tokens: 7 });
    });
  });

  describe('Overlap 应用', () => {
    test('三级标题达到中边界阈值时切分，关闭重叠后正文保持独立', () => {
      const isolated = new SemanticChunker({ minTokens: 50, maxTokens: 300, overlapSentences: 0 });
      const content = `# 标题\n${'中'.repeat(150)}\n### 子节\n末尾`;
      const chunks = isolated.chunkFile(content, { title: '分块边界' });
      expect(chunks).toHaveLength(2);
      expect(chunks[0].bodyContent).toBe(`# 标题\n${'中'.repeat(150)}\n`);
      expect(chunks[1].bodyContent).toBe('### 子节\n末尾\n');
      expect(chunks[1].content).not.toContain('接上文');
      expect(chunks[1].content).not.toContain('中'.repeat(150));
      expect(chunks.map(chunk => chunk.chunkIndex)).toEqual([0, 1]);
      expect(chunks.every(chunk => chunk.totalChunks === 2)).toBe(true);
    });

    test('无标题正文剥离 YAML 并使用缺省上下文', () => {
      const chunks = chunker.chunkFile('---\ntitle: YAML标题\n---\n正文', {});
      expect(chunks).toHaveLength(1);
      expect(chunks[0].bodyContent).toBe('正文\n');
      expect(chunks[0].content).not.toContain('YAML标题');
      expect(chunks[0].content).toContain('section_path: "未知章节"');
      expect(chunks[0].sectionPath).toBe('');
      expect(chunks[0].metadata.legacyChunkId).toContain('unknown-other-untitled-source-unknown');
      expect(chunks[0].tokens).toBeGreaterThan(0);
    });

    test('显式身份、源路径及领域追溯保留到分块元数据', () => {
      const metadata = { docId: 'explicit-doc', sourcePath: '/导入/说明.md',
        title: '源 文档', keywords: ['连接'], feature: '连接管理', subFeature: '认证',
        featureConfidence: 0.8, featureSource: '规则', featureReason: '标题匹配' };
      const [chunk] = chunker.chunkFile('未带标题的正文内容。', metadata);
      expect(chunk.chunkId).toBe('explicit-doc-chunk-000');
      expect(chunk.metadata).toMatchObject(metadata);
      expect(chunk.metadata.legacyChunkId).toMatch(/^unknown-other-源-文档-source-[a-z0-9]+-chunk-000$/);
      expect(chunk.sectionPath).toBe('源 文档');
      expect(chunk.content).toContain('doc_id: "explicit-doc"');
    });

    test('关闭保护配置时表格和代码仍完整输出，后续正文不丢失', () => {
      const unprotected = new SemanticChunker({ minTokens: 10, maxTokens: 40,
        protectTables: false, protectCodeBlocks: false, overlapSentences: 0 });
      const table = `| 参数 | 值 |\n| --- | --- |\n| 名称 | ${'值'.repeat(40)} |\n`;
      const code = `\`\`\`sql\nSELECT '${'中'.repeat(40)}';\n\`\`\`\n`;
      const content = `引言\n${table}后续说明\n${code}尾部正文`;
      const chunks = unprotected.chunkFile(content, { title: '关闭保护' });
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.map(chunk => chunk.bodyContent).join('')).toBe(`${content}\n`);
      expect(chunks.some(chunk => chunk.bodyContent.includes(table))).toBe(true);
      expect(chunks.some(chunk => chunk.bodyContent.includes(code))).toBe(true);
    });
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
