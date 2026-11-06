const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { setup } = require('./fixtures/production-writing.cjs');
const artifacts = path.resolve('runtime/test-results/production-writing');
const coverageCases = process.env.KC_FRONTEND_ISTANBUL_CASE_DIR;
const frontendRoot = path.resolve('apps/knowledge-center-web/frontend/knowledge-center');
const coverageKey = '__kc_istanbul_coverage__';
let coverageCaseNumber = 0;
fs.mkdirSync(artifacts, { recursive: true });
const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
const suffix = '/handbooks/HB-1/documents/doc-1';
const initial = '# 安装准备\n\n前文相同。\n\n安装前，请确认环境满足部署要求，并准备所需文件。\n\n后文相同。\n';
const selected = '安装前，请确认环境满足部署要求，并准备所需文件。';

async function launch(t, ai = {}, fixtureOptions = {}) {
  const api = await setup(t, { ...fixtureOptions, browser: true, ai });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  if (coverageCases) {
    const { createInstrumenter } = require('istanbul-lib-instrument');
    const instrumenter = createInstrumenter({ esModules: true, coverageVariable: coverageKey, compact: false });
    await page.context().addInitScript(key => {
      if (location.pathname === '/browser-fixture') globalThis[key] = {};
    }, coverageKey);
    await page.route('**/knowledge-center/**/*.js', async route => {
      const pathname = new URL(route.request().url()).pathname;
      const relative = pathname.replace(/^\/knowledge-center\//, '');
      const file = path.resolve(frontendRoot, relative);
      if (!pathname.startsWith('/knowledge-center/') || !file.startsWith(frontendRoot + path.sep) || relative.split('/').includes('vendor') || !fs.existsSync(file)) {
        return route.continue();
      }
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      return route.fulfill({ response, body: instrumenter.instrumentSync(await response.text(), file) });
    });
    const caseFile = path.join(coverageCases, `${process.pid}-${++coverageCaseNumber}.json`);
    t.after(async () => {
      try {
        const coverage = await page.evaluate(key => globalThis[key] || {}, coverageKey);
        fs.mkdirSync(coverageCases, { recursive: true });
        fs.writeFileSync(caseFile, JSON.stringify(coverage));
      } finally {
        await browser.close();
      }
    });
  } else {
    t.after(() => browser.close());
  }
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(api.origin + '/browser-fixture');
  await page.addStyleTag({ url: '/knowledge-center/common/vendor/vditor/dist/index.css' });
  await page.addScriptTag({ url: '/knowledge-center/common/vendor/vditor/dist/index.min.js' });
  await page.evaluate(async ({ initial, ctx }) => {
    const { retainWritingSelection } = await import('/knowledge-center/modules/production/writing-selection.js');
    const { openProductionWritingPage } = await import('/knowledge-center/modules/production/production-writing-page.js');
    await new Promise(resolve => {
      window.editor = new Vditor(document.querySelector('[data-handbook-vditor]'), {
        cdn: location.origin + '/knowledge-center/common/vendor/vditor', mode: 'wysiwyg', lang: 'zh_CN',
        value: initial, cache: { enable: false }, after: resolve,
      });
    });
    window.getRange = retainWritingSelection(() => ({ editor: window.editor, element: document.querySelector('[data-handbook-vditor]') }));
    window.openWriting = (extra = {}) => openProductionWritingPage({
      context: { handbookId: 'HB-1', documentId: 'doc-1', ...ctx }, operation: 'polish',
      initialRange: window.getRange(), editVersion: window.version || 0, outline: '安装准备',
      onEdit: value => window.editor.setValue(value),
      getMarkdown: () => window.editor.getValue(), baselineDigest: async () => '',
      trigger: document.querySelector('#open-writing'),
      onAdopt: result => { window.saved = result; window.version = result.draft.editVersion; window.editor.setValue(result.draft.revision.markdown); }, ...extra,
    });
    document.querySelector('#open-writing').onclick = () => window.openWriting();
  }, { initial, ctx });
  return { api, page, errors };
}
async function selectText(page, text, collapsed = false) {
  await page.evaluate(({ text, collapsed }) => {
    const root = document.querySelector('.vditor-wysiwyg [contenteditable="true"]');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode())) {
      const offset = node.textContent.indexOf(text);
      if (offset < 0) continue;
      const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + text.length);
      if (collapsed) range.collapse(false);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange')); return;
    }
    throw new Error('Selection text not found');
  }, { text, collapsed });
}
async function waitCandidate(page) {
  try {
    await page.waitForFunction(() => !document.querySelector('[data-ai-candidate]')?.hidden && !document.querySelector('[data-ai-adopt]')?.disabled);
  } catch (error) {
    const state = await page.evaluate(() => ({
      status: document.querySelector('[data-ai-status]')?.textContent,
      phase: document.querySelector('[data-ai-phase]')?.textContent,
      startHint: document.querySelector('[data-ai-start-hint]')?.textContent,
      startDisabled: document.querySelector('[data-ai-start]')?.disabled,
      candidateHidden: document.querySelector('[data-ai-candidate]')?.hidden,
      candidateText: document.querySelector('[data-ai-candidate]')?.textContent,
    }));
    error.message += `; writing state: ${JSON.stringify(state)}`;
    throw error;
  }
}
async function screenshot(page, name) {
  if (name.includes('candidate')) await page.locator('[data-ai-candidate]').evaluate(el => el.scrollIntoView({ block: 'start' }));
  else await page.locator('.handbook-writing-page').evaluate(dialog => { dialog.scrollTop = 0; });
  await page.screenshot({ path: path.join(artifacts, name + '.png') });
}

async function openReferences(page) {
  if (await page.locator('[data-ai-settings-panel]').isVisible()) await page.locator('[data-ai-settings-apply]').click();
  if (!await page.locator('[data-ai-reference-panel]').isVisible()) await page.locator('[data-ai-source-add]').click();
}
async function closeReferences(page) {
  if (await page.locator('[data-ai-reference-panel]').isVisible()) await page.locator('[data-ai-reference-panel] footer button').click();
}
async function finishConfiguration(page) {
  await closeReferences(page);
  if (await page.locator('[data-ai-settings-panel]').isVisible()) await page.locator('[data-ai-settings-apply]').click();
}

