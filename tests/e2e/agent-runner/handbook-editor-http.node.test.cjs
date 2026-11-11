const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const coverageKey = '__kc_istanbul_coverage__';
let caseNumber = 0;
const instrumented = new Map();

async function fixture(t, options = {}) {
  const requests = [];
  const saves = [];
  const controls = { failSave: false, failDelete: true, deleted: false };
  const documents = [{id:'editor-a',kind:'document',title:'第一篇.md'}, {id:'editor-b',kind:'document',title:'第二篇.md'}];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (value, status = 200) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({success:status < 400,data:value}));};
    requests.push({method:req.method,path:req.url});
    if (url.pathname === '/knowledge-center/api/auth/config') return send({casEnabled:false});
    if (url.pathname === '/knowledge-center/api/auth/session') return send({authenticated:true,user:{id:'author',displayName:'编写者'},allowedActions:['knowledge:read','knowledge:write','outline:create','outline:delete','template:read'],visibleModules:['*'],roles:[]});
    if (url.pathname === '/knowledge-center/api/platform/context') return send({brand:{enterpriseName:'隔离平台'}});
    if (url.pathname === '/knowledge-center/api/outline/catalog') return send({items:controls.deleted ? [] : [{id:'outline-editor',handbookId:'HB-EDITOR',name:'编辑验证手册'}],selectedId:'outline-editor',directory:{id:'outline-editor',handbookId:'HB-EDITOR',name:'编辑验证手册',nodes:documents}});
    if (url.pathname === '/knowledge-center/api/outline/governance/outline-editor') {
      if (req.method === 'DELETE') {
        if (controls.failDelete) return send(null, 503);
        controls.deleted = true;
        return send({deleted:true});
      }
      return send({id:'outline-editor',handbookId:'HB-EDITOR',name:'编辑验证手册',status:'draft',nodes:documents});
    }
    if (url.pathname === '/knowledge-center/api/gitlab/mappings/HB-EDITOR') return send(null);
    if (url.pathname.endsWith('/draft')) {
      const id=url.pathname.split('/').at(-2);
      if (req.method === 'PUT') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const submitted = JSON.parse(body);
        saves.push(submitted);
        if (controls.failSave) {
          res.writeHead(503, {'Content-Type':'application/json; charset=utf-8'});
          return res.end(JSON.stringify({success:false,error:{code:'UNAVAILABLE',message:'草稿服务暂不可用'}}));
        }
        return send({exists:true,capabilities:{canEdit:true,canSubmitReview:true},draft:{branch:'',editVersion:submitted.editVersion+1,currentRevisionId:'saved-revision',revision:{id:'saved-revision',markdown:submitted.markdown,htmlSnapshot:submitted.htmlSnapshot}}});
      }
      return send({exists:true,capabilities:{canEdit:true,canSubmitReview:true},draft:{branch:'',editVersion:1,currentRevisionId:`rev-${id}`,revision:{id:`rev-${id}`,markdown:id === 'editor-a' ? '# 第一篇初稿\n\n原始正文甲。' : '# 第二篇初稿\n\n原始正文乙。',htmlSnapshot:''}}});
    }
    if (url.pathname.startsWith('/knowledge-center/api/')) return send({items:[],total:0});
    let relative = decodeURIComponent(url.pathname).replace(/^\/knowledge-center\//,'');
    if (!relative || !path.extname(relative)) relative='knowledge-center-management.html';
    const file=path.resolve(frontend,relative);
    if (!file.startsWith(frontend + path.sep) || !fs.existsSync(file)) {res.writeHead(404).end();return;}
    const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const browser=await chromium.launch({headless:true});

  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if (process.env.KC_FRONTEND_ISTANBUL_CASE_DIR) {
    await page.addInitScript(key=>{globalThis[key]={};},coverageKey);
    await page.route('**/knowledge-center/**/*.js',async route=>{
      const relative=new URL(route.request().url()).pathname.replace(/^\/knowledge-center\//,'');
      if (relative.split('/').includes('vendor')) return route.continue();
      const file=path.resolve(frontend,relative);
      if (!file.startsWith(frontend+path.sep) || !fs.existsSync(file)) return route.continue();
      const response=await route.fetch();
      const source=await response.text();
      let cached=instrumented.get(file);
      if (!cached || cached.source!==source) {
        const {createInstrumenter}=require('istanbul-lib-instrument');
        cached={source,body:createInstrumenter({esModules:true,coverageVariable:coverageKey,compact:false}).instrumentSync(source,file)};
        instrumented.set(file,cached);
      }
      return route.fulfill({response,body:cached.body});
    });
  }
  t.after(async()=>{
    try {
      if (!process.env.KC_FRONTEND_ISTANBUL_CASE_DIR) return;
      const counts=await page.evaluate(key=>globalThis[key] || {},coverageKey);
      assert.ok(Object.keys(counts).length,'必须采集实际产品计数');
      fs.mkdirSync(process.env.KC_FRONTEND_ISTANBUL_CASE_DIR,{recursive:true});
      fs.writeFileSync(path.join(process.env.KC_FRONTEND_ISTANBUL_CASE_DIR,`editor-${process.pid}-${++caseNumber}.json`),JSON.stringify(counts));
    } finally {
      await browser.close();
    }
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/knowledge-center/${options.outline ? 'outlines/HB-EDITOR' : 'production/handbook/HB-EDITOR?documentId=editor-a'}`);
  if (options.outline) await page.locator('[data-outline-delete]').waitFor({state:'attached'});
  else {
    await page.getByRole('button',{name:'编辑',exact:true}).waitFor();
    await page.getByText('第一篇初稿',{exact:true}).waitFor();
  }
  return {page,requests,errors,saves,controls};
}

test('大纲移入回收站取消不写入，失败恢复后可重试',async t=>{
  const {page,requests,errors,controls}=await fixture(t,{outline:true});
  await page.locator('.outline-more-actions > summary').click();
  const info=page.locator('[data-outline-info-toggle]');
  await info.click();
  await page.locator('#outline-handbook-info').waitFor({state:'visible'});
  assert.equal(await info.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#outline-handbook-info [data-outline-info-close]').evaluate(el=>el===document.activeElement),true);
  await page.locator('#outline-handbook-info [data-outline-info-close]').click();
  assert.equal(await info.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('.outline-more-actions > summary').evaluate(el=>el===document.activeElement),true);
  await page.locator('.outline-more-actions > summary').click();
  const help=page.locator('[data-outline-template-help]');
  await help.click();
  await page.locator('[data-outline-template-help-panel]').waitFor({state:'visible'});
  assert.equal(await help.getAttribute('aria-expanded'),'true');
  assert.match(await page.locator('[data-outline-template-help-panel]').innerText(),/技术领域分工/);
  await page.locator('[data-outline-template-help-close]').click();
  assert.equal(await help.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('.outline-more-actions > summary').evaluate(el=>el===document.activeElement),true);
  await page.locator('[data-outline-back]').click();
  await page.waitForURL('**/knowledge-center/outlines');
  await page.locator('[data-outline-id="HB-EDITOR"]').click();
  await page.waitForURL('**/knowledge-center/outlines/HB-EDITOR');
  await page.locator('.outline-more-actions > summary').click();
  const remove=page.locator('[data-outline-delete]');
  page.once('dialog',dialog=>dialog.dismiss());
  await remove.click();
  assert.equal(requests.filter(r=>r.method==='DELETE').length,0);
  page.once('dialog',dialog=>dialog.accept());
  await remove.click();
  await page.getByText('删除失败',{exact:true}).waitFor();
  assert.equal(await remove.isEnabled(),true);
  assert.equal(requests.filter(r=>r.method==='DELETE').length,1);
  controls.failDelete=false;
  page.once('dialog',dialog=>dialog.accept());
  await remove.click();
  await page.waitForURL('**/knowledge-center/outlines');
  await page.getByText('大纲已移入回收站',{exact:true}).waitFor();
  assert.equal(requests.filter(r=>r.method==='DELETE' && r.path==='/knowledge-center/api/outline/governance/outline-editor').length,2);
  assert.ok(requests.filter(r=>r.path==='/knowledge-center/api/outline/catalog').length>=2);
  assert.deepEqual(errors,[]);
});

async function openDirectory(page) {
  const button=page.locator('[data-handbook-directory-open]');
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  await page.locator('.handbook-production-directory.is-open').waitFor();
}

async function selectFormat(page,value) {
  await page.locator('.handbook-editor-format > summary').click();
  await page.locator(`[data-handbook-editor-format="${value}"]`).click();
}

test('共享草稿保存失败后保留正文并可重试',async t=>{
  const {page,errors,saves,controls}=await fixture(t);
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  await page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]').waitFor();
  await selectFormat(page,'markdown');
  const editor=page.locator('[data-handbook-markdown-editor]');
  await editor.fill('# 待取消的本地修改');
  await page.locator('.handbook-more-menu > summary').click();
  page.once('dialog',dialog=>{assert.match(dialog.message(),/取消当前页面中的修改/);return dialog.dismiss();});
  await page.locator('[data-handbook-discard]').click();
  assert.equal(await editor.inputValue(),'# 待取消的本地修改');
  assert.equal(await page.locator('[data-handbook-draft-save]').isEnabled(),true);
  assert.equal(saves.length,0);
  if (!await page.locator('.handbook-more-menu').evaluate(el=>el.open)) await page.locator('.handbook-more-menu > summary').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-handbook-discard]').click();
  await page.waitForFunction(()=>document.querySelector('[data-handbook-markdown-editor]')?.value.includes('第一篇初稿'));
  assert.equal(await page.locator('[data-handbook-draft-save]').isEnabled(),false);
  assert.equal(saves.length,0);
  await editor.fill('# 共享草稿保存验证');
  controls.failSave=true;
  await page.locator('[data-handbook-draft-save]').click();
  await page.getByText('保存失败：草稿服务暂不可用',{exact:true}).waitFor();
  assert.equal(await editor.inputValue(),'# 共享草稿保存验证');
  assert.equal(saves[0].markdown,'# 共享草稿保存验证');
  assert.equal(saves[0].editVersion,1);
  controls.failSave=false;
  await page.locator('[data-handbook-draft-save]').click();
  await page.getByText('共享草稿 v2 已保存，可从“更多”选择“提交审核”。',{exact:true}).waitFor();
  assert.equal(saves.length,2);
  assert.equal(saves[1].markdown,'# 共享草稿保存验证');
  assert.equal(saves[1].editVersion,1);
  assert.equal(await page.locator('[data-handbook-draft-save]').isEnabled(),false);
  assert.deepEqual(errors,[]);
});

test('手册正文通过真实可视化编辑器和Markdown往返保留输入及预览',async t=>{
  const {page,requests,errors}=await fixture(t);
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  const editor=page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]');
  await editor.waitFor();
  assert.match(await editor.innerText(),/第一篇初稿/);
  await editor.fill('可视化输入保留验证');
  await page.getByText('有未保存修改',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-handbook-draft-save]').isEnabled(),true);
  await selectFormat(page,'markdown');
  const markdown=page.locator('[data-handbook-markdown-editor]');
  assert.match(await markdown.inputValue(),/可视化输入保留验证/);
  await markdown.fill('# 格式往返标题\n\n中文正文与 **粗体**。');
  await page.getByRole('button',{name:'显示预览',exact:true}).click();
  await page.locator('.handbook-markdown-preview h1').waitFor();
  assert.equal(await page.locator('.handbook-markdown-preview h1').innerText(),'格式往返标题');
  assert.equal(await page.locator('.handbook-markdown-preview strong').innerText(),'粗体');
  await page.getByRole('button',{name:'返回编辑',exact:true}).click();
  assert.equal(await markdown.inputValue(),'# 格式往返标题\n\n中文正文与 **粗体**。');
  await selectFormat(page,'rich');
  await editor.waitFor();
  assert.match(await editor.innerText(),/格式往返标题/);
  await page.getByRole('button',{name:'预览',exact:true}).click();
  await page.getByRole('button',{name:'编辑',exact:true}).waitFor();
  assert.equal(await page.locator('[data-handbook-vditor]').count(),0);
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  await editor.waitFor();
  assert.match(await editor.innerText(),/格式往返标题/);
  assert.ok(requests.some(r=>r.method==='GET' && r.path.includes('/editor-a/draft?')));
  assert.deepEqual(errors,[]);
});

test('手册切换文档时取消保留输入，确认后回读共享草稿，窄屏自动关闭目录',async t=>{
  const {page,requests,errors}=await fixture(t);
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  await page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]').waitFor();
  await selectFormat(page,'markdown');
  const markdown=page.locator('[data-handbook-markdown-editor]');
  await markdown.fill('# 取消切换应保留的本地正文');
  await openDirectory(page);
  const same=page.locator('[data-handbook-document="editor-a"]');
  await same.click();
  assert.match(page.url(),/documentId=editor-a/);
  // Reopening the current document reloads the server draft. Start a fresh edit
  // before testing navigation to a different document.
  await markdown.waitFor();
  await markdown.fill('# 取消切换应保留的本地正文');
  const before=requests.filter(r=>r.path.includes('/editor-b/draft')).length;
  page.once('dialog',dialog=>{assert.match(dialog.message(),/未保存修改/);return dialog.dismiss();});
  await page.locator('[data-handbook-document="editor-b"]').click();
  assert.match(page.url(),/documentId=editor-a/);
  assert.equal(await markdown.inputValue(),'# 取消切换应保留的本地正文');
  assert.equal(requests.filter(r=>r.path.includes('/editor-b/draft')).length,before);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-handbook-document="editor-b"]').click();
  await page.waitForURL('**/*documentId=editor-b*');
  await page.getByText('第二篇初稿',{exact:true}).waitFor();
  await same.click();
  await markdown.waitFor();
  assert.match(await markdown.inputValue(),/第一篇初稿/);
  assert.doesNotMatch(await markdown.inputValue(),/取消切换应保留/);
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-handbook-directory-close]').last().click();
  await openDirectory(page);
  await page.locator('[data-handbook-document="editor-b"]').click();
  await page.waitForURL('**/*documentId=editor-b*');
  await page.waitForFunction(()=>document.querySelector('[data-handbook-directory-open]').getAttribute('aria-expanded')==='false');
  assert.deepEqual(errors,[]);
});

test('手册目录范围切换尊重未保存确认，全局预览可退出',async t=>{
  const {page,errors}=await fixture(t);
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  await page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]').waitFor();
  await selectFormat(page,'markdown');
  await page.locator('[data-handbook-markdown-editor]').fill('# 目录切换待确认');
  await openDirectory(page);
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('[data-handbook-directory-mode="mine"]').click();
  assert.equal(new URL(page.url()).searchParams.get('view'),null);
  assert.equal(await page.locator('[data-handbook-markdown-editor]').inputValue(),'# 目录切换待确认');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-handbook-directory-mode="mine"]').click();
  await page.waitForURL('**/*view=mine*');
  await page.getByRole('heading',{name:'当前文档不在“只看我负责”范围'}).waitFor();
  await page.getByRole('link',{name:'查看全部文档',exact:true}).click();
  await page.locator('[data-handbook-current-document="editor-a"]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('view'),null);
  await openDirectory(page);
  await page.locator('.handbook-more-menu > summary').click();
  await page.getByRole('button',{name:'全局预览',exact:true}).click();
  await page.locator('.handbook-production-page.is-focus-mode').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-handbook-focus-toggle]')?.getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('[data-handbook-directory-open]').getAttribute('aria-expanded'),'false');
  // The action sits inside the more menu, so reopen that public menu to exit.
  await page.locator('.handbook-more-menu > summary').click();
  await page.getByRole('button',{name:'退出全局预览',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-handbook-focus-toggle]')?.getAttribute('aria-pressed')==='false');
  await page.locator('.handbook-production-page.is-focus-mode').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
});
