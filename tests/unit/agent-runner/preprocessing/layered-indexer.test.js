const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { LayeredIndexer } = require('../../../../packages/agent-runner-core/lib/preprocessing/indexers/layered-indexer');

const TEMP_ROOT = process.env.YASDB_TEST_TMP_DIR || os.tmpdir();

describe('LayeredIndexer 文件输出与增量索引', () => {
  let outputDir;
  let config;

  beforeEach(async () => {
    await fs.mkdir(TEMP_ROOT, { recursive: true });
    outputDir = await fs.mkdtemp(path.join(TEMP_ROOT, 'layered-indexer-'));
    config = { output: { baseDir: outputDir } };
  });

  afterEach(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  const readJson = async (...parts) => JSON.parse(await fs.readFile(path.join(...parts), 'utf8'));

  test('直接文档和包装文档生成 L1、L2 与统计文件', async () => {
    const indexer = new LayeredIndexer({ useLlmForSummary: false, summaryMaxLength: 40 });
    const first = {
      content: '# 事务\n## 概述\n事务提交保证一致性。\n## 细节\n- 提交日志必须先持久化到磁盘',
      metadata: {
        docId: 'transaction', title: '事务', version: 'v1', docType: 'design',
        featureId: 'txn', keywords: ['事务'], originalFile: '/docs/transaction.md',
        author: '作者', createdDate: '2024-01-01'
      }
    };
    const second = {
      doc: {
        content: '第一段介绍备份。\n| 名称 | 用途 |\n|---|---|',
        metadata: { docId: 'backup', title: '备份', sourcePath: '/docs/backup.md' }
      }
    };

    const result = await indexer.build([first, second, { ignored: true }], config, { full: true });
    const l1 = await readJson(outputDir, 'index', 'l1-global-index.json');
    const summary = await readJson(outputDir, 'index', 'l2-summaries', 'v1', 'transaction.json');
    const backup = await readJson(outputDir, 'index', 'l2-summaries', 'unknown', 'backup.json');
    const stats = await readJson(outputDir, 'index', '_stats.json');

    expect(result).toMatchObject({ l1Entries: 2, l2Summaries: 2, totalChunks: 0 });
    expect(l1.entries.map(entry => entry.id)).toEqual(['transaction', 'backup']);
    expect(l1.entries[0]).toMatchObject({
      legacy_id: 'v1-design-事务', content_path: '/docs/transaction.md',
      feature_id: 'txn', keywords: ['事务'], line_count: 5
    });
    expect(l1.entries[1]).toMatchObject({ content_path: '/docs/backup.md', has_table: true });
    expect(summary).toMatchObject({
      author: '作者', created_date: '2024-01-01', summary: '事务提交保证一致性。',
      key_points: ['提交日志必须先持久化到磁盘'],
      content_stats: { section_count: 3, has_code: false, has_table: false }
    });
    expect(backup.summary).toContain('第一段介绍备份');
    expect(backup.content_stats.has_table).toBe(true);
    expect(stats).toMatchObject({ l1_entries: 2, l2_summaries: 2, total_chunks: 0 });
  });

  test('增量构建替换同 ID、删除源文件并在全量重建时清理旧输出', async () => {
    const indexer = new LayeredIndexer({ useLlmForSummary: false });
    const doc = (id, content) => ({
      content, metadata: { docId: id, title: id, originalFile: `/docs/${id}.md` }
    });

    await indexer.build([doc('keep', '旧内容'), doc('remove', '待删除')], config);
    await indexer.build([doc('keep', '新内容')], config, {
      deleted: [{ filePath: '/docs/remove.md' }]
    });
    let l1 = await readJson(outputDir, 'index', 'l1-global-index.json');
    expect(l1.total_entries).toBe(1);
    expect(l1.entries.map(entry => entry.id)).toEqual(['keep']);
    expect((await readJson(outputDir, 'index', 'l2-summaries', 'unknown', 'keep.json')).summary).toBe('新内容');

    const oldChunkDir = path.join(outputDir, 'chunks', 'old');
    await fs.mkdir(oldChunkDir, { recursive: true });
    await fs.writeFile(path.join(oldChunkDir, 'stale.md'), 'stale');
    await indexer.build([doc('fresh', '全量内容')], config, { full: true });
    l1 = await readJson(outputDir, 'index', 'l1-global-index.json');
    expect(l1.entries.map(entry => entry.id)).toEqual(['fresh']);
    await expect(fs.stat(oldChunkDir)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(path.join(outputDir, 'index', 'l2-summaries', 'unknown', 'keep.json')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('分块按文档聚合并写入可回读的逐块文件与清单', async () => {
    const indexer = new LayeredIndexer();
    const chunks = [0, 1].map(chunkIndex => ({
      chunkId: `guide-chunk-${chunkIndex}`, chunkIndex,
      content: `第 ${chunkIndex} 块`, sectionPath: `章节 ${chunkIndex}`, tokens: 10 + chunkIndex,
      metadata: { title: '指南', version: 'v2', originalFile: '/docs/guide.md' }
    }));
    chunks.push({ chunkId: 'standalone', chunkIndex: 0, content: '独立块' });

    const result = await indexer.build(chunks, config);
    const l1 = await readJson(outputDir, 'index', 'l1-global-index.json');
    const chunkIndex = await readJson(outputDir, 'chunks', 'v2', 'guide', '_chunks.json');
    expect(result).toMatchObject({ l1Entries: 2, l2Summaries: 0, totalChunks: 3 });
    expect(l1.entries.map(entry => [entry.id, entry.chunk_count])).toEqual([
      ['guide', 2], ['standalone', 1]
    ]);
    expect(chunkIndex).toMatchObject({
      doc_id: 'guide', chunks: [
        { chunk_id: 'chunk-000', section_path: '章节 0', tokens: 10, keywords: [] },
        { chunk_id: 'chunk-001', section_path: '章节 1', tokens: 11, keywords: [] }
      ]
    });
    expect(await fs.readFile(path.join(outputDir, 'chunks', 'v2', 'guide', 'chunk_001.md'), 'utf8'))
      .toBe('第 1 块');
    expect(await fs.readFile(path.join(outputDir, 'chunks', 'unknown', 'standalone', 'chunk_000.md'), 'utf8'))
      .toBe('独立块');
  });

  test('摘要规则、空值和 LLM 兜底遵守配置', async () => {
    const indexer = new LayeredIndexer({ summaryMaxLength: 12, ruleBasedMinLength: 100 });
    const llm = jest.spyOn(indexer, 'llmSummary').mockResolvedValue('模型摘要超过十二个字符');
    const entry = indexer.buildL1EntryFromDoc({ content: '', metadata: { docId: 'empty' } });
    const summary = await indexer.generateSummary({ content: '短内容' }, entry);
    expect(llm).toHaveBeenCalledWith('短内容', { content: '短内容' });
    expect(summary.summary).toBe('模型摘要超过十二个字符'.slice(0, 12));
    expect(summary.content_stats).toMatchObject({ section_count: 0, table_count: 0, code_block_count: 0 });
    expect(entry).toMatchObject({ title: '', version: '', doc_type: '', content_path: '', line_count: 1 });

    const rules = new LayeredIndexer({ useLlmForSummary: false });
    expect(rules.ruleBasedSummary('# 标题\n> 引用\n---')).toBe('');
    expect(rules.ruleBasedSummary('## 简介\n说明文字\n## 后续')).toBe('说明文字');
    expect(rules.extractKeyPoints('- 短\n- 这是一条足够长的有效关键要点')).toEqual([
      '这是一条足够长的有效关键要点'
    ]);
    expect(rules.extractKeyPoints('没有列表')).toEqual([]);
    expect(await rules.llmSummary('正文', {})).toBe('正文');
    expect(rules.extractDocId({ chunkId: 'plain' })).toBe('plain');
    expect(rules.extractDocId({})).toBe('');
  });

  test('L1 缺失时返回空索引，损坏时保留解析错误', async () => {
    const indexer = new LayeredIndexer();
    const indexDir = path.join(outputDir, 'index');
    expect(await indexer.loadL1Index(indexDir)).toMatchObject({ total_entries: 0, entries: [] });
    await fs.mkdir(indexDir);
    await fs.writeFile(path.join(indexDir, 'l1-global-index.json'), '{broken');
    await expect(indexer.loadL1Index(indexDir)).rejects.toThrow(SyntaxError);
  });
});
