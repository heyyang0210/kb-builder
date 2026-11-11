const crypto = require('crypto');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { Pipeline, PipelineReport, DeltaResult } = require('../../../../packages/agent-runner-core/lib/preprocessing/pipeline');

const TEMP_ROOT = process.env.YASDB_TEST_TMP_DIR || os.tmpdir();
const hash = content => crypto.createHash('sha256').update(content).digest('hex');

class FilePipeline extends Pipeline {
  constructor() {
    super();
    this.calls = [];
    this.adapterValue = {
      scan: async directory => (await fs.readdir(directory)).map(name => path.join(directory, name)).sort(),
      computeHash: async filePath => hash(await fs.readFile(filePath))
    };
  }

  get name() { return 'fixture'; }
  get adapter() { return this.adapterValue; }

  async clean(files) {
    this.calls.push('clean');
    return Promise.all(files.map(async file => ({
      filePath: file.filePath, content: await fs.readFile(file.filePath, 'utf8')
    })));
  }

  async index(data, config, delta) {
    this.calls.push('index');
    if (this.failIndex) throw new Error('索引失败');
    return { files: data.map(item => item.filePath), changed: delta.totalChanged };
  }
}

class OutputPipeline extends FilePipeline {
  async chunk(cleaned) {
    this.calls.push('chunk');
    return this.chunkResult === undefined ? null : cleaned.map(item => ({ ...item, chunked: true }));
  }

  async cleanupDeleted(deleted, outputDir) {
    this.calls.push('cleanup');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'deleted.json'), JSON.stringify(deleted));
  }

  async writeOutput(cleaned, chunked, indexResult, outputDir) {
    this.calls.push('write');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify({ cleaned, chunked, indexResult }));
  }
}

