#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const labels = ['A', 'B'];
const scoreFields = ['factAccuracy', 'citationSupport'];

function invalid(message) {
  const error = new Error(message);
  error.code = 'BLIND_EVAL_INVALID';
  return error;
}

function text(value, name, max = 200000) {
  if (typeof value !== 'string' || value.length > max) throw invalid(`${name} 必须是长度不超过 ${max} 的文本`);
  return value;
}

function requiredText(value, name, max = 200000) {
  const result = text(value, name, max);
  if (!result.trim()) throw invalid(`${name} 不能为空`);
  return result;
}

function finiteOrNull(value, name, minimum = 0) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < minimum) throw invalid(`${name} 必须是大于等于 ${minimum} 的有限数值或 null`);
  return value;
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('评测输入必须是 JSON 对象');
  requiredText(input.evaluationSetId, 'evaluationSetId', 200);
  requiredText(input.evaluationSetVersion, 'evaluationSetVersion', 100);
  if (!Array.isArray(input.cases) || !input.cases.length) throw invalid('cases 不能为空');
  const seenCases = new Set();
  const cases = input.cases.map((item, index) => {
    const caseId = requiredText(item?.caseId, `cases[${index}].caseId`, 200);
    if (seenCases.has(caseId)) throw invalid(`caseId 重复：${caseId}`);
    seenCases.add(caseId);
    const task = item.task;
    if (!task || typeof task !== 'object' || Array.isArray(task)) throw invalid(`${caseId} 缺少 task`);
    requiredText(task.operation, `${caseId}.task.operation`, 100);
    text(task.requirements, `${caseId}.task.requirements`, 12000);
    text(task.originalMarkdown, `${caseId}.task.originalMarkdown`);
    text(task.template, `${caseId}.task.template`, 50000);
    if (!Array.isArray(task.confirmedSources)) throw invalid(`${caseId}.task.confirmedSources 必须是数组`);
    task.confirmedSources.forEach((source, sourceIndex) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        throw invalid(`${caseId}.task.confirmedSources[${sourceIndex}] 必须是对象`);
      }
      requiredText(source.sourceId, `${caseId}.task.confirmedSources[${sourceIndex}].sourceId`, 500);
      text(source.content, `${caseId}.task.confirmedSources[${sourceIndex}].content`);
      if (source.locator != null) text(source.locator, `${caseId}.task.confirmedSources[${sourceIndex}].locator`, 2000);
    });
    if (!task.range || !Number.isSafeInteger(task.range.start) || !Number.isSafeInteger(task.range.end)
      || task.range.start < 0 || task.range.end < task.range.start || task.range.end > task.originalMarkdown.length) {
      throw invalid(`${caseId} 的 range 无效`);
    }
    for (const boundary of [task.range.start, task.range.end]) {
      if (boundary > 0 && boundary < task.originalMarkdown.length
        && task.originalMarkdown.charCodeAt(boundary - 1) >= 0xD800
        && task.originalMarkdown.charCodeAt(boundary - 1) <= 0xDBFF
        && task.originalMarkdown.charCodeAt(boundary) >= 0xDC00
        && task.originalMarkdown.charCodeAt(boundary) <= 0xDFFF) {
        throw invalid(`${caseId} 的 range 不能拆分 Unicode 代理对`);
      }
    }
    if (!Array.isArray(item.referenceFacts) || item.referenceFacts.some(fact => typeof fact !== 'string')) {
      throw invalid(`${caseId}.referenceFacts 必须是字符串数组`);
    }
    if (!Array.isArray(item.runs) || item.runs.length !== 2) throw invalid(`${caseId} 必须且只能有两个执行器结果`);
    const executors = new Set();
    const runs = item.runs.map((run, runIndex) => {
      const executorId = requiredText(run?.executorId, `${caseId}.runs[${runIndex}].executorId`, 200);
      if (executors.has(executorId)) throw invalid(`${caseId} 的执行器必须不同`);
      executors.add(executorId);
      if (!['completed', 'failed', 'interrupted'].includes(run.status)) throw invalid(`${caseId} 的运行状态无效`);
      if (run.status === 'completed' && typeof run.markdown !== 'string') throw invalid(`${caseId} 已完成的运行必须包含 markdown`);
      if (run.status !== 'completed' && run.markdown != null && typeof run.markdown !== 'string') throw invalid(`${caseId} 的 markdown 无效`);
      if (!Number.isSafeInteger(run.retryCount ?? 0) || (run.retryCount ?? 0) < 0) throw invalid(`${caseId} 的 retryCount 无效`);
      if (run.recoverySucceeded != null && typeof run.recoverySucceeded !== 'boolean') {
        throw invalid(`${caseId} 的 recoverySucceeded 必须为布尔值或 null`);
      }
      return {
        executorId,
        status: run.status,
        markdown: run.markdown ?? null,
        failureCode: run.failureCode == null ? null : text(run.failureCode, `${caseId}.failureCode`, 100),
        elapsedMs: finiteOrNull(run.elapsedMs, `${caseId}.elapsedMs`),
        costMicrousd: finiteOrNull(run.costMicrousd, `${caseId}.costMicrousd`),
        retryCount: run.retryCount ?? 0,
        recoverySucceeded: run.recoverySucceeded ?? null,
      };
    });
    return {
      caseId,
      task: structuredClone(task),
      referenceFacts: [...item.referenceFacts],
      runs,
    };
  });
  return { evaluationSetId: input.evaluationSetId, evaluationSetVersion: input.evaluationSetVersion, cases };
}