test('Codex 实际活动在侧栏显示，运行中可原位中断', async t => {
  let execution;
  const selection = { serviceId: 'fixture', model: 'fixture', configVersion: 'v1', agentId: 'codex-fixture', executor: 'codex' };
  const { page, errors } = await launch(t, {
    modelGovernance: { available: () => ({ options: [selection], defaultSelection: selection }), resolve: () => ({ selection, config: { executor: 'codex', model: 'fixture' } }) },
    codexRunner: { preflight() {}, run(_messages, _config, current) { execution = current; return new Promise(() => {}); } },
  });
  await page.evaluate(() => window.openWriting({ initialRange: { start: 0, end: 6 } }));
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-start]')?.getAttribute('aria-label') === '中断生成');
  await page.waitForFunction(() => document.querySelector('[data-ai-stages]')?.textContent.includes('Codex CLI'));
  const at = new Date().toISOString();
  execution.onEvent({ kind: 'tool-started', tool: 'knowledge_search', itemId: 'call-1', status: 'running', seq: 1, at });
  execution.onEvent({ kind: 'tool-completed', tool: 'knowledge_search', itemId: 'call-1', status: 'completed', seq: 2, at });
  execution.onEvent({ kind: 'progress', text: '正在整理依据。', seq: 3, at });
  await page.waitForFunction(() => document.querySelector('[data-ai-agent-events]')?.textContent.includes('正在整理依据。'));
  assert.match(await page.locator('[data-ai-agent-events]').textContent(), /knowledge_search · 调用中/);
  assert.match(await page.locator('[data-ai-agent-events]').textContent(), /knowledge_search · 调用完成/);
  await page.screenshot({ path: path.join(artifacts, 'codex-actual-events.png') });
  await page.getByRole('button', { name: '中断生成', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-ai-status]')?.textContent.includes('已取消'));
  assert.equal(execution.signal.aborted, true);
  assert.deepEqual(errors, []);
});
test('网页资料多选按作者调整的引用优先级进入生成任务', async t => {
  let imageReads = 0;
  const web = http.createServer((req, res) => {
    if (req.url === '/diagram.png') { imageReads++; res.setHeader('Content-Type', 'image/png'); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAaQAAAB4CAIAAAAypRGCAAARW0lEQVR4nO3cd1hUV94H8N/A0HtXBEQFREAEFTAIiKKxYESNSTTRhJSNMQazeU1i4ppXMXHd16yJa2yRuJq1C66giUhRKYI0pUgTaVJUQKT3Mu8fV2fHGWPmQsK4Od/P4/PIPdw5Zc7Md+65dy6CwN1ZBADwR6ek6A4AAAwFIfff9sAJiu0HAMDvZO2hbMKRHQAwAmEHAExA2AEAExB2AMAEhB0AMAFhBwBMQNgBABMQdgDABIQdADABYQcATEDYAQATEHYAwASEHQAwAWEHAExA2AEAExB2AMAEhB0AMAFhBwBMQNgBABMQdgDABIQdADABYQcATEDYAQATEHYAwASEHQAwAWEHAExA2AEAExB2AMAEhB0AMAFhBwBMQNgBABMQdgDABIQdADABYQcATEDYAQATEHYAwASEHQAwAWEHAExA2AEAExB2AMAEhB0AMAFhBwBMQNgBABMQdgDABIQdADABYQcATEDYAQATEHYAwASEHQAwAWEHAExA2AEAExB2AMAEhB1ve45Ertkc0tvbp+iO/KJnv4e/K8c5QY5zgtJzbv2ROqDwQf0BCIemGcc5QdINC5V1NDXG2VpMc3da6u8lFCoPTU8G78CpmM7unsLSKie7kVxJdc2D8JgUIlq9fJ5Cu/aQbA8BYIjCjuPn6WxqpM/93NPTW3nvfnr2reRrhacjk3/Y+oGRgc5QdmbAZng6FxRXjrYcJi65U1O/50gkPTNhJ9tDABjSsFux0NfN2VaypOJO3VuffVdUfmf7gfC/frxiKDszYF9/FqjoLvyKZ7+HAENvSMNOlpW5yVtLZm7ZE5qYni9Z3tndc+xswoX4a+VVtX39Iitzk3m+E1csmq6uqiLeh1saH9q2xkBPe9+xCzeKKmrvN+poa7g6jA5cPMPVcbRUWz29fWEXkqMSMovL77a0d+hoatiOGv68t+uSOZ4qjy+iC0uq9h2PyiuqqHvQZKCn/dxE+9XL540wM5RqlwtuyRU693Pehe8G0Ki42vziyh9PX66pbzy58+NX1vxdIBBcPLLZ7NERsdiazSEXk3NeXzR93crFUr+S6qFkSd6tyjPRKdU19WqqKi4Oo4JW+NuPsWhobt19ODIhLfd+Q4uRvo63m8Pq5fOkDrSv5Zb8Myw2K7+srb3TxFDPaazV2y/NlF0md/f0hp5POh93rfj2XZFIZGlu4uPm8O7S2ZMXrpXqkpyz/FuRfyIGP9gndkDOwfKqE3hRcNgRkeVwYyLq6OoWl9yra1i5YW/x7bvDTAy8JjuISJSZV7rj4LmYpOwDWz/Q0dKQfHhhafX2H8J1tDQ8XOw0nG1yb1bEJmVfTM759N1Fry+aLt6tpr7xvQ37isqq1dVUPSbYmhjp1dU3pWYVpWXfCotM3vflKhNDXW7P+NTcoOCQvv5+z0n2bhNsM3JuRcSkJqblhe1ZJ5s4RLTsBZ/a+saLyTncz5K/kr9RscSMggOnYkaOMFk4y8PJbuRoq2GlFfdirmQvD5gmuVtHZ3dSRgERBcx0l/+pDo9JPR93bZqHk4ONZUrWzbiU3NSsosPbP/rmQERhSZW3u2N7R1diev7Jn6+k5dw6vmOt+Kk+E53yxbfHBESek8aZGukWFFdFJ2bFpeQe3LbGZdyo/4z3fuOq/913s7RaX1fL281BQ101q6B8/4nougfNsp3hNcuDxGsiFDhYXnUCX4oPu7LKGiKyszbnNnt6+4KCQ4pv3311gc8nf1qkqiIkoraOrk+2HoxPy9u2/99ffvSa5MN3HDw3x2fipg+XqqupciWHTl/6OuTMtv1nHGwsJ4+3IaLe3r6g4JCismoXh1E7NrwjfmXX1jd9+OUPOYXlazaHHNn+kbKyEldhX3//ymWz17wxn4i6e3rf/HRnVkHZ1r2nd2x4W7b/G1a/lJ5ziwu7DatfEpfzalTsUNjFj99ZGPjiDIFAQEQLZ7p/88+zUQmZUmEXl5rb2d0zdvQI+zEW8j/V5y6lH/hbkNt4GyLq7Ope9udvisqq3/7sO3VV1fB967lDufLq2pc+2FZWWRMRm8Y12tTSvmVPqEgk2rVppe8UJ66qT7YeOh9/LeRk9O5NK8UT9/7G72+WVvt5Om/95HUtDTUiEolEJ3++smV3qFRP+M7yYPCaCAUOlledMAAK/upJ8e27ISejlZWV1gTO50oiYlPziyud7a0/X7WEe1kQkZaG2sYPl6qqCCNi0+43PPYpN9zU4Kv/eU2cdEQU+OIMN2dbkUi052gkV/LT5Yy8ogo9Hc1dm96V/Aw3NdLbtfFdXW3NnMLyny5ncIWlVTVENMHemttUVRG+9+occ1PDssqavv5++YfGq1Exb3eHN5f4cUlHRPP93JQEgqz8UqnP9ugrmUS0cJaH/P0hIh83Ry7piEhdTfVl/6lE1NTSHvjiDPGi1XqEqfdkByLKuFHMlSRdL+jo7LYZOVz85ieiOdMmElFmXqm4JCImtbCkaripwbZ1b3BvVCISCARL53svX+gr1RO+szwYvCZCgYPlVScMwJCG3eHwuK92h3L/gneeePuzXUtW/5+xge7+Le9PcRnL7XMh/joRLfBzU3r0hueYGemPG2PR19efnlMsWb7Az132ayuvL/Ilooyc4raOLiL66VI6EQXM8jDQ1Zba08hAh1sJ/nQ5nSsZbmJARKGRyZ2PVtbebg4x/wqO+H69shKPp4tXo2LPT3WR3DQz0p/iOrZfJIq5kiUu7OzqTkjLFwqV589wk78/RDTFdazkprmp4aNyu8fKzQyJqLWtg9v0dLUP37d+75fvSe7Drby4p5cTlZhJRAEzPSQ/eDiLZz8nVcJ3lgeD10QocLC86oQBGNJlLLfWk+Jga+k2/j8nrQtLqonoaubNkooaqT2bW9uJ6G5dg2SheP0rW9jX3195p85+jEVBSRURuY6TvmTBcXEYdTg8rrC4itv8MPCFT/926HLKjVlvbJrj4+rn6ew23lZqsSkPXo2KmRrrS5UEzPRIvl4YlZj56oKHJwQT0vI7u7pnPOdsqCf97n06CzMjyU011YezP2KY8WPlKkIi6u17eBirr6ulr6tV96D5dNTVwpKqe3WNHZ1dD5paiUjye8uFpdVE5GBjKduulbmxVAnfWeZ89fhqTvKkwVPwmggFDpZXnTAAQxp2khfjenv7UrJu/mX70fCY1GEmBkGv+3PlzW3t9AuxKH6g5KaWpprsPmYmBtwPnV09RNTS1kFEOtpPPuetq61JRM2PDmTmTps4coTJjoPnUjJvHjubcOxsgqmR3rvLZi/19xI8/sn8dLwaFRPKpOrMqc5aGmrXc0vuNzQbG+jSozVswCwelyY4GuqPHTKID1SlypW4PohE3Ga/SPSPQ+d+PH2pp7fP1EhvlKWZhrqqilD6ldPU0kZEGjJHJUQkXruJ8Z1lzvFzCZKbcoYdr4lQ4GB51QkDoLAnUShU9prs8PmqF9f+9eCpn6+Iw05TXa2lrSNky2rPSfby1NPd0ytb2P5oxaGrrUFEOloajc1t3KeoLK5cV+Lyn4ON5f4t79c3tEQnZZ2LTcsuLP9q16nyyprPVy2Rf4B8G/0l6mqqs31c/x2VEpOUvWy+d1d3T3xanoGutq+7068+VoqS0pPDWumpIX4wNPaHkzEGutpffx743KOFcHrOrcBPdz7WT1WVto6umvpG2RokF4AcvrPMkfxOj/x4TYQCB8urThgABV+gmObupKyk9KCp9U7tA65k5AhTIhJvSvrpUkbYhWSpV0PFnTrZPQtKKolIQ13VytyEiMaNsSCirPyyJ/aBO/FsbyN9WdPIQGfZfO9jO9Zyl2WPnk3gddZ8YI0+UcBMDyKKSsgkosSM/PaOLv/pk4bsBrtT55OIKOgN/+ckTvk1NrdJ7WZtaUZEReV3ZGu4VSZdyHeWB4PXRChwsLzqhAFQcNhpqKtyp8Mr79znSrwmj6MnHfOXVdas2/Zj8D9OCOixw5CI2DTRowWX2PFziUQ0fcp4LhHm+U4moojYVO7ki6T6hpaIi2lENN93MhGdjrrqPO9D31f/0i9RJ3eyTCQSVd2rf/pwJHsif6O/apLTGIthRtdzSx40tkQnZhHRwuenyPPA38S9+41ENOzRmQHOjaIKqd24I80z0SmyhyFhF5KlSvjO8mDwmggFDpZXnTAAiv+rJ9YWpkRUXl3Lbb76go+ejmZCet6RiHjxPvUNLeu2/UhEc30nmRrpST78xs3bm787KV7MikSi/SeiY5OytTTUVq94eKfqAj83BxvLppb2oOD9kt/hqK1vCgre39La4WQ3kruyOc3dUVlZqe5B88Gwi+LdUrOKiEhJILAY9tgJfjGh8sODrHt1jeJC+Rv9VQKB4AU/977+/p/jrsWn5tqNGjGOz9frBom7deRyyg1xSX5xpfj0mfiZX/qCt4Gudktrx8Ydx7q6e7hCkUj0rzOXueuMkvjO8gCIL7DwmggFDpZXnTAAij/x6WhrlZien5Vf9oq/FxEZGejs2PBOUPD+rXvDTkcmO9tbNzS3pmTebOvommBv/cXql6UeHjDL49T5pEtXb0xxtVMRCjPzSsura3W1Nb/d8Jb1CFNuH6FQ+buNf1q5YW9WftmcN4M9XOxMjfRq65tSs4o6u7rtrM13bnyHu95qbKC7buXiL3ed+uZARMyVLDtr85r6pqvXC4nozSV+3PUBWaOthikrKfX197/3xV4HG8utn6zg1ag8Ama67z0aufvI+db2zkU8v143SCuXzl6//Ujo+aTCkir7MRY1dY3JmYUBfu6no64SUWt7J3dR2FBP+9sNb72/8fvI+OvXckumuIxVVlbipmPTmqWbdp6QrJPvLPOirane2t75/fEoobKSm7Mtr4lQ4GB51QkDoPiwm+buuO/YhUtXcxqb2/R1tYjIfYJt+L71B0JjEzPyI2JTVVSEdqPMF/i5L5njKZsOi2Z5OI8deTY27UpGQUdnt7mZ4ZtL/N5YPEPqTqxhJgahuz4Ni0yOSszMLihraevQ0dIYb2f1vLfrkrmekle7ls73drKzOhAam1dUce5SuqG+ztRJ45Yt8PZxc/ylIejpaH7xwct7j14oq6yprW8aQKO/ynK48UTHMdfzSpSVlebPkGvx+1sJmOVhbKgbciK6qPxOacU9czPD91+b+4q/F/f+r7nfKP4GjJuzbfi+9SEno5MyCiLjr+nrao2xGr7uvcVTJ47j3qsqEkPmNcu8rHpt7vfHo67nluQUlnNX/+WfiMEP1sfNUTaY5BwsrzqBL0Hg7iwi2h44QdE94U32dvc/tiMR8Vv3hvlOcRLftPRMOXU+KS7lxvPerrL3dVTdq58duImIog5utBiOr4zBUFt7KJuehXN2ICfur9S+PM9L0R15sr6+vvi0vJM/X5H9VVTCdSIyM9ZH0oECIez+O8Sl5F5MznG0tfRxc1B0X55slpeLuppqTmH53qORkjcRX8nI5/6y6dsvzVRc7wCegXN28HTBO0/crWtIyijQVFf9au1yXndxDCVjA93Nf172+d8P7zp8Pjw2bbydlaa6WlH5nRs3bxPRK/5e4tvdABQCYfesOx11VUdLY5qH09p3Fo6yMFV0d57Gf/pk21HmR87EZeQWX7p6o6+/30hPZ5aXy8tzp/K6UwLg9/BffIECAEAeuEABAAxB2AEAExB2AMAEhB0AMAFhBwBMQNgBABMQdgDABIQdADABYQcATEDYAQATEHYAwASEHQAwAWEHAExA2AEAExB2AMAEhB0AMAFhBwBMQNgBABMQdgDABIQdADABYQcATEDYAQATEHYAwASEHQAwAWEHAExA2AEAExB2AMAEhB0AMAFhBwBMQNgBABMQdgDABIQdADABYQcATEDYAQATEHYAwASEHQAwAWEHAExA2AEAExB2AMAEhB0AMEEQuDtL0X0AAPjd4cgOAJjw/znpB9kfJZrCAAAAAElFTkSuQmCC', 'base64')); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<html><head><title>${req.url === '/a' ? '甲资料' : '乙资料'}</title></head><body><main><h1>${req.url === '/a' ? '甲资料' : '乙资料'}</h1><p>${req.url === '/a' ? '甲事实' : '乙事实'}</p>${req.url === '/a' ? '<img src="/diagram.png" alt="结构图"><p>&lt;img src=x onerror=alert(1)&gt;</p>' : ''}</main></body></html>`);
  });
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  t.after(() => { web.closeAllConnections(); web.close(); });
  const origin = 'http://public.example';
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  rules.sources.urlOrigins = [origin];
  rules.sources.lookup = async () => [{ address: '1.1.1.1', family: 4 }];
  rules.sources.receive = (url, _address, signal) => new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: web.address().port, path: url.pathname, signal }, resolve);
    request.on('error', reject);
  });
  const calls = [];
  const { api, page, errors } = await launch(t, { rules, generate: async messages => {
    calls.push(JSON.parse(messages.at(-1).content));
    return { content: '整理后的正文', model: 'deterministic-e2e' };
  } });
  let jobId;
  page.on('response', async response => {
    if (response.request().method() === 'POST' && response.url().includes('/ai-jobs')) {
      try { jobId = (await response.json()).data.jobId; } catch (_) {}
    }
  });
  await page.evaluate(() => window.openWriting({ initialRange: { start: 0, end: 6 } }));
  await page.locator('[data-ai-settings-open]').click();
  await openReferences(page);
  await page.locator('[data-reference-type=\"url\"]').click();
  for (const path of ['/a', '/b']) {
    if (path === '/b') await openReferences(page);
    await page.locator('[data-ai-source-locator]').fill(origin + path);
    await page.locator('[data-ai-source-preview]').click();
    await page.waitForFunction(count => document.querySelectorAll('[data-ai-source-list] section').length === count && !document.querySelector('[data-ai-source-preview]').disabled, path === '/a' ? 2 : 3);
    assert.equal(await page.locator('[data-ai-source-list] section').last().locator('input[type="checkbox"]').isChecked(), true);
  }
  assert.match(await page.locator('[data-ai-source-count]').textContent(), /3 项/);
  assert.equal(await page.locator('[data-ai-model]').count(), 0);
  await openReferences(page);
  const previewPagePromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '预览资料：甲资料' }).click();
  const previewPage = await previewPagePromise;
  assert.match(await previewPage.locator('main').textContent(), /甲事实/);
  assert.match(await previewPage.locator('header').textContent(), /甲资料/);
  assert.equal(await previewPage.getByRole('button', { name: '阅读视图' }).getAttribute('aria-pressed'), 'true');
  await previewPage.locator('#reading img').waitFor({ state: 'attached' });
  if (coverageCases) {
    const imageUrl = await previewPage.locator('#reading img').getAttribute('src');
    const response = await previewPage.request.get(new URL(imageUrl, api.origin).href);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'] || '', /^image\/png/);
    assert.ok((await response.body()).length > 0);
  } else {
    await previewPage.locator('#reading img').evaluate(img => img.scrollIntoView({ block: 'center' }));
    await previewPage.waitForFunction(() => {
      const img = document.querySelector('#reading img');
      return img?.complete && img.naturalWidth > 0;
    });
    assert.ok(await previewPage.locator('#reading img').evaluate(img => img.naturalWidth > 0));
  }
  assert.ok(imageReads > 0);
  assert.equal(await previewPage.locator('#reading img[onerror]').count(), 0);
  await previewPage.screenshot({ path: path.join(artifacts, 'source-reading-preview.png'), fullPage: true });
  await previewPage.getByRole('button', { name: '原始内容' }).click();
  assert.equal(await previewPage.locator('#raw').isVisible(), true);
  assert.equal(await previewPage.locator('#reading').isVisible(), false);
  assert.match(await previewPage.locator('#raw').textContent(), /!\[结构图\]/);
  await previewPage.getByRole('button', { name: '阅读视图' }).click();
  assert.equal(await previewPage.locator('#reading').isVisible(), true);
  await previewPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(await previewPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await previewPage.screenshot({ path: path.join(artifacts, 'source-reading-preview-mobile.png'), fullPage: true });
  await previewPage.close();
  assert.deepEqual(await page.locator('[data-source-priority]').allTextContents(), ['01', '02', '03']);
  await page.getByRole('button', { name: '调整优先级：乙资料' }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  assert.deepEqual(await page.locator('[data-ai-source-list] section label').allTextContents(), ['知识库（MCP）', '乙资料', '甲资料']);
  assert.deepEqual(await page.locator('[data-source-priority]').allTextContents(), ['01', '02', '03']);
  await page.getByRole('button', { name: '调整优先级：知识库（MCP）' }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  assert.equal(await page.locator('[data-ai-source-list] section').first().locator('.handbook-source-title').textContent(), '知识库（MCP）');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('[data-ai-settings-panel] .handbook-ai-settings-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.screenshot({ path: path.join(artifacts, 'mobile-source-priority.png') });
  await finishConfiguration(page);
  await page.locator('[data-ai-start]').click();
  await waitCandidate(page);
  const response = await api.request('GET', `${suffix}/ai-jobs/${jobId}?${new URLSearchParams(ctx)}`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const sources = response.body.data.sourceSnapshots;
  assert.deepEqual(sources.map(source => [source.title, source.priority]), [['乙资料', 1], ['甲资料', 2]]);
  assert.deepEqual(calls[0].sources.map(source => [source.title, source.priority]), [['乙资料', 1], ['甲资料', 2]]);
  assert.deepEqual(errors, []);
});

test('任务创建写入失败时停止假进度，明确说明模型尚未调用', async t => {
  const store = { read: () => ({ schemaVersion: 1, drafts: {}, attachments: {}, reviewBatches: [], idempotency: {}, audits: [] }), transaction() { throw new Error('引用了已删除的大纲版本，不能保存本次新增或修改的数据'); } };
  const { page, errors } = await launch(t, { generate: async () => { throw new Error('不应调用模型'); } }, { store });
  await page.locator('#open-writing').click();
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-phase]')?.textContent === '任务创建失败');
  assert.equal(await page.locator('[data-ai-elapsed]').textContent(), '尚未调用模型');
  assert.match(await page.locator('[data-ai-status]').textContent(), /无法生成/);
  assert.equal(await page.locator('[data-ai-preview-wait]').isVisible(), false);
  assert.equal(await page.getByRole('button', { name: '中断生成' }).count(), 0);
  assert.deepEqual(errors, []);
});

test('真实编辑器与 HTTP：范围继承、重生成恢复、取消、候选采用回读及版本冲突', async t => {
  let release; const calls = [];
  const { api, page, errors } = await launch(t, { generate: async messages => {
    const payload = JSON.parse(messages.at(-1).content); calls.push(payload);
    if (payload.requirements === '测试失败') throw new Error('测试生成失败');
    if (payload.requirements === '等待取消') return new Promise(resolve => { release = resolve; });
    return { content: payload.requirements === '更简洁' ? '确认部署环境，并备齐安装文件。' : '请确认部署环境符合要求，并备齐所需安装文件。', model: 'deterministic-e2e' };
  } });
  await selectText(page, selected);
  const range = await page.evaluate(() => window.getRange());
  assert.deepEqual(range, { start: initial.indexOf(selected), end: initial.indexOf(selected) + selected.length });
  await page.locator('#open-writing').click();
  assert.match(await page.locator('[data-ai-range]').textContent(), /修订范围：选中/);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(new URL(page.url()).searchParams.get('writing'), 'polish');
  assert.equal(await page.locator('.handbook-writing-page').evaluate(el => el.parentElement.id), 'view-root');
  assert.equal(await page.locator('[data-ai-sources]').getAttribute('open'), null);
  assert.ok(await page.locator('.handbook-writing-page').evaluate(el => el.clientWidth) > 1000);
  const columns = await page.locator('.handbook-writing-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length); assert.equal(columns, 2);
  const assistant = page.locator('.handbook-writing-assistant');
  assert.equal(await page.locator('[data-ai-cancel]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-resume]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-operation]').isVisible(), false, '低频写作方式收纳到设置');
  const compact = await assistant.boundingBox();
  assert.ok(compact.height <= 700, `初始侧栏应紧凑，实际高度 ${compact.height}`);
  fs.writeFileSync(path.join(artifacts, 'assistant-density.json'), JSON.stringify({ viewport: '1366x900', width: compact.width, height: compact.height, idleCancelVisible: false, emptyResumeVisible: false }, null, 2));
  await screenshot(page, 'desktop-writing');
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(calls[0].selectedContent, selected);
  assert.equal((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.exists, false);
  await page.locator('[data-ai-manual-edit]').click();
  await page.locator('[data-ai-fragment]').fill('人工微调的候选');
  await page.locator('[data-ai-refine]').click();
  assert.equal(await page.locator('[data-ai-requirements]').evaluate(el => el === document.activeElement), true);
  await page.locator('[data-ai-requirements]').fill('测试失败');
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-status]').textContent.includes('上次候选仍保留'));
  assert.equal(await page.locator('[data-ai-fragment]').inputValue(), '人工微调的候选');
  await page.locator('[data-ai-requirements]').fill('等待取消'); await page.locator('[data-ai-start]').click();
  await page.getByRole('button', { name: '中断生成', exact: true }).click();
  await waitCandidate(page); assert.equal(await page.locator('[data-ai-fragment]').inputValue(), '人工微调的候选');
  release({ content: '迟到内容' });
  await page.locator('[data-ai-requirements]').fill('更简洁'); await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-fragment]').inputValue(), '确认部署环境，并备齐安装文件。');
  await screenshot(page, 'desktop-candidate');
  await page.locator('[data-ai-close]').click();
  await page.locator('#open-writing').click(); await page.locator('[data-ai-resume]').click(); await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-before]').inputValue(), selected);
  await page.locator('[data-ai-manual-edit]').click();
  await page.locator('[data-ai-fragment]').fill('先确认部署环境，再备齐文件。'); await page.locator('[data-ai-adopt]').click();
  await page.waitForFunction(() => !!window.saved);
  const reread = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(reread.status, 200); assert.equal(reread.body.data.draft.revision.markdown, initial.replace(selected, '先确认部署环境，再备齐文件。'));
  assert.ok(reread.body.data.draft.revision.generationMetadata.provenance.some(item => item.kind === 'human_edit'));
  // A second author saves after generation. Adoption must retain the newer draft.
  await page.evaluate(() => window.openWriting({ initialRange: { start: 0, end: 6 } }));
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  const newer = await api.request('PUT', suffix + '/draft', JSON.stringify({ ...ctx, editVersion: 1, markdown: '其他作者的新正文' }), { 'Content-Type': 'application/json', 'Idempotency-Key': 'writing-conflict' });
  assert.equal(newer.status, 200, JSON.stringify(newer.body));
  await page.locator('[data-ai-adopt]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-status]').textContent.includes('采用未完成'));
  assert.match((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.draft.revision.markdown, /其他作者的新正文/);
  assert.equal(await page.locator('[data-ai-candidate]').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('选区边界、续写、自动范围、资料与窄屏键盘访问', async t => {
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: '续写内容', model: 'deterministic-e2e' }) });
  // Real Lute conversion must preserve Markdown offsets with bold and repeated text.
  await page.evaluate(() => window.editor.setValue('重复段落。\n\n重复段落。\n\n请**检查环境**后继续。\n'));
  await selectText(page, '检查环境');
  assert.deepEqual(await page.evaluate(() => window.getRange()), { start: 17, end: 21 });
  assert.equal(await page.evaluate(async () => {
    const { markdownRangeFromDOM } = await import('/knowledge-center/modules/production/writing-selection.js');
    return markdownRangeFromDOM(window.editor, document.querySelector('[data-handbook-vditor]'), window.getSelection().getRangeAt(0), '内容已变化');
  }), null);
  await selectText(page, '后继续。', true);
  const caret = await page.evaluate(() => window.getRange()); assert.equal(caret.start, caret.end);
  await page.evaluate(() => window.openWriting({ operation: 'continue' }));
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-before]').inputValue(), '');
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.saved);
  assert.ok((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.draft.revision.markdown.includes('续写内容'));
  await page.evaluate(() => window.openWriting({ initialRange: null }));
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled); assert.equal(await page.locator('[data-ai-start]').isEnabled(), true);
  await page.locator('[data-ai-settings-open]').click();
  await openReferences(page);
  await page.locator('[data-ai-source-type] option[value="test-case-library"]').waitFor({ state: 'attached' });
  await page.locator('[data-reference-type=\"test-case-library\"]').click();
  await page.locator('[data-ai-source-locator]').fill('ai-quality-smoke-select.sql'); await page.locator('[data-ai-source-preview]').click();
  const checkbox = page.locator('[data-ai-source-list] input[type="checkbox"]').last(); await checkbox.waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-source-list] section').length === 2);
  assert.equal(await checkbox.isChecked(), true);
  await closeReferences(page);
  assert.match(await page.locator('[data-ai-source-count]').textContent(), /2 项/);
  assert.equal(await page.locator('[data-ai-source-list] textarea').isVisible(), false);
  await openReferences(page);
  await page.locator('[data-ai-source-list] section').last().getByRole('button', { name: /^移除：/ }).click();
  await closeReferences(page);
  assert.match(await page.locator('[data-ai-source-count]').textContent(), /1 项/);
  await finishConfiguration(page);
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, 'mobile-writing');
  assert.deepEqual(await page.locator('[data-ai-original]').evaluate(el => {
    const style = getComputedStyle(el);
    return { overflow: style.overflowY, fits: el.scrollHeight <= el.clientHeight + 1, border: style.borderTopWidth };
  }), { overflow: 'hidden', fits: true, border: '0px' }, '窄屏正文无框并随内容伸展，无输入区内部滚动');
  await page.locator('[data-ai-start]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, 'mobile-writing-controls.png') });
  assert.equal(await page.locator('.handbook-writing-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.locator('[data-ai-settings-summary]').evaluate(el => { el.textContent = '模型名称'.repeat(30) + ' · 安装模板 · 2 项资料'; });
  assert.equal(await page.locator('.handbook-writing-assistant').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, '窄屏长摘要不溢出');
  await page.locator('[data-ai-close]').click();
  await page.locator('.handbook-writing-page').waitFor({ state: 'detached' });
  assert.equal(await page.locator('#open-writing').evaluate(el => el === document.activeElement), true);
  assert.deepEqual(errors, []);
});

test('生成设置弹框按操作提供 Skill，并将作者选择冻结到续写任务', async t => {
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: '补充的续写内容', model: 'deterministic-e2e' }) });
  let createdJobId = null;
  page.on('response', async response => {
    if (response.request().method() !== 'POST' || !response.url().includes('/ai-jobs')) return;
    try { createdJobId = (await response.json()).data.jobId; } catch (_) {}
  });
  await page.evaluate(() => window.openWriting({ operation: 'continue', initialRange: { start: 8, end: 8 } }));
  await page.locator('[data-ai-skills-open]').click();
  await page.locator('[data-ai-skills]').evaluate(el => el.open = true);
  const skill = page.locator('[data-ai-skill-list] input[value="continue-technical-document"]');
  await skill.waitFor();
  assert.equal(await skill.isChecked(), false);
  assert.doesNotMatch(await page.locator('[data-ai-settings-summary]').textContent(), /0 个 Skill|0 项资料|未选模板/);
  await skill.check();
  assert.match(await page.locator('[data-ai-settings-summary]').textContent(), /1 个 Skill/);
  await finishConfiguration(page);
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.ok(createdJobId);
  const response = await api.request('GET', `${suffix}/ai-jobs/${createdJobId}?${new URLSearchParams(ctx)}`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const job = response.body.data;
  assert.deepEqual(job.skillSnapshots.map(item => item.skillId), ['continue-technical-document']);
  assert.deepEqual(errors, []);
});

