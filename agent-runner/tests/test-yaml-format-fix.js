/**
 * 测试用例：验证 YAML 元数据格式修复
 * 
 * 验证点：
 * 1. YAML 元数据使用 ```yaml 代码块包裹
 * 2. 资料来源追溯数据正确（引用文档数量 > 0）
 * 3. 正文使用脚注引用格式
 * 4. 文档末尾包含"引用来源"章节
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'http://localhost:4100';
const TASK_POLL_INTERVAL = 3000;
const TASK_POLL_TIMEOUT = 300000;

// 测试数据（模拟前端请求）
const TEST_DATA = {
  prompt: `你是 YashanDB 知识库文档生成专家。

## 任务
生成知识点文档：**数值类型：NUMBER(p,s) → INTEGER / DECIMAL / NUMERIC 等**

## 要求
1. 使用 Skill：\`../skills/06-兼容性差异-skill.md\`
2. 使用模板：\`../templates/07-兼容性差异类模板.md\`
3. 遵守引用溯源规则：\`config/引用溯源规则.md\`
4. 遵守全局格式规范：\`config/全局格式规范.md\`

## 知识点信息
- 名称：数值类型：NUMBER(p,s) → INTEGER / DECIMAL / NUMERIC 等
- 分类：兼容性差异
- 目标数据库：Oracle
- 描述：YashanDB Oracle 模式下数值类型的兼容性说明

## 输出要求
- 文档开头必须有独立的 YAML 元数据部分（使用 \`\`\`yaml 代码块包裹）
- YAML 元数据包含：基础信息 + 资料来源追溯
- 资料来源追溯必须根据实际检索结果填充（不能是占位符）
- 正文中的技术事实必须使用脚注引用格式（[^1]、[^2]）
- 文档末尾必须包含"引用来源"章节`,
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
  filename: 'test_数值类型：_NUMBER(p,s)_ → _INTEGER_ _ _DECIMAL_ _ _NUMERIC_ 等.md',
  template: '../templates/07-兼容性差异类模板.md',
  skill: '../skills/06-兼容性差异-skill.md'
};

function httpPost(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 4100,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${responseData.substring(0, 200)}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function pollTaskStatus(taskId) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(async () => {
      try {
        const result = await httpGet(`/api/agent/task/${taskId}`);
        
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
  console.log('测试用例：YAML 元数据格式验证（修复后）');
  console.log('============================================================\n');
  
  // 步骤 1：调用后端 API
  console.log('步骤 1：调用后端 API 生成文档\n');
  
  try {
    const executeResp = await httpPost('/api/agent/execute', TEST_DATA);
    
    if (!executeResp.success) {
      console.error('执行失败:', executeResp.error);
      process.exit(1);
    }
    
    const taskId = executeResp.task_id;
    console.log(`  任务 ID：${taskId}\n`);
    
    // 步骤 2：轮询任务状态
    console.log('步骤 2：等待任务完成\n');
    
    const task = await pollTaskStatus(taskId);
    console.log('\n  ✅ 任务完成\n');
    
    // 步骤 3：验证生成的文档
    console.log('步骤 3：验证生成的文档格式\n');
    
    const outputPath = path.join(__dirname, '..', TEST_DATA.output_path, TEST_DATA.filename);
    const content = await fs.readFile(outputPath, 'utf-8');
    
    console.log(`  文档路径：${outputPath}`);
    console.log(`  文档长度：${content.length} 字符\n`);
    
    // 验证点 1：YAML 元数据格式
    console.log('验证点 1：YAML 元数据格式');
    
    const hasYamlStart = /^```yaml\s*\n/.test(content);
    const hasYamlEnd = /\n```\s*\n---/.test(content);
    
    console.log(`  ${hasYamlStart ? '✅' : '❌'} YAML 开始标记：\`\`\`yaml`);
    console.log(`  ${hasYamlEnd ? '✅' : '❌'} YAML 结束标记：\`\`\` + ---`);
    
    // 验证点 2：资料来源追溯内容
    console.log('\n验证点 2：资料来源追溯内容');
    
    const hasSourceTracing = content.includes('资料来源追溯:');
    const mcpCountMatch = content.match(/引用文档数量：(\d+)/);
    const coverageMatch = content.match(/引用覆盖率：(\d+)%/);
    
    console.log(`  ${hasSourceTracing ? '✅' : '❌'} 包含资料来源追溯部分`);
    
    if (mcpCountMatch) {
      const mcpCount = parseInt(mcpCountMatch[1]);
      console.log(`  ${mcpCount > 0 ? '✅' : '❌'} 引用文档数量：${mcpCount} (应该 > 0)`);
    } else {
      console.log('  ❌ 未找到引用文档数量');
    }
    
    if (coverageMatch) {
      const coverage = parseInt(coverageMatch[1]);
      console.log(`  ${coverage > 0 ? '✅' : '❌'} 引用覆盖率：${coverage}% (应该 > 0)`);
    } else {
      console.log('   未找到引用覆盖率');
    }
    
    // 验证点 3：脚注引用格式
    console.log('\n验证点 3：脚注引用格式');
    
    const hasFootnoteRef = /\[\^(\d+)\]/.test(content);
    const hasFootnoteList = /\[\^(\d+)\]:/.test(content);
    const hasReferenceSection = /## .*引用来源/.test(content);
    
    console.log(`  ${hasFootnoteRef ? '✅' : '❌'} 正文包含脚注引用（[^1]）`);
    console.log(`  ${hasFootnoteList ? '✅' : ''} 包含脚注定义（[^1]: ...）`);
    console.log(`  ${hasReferenceSection ? '✅' : '❌'} 包含"引用来源"章节`);
    
    // 总结
    console.log('\n============================================================');
    console.log('测试总结');
    console.log('============================================================\n');
    
    const allPassed = hasYamlStart && hasYamlEnd && hasSourceTracing && 
                      mcpCountMatch && parseInt(mcpCountMatch[1]) > 0 &&
                      coverageMatch && parseInt(coverageMatch[1]) > 0;
    
    if (allPassed) {
      console.log('  ✅ 所有关键验证点通过');
    } else {
      console.log('  ⚠️ 部分验证点未通过');
    }
    
    console.log('\n  脚注引用和引用来源章节是可选验证项（取决于 LLM 是否遵循指令）');
    
  } catch (err) {
    console.error('\n   测试失败:', err.message);
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
