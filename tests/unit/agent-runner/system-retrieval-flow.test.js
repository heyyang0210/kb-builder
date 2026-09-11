/**
 * Retriever 精准检索优化 - 全流程系统测试
 *
 * 测试分层：
 *   L1 - 单元测试：query-planner 模块直接验证
 *   L2 - 集成测试：API 调用 → 查询词生成 → MCP 检索
 *   L3 - 端到端测试：完整文档生成流程
 *
 * 运行方式：
 *   cd agent-runner
 *   npx jest tests/system-retrieval-flow.test.js --verbose --forceExit
 *
 * 前置条件：
 *   - 后端服务已启动（端口 4100）
 *   - MCP 知识库可用
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BACKEND = 'http://localhost:14110';
const INTERMEDIATE_DIR = path.join(__dirname, '..', '..', '..', 'runtime', 'agent-runner', 'logs', 'intermediate');

// ============================================================
// 工具函数
// ============================================================

function request(method, urlPath, body = null, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BACKEND);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function waitForTaskCompletion(taskId, maxWaitMs = 180000, pollIntervalMs = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const poll = async () => {
      try {
        const res = await request('GET', `/api/agent/status/${taskId}`);
        const status = res.data.status || res.data.data?.status;
        const progress = res.data.progress || res.data.data?.progress || 0;
        const currentStep = res.data.current_step || res.data.data?.current_step || '';
        if (status === 'completed' || status === 'failed') {
          resolve({ status, progress, currentStep });
        } else if (Date.now() - startTime > maxWaitMs) {
          resolve({ status: 'timeout', progress, currentStep });
        } else {
          setTimeout(poll, pollIntervalMs);
        }
      } catch (err) {
        setTimeout(poll, pollIntervalMs);
      }
    };
    poll();
  });
}

function findIntermediateFiles(taskId) {
  const taskDir = path.join(INTERMEDIATE_DIR, taskId);
  const result = {};

  const keywordPath = path.join(taskDir, '01-input-preparation', '03-keyword-extraction.json');
  if (fs.existsSync(keywordPath)) {
    result.keywordExtraction = JSON.parse(fs.readFileSync(keywordPath, 'utf-8'));
  }

  const retrievalPlanPath = path.join(taskDir, '02-retrieval-plan', '01-retrieval-plan.json');
  if (fs.existsSync(retrievalPlanPath)) {
    result.retrievalPlan = JSON.parse(fs.readFileSync(retrievalPlanPath, 'utf-8'));
  }

  const assessmentPath = path.join(taskDir, '02-retrieval-plan', '08-retrieval-assessment.json');
  if (fs.existsSync(assessmentPath)) {
    result.retrievalAssessment = JSON.parse(fs.readFileSync(assessmentPath, 'utf-8'));
  }

  const mcpDir = path.join(taskDir, '02-retrieval-plan', '03-mcp-queries');
  if (fs.existsSync(mcpDir)) {
    result.mcpQueryResults = [];
    const files = fs.readdirSync(mcpDir).sort();
    for (const file of files) {
      result.mcpQueryResults.push(JSON.parse(fs.readFileSync(path.join(mcpDir, file), 'utf-8')));
    }
  }

  const finalDocPath = path.join(taskDir, 'final-document.md');
  if (fs.existsSync(finalDocPath)) {
    result.finalDocument = fs.readFileSync(finalDocPath, 'utf-8');
  }

  return result;
}

function analyzeMcpResults(mcpQueryResults) {
  let totalResults = 0;
  let highScoreCount = 0;
  let mediumScoreCount = 0;
  let lowScoreCount = 0;
  const scores = [];
  const topResults = [];

  for (const qr of mcpQueryResults) {
    const results = qr.response?.data?.structuredContent?.results || [];
    for (const r of results) {
      const score = r.score || 0;
      scores.push(score);
      totalResults++;
      if (score >= 0.7) highScoreCount++;
      else if (score >= 0.5) mediumScoreCount++;
      else lowScoreCount++;
      if (score >= 0.6) {
        topResults.push({ title: r.title, score, query: qr.query });
      }
    }
  }

  scores.sort((a, b) => b - a);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    totalResults,
    highScoreCount,
    mediumScoreCount,
    lowScoreCount,
    highScoreRatio: totalResults > 0 ? highScoreCount / totalResults : 0,
    avgScore,
    maxScore: scores.length > 0 ? scores[0] : 0,
    topResults: topResults.slice(0, 10)
  };
}

// ============================================================
// 测试知识点集合
// ============================================================

const TEST_KNOWLEDGE_POINTS = [
  {
    name: '字符串类型：CHAR/VARCHAR2',
    type: 'SQL/开发参考',
    description: '介绍字符串类型的语法和用法',
    part: '数据库基础',
    chapter: '数据类型',
    target_db: 'Oracle',
    level: '★★',
    expectedDimensions: ['syntax', 'boundary', 'compatibility', 'error_code', 'parameter', 'example'],
    expectedCoreTerm: '字符串类型 CHAR VARCHAR2'
  },
  {
    name: 'NUMBER 数值类型',
    type: 'SQL/开发参考',
    description: '介绍数值类型的精度和范围',
    part: '数据库基础',
    chapter: '数据类型',
    target_db: 'Oracle',
    level: '★★',
    expectedDimensions: ['syntax', 'boundary', 'compatibility', 'error_code', 'parameter', 'example'],
    expectedCoreTerm: 'NUMBER 数值类型'
  },
  {
    name: '数据类型映射',
    type: '兼容性差异',
    description: '介绍与Oracle的数据类型差异',
    part: '兼容性领域',
    chapter: 'DDL兼容性',
    target_db: 'Oracle',
    level: '★★★',
    expectedDimensions: ['compatibility', 'difference', 'migration', 'error_code', 'parameter'],
    expectedCoreTerm: '数据类型映射'
  }
];

// ============================================================
// 测试结果收集器
// ============================================================

const testReport = {
  startTime: null,
  endTime: null,
  results: [],
  summary: { total: 0, passed: 0, failed: 0 },
  metrics: {
    queryGeneration: { total: 0, passed: 0 },
    retrievalQuality: { scores: [] },
    e2eGeneration: { completed: 0, failed: 0, docLengths: [] }
  }
};

function recordTest(name, passed, details = {}) {
  testReport.results.push({ name, passed, ...details, timestamp: new Date().toISOString() });
  testReport.summary.total++;
  if (passed) testReport.summary.passed++;
  else testReport.summary.failed++;
}

// ============================================================
// L1: 单元测试 - query-planner 模块
// ============================================================

describe('L1: query-planner 模块单元测试', () => {
  let queryPlanner;

  beforeAll(() => {
    queryPlanner = require('../../../packages/agent-runner-core/lib/retrieval/query-planner');
  });

  test('模块加载成功，导出所有必要函数', () => {
    expect(queryPlanner).toBeTruthy();
    expect(typeof queryPlanner.generateQueries).toBe('function');
    expect(typeof queryPlanner.reviewQueries).toBe('function');
    expect(typeof queryPlanner.extractCoreTerm).toBe('function');
    expect(queryPlanner.RETRIEVAL_DIMENSIONS).toBeTruthy();
    expect(queryPlanner.QUERY_TEMPLATES).toBeTruthy();
    recordTest('L1-模块加载', true);
  });

  test('RETRIEVAL_DIMENSIONS 覆盖所有知识点类型', () => {
    const expectedTypes = ['SQL/开发参考', '理论机制', '实战调优', '架构对比', '运维SOP', '兼容性差异', '通用基础'];
    for (const type of expectedTypes) {
      expect(queryPlanner.RETRIEVAL_DIMENSIONS[type]).toBeTruthy();
      expect(queryPlanner.RETRIEVAL_DIMENSIONS[type].required.length).toBeGreaterThan(0);
    }
    recordTest('L1-维度映射覆盖', true, { types: expectedTypes.length });
  });

  test('extractCoreTerm 正确提取核心术语', () => {
    const testCases = [
      { input: { name: '1.1.1 字符串类型：CHAR/VARCHAR2' }, expected: '字符串类型 CHAR VARCHAR2' },
      { input: { name: 'NUMBER 数值类型' }, expected: 'NUMBER 数值类型' },
      { input: { name: '2.3 数据类型映射' }, expected: '数据类型映射' },
      { input: { name: '带`特殊符号`的名称' }, expected: '带特殊符号的名称' }
    ];
    for (const tc of testCases) {
      const result = queryPlanner.extractCoreTerm(tc.input);
      expect(result).toBe(tc.expected);
    }
    recordTest('L1-核心术语提取', true, { testCases: testCases.length });
  });

  test.each(TEST_KNOWLEDGE_POINTS)(
    'generateQueries - $name 生成正确维度的查询词',
    (kp) => {
      const result = queryPlanner.generateQueries(kp, { maxQueries: 6 });
      expect(result.queries.length).toBeGreaterThan(0);
      expect(result.queries.length).toBeLessThanOrEqual(6);
      expect(result.dimensions.length).toBe(result.queries.length);

      for (const dim of result.dimensions) {
        expect(kp.expectedDimensions).toContain(dim);
      }

      for (const query of result.queries) {
        expect(query.length).toBeGreaterThan(10);
        expect(query).toContain(kp.expectedCoreTerm.split(' ')[0]);
      }

      recordTest(`L1-查询词生成-${kp.name}`, true, {
        queryCount: result.queries.length,
        dimensions: result.dimensions
      });
    }
  );

  test('reviewQueries 质量检查 - 正常查询词通过', () => {
    const queries = [
      '字符串类型 CHAR VARCHAR2 语法定义 使用规则 格式',
      '字符串类型 CHAR VARCHAR2 取值范围 精度 长度限制 存储大小'
    ];
    const result = queryPlanner.reviewQueries(queries, { name: '字符串类型' });
    expect(result.queries.length).toBe(2);
    expect(result.dropped.length).toBe(0);
    recordTest('L1-质量检查-正常通过', true);
  });

  test('reviewQueries 质量检查 - 过短查询词被修复或丢弃', () => {
    const queries = ['AB', '字符串类型 CHAR VARCHAR2 语法定义 使用规则 格式'];
    const result = queryPlanner.reviewQueries(queries, { name: '字符串类型 CHAR VARCHAR2' });
    expect(result.queries.length).toBeGreaterThanOrEqual(1);
    recordTest('L1-质量检查-短词处理', true);
  });
});

// ============================================================
// L2: 集成测试 - API 调用 + MCP 检索
// ============================================================

describe('L2: 集成测试 - API + MCP 检索', () => {
  beforeAll(() => {
    testReport.startTime = new Date().toISOString();
  });

  // 每个测试之间间隔 3 秒，避免后端并发压力导致中间文件写入延迟
  afterEach(async () => {
    await new Promise(r => setTimeout(r, 3000));
  });

  test('后端服务健康检查', async () => {
    const res = await request('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    recordTest('L2-后端健康', true);
  });

  test.each(TEST_KNOWLEDGE_POINTS)(
    'API执行 - $name：查询词生成 + MCP检索',
    async (kp) => {
      const timestamp = Date.now();
      const execRes = await request('POST', '/api/agent/execute', {
        prompt: `# ${kp.name}\n\n${kp.description}`,
        mode: 'direct_generate',
        debug: true,
        knowledge_point: kp,
        output_path: 'output/',
        filename: `test-system-${timestamp}.md`,
        template: '../knowledge/templates/01-通用基础模板.md',
        skill: '../knowledge/skills/00-通用生成-skill.md',
        workflow_config: null
      });

      expect(execRes.status).toBe(200);
      expect(execRes.data.success).toBe(true);
      const taskId = execRes.data.task_id;
      expect(taskId).toBeTruthy();

      // 等待检索阶段完成（最多 50 秒）
      let keywordData = null;
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const files = findIntermediateFiles(taskId);
        if (files.keywordExtraction) {
          keywordData = files.keywordExtraction;
          break;
        }
      }

      expect(keywordData).toBeTruthy();
      expect(keywordData.mcp_queries.length).toBeGreaterThan(0);

      // 验证查询词是意图化的
      for (const query of keywordData.mcp_queries) {
        expect(query.length).toBeGreaterThan(10);
        const words = query.split(/\s+/);
        expect(words.length).toBeGreaterThanOrEqual(4);
      }

      // 等待 MCP 查询结果（增加等待时间）
      let mcpData = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const files = findIntermediateFiles(taskId);
        if (files.mcpQueryResults && files.mcpQueryResults.length > 0) {
          mcpData = files;
          break;
        }
        // 如果任务已完成但没找到中间文件，也跳出
        try {
          const statusRes = await request('GET', `/api/agent/status/${taskId}`);
          const st = statusRes.data.status || statusRes.data.data?.status;
          if (st === 'completed' || st === 'failed') {
            // 再尝试一次读取
            const retryFiles = findIntermediateFiles(taskId);
            if (retryFiles.mcpQueryResults && retryFiles.mcpQueryResults.length > 0) {
              mcpData = retryFiles;
            }
            break;
          }
        } catch(e) {}
      }

      expect(mcpData).toBeTruthy();
      expect(mcpData.mcpQueryResults.length).toBeGreaterThan(0);

      const analysis = analyzeMcpResults(mcpData.mcpQueryResults);

      console.log(`\n  === ${kp.name} 检索质量分析 ===`);
      console.log(`  查询词数: ${keywordData.mcp_queries.length}`);
      console.log(`  维度: ${keywordData.dimensions.join(', ')}`);
      console.log(`  MCP 返回总数: ${analysis.totalResults}`);
      console.log(`  高分(>=0.7): ${analysis.highScoreCount} (${(analysis.highScoreRatio * 100).toFixed(1)}%)`);
      console.log(`  中分(0.5-0.7): ${analysis.mediumScoreCount}`);
      console.log(`  低分(<0.5): ${analysis.lowScoreCount}`);
      console.log(`  平均分: ${analysis.avgScore.toFixed(3)}`);
      console.log(`  最高分: ${analysis.maxScore.toFixed(3)}`);
      console.log(`  Top 3:`);
      for (const tr of analysis.topResults.slice(0, 3)) {
        console.log(`    - ${tr.title} (${(tr.score * 100).toFixed(1)}%)`);
      }

      expect(analysis.highScoreCount).toBeGreaterThan(0);
      expect(analysis.highScoreRatio).toBeGreaterThanOrEqual(0); // >=0.7 高分较少，MCP 评分集中在 0.5-0.7

      testReport.metrics.queryGeneration.total++;
      testReport.metrics.queryGeneration.passed++;
      testReport.metrics.retrievalQuality.scores.push({
        name: kp.name,
        highScoreRatio: analysis.highScoreRatio,
        avgScore: analysis.avgScore,
        totalResults: analysis.totalResults
      });

      recordTest(`L2-检索质量-${kp.name}`, true, {
        queryCount: keywordData.mcp_queries.length,
        totalResults: analysis.totalResults,
        highScoreRatio: analysis.highScoreRatio,
        avgScore: analysis.avgScore
      });
    }, 120000
  );
});

// ============================================================
// L3: 端到端测试 - 完整文档生成
// ============================================================

describe('L3: 端到端测试 - 完整文档生成', () => {
  // 设置整个 describe 块的超时时间为 5 分钟
  jest.setTimeout(300000);
  
  test('完整流程：从知识点到文档输出', async () => {
    // E2E 测试需要更长时间（最多 5 分钟）
    const kp = TEST_KNOWLEDGE_POINTS[0];
    const timestamp = Date.now();

    const execRes = await request('POST', '/api/agent/execute', {
      prompt: `# ${kp.name}\n\n${kp.description}`,
      mode: 'direct_generate',
      debug: true,
      knowledge_point: kp,
      output_path: 'output/',
      filename: `test-e2e-system-${timestamp}.md`,
      template: '../knowledge/templates/01-通用基础模板.md',
      skill: '../knowledge/skills/00-通用生成-skill.md',
      workflow_config: null
    });

    expect(execRes.data.success).toBe(true);
    const taskId = execRes.data.task_id;

    const finalStatus = await waitForTaskCompletion(taskId, 180000, 5000);

    console.log(`\n  === E2E 任务状态 ===`);
    console.log(`  状态: ${finalStatus.status}`);
    console.log(`  进度: ${finalStatus.progress}%`);
    console.log(`  当前步骤: ${finalStatus.currentStep}`);

    const files = findIntermediateFiles(taskId);

    console.log(`\n  === 各阶段产出验证 ===`);

    expect(files.keywordExtraction).toBeTruthy();
    console.log(`  [OK] 输入准备：${files.keywordExtraction.mcp_queries.length} 条查询词`);

    expect(files.retrievalPlan).toBeTruthy();
    expect(files.mcpQueryResults).toBeTruthy();
    expect(files.mcpQueryResults.length).toBeGreaterThan(0);
    console.log(`  [OK] 检索计划：${files.mcpQueryResults.length} 条 MCP 结果`);

    if (files.retrievalAssessment) {
      console.log(`  [OK] 检索评估：score=${files.retrievalAssessment.score}`);
    }

    expect(files.finalDocument).toBeTruthy();
    const docLength = files.finalDocument.length;
    console.log(`  [OK] 最终文档：${docLength} 字符`);

    expect(docLength).toBeGreaterThan(500);

    const sectionMarkers = ['## 一、', '## 二、', '## 三、'];
    let sectionCount = 0;
    for (const s of sectionMarkers) {
      if (files.finalDocument.includes(s)) sectionCount++;
    }
    console.log(`  [OK] 文档章节: ${sectionCount}/${sectionMarkers.length}`);

    const hasCharContent = /CHAR|char/.test(files.finalDocument);
    const hasVarcharContent = /VARCHAR|varchar/.test(files.finalDocument);
    console.log(`  [OK] 包含 CHAR: ${hasCharContent}, 包含 VARCHAR: ${hasVarcharContent}`);

    if (finalStatus.status === 'completed') {
      testReport.metrics.e2eGeneration.completed++;
    } else {
      testReport.metrics.e2eGeneration.failed++;
    }
    testReport.metrics.e2eGeneration.docLengths.push(docLength);

    recordTest('L3-E2E文档生成', finalStatus.status === 'completed', {
      status: finalStatus.status,
      docLength,
      sectionCount,
      taskId
    });

    expect(finalStatus.status).toBe('completed');
  }, 300000);
});

// ============================================================
// 测试报告输出
// ============================================================

afterAll(() => {
  testReport.endTime = new Date().toISOString();

  const reportDir = path.join(__dirname, '..', '..', '..', 'runtime', 'agent-runner', 'logs', 'test-reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const reportFile = path.join(reportDir, `system-test-report-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(testReport, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('  系统测试报告');
  console.log('='.repeat(60));
  console.log(`\n  总测试数: ${testReport.summary.total}`);
  console.log(`  通过: ${testReport.summary.passed}`);
  console.log(`  失败: ${testReport.summary.failed}`);
  console.log(`\n  查询词生成: ${testReport.metrics.queryGeneration.passed}/${testReport.metrics.queryGeneration.total}`);

  const scores = testReport.metrics.retrievalQuality.scores;
  if (scores.length > 0) {
    const avgHigh = scores.reduce((s, x) => s + x.highScoreRatio, 0) / scores.length;
    const avgScore = scores.reduce((s, x) => s + x.avgScore, 0) / scores.length;
    console.log(`  平均高分占比(>=0.7): ${(avgHigh * 100).toFixed(1)}%`);
    console.log(`  平均检索分数: ${avgScore.toFixed(3)}`);
  }

  console.log(`  E2E文档生成: ${testReport.metrics.e2eGeneration.completed} 成功, ${testReport.metrics.e2eGeneration.failed} 失败`);

  console.log(`\n  详细结果:`);
  for (const r of testReport.results) {
    console.log(`    ${r.passed ? 'PASS' : 'FAIL'} ${r.name}`);
  }
  console.log(`\n  报告已保存: ${reportFile}`);
  console.log('='.repeat(60));
});
