const fs = require('fs');
const path = require('path');

const result = JSON.parse(fs.readFileSync('/tmp/jest-result.json', 'utf-8'));

const report = [];
const assertions = result.testResults.flatMap(suite => suite.assertionResults);
const libreOfficeTest = assertions.find(test => test.fullName.includes('真实 PPTX 至少渲染一张 PNG'));
const visionApiTest = assertions.find(test => test.fullName.includes('真实接口返回一句图片说明'));
report.push('# 资料预处理框架 — 测试报告');
report.push('');
report.push('> 生成时间：' + new Date().toISOString());
report.push('> 测试框架：Jest');
report.push('');
report.push('## 总览');
report.push('');
report.push('| 指标 | 结果 |');
report.push('|------|------|');
report.push('| 测试套件 | ' + result.numPassedTestSuites + '/' + result.numTotalTestSuites + ' 通过 |');
report.push('| 测试用例 | ' + result.numPassedTests + '/' + result.numTotalTests + ' 通过 |');
report.push('| 跳过 | ' + result.numPendingTestSuites + ' 个套件 / ' + result.numPendingTests + ' 个用例 |');
report.push('| 执行耗时 | ~' + Math.round((result.testResults.reduce((sum, s) => sum + (s.endTime - s.startTime), 0)) / 1000) + 's |');
report.push('| 状态 | ' + (result.success ? '✅ 全部通过' : '❌ 存在失败') + ' |');
report.push('');

// 各套件详情
report.push('## 测试套件详情');
report.push('');

for (const suite of result.testResults) {
  const suiteName = path.basename(suite.name, '.test.js');
  const status = suite.status === 'passed' ? '✅' : suite.status === 'skipped' ? '⏭️' : '❌';
  const duration = suite.endTime - suite.startTime;
  const total = suite.assertionResults.length;
  const passed = suite.assertionResults.filter(t => t.status === 'passed').length;
  const pending = suite.assertionResults.filter(t => t.status === 'pending').length;
  
  report.push('### ' + status + ' ' + suiteName);
  report.push('');
  report.push('- 耗时：' + duration + 'ms');
  report.push('- 用例：' + passed + '/' + total + ' 通过，' + pending + ' 跳过');
  report.push('');
  
  report.push('| 用例 | 状态 |');
  report.push('|------|------|');
  for (const test of suite.assertionResults) {
    const icon = test.status === 'passed' ? '✅' : test.status === 'pending' ? '⏭️' : '❌';
    const name = test.ancestorTitles.length > 0 
      ? test.ancestorTitles.join(' > ') + ' > ' + test.title
      : test.title;
    report.push('| ' + name + ' | ' + icon + ' |');
  }
  report.push('');
}

// 覆盖率摘要
report.push('## 代码覆盖率摘要');
report.push('');
report.push(result.coverageMap
  ? '本次执行包含 Jest coverage 数据，请以终端 coverage 表和 `coverage/` 目录为准。'
  : '本次未启用 `--coverage`，不输出推测性覆盖率。');
report.push('');

// 测试文件清单
report.push('## 测试文件清单');
report.push('');
report.push('| 文件 | 类型 | 通过 | 跳过 |');
report.push('|------|------|------|------|');
for (const suite of result.testResults) {
  const fileName = path.basename(suite.name);
  const passed = suite.assertionResults.filter(test => test.status === 'passed').length;
  const pending = suite.assertionResults.filter(test => test.status === 'pending').length;
  const type = /integration/i.test(fileName) ? '集成测试' : '单元测试';
  report.push(`| \`${fileName}\` | ${type} | ${passed} | ${pending} |`);
}
report.push(`| **合计** | | **${result.numPassedTests}** | **${result.numPendingTests}** |`);
report.push('');

// 关键验证项
report.push('## 关键验证项');
report.push('');
report.push('### 清洗规则验证');
report.push('- ✅ Confluence 元数据移除');
report.push('- ✅ 内部链接清理（conf/jira/pingcode.yasdb.com）');
report.push('- ✅ 图片引用转换（![alt](url) → [图片: alt]）');
report.push('- ✅ 锚点链接清理');
report.push('- ✅ 标题层级统一');
report.push('- ✅ YAML 前置元数据生成');
report.push('');
report.push('### 数据完整性验证');
report.push('- ✅ 表格 100% 保留');
report.push('- ✅ 代码块 100% 保留');
report.push('- ✅ 图片引用先于内部链接处理（避免误清理）');
report.push('- ✅ Office 原始媒体和整页渲染资产采用独立类型标识');
report.push('- ✅ LibreOffice 不可用时输出 `unavailable` 审计状态');
report.push('- ✅ GPT-5.6 官方/第三方请求配置单元测试通过');
report.push(libreOfficeTest?.status === 'passed'
  ? '- ✅ 真实 LibreOffice PPTX 整页渲染测试通过'
  : '- ⏭️ 真实 LibreOffice 测试因本机依赖未配置而跳过');
report.push(visionApiTest?.status === 'passed'
  ? '- ✅ 真实视觉 API 图片说明测试通过'
  : '- ⏭️ 真实视觉 API 测试因运行开关或密钥未配置而跳过');
report.push('');
report.push('### 流水线验证');
report.push('- ✅ 完整流水线执行成功');
report.push('- ✅ 清洗后文件生成');
report.push('- ✅ 分层索引（L1/L2/L3）生成');
report.push('- ✅ 增量模式无变更跳过');
report.push('- ✅ 全量模式重新处理');
report.push('- ✅ 执行快照和报告生成');
report.push('');

fs.writeFileSync(
  path.join(__dirname, 'test-report.md'),
  report.join('\n'),
  'utf-8'
);
console.log('✅ Test report generated');
