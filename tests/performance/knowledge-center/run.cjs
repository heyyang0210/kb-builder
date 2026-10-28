#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { cleanup } = require('./cleanup.cjs');
const { installProbe, resumeProbe, aggregate, finalizeEvidence } = require('./probe.cjs');
const root = path.resolve(__dirname, '../../..');
const { normalizeMarkdown } = require(path.join(root, 'packages/agent-runner-core/lib/handbook-production-service'));
function dependency(name) {
  for (const dir of ['', 'runtime/agent-runner', 'apps/knowledge-center-api']) {
    try { return createRequire(path.join(root, dir, 'package.json'))(name); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  throw Error(`缺少依赖 ${name}`);
}
const { chromium } = dependency('playwright');
const args = process.argv.slice(2);
const option = (key, fallback) => { const index = args.indexOf(key); return index < 0 ? fallback : args[index + 1]; };
const config = JSON.parse(fs.readFileSync(option('--config', path.join(__dirname, 'config.json')), 'utf8'));
const base = option('--base-url', process.env.KPG_BASE_URL || config.baseURL).replace(/\/$/, '');
const rounds = Number(option('--rounds', config.rounds));
if (!Number.isInteger(rounds) || rounds < 1) throw Error('轮次必须是正整数');
if (!args.includes('--current') && !args.includes('--isolated')) throw Error('必须显式选择 --current 当前环境或 --isolated 隔离测试环境');
if (args.includes('--current') && args.includes('--isolated')) throw Error('当前环境与隔离环境不可同时选择');
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
const output = path.resolve(option('--output', path.join(root, 'runtime/performance', `journeys-${runId}`)));
if (!output.startsWith(path.join(root, 'runtime') + path.sep)) throw Error('专项运行产物必须写入 runtime 目录');
fs.mkdirSync(output, { recursive: true });
const report = { runId, startedAt: new Date().toISOString(), base, rounds, config, samples: [], journeys: [], fixtures: {}, gaps: [], errors: [] };
const S = (selector, extra = {}) => ({ selector, ...extra });
const absent = selector => S(selector, { absent: true });
const step = (name, target, ready, extra = {}) => ({ name, target, ready, ...extra });
let browser, context, page, active;
function credentials() {
  const file = path.join(root, 'config/knowledge-center/.env');
  const local = fs.existsSync(file) ? Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(x => x && !x.startsWith('#') && x.includes('=')).map(x => [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1).replace(/^(['"])(.*)\1$/, '$2')])) : {};
  return { username: process.env.PERF_USERNAME || local.KNOWLEDGE_CENTER_ADMIN_USERNAME, password: process.env.PERF_PASSWORD || local.KNOWLEDGE_CENTER_ADMIN_PASSWORD };
}
async function api(method, endpoint, data) {
  const response = await context.request.fetch(base + '/knowledge-center/api/' + endpoint, { method, data, headers: { 'Idempotency-Key': `${runId}-${method}-${endpoint}` }, timeout: config.actionTimeoutMs });
  const body = await response.json();
  if (!response.ok() || body.success === false) throw Error(`准备接口 ${method} ${endpoint} HTTP ${response.status()} ${body.error?.code || ''}`);
  return body.data === undefined ? body : body.data;
}
async function prepareFixture() {
  const catalog = await api('GET', 'assets/handbooks?pageSize=1');
  const outlines = await api('GET', 'outline/governance/list');
  report.population = { handbooks: catalog.total, outlines: outlines.length };
  const source = outlines.find(x => x.name === config.handbookName);
  if (!source) throw Error('缺少配置指定的真实规模手册');
  report.fixtures.source = source;
  const owner = catalog.items[0];
  const name = `${config.testPrefix}-${runId}`;
  const handbook = await api('POST', 'assets/handbooks', { name, productId: String(owner.productId), ownerA: owner.ownerA, externalVisible: false, summary: '性能专项专用测试数据，测试结束自动归档。' });
  report.fixtures.handbook = handbook;
  // Persist ownership evidence immediately, even if later preparation fails.
  flush();
  const detail = await api('GET', `outline/governance/${encodeURIComponent(source.id)}`);
  const domain = detail.governance.effectiveDocumentAssignments.find(x => x.techDomainIds?.length)?.techDomainIds;
  if (!domain) throw Error('缺少有效技术领域，不能发布测试大纲');
  const nodes = ['00性能专项测试.md', '查询示例.md'].map((title, i) => ({ id: `perf-${runId}-${i}`, parentId: null, kind: 'document', title, path: title, level: 1, order: i + 1, description: '性能专项专用文档，演示SELECT查询语法与示例。', techDomainIds: domain }));
  const outline = await api('POST', 'outline/import', { handbookId: handbook.handbookId, productId: String(owner.productId), businessVersionTags: ['性能专项'], content: { schemaVersion: 'natural-path-v1', nodes } });
  report.fixtures.outline = { id: outline.id, handbookId: handbook.handbookId };
  flush();
  await api('POST', `outline/governance/${encodeURIComponent(outline.id)}/publish`, { editVersion: outline.editVersion || 1 });
}
function flush() { fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2)); }
async function measure(module, round, action) {
  const sample = { module, round, step: action.name, ai: !!action.ai, status: '失败', requests: [], pageErrors: [] };
  report.samples.push(sample); active = sample;
  const target = page.locator(action.target).first();
  try {
    await target.waitFor({ state: 'visible', timeout: config.actionTimeoutMs });
    const ready = typeof action.ready === 'function' ? await action.ready(target) : action.ready;
    const feedback = typeof action.feedback === 'function' ? await action.feedback(target) : action.feedback || ready;
    sample.feedbackDefinition = action.feedback ? '独立业务反馈' : '首个指定终态（未单独拆分早期反馈）';
    await page.evaluate(installProbe, { target: action.target, event: action.event || 'click', feedback, ready, failure: action.failure });
    sample.actionAt = Date.now();
    if (action.input !== undefined) await target.fill(action.input);
    else if (action.file) await target.setInputFiles(action.file);
    else if (action.select !== undefined) await target.selectOption(typeof action.select === 'function' ? await action.select(target) : action.select);
    else await target.click();
    await page.waitForFunction(() => Number.isFinite(window.__journeyProbe?.readyMs) || Number.isFinite(window.__journeyProbe?.failureMs), null, { timeout: action.timeoutMs || (action.ai ? config.aiTimeoutMs : config.actionTimeoutMs), polling: 'raf' });
    Object.assign(sample, await page.evaluate(() => {
      const probe = window.__journeyProbe;
      const resources = performance.getEntriesByType('resource').filter(x => performance.timeOrigin + x.startTime >= probe.startEpoch && new URL(x.name).pathname.includes('/api/')).map(x => ({ path: new URL(x.name).pathname, startMs: performance.timeOrigin + x.startTime - probe.startEpoch, durationMs: x.duration, bytes: x.decodedBodySize }));
      return { feedbackMs: probe.feedbackMs, readyMs: probe.readyMs, failureMs: probe.failureMs, resources, longTasks: (window.__journeyLongTasks || []).filter(x => performance.timeOrigin + x.start >= probe.startEpoch), domNodes: document.querySelectorAll('*').length };
    }));
    if (Number.isFinite(sample.failureMs)) throw Error('界面进入业务失败终态，不能作为生成完成');
    if (sample.requests.some(r => r.status >= 400 && !(r.status === 404 && r.path === `/knowledge-center/api/gitlab/mappings/${report.fixtures.handbook?.handbookId}`)) || sample.pageErrors.length) throw Error('该步骤发生接口或页面错误，见原始证据');
    if (action.verify) sample.verification = await action.verify();
    sample.status = '完成';
  } catch (error) {
    sample.error = error.message.split('\n')[0];
    if (sample.actionAt) try { Object.assign(sample, await page.evaluate(() => ({ feedbackMs: window.__journeyProbe?.feedbackMs, readyMs: window.__journeyProbe?.readyMs, failureMs: window.__journeyProbe?.failureMs }))); } catch (_) {}
    throw error;
  } finally {
    try { await page.evaluate(() => window.__journeyProbe?.stop?.()); } catch (_) {}
    const screenshot = `${String(report.samples.length).padStart(3, '0')}.png`;
    try { await page.screenshot({ path: path.join(output, screenshot), fullPage: false }); sample.screenshot = screenshot; } catch (_) {}
    active = null; flush();
    console.log(`${round} ${module} → ${action.name}: ${sample.status} 反馈=${sample.feedbackMs?.toFixed(1) ?? '-'}ms 就绪=${sample.readyMs?.toFixed(1) ?? '-'}ms`);
  }
}
async function journey(name, round, prepare, actions) {
  const entry = { name, round, status: '失败', plannedSteps: config.requiredSteps[name].length };
  report.journeys.push(entry);
  try { await prepare(); for (const action of actions) await measure(name, round, action); entry.status = '完成'; }
  catch (error) { entry.error = error.message.split('\n')[0]; try { entry.screenshot = `prepare-${round}-${config.requiredJourneys.indexOf(name)}.png`; await page.screenshot({ path: path.join(output, entry.screenshot) }); } catch (_) {} console.log(`链路失败 ${name}: ${entry.error}`); }
  flush();
}
const goto = async route => { await page.goto(base + '/knowledge-center/' + route, { waitUntil: 'domcontentloaded' }); };
const nav = (view, ready) => step('进入模块', `.nav-item[data-view="${view}"]`, ready);
async function verifyDraft(expected) {
  const main = page.locator('[data-handbook-current-document][data-outline-version-id]');
  const documentId = await main.getAttribute('data-handbook-current-document');
  const outlineVersionId = await main.getAttribute('data-outline-version-id');
  const value = await api('GET', `production/handbooks/${report.fixtures.handbook.handbookId}/documents/${documentId}/draft?` + new URLSearchParams({ outlineVersionId, branch: 'unmapped' }));
  const markdown = value.draft?.revision?.markdown;
  if (typeof markdown !== 'string' || markdown !== normalizeMarkdown(expected)) throw Error('真实API回读正文与本次保存内容（按现有Markdown规范化契约）不一致');
  return { documentId, outlineVersionId, sha256: createHash('sha256').update(markdown).digest('hex'), chars: markdown.length, persisted: true };
}
const fromTarget = (attribute, selector) => async target => {
  const value = await target.getAttribute(attribute);
  if (!value) throw Error(`目标缺少 ${attribute}`);
  return S(selector.replaceAll('$value', value.replace(/[\"\\]/g, '\\$&')));
};
async function runRound(round) {
  const source = report.fixtures.source;
  const own = report.fixtures.handbook;
  await journey('工作台', round, () => goto('assets'), [
    nav('dashboard', S('[data-domain-task-open]', { enabled: true })),
    step('打开页面任务明细', '[data-domain-task-open]', S('dialog[open] [data-domain-task-close]')),
    step('关闭任务明细', 'dialog[open] [data-domain-task-close]', absent('dialog[open]')),
  ]);
  await journey('知识资产', round, () => goto(''), [
    nav('assets', S('[data-asset-loaded="true"] [data-asset-id]')),
    step('选择手册', '[data-asset-id]', S('.asset-workspace.asset-detail-open')),
    step('新增手册表单', '[data-asset-create-open]', S('[data-asset-dialog-close]')),
    step('取消新增', '[data-asset-dialog-close]', absent('[data-asset-dialog-close]')),
  ]);
  await journey('大纲管理', round, () => goto('assets'), [
    nav('outlines', S('[data-outline-id]')),
    step('打开手册大纲', `[data-outline-id="${source.handbookId}"]`, S('[data-outline-document]')),
    step('选择另一篇文档', '[data-outline-document]:not([aria-current="page"])', fromTarget('data-outline-document', '[data-outline-document-panel="$value"]')),
  ]);
  await journey('模板管理', round, () => goto('assets'), [
    nav('templates', S('[data-template-id]')),
    step('选择模板', '[data-template-id]:not([aria-current="true"])', async target => ({ all: [S('.template-preview'), S(`[data-template-id="${await target.getAttribute('data-template-id')}"]`, { attribute: ['aria-current', 'true'] })] })),
    step('新建模板', '[data-template-new]', S('[data-template-create-blank]')),
    step('空白创建', '[data-template-create-blank]', S('[data-template-field="name"]')),
  ]);
  // Dedicated template save follows the creation chain, without changing existing templates.
  if (report.journeys.at(-1).status === '完成') {
    await page.locator('[data-template-field="name"]').fill(`${config.testPrefix}-${runId}-${round}`);
    await page.locator('[data-template-field="type"]').fill('性能专项');
    await page.locator('[data-template-field="description"]').fill('专用性能链路测试模板');
    await page.locator('[data-template-content]').fill(config.templateMarkdown);
    try { await measure('模板管理', round, step('保存专用模板', '[data-template-save]', S('[data-template-status]', { text: '保存成功' }))); report.fixtures.templateName = `${config.testPrefix}-${runId}-${round}`; }
    catch (_) { report.journeys.at(-1).status = '失败'; }
  }
  await journey('文档生产', round, () => goto('assets'), [
    nav('production', S('[data-handbook-href]')),
    step('点击SQL参考手册展开目录', `[data-handbook-href*="${source.handbookId}"]`, S('.handbook-production-directory.is-open [data-handbook-document]', { enabled: true })),
    step('选择对应文档', '.handbook-production-document:nth-of-type(2) [data-handbook-document]', { all: [absent('.handbook-document-skeleton'), absent('.handbook-production-directory.is-open'), S('[data-handbook-mode="edit"]', { enabled: true })] }, { feedback: S('[data-handbook-document-title]') }),
    step('进入编辑', '[data-handbook-mode="edit"]', S('[data-handbook-editor-format="markdown"]', { enabled: true })),
    step('切换Markdown编辑', '[data-handbook-editor-format="markdown"]', S('[data-handbook-markdown-editor]')),
    step('返回预览', '[data-handbook-mode="read"]', S('.handbook-production-editor.is-reading')),
  ]);
  if (own && report.fixtures.outline) {
    await journey('AI辅助写作', round, async () => {
      await goto(`production/handbook/${encodeURIComponent(own.handbookId)}`);
      await page.locator('[data-handbook-mode="edit"]').waitFor();
    }, [
      step('选择专用文档', '[data-handbook-document]:not([aria-current="page"])', async target => ({ all: [await fromTarget('data-handbook-document', '[data-handbook-current-document="$value"]')(target), absent('.handbook-production-directory.is-open')] })),
      step('编辑专用文档', '[data-handbook-mode="edit"]', S('[data-handbook-editor-format="markdown"]')),
      step('切换专用Markdown编辑', '[data-handbook-editor-format="markdown"]', S('[data-handbook-markdown-editor]')),
      step('输入专用正文', '[data-handbook-markdown-editor]', S('[data-handbook-markdown-editor]', { value: `本轮标识：${round}` }), { input: config.draftMarkdown + `\n本轮标识：${round}`, event: 'input' }),
      step('保存专用草稿', '[data-handbook-draft-save]', S('[data-handbook-save-status]', { text: '已保存|保存成功' }), { feedback: S('[data-handbook-save-status]', { text: '保存中|已保存|保存成功' }), verify: () => verifyDraft(config.draftMarkdown + `\n本轮标识：${round}`) }),
      step('打开AI辅助写作', '[data-handbook-ai-action="generate"]', S('[data-ai-settings-open]', { enabled: true })),
      step('打开生成设置', '[data-ai-settings-open]', S('[data-ai-settings-panel]:not([hidden]) [data-ai-operation]', { enabled: true })),
      step('添加资料入口', '[data-ai-source-add]', S('[data-ai-source-entry]:not([hidden])')),
      step('搜索专用模板', '[data-ai-settings-panel] .searchable-combobox-input', S('.searchable-combobox-listbox:not([hidden]) [role="option"]', { text: report.fixtures.templateName }), { input: report.fixtures.templateName, event: 'input' }),
      step('选择专用模板', '.searchable-combobox-listbox:not([hidden]) [role="option"]', { all: [S('[data-ai-settings-panel] .searchable-combobox-input', { value: report.fixtures.templateName }), absent('.searchable-combobox-listbox:not([hidden])')] }),
      step('应用生成设置', '[data-ai-settings-apply]', absent('[data-ai-settings-panel]:not([hidden])')),
    ]);
    if (report.journeys.at(-1).status === '完成') {
      try {
        await page.locator('[data-ai-requirements]').fill(config.aiRequirements + `\n运行标识：${runId}`);
        await measure('AI辅助写作', round, step('真实AI生成候选', '[data-ai-start]', S('[data-ai-candidate]:not([hidden]) [data-ai-fragment]', { value: '\\S' }), { ai: true, feedback: S('[data-ai-execution]:not([hidden]) [data-ai-status]', { text: config.aiFeedbackPattern }), failure: S('[data-ai-execution]:not([hidden]) [data-ai-status]', { text: config.aiFailurePattern }) }));
        const expected = await page.locator('[data-ai-fragment]').inputValue();
        await measure('AI辅助写作', round, step('采用并保存专用草稿', '[data-ai-adopt]', { all: [absent('[data-ai-adopt]'), S('[data-handbook-save-status]', { text: '已保存|保存成功' })] }, { verify: () => verifyDraft(expected) }));
      } catch (error) { report.journeys.at(-1).status = '失败'; report.journeys.at(-1).error = error.message.split('\n')[0]; }
    }
  } else { report.journeys.push({ name: 'AI辅助写作', round, status: '阻塞', error: '专用手册/大纲准备失败，禁止回退修改业务草稿' }); }
  await readJourneys(round, source);
}
async function readJourneys(round, source) {
  await journey('审核与发布', round, () => goto('assets'), [
    nav('review', S('.review-hub tbody a.review-count-link')),
    step('打开手册审核文档清单', `.review-count-link[href*="${source.handbookId}"]`, S('.review-hub tbody a[href*="taskId="]')),
    step('打开审核文档正文', '.review-hub tbody a[href*="taskId="]', S('.review-document-content .repository-markdown', { text: '\\S' })),
    step('切换修改对照', '[data-review-step="diff"]', S('.review-full-diff,.review-diff,.review-step-panel')),
    step('切换审核意见', '.review-steps [data-review-step="opinions"]', S('.review-steps [data-review-step="opinions"].active')),
  ]);
  await journey('仓库阅读', round, async () => {
    await goto(`assets/${source.handbookId}/repository`);
    await page.locator('[data-repository-file]').first().waitFor();
  }, [
    step('选择仓库文档', '[data-repository-file]:not([aria-current="page"])', S('.repository-markdown', { text: '\\S' })),
    step('收起仓库目录', '[data-navigation-pane-toggle]', S('.repository-workspace.navigation-pane-collapsed')),
  ]);
  await journey('资料清洗', round, () => goto('assets'), [
    nav('cleaning', S('[data-cleaning-upload-open]', { enabled: true })),
    step('打开上传资料', '[data-cleaning-upload-open]', S('[data-cleaning-upload-dialog][open]')),
    step('填写专用批次名', '[data-cleaning-upload-dialog][open] input[name="name"]', S('[data-cleaning-upload-dialog][open] input[name="name"]', { value: '性能专项' }), { input: `${config.testPrefix}-${runId}-${round}`, event: 'input' }),
    step('选择专用Markdown文件', '[data-cleaning-upload-dialog][open] input[type="file"]', S('[data-cleaning-upload-dialog][open] input[type="file"]', { value: 'perf-journey.md' }), { event: 'change', file: { name: 'perf-journey.md', mimeType: 'text/markdown', buffer: Buffer.from(config.draftMarkdown) } }),
    step('上传并创建资料批次', '[data-cleaning-upload-dialog][open] button[type="submit"]', S('.cleaning-workspace', { text: `${config.testPrefix}-${runId}-${round}` }), { timeoutMs: 45000 }),
  ]);
  const platformPrepare = async () => { await goto('platform?tab=models'); await page.locator('[data-model-default]').waitFor(); };
  await journey('系统治理', round, platformPrepare, [
    step('进入系统治理', '[data-platform-tab="governance"]', S('[data-database-open]', { enabled: true })),
    step('查看数据库连接', '[data-database-open]', S('[data-database-dialog][open]')),
    step('关闭数据库连接', '[data-database-close]', absent('[data-database-dialog][open]')),
  ]);
  await journey('人员管理', round, platformPrepare, [
    step('展开人员菜单', '.platform-tab-summary', S('.platform-tab-menu details[open] [data-team-group-view="people"]')),
    step('进入人员管理', '[data-team-group-view="people"]', S('[data-principal-edit]')),
    step('查看人员详情', '[data-principal-edit]', S('[data-principal-editor-dialog][open]')),
    step('关闭人员详情', '[data-principal-dialog-close]', absent('[data-principal-editor-dialog][open]')),
  ]);
  await journey('团队小组', round, platformPrepare, [
    step('展开人员菜单', '.platform-tab-summary', S('.platform-tab-menu details[open] [data-team-group-view="groups"]')),
    step('进入团队小组', '[data-team-group-view="groups"]', S('[data-team-group-form]')),
    step('添加团队小组表单', '[data-team-group-create]', S('[data-team-group-create-dialog][open]')),
    step('关闭团队表单', '[data-team-group-create-close]', absent('[data-team-group-create-dialog][open]')),
  ]);
  await journey('用户权限', round, platformPrepare, [
    step('进入用户权限', '[data-platform-tab="permissions"]', S('[data-permission-user]')),
    step('选择另一名用户', '[data-permission-user]:not([aria-selected="true"])', fromTarget('data-permission-user', '[data-permission-role-form][data-permission-user-id="$value"]')),
  ]);
  await journey('GitLab仓库', round, platformPrepare, [
    step('进入GitLab仓库', '[data-platform-tab="gitlab"]', S('[data-gitlab-edit]')),
    step('查看连接设置', '[data-gitlab-edit]', S('[data-gitlab-edit-form]')),
    step('取消连接编辑', '[data-gitlab-cancel-edit]', absent('[data-gitlab-edit-form]')),
  ]);
  await journey('MCP服务', round, platformPrepare, [
    step('进入MCP服务', '[data-platform-tab="mcp"]', S('[data-mcp-service]')),
    step('展开知识库', '.mcp-service-summary', S('.mcp-service-editor[open] [data-service-settings]')),
    step('查看连接设置', '[data-service-settings]', S('[data-connection-settings]:not([hidden])')),
    step('取消设置', '[data-service-cancel]', absent('[data-connection-settings]:not([hidden])')),
  ]);
  await journey('模型服务', round, async () => { await goto('platform?tab=governance'); await page.locator('[data-database-open]').waitFor(); }, [
    step('进入模型服务', '[data-platform-tab="models"]', S('[data-model-default]')),
    step('展开模型配置', '.model-service-summary', S('.model-service-editor[open] [name="models"]')),
    step('展开生成参数', '.model-service-editor[open] .model-advanced summary', S('.model-service-editor[open] [name="max_tokens"]')),
  ]);
}
function writeReport() {
  report.finishedAt = new Date().toISOString();
  finalizeEvidence(report);
  for (const item of config.unverifiedPaths || []) report.gaps.push(`${item.module} / ${item.path}：未验收；${item.reason}`);
  for (let round = 1; round <= rounds; round++) for (const [module, steps] of Object.entries(config.requiredSteps)) {
    for (const step of steps) if (!report.samples.some(s => s.round === round && s.module === module && s.step === step)) {
      report.samples.push({ module, round, step, status: '未执行', error: '起点准备或前序步骤失败，后续步骤未执行', requests: [], pageErrors: [] });
    }
  }
  report.summary = aggregate(report.samples, config);
  for (const name of config.requiredJourneys) {
    const journeys = report.journeys.filter(j => j.name === name);
    if (journeys.length !== rounds || journeys.some(j => j.status !== '完成')) report.gaps.push(`${name}：未完成所有轮次的连续链路`);
  }
  report.accepted = report.gaps.length === 0 && report.errors.length === 0 && report.summary.length > 0 && report.summary.every(x => x.passed);
  flush();
  const fmt = x => Number.isFinite(x) ? x.toFixed(1) : '—';
  const lines = ['# 知识中心功能链路性能专项报告', '', `运行：${runId}；环境：${base}；轮次：${rounds}；浏览器：${report.browserVersion || '未启动'}。`, '',
    `完整验收：**${report.accepted ? '通过' : '未通过'}**。测量从真实交互事件开始；界面时间为语义状态满足后的浏览器绘制机会。${rounds < 20 ? '当前为探索性样本，P95不作为稳定容量结论。' : ''}`, '',
    '| 模块 / 可见变化 | 样本 | 失败 | 反馈P50 ms | 反馈P95 ms | 就绪P50 ms | 就绪P95 ms | 最大 ms | 预算 |', '|---|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const row of report.summary) lines.push(`| ${row.step} | ${row.samples} | ${row.failures} | ${fmt(row.feedbackP50Ms)} | ${fmt(row.feedbackP95Ms)} | ${fmt(row.readyP50Ms)} | ${fmt(row.readyP95Ms)} | ${fmt(row.maxMs)} | ${row.passed ? '通过' : '未通过'} |`);
  lines.push('', '## 连续链路与失败证据', '', '| 轮次 | 模块 | 计划步骤 | 状态 | 原因 |', '|---:|---|---:|---|---|');
  for (const j of report.journeys) lines.push(`| ${j.round} | ${j.name} | ${j.plannedSteps || '—'} | ${j.status} | ${(j.error || '').replaceAll('|', '/')} |`);
  lines.push('', '## 逐轮界面变化时间', '', '| 轮次 | 模块 | 步骤 | 状态 | 指定反馈 ms | 成功就绪 ms | 失败提示 ms | 截图 / 原因 |', '|---:|---|---|---|---:|---:|---:|---|');
  for (const s of [...report.samples].sort((a,b) => a.round-b.round || config.requiredJourneys.indexOf(a.module)-config.requiredJourneys.indexOf(b.module))) lines.push(`| ${s.round} | ${s.module} | ${s.step} | ${s.status} | ${fmt(s.feedbackMs)} | ${fmt(s.readyMs)} | ${fmt(s.failureMs)} | ${[s.screenshot,s.error].filter(Boolean).join('；').replaceAll('|','/')} |`);
  lines.push('', '## 覆盖与运行边界', '', ...[...new Set([...config.limitations, ...report.gaps, ...report.errors])].map(x => '- ' + x), '', '## 原始证据', '', '`results.json` 包含每一步时间、请求状态/耗时、长任务、截图文件名和测试数据ID。每步截图位于本目录，成功与失败均保留。测试准备/截图/自动化等待不计入响应时间。未执行步骤不补写0毫秒。');
  fs.writeFileSync(path.join(output, 'report.md'), lines.join('\n') + '\n');
}
(async () => {
  try {
    browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
    context = await browser.newContext({ viewport: config.viewport });
    const health = await context.request.get(base + '/knowledge-center/api/auth/config');
    if (!health.ok()) throw Error('真实环境探活失败');
    if (args.includes('--isolated')) {
      const data = (await health.json()).data;
      if (data?.environment !== 'test' || !process.env.KNOWLEDGE_CENTER_TEST_RUN_ID || data.testRunId !== process.env.KNOWLEDGE_CENTER_TEST_RUN_ID) throw Error('隔离环境标识不匹配');
    }
    const auth = credentials();
    if (!auth.username || !auth.password) throw Error('缺少性能测试登录凭据（PERF_USERNAME/PERF_PASSWORD）');
    const login = await context.request.post(base + '/knowledge-center/api/auth/admin/login', { data: auth });
    if (!login.ok()) throw Error(`真实登录失败 HTTP ${login.status()}`);
    page = await context.newPage(); page.setDefaultTimeout(config.actionTimeoutMs);
    await page.addInitScript({ content: `const installProbe = ${installProbe.toString()}; (${resumeProbe.toString()})();` });
    await page.addInitScript(() => {
      window.__journeyLongTasks = [];
      new PerformanceObserver(list => window.__journeyLongTasks.push(...list.getEntries().map(x => ({ start: x.startTime, durationMs: x.duration })))).observe({ type: 'longtask', buffered: true });
    });
    const trackedRequests = new WeakMap();
    page.on('request', request => {
      if (active?.actionAt && new URL(request.url()).pathname.includes('/api/')) {
        const entry = { path: new URL(request.url()).pathname, method: request.method(), startMs: Date.now() - active.actionAt };
        active.requests.push(entry); trackedRequests.set(request, entry);
      }
    });
    page.on('response', async response => {
      const entry = trackedRequests.get(response.request()); if (!entry) return;
      entry.status = response.status();
      if (entry.path.includes('/ai-jobs/')) {
        try { const value = (await response.json()).data; entry.businessState = { status: value?.status, errorCode: value?.error?.code, stages: value?.stageRuns?.map(s => ({ stageId: s.stageId, status: s.status, errorCode: s.errorCode, startedAt: s.startedAt, endedAt: s.endedAt })) }; } catch (_) {}
      }
    });
    page.on('requestfinished', request => { const entry = trackedRequests.get(request); if (entry) { const timing = request.timing(); entry.durationMs = timing.responseEnd; } });
    page.on('requestfailed', request => { const entry = trackedRequests.get(request); if (entry) entry.error = request.failure()?.errorText; });
    page.on('pageerror', error => { if (active) active.pageErrors.push(error.message); });
    await goto('');
    report.visibleModules = await page.locator('.nav-item:visible').evaluateAll(nodes => nodes.map(x => x.dataset.view));
    for (const module of config.requiredModules) if (!report.visibleModules.includes(module)) report.gaps.push(`配置要求模块 ${module} 在本次账号导航中不可见`);
    for (const module of report.visibleModules) if (!config.requiredModules.includes(module)) report.gaps.push(`新增可见模块 ${module} 尚无专项链路契约`);
    try { await prepareFixture(); } catch (error) { report.errors.push(error.message); console.log('专用数据准备失败：' + error.message); }
    for (let round = 1; round <= rounds; round++) await runRound(round);
  } catch (error) { report.errors.push(error.message.split('\n')[0]); }
  finally {
    await page?.close();
    if (context && report.fixtures.handbook) {
      report.cleanup = await cleanup({ report, api, output, root, localDataRoot: option('--local-data-root', new URL(base).hostname === '127.0.0.1' ? path.join(root, 'runtime/pingcode/web') : undefined) });
      if (!report.cleanup.completed) report.errors.push('专项数据清理未完成，见 cleanup.json');
    }
    writeReport(); await browser?.close(); console.log(`专项报告：${path.relative(root, output)}/report.md`); process.exitCode = report.accepted ? 0 : 1; }
})();
