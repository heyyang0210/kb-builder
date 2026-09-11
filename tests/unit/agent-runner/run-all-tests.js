#!/usr/bin/env node

/**
 * 全量测试总入口脚本
 * 
 * 按类别运行所有测试，支持选择性执行和参数传递。
 * 
 * 用法：
 *   node tests/unit/agent-runner/run-all-tests.js                    # 运行全部测试（按顺序）
 *   node tests/unit/agent-runner/run-all-tests.js unit               # 仅运行单元测试
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

// === 测试分类定义 ===

const TEST_CATEGORIES = {
  unit: {
    name: '单元测试',
    icon: '🧪',
    description: '测试单个模块/类的功能',
    files: [
      'tests/unit/agent-runner/agents.test.js',
      'tests/unit/agent-runner/config-manager.test.js',
      'tests/unit/agent-runner/config-validator.test.js',
      'tests/unit/agent-runner/llm-client.test.js',
      'tests/unit/agent-runner/step-executor.test.js',
      'tests/unit/agent-runner/tools.test.js',
      'tests/unit/agent-runner/workflow-engine.test.js',
      'tests/unit/agent-runner/yaml-metadata-processor.test.js',
      'tests/unit/agent-runner/retrieval-query-builder.test.js',
    ]
  },
  preprocessing: {
    name: '预处理模块测试',
    icon: '📦',
    description: '资料预处理框架（清洗/分块/索引/质量验证）',
    files: [
      'tests/unit/agent-runner/preprocessing/design-doc-cleaner.test.js',
      'tests/unit/agent-runner/preprocessing/semantic-chunker.test.js',
      'tests/unit/agent-runner/preprocessing/markdown-adapter.test.js',
      'tests/unit/agent-runner/preprocessing/snapshot-tracker.test.js',
      'tests/unit/agent-runner/preprocessing/quality-validator.test.js',
      'tests/unit/agent-runner/preprocessing/image-caption-provider.test.js',
      'tests/unit/agent-runner/preprocessing/libreoffice-renderer.test.js',
      'tests/unit/agent-runner/preprocessing/vision-api.integration.test.js',
      'tests/unit/agent-runner/preprocessing/pipeline-integration.test.js',
    ]
  },
  integration: {
    name: '集成测试',
    icon: '🔗',
    description: '测试模块间交互和系统流程',
    files: [
      'tests/unit/agent-runner/api.test.js',
      'tests/unit/agent-runner/document-api.test.js',
      'tests/unit/agent-runner/system-retrieval-flow.test.js',
      'tests/unit/agent-runner/langgraph-workflow.test.js',
    ]
  },
  functional: {
    name: '功能测试',
    icon: '🎯',
    description: '独立功能验证脚本',
    files: [
      'tests/unit/agent-runner/button-functional-test.js',
      'tests/unit/agent-runner/test-kp-1.1.1.js',
      'tests/unit/agent-runner/test-yaml-format.js',
      'tests/unit/agent-runner/test-yaml-format-fix.js',
      'tests/unit/agent-runner/system-test-datatype-mapping.js',
    ]
  },
  e2e: {
    name: 'E2E 测试',
    icon: '🌐',
    description: '端到端浏览器测试（Playwright）',
    files: [
      'tests/unit/agent-runner/e2e/01-smoke.spec.js',
      'tests/unit/agent-runner/e2e/02-tab-navigation.spec.js',
      'tests/unit/agent-runner/e2e/03-sidebar.spec.js',
      'tests/unit/agent-runner/e2e/04-doc-generation.spec.js',
      'tests/unit/agent-runner/e2e/05-config-modal.spec.js',
      'tests/unit/agent-runner/e2e/06-doc-management.spec.js',
      'tests/unit/agent-runner/e2e/07-api-integration.spec.js',
      'tests/unit/agent-runner/e2e/11-workflow-execution.spec.js',
      'tests/unit/agent-runner/e2e/13-retrieval-optimization.spec.js',
    ]
  }
};

// === 参数解析 ===

const args = process.argv.slice(2);
const categories = args.filter(a => !a.startsWith('--'));
const verbose = args.includes('--verbose') || args.includes('-v');
const coverage = args.includes('--coverage');
const report = args.includes('--report');
const skipE2E = args.includes('--skip-e2e');
const parallel = args.includes('--parallel');
const jestOutputJson = args.includes('--json');

// 确定要运行的分类
let selectedCategories;
if (categories.length === 0) {
  selectedCategories = Object.keys(TEST_CATEGORIES);
  if (skipE2E) {
    selectedCategories = selectedCategories.filter(c => c !== 'e2e');
  }
} else {
  selectedCategories = categories;
}

// 验证分类名称
for (const cat of selectedCategories) {
  if (!TEST_CATEGORIES[cat]) {
    console.error(`❌ 未知分类: ${cat}`);
    console.error(`   可用分类: ${Object.keys(TEST_CATEGORIES).join(', ')}`);
    process.exit(1);
  }
}

// === 执行函数 ===

function runJestTests(category, files) {
  const testPaths = files
    .map(f => path.resolve(ROOT_DIR, f))
    .filter(f => {
      try { require('fs').accessSync(f); return true; } catch { return false; }
    })
    .join(' ');

  if (!testPaths) {
    console.log(`   ⚠️  无可用测试文件`);
    return { passed: true, skipped: true };
  }

  let cmd = `npx jest ${testPaths} --forceExit`;
  if (verbose) cmd += ' --verbose';
  if (coverage) cmd += ' --coverage';

  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR, timeout: 120000 });
    return { passed: true };
  } catch (err) {
    return { passed: false };
  }
}

function runScriptTests(category, files) {
  let allPassed = true;

  for (const file of files) {
    const filePath = path.resolve(ROOT_DIR, file);
    try {
      require('fs').accessSync(filePath);
    } catch {
      console.log(`   ⚠️  跳过: ${file}（文件不存在）`);
      continue;
    }

    try {
      execSync(`node ${filePath}`, { stdio: 'inherit', cwd: ROOT_DIR, timeout: 60000 });
    } catch (err) {
      allPassed = false;
    }
  }

  return { passed: allPassed };
}

function runE2ETests(category, files) {
  const testPaths = files
    .map(f => path.resolve(ROOT_DIR, f))
    .filter(f => {
      try { require('fs').accessSync(f); return true; } catch { return false; }
    })
    .join(' ');

  if (!testPaths) {
    console.log(`   ⚠️  无可用测试文件`);
    return { passed: true, skipped: true };
  }

  try {
    execSync(`npx playwright test ${testPaths}`, { stdio: 'inherit', cwd: ROOT_DIR, timeout: 300000 });
    return { passed: true };
  } catch (err) {
    return { passed: false };
  }
}

// === 主流程 ===

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     YashanDB Agent Runner — 全量测试入口     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`📋 执行分类: ${selectedCategories.map(c => TEST_CATEGORIES[c].icon + ' ' + TEST_CATEGORIES[c].name).join(', ')}`);
  if (verbose) console.log('   模式: 详细输出');
  if (coverage) console.log('   模式: 覆盖率统计');
  if (skipE2E) console.log('   模式: 跳过 E2E');
  console.log('');

  const results = {};
  const startTime = Date.now();

  for (const cat of selectedCategories) {
    const category = TEST_CATEGORIES[cat];
    console.log(`${'─'.repeat(50)}`);
    console.log(`${category.icon} ${category.name} — ${category.description}`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`   测试文件 (${category.files.length}):`);
    category.files.forEach(f => console.log(`     - ${f}`));
    console.log('');

    let result;
    if (cat === 'e2e') {
      result = runE2ETests(cat, category.files);
    } else if (cat === 'functional') {
      result = runScriptTests(cat, category.files);
    } else {
      result = runJestTests(cat, category.files);
    }

    results[cat] = result;
    console.log('');

    if (result.passed) {
      console.log(`   ✅ ${category.name}通过`);
    } else {
      console.log(`   ❌ ${category.name}存在失败`);
    }
    console.log('');
  }

  // === 汇总报告 ===
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = Object.values(results).filter(r => r.passed).length;
  const total = Object.keys(results).length;
  const failed = total - passed;

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║                  测试汇总                    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`   总耗时: ${totalTime}s`);
  console.log(`   分类结果: ${passed}/${total} 通过`);
  console.log('');

  for (const [cat, result] of Object.entries(results)) {
    const category = TEST_CATEGORIES[cat];
    const icon = result.passed ? '✅' : '❌';
    const skipped = result.skipped ? ' (跳过)' : '';
    console.log(`   ${icon} ${category.icon} ${category.name}${skipped}`);
  }

  console.log('');

  if (failed === 0) {
    console.log('🎉 全部测试通过！');
  } else {
    console.log(`⚠️  ${failed} 个分类存在失败用例`);
  }

  // 生成报告
  if (report) {
    const reportPath = path.join(ROOT_DIR, 'tests', 'test-summary-report.md');
    const reportContent = generateSummaryReport(results, totalTime);
    require('fs').writeFileSync(reportPath, reportContent, 'utf-8');
    console.log(`\n📝 测试报告已生成: tests/test-summary-report.md`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

function generateSummaryReport(results, totalTime) {
  const lines = [];
  const now = new Date().toISOString();

  lines.push('# YashanDB Agent Runner — 全量测试报告');
  lines.push('');
  lines.push(`> 生成时间：${now}`);
  lines.push(`> 总耗时：${totalTime}s`);
  lines.push('');
  lines.push('## 测试分类总览');
  lines.push('');
  lines.push('| 分类 | 图标 | 说明 | 测试文件数 | 状态 |');
  lines.push('|------|------|------|-----------|------|');

  for (const [cat, category] of Object.entries(TEST_CATEGORIES)) {
    const result = results[cat];
    const status = result ? (result.passed ? '✅ 通过' : '❌ 失败') : '⏭️ 未执行';
    lines.push(`| ${category.name} | ${category.icon} | ${category.description} | ${category.files.length} | ${status} |`);
  }

  lines.push('');
  lines.push('## 测试文件清单');
  lines.push('');

  for (const [cat, category] of Object.entries(TEST_CATEGORIES)) {
    lines.push(`### ${category.icon} ${category.name}`);
    lines.push('');
    lines.push('| 文件 | 说明 |');
    lines.push('|------|------|');
    for (const file of category.files) {
      const desc = getTestDescription(file);
      lines.push(`| \`${file}\` | ${desc} |`);
    }
    lines.push('');
  }

  lines.push('## 快速命令');
  lines.push('');
  lines.push('```bash');
  lines.push('# 全量测试');
  lines.push('node tests/run-all-tests.js');
  lines.push('');
  lines.push('# 按分类运行');
  lines.push('node tests/run-all-tests.js unit            # 单元测试');
  lines.push('node tests/run-all-tests.js integration     # 集成测试');
  lines.push('node tests/run-all-tests.js preprocessing   # 预处理测试');
  lines.push('node tests/run-all-tests.js e2e             # E2E 测试');
  lines.push('node tests/run-all-tests.js functional      # 功能测试');
  lines.push('');
  lines.push('# 常用选项');
  lines.push('node tests/run-all-tests.js --verbose       # 详细输出');
  lines.push('node tests/run-all-tests.js --coverage      # 覆盖率');
  lines.push('node tests/run-all-tests.js --skip-e2e      # 跳过 E2E');
  lines.push('node tests/run-all-tests.js --report        # 生成报告');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function getTestDescription(file) {
  const descriptions = {
    'tests/agents.test.js': 'Agent 模块（Planner/Retriever/Generator/Validator）',
    'tests/config-manager.test.js': '配置管理（加密/解密/缓存）',
    'tests/config-validator.test.js': '配置验证（格式/必填项校验）',
    'tests/llm-client.test.js': 'LLM 客户端（API 调用/重试/降级）',
    'tests/step-executor.test.js': '步骤执行器（工作流步骤调度）',
    'tests/tools.test.js': '工具模块（MCP/文件读写/搜索）',
    'tests/workflow-engine.test.js': '工作流引擎（流程编排/状态管理）',
    'tests/yaml-metadata-processor.test.js': 'YAML 元数据处理',
    'tests/retrieval-query-builder.test.js': '检索查询构建（关键词/同义词扩展）',
    'tests/preprocessing/design-doc-cleaner.test.js': '设计文档清洗（6 条规则）',
    'tests/preprocessing/semantic-chunker.test.js': '语义分块（边界检测/保护块/overlap）',
    'tests/preprocessing/markdown-adapter.test.js': 'Markdown 适配器（扫描/解析/元数据）',
    'tests/preprocessing/snapshot-tracker.test.js': '快照管理（保存/加载/回溯/保留策略）',
    'tests/preprocessing/quality-validator.test.js': '质量验证（清洗/分块/索引检查点）',
    'tests/preprocessing/pipeline-integration.test.js': '预处理流水线端到端集成',
    'tests/api.test.js': 'API 接口测试',
    'tests/document-api.test.js': '文档 API 测试',
    'tests/system-retrieval-flow.test.js': '系统检索全流程',
    'tests/langgraph-workflow.test.js': 'LangGraph 工作流集成',
    'tests/button-functional-test.js': '前端按钮功能验证',
    'tests/test-kp-1.1.1.js': '知识点 1.1.1 字符串类型验证',
    'tests/test-yaml-format.js': 'YAML 格式验证',
    'tests/test-yaml-format-fix.js': 'YAML 格式修复验证',
    'tests/system-test-datatype-mapping.js': '数据类型映射验证',
  };
  return descriptions[file] || path.basename(file);
}

main().catch(err => {
  console.error('未预期的错误:', err);
  process.exit(1);
});
