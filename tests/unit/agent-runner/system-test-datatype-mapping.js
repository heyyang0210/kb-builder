/**
 * 系统测试用例：兼容性领域 > DDL兼容性 > 1.1 数据类型映射
 * 
 * 测试目标：通过 Agent 执行完整流程，生成数据类型映射文档
 * 测试步骤：
 *   1. 验证后端服务可用
 *   2. 验证 MCP 连接正常
 *   3. 提交 Agent 执行请求
 *   4. 轮询执行进度
 *   5. 验证生成结果
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 4100;
const BACKEND_BASE = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

// 测试知识点：兼容性领域 > DDL兼容性 > 1.1 数据类型映射
const TEST_CASE = {
  name: '系统测试-数据类型映射',
  knowledge_point: {
    name: '数据类型映射',
    type: '兼容性差异',
    description: 'Oracle 数据类型（CHAR/VARCHAR2/NCHAR/NVARCHAR2/NUMBER/DATE/TIMESTAMP/CLOB/BLOB/BOOLEAN 等）到目标数据库（MySQL/PostgreSQL）的等价类型映射规则，包括长度语义、精度转换等差异',
    part: '兼容性领域',
    chapter: 'DDL 兼容性',
    target_db: 'MySQL',
    level: '⭐'
  },
  // 模拟前端生成的提示词
  prompt: `# 角色
你是一位资深数据库专家，精通 Oracle 和 MySQL 的语法差异与最佳实践。

# 任务
根据以下知识点信息，生成一份详细的技术文档。

# 知识点信息
- 知识点名称：数据类型映射
- 所属领域：兼容性领域
- 所属章节：DDL 兼容性
- 知识点类型：兼容性差异
- 目标数据库：MySQL
- 难度等级：⭐

# 知识点内容
字符串类型：CHAR / VARCHAR2 / NCHAR / NVARCHAR2 → 目标库等价类型（含长度语义 byte/char）
数值类型：NUMBER(p,s) → INTEGER / DECIMAL / NUMERIC 等
日期时间：DATE（含时间） → TIMESTAMP / DATETIME；TIMESTAMP WITH TIME ZONE 等
大对象：CLOB / BLOB / NCLOB → 对应类型
布尔类型：BOOLEAN（PL/SQL 中）→ 目标库模拟（TINYINT、BOOLEAN 支持情况）

# 要求
1. 使用 Markdown 格式
2. 包含类型映射对照表
3. 包含转换示例 SQL
4. 标注注意事项和常见陷阱
5. 文档长度 1500-3000 字`,
  output_path: path.join('tmp', 'system-test-output'),
  filename: '数据类型映射.md'
};

function httpRequest(method, urlPath, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      family: 4,
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: urlPath,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const results = [];
  let passed = 0;
  let failed = 0;

  function log(step, status, message) {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
    console.log(`${icon} [${step}] ${message}`);
    results.push({ step, status, message });
    if (status === 'PASS') passed++;
    if (status === 'FAIL') failed++;
  }

  console.log('='.repeat(60));
  console.log('系统测试：兼容性领域 > DDL兼容性 > 1.1 数据类型映射');
  console.log('='.repeat(60));
  console.log();

  // Step 1: 验证后端服务
  console.log('--- Step 1: 验证后端服务 ---');
  try {
    const health = await httpRequest('GET', '/api/health');
    if (health.status === 200 && health.data.status === 'ok') {
      log('1.1 后端健康检查', 'PASS', `服务运行正常 (v${health.data.version})`);
    } else {
      log('1.1 后端健康检查', 'FAIL', `异常响应: ${JSON.stringify(health.data)}`);
    }
  } catch (err) {
    log('1.1 后端健康检查', 'FAIL', `连接失败: ${err.message}`);
    console.log('\n❌ 后端服务不可用，测试终止');
    process.exit(1);
  }

  // Step 2: 验证模型配置
  console.log('\n--- Step 2: 验证模型配置 ---');
  try {
    const config = await httpRequest('GET', '/api/config/model');
    if (config.status === 200) {
      const hasKey = config.data.api_key_configured || config.data.api_key;
      log('2.1 模型配置', hasKey ? 'PASS' : 'FAIL', 
        `Provider: ${config.data.provider}, Model: ${config.data.model}, API Key: ${hasKey ? '已配置' : '未配置'}`);
    } else {
      log('2.1 模型配置', 'FAIL', `获取失败: HTTP ${config.status}`);
    }
  } catch (err) {
    log('2.1 模型配置', 'FAIL', `请求失败: ${err.message}`);
  }

  // Step 3: 验证 MCP 连接
  console.log('\n--- Step 3: 验证 MCP 连接 ---');
  try {
    const mcp = await httpRequest('POST', '/api/config/test-mcp');
    if (mcp.data.success) {
      log('3.1 MCP 连接', 'PASS', `${mcp.data.message} (工具: ${mcp.data.tools?.join(', ') || '无'})`);
    } else {
      log('3.1 MCP 连接', 'FAIL', mcp.data.message);
    }
  } catch (err) {
    log('3.1 MCP 连接', 'FAIL', `请求失败: ${err.message}`);
  }

  // Step 4: 提交 Agent 执行请求
  console.log('\n--- Step 4: 提交 Agent 执行请求 ---');
  let taskId = null;
  try {
    // 确保输出目录存在
    const outputDir = TEST_CASE.output_path;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const execReq = {
      prompt: TEST_CASE.prompt,
      knowledge_point: TEST_CASE.knowledge_point,
      output_path: TEST_CASE.output_path,
      filename: TEST_CASE.filename
    };

    console.log(`  提示词长度: ${TEST_CASE.prompt.length} 字符`);
    console.log(`  知识点: ${TEST_CASE.knowledge_point.name}`);
    console.log(`  目标数据库: ${TEST_CASE.knowledge_point.target_db}`);

    const execResp = await httpRequest('POST', '/api/agent/execute', execReq);
    
    if (execResp.data.success) {
      taskId = execResp.data.task_id;
      log('4.1 提交执行', 'PASS', `任务已创建: ${taskId}`);
    } else {
      log('4.1 提交执行', 'FAIL', `执行失败: ${JSON.stringify(execResp.data.error)}`);
    }
  } catch (err) {
    log('4.1 提交执行', 'FAIL', `请求失败: ${err.message}`);
  }

  // Step 5: 轮询执行进度
  if (taskId) {
    console.log('\n--- Step 5: 监控执行进度 ---');
    const maxWait = 180000; // 3 分钟超时
    const pollInterval = 3000; // 3 秒轮询
    const startTime = Date.now();
    let lastStatus = '';
    let finalResult = null;

    while (Date.now() - startTime < maxWait) {
      try {
        const status = await httpRequest('GET', `/api/agent/status/${taskId}`);
        const data = status.data;

        if (data.status !== lastStatus) {
          lastStatus = data.status;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  [${elapsed}s] 状态: ${data.status}`);
          
          if (data.current_step) {
            console.log(`         当前步骤: ${data.current_step}`);
          }
        }

        if (data.status === 'completed') {
          finalResult = data;
          log('5.1 执行完成', 'PASS', `任务完成，耗时 ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          break;
        } else if (data.status === 'failed') {
          log('5.1 执行完成', 'FAIL', `任务失败: ${data.error || '未知错误'}`);
          break;
        } else if (data.status === 'cancelled') {
          log('5.1 执行完成', 'FAIL', '任务被取消');
          break;
        }
      } catch (err) {
        console.log(`  轮询失败: ${err.message}`);
      }

      await sleep(pollInterval);
    }

    if (!finalResult && Date.now() - startTime >= maxWait) {
      log('5.1 执行完成', 'FAIL', '执行超时（超过 3 分钟）');
    }

    // Step 6: 验证生成结果
    if (finalResult) {
      console.log('\n--- Step 6: 验证生成结果 ---');
      
      const outputPath = path.join(TEST_CASE.output_path, TEST_CASE.filename);
      if (fs.existsSync(outputPath)) {
        const content = fs.readFileSync(outputPath, 'utf-8');
        const fileSize = content.length;
        
        log('6.1 文件生成', 'PASS', `文件已生成: ${outputPath} (${fileSize} 字符)`);

        // 验证内容质量
        const checks = [
          { name: '包含 Markdown 标题', test: /#{1,3}\s/.test(content) },
          { name: '包含类型映射表', test: /\|.*\|.*\|/.test(content) || /类型.*映射|映射.*表/.test(content) },
          { name: '包含 SQL 示例', test: /CREATE\s+TABLE|VARCHAR|CHAR|NUMBER|DECIMAL/i.test(content) },
          { name: '包含 Oracle 类型', test: /VARCHAR2|NUMBER|CLOB|BLOB/i.test(content) },
          { name: '包含 MySQL 类型', test: /VARCHAR|INT|DECIMAL|DATETIME|TEXT|BLOB/i.test(content) },
          { name: '内容长度合理', test: fileSize > 500 }
        ];

        checks.forEach(check => {
          log(`6.2 ${check.name}`, check.test ? 'PASS' : 'FAIL', 
            check.test ? '检查通过' : '检查未通过');
        });

        // 输出文档预览
        console.log('\n--- 文档预览（前 500 字符）---');
        console.log(content.substring(0, 500));
        console.log('...');
      } else {
        log('6.1 文件生成', 'FAIL', `文件未生成: ${outputPath}`);
      }
    }
  }

  // 测试报告
  console.log('\n' + '='.repeat(60));
  console.log('测试报告');
  console.log('='.repeat(60));
  console.log(`总计: ${results.length} 项`);
  console.log(`通过: ${passed} 项 ✅`);
  console.log(`失败: ${failed} 项 ❌`);
  console.log(`通过率: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log();

  if (failed > 0) {
    console.log('失败项:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ [${r.step}] ${r.message}`);
    });
  }

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error('测试执行异常:', err);
  process.exit(1);
});