test('真实配置模型：选文润色 → 候选 → 采用 → HTTP 草稿回读', { skip: process.env.WRITING_LIVE_MODEL !== '1', timeout: 180000 }, async t => {
  const { api, page, errors } = await launch(t); page.setDefaultTimeout(120000);
  const observations = [];
  page.on('response', async response => {
    if (!response.url().includes('/ai-jobs/') || response.request().method() !== 'GET') return;
    try {
      const body = await response.json(); const value = body.data?.job || body.data;
      if (value?.status) observations.push({ status: value.status, stages: value.stageRuns?.map(run => ({ stage: run.stageId, status: run.status, tool: run.toolName })), previewChars: value.executionPreview?.text?.length || 0 });
    } catch (_) {}
  });
  await selectText(page, selected); await page.locator('#open-writing').click();
  await page.locator('[data-ai-requirements]').fill('仅润色选中的部署准备句子，保持原意，简洁自然，不增加参数、版本、事实。不要联网。');
  await page.locator('[data-ai-start]').click();
  try {
    await page.waitForFunction(() => !document.querySelector('[data-ai-candidate]')?.hidden || /失败|无法生成/.test(document.querySelector('[data-ai-status]')?.textContent), null, { timeout: Number(process.env.WRITING_LIVE_WAIT_MS || 120000) });
  } catch (error) {
    const ui = await page.evaluate(() => ({ status: document.querySelector('[data-ai-status]')?.textContent, phase: document.querySelector('[data-ai-phase]')?.textContent, stages: [...document.querySelectorAll('[data-ai-stages] *')].map(node => node.textContent).filter(Boolean).slice(0, 12) }));
    throw new Error(`真实模型未完成：${JSON.stringify({ ui, observations: observations.slice(-4) })}`, { cause: error });
  }
  assert.equal(await page.locator('[data-ai-candidate]').isVisible(), true, await page.locator('[data-ai-status]').textContent());
  const fragment = await page.locator('[data-ai-fragment]').inputValue(); assert.ok(fragment.trim());
  assert.ok(observations.some(value => value.status === 'running' && value.stages?.some(run => run.status === 'running' && run.tool)), '真实模型完成前必须可查询执行中的工具调用');
  fs.writeFileSync(path.join(artifacts, 'live-model-progress.json'), JSON.stringify(observations, null, 2));
  assert.equal(await page.evaluate(() => window.editor.getValue()), initial);
  await screenshot(page, 'live-model-candidate');
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.saved);
  const reread = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(reread.status, 200); assert.equal(reread.body.data.draft.revision.markdown, initial.replace(selected, fragment).trimEnd() + '\n');
  const metadata = reread.body.data.draft.revision.generationMetadata; assert.ok(metadata.model);
  fs.writeFileSync(path.join(artifacts, 'live-model-result.json'), JSON.stringify({ passed: true, testedAt: new Date().toISOString(), model: metadata.model, modelSelection: metadata.modelSelection, revisionId: reread.body.data.draft.revision.revisionId, candidateChars: fragment.length, authentication: 'injected editor fixture', storage: 'isolated memory', sharedDraftsChanged: false, pageErrors: errors }, null, 2));
  assert.deepEqual(errors, []);
});


