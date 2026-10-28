'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildBlindPackage, summarize } = require('../../../tools/repository/production-ai-blind-eval.cjs');

const repositoryRoot = path.resolve(__dirname, '../../..');
const runtimeRoot = path.join(repositoryRoot, 'runtime');
const cli = path.join(repositoryRoot, 'tools/repository/production-ai-blind-eval.cjs');

function makeInput() {
  return {
    evaluationSetId: 'technical-docs', evaluationSetVersion: '0.1.0', cases: [
      { caseId: 'sql-function', task: { operation: 'continue', requirements: '补充准确说明', originalMarkdown: 'SQL 内容',
        template: '参考手册模板', confirmedSources: [{ sourceId: 'sql-manual-1', content: '函数接受两个参数', locator: '第 1 节' }], range: { start: 6, end: 6 } },
        referenceFacts: ['函数接受两个参数'], runs: [
          { executorId: 'model-secret-alpha', status: 'completed', markdown: '说明甲', elapsedMs: 100, costMicrousd: 90, retryCount: 0, recoverySucceeded: false },
          { executorId: 'model-secret-beta', status: 'completed', markdown: '说明乙', elapsedMs: 150, costMicrousd: null, retryCount: 1, recoverySucceeded: true },
        ] },
      { caseId: 'privilege', task: { operation: 'polish', requirements: '保留权限语义', originalMarkdown: '权限语义',
        template: '安全说明模板', confirmedSources: [], range: { start: 0, end: 4 } },
        referenceFacts: ['需要管理员权限'], runs: [
          { executorId: 'model-secret-alpha', status: 'failed', failureCode: 'PROVIDER_SECRET_ERROR', elapsedMs: 200, costMicrousd: 110, retryCount: 2, recoverySucceeded: null },
          { executorId: 'model-secret-beta', status: 'completed', markdown: '需要管理员权限。', elapsedMs: null, costMicrousd: 75, retryCount: 0, recoverySucceeded: null },
        ] },
    ],
  };
}

function makeJudgments(blindReview, sealedMetrics) {
  const cases = blindReview.cases.map(item => {
    const sealed = sealedMetrics.cases.find(value => value.caseId === item.caseId);
    const ratings = {};
    for (const label of ['A', 'B']) {
      const preferred = sealed.labels[label].executorId === 'model-secret-beta';
      ratings[label] = { factAccuracy: preferred ? 5 : 4, citationSupport: preferred ? 5 : 4,
        unsupportedFactCount: 0, outOfScopeChangeCount: 0, formatFollowed: true, safetyIssue: false,
        editMinutes: preferred ? 1 : 2 };
    }
    return { caseId: item.caseId, ratings,
      preference: sealed.labels.A.executorId === 'model-secret-beta' ? 'A' : 'B' };
  });
  return { schemaVersion: 1, runId: blindReview.runId, evaluationSetId: blindReview.evaluationSetId,
    evaluationSetVersion: blindReview.evaluationSetVersion, cases: cases.flatMap(item => [
    { judgeId: 'reviewer-1', ...item }, { judgeId: 'reviewer-2', ...item },
  ]) };
}

test('盲评包按案例匿名候选，身份与遥测只写入受限解盲数据', () => {
  const { blindReview, sealedMetrics } = buildBlindPackage(makeInput(), 'run-test');
  const blind = JSON.stringify(blindReview);
  assert.match(blind, /说明甲|说明乙/);
  assert.doesNotMatch(blind, /model-secret|PROVIDER_SECRET_ERROR|elapsedMs|costMicrousd|retryCount/);
  assert.equal(blindReview.cases.length, 2);
  assert.notEqual(blindReview.cases[0].candidates.A.markdown, blindReview.cases[0].candidates.B.markdown);
  assert.deepEqual(Object.keys(sealedMetrics.cases[0].labels).sort(), ['A', 'B']);
  assert.deepEqual(new Set(Object.values(sealedMetrics.cases[0].labels).map(item => item.executorId)), new Set(['model-secret-alpha', 'model-secret-beta']));
  assert.deepEqual(new Set(Object.values(sealedMetrics.cases[1].labels).map(item => item.status)), new Set(['completed', 'failed']));
  assert.equal(JSON.stringify(sealedMetrics).includes('PROVIDER_SECRET_ERROR'), true);
});