function buildBlindPackage(input, runId = crypto.randomUUID()) {
  const normalized = normalizeInput(input);
  requiredText(runId, 'runId', 200);
  const blindCases = [];
  const sealedCases = [];
  for (const item of normalized.cases) {
    const order = crypto.randomInt(2) === 0 ? [0, 1] : [1, 0];
    const candidates = {};
    const sealed = {};
    order.forEach((runIndex, labelIndex) => {
      const run = item.runs[runIndex];
      const label = labels[labelIndex];
      candidates[label] = { status: run.status, markdown: run.markdown };
      sealed[label] = {
        executorId: run.executorId,
        status: run.status,
        failureCode: run.failureCode,
        elapsedMs: run.elapsedMs,
        costMicrousd: run.costMicrousd,
        retryCount: run.retryCount,
        recoverySucceeded: run.recoverySucceeded,
      };
    });
    blindCases.push({ caseId: item.caseId, task: item.task, referenceFacts: item.referenceFacts, candidates });
    sealedCases.push({ caseId: item.caseId, labels: sealed });
  }
  return {
    blindReview: { schemaVersion: 1, runId, evaluationSetId: normalized.evaluationSetId,
      evaluationSetVersion: normalized.evaluationSetVersion, createdAt: new Date().toISOString(), cases: blindCases },
    sealedMetrics: { schemaVersion: 1, runId, evaluationSetId: normalized.evaluationSetId,
      evaluationSetVersion: normalized.evaluationSetVersion, cases: sealedCases },
  };
}