test('沉浸式富文本编辑、单一资料入口与浏览器返回保留正文', async t => {
  const { page, errors } = await launch(t);
  await page.evaluate(() => window.openWriting({ loadEditor: async () => window.Vditor }));
  const rich = page.locator('[data-ai-rich-editor] .vditor-wysiwyg [contenteditable="true"]');
  await rich.waitFor();
  assert.equal(await page.locator('dialog').count(), 0);
  assert.equal(await page.locator('[data-ai-source-preview]').count(), 1);
  await rich.click(); await page.keyboard.press('Control+End'); await page.keyboard.type('新增人工说明。');
  await page.waitForFunction(() => window.editor.getValue().includes('新增人工说明。'));
  assert.equal(await page.locator('[data-ai-start]').isEnabled(), true);
  await page.goBack();
  await page.locator('.handbook-writing-page').waitFor({ state: 'detached' });
  assert.ok(await page.evaluate(() => window.editor.getValue().includes('新增人工说明。')));
  assert.equal(await page.locator('#open-writing').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('GitLab 基线漂移显示对照，载入新基线后默认修订全文', async t => {
  const { page, errors } = await launch(t);
  await page.route('**/ai-jobs', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'AI_ORIGIN_BASELINE_CHANGED', message: '基线已更新' } }) }));
  await page.evaluate(() => window.openWriting({
    initialRange: { start: 0, end: window.editor.getValue().length },
    originSnapshot: { originType: 'gitlab', snapshotId: 'old-commit', contentDigest: 'a'.repeat(64), handbookId: 'HB-1', documentId: 'doc-1', branch: 'main', path: 'docs/doc-1.md', commitId: 'old-commit' },
    loadLatestOrigin: async () => ({ content: '# 安装准备\n\nGitLab 新增了前置检查。\n', snapshot: { originType: 'gitlab', snapshotId: 'new-commit', contentDigest: 'b'.repeat(64), handbookId: 'HB-1', documentId: 'doc-1', branch: 'main', path: 'docs/doc-1.md', commitId: 'new-commit' } }),
  }));
  await page.locator('[data-ai-start]').click();
  const drift = page.locator('.handbook-origin-drift-dialog'); await drift.waitFor();
  assert.match(await drift.textContent(), /当前基线[\s\S]*GitLab 最新基线/);
  assert.match(await drift.locator('pre').nth(1).textContent(), /新增了前置检查/);
  await drift.getByRole('button', { name: '载入 GitLab 最新基线' }).click();
  assert.equal(await page.locator('[data-ai-original]').inputValue(), '# 安装准备\n\nGitLab 新增了前置检查。\n');
  assert.match(await page.locator('[data-ai-range]').textContent(), /修订范围：全文/);
  assert.equal(await page.locator('[data-ai-start]').isEnabled(), true);
  assert.deepEqual(errors, []);
});

test('模板同框搜索、面板图标切换、运行详情和临时断线恢复同一任务', async t => {
  let release; let progress; let calls = 0; let captured;
  const hash = require('../../../packages/agent-runner-core/lib/template-store').hash;
  const templates = [
    { id: 'tpl-install', name: '安装指南', status: 'active', currentVersion: 1, versions: [{ version: 1, content: '# 安装步骤', contentHash: hash('# 安装步骤'), validationStatus: 'passed' }] },
    { id: 'tpl-sql', name: 'SQL 参考模板', status: 'active', currentVersion: 2, versions: [{ version: 2, content: '# SQL 语法', contentHash: hash('# SQL 语法'), validationStatus: 'passed' }] },
    { id: 'tpl-disabled', name: '已停用模板', status: 'disabled' },
  ];
  const { api, page, errors } = await launch(t, { generate: async (messages, _model, execution) => {
    calls++; captured = JSON.parse(messages.at(-1).content); progress = execution.onProgress;
    progress('{"markdown":"已生成第一段');
    return new Promise(resolve => { release = resolve; });
  } }, { templates });
  await page.evaluate(() => window.openWriting({ initialRange: { start: 0, end: 6 }, templateId: 'tpl-install' }));
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-settings-operation="polish"]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-settings-panel] [data-ai-sources]').count(), 0);
  assert.equal(await page.locator('[data-ai-operation]').inputValue(), 'polish');
  assert.deepEqual(await page.locator('[data-ai-operation] option').allTextContents(), ['文档生成', '内容修订', '内容续写']);
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), true);
  await finishConfiguration(page);
  await page.locator('[data-ai-operation-menu] > summary').click();
  await page.locator('[data-ai-quick-operation=\"continue\"]').click();
  await page.locator('[data-ai-skills-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), false);
  assert.doesNotMatch(await page.locator('[data-ai-settings-summary]').textContent(), /安装指南/);
  await finishConfiguration(page);
  await page.locator('[data-ai-operation-menu] > summary').click();
  await page.locator('[data-ai-quick-operation=\"generate\"]').click();
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), true);
  assert.match(await page.locator('[data-ai-operation] option:checked').textContent(), /文档生成/);
  const combo = page.locator('[data-ai-picker-search]');
  await combo.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-ai-template-select]').value === 'tpl-install');
  assert.equal(await page.getByRole('radio', { name: /已停用模板/ }).count(), 0);
  await combo.fill('SQL');
  await page.getByRole('radio', { name: /SQL 参考模板/ }).check();
  assert.equal(await page.locator('[data-ai-template-select]').inputValue(), 'tpl-sql');
  await finishConfiguration(page);
  await page.locator('[data-ai-operation-menu] > summary').click();
  await page.locator('[data-ai-quick-operation=\"continue\"]').click();
  await page.locator('[data-ai-skills-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), false);
  assert.doesNotMatch(await page.locator('[data-ai-settings-summary]').textContent(), /SQL 参考模板/);
  await finishConfiguration(page);
  await page.locator('[data-ai-operation-menu] > summary').click();
  await page.locator('[data-ai-quick-operation=\"polish\"]').click();
  await page.locator('[data-ai-settings-open]').click();
  await finishConfiguration(page);
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-template-select]').inputValue(), 'tpl-sql');
  const settingsBox = await page.locator('[data-ai-settings-panel] .handbook-ai-settings-dialog').boundingBox();
  assert.ok(settingsBox.width === 320 && settingsBox.height <= 860, JSON.stringify(settingsBox));
  await page.screenshot({ path: path.join(artifacts, 'settings-compact-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('[data-ai-settings-panel] .handbook-ai-settings-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.screenshot({ path: path.join(artifacts, 'settings-compact-mobile.png') });
  await page.setViewportSize({ width: 1366, height: 900 });
  await finishConfiguration(page);
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-preview]')?.textContent.includes('已生成第一段'));
  assert.equal(captured.template, '# SQL 语法');
  assert.equal(captured.operation, 'polish');
  assert.match(captured.instruction, /修订选定范围.*参考资料.*提供模板/);
  assert.equal(calls, 1);
  await page.locator('[data-ai-panel-toggle]').click();
  assert.equal(await page.locator('.handbook-writing-assistant').isVisible(), false);
  assert.equal(await page.locator('[data-ai-panel-toggle]').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('[data-ai-execution]').isVisible(), false);
  await page.locator('[data-ai-panel-toggle]').click();
  assert.equal(await page.locator('[data-ai-execution]').isVisible(), true);
  assert.equal(await page.getByRole('button', { name: '中断生成', exact: true }).isEnabled(), true);
  const writer = page.locator('[data-ai-stages] details').filter({ hasText: '生成正文' });
  await writer.locator('summary').click();
  assert.match(await writer.locator('[aria-label="调用输入摘要"]').textContent(), /selectedChars/);
  let dropped = 0;
  await page.route('**/ai-jobs/*?*', async route => {
    if (!dropped++) await route.abort('connectionreset'); else await route.continue();
  });
  await page.waitForFunction(() => document.querySelector('[data-ai-status]')?.textContent.includes('连接暂时中断'));
  await page.waitForFunction(() => document.querySelector('[data-ai-status]')?.textContent === '正在生成');
  assert.equal(calls, 1);
  assert.equal(await writer.getAttribute('open'), '');
  await page.screenshot({ path: path.join(artifacts, 'feedback-assistant-hidden.png'), fullPage: true });
  release({ content: '{"markdown":"已生成第一段完成","provenance":[]}', model: 'fixture-model' });
  await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-fragment]').inputValue(), '已生成第一段完成');
  await page.locator('[data-ai-refine]').click();
  assert.equal(await page.locator('.handbook-writing-assistant').isVisible(), true);
  assert.equal(await page.locator('[data-ai-requirements]').evaluate(el => el === document.activeElement), true);
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-template-select]').inputValue(), 'tpl-sql');
  await combo.focus(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-ai-settings-panel]').isVisible(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.handbook-writing-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.locator('[data-ai-settings-summary]').evaluate(el => { el.textContent = '模型名称'.repeat(30) + ' · 安装模板 · 2 项资料'; });
  assert.equal(await page.locator('.handbook-writing-assistant').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, '窄屏长摘要不溢出');
  await page.locator('[data-ai-panel-toggle]').click();
  await page.screenshot({ path: path.join(artifacts, 'feedback-mobile.png'), fullPage: true });
  // New attempt: progress and cancellation now belong to the conversation.
  await page.locator('[data-ai-panel-toggle]').click();
  await page.locator('[data-ai-start]').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.handbook-writing-conversation [data-ai-execution]').count(), 1);
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-preview]')?.textContent === '已生成第一段');
  assert.equal(await page.locator('[data-ai-phase]').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), true, '生成中当前阶段必须进入视口');
  assert.match(await page.locator('[data-ai-phase]').textContent(), /当前：生成正文/);
  await page.waitForFunction(() => /已用 [1-9]\d* 秒/.test(document.querySelector('[data-ai-elapsed]').textContent));
  await page.screenshot({ path: path.join(artifacts, 'feedback-mobile-running-viewport.png') });
  await page.getByRole('button', { name: '中断生成', exact: true }).click();
  await waitCandidate(page); // the previous completed candidate remains available
  progress('{"markdown":"取消后迟到输出');
  release({ content: '取消后迟到输出' });
  assert.deepEqual(errors, []);
  const draft = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(draft.body.data.exists, false);
});


test('真实配置模型长文：完成前在浏览器展示正文增量与调用详情', { skip: process.env.WRITING_LIVE_MODEL !== '1', timeout: 180000 }, async t => {
  const { api, page, errors } = await launch(t);
  await page.evaluate(() => window.openWriting({ operation: 'continue', initialRange: { start: 0, end: window.editor.getValue().length } }));
  await page.locator('[data-ai-requirements]').fill('这是界面执行反馈的隔离测试。续写一份约800至1000字的通用文档编写流程说明，分八个段落，覆盖目标、范围、资料整理、结构、表达、审阅、修订和归档。只讨论通用写作流程，不增加数据库参数或具体产品事实。不要省略段落。');
  await page.locator('[data-ai-start]').click();
  try {
    await page.waitForFunction(() => {
      const preview = document.querySelector('[data-ai-preview]')?.textContent;
      const writer = document.querySelector('[data-ai-stages] [data-state="running"]');
      return (preview?.length > 30 && writer?.textContent.includes('生成正文'))
        || /失败|无法生成/.test(document.querySelector('[data-ai-status]')?.textContent);
    }, null, { timeout: 120000 });
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'live-model-streaming-failed.png'), fullPage: true });
    throw new Error(`真实模型增量未出现：${await page.locator('[data-ai-status]').textContent()}；${await page.locator('[data-ai-phase]').textContent()}`, { cause: error });
  }
  assert.ok((await page.locator('[data-ai-preview]').textContent()).length > 30, await page.locator('[data-ai-status]').textContent());
  assert.equal(await page.locator('[data-ai-candidate]').isVisible(), false, '正文增量出现时任务尚未完成');
  const writer = page.locator('[data-ai-stages] details').filter({ hasText: '生成正文' });
  await writer.locator('summary').click();
  assert.match(await writer.locator('[aria-label="调用输入摘要"]').textContent(), /selectedChars/);
  const observed = { testedAt: new Date().toISOString(), status: await page.locator('[data-ai-status]').textContent(), phase: await page.locator('[data-ai-phase]').textContent(), previewCharsBeforeCompletion: (await page.locator('[data-ai-preview]').textContent()).length, candidateVisible: false, storage: 'isolated memory', sharedDraftsChanged: false };
  await page.screenshot({ path: path.join(artifacts, 'live-model-running-preview.png'), fullPage: true });
  fs.writeFileSync(path.join(artifacts, 'live-model-streaming-result.json'), JSON.stringify(observed, null, 2));
  // Stop the isolated task after proving streaming; never adopt it into a shared draft.
  await page.getByRole('button', { name: '中断生成', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-ai-status]')?.textContent === '已取消');
  assert.equal((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.exists, false);
  assert.deepEqual(errors, []);
});

