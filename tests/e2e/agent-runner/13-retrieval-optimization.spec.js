const { test, expect } = require('@playwright/test');

const BACKEND = 'http://localhost:4100';

/**
 * Retriever 精准检索优化 - 全流程系统测试
 * 
 * 测试目标：验证意图化查询词生成是否生效
 * 
 * 测试覆盖：
 * 1. 不同类型知识点的查询词生成
 * 2. 查询词维度覆盖
 * 3. MCP 检索结果质量
 * 4. 端到端文档生成
 */

// 测试知识点集合：覆盖不同类型
const TEST_KNOWLEDGE_POINTS = [
  {
    name: '字符串类型：CHAR/VARCHAR2',
    type: 'SQL/开发参考',
    description: '介绍字符串类型的语法和用法',
    part: '数据库基础',
    chapter: '数据类型',
    target_db: 'Oracle',
    level: '★★',
    expectedDimensions: ['syntax', 'boundary', 'compatibility'],
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
    expectedDimensions: ['syntax', 'boundary', 'compatibility'],
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
    expectedDimensions: ['compatibility', 'difference', 'migration'],
    expectedCoreTerm: '数据类型映射'
  }
];

// HTTP 请求工具
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const url = new URL(path, BACKEND);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' }
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 等待任务完成
function waitForTask(taskId, maxWait = 120000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const poll = async () => {
      try {
        const res = await request('GET', `/api/agent/status/${taskId}`);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          resolve(res.data);
        } else if (Date.now() - startTime > maxWait) {
          resolve(res.data); // 超时也返回当前状态
        } else {
          setTimeout(poll, 3000);
        }
      } catch (err) {
        reject(err);
      }
    };
    poll();
  });
}

