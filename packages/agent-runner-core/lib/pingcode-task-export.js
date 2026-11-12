const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { imageReferences } = require('./source-image-resources');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');

const imageRoot = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'pingcode', 'task-resources');
const columns = ['编号', 'IR', '描述', '责任人', '产品', '版本', '状态', '开始时间', '结束时间', '输出件', '类型', '来源'];
const states = { pending_scope: '待处理', in_progress: '处理中', completed: '已完成' };
const types = { REQUIREMENT: '需求', TICKET: '工单' };

function safeCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function dateCell(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
}

function taskCsv(tasks) {
  const rows = [columns, ...tasks.map(task => [task.number, (task.ir || []).join(';'), task.description,
    task.ownerName || task.ownerId, task.product, task.version, states[task.status] || task.status,
    dateCell(task.plannedStartTime), dateCell(task.plannedEndTime), task.output,
    types[task.sourceType] || '', task.sourceUrl || task.source?.sourceUrl])];
  return '\uFEFF' + rows.map(row => row.map(safeCell).join(',')).join('\r\n') + '\r\n';
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
}

function sourceDocument(source) {
  const resources = source.resources || [];
  const byPath = new Map(resources.filter(item => item.state === 'READY').map(item => [item.path, item]));
  const byId = new Map(resources.filter(item => item.state === 'READY').map(item => [item.id, item]));
  let body = String(source.markdown || '');
  for (const ref of imageReferences(body).reverse()) {
    if (byPath.has(ref.href)) continue;
    const matching = byId.get(crypto.createHash('sha256').update(ref.href).digest('hex'));
    const alt = String(ref.alt || '图片').replace(/[\[\]<>\r\n]/g, ' ');
    body = body.slice(0, ref.start) + (matching ? `![${alt}](${matching.path})`
      : `[图片未能读取：${alt}]`) + body.slice(ref.end);
  }
  const list = resources.length ? resources.map(item =>
    `| ${markdownCell(item.state === 'READY' ? item.path : '—')} | ${markdownCell(item.state === 'READY' ? '已保存' : `未能读取（${item.errorCode || '未知原因'}）`)} |`).join('\n') : '| — | 无图片 |';
  return `# ${source.number}：${String(source.title || '').replace(/[\r\n]/g, ' ')}\n\n`
    + `| 字段 | 内容 |\n|---|---|\n| 类型 | ${types[source.type] || ''} |\n`
    + `| 关联 IR | ${markdownCell((source.ir || []).join('；'))} |\n`
    + `| Pingcode 来源 | ${markdownCell(source.sourceUrl)} |\n`
    + `| 来源更新时间 | ${markdownCell(source.sourceUpdatedAt)} |\n`
    + `| 平台确认时间 | ${markdownCell(source.confirmedAt)} |\n\n`
    + `## 描述\n\n${body}\n\n## 资源清单\n\n| 文件 | 状态 |\n|---|---|\n${list}\n`;
}

function sourceArchive(source, root = imageRoot) {
  const markdown = sourceDocument(source);
  const ready = (source.resources || []).filter(item => item.state === 'READY');
  if (!ready.length) return { filename: `${source.number}.md`, contentType: 'text/markdown; charset=utf-8',
    data: Buffer.from(markdown) };
  const zip = new AdmZip();
  zip.addFile(`${source.number}.md`, Buffer.from(markdown));
  for (const item of ready) {
    if (!/^assets\/[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(item.path || ''))
      throw Object.assign(new Error('来源图片路径无效'), { code: 'PINGCODE_RESOURCE_INVALID', status: 409 });
    const hash = item.path.match(/[a-f0-9]{64}/)[0];
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, hash)); }
    catch { throw Object.assign(new Error('来源图片文件不可用'), { code: 'PINGCODE_RESOURCE_UNAVAILABLE', status: 503 }); }
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== hash || bytes.length !== Number(item.byteCount))
      throw Object.assign(new Error('来源图片校验失败'), { code: 'PINGCODE_RESOURCE_CHANGED', status: 409 });
    zip.addFile(item.path, bytes);
  }
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({ schemaVersion: 1, number: source.number,
    sourceUrl: source.sourceUrl, runId: source.runId, resourceVersion: source.resourceVersion,
    confirmedAt: source.confirmedAt, bodySha256: source.bodySha256,
    resources: (source.resources || []).map(item => ({ path: item.state === 'READY' ? item.path : null,
      state: item.state, contentType: item.contentType, byteCount: item.byteCount,
      sha256: item.state === 'READY' ? item.path.match(/[a-f0-9]{64}/)[0] : null,
      errorCode: item.errorCode || null })) }, null, 2)));
  return { filename: `${source.number}.zip`, contentType: 'application/zip', data: zip.toBuffer() };
}

module.exports = { taskCsv, sourceDocument, sourceArchive };