test('内容修订可不使用模板，续写不携带继承模板', async t => {
  let capturedRevision;
  const hash = require('../../../packages/agent-runner-core/lib/template-store').hash;
  const { page, errors } = await launch(t, { generate: async messages => { capturedRevision = JSON.parse(messages.at(-1).content); return { content: '修订后的正文', model: 'deterministic-e2e' }; } }, {
    templates: [{ id: 'inherited-template', name: '继承模板', status: 'active', currentVersion: 1,
      versions: [{ version: 1, content: '# 不应用于润色', contentHash: hash('# 不应用于润色'), validationStatus: 'passed' }] }],
  });
  let submitted;
  page.on('request', request => {
    if (request.method() === 'POST' && /\/ai-jobs$/.test(request.url())) submitted = request.postDataJSON();
  });
  await page.evaluate(() => window.openWriting({ templateId: 'inherited-template', initialRange: { start: 0, end: 6 } }));
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), true);
  await page.waitForFunction(() => document.querySelector('[data-ai-template-select]').value === 'inherited-template');
  await page.locator('[data-ai-template-select]').selectOption('__none', { force: true });
  await openReferences(page);
  await page.locator('[data-ai-source-type] option[value="test-case-library"]').waitFor({ state: 'attached' });
  await page.locator('[data-reference-type=\"test-case-library\"]').click();
  await page.locator('[data-ai-source-locator]').fill('ai-quality-smoke-select.sql');
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-source-list] section').length === 2 && !document.querySelector('[data-ai-source-preview]').disabled);
  await finishConfiguration(page);
  await page.locator('[data-ai-requirements]').fill('依据参考资料修订，保留有依据的事实。');
  await page.locator('[data-ai-start]').click();
  await waitCandidate(page);
  assert.equal(submitted.operation, 'polish');
  assert.equal(submitted.templateId, null);
  assert.equal(submitted.confirmedSourceIds.length, 1);
  assert.match(capturedRevision.instruction, /事实变更必须有明确依据/);
  await page.locator('[data-ai-close]').click();
  await page.evaluate(() => window.openWriting({ operation: 'continue', templateId: 'inherited-template', initialRange: { start: 6, end: 6 } }));
  await page.locator('[data-ai-skills-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), false);
  await finishConfiguration(page);
  await page.locator('[data-ai-start]').click();
  await waitCandidate(page);
  assert.equal(submitted.operation, 'continue');
  assert.equal(submitted.templateId, null);
  await page.locator('[data-ai-close]').click();
  for (const operation of ['rewrite', 'update']) {
    await page.evaluate(operation => window.openWriting({ operation }), operation);
    assert.equal(await page.locator('[data-ai-operation]').inputValue(), 'polish');
    await page.locator('[data-ai-close]').click();
  }
  assert.deepEqual(errors, []);
});


test('PingCode 页面网址与短标识兼容，来源受限不误报账号权限', async t => {
  const calls = [];
  const upstream = http.createServer((req, res) => {
    calls.push(req.url);
    const [, spaceKey, pageId] = req.url.match(/spaces\/([^/]+)\/pages\/([^/]+)\/reference/) || [];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ spaceKey, pageId, title: '设计依据', content: '# 设计依据\n已确认的事实。' }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const { api, page, errors } = await launch(t, { pingcodeBaseURL: `http://127.0.0.1:${upstream.address().port}` });
  const preview = (sourceType, locator) => api.request('POST', suffix + '/ai-sources', JSON.stringify({ ...ctx, sourceType, locator }), { 'Content-Type': 'application/json' });
  const full = 'https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/page-1';
  // A real backend request reproduces the original full-URL failure before the fix.
  const good = await preview('pingcode-design', full);
  assert.equal(good.status, 201, JSON.stringify(good.body));
  assert.equal(good.body.data.locator, 'YASDOC/page-1');
  assert.equal(good.body.data.originalUrl, full);
  for (const sourceType of ['pingcode-design', 'pingcode-test', 'url']) {
    assert.equal((await preview(sourceType, full)).status, 201);
  }
  assert.equal((await preview('pingcode-test', 'YASDOC/page-1')).status, 201);
  const pagePath = await preview('pingcode-design', 'YASDOC/pages/page-1');
  assert.equal(pagePath.status, 201, JSON.stringify(pagePath.body));
  assert.equal(pagePath.body.data.locator, 'YASDOC/page-1');
  for (const locator of ['https://other.example/wiki/spaces/YASDOC/pages/page-1', full + '?redirect=1', 'page-1']) {
    assert.equal((await preview('pingcode-design', locator)).status, 400, locator);
  }
  const beforeDenied = calls.length;
  const denied = await preview('pingcode-design', 'DENIED/page-1');
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'AI_SOURCE_SCOPE_DENIED');
  assert.match(denied.body.error.details.requestId, /^[a-f0-9-]{36}$/);
  assert.equal(calls.length, beforeDenied);
  await page.evaluate(() => {
    window.permissionNotices = 0;
    window.addEventListener('knowledge-center:permission-denied', () => window.permissionNotices++);
    window.openWriting({ initialRange: { start: 0, end: 6 } });
  });
  await page.locator('[data-ai-settings-open]').click();
  await openReferences(page);
  await page.locator('[data-ai-source-type] option[value="pingcode-design"]').waitFor({ state: 'attached' });
  await page.locator('[data-reference-type=\"pingcode-design\"]').click();
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /页面网址/);
  await page.locator('[data-ai-source-locator]').fill('DENIED/page-1');
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-source-info]').textContent.includes('不在已配置'));
  assert.equal(await page.evaluate(() => window.permissionNotices), 0);
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /诊断编号：[a-f0-9-]{36}/);
  await page.locator('[data-reference-type=\"url\"]').click();
  await page.locator('[data-ai-source-locator]').fill('file:///etc/passwd');
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-source-info]').textContent.includes('来源范围'));
  assert.equal(await page.evaluate(() => window.permissionNotices), 0);
  await page.locator('[data-reference-type=\"pingcode-design\"]').click();
  await page.locator('[data-ai-source-locator]').fill(full);
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-source-list] section').length === 2 && !document.querySelector('[data-ai-source-preview]').disabled);
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /资料已添加/);
  await openReferences(page);
  await page.locator('[data-ai-source-locator]').fill(full);
  // Account-level denial must still dispatch its global notice.
  await page.route('**/ai-sources', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'HANDBOOK_PRODUCTION_FORBIDDEN', message: '当前用户无权执行此操作' } }) }));
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => window.permissionNotices === 1);
  assert.deepEqual(errors, []);
});

