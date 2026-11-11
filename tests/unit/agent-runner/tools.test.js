const fs = require('fs');
const path = require('path');
const { MCPClient } = require('../../../packages/agent-runner-core/lib/tools/mcp-client');
const FileReader = require('../../../packages/agent-runner-core/lib/tools/file-reader');
const FileWriter = require('../../../packages/agent-runner-core/lib/tools/file-writer');
const ToolManager = require('../../../packages/agent-runner-core/lib/tools/tool-manager');

const TEST_DIR = path.join(process.env.YASDB_TEST_TMP_DIR || require('os').tmpdir(), 'test-tools-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('FileReader', () => {
  let reader;

  beforeAll(() => {
    reader = new FileReader(TEST_DIR);
    fs.writeFileSync(path.join(TEST_DIR, 'test.txt'), 'Hello World');
    fs.mkdirSync(path.join(TEST_DIR, 'subdir'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'subdir', 'nested.txt'), 'Nested content');
  });

  test('读取文件', async () => {
    const result = await reader.read('test.txt');
    expect(result.content).toBe('Hello World');
    expect(result.size).toBe(11);
    expect(result.path).toBe('test.txt');
  });

  test('读取不存在的文件报错', async () => {
    await expect(reader.read('nonexistent.txt')).rejects.toThrow('File not found');
  });

  test('readBatch 批量读取', async () => {
    const results = await reader.readBatch(['test.txt', 'nonexistent.txt']);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });

  test('listDir 列出目录', async () => {
    const files = await reader.listDir('.');
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.name === 'test.txt')).toBe(true);
  });

  test('resolvePath 相对路径', () => {
    const resolved = reader.resolvePath('test.txt');
    expect(resolved).toBe(path.resolve(TEST_DIR, 'test.txt'));
  });

  test('resolvePath 绝对路径', () => {
    const absPath = '/absolute/path/file.txt';
    expect(reader.resolvePath(absPath)).toBe(absPath);
  });

  test('递归目录包含嵌套文件及目录类型，普通列表只返回文件', async () => {
    const entries = await reader.listDir('.', { recursive: true });
    expect(entries).toEqual(expect.arrayContaining([
      { name: 'subdir', path: 'subdir', isDirectory: true, isFile: false },
      { name: 'nested.txt', path: path.join('subdir', 'nested.txt'), isDirectory: false, isFile: true }
    ]));
    expect(entries.filter(e => e.name === 'nested.txt')).toHaveLength(1);
    expect((await reader.listDir('.')).every(e => e.isFile && !e.isDirectory)).toBe(true);
  });

  test('目录不存在时拒绝，空批次保留空结果', async () => {
    await expect(reader.listDir('missing-directory')).rejects.toThrow('Directory not found: missing-directory');
    await expect(reader.readBatch([])).resolves.toEqual([]);
  });

  test('显式编码读取保留字节大小和修改时间，批次继续报告缺失文件', async () => {
    const name = 'utf16.txt';
    const content = '知识中心';
    const target = path.join(TEST_DIR, name);
    fs.writeFileSync(target, content, 'utf16le');
    const results = await reader.readBatch([name, 'missing-encoded.txt'], { encoding: 'utf16le' });
    expect(results[0]).toMatchObject({ success: true, path: name, fullPath: target, content, size: Buffer.byteLength(content, 'utf16le') });
    expect(results[0].modified.getTime()).toBe(fs.statSync(target).mtime.getTime());
    expect(results[1]).toEqual({ path: 'missing-encoded.txt', success: false, error: 'File not found: missing-encoded.txt' });
  });

  test('默认运行目录与仓库回退路径可解析真实文件', async () => {
    const { AGENT_RUNNER_RUNTIME_ROOT } = require('../../../packages/agent-runner-core/lib/repo-paths');
    expect(new FileReader().basePath).toBe(AGENT_RUNNER_RUNTIME_ROOT);
    const target = require.resolve('../../../packages/agent-runner-core/lib/tools/file-reader');
    const relative = path.relative(path.resolve(AGENT_RUNNER_RUNTIME_ROOT, '..'), target);
    const isolatedReader = new FileReader(path.join(TEST_DIR, 'absent-base'));
    expect(isolatedReader.resolvePath(relative)).toBe(target);
    expect((await isolatedReader.read(relative)).content).toBe(fs.readFileSync(target, 'utf8'));
  });
});