test('只有两位评测者覆盖所有案例后才生成按执行器解盲的描述性统计', () => {
  const { blindReview, sealedMetrics } = buildBlindPackage(makeInput(), 'run-test');
  const judgments = makeJudgments(blindReview, sealedMetrics);
  const result = summarize(blindReview, judgments, sealedMetrics);
  assert.equal(result.caseCount, 2);
  assert.equal(result.judgeCount, 2);
  assert.equal(result.executors['model-secret-alpha'].ratedCandidateCount, 4);
  assert.equal(result.executors['model-secret-alpha'].failureRate, 0.5);
  assert.equal(result.executors['model-secret-alpha'].elapsedMs.coverage, 1);
  assert.equal(result.executors['model-secret-alpha'].costMicrousd.coverage, 1);
  assert.equal(result.executors['model-secret-beta'].elapsedMs.coverage, 0.5);
  assert.equal(result.executors['model-secret-beta'].costMicrousd.coverage, 0.5);
  assert.equal(result.preferenceCounts['model-secret-beta'], 4);
  assert.match(result.interpretation, /不自动决定/);
});

test('拒绝缺少第二评测者、未知案例及盲审/解盲运行不一致', () => {
  const { blindReview, sealedMetrics } = buildBlindPackage(makeInput(), 'run-test');
  const judgments = makeJudgments(blindReview, sealedMetrics);
  assert.throws(() => summarize(blindReview, { ...judgments, cases: judgments.cases.slice(1) }, sealedMetrics), /至少需要两位/);
  assert.throws(() => summarize(blindReview, { ...judgments, cases: [...judgments.cases, { ...judgments.cases[0], caseId: 'unknown' }] }, sealedMetrics), /未知案例/);
  assert.throws(() => summarize(blindReview, judgments, { ...sealedMetrics, runId: 'another-run' }), /版本不匹配/);
});

test('评测输入验证范围、匿名字段评分和不完整计量', () => {
  const bad = makeInput();
  bad.cases[0].task.range.end = 900;
  assert.throws(() => buildBlindPackage(bad), /range 无效/);
  const { blindReview, sealedMetrics } = buildBlindPackage(makeInput(), 'run-test');
  const judgments = makeJudgments(blindReview, sealedMetrics);
  judgments.cases[0].ratings.A.factAccuracy = 6;
  assert.throws(() => summarize(blindReview, judgments, sealedMetrics), /必须为 1 到 5/);
});

test('输入中没有 cost 字段时不会将成本误报为零', () => {
  const input = makeInput();
  input.cases.forEach(item => item.runs.forEach(run => { delete run.costMicrousd; }));
  const { blindReview, sealedMetrics } = buildBlindPackage(input, 'run-test');
  const result = summarize(blindReview, makeJudgments(blindReview, sealedMetrics), sealedMetrics);
  assert.equal(result.executors['model-secret-alpha'].costMicrousd.mean, null);
  assert.equal(result.executors['model-secret-beta'].costMicrousd.coverage, 0);
});

test('拒绝无效恢复标记、缺失基准上下文和拆分代理对的范围', () => {
  const wrongRecovery = makeInput();
  wrongRecovery.cases[0].runs[0].recoverySucceeded = 'false';
  assert.throws(() => buildBlindPackage(wrongRecovery), /recoverySucceeded 必须为布尔值/);

  const missingTemplate = makeInput();
  delete missingTemplate.cases[0].task.template;
  assert.throws(() => buildBlindPackage(missingTemplate), /task\.template/);

  const splitSurrogate = makeInput();
  splitSurrogate.cases[0].task.originalMarkdown = 'A😀B';
  splitSurrogate.cases[0].task.range = { start: 2, end: 3 };
  assert.throws(() => buildBlindPackage(splitSurrogate), /不能拆分 Unicode 代理对/);
});