test('嵌入工作台：目录与命令栏保留、正文编辑、候选采用和窄屏无溢出', async t => {
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: '确认部署环境并准备安装文件。', model: 'deterministic-e2e' }) });
  await page.evaluate(() => {
    const root = document.querySelector('#view-root');
    const bar = document.createElement('header'); bar.id = 'fixture-commandbar'; bar.textContent = '知识资产 / 安装手册';
    root.prepend(bar);
    const surface = document.createElement('section'); surface.className = 'handbook-production-writing';
    document.querySelector('[data-handbook-vditor]').before(surface);
    surface.append(document.querySelector('[data-handbook-vditor]'));
    window.openWriting({ embedded: true, loadEditor: async () => window.Vditor, initialRange: { start: 0, end: window.editor.getValue().length } });
  });
  await page.locator('.handbook-writing-page.is-embedded').waitFor();
  assert.equal(await page.locator('#fixture-commandbar').isVisible(), true);
  assert.equal(await page.locator('.handbook-writing-page').evaluate(el => el.parentElement.className), 'handbook-production-writing has-writing-assistant');
  await page.locator('[data-ai-rich-editor] .vditor-wysiwyg [contenteditable="true"]').waitFor();
  const columns = await page.locator('.handbook-writing-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(columns, 2);
  await page.locator('[data-ai-requirements]').fill('完善部署要求');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(artifacts, 'embedded-mobile.png') });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.match(await page.locator('[data-ai-fragment]').inputValue(), /部署环境/);
  await page.locator('[data-ai-adopt]').click();
  await page.waitForFunction(() => !!window.saved);
  const reread = await api.request('GET', `${suffix}/draft?${new URLSearchParams(ctx)}`);
  assert.equal(reread.status, 200); assert.match(reread.body.data.draft.revision.markdown, /部署环境并准备/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(artifacts, 'embedded-mobile.png') });
  assert.equal(await page.locator('.handbook-writing-page').count(), 0);
  assert.equal(await page.locator('[data-handbook-vditor]').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('本地参考文档：拖拽上传、折叠、拖动优先级、键盘调整与生成真实传递', async t => {
  let captured;
  const mcp = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const message = JSON.parse(raw);
    if (message.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
    const result = message.method !== 'tools/call' ? { serverInfo: { name: 'test', version: '1' }, capabilities: {} }
      : message.params.name === 'search_ku' ? { structuredContent: { results: [{ ku_name: 'select-reference', score: .95 }] } }
      : { structuredContent: { title: 'SELECT知识库原文', content: '# SELECT\n\n知识库中的语法依据。' } };
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  await new Promise(resolve => mcp.listen(0, '127.0.0.1', resolve));
  t.after(() => { mcp.closeAllConnections(); mcp.close(); });
  const { api, page, errors } = await launch(t, {
    loadMCPConfig: async () => ({ services: [{ id: 'official-service', name: '知识库', enabled: true, server_url: `http://127.0.0.1:${mcp.address().port}`, knowledgeBases: [{ id: 'official', name: '官方文档', locator: '1' }] }] }),
    generate: async messages => { captured = JSON.parse(messages.at(-1).content); return { content: '依据优先级修订后的 SELECT 正文。', model: 'deterministic-e2e' }; },
  });
  await page.evaluate(() => {
    const surface = document.createElement('section'); surface.className = 'handbook-production-writing';
    document.querySelector('[data-handbook-vditor]').before(surface); surface.append(document.querySelector('[data-handbook-vditor]'));
    window.openWriting({ embedded: true, loadEditor: async () => window.Vditor, initialRange: { start: 0, end: window.editor.getValue().length } });
  });
  assert.equal(await page.getByRole('button', { name: '选择模板', exact: true }).isVisible(), true);
  assert.equal(await page.locator('[data-ai-reference-panel]').isVisible(), false);
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-settings-panel] [data-ai-source-entry]').count(), 0);
  await finishConfiguration(page);
  await openReferences(page);
  assert.equal(await page.locator('[data-reference-type]').count(), 6);
  await page.locator('[data-reference-type="local-document"]').click();
  assert.equal(await page.locator('[data-reference-type="local-document"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-reference-type="url"]').getAttribute('aria-pressed'), 'false');
  await page.screenshot({ path: path.join(artifacts, 'reference-local-upload.png') });
  for (let index = 1; index <= 4; index++) {
    const payload = { name: `参考${index}.md`, mimeType: 'text/markdown', buffer: Buffer.from(`# SELECT依据${index}\n\n引用事实${index}。`) };
    if (index === 1) {
      const data = await page.evaluateHandle(({ name, content }) => {
        const transfer = new DataTransfer(); transfer.items.add(new File([content], name, { type: 'text/markdown' })); return transfer;
      }, { name: payload.name, content: payload.buffer.toString() });
      await page.locator('[data-ai-source-upload]').dispatchEvent('drop', { dataTransfer: data });
      await data.dispose();
    } else await page.locator('[data-ai-source-file]').setInputFiles(payload);
    await page.waitForFunction(count => document.querySelectorAll('[data-ai-source-list] section').length === count && !document.querySelector('[data-ai-source-file]').disabled, index + 1);
  }
  await openReferences(page);
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 4);
  assert.equal(await page.locator('[data-ai-references-toggle]').getAttribute('aria-expanded'), 'false');
  await page.locator('[data-ai-references-toggle]').click();
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 5);
  const rows = page.locator('[data-ai-source-list] section');
  await rows.nth(1).locator('[draggable]').dragTo(rows.nth(0), { targetPosition: { x: 20, y: 5 } });
  assert.match(await rows.first().textContent(), /参考1.md/);
  await page.getByRole('button', { name: '调整优先级：知识库（MCP）' }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  assert.deepEqual(await rows.locator('label').allTextContents(), ['参考1.md','参考2.md','知识库（MCP）','参考3.md','参考4.md']);
  await page.getByRole('button', { name: '调整优先级：参考4.md' }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  assert.match(await rows.nth(3).textContent(), /参考4.md/);
  await closeReferences(page);
  await page.locator('[data-ai-requirements]').fill('SELECT SQL，根据参考文档补充准确事实。');
  await page.screenshot({ path: path.join(artifacts, 'reference-priority-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await openReferences(page);
  await page.screenshot({ path: path.join(artifacts, 'reference-local-upload-mobile.png') });
  assert.equal(await page.locator('[data-ai-reference-panel] .handbook-ai-settings-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.locator('[data-ai-references-toggle]').click();
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 4);
  await closeReferences(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.deepEqual(captured.sources.map(source => source.title), ['参考1.md','参考2.md','SELECT知识库原文','参考4.md','参考3.md']);
  assert.deepEqual(captured.sources.map(source => source.priority), [1,2,3,4,5]);
  assert.match(captured.sources[0].content, /引用事实1/);
  assert.deepEqual(errors, []);
});

test('本地 HTML/HTM 参考文档：文件选择与拖拽经真实 API 解析并进入引用', async t => {
  let captured;
  const { page, errors } = await launch(t, { generate: async messages => {
    captured = JSON.parse(messages.at(-1).content);
    return { content: '引用后的正文', model: 'fixture' };
  } });
  await selectText(page, selected); await page.locator('#open-writing').click(); await openReferences(page);
  await page.locator('[data-reference-type="local-document"]').click();
  const fileInput = page.locator('[data-ai-source-file]');
  assert.match(await fileInput.getAttribute('accept'), /\.html,\.htm/);
  assert.match(await page.locator('[data-ai-source-upload]').textContent(), /HTML/);
  const html = '<!doctype html><html><head><title>资料</title><style>.noise{color:red}</style></head><body><nav>导航噪声</nav><main><h1>SQL 参数依据</h1><p>参数值为 42。</p><img src="https://example.com/secret.png" alt="示意图"><a href="javascript:alert(1)">链接文字</a></main><script>secretScript()</script></body></html>';
  const firstResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/ai-sources/uploads?'));
  await fileInput.setInputFiles({ name: '参数依据.html', mimeType: 'text/html', buffer: Buffer.from(html) });
  const first = await firstResponse;
  assert.equal(first.status(), 201);
  const source = (await first.json()).data;
  assert.equal(source.sourceType, 'local-document');
  assert.match(source.content, /SQL 参数依据[\s\S]*参数值为 42/);
  assert.doesNotMatch(source.content, /导航噪声|secretScript|javascript:|secret\.png/);
  assert.match(source.content, /链接文字/);
  await page.locator('[data-ai-source-list] section').filter({ hasText: '参数依据.html' }).waitFor();
  const secondResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/ai-sources/uploads?'));
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer(); data.items.add(new File(['<html><body><article><h2>拖拽资料</h2><p>第二份正文。</p></article></body></html>'], '拖拽依据.htm', { type: 'text/html' })); return data;
  });
  await page.locator('[data-ai-source-upload]').dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
  const second = await secondResponse;
  assert.equal(second.status(), 201);
  assert.match((await second.json()).data.content, /第二份正文/);
  await page.locator('[data-ai-source-list] section').filter({ hasText: '拖拽依据.htm' }).waitFor();
  const beforeInvalid = await page.locator('[data-ai-source-list] section').count();
  await fileInput.setInputFiles({ name: '损坏.html', mimeType: 'text/html', buffer: Buffer.from([0xff, 0xfe, 0x00]) });
  await page.getByRole('alert').filter({ hasText: '本地文档读取失败' }).waitFor();
  assert.equal(await page.locator('[data-ai-source-list] section').count(), beforeInvalid);
  await closeReferences(page);
  await page.locator('[data-ai-requirements]').fill('依据本地 HTML 参考资料修订。');
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.ok(captured.sources.some(item => item.sourceId === source.sourceId && item.content.includes('参数值为 42')));
  assert.deepEqual(errors, []);
});


test('仓库授权缺失时保留编辑和设置，重新检查成功后才生成', async t => {
  const { page, errors } = await launch(t, { generate: async () => ({ content: '恢复后的正文', model: 'deterministic-e2e' }) });
  let posts = 0; let submittedSnapshot;
  page.on('request', request => { if (request.method() === 'POST' && /\/ai-jobs(?:\?|$)/.test(request.url())) { posts++; submittedSnapshot = request.postDataJSON().originSnapshot; } });
  await page.evaluate(() => {
    window.originAvailable = false;
    window.originChecks = 0;
    window.openWriting({ initialRange: { start: 0, end: 6 }, originAuthorizationHref: '/authorize-fixture', prepareOrigin: async () => {
      window.originChecks++;
      if (!window.originAvailable) throw Object.assign(new Error('请先授权 GitLab 账号，完成后重新检查来源。'), { code: 'GITLAB_OAUTH_REQUIRED' });
      window.firstSnapshot ||= `check-${window.originChecks}`;
      return { content: '', snapshot: { snapshotId: `check-${window.originChecks}`, originType: 'blank', contentDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', handbookId: 'HB-1', documentId: 'doc-1', branch: 'main' } };
    } });
  });
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  assert.equal(await page.evaluate(() => window.originChecks), 0, '打开页面不读取 GitLab');
  await page.locator('[data-ai-start]').click();
  await page.locator('[data-ai-origin-authorize]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-ai-start]').isDisabled(), true);
  assert.match(await page.locator('[data-ai-start-hint]').textContent(), /请先授权 GitLab/);
  assert.equal(await page.locator('[data-ai-start]').getAttribute('aria-describedby'), 'handbook-ai-start-hint');
  assert.equal(await page.locator('[data-ai-origin-authorize]').getAttribute('target'), '_blank');
  await page.locator('[data-ai-requirements]').fill('保留这份要求');
  const markdown = page.locator('[data-ai-original]');
  await markdown.fill('# 人工修改\n\n保留正文。\n');
  assert.equal(await page.locator('[data-ai-start]').isDisabled(), true);
  await page.locator('[data-ai-origin-recheck]').click();
  assert.equal(posts, 0);
  assert.equal(await page.locator('[data-ai-requirements]').inputValue(), '保留这份要求');
  assert.match(await markdown.inputValue(), /保留正文/);
  await page.evaluate(() => { window.originAvailable = true; });
  await page.locator('[data-ai-origin-recheck]').click();
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  assert.match(await markdown.inputValue(), /保留正文/);
  await page.evaluate(() => { window.originAvailable = false; });
  await page.locator('[data-ai-start]').click();
  await page.locator('[data-ai-origin-authorize]').waitFor({ state: 'visible' });
  assert.equal(posts, 0, '生成前授权失效时不得发送任务');
  assert.equal(await page.locator('[data-ai-requirements]').inputValue(), '保留这份要求');
  await page.evaluate(() => { window.originAvailable = true; });
  await page.locator('[data-ai-origin-recheck]').click();
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(posts, 1);
  assert.equal(submittedSnapshot.snapshotId, await page.evaluate(() => window.firstSnapshot), '重新检查不可静默切换已冻结基线');
  assert.ok(await page.evaluate(() => window.originChecks >= 4));
  assert.deepEqual(errors, []);
});

for (const viewportWidth of [1366, 390]) test(`嵌入长文${viewportWidth}：生成前慢速来源检查立即可见，随后进度与候选自动进入视口`, async t => {
  let release;
  const { page, errors } = await launch(t, { generate: async () => new Promise(resolve => { release = resolve; }) });
  await page.setViewportSize({ width: viewportWidth, height: 900 });
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST' && /\/ai-jobs(?:\?|$)/.test(request.url())) posts++; });
  await page.evaluate(() => {
    const surface = document.createElement('section'); surface.className = 'handbook-production-writing';
    document.querySelector('[data-handbook-vditor]').before(surface); surface.append(document.querySelector('[data-handbook-vditor]'));
    window.editor.setValue('# 长篇文档\n\n' + '需要修订的正文。\n\n'.repeat(180));
    window.originChecks = 0;
    window.openWriting({ embedded: true, initialRange: { start: 0, end: window.editor.getValue().length }, prepareOrigin: async () => {
      window.originChecks++;
      if (window.originChecks >= 1) await new Promise(resolve => { window.releaseOrigin = resolve; });
      return { content: '', snapshot: { originType: 'blank', contentDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', handbookId: 'HB-1', documentId: 'doc-1', branch: 'main' } };
    } });
  });
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => typeof window.releaseOrigin === 'function');
  assert.equal(posts, 0, '仓库来源检查未结束，不应创建任务');
  assert.equal(await page.locator('[data-ai-execution]').isVisible(), true, '生成前来源检查也必须展示执行反馈');
  assert.match(await page.locator('[data-ai-status]').textContent(), /检查仓库来源/);
  await page.waitForFunction(() => { const b = document.querySelector('[data-ai-status]').getBoundingClientRect(); return b.top >= 0 && b.bottom < innerHeight; });
  await page.evaluate(() => window.releaseOrigin());
  await page.waitForFunction(() => document.querySelector('[data-ai-status]').textContent === '正在生成');
  assert.equal(posts, 1);
  await page.screenshot({ path: path.join(artifacts, `embedded-running-visible-${viewportWidth}.png`) });
  release({ content: '这是可以比较并采用的修订结果。', model: 'deterministic-e2e' });
  await waitCandidate(page);
  await page.waitForFunction(() => { const b = document.querySelector('[data-ai-fragment]').getBoundingClientRect(); return b.top >= 0 && b.top < innerHeight; });
  assert.match(await page.locator('[data-ai-fragment]').inputValue(), /修订结果/);
  await page.screenshot({ path: path.join(artifacts, `embedded-result-visible-${viewportWidth}.png`) });
  assert.deepEqual(errors, []);
});

for (const width of [1366, 390]) test(`对话式写作${width}：默认收起配置、图标调整、过程反馈与候选采用回读`, async t => {
  let release; let submitted;
  const { api, page, errors } = await launch(t, { generate: async () => new Promise(resolve => { release = resolve; }) });
  page.on('request', request => { if (request.method() === 'POST' && /\/ai-jobs$/.test(request.url())) submitted = request.postDataJSON(); });
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => {
    const surface = document.createElement('section'); surface.className = 'handbook-production-writing';
    document.querySelector('[data-handbook-vditor]').before(surface); surface.append(document.querySelector('[data-handbook-vditor]'));
    window.openWriting({ embedded: true, loadEditor: async () => window.Vditor, initialRange: { start: 0, end: window.editor.getValue().length } });
  });
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  assert.equal(await page.locator('[data-ai-settings-panel]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-reference-panel]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-quick-operation="generate"]').isVisible(), false);
  assert.match(await page.locator('[data-ai-recommendation]').textContent(), /内容修订.*引用 1 项资料/);
  await page.locator('[data-ai-skills-open]').click();
  assert.equal(await page.locator('[data-ai-skills]').isVisible(), true);
  await finishConfiguration(page);
  await openReferences(page);
  assert.equal(await page.locator('[data-source-priority]').first().textContent(), '01');
  await closeReferences(page);
  await page.locator('[data-ai-operation-menu] > summary').click();
  await page.locator('[data-ai-quick-operation="polish"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  await page.locator('[data-ai-requirements]').fill('补充部署检查说明');
  await page.locator('.handbook-writing-assistant').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(artifacts, `conversation-ready-${width}.png`) });
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-status]').textContent === '正在生成');
  assert.match(await page.locator('[data-ai-request-message]').textContent(), /部署检查/);
  assert.equal(await page.locator('.handbook-writing-conversation [data-ai-execution]').isVisible(), true);
  assert.equal(submitted.operation, 'polish');
  assert.deepEqual(submitted.referenceOrder, ['knowledge-mcp']);
  await page.screenshot({ path: path.join(artifacts, `conversation-running-${width}.png`) });
  release({ content: '安装前检查部署环境和所需文件。', model: 'deterministic-e2e' });
  await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-view-candidate]').isVisible(), true);
  await page.locator('[data-ai-view-candidate]').click();
  assert.match(await page.locator('[data-ai-fragment]').inputValue(), /检查部署环境/);
  await page.locator('[data-ai-adopt]').click();
  await page.waitForFunction(() => !!window.saved);
  const reread = await api.request('GET', `${suffix}/draft?${new URLSearchParams(ctx)}`);
  assert.equal(reread.status, 200);
  assert.match(reread.body.data.draft.revision.markdown, /安装前检查部署环境/);
  assert.deepEqual(errors, []);
});

test('紧凑选择与侧栏伸缩：拖拽、键盘、搜索、取消恢复和窄屏', async t => {
  const templates = [
    { id: 'tpl-install', name: '安装指南', description: '准备环境、安装与验证', status: 'active', currentVersion: 1, versions: [{ version: 1, content: '# 安装步骤', validationStatus: 'passed' }] },
    { id: 'tpl-sql', name: 'SQL参考', description: '语法与示例', status: 'active', currentVersion: 1, versions: [{ version: 1, content: '# SQL语法', validationStatus: 'passed' }] },
  ];
  const { page, errors } = await launch(t, {}, { templates });
  await page.evaluate(() => window.openWriting({ templateId: 'tpl-install', initialRange: { start: 0, end: 6 } }));
  const splitter = page.getByRole('separator', { name: '调整 AI 对话栏宽度' });
  await splitter.waitFor();
  await page.waitForFunction(() => document.querySelector('.handbook-writing-separator').getAttribute('aria-valuenow') === '420');
  const box = await splitter.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 70); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + 70, { steps: 8 }); await page.mouse.up();
  assert.ok(Number(await splitter.getAttribute('aria-valuenow')) >= 530);
  await splitter.focus(); await page.keyboard.press('Home'); assert.equal(await splitter.getAttribute('aria-valuenow'), '340');
  await page.keyboard.press('ArrowLeft'); assert.equal(await splitter.getAttribute('aria-valuenow'), '360');
  await page.locator('[data-ai-reset-width]').click(); assert.equal(await splitter.getAttribute('aria-valuenow'), '420');
  await page.locator('[data-ai-settings-open]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-template-list] input').length === 3);
  await page.locator('[data-ai-picker-search]').fill('SQL');
  assert.equal(await page.locator('[data-ai-template-list] input').count(), 1);
  await page.getByRole('radio', { name: /SQL参考/ }).check();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-ai-template-select]').inputValue(), 'tpl-install');
  await page.locator('[data-ai-settings-open]').click();
  await page.screenshot({ path: path.join(artifacts, 'workbuddy-template-formal.png') });
  const pickerBox = await page.locator('.handbook-writing-picker .handbook-ai-settings-dialog').boundingBox();
  assert.equal(pickerBox.width, 320);
  assert.ok(pickerBox.y >= 0);
  await finishConfiguration(page);
  await page.locator('[data-ai-operation-menu] > summary').click();
  await page.locator('[data-ai-quick-operation=continue]').click();
  await page.locator('[data-ai-skills-open]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-skill-list] input').length > 0);
  const firstSkill = page.locator('[data-ai-skill-list] input').first();
  await firstSkill.check();
  await page.locator('[data-ai-picker-search]').fill('不存在的技能');
  assert.equal(await page.locator('[data-ai-skill-list] section:visible').count(), 0);
  await page.locator('[data-ai-picker-search]').fill('');
  await page.screenshot({ path: path.join(artifacts, 'workbuddy-skills-formal.png') });
  await finishConfiguration(page);
  assert.match(await page.locator('[data-ai-selected-chips]').textContent(), /1 项技能/);
  await openReferences(page);
  assert.equal((await page.locator('.handbook-reference-modal .handbook-ai-settings-dialog').boundingBox()).width, 1040);
  await page.screenshot({ path: path.join(artifacts, 'workbuddy-references-formal.png') });
  await closeReferences(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-ai-skills-open]').click();
  assert.equal(await splitter.isVisible(), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'workbuddy-mobile-formal.png') });
  assert.deepEqual(errors, []);
});

