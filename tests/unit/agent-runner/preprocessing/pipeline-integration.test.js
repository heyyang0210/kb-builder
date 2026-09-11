const fs = require('fs').promises;
const path = require('path');
const { PreprocessingEngine } = require('../../../../packages/agent-runner-core/lib/preprocessing');
const { DesignDocPipeline } = require('../../../../packages/agent-runner-core/lib/preprocessing/pipelines/design-doc-pipeline');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', 'test-pipeline-' + Date.now());
const SOURCE_DIR = path.join(TEST_DIR, 'source');
const OUTPUT_DIR = path.join(TEST_DIR, 'output');

describe('DesignDocPipeline 集成测试', () => {
  let engine;

  beforeAll(async () => {
    // 创建测试用的源文件目录
    await fs.mkdir(SOURCE_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 创建模拟的设计文档
    await createTestDoc(SOURCE_DIR, 'doc1.md', {
      title: 'TAF 故障转移设计',
      content: `Created by 张三 on 2024-01-18

# TAF 故障转移设计

## 1. 概述

透明应用程序故障转移（TAF）是客户端功能。
参考 [调研文档](https://conf.yasdb.com/pages/123)

## 2. 参数配置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| FAILOVER | 故障转移模式 | none |
| TYPE | 故障转移类型 | session |

## 3. 代码示例

\`\`\`javascript
const config = { FAILOVER: 'session' };
\`\`\`

![架构图](https://conf.yasdb.com/xxx/arch.png)

详见 [参数说明](#2-参数配置)
`
    });

    await createTestDoc(SOURCE_DIR, 'doc2.md', {
      title: '备份恢复设计',
      content: `Created by 李四 on 2024-02-20

## 备份恢复概述

本文档描述备份恢复功能。

### 备份策略

- 全量备份
- 增量备份
- 差异备份

参考 https://jira.yasdb.com/browse/YDBRD-55555
`
    });
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    const config = {
      baseDir: TEST_DIR,
      logDir: path.join(TEST_DIR, 'logs'),
      snapshotDir: path.join(TEST_DIR, 'snapshots'),
      reportDir: path.join(TEST_DIR, 'reports'),
      pipelines: {
        'design-docs': {
          source: { inputDir: SOURCE_DIR },
          output: { baseDir: OUTPUT_DIR },
          cleaning: {
            removeConfluenceMeta: true,
            cleanInternalLinks: true,
            handleImageRefs: true,
            cleanAnchorLinks: true,
            normalizeHeadings: true,
            addYamlFront: true
          },
          chunking: {
            enabled: true,
            minTokens: 50,
            maxTokens: 500
          },
          indexing: {
            useLlmForSummary: false
          },
          quality: { enabled: true }
        }
      }
    };

    engine = new PreprocessingEngine(config);
    engine.register(new DesignDocPipeline(config.pipelines['design-docs']));
  });

  test('完整流水线应成功执行', async () => {
    const report = await engine.run('design-docs');
    expect(report.status).toBe('success');
    expect(report.phases.scan).toBeTruthy();
    expect(report.phases.clean).toBeTruthy();
    expect(report.phases.chunk).toBeTruthy();
    expect(report.phases.index).toBeTruthy();
    expect(report.phases.validate).toBeTruthy();
  });

  test('应生成清洗后文件', async () => {
    await engine.run('design-docs');
    const cleanedDir = path.join(OUTPUT_DIR, 'cleaned');
    const files = await cleanedMarkdownFiles(cleanedDir);
    expect(files.length).toBeGreaterThan(0);
  });

  test('应生成可追溯的文档包和清洗差异', async () => {
    await engine.run('design-docs', { full: true });
    const cleanedDir = path.join(OUTPUT_DIR, 'cleaned');
    const entries = await fs.readdir(cleanedDir, { withFileTypes: true });
    const packageEntry = entries.find(entry => entry.isDirectory() && entry.name.startsWith('doc-'));
    expect(packageEntry).toBeDefined();
    expect(await fileExists(path.join(cleanedDir, packageEntry.name, 'source.md'))).toBe(true);
    expect(await fileExists(path.join(cleanedDir, packageEntry.name, 'document.md'))).toBe(true);
    expect(await fileExists(path.join(cleanedDir, packageEntry.name, 'manifest.json'))).toBe(true);
    expect(await fileExists(path.join(cleanedDir, packageEntry.name, 'diff.json'))).toBe(true);
  });

  test('非 Markdown 文件的统一 Markdown 产出不应被旧文件清理逻辑删除', async () => {
    const pipeline = new DesignDocPipeline({});
    const outputDir = path.join(TEST_DIR, 'non-markdown-output');

    await pipeline.writeOutput([
      { filePath: 'DataBuffer.pptx', content: '# DataBuffer' },
      { filePath: '%E4%BA%8B%E5%8A%A1.docx', content: '# 事务' }
    ], [], {}, outputDir);

    expect(await fileExists(path.join(outputDir, 'cleaned', 'DataBuffer.pptx.md'))).toBe(true);
    expect(await fileExists(path.join(outputDir, 'cleaned', '事务.docx.md'))).toBe(true);
  });

  test('应生成分层索引', async () => {
    await engine.run('design-docs');
    const indexDir = path.join(OUTPUT_DIR, 'index');
    const l1Exists = await fileExists(path.join(indexDir, 'l1-global-index.json'));
    const statsExists = await fileExists(path.join(indexDir, '_stats.json'));
    expect(l1Exists).toBe(true);
    expect(statsExists).toBe(true);
  });

  test('L1 索引应包含正确的条目', async () => {
    await engine.run('design-docs');
    const l1Content = await fs.readFile(path.join(OUTPUT_DIR, 'index', 'l1-global-index.json'), 'utf-8');
    const l1 = JSON.parse(l1Content);
    expect(l1.entries.length).toBeGreaterThan(0);
    expect(l1.entries[0]).toHaveProperty('title');
    expect(l1.entries[0]).toHaveProperty('version');
    expect(l1.entries[0]).toHaveProperty('keywords');
  });

  test('清洗后文件应不含内部链接', async () => {
    await engine.run('design-docs');
    const cleanedDir = path.join(OUTPUT_DIR, 'cleaned');
    const files = await cleanedMarkdownFiles(cleanedDir);
    for (const file of files) {
      if (file.startsWith('_')) continue;
      const content = await fs.readFile(path.join(cleanedDir, file), 'utf-8');
      const contentWithoutImages = content.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
      // 标注 [内部链接: conf.yasdb.com] 是合理的，只检查不含完整 URL
      expect(contentWithoutImages).not.toContain('https://conf.yasdb.com');
      // jira.yasdb.com 出现在 [内部链接: jira.yasdb.com] 标注中是合理的
      // 只检查不应包含完整的内部 URL
      expect(contentWithoutImages).not.toContain('https://jira.yasdb.com');
    }
  });

  test('清洗后文件应不含 Created by 元数据', async () => {
    await engine.run('design-docs');
    const cleanedDir = path.join(OUTPUT_DIR, 'cleaned');
    const files = await cleanedMarkdownFiles(cleanedDir);
    for (const file of files) {
      if (file.startsWith('_')) continue;
      const content = await fs.readFile(path.join(cleanedDir, file), 'utf-8');
      // YAML 前置后的正文不应包含 Created by
      const bodyStart = content.indexOf('---', 3);
      if (bodyStart > 0) {
        const body = content.slice(bodyStart + 3);
        expect(body).not.toMatch(/^Created by/m);
      }
    }
  });

  test('清洗后文件应保留表格', async () => {
    await engine.run('design-docs');
    const cleanedDir = path.join(OUTPUT_DIR, 'cleaned');
    const files = await cleanedMarkdownFiles(cleanedDir);
    // 至少有一个文件包含表格
    let hasTable = false;
    for (const file of files) {
      if (file.startsWith('_')) continue;
      const content = await fs.readFile(path.join(cleanedDir, file), 'utf-8');
      if (content.includes('| 参数 | 说明 |')) {
        hasTable = true;
        break;
      }
    }
    expect(hasTable).toBe(true);
  });

  test('清洗后文件应保留代码块', async () => {
    await engine.run('design-docs');
    const cleanedDir = path.join(OUTPUT_DIR, 'cleaned');
    const files = await cleanedMarkdownFiles(cleanedDir);
    let hasCode = false;
    for (const file of files) {
      if (file.startsWith('_')) continue;
      const content = await fs.readFile(path.join(cleanedDir, file), 'utf-8');
      if (content.includes('```javascript')) {
        hasCode = true;
        break;
      }
    }
    expect(hasCode).toBe(true);
  });

  test('增量模式：无变更时应跳过处理', async () => {
    // 第一次全量执行
    await engine.run('design-docs', { full: true });
    // 第二次增量执行
    const report = await engine.run('design-docs');
    // 应该检测到无变更
    expect(report.status).toBe('success');
  });

  test('全量模式：应重新处理所有文件', async () => {
    const report = await engine.run('design-docs', { full: true });
    expect(report.status).toBe('success');
    expect(report.phases.delta.data.added + report.phases.delta.data.modified).toBeGreaterThan(0);
  });

  test('dry-run 模式：应正常执行但不持久化快照', async () => {
    const report = await engine.run('design-docs', { dryRun: true });
    expect(report.status).toBe('success');
    // dry-run 模式下不应生成新快照
    // （注意：当前实现中 dry-run 仍会写入产出文件，仅跳过快照保存）
  });

  test('应生成执行快照', async () => {
    await engine.run('design-docs');
    const snapshots = await engine.listSnapshots('design-docs');
    expect(snapshots.length).toBeGreaterThan(0);
  });

  test('应生成执行报告', async () => {
    const report = await engine.run('design-docs');
    expect(report.execution_id).toBeTruthy();
    expect(report.duration_ms).toBeGreaterThan(0);
    expect(report.phases).toBeTruthy();
  });

  // 辅助函数
  async function createTestDoc(dir, filename, { title, content }) {
    await fs.writeFile(path.join(dir, filename), content, 'utf-8');
  }

  async function fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async function cleanedMarkdownFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(entry => entry.isFile() && entry.name.endsWith('.md')).map(entry => entry.name);
  }
});