function validateRating(rating, caseId, label) {
  if (!rating || typeof rating !== 'object' || Array.isArray(rating)) throw invalid(`${caseId}/${label} 缺少评分`);
  const normalized = {};
  for (const field of scoreFields) {
    if (!Number.isInteger(rating[field]) || rating[field] < 1 || rating[field] > 5) throw invalid(`${caseId}/${label}.${field} 必须为 1 到 5`);
    normalized[field] = rating[field];
  }
  for (const field of ['unsupportedFactCount', 'outOfScopeChangeCount']) {
    if (!Number.isSafeInteger(rating[field]) || rating[field] < 0) throw invalid(`${caseId}/${label}.${field} 必须为非负整数`);
    normalized[field] = rating[field];
  }
  for (const field of ['formatFollowed', 'safetyIssue']) {
    if (typeof rating[field] !== 'boolean') throw invalid(`${caseId}/${label}.${field} 必须为布尔值`);
    normalized[field] = rating[field];
  }
  normalized.editMinutes = finiteOrNull(rating.editMinutes, `${caseId}/${label}.editMinutes`);
  return normalized;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarize(blindReview, judgments, sealedMetrics) {
  if (!blindReview || !judgments || !sealedMetrics
    || blindReview.schemaVersion !== 1 || judgments.schemaVersion !== 1 || sealedMetrics.schemaVersion !== 1
    || blindReview.runId !== judgments.runId || blindReview.runId !== sealedMetrics.runId
    || blindReview.evaluationSetId !== judgments.evaluationSetId
    || blindReview.evaluationSetId !== sealedMetrics.evaluationSetId
    || blindReview.evaluationSetVersion !== judgments.evaluationSetVersion
    || blindReview.evaluationSetVersion !== sealedMetrics.evaluationSetVersion) throw invalid('盲审、评分和解盲数据版本不匹配');
  requiredText(blindReview.runId, 'runId', 200);
  requiredText(blindReview.evaluationSetId, 'evaluationSetId', 200);
  requiredText(blindReview.evaluationSetVersion, 'evaluationSetVersion', 100);
  if (!Array.isArray(blindReview.cases) || !blindReview.cases.length || !Array.isArray(sealedMetrics.cases)) {
    throw invalid('盲审和解盲案例必须是非空数组');
  }
  const toCaseMap = (items, name) => {
    const result = new Map();
    for (const item of items) {
      const caseId = requiredText(item?.caseId, `${name}.caseId`, 200);
      if (result.has(caseId)) throw invalid(`${name} 存在重复 caseId：${caseId}`);
      result.set(caseId, item);
    }
    return result;
  };
  const blindCases = toCaseMap(blindReview.cases, 'blindReview.cases');
  const sealedCases = toCaseMap(sealedMetrics.cases, 'sealedMetrics.cases');
  if (blindCases.size !== sealedCases.size || !Array.isArray(judgments.cases)) {
    throw invalid('评分案例集合与盲审案例不匹配');
  }
  const aggregated = new Map();
  const preference = new Map();
  let judgeCount = 0;
  const allJudgeIds = new Set();
  const judgementCaseIds = new Set();
  for (const [caseId, blindCase] of blindCases) {
    const sealed = sealedCases.get(caseId);
    if (!sealed || !sealed.labels || typeof sealed.labels !== 'object' || Array.isArray(sealed.labels)) {
      throw invalid(`${caseId} 缺少有效解盲标签`);
    }
    if (!blindCase.candidates || typeof blindCase.candidates !== 'object' || Array.isArray(blindCase.candidates)) {
      throw invalid(`${caseId} 缺少候选`);
    }
    const executorIds = new Set();
    const metricsByLabel = {};
    for (const label of labels) {
      const candidate = blindCase.candidates[label];
      const metric = sealed.labels[label];
      if (!candidate || !metric || !['completed', 'failed', 'interrupted'].includes(candidate.status)
        || candidate.status !== metric.status) throw invalid(`${caseId}/${label} 盲审与解盲运行状态不匹配`);
      if (candidate.status === 'completed' && typeof candidate.markdown !== 'string') {
        throw invalid(`${caseId}/${label} 已完成候选缺少正文`);
      }
      if (candidate.status !== 'completed' && candidate.markdown != null && typeof candidate.markdown !== 'string') {
        throw invalid(`${caseId}/${label} 候选正文无效`);
      }
      const executorId = requiredText(metric.executorId, `${caseId}/${label}.executorId`, 200);
      if (executorIds.has(executorId)) throw invalid(`${caseId} 的执行器必须不同`);
      executorIds.add(executorId);
      if (!Number.isSafeInteger(metric.retryCount) || metric.retryCount < 0) throw invalid(`${caseId}/${label}.retryCount 无效`);
      if (metric.recoverySucceeded !== null && typeof metric.recoverySucceeded !== 'boolean') {
        throw invalid(`${caseId}/${label}.recoverySucceeded 必须为布尔值或 null`);
      }
      if (metric.failureCode != null) text(metric.failureCode, `${caseId}/${label}.failureCode`, 100);
      metricsByLabel[label] = {
        ...metric,
        elapsedMs: finiteOrNull(metric.elapsedMs, `${caseId}/${label}.elapsedMs`),
        costMicrousd: finiteOrNull(metric.costMicrousd, `${caseId}/${label}.costMicrousd`),
        recoverySucceeded: metric.recoverySucceeded ?? null,
        failureCode: metric.failureCode ?? null,
      };
    }
    const entry = judgments.cases.filter(item => item.caseId === caseId);
    judgementCaseIds.add(caseId);
    const judgeIds = new Set();
    if (!entry.length) throw invalid(`${caseId} 尚无人工评分`);
    for (const judgement of entry) {
      const judgeId = text(judgement.judgeId, `${caseId}.judgeId`, 200);
      if (judgeIds.has(judgeId)) throw invalid(`${caseId} 的 judgeId 重复`);
      judgeIds.add(judgeId);
      allJudgeIds.add(judgeId);
      judgeCount++;
      if (!['A', 'B', 'tie', 'neither'].includes(judgement.preference)) throw invalid(`${caseId} 的偏好选择无效`);
      const ratings = Object.fromEntries(labels.map(label => [label, validateRating(judgement.ratings?.[label], caseId, label)]));
      const map = new Map(labels.map(label => [label, metricsByLabel[label].executorId]));
      if (judgement.preference === 'tie' || judgement.preference === 'neither') {
        preference.set(judgement.preference, (preference.get(judgement.preference) || 0) + 1);
      } else {
        const executorId = map.get(judgement.preference);
        preference.set(executorId, (preference.get(executorId) || 0) + 1);
      }
      for (const label of labels) {
        const executorId = map.get(label);
        const rating = ratings[label];
        const totals = aggregated.get(executorId) || { ratings: [], telemetry: [], telemetryCaseIds: new Set() };
        totals.ratings.push(rating);
        if (!totals.telemetryCaseIds.has(caseId)) {
          totals.telemetry.push(metricsByLabel[label]);
          totals.telemetryCaseIds.add(caseId);
        }
        aggregated.set(executorId, totals);
      }
    }
    if (judgeIds.size < 2) throw invalid(`${caseId} 至少需要两位不同评测者`);
  }
  if (judgementCaseIds.size !== blindCases.size || judgments.cases.some(item => !blindCases.has(item.caseId))) {
    throw invalid('评分包含未知案例或未覆盖全部案例');
  }
  const executors = Object.fromEntries([...aggregated].map(([executorId, totals]) => {
    const ratings = totals.ratings;
    const telemetry = totals.telemetry;
    const mean = field => ratings.reduce((sum, item) => sum + item[field], 0) / ratings.length;
    const available = field => telemetry.map(item => item[field]).filter(value => value !== null && value !== undefined);
    const elapsed = available('elapsedMs');
    const cost = available('costMicrousd');
    const recovery = telemetry.filter(item => item.recoverySucceeded !== null);
    const stats = {
      ratedCandidateCount: ratings.length,
      factAccuracyMean: mean('factAccuracy'),
      citationSupportMean: mean('citationSupport'),
      unsupportedFactCountMean: mean('unsupportedFactCount'),
      outOfScopeChangeCountMean: mean('outOfScopeChangeCount'),
      formatFollowedRate: ratings.filter(item => item.formatFollowed).length / ratings.length,
      safetyIssueRate: ratings.filter(item => item.safetyIssue).length / ratings.length,
      humanEditMinutesMean: ratings.map(item => item.editMinutes).filter(value => value !== null).length
        ? ratings.reduce((sum, item) => sum + (item.editMinutes || 0), 0) / ratings.filter(item => item.editMinutes !== null).length : null,
      failureRate: telemetry.filter(item => item.status !== 'completed').length / telemetry.length,
      recoverySuccessRate: recovery.length ? recovery.filter(item => item.recoverySucceeded).length / recovery.length : null,
      retryCountMean: telemetry.reduce((sum, item) => sum + item.retryCount, 0) / telemetry.length,
      elapsedMs: { coverage: elapsed.length / telemetry.length, mean: elapsed.length ? elapsed.reduce((a, b) => a + b, 0) / elapsed.length : null, median: median(elapsed) },
      costMicrousd: { coverage: cost.length / telemetry.length, mean: cost.length ? cost.reduce((a, b) => a + b, 0) / cost.length : null, median: median(cost) },
    };
    return [executorId, stats];
  }));
  return { schemaVersion: 1, runId: blindReview.runId, evaluationSetId: blindReview.evaluationSetId,
    evaluationSetVersion: blindReview.evaluationSetVersion, caseCount: blindCases.size, judgeCount: allJudgeIds.size,
    preferenceCounts: Object.fromEntries(preference), executors,
    interpretation: '描述性结果；不是统计显著性结论，不自动决定执行器准入。' };
}

function runtimePath(value) {
  if (typeof value !== 'string' || !value.trim()) throw invalid('评测文件路径不能为空');
  const resolved = path.resolve(root, value);
  const runtime = path.resolve(root, 'runtime');
  const runtimeRoot = runtime + path.sep;
  if (!resolved.startsWith(runtimeRoot)) throw invalid('评测工具只允许在仓库 runtime/ 下写入文件');
  let existing = resolved;
  while (true) {
    try {
      fs.lstatSync(existing);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw invalid('评测文件路径无效');
      const parent = path.dirname(existing);
      if (parent === existing) throw invalid('评测文件路径无效');
      existing = parent;
    }
  }
  const realRuntime = fs.realpathSync(runtime);
  let realExisting;
  try { realExisting = fs.realpathSync(existing); }
  catch { throw invalid('评测文件路径包含无效符号链接'); }
  if (realExisting !== realRuntime && !realExisting.startsWith(realRuntime + path.sep)) {
    throw invalid('评测文件路径不能通过符号链接离开 runtime/');
  }
  return resolved;
}

function writeJson(file, value, mode = 0o600) {
  let safeFile = runtimePath(file);
  fs.mkdirSync(path.dirname(safeFile), { recursive: true, mode: 0o700 });
  safeFile = runtimePath(safeFile);
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  let descriptor;
  try { descriptor = fs.openSync(safeFile, 'wx', mode); }
  catch (error) {
    if (error.code === 'EEXIST') throw invalid('评测产物已存在；请使用新的输出目录或文件路径，避免覆盖');
    throw error;
  }
  const identity = fs.fstatSync(descriptor);
  try {
    fs.writeFileSync(descriptor, serialized);
    fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    return { file: safeFile, dev: identity.dev, ino: identity.ino };
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
      descriptor = undefined;
    }
    try {
      const current = fs.lstatSync(safeFile);
      if (current.isFile() && current.dev === identity.dev && current.ino === identity.ino) fs.unlinkSync(safeFile);
    } catch {}
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function assertOutputAbsent(file) {
  const safeFile = runtimePath(file);
  try {
    fs.lstatSync(safeFile);
    throw invalid('评测产物已存在；请使用新的输出目录或文件路径，避免覆盖');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function removeCreatedFile(record) {
  try {
    const stat = fs.lstatSync(record.file);
    if (stat.isFile() && stat.dev === record.dev && stat.ino === record.ino) fs.unlinkSync(record.file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(runtimePath(file), 'utf8'));
}

function main(argv) {
  const [command, ...args] = argv;
  if (command === 'prepare' && args.length === 2) {
    const input = readJson(args[0]);
    const outputDir = runtimePath(args[1]);
    fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
    const result = buildBlindPackage(input);
    const blindFile = runtimePath(path.join(outputDir, 'blind-review.json'));
    const sealedFile = runtimePath(path.join(outputDir, 'sealed-metrics.json'));
    assertOutputAbsent(blindFile);
    assertOutputAbsent(sealedFile);
    const created = [];
    try {
      created.push(writeJson(blindFile, result.blindReview, 0o600));
      created.push(writeJson(sealedFile, result.sealedMetrics, 0o600));
    } catch (error) {
      for (const file of created.reverse()) removeCreatedFile(file);
      throw error;
    }
    process.stdout.write(`${JSON.stringify({ runId: result.blindReview.runId, blindReview: blindFile, sealedMetrics: sealedFile })}\n`);
    return;
  }
  if (command === 'summarize' && args.length === 4) {
    const result = summarize(readJson(args[0]), readJson(args[1]), readJson(args[2]));
    const outputFile = runtimePath(args[3]);
    writeJson(outputFile, result, 0o600);
    process.stdout.write(`${JSON.stringify({ runId: result.runId, caseCount: result.caseCount, judgeCount: result.judgeCount, output: outputFile })}\n`);
    return;
  }
  throw invalid('用法：prepare <input.json> <runtime/output-dir> | summarize <blind-review.json> <judgments.json> <sealed-metrics.json> <runtime/summary.json>');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.code || 'BLIND_EVAL_ERROR'}: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { buildBlindPackage, normalizeInput, summarize };