test('汇总校验盲审与解盲结构且不修改评分输入', () => {
  const { blindReview, sealedMetrics } = buildBlindPackage(makeInput(), 'run-test');
  const judgments = makeJudgments(blindReview, sealedMetrics);
  const before = structuredClone(judgments);
  summarize(blindReview, judgments, sealedMetrics);
  assert.deepEqual(judgments, before);

  const mismatched = structuredClone(sealedMetrics);
  mismatched.cases[0].labels.A.status = 'failed';
  assert.throws(() => summarize(blindReview, judgments, mismatched), /运行状态不匹配/);
  assert.throws(() => summarize({ ...blindReview, cases: null }, judgments, sealedMetrics), /案例必须是非空数组/);
});

function makeRuntimeTestDir(t) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtimeRoot, '.blind-eval-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('CLI prepare 与 summarize 全链路产物仅可读本人并使用运行时目录', t => {
  const directory = makeRuntimeTestDir(t);
  const inputFile = path.join(directory, 'input.json');
  const outputDirectory = path.join(directory, 'run-1');
  fs.writeFileSync(inputFile, JSON.stringify(makeInput()), { mode: 0o600 });

  const prepared = runCli(['prepare', inputFile, outputDirectory]);
  assert.equal(prepared.status, 0, prepared.stderr);
  const paths = JSON.parse(prepared.stdout);
  assert.equal(fs.statSync(outputDirectory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(paths.blindReview).mode & 0o777, 0o600);
  assert.equal(fs.statSync(paths.sealedMetrics).mode & 0o777, 0o600);
  const blind = JSON.parse(fs.readFileSync(paths.blindReview, 'utf8'));
  const sealed = JSON.parse(fs.readFileSync(paths.sealedMetrics, 'utf8'));
  assert.doesNotMatch(JSON.stringify(blind), /model-secret|PROVIDER_SECRET_ERROR|costMicrousd/);
  assert.match(JSON.stringify(sealed), /PROVIDER_SECRET_ERROR/);

  const judgmentsFile = path.join(directory, 'judgments.json');
  const judgments = makeJudgments(blind, sealed);
  fs.writeFileSync(judgmentsFile, JSON.stringify(judgments), { mode: 0o600 });
  const summaryFile = path.join(directory, 'summary.json');
  const summarized = runCli(['summarize', paths.blindReview, judgmentsFile, paths.sealedMetrics, summaryFile]);
  assert.equal(summarized.status, 0, summarized.stderr);
  assert.equal(JSON.parse(fs.readFileSync(summaryFile, 'utf8')).caseCount, 2);
  assert.equal(fs.statSync(summaryFile).mode & 0o777, 0o600);
});

test('CLI 禁止覆盖已有输出并阻止通过符号链接逃出 runtime/', t => {
  const directory = makeRuntimeTestDir(t);
  const inputFile = path.join(directory, 'input.json');
  const outputDirectory = path.join(directory, 'existing');
  fs.mkdirSync(outputDirectory, { mode: 0o700 });
  const priorFile = path.join(outputDirectory, 'blind-review.json');
  fs.writeFileSync(inputFile, JSON.stringify(makeInput()), { mode: 0o600 });
  fs.writeFileSync(priorFile, 'keep-me', { mode: 0o600 });

  const overwrite = runCli(['prepare', inputFile, outputDirectory]);
  assert.notEqual(overwrite.status, 0);
  assert.match(overwrite.stderr, /已存在/);
  assert.equal(fs.readFileSync(priorFile, 'utf8'), 'keep-me');
  assert.equal(fs.existsSync(path.join(outputDirectory, 'sealed-metrics.json')), false);

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'blind-eval-outside-'));
  const escaped = path.join(directory, 'outside-link');
  try {
    fs.symlinkSync(outside, escaped, 'dir');
    const escapeAttempt = runCli(['prepare', inputFile, path.join(escaped, 'new-run')]);
    assert.notEqual(escapeAttempt.status, 0);
    assert.match(escapeAttempt.stderr, /不能通过符号链接离开 runtime/);
    assert.equal(fs.readdirSync(outside).length, 0);
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
