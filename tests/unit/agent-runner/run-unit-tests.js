#!/usr/bin/env node

/**
 * 单元测试入口脚本
 * 
 * 运行所有单元测试（单个模块/类的测试）
 * 
 * 用法：
 *   node tests/unit/agent-runner/run-unit-tests.js     # 运行全部单元测试
 *   node tests/run-unit-tests.js --verbose         # 详细输出
 *   node tests/run-unit-tests.js --coverage        # 带覆盖率
 *   node tests/run-unit-tests.js --watch           # 监听模式
 */

const { execSync } = require('child_process');
const path = require('path');

const UNIT_TESTS = [
  // 核心模块
  'tests/unit/agent-runner/agents.test.js',
  'tests/unit/agent-runner/config-manager.test.js',
  'tests/unit/agent-runner/config-validator.test.js',
  'tests/unit/agent-runner/llm-client.test.js',
  'tests/unit/agent-runner/step-executor.test.js',
  'tests/unit/agent-runner/tools.test.js',
  'tests/unit/agent-runner/workflow-engine.test.js',
  'tests/unit/agent-runner/yaml-metadata-processor.test.js',
  'tests/unit/agent-runner/retrieval-query-builder.test.js',
];

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const coverage = args.includes('--coverage');
const watch = args.includes('--watch');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const testPaths = UNIT_TESTS.map(t => path.resolve(ROOT_DIR, t)).join(' ');

let cmd = `npx jest ${testPaths}`;
if (verbose) cmd += ' --verbose';
if (coverage) cmd += ' --coverage';
if (watch) cmd += ' --watch';

console.log('🧪 运行单元测试...\n');
console.log('测试文件：');
UNIT_TESTS.forEach(t => console.log(`  - ${t}`));
console.log('');

try {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR });
  console.log('\n✅ 单元测试全部通过');
} catch (err) {
  console.log('\n❌ 单元测试存在失败');
  process.exit(1);
}