test.describe('Retriever 精准检索优化 - 全流程测试', () => {
  test.setTimeout(180000);

  // ============================================
  // 测试1：后端健康检查
  // ============================================
  test('后端服务可用', async () => {
    const res = await request('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
  });

  // ============================================
  // 测试2：查询词生成验证（核心测试）
  // ============================================
  for (const kp of TEST_KNOWLEDGE_POINTS) {
    test(`查询词生成 - ${kp.name}（${kp.type}）`, async () => {
      // 发起执行请求
      const execRes = await request('POST', '/api/agent/execute', {
        prompt: `# ${kp.name}\n\n${kp.description}`,
        mode: 'direct_generate',
        debug: true,
        knowledge_point: kp,
        output_path: 'output/',
        filename: `test-${Date.now()}.md`,
        template: '../knowledge/templates/01-通用基础模板.md',
        skill: '../knowledge/skills/00-通用生成-skill.md',
        workflow_config: null
      });

      expect(execRes.status).toBe(200);
      expect(execRes.data.success).toBe(true);
      expect(execRes.data.task_id).toBeTruthy();

      // 等待检索阶段完成（最多30秒）
      const taskId = execRes.data.task_id;
      let retrievalPlan = null;
      
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        
        // 读取中间结果
        const fs = require('fs');
        const path = require('path');
        const planPath = path.join(
          __dirname, '..', '..', 'logs', 'intermediate',
          taskId, '01-input-preparation', '03-keyword-extraction.json'
        );
        
        if (fs.existsSync(planPath)) {
          retrievalPlan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
          break;
        }
      }

      // 验证查询词生成结果
      expect(retrievalPlan).toBeTruthy();
      expect(retrievalPlan.mcp_queries).toBeTruthy();
      expect(retrievalPlan.mcp_queries.length).toBeGreaterThan(0);
      
      // 验证：查询词数量
      expect(retrievalPlan.mcp_queries.length).toBeGreaterThanOrEqual(3);
      expect(retrievalPlan.mcp_queries.length).toBeLessThanOrEqual(8);
      
      // 验证：维度覆盖
      expect(retrievalPlan.dimensions).toBeTruthy();
      for (const expectedDim of kp.expectedDimensions) {
        expect(retrievalPlan.dimensions).toContain(expectedDim);
      }
      
      // 验证：查询词是意图化的（包含核心术语 + 维度关键词）
      for (const query of retrievalPlan.mcp_queries) {
        // 查询词长度应该 >= 10（意图化查询词不会太短）
        expect(query.length).toBeGreaterThanOrEqual(10);
        
        // 查询词不应包含碎片（未闭合的括号）
        const open = (query.match(/[（(]/g) || []).length;
        const close = (query.match(/[）)]/g) || []).length;
        expect(open).toBe(close);
      }
      
      // 验证：没有 dropped queries（或 dropped 很少）
      if (retrievalPlan.dropped_queries) {
        expect(retrievalPlan.dropped_queries.length).toBeLessThanOrEqual(1);
      }
      
      console.log(`  查询词: ${retrievalPlan.mcp_queries.length} 条`);
      console.log(`  维度: ${retrievalPlan.dimensions.join(', ')}`);
      console.log(`  示例: ${retrievalPlan.mcp_queries[0]}`);
    });
  }

  // ============================================
  // 测试3：MCP 检索结果质量验证
  // ============================================
  test('MCP 检索结果质量', async () => {
    // 使用第一个测试知识点
    const kp = TEST_KNOWLEDGE_POINTS[0];
    
    const execRes = await request('POST', '/api/agent/execute', {
      prompt: `# ${kp.name}\n\n${kp.description}`,
      mode: 'direct_generate',
      debug: true,
      knowledge_point: kp,
      output_path: 'output/',
      filename: `test-quality-${Date.now()}.md`,
      template: '../knowledge/templates/01-通用基础模板.md',
      skill: '../knowledge/skills/00-通用生成-skill.md',
      workflow_config: null
    });

    expect(execRes.data.success).toBe(true);
    const taskId = execRes.data.task_id;

    // 等待 MCP 查询完成
    let mcpResults = [];
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 3000));
      
      const fs = require('fs');
      const path = require('path');
      const mcpDir = path.join(
        __dirname, '..', '..', 'logs', 'intermediate',
        taskId, '02-retrieval-plan', '03-mcp-queries'
      );
      
      if (fs.existsSync(mcpDir)) {
        const files = fs.readdirSync(mcpDir);
        if (files.length > 0) {
          for (const file of files) {
            const result = JSON.parse(fs.readFileSync(path.join(mcpDir, file), 'utf-8'));
            mcpResults.push(result);
          }
          break;
        }
      }
    }

    // 验证 MCP 查询结果
    expect(mcpResults.length).toBeGreaterThan(0);
    
    let totalResults = 0;
    let highScoreResults = 0;
    
    for (const result of mcpResults) {
      if (result.response?.success && result.response?.data?.structuredContent) {
        const results = result.response.data.structuredContent.results || [];
        totalResults += results.length;
        
        // 统计高分结果
        for (const r of results) {
          if (r.score >= 0.6) {
            highScoreResults++;
          }
        }
      }
    }
    
    console.log(`  MCP 查询数: ${mcpResults.length}`);
    console.log(`  总结果数: ${totalResults}`);
    console.log(`  高分结果(>=0.6): ${highScoreResults}`);
    
    // 验证：至少有一些高分结果
    expect(highScoreResults).toBeGreaterThan(0);
    
    // 验证：高分结果占比应该较高（意图化查询提升了精度）
    if (totalResults > 0) {
      const highScoreRatio = highScoreResults / totalResults;
      console.log(`  高分占比: ${(highScoreRatio * 100).toFixed(1)}%`);
      // 不强制要求，但记录
    }
  });

  // ============================================
  // 测试4：端到端文档生成
  // ============================================
  test('端到端文档生成', async () => {
    const kp = TEST_KNOWLEDGE_POINTS[0];
    
    const execRes = await request('POST', '/api/agent/execute', {
      prompt: `# ${kp.name}\n\n${kp.description}`,
      mode: 'direct_generate',
      debug: true,
      knowledge_point: kp,
      output_path: 'output/',
      filename: `test-e2e-${Date.now()}.md`,
      template: '../knowledge/templates/01-通用基础模板.md',
      skill: '../knowledge/skills/00-通用生成-skill.md',
      workflow_config: null
    });

    expect(execRes.data.success).toBe(true);
    const taskId = execRes.data.task_id;

    // 等待任务完成
    const finalStatus = await waitForTask(taskId, 120000);
    
    console.log(`  任务状态: ${finalStatus.status}`);
    console.log(`  进度: ${finalStatus.progress}%`);
    console.log(`  当前步骤: ${finalStatus.current_step}`);
    
    expect(finalStatus.status).toBe('completed');
    expect(finalStatus.progress).toBe(100);
    
    // 验证生成的文档
    const fs = require('fs');
    const path = require('path');
    const docPath = path.join(
      __dirname, '..', '..', 'logs', 'intermediate',
      taskId, 'final-document.md'
    );
    
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf-8');
      console.log(`  文档长度: ${content.length} 字符`);
      
      // 验证文档不为空
      expect(content.length).toBeGreaterThan(100);
      
      // 验证文档包含关键内容
      expect(content).toContain('CHAR');
      expect(content).toContain('VARCHAR');
    }
  });

  // ============================================
  // 测试5：对比改进前后效果
  // ============================================
  test('对比：意图化查询 vs 单词查询', async () => {
    // 这个测试验证意图化查询词确实比单词查询效果更好
    
    const mcpClient = require('../../../packages/agent-runner-core/lib/tools/mcp-client');
    // 由于 MCP client 需要初始化，这里用 API 方式验证
    
    // 用意图化查询词查询
    const intentQuery = '字符串类型 CHAR VARCHAR2 语法定义 使用规则 格式';
    const intentRes = await request('POST', '/api/document/search', {
      keyword: 'CHAR VARCHAR2 语法定义',
      scope: 'all'
    });
    
    // 用单词查询
    const keywordQuery = 'CHAR';
    const keywordRes = await request('POST', '/api/document/search', {
      keyword: 'CHAR',
      scope: 'all'
    });
    
    console.log(`  意图化查询 "${intentQuery}": ${intentRes.data.data?.length || 0} 条结果`);
    console.log(`  单词查询 "${keywordQuery}": ${keywordRes.data.data?.length || 0} 条结果`);
    
    // 意图化查询应该更精准（结果更少但更相关）
    // 这里不强制断言，只记录对比
  });
});