test('IMA修订：正文逐处对照、混合接受拒绝和真实HTTP保存回读', async t => {
  const before = '# 安装\n\n旧检查。\n\n保留段落。\n\n旧说明。\n';
  const after = '# 安装\n\n新检查。\n\n保留段落。\n\n新说明。\n';
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: after, model: 'deterministic-e2e' }) });
  await page.evaluate(before => { window.editor.setValue(before); window.openWriting({ initialRange: null }); }, before);
  await page.locator('[data-ai-start]:enabled').waitFor();
  assert.equal(await page.locator('[data-ai-selection], [data-ai-full]').count(), 0);
  assert.match(await page.locator('[data-ai-range]').textContent(), /全文/);
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-change]').count(), 2);
  assert.equal(await page.locator('[data-ai-rich-editor]').isVisible(), false);
  assert.match(await page.locator('.handbook-review-removed').first().textContent(), /旧检查/);
  assert.match(await page.locator('.handbook-review-added').first().textContent(), /新检查/);
  await page.screenshot({ path: path.join(artifacts, 'ima-inline-revision.png'), fullPage: true });
  await page.getByRole('button', { name: '拒绝第 1 处修改', exact: true }).click();
  await page.getByRole('button', { name: '接受第 2 处修改', exact: true }).click();
  assert.equal(await page.locator('[data-ai-fragment]').inputValue(), before.replace('旧说明。', '新说明。'));
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.saved);
  const result = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(result.body.data.draft.revision.markdown, before.replace('旧说明。', '新说明。'));
  assert.deepEqual(errors, []);
});

test('IMA续写：快捷切换即用、引用原文、接在选段之后且不替换原文', async t => {
  let submitted;
  const { api, page, errors } = await launch(t, { generate: async messages => { submitted = JSON.parse(messages.at(-1).content); return { content: '\n\n续写的新内容。', model: 'deterministic-e2e' }; } });
  await selectText(page, selected);
  await page.evaluate(() => window.openWriting());
  await page.locator('[data-ai-operation-menu] > summary').click();
  await page.locator('[data-ai-quick-operation="continue"]').click();
  assert.equal(await page.locator('[data-ai-quoted-text]').textContent(), selected);
  await page.locator('[data-ai-start]:enabled').waitFor();
  await page.screenshot({ path: path.join(artifacts, 'ima-continue-quote.png') });
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.match(submitted.requirements, new RegExp(selected));
  assert.equal(await page.locator('[data-ai-before]').inputValue(), '');
  assert.equal(await page.locator('.handbook-review-removed').count(), 0);
  const fragment = await page.locator('[data-ai-fragment]').inputValue();
  await page.locator('[data-ai-accept-all]').click();
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.saved);
  const saved = (await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.draft.revision.markdown;
  const offset = initial.indexOf(selected) + selected.length;
  assert.equal(saved, initial.slice(0, offset) + fragment + initial.slice(offset));
  assert.deepEqual(errors, []);
});

test('IMA打开：编辑器准备前保持原页面，准备后一次切换；拒绝全部不保存', async t => {
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: '候选修改', model: 'deterministic-e2e' }) });
  const opening = await page.evaluate(() => {
    const startedAt = performance.now();
    const host = document.querySelector('#view-root');
    const marker = document.createElement('p'); marker.id = 'original-workbench'; marker.textContent = '原文工作台'; host.append(marker);
    window.openWriting({ initialRange: null, loadEditor: () => new Promise(resolve => { window.releaseEditor = () => resolve(window.Vditor); }) });
    return { feedbackMs: performance.now() - startedAt, visible: !document.querySelector('.handbook-writing-page').hidden };
  });
  assert.equal(opening.visible, false);
  assert.ok(opening.feedbackMs < 100, `opening feedback took ${opening.feedbackMs.toFixed(1)}ms`);
  t.diagnostic(`准备写作页入口耗时 ${opening.feedbackMs.toFixed(2)}ms`);
  assert.equal(await page.locator('#original-workbench').isVisible(), true);
  assert.equal(await page.locator('#open-writing').getAttribute('aria-busy'), 'true');
  await page.evaluate(() => window.releaseEditor());
  await page.locator('.handbook-writing-page').waitFor({ state: 'visible' });
  await page.locator('[data-ai-rich-editor] .vditor-wysiwyg [contenteditable=true]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-ai-markdown]').isVisible(), false);
  assert.match(await page.locator('[data-ai-rich-editor] .vditor-wysiwyg').innerText(), /前文相同/);
  assert.equal(await page.locator('#original-workbench').count(), 0);
  await page.locator('[data-ai-start]:enabled').waitFor();
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  await page.locator('[data-ai-reject-all]').click();
  assert.equal(await page.locator('[data-ai-candidate]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-rich-editor]').isVisible(), true);
  assert.equal((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.exists, false);
  await page.locator('[data-ai-close]').click();
  assert.equal(await page.locator('#original-workbench').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('双滚动：正文与历史对话互不带动，输入固定且关闭恢复工作台', async t => {
  const { page, errors } = await launch(t, { generate: async () => ({ content: '修订候选正文', model: 'fixture' }) });
  await page.evaluate(() => {
    const surface = document.createElement('section'); surface.className = 'handbook-production-writing';
    document.querySelector('[data-handbook-vditor]').before(surface); surface.append(document.querySelector('[data-handbook-vditor]'));
    window.editor.setValue('# 长篇文档\n\n' + '用于验证正文独立滚动的段落。\n\n'.repeat(150));
    window.openWriting({ embedded: true, loadEditor: async () => window.Vditor, initialRange: { start: 0, end: window.editor.getValue().length } });
  });
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  await page.locator('[data-ai-requirements]').fill('保留章节结构，优化段落表达');
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  await page.locator('[data-ai-close]').click();
  await page.evaluate(() => window.openWriting({ embedded: true, loadEditor: async () => window.Vditor }));
  await page.locator('.handbook-writing-history-turn').first().waitFor();
  assert.equal(await page.locator('.handbook-writing-document [data-ai-history]').count(), 0);
  assert.match(await page.locator('.handbook-writing-conversation [data-ai-history]').textContent(), /保留章节结构，优化段落表达/);
  // Repeat visual turns only to exercise a long transcript; first turn was loaded through real HTTP.
  await page.evaluate(() => {
    const list = document.querySelector('[data-ai-history-list]');
    const turn = list.firstElementChild; for (let i = 0; i < 12; i++) list.append(turn.cloneNode(true));
    document.querySelector('.handbook-writing-document-scroll').scrollTop = 0;
    document.querySelector('.handbook-writing-conversation').scrollTop = 0;
  });
  await page.screenshot({ path: path.join(artifacts, 'dual-scroll-initial.png') });
  const geometry = () => page.evaluate(() => ({
    doc: document.querySelector('.handbook-writing-document-scroll').scrollTop,
    chat: document.querySelector('.handbook-writing-conversation').scrollTop,
    inputTop: document.querySelector('.handbook-writing-input-area').getBoundingClientRect().top,
    headingTop: document.querySelector('.handbook-writing-assistant .asset-dialog-heading').getBoundingClientRect().top,
    toolbarTop: document.querySelector('.handbook-writing-document > .vditor-toolbar')?.getBoundingClientRect().top,
    body: document.scrollingElement.scrollTop,
  }));
  const before = await geometry();
  await page.locator('.handbook-writing-document-scroll').hover(); await page.mouse.wheel(0, 400); await page.waitForTimeout(120);
  const afterDoc = await geometry(); assert.ok(afterDoc.doc > before.doc); assert.equal(afterDoc.chat, before.chat);
  await page.locator('.handbook-writing-conversation').hover(); await page.mouse.wheel(0, 400); await page.waitForTimeout(120);
  const afterChat = await geometry(); assert.ok(afterChat.chat > afterDoc.chat); assert.equal(afterChat.doc, afterDoc.doc);
  assert.equal(afterChat.inputTop, before.inputTop); assert.equal(afterChat.headingTop, before.headingTop); assert.equal(afterChat.toolbarTop, before.toolbarTop); assert.equal(afterChat.body, before.body);
  await page.locator('.handbook-writing-separator').focus(); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(artifacts, 'dual-scroll-implemented.png') });
  await page.setViewportSize({ width: 1024, height: 800 });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.handbook-writing-layout')).display), 'grid');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(artifacts, 'dual-scroll-1024.png') });
  await page.locator('.handbook-writing-history-item').first().click(); await waitCandidate(page);
  await page.locator('[data-ai-close]').click();
  assert.equal(await page.locator('.has-writing-assistant').count(), 0); assert.equal(await page.locator('[data-handbook-vditor]').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('复用工作台编辑器：打开无 Markdown 中间态，关闭后仍为同一实例', async t => {
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: '修订候选', model: 'fixture' }) });
  const requested = [];
  page.on('request', request => { if (/\/ai-(skills|sources)(?:\?|$)/.test(request.url())) requested.push(new URL(request.url()).pathname); });
  const opened = await page.evaluate(() => {
    const target = document.querySelector('[data-handbook-vditor]');
    const host = document.createElement('section'); host.className = 'handbook-production-writing';
    target.before(host); host.append(target);
    window.originalEditorTarget = target;
    const started = performance.now();
    window.openWriting({ embedded: true, reuseEditor: window.editor, reuseEditorElement: target,
      initialMarkdown: window.editor.getValue(), loadEditor: () => { throw new Error('不应创建第二编辑器'); },
      observeEditorInput: listener => { window.reusedInput = listener; return () => { window.reusedInput = null; }; } });
    return { elapsed: performance.now() - started, markdownVisible: !document.querySelector('[data-ai-markdown]').hidden,
      sameTarget: document.querySelector('[data-ai-rich-editor] [data-handbook-vditor]') === target };
  });
  assert.equal(opened.markdownVisible, false);
  assert.equal(opened.sameTarget, true);
  assert.ok(opened.elapsed < 150, `复用编辑器打开耗时 ${opened.elapsed.toFixed(1)}ms`);
  await page.screenshot({ path: path.join(artifacts, 'reused-editor-opening.png') });
  assert.deepEqual(requested, [], '未打开配置时不预取技能和参考来源');
  await page.locator('[data-ai-skills-open]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-skill-info]')?.textContent !== '正在读取可选能力…');
  assert.equal(requested.filter(path => path.endsWith('/ai-skills')).length, 1);
  await finishConfiguration(page);
  const changed = initial + '\n人工补充的说明。\n';
  await page.evaluate(value => { window.editor.setValue(value); window.reusedInput(value); }, changed);
  await page.waitForFunction(() => !document.querySelector('[data-ai-start]').disabled);
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(await page.evaluate(() => window.editor.getValue()), changed, '生成候选不能提前替换人工正文');
  await page.locator('[data-ai-close]').click();
  assert.equal(await page.evaluate(() => document.querySelector('[data-handbook-vditor]') === window.originalEditorTarget && window.reusedInput === null), true);
  assert.equal(await page.evaluate(() => window.editor.getValue()), changed, '关闭侧栏保留未采用的人工修改');
  assert.equal(await page.locator('[data-handbook-vditor] .vditor-toolbar').count(), 1, '格式栏恢复原位');
  await page.evaluate(() => window.openWriting({ embedded: true, reuseEditor: window.editor,
    reuseEditorElement: window.originalEditorTarget, initialMarkdown: window.editor.getValue(),
    observeEditorInput: listener => { window.reusedInput = listener; return () => { window.reusedInput = null; }; } }));
  await page.waitForFunction(() => document.querySelector('.handbook-writing-history-item'));
  await page.locator('.handbook-writing-history-item').first().click(); await waitCandidate(page);
  assert.equal(await page.evaluate(() => window.editor.getValue()), changed, '查看历史候选不改正文');
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.saved);
  assert.equal((await page.evaluate(() => window.editor.getValue())).trim(), '修订候选');
  const reread = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(reread.status, 200);
  assert.equal(reread.body.data.draft.revision.markdown.trim(), '修订候选', '采用后从真实HTTP读取保存正文');
  assert.deepEqual(errors, []);
});

