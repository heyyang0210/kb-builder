/**
 * 测试用例：验证生成文档的 YAML 元数据格式
 * 
 * 验证点：
 * 1. YAML 元数据头使用 ```yaml 开始，``` 结束（不是 ---）
 * 2. 资料来源追溯部分正确填充（MCP 查询数量、引用覆盖率等）
 * 3. 文档结构符合模板要求
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'http://localhost:4100';
const TASK_POLL_INTERVAL = 3000;
const TASK_POLL_TIMEOUT = 300000;

// 测试数据
const TEST_DATA = {
  prompt: `你是 YashanDB 知识库文档生成专家。

## 任务
生成知识点文档：**数值类型：NUMBER(p,s) → INTEGER / DECIMAL / NUMERIC 等**

## 要求
1. 使用 Skill：\`../knowledge/skills/06-兼容性差异-skill.md\`
2. 使用模板：\`../knowledge/templates/07-兼容性差异类模板.md\`
3. 遵守引用溯源规则：\`config/shared/traceability-rules.md\`
4. 遵守全局格式规范：\`config/shared/format-rules.md\`

## 知识点信息
- 名称：数值类型：NUMBER(p,s) → INTEGER / DECIMAL / NUMERIC 等
- 分类：兼容性差异
- 目标数据库：Oracle
- 描述：YashanDB Oracle 模式下数值类型的兼容性说明

## 输出要求
- 文档开头必须有独立的 YAML 元数据部分（使用 \`\`\`yaml 代码块）
- YAML 元数据包含：基础信息 + 资料来源追溯
- 资料来源追溯必须根据实际检索结果填充（不能是占位符）
- 正文从 YAML 元数据结束后开始`,
  mode: 'direct_generate',
  debug: true,
  knowledge_point: {
    name: '数值类型：NUMBER(p,s) → INTEGER / DECIMAL / NUMERIC 等',
    type: '兼容性差异',
    description: 'YashanDB Oracle 模式下数值类型的兼容性说明',
    part: '兼容性领域',
    chapter: '01-DDL兼容性',
    target_db: 'Oracle',
    level: 'L2'
  },
  output_path: '../output/兼容性领域/01-DDL兼容性/',
  filename: '数值类型：_NUMBER(p,s)_ → _INTEGER_ _ _DECIMAL_ _ _NUMERIC_ 等.md',
  template: '../knowledge/templates/07-兼容性差异类模板.md',
  skill: '../knowledge/skills/06-兼容性差异-skill.md'
};

async function pollTaskStatus(taskId) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(async () => {
      try {
        const resp = await new Promise((res, rej) => {
          http.get(`${BASE_URL}/api/agent/task/${taskId}`, (r) => {
            let data = '';
            r.on('data', (chunk) => data += chunk);
            r.on('end', () => res(r));
          }).on('error', rej);
        });
        
        const result = await new Promise((res, rej) => {
          let data = '';
          resp.on('data', (chunk) => data += chunk);
          resp.on('end', () => res(JSON.parse(data)));
        });
        
        if (result.success) {
          const task = result.task;
          console.log(`  [${new Date().toLocaleTimeString()}] 状态：${task.status} | 进度：${task.progress}% | 步骤：${task.current_step}`);
          
          if (task.status === 'completed') {
            clearInterval(interval);
            resolve(task);
          } else if (task.status === 'failed') {
            clearInterval(interval);
            reject(new Error(`Task failed: ${task.error}`));
          }
        }
      } catch (err) {
        // Ignore poll errors
      }
      
      if (Date.now() - startTime > TASK_POLL_TIMEOUT) {
        clearInterval(interval);
        reject(new Error('Task poll timeout'));
      }
    }, TASK_POLL_INTERVAL);
  });
}

async function runTest() {
  console.log('============================================================');
  console.log('测试用例：YAML 元数据格式验证');
  console.log('============================================================\n');
  
  // 步骤 1：调用后端 API
  console.log('步骤 1：调用后端 API 生成文档\n');
  
  const executeResp = await new Promise((resolve, reject) => {
    const data = JSON.stringify(TEST_DATA);
    const options = {
      hostname: 'localhost',
      port: 4100,
      path: '/api/agent/execute',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  
  if (!executeResp.success) {
    console.error('执行失败:', executeResp.error);
    process.exit(1);
  }
  
  const taskId = executeResp.task_id;
  console.log(`  任务 ID：${taskId}\n`);
  
  // 步骤 2：轮询任务状态
  console.log('步骤 2：等待任务完成\n');
  
  try {
    const task = await pollTaskStatus(taskId);
    console.log('\n  ✅ 任务完成\n');
    
    // 步骤 3：验证生成的文档
    console.log('步骤 3：验证生成的文档格式\n');
    
    const outputPath = path.join(__dirname, '..', '..', 'agent-runner', TEST_DATA.output_path, TEST_DATA.filename);
    const content = await fs.readFile(outputPath, 'utf-8');
    
    console.log(`  文档路径：${outputPath}`);
    console.log(`  文档长度：${content.length} 字符\n`);
    
    // 验证点 1：YAML 元数据格式
    console.log('验证点 1：YAML 元数据格式');
    
    const yamlStartRegex = /^```yaml\s*\n/;
    const yamlEndRegex = /\n```\s*\n---/;
    
    const hasYamlStart = yamlStartRegex.test(content);
    const hasYamlEnd = yamlEndRegex.test(content);
    
    console.log(`  ${hasYamlStart ? '✅' : '❌'} YAML 开始标记：\`\`\`yaml`);
    console.log(`  ${hasYamlEnd ? '✅' : ''} YAML 结束标记：\`\`\` + ---`);
    
    if (!hasYamlStart || !hasYamlEnd) {
      console.log('\n  ⚠️ YAML 元数据格式不正确');
      console.log('  期望格式：');
      console.log('  ```yaml');
      console.log('  # 基础信息');
      console.log('  ...');
      console.log('  # 资料来源追溯');
      console.log('  ...');
      console.log('  ```');
      console.log('  ---');
      console.log('  ');
      console.log('  ## 一、适用范围与编写目的');
    }
    
    // 验证点 2：资料来源追溯内容
    console.log('\n验证点 2：资料来源追溯内容');
    
    const hasSourceTracing = content.includes('资料来源追溯:');
    const hasMcpSource = content.includes('YashanDB 知识库 MCP');
    const hasCoverageAnalysis = content.includes('引用覆盖率分析:');
    const hasScoreDetails = content.includes('评分明细:');
    const hasTrustLevel = content.includes('可信度等级：');
    
    console.log(`  ${hasSourceTracing ? '✅' : '❌'} 包含资料来源追溯部分`);
    console.log(`  ${hasMcpSource ? '✅' : ''} 包含 MCP 来源`);
    console.log(`  ${hasCoverageAnalysis ? '✅' : '❌'} 包含引用覆盖率分析`);
    console.log(`  ${hasScoreDetails ? '✅' : '❌'} 包含评分明细`);
    console.log(`  ${hasTrustLevel ? '✅' : '❌'} 包含可信度等级`);
    
    // 验证点 3：资料来源追溯数据正确性
    console.log('\n验证点 3：资料来源追溯数据正确性');
    
    const mcpCountMatch = content.match(/引用文档数量：(\d+)/);
    const coverageMatch = content.match(/引用覆盖率：(\d+)%/);
    const totalScoreMatch = content.match(/综合评分：(\d+)\/100/);
    
    if (mcpCountMatch) {
      const mcpCount = parseInt(mcpCountMatch[1]);
      console.log(`  引用文档数量：${mcpCount} ${mcpCount > 0 ? '✅' : ' (应该 > 0)'}`);
    }
    
    if (coverageMatch) {
      const coverage = parseInt(coverageMatch[1]);
      console.log(`  引用覆盖率：${coverage}% ${coverage > 0 ? '✅' : '❌ (应该 > 0)'}`);
    }
    
    if (totalScoreMatch) {
      const totalScore = parseInt(totalScoreMatch[1]);
      console.log(`  综合评分：${totalScore}/100 ${totalScore > 50 ? '✅' : '⚠️ (偏低)'}`);
    }
    
    // 验证点 4：文档结构
    console.log('\n验证点 4：文档结构');
    
    const hasSection1 = content.includes('## 一、适用范围与编写目的');
    const hasSection2 = content.includes('## 二、特性功能介绍');
    const hasSection3 = content.includes('## 三、差异对比总览');
    const hasSqlExamples = content.includes('```sql');
    const hasChecklist = content.includes('检查清单');
    
    console.log(`  ${hasSection1 ? '✅' : '❌'} 包含"一、适用范围与编写目的"`);
    console.log(`  ${hasSection2 ? '✅' : '❌'} 包含"二、特性功能介绍"`);
    console.log(`  ${hasSection3 ? '✅' : '❌'} 包含"三、差异对比总览"`);
    console.log(`  ${hasSqlExamples ? '✅' : ''} 包含 SQL 示例`);
    console.log(`  ${hasChecklist ? '✅' : '❌'} 包含检查清单`);
    
    // 总结
    console.log('\n============================================================');
    console.log('测试总结');
    console.log('============================================================\n');
    
    const allPassed = hasYamlStart && hasYamlEnd && hasSourceTracing && 
                      hasMcpSource && hasCoverageAnalysis && hasScoreDetails && 
                      hasTrustLevel && mcpCountMatch && parseInt(mcpCountMatch[1]) > 0;
    
    if (allPassed) {
      console.log('  ✅ 所有验证点通过');
    } else {
      console.log('  ⚠️ 部分验证点未通过，需要修复');
    }
    
  } catch (err) {
    console.error('\n  ❌ 测试失败:', err.message);
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
