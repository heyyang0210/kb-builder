const fs = require('fs').promises;
const path = require('path');
const { once } = require('events');
const { PreprocessingEngine } = require('../../../../packages/agent-runner-core/lib/preprocessing/engine');
const { PreprocessingLogger } = require('../../../../packages/agent-runner-core/lib/preprocessing/preprocessing-logger');

// Drain actual Winston file transports before asserting persisted output.
async function finish(logger) {
  const transports = logger.logger.transports.slice();
  const drained = transports.map(t => once(t, 'finish'));
  logger.logger.end();
  await Promise.all(drained);
}

describe('preprocessing public execution and logging boundaries', () => {
  let baseDir;
  let engines;
  let loggers;
  beforeEach(async () => {
    const root = path.resolve(__dirname, '../../../../runtime/test-results/preprocessing-boundaries-fixtures');
    await fs.mkdir(root, { recursive: true });
    baseDir = await fs.mkdtemp(path.join(root, 'case-'));
    engines = [];
    loggers = [];
  });
  afterEach(async () => {
    await Promise.all([...engines.map(e => e.logger), ...loggers].map(finish));
    await fs.rm(baseDir, { recursive: true, force: true });
  });
  function engine(extra = {}) {
    const value = new PreprocessingEngine({ baseDir, ...extra });
    engines.push(value);
    return value;
  }
  function logger(level) {
    const value = new PreprocessingLogger(path.join(baseDir, 'standalone'), level);
    loggers.push(value);
    return value;
  }
  function pipeline(name, execute = async () => ({ status: 'success' })) { return { name, execute }; }

  test('registration, unknown lookup and empty runAll expose stable public results', async () => {
    const e = engine();
    expect(() => e.register({})).toThrow('Pipeline must have a name');
    expect(() => e.getPipeline('missing')).toThrow('Pipeline not found: missing');
    expect(e.listPipelines()).toEqual([]);
    expect(await e.runAll()).toEqual([]);
    const p = pipeline('first');
    e.register(p);
    expect(e.getPipeline('first')).toBe(p);
    expect(e.listPipelines()).toEqual(['first']);
  });

  test('runAll preserves order, default contexts and durable reports and snapshots', async () => {
    const e = engine();
    const contexts = [];
    for (const name of ['first', 'second']) e.register(pipeline(name, async ctx => {
      contexts.push(ctx);
      return { pipelineName: name, status: 'success', phases: {}, warnings: [], errors: [] };
    }));
    const reports = await e.runAll();
    expect(reports.map(r => r.pipeline)).toEqual(['first', 'second']);
    expect(contexts[0]).toMatchObject({ sourceDir: '', outputDir: path.join(baseDir, 'preprocessing-output/first'), snapshot: null, dryRun: false });
    expect(reports[0].options).toEqual({ full: false, dryRun: false });
    const snapshots = await e.listSnapshots('first');
    expect(snapshots).toHaveLength(1);
    const stored = JSON.parse(await fs.readFile(path.join(baseDir, 'preprocessing-output/_snapshots/first/latest.json'), 'utf8'));
    expect(stored.input.total_files).toBe(0);
    expect(stored.quality).toEqual({ passed: true, checks: {} });
    await expect(e.rollback('first', snapshots[0].snapshot_id)).resolves.toBeUndefined();
    await expect(e.rollback('first', 'missing')).rejects.toThrow('Snapshot not found: missing');
    await expect(e.listSnapshots('missing')).resolves.toEqual([]);
  });

  test('incremental runs observe prior snapshots, configuration changes and latest report replacement', async () => {
    const config = { source: { inputDir: 'source' }, output: { baseDir: 'output' }, revision: 1 };
    const e = engine({ pipelines: { sample: config }, snapshots: { maxRetained: 2 }, logDir: path.join(baseDir, 'logs'), snapshotDir: path.join(baseDir, 'snapshots'), reportDir: path.join(baseDir, 'reports') });
    const contexts = [];
    e.register(pipeline('sample', async ctx => {
      contexts.push(ctx);
      return { status: 'success', phases: { scan: { data: { filesFound: 2 } }, delta: { data: { added: 2 } }, clean: { data: { processed: 2 } }, chunk: { data: { chunksGenerated: 3 } }, index: { data: { l1Entries: 4, l2Summaries: 5 } }, validate: { data: { passed: false } } } };
    }));
    const first = await e.run('sample');
    config.revision = 2;
    const second = await e.run('sample');
    expect(contexts[1]).toMatchObject({ sourceDir: 'source', outputDir: 'output', snapshot: { snapshot_id: first.snapshot_id } });
    const latest = JSON.parse(await fs.readFile(path.join(baseDir, 'reports/sample/latest.json'), 'utf8'));
    expect(latest.execution_id).toBe(second.execution_id);
    const snap = JSON.parse(await fs.readFile(path.join(baseDir, 'snapshots/sample/latest.json'), 'utf8'));
    expect(snap).toMatchObject({ previous_snapshot_id: first.snapshot_id, output: { cleaned_files: 2, chunk_count: 3, l1_entries: 4, l2_summaries: 5 }, quality: { passed: false } });
    // The transport is flushed below; avoid rereading an active log stream.
    await finish(e.logger);
    engines.pop();
    expect((await e.readRecentLogs()).some(l => l.message === '配置已变更，建议执行全量处理')).toBe(true);
  });

  test('dry run leaves snapshots absent while full run ignores an existing snapshot', async () => {
    const e = engine();
    const contexts = [];
    e.register(pipeline('sample', async ctx => { contexts.push(ctx); return { status: 'success' }; }));
    await e.run('sample', { dryRun: true, full: true });
    expect(await e.listSnapshots('sample')).toEqual([]);
    await e.run('sample');
    const report = await e.run('sample', { full: true });
    expect(contexts[2].snapshot).toBeNull();
    expect(report.options.full).toBe(true);
  });

  test('legacy snapshots without a config hash remain readable', async () => {
    const e = engine();
    e.register(pipeline('legacy'));
    await e.run('legacy');
    const latestPath = path.join(baseDir, 'preprocessing-output/_snapshots/legacy/latest.json');
    const snap = JSON.parse(await fs.readFile(latestPath, 'utf8'));
    delete snap.config_hash;
    await fs.writeFile(latestPath, JSON.stringify(snap));
    await expect(e.run('legacy')).resolves.toMatchObject({ status: 'success' });
  });

  test('production logger writes files with no console transport', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const l = logger();
      expect(l.logger.transports.map(t => t.constructor.name)).toEqual(['File', 'File']);
      l.info('production log');
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  test('execution errors are propagated and no report is committed', async () => {
    const e = engine();
    const failure = new Error('pipeline failure');
    e.register(pipeline('bad', async () => { throw failure; }));
    await expect(e.run('bad')).rejects.toBe(failure);
    await expect(fs.stat(path.join(e.reportDir, 'bad/latest.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('a directory blocking latest report causes a real filesystem error', async () => {
    const e = engine();
    e.register(pipeline('sample'));
    await fs.mkdir(path.join(e.reportDir, 'sample/latest.json'), { recursive: true });
    await expect(e.run('sample')).rejects.toMatchObject({ code: 'EISDIR' });
  });

  test('recent logs skip malformed lines and respect pipeline and count filtering', async () => {
    const e = engine();
    await fs.mkdir(e.logger.logDir, { recursive: true });
    await fs.writeFile(path.join(e.logger.logDir, 'preprocessing.jsonl'), '\ninvalid\n' + [{ pipeline: 'a', n: 1 }, { pipeline: 'b', n: 2 }, { pipeline: 'a', n: 3 }].map(JSON.stringify).join('\n'));
    expect(await e.readRecentLogs('a', 1)).toEqual([{ pipeline: 'a', n: 3 }]);
    expect(await e.readRecentLogs(undefined, 2)).toEqual([{ pipeline: 'b', n: 2 }, { pipeline: 'a', n: 3 }]);
    expect(await e.logger.readRecentLogs()).toHaveLength(3);
  });

  test('missing log returns empty and directory read failure propagates', async () => {
    const l = logger();
    expect(await l.readRecentLogs()).toEqual([]);
    // Use a distinct directory so active Winston transports cannot race the fixture.
    const e = engine();
    const isolated = path.join(baseDir, 'unreadable');
    await fs.mkdir(path.join(isolated, 'preprocessing.jsonl'), { recursive: true });
    e.logger.logDir = isolated;
    await expect(e.readRecentLogs()).rejects.toMatchObject({ code: 'EISDIR' });
  });

  test('structured stage, severity and error logs retain context and clear it after completion', async () => {
    const l = logger('debug');
    l.startExecution('exec-1', 'sample');
    l.phaseStart('scan');
    l.phaseEnd('empty');
    l.phaseEnd('scan', { files: 3 });
    l.warn('warning');
    l.info('information');
    l.debug('debugging');
    l.error(null, 'plain failure');
    l.error('explicit', new Error('failed'), { detail: 'context' });
    l.endExecution('exec-1', { pipelineName: 'sample', status: 'success' }, 2);
    l.info('after');
    l.startExecution('exec-2', 'sample', { full: true, dryRun: true });
    l.endExecution('exec-2', null, 0);
    await finish(l);
    loggers.pop();
    const entries = await l.readRecentLogs(30);
    expect(entries.find(x => x.message === '阶段完成: scan')).toMatchObject({ execution_id: 'exec-1', pipeline: 'sample', phase: 'scan', files: 3 });
    expect(entries.find(x => x.message === 'plain failure')).toMatchObject({ execution_id: 'exec-1' });
    expect(entries.find(x => x.message === 'failed')).toMatchObject({ execution_id: 'explicit', detail: 'context' });
    expect(entries.find(x => x.message === 'debugging').level).toBe('debug');
    expect(entries.find(x => x.message === 'after')).toMatchObject({ execution_id: null, pipeline: null });
    expect(entries.filter(x => x.message === '预处理执行开始')[1].options).toEqual({ full: true, dryRun: true });
    expect(await fs.readFile(path.join(l.logDir, 'preprocessing.log'), 'utf8')).toContain('阶段完成: scan');
  });
});
