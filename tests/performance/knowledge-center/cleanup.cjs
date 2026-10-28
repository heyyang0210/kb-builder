const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function ownership(report) {
  if (!/^\d{4}-\d\d-\d\dT[\dTZ-]+-\d+$/.test(report.runId) || !report.config?.testPrefix || !Number.isInteger(report.rounds) || report.rounds < 1) throw Error('缺少有效运行归属');
  const name = `${report.config.testPrefix}-${report.runId}`;
  const h = report.fixtures.handbook, o = report.fixtures.outline;
  if (h && (h.name !== name || h.handbookId === report.fixtures.source?.handbookId)) throw Error('拒绝清理来源或非本次手册');
  if (o && (!h || o.handbookId !== h.handbookId || o.id === report.fixtures.source?.id)) throw Error('拒绝清理来源或非本次大纲');
  return { name, names: new Set(Array.from({ length: report.rounds }, (_, i) => `${name}-${i + 1}`)), h, o };
}
async function cleanup({ report, api, output, root, localDataRoot }) {
  const evidence = { startedAt: new Date().toISOString(), actions: [], errors: [] };
  const attempt = async (kind, fn) => { try { evidence.actions.push({ kind, result: await fn() }); } catch (e) { evidence.errors.push({ kind, error: e.message }); } };
  try {
    const { name, names, h, o } = ownership(report);
    const outlines = await api('GET', 'outline/governance/list');
    if (o && outlines.some(x => x.id === o.id)) await attempt('outline', async () => {
      const current = outlines.find(x => x.id === o.id);
      if (current.handbookId !== h.handbookId || current.name !== name) throw Error('当前大纲归属不一致');
      await api('DELETE', `outline/governance/${encodeURIComponent(o.id)}`, { reason: `专项收尾 ${report.runId}` });
      if ((await api('GET', 'outline/governance/list')).some(x => x.id === o.id)) throw Error('大纲清理回读失败');
      return { id: o.id, state: 'recycled' };
    });
    if (o && !outlines.some(x => x.id === o.id)) await attempt('outline-recycle-check', async () => {
      const recycle = await api('GET', 'outline/governance/recycle');
      if (!recycle.some(x => x.id === o.id && x.handbookId === h.handbookId && x.name === name)) throw Error('大纲未在回收站，归属无法确认');
      return { id: o.id, state: 'recycled' };
    });
    if (h) await attempt('handbook', async () => {
      const endpoint = `assets/handbooks?includeArchived=true&pageSize=100&handbookId=${encodeURIComponent(h.handbookId)}`;
      const current = (await api('GET', endpoint)).items.find(x => x.handbookId === h.handbookId);
      if (!current) throw Error('当前手册不存在');
      if (current.name !== name) throw Error('当前手册归属不一致');
      if (!current.archived) await api('POST', `assets/handbooks/${encodeURIComponent(h.handbookId)}/archive`, {});
      const after = (await api('GET', endpoint)).items.find(x => x.handbookId === h.handbookId);
      if (!after?.archived) throw Error('手册归档回读失败');
      return { id: h.handbookId, state: 'archived' };
    });
    await attempt('templates', async () => {
      const templates = await api('GET', 'templates'); const ids = [];
      for (const t of templates.filter(t => names.has(t.name) && t.status !== 'deleted')) {
        await api('DELETE', `templates/${encodeURIComponent(t.id)}`); ids.push(t.id);
      }
      if ((await api('GET', 'templates')).some(t => names.has(t.name) && t.status !== 'deleted')) throw Error('模板清理回读失败');
      return ids;
    });
    await attempt('uploads', async () => {
      const all = []; let page = 1;
      while (true) { const value = await api('GET', `cleaning/upload-sessions?page=${page++}&pageSize=100`); all.push(...value.items); if (!value.hasMore && all.length >= value.total) break; if (page > 1000) throw Error('上传分页异常'); }
      const plan = all.filter(x => names.has(x.name)).map(x => ({ sessionId: x.id, batchId: x.batchId || null, name: x.name }));
      if (!plan.length) return [];
      if (!localDataRoot || !fs.existsSync(path.join(localDataRoot, 'state.json'))) throw Error('上传清理缺少本地服务存储映射');
      const manifest = path.join(output, 'upload-cleanup-plan.json'); fs.writeFileSync(manifest, JSON.stringify(plan, null, 2));
      const result = JSON.parse(execFileSync('python3', [path.join(__dirname, 'cleanup-local.py'), root, localDataRoot, manifest], { encoding: 'utf8' }));
      for (const item of plan) {
        for (const endpoint of [`cleaning/upload-sessions/${item.sessionId}`, ...(item.batchId ? [`cleaning/material-batches/${item.batchId}`] : [])]) {
          try { await api('GET', endpoint); } catch (e) { if (/HTTP 404\b/.test(e.message)) continue; throw e; }
          throw Error(`上传清理后仍可读取 ${endpoint}`);
        }
      }
      return result.removed;
    });
  } catch (e) { evidence.errors.push({ kind: 'ownership', error: e.message }); }
  evidence.finishedAt = new Date().toISOString(); evidence.completed = !evidence.errors.length;
  fs.writeFileSync(path.join(output, 'cleanup.json'), JSON.stringify(evidence, null, 2));
  return evidence;
}
module.exports = { cleanup, ownership };