describe('Pipeline 基类阶段与增量边界', () => {
  let root;
  let sourceDir;
  let outputDir;

  beforeEach(async () => {
    await fs.mkdir(TEMP_ROOT, { recursive: true });
    root = await fs.mkdtemp(path.join(TEMP_ROOT, 'pipeline-base-'));
    sourceDir = path.join(root, 'source');
    outputDir = path.join(root, 'output');
    await fs.mkdir(sourceDir);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const context = (sourceDir, outputDir, extra = {}) => ({
    sourceDir, outputDir, config: {}, snapshot: null, dryRun: false, ...extra
  });

  test('无快照全量执行写出真实文件并记录阶段', async () => {
    const filePath = path.join(sourceDir, 'one.md');
    await fs.writeFile(filePath, '原始正文');
    const pipeline = new OutputPipeline();

    const report = await pipeline.execute(context(sourceDir, outputDir));
    const written = JSON.parse(await fs.readFile(path.join(outputDir, 'result.json'), 'utf8'));
    expect(report.toJSON()).toMatchObject({
      pipelineName: 'fixture', status: 'success',
      phases: {
        scan: { status: 'completed', data: { filesFound: 1 } },
        delta: { data: { added: 1, full: true, totalChanged: 1 } },
        clean: { data: { processed: 1, stats: { total: 1 } } },
        chunk: { data: { skipped: true } },
        index: { data: { changed: 1 } },
        validate: { data: { passed: true, checks: {} } }
      }
    });
    expect(written).toMatchObject({
      cleaned: [{ filePath, content: '原始正文' }],
      chunked: null,
      indexResult: { files: [filePath], changed: 1 }
    });
    expect(pipeline.calls).toEqual(['clean', 'chunk', 'index', 'write']);
  });

  test('已有快照无变化时跳过清洗和索引', async () => {
    const filePath = path.join(sourceDir, 'same.md');
    await fs.writeFile(filePath, '相同正文');
    const pipeline = new OutputPipeline();
    const report = await pipeline.execute(context(sourceDir, outputDir, {
      snapshot: { fileHashes: { [filePath]: { hash: hash('相同正文') } } }
    }));

    expect(report.status).toBe('success');
    expect(report.phases.delta.data).toMatchObject({ unchanged: 1, totalChanged: 0, full: false });
    expect(report.warnings).toEqual([{ phase: 'delta', message: '无变更，跳过处理' }]);
    expect(report.phases.clean).toBeUndefined();
    expect(pipeline.calls).toEqual([]);
  });

  test('新增、修改、删除进入分块与清理，dry-run 跳过写出', async () => {
    const modified = path.join(sourceDir, 'modified.md');
    const added = path.join(sourceDir, 'added.md');
    const deleted = path.join(sourceDir, 'deleted.md');
    await fs.writeFile(modified, '新正文');
    await fs.writeFile(added, '新增正文');
    const pipeline = new OutputPipeline();
    pipeline.chunkResult = true;

    const report = await pipeline.execute(context(sourceDir, outputDir, {
      snapshot: { fileHashes: {
        [modified]: { hash: hash('旧正文') },
        [deleted]: { hash: hash('删除正文') }
      } },
      dryRun: true
    }));
    const deletedOutput = JSON.parse(await fs.readFile(path.join(outputDir, 'deleted.json'), 'utf8'));

    expect(report.phases.delta.data).toMatchObject({
      added: 1, modified: 1, deleted: 1, unchanged: 0, totalChanged: 3, full: false
    });
    expect(report.phases.chunk.data).toEqual({ chunksGenerated: 2 });
    expect(report.phases.cleanup.data).toEqual({ cleaned: 1 });
    expect(report.phases.index.data.files).toEqual([added, modified]);
    expect(deletedOutput).toEqual([{ filePath: deleted, previousHash: hash('删除正文') }]);
    expect(pipeline.calls).toEqual(['clean', 'chunk', 'index', 'cleanup']);
    await expect(fs.stat(path.join(outputDir, 'result.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('禁用分块时直接索引清洗结果，异常继续向调用者传播', async () => {
    await fs.writeFile(path.join(sourceDir, 'one.md'), '正文');
    const pipeline = new OutputPipeline();
    const report = await pipeline.execute(context(sourceDir, outputDir, {
      config: { chunking: { enabled: false } }
    }));
    expect(report.phases.chunk).toBeUndefined();
    expect(pipeline.calls).toEqual(['clean', 'index', 'write']);

    pipeline.failIndex = true;
    await expect(pipeline.execute(context(sourceDir, outputDir))).rejects.toThrow('索引失败');
  });

  test('报告、增量对象及抽象阶段的默认契约明确', async () => {
    const report = new PipelineReport('manual');
    report.phaseEnd('absent');
    report.phaseError('absent', new Error('无阶段'));
    report.phaseStart('clean');
    report.phaseEnd('clean');
    report.phaseStart('index');
    report.phaseError('index', '失败');
    expect(report.errors).toEqual([
      { phase: 'absent', message: '无阶段' }, { phase: 'index', message: '失败' }
    ]);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    report.fail();
    expect(report.toJSON()).toMatchObject({ status: 'failed', phases: { index: { status: 'failed' } } });

    const delta = new DeltaResult();
    expect(delta.hasChanges).toBe(false);
    expect(delta.toJSON()).toMatchObject({ added: 0, totalChanged: 0, full: false });
    delta.added.push({ filePath: 'new.md' });
    expect(delta.hasChanges).toBe(true);

    const abstract = new Pipeline();
    expect(() => abstract.name).toThrow('Pipeline.name must be implemented');
    expect(() => abstract.adapter).toThrow('Pipeline.adapter must be implemented');
    await expect(abstract.clean([])).rejects.toThrow('Pipeline.clean must be implemented');
    await expect(abstract.index([])).rejects.toThrow('Pipeline.index must be implemented');
    expect(await abstract.chunk([])).toBeNull();
    expect(await abstract.validate(report, {})).toEqual({ passed: true, checks: {} });
    await expect(abstract.cleanupDeleted([], outputDir)).resolves.toBeUndefined();
    await expect(abstract.writeOutput([], null, {}, outputDir)).resolves.toBeUndefined();
    expect(abstract.aggregateCleanStats([])).toEqual({ total: 0 });
  });
});