describe('FileWriter', () => {
  let writer;

  beforeAll(() => {
    writer = new FileWriter(TEST_DIR);
  });

  test('写入文件', async () => {
    const result = await writer.write('output/test.md', '# Test\n\nContent');
    expect(result.success).toBe(true);
    expect(result.size).toBe(15);
    expect(fs.existsSync(result.fullPath)).toBe(true);
  });

  test('自动创建目录', async () => {
    const result = await writer.write('deep/nested/dir/file.txt', 'content');
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(TEST_DIR, 'deep/nested/dir/file.txt'))).toBe(true);
  });

  test('文件已存在时生成唯一路径', async () => {
    await writer.write('dup.txt', 'first');
    const result = await writer.write('dup.txt', 'second');
    expect(result.fullPath).toContain('dup_1.txt');
  });

  test('overwrite 选项覆盖文件', async () => {
    await writer.write('overwrite.txt', 'original');
    const result = await writer.write('overwrite.txt', 'replaced', { overwrite: true });
    expect(result.fullPath).toContain('overwrite.txt');
    const content = fs.readFileSync(result.fullPath, 'utf-8');
    expect(content).toBe('replaced');
  });

  test('writeBatch 批量写入', async () => {
    const files = [
      { path: 'batch/a.txt', content: 'A' },
      { path: 'batch/b.txt', content: 'B' }
    ];
    const results = await writer.writeBatch(files);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
  });
});

describe('MCPClient', () => {
  let client;

  beforeEach(() => {
    client = new MCPClient({
      server_url: 'http://localhost:9999',
      cache: { enabled: true, ttl: 3600, max_size: 100 }
    });
  });

  test('初始化正确', () => {
    expect(client.baseUrl).toBe('http://localhost:9999');
    expect(client.timeout).toBe(30000);
  });

  test('缓存统计', () => {
    const stats = client.getCacheStats();
    expect(stats.enabled).toBe(true);
    expect(stats.size).toBe(0);
  });

  test('query 连接失败抛出错误', async () => {
    await expect(client.query('test')).rejects.toThrow();
  });

  test('batchQuery 处理多个查询', async () => {
    const results = await client.batchQuery(['q1', 'q2']);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(false);
  });

  test('testConnection 返回失败', async () => {
    const result = await client.testConnection();
    expect(result.success).toBe(false);
  });

  test('无缓存模式', () => {
    const noCacheClient = new MCPClient({ server_url: 'http://localhost:9999', cache: { enabled: false } });
    expect(noCacheClient.getCacheStats().enabled).toBe(false);
  });
});

describe('ToolManager', () => {
  let tm;

  beforeEach(() => {
    tm = new ToolManager({ basePath: TEST_DIR, mcp: { server_url: 'http://localhost:9999' } });
  });

  test('注册默认 3 个工具', () => {
    const tools = tm.listTools();
    expect(tools).toContain('mcp');
    expect(tools).toContain('file_reader');
    expect(tools).toContain('file_writer');
    expect(tools).toHaveLength(3);
  });

  test('getTool 返回正确工具', () => {
    const reader = tm.getTool('file_reader');
    expect(reader).toBeDefined();
  });

  test('getTool 不存在报错', () => {
    expect(() => tm.getTool('nonexistent')).toThrow('Tool not found');
  });

  test('registerTool 注册自定义工具', () => {
    const mockTool = { name: 'custom' };
    tm.registerTool('custom', mockTool);
    expect(tm.getTool('custom')).toBe(mockTool);
  });

  test('updateConfig 更新 MCP 配置', () => {
    tm.updateConfig({ mcp: { server_url: 'http://new-server:8080' } });
    const mcp = tm.getTool('mcp');
    expect(mcp.baseUrl).toBe('http://new-server:8080');
  });
});
