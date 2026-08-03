#!/usr/bin/env node

/**
 * 集成测试入口脚本
 * 
 * 运行所有集成测试（模块间交互、系统流程测试）
 * 
 * 用法：
 *   node tests/run-integration-tests.js              # 运行全部集成测试
 *   node tests/run-integration-tests.js --verbose     # 详细输出
 *   node tests/run-integration-tests.js --coverage    # 带覆盖率
 */

const { execSync } = require('child_process');
const path = require('path');

const INTEGRATION_TESTS = [
  'tests/api.test.js',
  'tests/document-api.test.js',
  'tests/system-retrieval-flow.test.js',
  'tests/langgraph-workflow.test.js',
];

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const coverage = args.includes('--coverage');

const testPaths = INTEGRATION_TESTS.map(t => path.resolve(__dirname, '..', t)).join(' ');

let cmd = `npx jest ${testPaths}`;
if (verbose) cmd += ' --verbose';
if (coverage) cmd += ' --coverage';

console.log('🔗 运行集成测试...\n');
console.log('测试文件：');
INTEGRATION_TESTS.forEach(t => console.log(`  - ${t}`));
console.log('');

try {
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('\n✅ 集成测试全部通过');
} catch (err) {
  console.log('\n❌ 集成测试存在失败');
  process.exit(1);
}