for (const reuse of [true, false]) test(`仓库图片（${reuse ? '复用' : '新建'}编辑器）：富文本、预览、候选与HTTP保存`, async t => {
  const before = '# 图片说明\n\n![原图](../images/示例图.png)\n\n旧说明。\n';
  const after = before.replace('旧说明。', '新说明。');
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: after, model: 'deterministic-e2e' }) });
  const imageRequests = [];
  // Substitute only the upstream GitLab binary; generation, adoption and draft reread use actual HTTP handlers.
  await page.route('**/api/gitlab/handbooks/HB-1/file?**', route => {
    imageRequests.push(new URL(route.request().url()));
    return route.fulfill({ contentType: 'image/png', body: Buffer.from('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', 'base64') });
  });
  await page.evaluate(async ({ before, reuse }) => {
    const context = { handbookId: 'HB-1', branch: 'main', language: 'zh', filePath: 'docs/sql/字面量.md' };
    window.editor.setValue(before);
    const { observeRepositoryImages } = await import('/knowledge-center/common/markdown/repository-images.js');
    window.releaseImages = observeRepositoryImages(document.querySelector('[data-handbook-vditor]'), context.filePath, context);
    const { renderDatabaseMarkdown } = await import('/knowledge-center/common/markdown/markdown-renderer.js');
    window.readingHTML = renderDatabaseMarkdown(() => '', before, context.filePath, context).html;
    window.openWriting({ embedded: true, host: document.getElementById('view-root'), initialRange: null, initialMarkdown: before, repositoryImageContext: context,
      ...(reuse ? { reuseEditor: window.editor, reuseEditorElement: document.querySelector('[data-handbook-vditor]') } : { loadEditor: async () => window.Vditor }) });
  }, { before, reuse });
  try {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-ai-rich-editor] .vditor-wysiwyg img')].some(img => img.complete && img.naturalWidth > 0 && img.currentSrc.includes('/api/gitlab/')));
  } catch (error) { error.message += JSON.stringify(await page.evaluate(() => ({ images: [...document.images].map(i => ({html:i.outerHTML, current:i.currentSrc,width:i.naturalWidth})), body:document.body.innerText.slice(-900) }))); throw error; }

  assert.equal(await page.evaluate(() => window.editor.getValue()), before);
  assert.match(await page.evaluate(() => window.readingHTML), /api\/gitlab\/handbooks\/HB-1\/file/);
  assert.equal(imageRequests[0].searchParams.get('path'), 'docs/images/示例图.png');
  assert.equal(imageRequests[0].searchParams.get('ref'), 'main');
  assert.equal(imageRequests[0].searchParams.get('language'), 'zh');
  assert.equal(imageRequests[0].searchParams.get('raw'), '1');
  await page.screenshot({ path: path.join(artifacts, `repository-images-rich-${reuse}.png`) });
  await page.locator('[data-ai-format] summary').click();
  await page.locator('[data-ai-mode-markdown]').click();
  await page.locator('[data-ai-markdown-preview-toggle]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-ai-markdown-preview] img')].some(img => img.complete && img.naturalWidth > 0));
  await page.locator('[data-ai-format] summary').click();
  await page.locator('[data-ai-mode-rich]').click();
  // Re-rendering via setValue must attach the display URL to new image nodes too.
  if (reuse) await page.evaluate(before => window.editor.setValue(before), before);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-ai-rich-editor] .vditor-wysiwyg img')].some(img => img.complete && img.naturalWidth > 0));
  await page.locator('[data-ai-start]:enabled').waitFor();
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-ai-inline-review] img, .handbook-review-unchanged img, [data-ai-candidate] img')].some(img => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: path.join(artifacts, 'repository-images-inline-review.png') });
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.saved);
  const result = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(result.status, 200);
  assert.equal(result.body.data.draft.revision.markdown, after);
  assert.doesNotMatch(result.body.data.draft.revision.markdown, /api\/gitlab|srcset/);
  if (await page.locator('[data-ai-close]').count()) await page.locator('[data-ai-close]').click();
  assert.match(await page.evaluate(() => window.editor.getValue()), /!\[原图\]\(\.\.\/images\/示例图.png\)/);
  assert.deepEqual(errors, []);
});


test('知识库可移除：延迟目录不回填、空引用真实生成、历史恢复及重新添加', async t => {
  let mcpReads = 0; const payloads = [];
  const mcp = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const message = JSON.parse(raw); mcpReads++;
    if (message.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
    const result = message.method !== 'tools/call' ? { serverInfo: { name: 'test', version: '1' }, capabilities: {} }
      : message.params.name === 'search_ku' ? { structuredContent: { results: [{ ku_name: 'select-reference', score: .95 }] } }
      : { structuredContent: { title: 'SELECT知识库原文', content: '# SELECT\n\n知识库中的语法依据。' } };
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  await new Promise(resolve => mcp.listen(0, '127.0.0.1', resolve));
  t.after(() => { mcp.closeAllConnections(); mcp.close(); });
  const { api, page, errors } = await launch(t, {
    loadMCPConfig: async () => ({ services: [{ id: 'official-service', name: '知识库', enabled: true, server_url: `http://127.0.0.1:${mcp.address().port}`, knowledgeBases: [{ id: 'official', name: '官方文档', locator: '1' }] }] }),
    generate: async messages => { payloads.push(JSON.parse(messages.at(-1).content)); return { content: '修订后的 SELECT 正文。', model: 'deterministic-e2e' }; },
  });
  let releaseCatalog; let receivedCatalog;
  const received = new Promise(resolve => { receivedCatalog = resolve; });
  const release = new Promise(resolve => { releaseCatalog = resolve; });
  await page.route('**/ai-sources?**', async route => { const result = await route.fetch(); receivedCatalog(); await release; await route.fulfill({ response: result }); });
  await selectText(page, selected); await page.locator('#open-writing').click();
  await openReferences(page); await received;
  await page.getByRole('button', { name: '移除：知识库（MCP）', exact: true }).click();
  assert.equal(await page.locator('[data-ai-source-list] section').count(), 0);
  releaseCatalog();
  await page.waitForFunction(() => document.querySelector('[data-ai-mcp-status]').textContent.includes('知识库已配置'));
  await closeReferences(page); await openReferences(page);
  assert.equal(await page.locator('[data-ai-source-list] section').count(), 0);
  await closeReferences(page);
  await page.locator('[data-ai-requirements]').fill('SELECT SQL，润色选中内容。');
  let submitted; page.on('request', request => { if (request.method() === 'POST' && /\/ai-jobs(?:\?|$)/.test(request.url())) submitted = request.postDataJSON(); });
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.deepEqual(submitted.referenceOrder, []); assert.deepEqual(submitted.confirmedSourceIds, []);
  assert.equal(mcpReads, 0); assert.deepEqual(payloads[0].sources, []);
  await page.locator('[data-ai-close]').click();
  await page.locator('#open-writing').click();
  await page.locator('.handbook-writing-history-item').first().waitFor();
  await page.locator('.handbook-writing-history-item').first().click(); await waitCandidate(page);
  await openReferences(page);
  assert.equal(await page.locator('[data-ai-source-list] section').count(), 0, '恢复显式空引用不重加知识库');
  await page.locator('[data-reference-type="knowledge-mcp"]').click();
  await page.getByRole('button', { name: '添加引用', exact: true }).click();
  assert.equal(await page.locator('[data-ai-source-list] section').count(), 1);
  await closeReferences(page);
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.deepEqual(submitted.referenceOrder, ['knowledge-mcp']);
  assert.ok(mcpReads > 0, '重新加入后真实调用隔离MCP HTTP服务');
  assert.equal(payloads.at(-1).sources[0].title, 'SELECT知识库原文');
  assert.deepEqual(errors, []);
});

test('长引用列表：固定工具栏、全局序号筛选、直接移除和独立滚动', async t => {
  const { page, errors } = await launch(t, { generate: async () => ({ content: '修订正文', model: 'fixture' }) });
  await selectText(page, selected); await page.locator('#open-writing').click(); await openReferences(page);
  await page.locator('[data-reference-type="local-document"]').click();
  for (let index = 1; index <= 8; index++) {
    await page.locator('[data-ai-source-file]').setInputFiles({ name: `参考${index}-非常长的资料标题用于检查省略效果及完整标题提示.md`, mimeType: 'text/markdown', buffer: Buffer.from(`# SELECT依据${index}\n\n引用事实${index}。`) });
    await page.waitForFunction(count => document.querySelectorAll('[data-ai-source-list] section').length === count && !document.querySelector('[data-ai-source-file]').disabled, index + 1);
    if (index === 3) {
      assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 4);
      assert.equal(await page.locator('[data-ai-references-toggle]').isVisible(), false);
      const fourthGeometry = await page.evaluate(() => {
        const element = document.querySelector('[data-ai-source-list]');
        const list = element.getBoundingClientRect();
        const fourth = element.querySelectorAll('section')[3].getBoundingClientRect();
        return { fourthBottom: fourth.bottom, listBottom: list.bottom, listHeight: list.height, listScrollHeight: element.scrollHeight, viewportHeight: innerHeight };
      });
      assert.ok(fourthGeometry.fourthBottom <= fourthGeometry.listBottom + 1, `第 4 项应完整位于默认列表可视区域：${JSON.stringify(fourthGeometry)}`);
    }
  }
  const rows = page.locator('[data-ai-source-list] section');
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 4);
  assert.equal(await page.locator('[data-ai-references-toggle]').textContent(), '还有 5 项，展开查看');
  await page.locator('[data-ai-references-toggle]').click();
  await page.locator('[data-ai-reference-search]').fill('参考8');
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 1);
  assert.equal(await page.locator('[data-ai-source-list] section:visible [data-source-priority]').textContent(), '09');
  assert.equal(await page.locator('[data-ai-source-list] section:visible [draggable]').getAttribute('draggable'), 'false');
  await page.locator('[data-ai-reference-filter]').selectOption('knowledge-mcp');
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 0);
  assert.equal(await page.getByText('没有匹配的参考文档', { exact: true }).isVisible(), true);
  await page.locator('[data-ai-reference-search]').fill('');
  assert.equal(await page.locator('[data-ai-source-list] section:visible [data-source-priority]').textContent(), '01');
  await page.locator('[data-ai-reference-filter]').selectOption('');
  const geometry = await page.evaluate(() => {
    const list = document.querySelector('[data-ai-source-list]');
    list.scrollTop = list.scrollHeight;
    const panel = document.querySelector('[data-ai-reference-panel] .handbook-ai-settings-dialog');
    const footer = panel.querySelector('footer').getBoundingClientRect();
    const tools = panel.querySelector('.handbook-reference-tools').getBoundingClientRect();
    return { scroll: list.scrollTop, height: list.clientHeight, scrollHeight: list.scrollHeight, footerBottom: footer.bottom, toolsBottom: tools.bottom, listTop: list.getBoundingClientRect().top, viewport: innerHeight };
  });
  assert.ok(geometry.scroll > 0 && geometry.scrollHeight > geometry.height, JSON.stringify(geometry));
  assert.ok(geometry.footerBottom < geometry.viewport && geometry.toolsBottom <= geometry.listTop);
  await page.locator('[data-ai-source-list]').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: path.join(artifacts, 'reference-compact-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'reference-compact-mobile.png') });
  await page.locator('[data-ai-source-list] section').first().getByRole('button', { name: '移除：知识库（MCP）', exact: true }).click();
  assert.equal(await rows.count(), 8);
  assert.equal(await rows.first().locator('[data-source-priority]').textContent(), '01');
  await page.locator('[data-ai-references-toggle]').click();
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 4);
  assert.deepEqual(errors, []);
});
