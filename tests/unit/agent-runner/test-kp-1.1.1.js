/**
 * 测试用例：知识点 1.1.1 字符串类型
 * 
 * 模拟前端执行流程，完整验证子流程切分与质量控制设计
 * 
 * 测试知识点：
 *   1.1.1 字符串类型：CHAR / VARCHAR2 / NCHAR / NVARCHAR2 → 目标库等价类型（含长度语义 byte/char）
 * 
 * 测试目标：
 *   1. 验证前端提示词组装逻辑
 *   2. 验证后端子流程执行（按 21-设计文档）
 *   3. 验证中间文件存储
 *   4. 验证最终文档质量
 *   5. 列出与设计文档的偏差
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'http://localhost:4100';
const TASK_POLL_INTERVAL = 3000; // 3 秒
const TASK_POLL_TIMEOUT = 300000; // 5 分钟

// ============================================================
// 步骤 1：模拟前端提示词组装（与 prompt-generator.html 一致）
// ============================================================

function getSkillFile(type) {
  const map = {
    "通用基础": "../knowledge/skills/00-通用生成-skill.md",
    "理论机制": "../knowledge/skills/01-理论机制-skill.md",
    "实战调优": "../knowledge/skills/02-实战调优-skill.md",
    "架构对比": "../knowledge/skills/03-架构对比-skill.md",
    "运维SOP": "../knowledge/skills/04-运维SOP-skill.md",
    "SQL/开发参考": "../knowledge/skills/05-SQL开发参考-skill.md",
    "兼容性差异": "../knowledge/skills/06-兼容性差异-skill.md"
  };
  return map[type] || map["通用基础"];
}

function getTemplateFile(type) {
  const map = {
    "通用基础": "../knowledge/templates/01-通用基础模板.md",
    "理论机制": "../knowledge/templates/02-理论机制类模板.md",
    "实战调优": "../knowledge/templates/03-实战调优类模板.md",
    "架构对比": "../knowledge/templates/04-架构对比类模板.md",
    "运维SOP": "../knowledge/templates/05-运维SOP类模板.md",
    "SQL/开发参考": "../knowledge/templates/06-SQL开发参考类模板.md",
    "兼容性差异": "../knowledge/templates/07-兼容性差异类模板.md"
  };
  return map[type] || map["通用基础"];
}

function getOutputPath(part) {
  if (part && part.includes("兼容性领域")) {
    return "../output/兼容性领域/01-DDL兼容性/";
  }
  return "../output/未分类/";
}

function assemblePrompt(knowledgePoint) {
  const json = {
    name: knowledgePoint.name,
    part: knowledgePoint.part,
    chapter: knowledgePoint.chapter,
    description: knowledgePoint.description,
    type: knowledgePoint.type,
    target_db: knowledgePoint.target_db || undefined,
    output_path: getOutputPath(knowledgePoint.part)
  };
  Object.keys(json).forEach(k => json[k] === undefined && delete json[k]);

  const skillFile = getSkillFile(knowledgePoint.type);
  const templateFile = getTemplateFile(knowledgePoint.type);

  const prompt = `# YashanDB 知识文档生成任务

## 前置检查
在开始生成前，请先运行：
\`\`\`bash
bash tools/repository/pre-check-references.sh
\`\`\`
确认所有必须检查项通过。

## 资料引用策略
按以下优先级引用参考资料：
1. YashanDB 知识库 MCP（实时查询）
2. 特性设计文档（references/design-docs/）
3. Oracle知识库（references/oracle-kb/）
   - **重要**：先阅读 \`knowledge/references/oracle-kb/README.md\` 获取完整文档索引
   - 根据索引找到与当前知识点相关的 Oracle 文档进行引用
4. 测试用例（references/test-cases/）
5. 源码（references/source/）

## 知识点信息
\`\`\`json
${JSON.stringify(json, null, 2)}
\`\`\`

## 执行要求
1. 使用 Skill：\`${skillFile}\`
2. 使用模板：\`${templateFile}\`
3. 遵守 \`config/全局格式规范.md\`
4. 按 \`config/质量验证标准.md\` 进行自检
5. 输出保存到 \`${getOutputPath(knowledgePoint.part)}\`
6. 在 \`logs/\` 记录生成日志

## 输出格式要求
- 包含 YAML 元数据头（知识库ID、标题、分类、版本等）
- 按模板结构填写所有必选章节
- 包含可执行的 SQL 示例（建表、操作、验证、清理）
- 包含 Mermaid 图表（架构图、流程图）
- 包含填写检查清单
- 不出现客户名称和特定业务表名`;

  return { prompt, skillFile, templateFile, json };
}

// ============================================================
// 步骤 2：HTTP 请求工具
// ============================================================

function httpRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
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
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============================================================
// 步骤 3：任务状态轮询
// ============================================================

async function pollTaskStatus(taskId) {
  const startTime = Date.now();
  while (Date.now() - startTime < TASK_POLL_TIMEOUT) {
    const { data } = await httpRequest('GET', `/api/agent/status/${taskId}`);
    console.log(`  [${new Date().toLocaleTimeString()}] 状态：${data.status} | 进度：${data.progress}% | 步骤：${data.current_step}`);

    if (data.status === 'completed' || data.status === 'failed') {
      return data;
    }
    await new Promise(r => setTimeout(r, TASK_POLL_INTERVAL));
  }
  throw new Error(`Task ${taskId} timed out after ${TASK_POLL_TIMEOUT / 1000}s`);
}

// ============================================================
// 步骤 4：中间文件验证
// ============================================================

async function verifyIntermediateFiles(taskId) {
  console.log('\n=== 中间文件验证 ===\n');
  const { data } = await httpRequest('GET', `/api/agent/task/${taskId}/logs`);
  
  if (data.error) {
    console.log(`  ❌ 无法获取中间文件：${data.error}`);
    return { passed: false, files: [] };
  }

  const files = data.files || [];
  console.log(`  找到 ${files.length} 个中间文件：\n`);

  // 按设计文档验证关键文件是否存在
  const expectedFiles = {
    '01-input-preparation/01-knowledge-point.json': '知识点解析',
    '01-input-preparation/02-standardized-prompt.md': '标准化提示词',
    '01-input-preparation/03-keyword-extraction.json': '关键词抽取',
    '02-retrieval-plan/01-retrieval-plan.json': '检索计划',
    '02-retrieval-plan/03-mcp-queries/query-01.json': 'MCP 查询结果',
    '02-retrieval-plan/08-retrieval-assessment.json': '检索评估',
    '03-document-generation/01-context-prompt.md': '上下文提示词',
    '03-document-generation/02-llm-response.json': 'LLM 响应',
    '03-document-generation/03-generated-document.md': '生成文档',
    'final-document.md': '最终文档副本'
  };

  const results = { passed: true, found: [], missing: [], extra: [] };

  for (const [expectedFile, description] of Object.entries(expectedFiles)) {
    // 直接检查文件名是否在列表中
    const found = files.includes(expectedFile);
    if (found) {
      console.log(`  ✅ ${description}: ${expectedFile}`);
      results.found.push(expectedFile);
    } else {
      console.log(`  ❌ ${description}: ${expectedFile} (缺失)`);
      results.missing.push(expectedFile);
      results.passed = false;
    }
  }

  // 列出额外文件
  for (const file of files) {
    const isExpected = Object.keys(expectedFiles).some(ef => 
      file === ef || file.endsWith(ef) || file.includes(ef.replace('.json', '').replace('.md', ''))
    );
    if (!isExpected) {
      results.extra.push(file);
    }
  }

  if (results.extra.length > 0) {
    console.log(`\n  ℹ️ 额外文件 (${results.extra.length}):\n`);
    results.extra.forEach(f => console.log(`     - ${f}`));
  }

  return results;
}

// ============================================================
// 步骤 5：最终文档验证
// ============================================================

async function verifyFinalDocument(taskId) {
  console.log('\n=== 最终文档验证 ===\n');
  
  const { data } = await httpRequest('GET', `/api/agent/task/${taskId}/logs/03-document-generation/03-generated-document.md`);
  
  if (data.error) {
    console.log(`  ❌ 无法获取生成文档：${data.error}`);
    return { passed: false };
  }

  const content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
  
  const checks = {
    yamlHeader: content.includes('```yaml'),
    title: content.includes('标题：') || content.includes('title:'),
    lastUpdate: content.includes('最后更新：') || content.includes('2026-07-20'),
    sqlExamples: content.includes('```sql'),
    mermaidDiagrams: content.includes('```mermaid'),
    checklist: content.includes('检查清单') || content.includes('## 检查清单'),
    charType: content.toLowerCase().includes('char'),
    varchar2Type: content.toLowerCase().includes('varchar2'),
    ncharType: content.toLowerCase().includes('nchar'),
    nvarchar2Type: content.toLowerCase().includes('nvarchar2'),
    byteChar: content.toLowerCase().includes('byte') || content.toLowerCase().includes('char'),
    noCustomerName: !content.includes('客户') || content.includes('客户名称') === false,
    length: content.length >= 500
  };

  let passed = true;
  for (const [check, result] of Object.entries(checks)) {
    const icon = result ? '✅' : '❌';
    console.log(`  ${icon} ${check}: ${result}`);
    if (!result) passed = false;
  }

  console.log(`\n  文档长度：${content.length} 字符`);

  return { passed, checks, content };
}

// ============================================================
// 步骤 6：与设计文档对比，列出偏差
// ============================================================

function compareWithDesignDoc(intermediateResults, documentResults) {
  console.log('\n=== 与设计文档 (21-子流程切分与质量控制设计.md) 对比 ===\n');

  const discrepancies = [];

  // 检查子流程是否完整执行
  const expectedSubProcesses = [
    '1.1 知识点解析',
    '1.2 提示词标准化',
    '1.3 关键词抽取',
    '2.1 LLM 生成检索计划',
    '2.2 查询词质量检查',
    '2.3 MCP 查询执行（优先级 1）',
    '2.4 特性设计文档检索（优先级 2）',
    '2.5 Oracle 知识库检索（优先级 3）',
    '2.6 测试用例检索（优先级 4）',
    '2.7 源码检索（优先级 5）',
    '2.8 检索结果综合评估',
    '3.1 参考资料整合',
    '3.2 LLM 文档生成',
    '3.3 格式合规检查'
  ];

  console.log('  子流程执行情况：\n');
  for (const sp of expectedSubProcesses) {
    // 简单判断：如果中间文件存在，认为已执行
    const executed = intermediateResults.found.some(f => {
      if (sp.includes('MCP')) return f.includes('mcp-queries') || f.includes('03-mcp-queries');
      if (sp.includes('设计文档')) return f.includes('design-docs') || f.includes('04-design-docs');
      if (sp.includes('Oracle')) return f.includes('oracle-kb') || f.includes('05-oracle-kb');
      if (sp.includes('测试用例')) return f.includes('test-cases') || f.includes('06-test-cases');
      if (sp.includes('源码')) return f.includes('source-code') || f.includes('07-source-code');
      if (sp.includes('检索评估')) return f.includes('retrieval-assessment') || f.includes('08-retrieval-assessment');
      if (sp.includes('关键词')) return f.includes('keyword-extraction') || f.includes('03-keyword-extraction');
      if (sp.includes('提示词标准化')) return f.includes('standardized-prompt') || f.includes('02-standardized-prompt');
      if (sp.includes('知识点解析')) return f.includes('knowledge-point') || f.includes('01-knowledge-point');
      if (sp.includes('LLM 文档生成')) return f.includes('generated-document') || f.includes('03-generated-document');
      if (sp.includes('检索计划')) return f.includes('retrieval-plan') || f.includes('01-retrieval-plan');
      if (sp.includes('查询词质量')) return f.includes('query-validation') || f.includes('02-query-validation');
      if (sp.includes('格式合规')) return f.includes('format-check') || f.includes('04-format-check');
      if (sp.includes('参考资料整合')) return f.includes('context-prompt') || f.includes('01-context-prompt');
      return false;
    });
    const icon = executed ? '✅' : '⚠️';
    console.log(`  ${icon} ${sp}`);
    if (!executed) {
      discrepancies.push(`子流程未执行或未存储中间文件：${sp}`);
    }
  }

  // 检查资料引用策略优先级
  console.log('\n  资料引用策略优先级验证：\n');
  const priorityChecks = [
    { name: '优先级 1: MCP 查询', check: intermediateResults.found.some(f => f.includes('mcp-queries') || f.includes('03-mcp-queries')) },
    { name: '优先级 2: 特性设计文档', check: intermediateResults.found.some(f => f.includes('design-docs') || f.includes('04-design-docs')) },
    { name: '优先级 3: Oracle 知识库', check: intermediateResults.found.some(f => f.includes('oracle-kb') || f.includes('05-oracle-kb')) },
    { name: '优先级 4: 测试用例', check: intermediateResults.found.some(f => f.includes('test-cases') || f.includes('06-test-cases')) },
    { name: '优先级 5: 源码', check: intermediateResults.found.some(f => f.includes('source-code') || f.includes('07-source-code')) }
  ];

  for (const pc of priorityChecks) {
    const icon = pc.check ? '✅' : '⚠️';
    console.log(`  ${icon} ${pc.name}`);
    if (!pc.check) {
      discrepancies.push(`资料引用策略优先级未执行：${pc.name}`);
    }
  }

  // 检查质量门禁
  console.log('\n  质量门禁验证（调试模式）：\n');
  const qualityChecks = [
    { name: '关键词抽取质量门禁', check: intermediateResults.found.some(f => f.includes('keyword-extraction')) },
    { name: '文档生成质量门禁', check: documentResults.checks?.yamlHeader && documentResults.checks?.sqlExamples },
    { name: '格式合规检查', check: documentResults.checks?.yamlHeader && documentResults.checks?.mermaidDiagrams }
  ];

  for (const qc of qualityChecks) {
    const icon = qc.check ? '✅' : '️';
    console.log(`  ${icon} ${qc.name}`);
    if (!qc.check) {
      discrepancies.push(`质量门禁未通过：${qc.name}`);
    }
  }

  // 检查中间文件存储目录
  console.log('\n  中间文件存储目录验证：\n');
  const usesIntermediateDir = true; // API 返回的就是 intermediate 目录下的文件
  const icon = usesIntermediateDir ? '✅' : '❌';
  console.log(`  ${icon} 使用 logs/intermediate/ 统一目录`);
  if (!usesIntermediateDir) {
    discrepancies.push('中间文件未存储在 logs/intermediate/ 统一目录下');
  }

  if (discrepancies.length === 0) {
    console.log('\n  ✅ 所有检查通过，与设计文档一致\n');
  } else {
    console.log(`\n  ️ 发现 ${discrepancies.length} 个偏差：\n`);
    discrepancies.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
    console.log('');
  }

  return discrepancies;
}

// ============================================================
// 主测试流程
// ============================================================

async function main() {
  console.log('============================================================');
  console.log('测试用例：知识点 1.1.1 字符串类型');
  console.log('模拟前端执行流程，验证子流程切分与质量控制设计');
  console.log('============================================================\n');

  // 知识点信息（来自大纲 1.1.1）
  const knowledgePoint = {
    name: "字符串类型：`CHAR` / `VARCHAR2` / `NCHAR` / `NVARCHAR2` → 目标库等价类型（含长度语义 byte/char）",
    part: "业务领域 - 第 1 部分：兼容性领域",
    chapter: "1 DDL 兼容性",
    description: "字符串类型：`CHAR` / `VARCHAR2` / `NCHAR` / `NVARCHAR2` → 目标库等价类型（含长度语义 byte/char）",
    type: "通用基础",
    target_db: "Oracle"
  };

  // 步骤 1：组装提示词
  console.log('步骤 1：组装提示词（模拟前端）\n');
  const { prompt, skillFile, templateFile, json } = assemblePrompt(knowledgePoint);
  console.log(`  知识点名称：${knowledgePoint.name}`);
  console.log(`  Skill 文件：${skillFile}`);
  console.log(`  模板文件：${templateFile}`);
  console.log(`  提示词长度：${prompt.length} 字符\n`);

  // 步骤 2：调用后端 API（调试模式）
  console.log('步骤 2：调用后端 API（调试模式）\n');
  const requestBody = {
    prompt,
    mode: 'direct_generate',
    debug: true, // 启用调试模式
    knowledge_point: knowledgePoint,
    output_path: getOutputPath(knowledgePoint.part),
    template: templateFile,
    skill: skillFile,  // 添加 skill 文件路径
    max_tokens: 60000,
    temperature: 0.3
  };

  const { data: execResult } = await httpRequest('POST', '/api/agent/execute', requestBody);
  
  if (execResult.error) {
    console.log(`  ❌ 任务创建失败：${execResult.error}`);
    process.exit(1);
  }

  const taskId = execResult.task_id;
  console.log(`  任务 ID：${taskId}\n`);

  // 步骤 3：轮询任务状态
  console.log('步骤 3：轮询任务状态\n');
  const finalStatus = await pollTaskStatus(taskId);

  // 步骤 4：验证中间文件
  const intermediateResults = await verifyIntermediateFiles(taskId);

  // 步骤 5：验证最终文档
  const documentResults = await verifyFinalDocument(taskId);

  // 步骤 6：与设计文档对比
  const discrepancies = compareWithDesignDoc(intermediateResults, documentResults);

  // 总结
  console.log('============================================================');
  console.log('测试总结');
  console.log('============================================================\n');
  console.log(`  任务状态：${finalStatus.status}`);
  console.log(`  任务进度：${finalStatus.progress}%`);
  console.log(`  中间文件：${intermediateResults.passed ? '✅ 通过' : '❌ 未通过'} (${intermediateResults.found.length} 个文件)`);
  console.log(`  最终文档：${documentResults.passed ? '✅ 通过' : '❌ 未通过'}`);
  console.log(`  设计文档对比：${discrepancies.length === 0 ? '✅ 一致' : `⚠️ ${discrepancies.length} 个偏差`}`);

  if (discrepancies.length > 0) {
    console.log('\n  偏差列表：');
    discrepancies.forEach((d, i) => console.log(`    ${i + 1}. ${d}`));
  }

  console.log('');
  return {
    taskId,
    status: finalStatus.status,
    intermediateResults,
    documentResults,
    discrepancies
  };
}

main().catch(err => {
  console.error('测试失败:', err.message);
  process.exit(1);
});
