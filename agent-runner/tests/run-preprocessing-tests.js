#!/usr/bin/env node

/**
 * 预处理模块测试入口脚本
 * 
 * 运行资料预处理框架的所有测试（单元测试 + 集成测试）
 * 
 * 用法：
 *   node tests/run-preprocessing-tests.js              # 运行全部预处理测试
 *   node tests/run-preprocessing-tests.js --verbose     # 详细输出
 *   node tests/run-preprocessing-tests.js --coverage    # 带覆盖率
 *   node tests/run-preprocessing-tests.js --report      # 生成测试报告
 */

const { execSync } = require('child_process');
const path = require('path');

const PREPROCESSING_TESTS = [
  // 单元测试 - 基础组件
  'tests/preprocessing/design-doc-cleaner.test.js',
  'tests/preprocessing/semantic-chunker.test.js',
  'tests/preprocessing/snapshot-tracker.test.js',
  'tests/preprocessing/quality-validator.test.js',
  'tests/preprocessing/fidelity-evaluator.test.js',
  'tests/preprocessing/image-caption-provider.test.js',
  'tests/preprocessing/libreoffice-renderer.test.js',
  'tests/preprocessing/vision-api.integration.test.js',
  // 单元测试 - 适配器
  'tests/preprocessing/markdown-adapter.test.js',
  'tests/preprocessing/html-adapter.test.js',
  'tests/preprocessing/pdf-adapter.test.js',
  'tests/preprocessing/docx-adapter.test.js',
  'tests/preprocessing/excel-adapter.test.js',
  'tests/preprocessing/pptx-adapter.test.js',
  'tests/preprocessing/archive-adapter.test.js',
  // 单元测试 - 适配器链
  'tests/preprocessing/adapter-chain.test.js',
  // 单元测试 - 质量、分类和索引
  'tests/preprocessing/quality-filter.test.js',
  'tests/preprocessing/feature-classifier.test.js',
  'tests/preprocessing/vector-and-graph-index.test.js',
  'tests/preprocessing/hybrid-retriever.test.js',
  // 集成测试
  'tests/preprocessing/pipeline-integration.test.js',
];

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const coverage = args.includes('--coverage');
const report = args.includes('--report');

const testPaths = PREPROCESSING_TESTS.map(t => path.resolve(__dirname, '..', t)).join(' ');

let cmd = `npx jest ${testPaths}`;
if (verbose) cmd += ' --verbose';
if (coverage) cmd += ' --coverage';
if (report) cmd += ' --json --outputFile=/tmp/jest-result.json';

console.log('📦 运行预处理模块测试...\n');
console.log('测试文件：');
PREPROCESSING_TESTS.forEach(t => console.log(`  - ${t}`));
console.log('');

try {
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('\n✅ 预处理模块测试全部通过');
  
  if (report) {
    try {
      execSync('node tests/preprocessing/generate-report.js', { 
        stdio: 'inherit', 
        cwd: path.join(__dirname, '..') 
      });
      console.log('📝 测试报告已生成: tests/preprocessing/test-report.md');
    } catch (e) {
      console.log('⚠️  报告生成失败，但测试已通过');
    }
  }
} catch (err) {
  console.log('\n❌ 预处理模块测试存在失败');
  process.exit(1);
}
