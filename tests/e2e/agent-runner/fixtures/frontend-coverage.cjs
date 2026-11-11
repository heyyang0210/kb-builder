const fs = require('node:fs');
const path = require('node:path');

const frontend = path.resolve(__dirname, '../../../../apps/knowledge-center-web/frontend/knowledge-center');
const caseDirectory = process.env.KC_FRONTEND_ISTANBUL_CASE_DIR;
const coverageKey = '__kc_istanbul_coverage__';
let sequence = 0;

async function instrumentFrontend(page, name) {
  if (!caseDirectory) return async () => {};
  const { createInstrumenter } = require('istanbul-lib-instrument');
  const instrumenter = createInstrumenter({ esModules: true, coverageVariable: coverageKey, compact: false });
  await page.addInitScript(key => { globalThis[key] = {}; }, coverageKey);
  await page.route('**/knowledge-center/**/*.js', async route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const relative = pathname.replace(/^\/knowledge-center\//, '');
    const file = path.resolve(frontend, relative);
    if (!pathname.startsWith('/knowledge-center/') || !file.startsWith(frontend + path.sep) ||
        relative.split('/').includes('vendor') || !fs.existsSync(file)) return route.continue();
    if (requestUrl.hostname === 'model-http.test') requestUrl.hostname = '127.0.0.1';
    const response = await route.fetch({ url: requestUrl.href });
    if (!response.ok()) return route.fulfill({ response });
    return route.fulfill({ response, body: instrumenter.instrumentSync(await response.text(), file) });
  });
  return async () => {
    const coverage = await page.evaluate(key => globalThis[key] || {}, coverageKey);
    if (!Object.keys(coverage).length) throw new Error(`${name} 浏览器页面未生成产品源码计数`);
    fs.mkdirSync(caseDirectory, { recursive: true });
    fs.writeFileSync(path.join(caseDirectory, `${name}-${process.pid}-${++sequence}.json`), JSON.stringify(coverage));
  };
}

module.exports = { instrumentFrontend };
