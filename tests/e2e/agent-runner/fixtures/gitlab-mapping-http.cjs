const assert = require('node:assert/strict');
const { createServer } = require('node:http');

// Run in a dedicated authenticated page; the caller owns and closes that page.
async function exerciseGitlabMappingHttp(page) {
  const requests = [];
  let failWrite = true;
  const connection = { id: 'mapping-connection', name: '隔离映射仓库', projectPath: 'group/project', state: 'active', authMode: 'user_oauth' };
  let rules = [{ id: 'mapping-rule', connectionId: connection.id, productCode: 'YDB', version: '23.1', branch: 'main', matchKind: 'EXACT', state: 'active', rowVersion: 4 }];
  const backend = createServer(async (request, response) => {
    const chunks=[]; for await (const part of request) chunks.push(part);
    const url=new URL(request.url,'http://localhost');
    const body=chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    requests.push({ path:url.pathname,query:Object.fromEntries(url.searchParams),method:request.method,headers:request.headers,body });
    let status=200, data={items:[],users:[]};
    if(request.method!=='GET') {
      if(failWrite) status=503;
      else if(url.pathname.endsWith('/delete')) {
        const id=decodeURIComponent(url.pathname.split('/').at(-2));
        const index=rules.findIndex(item=>item.id===id && item.state==='draft');
        if(index<0) status=409;
        else data=rules.splice(index,1)[0];
      } else if(url.pathname.endsWith('/disable') || url.pathname.endsWith('/activate')) {
        const action=url.pathname.split('/').at(-1);
        const id=decodeURIComponent(url.pathname.split('/').at(-2));
        const rule=rules.find(item=>item.id===id);
        if(action==='activate' && rule.revisionOfId) rules.find(item=>item.id===rule.revisionOfId).state='superseded';
        Object.assign(rule,{state:action==='disable'?'disabled':'active',rowVersion:rule.rowVersion+1});
        data=rule;
      } else if(request.method==='PUT') {
        const existing=rules.find(item=>item.id===decodeURIComponent(url.pathname.split('/').at(-1)));
        data={...body,id:'revision-rule',state:'draft',rowVersion:1,revisionOfId:existing.id};
        rules.push(data);
      } else { rules.push({...body,id:'created-rule',rowVersion:1,state:'draft'});data=rules.at(-1); }
    } else if(url.pathname.endsWith('/version-mappings')) data={items:rules};
    else if(url.pathname.endsWith('/connections')) data={items:[connection]};
    else if(url.pathname.endsWith('/oauth/status')) data={connected:true};
    else if(url.pathname.endsWith('/oauth/config')) data={configured:true};
    response.writeHead(status,{'Content-Type':'application/json'});
    response.end(JSON.stringify(status===200?{success:true,data}:{success:false,error:{code:'ISOLATED_MAPPING_FAILURE',message:'隔离版本映射服务不可用'}}));
  });
  await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
  const pattern='**/knowledge-center/api/**';
  const handler=async route=>{const url=new URL(route.request().url());url.hostname='127.0.0.1';url.port=String(backend.address().port);await route.fulfill({response:await route.fetch({url:url.href})});};
  await page.route(pattern,handler);
  try {
    await page.locator('[data-view="platform"]').first().click();
    await page.locator('[data-platform-tab="gitlab"]').click();
    await page.locator('[data-gitlab-view="mappings"]').click();
    await page.locator('[data-version-mapping-edit="mapping-rule"]').waitFor({ state: 'visible' });
    const waitText=(selector,text)=>page.waitForFunction(({selector,text})=>document.querySelector(selector)?.textContent===text,{selector,text});
    assert.deepEqual(await page.locator('.gitlab-version-table thead th').allTextContents(),
      ['产品','PingCode 版本','GitLab 仓库','目标分支','状态','操作']);
    await page.locator('[data-version-mapping-search]').fill('YDB');
    assert.equal(await page.locator('[data-version-mapping-edit="mapping-rule"]').isVisible(),true);
    await page.locator('[data-version-mapping-search]').fill('NO_MATCH_PRODUCT');
    assert.match(await page.locator('.gitlab-version-table tbody').textContent(),/暂无映射/);
    await page.locator('[data-version-mapping-search]').fill('');
    await page.locator('[data-version-mapping-status]').selectOption('active');
    assert.equal(await page.locator('[data-version-mapping-edit="mapping-rule"]').isVisible(),true);
    await page.locator('[data-version-mapping-status]').selectOption('draft');
    assert.equal(await page.locator('[data-version-mapping-edit="mapping-rule"]').count(),0);
    await page.locator('[data-version-mapping-status]').selectOption('');
    await page.locator('[data-version-mapping-add]').click();
    await page.locator('[data-version-mapping-preset]').selectOption('0');
    assert.equal(await page.locator('[data-version-mapping-form] [name=productCode]').inputValue(),'DB');
    assert.equal(await page.locator('[data-version-mapping-form] [name=version]').inputValue(),'23.4.7');
    assert.equal(await page.locator('[data-version-mapping-form] [name=branch]').inputValue(),'br23.4.7');
    await page.locator('[data-version-mapping-cancel]').first().click();
    await page.locator('[data-version-mapping-add]').click();
    let form=page.locator('[data-version-mapping-form]');
    await form.locator('[name=productCode]').fill('NEW');
    await form.locator('[name=version]').fill('1.0');
    await form.locator('[name=connectionId]').selectOption(connection.id);
    await form.locator('[name=branch]').fill('release');
    await form.locator('[type=submit]').click();await waitText('.gitlab-version-feedback','隔离版本映射服务不可用');
    assert.equal(await form.locator('[type=submit]').isEnabled(),true);
    assert.equal(await form.locator('[name=branch]').inputValue(),'release');
    failWrite=false;
    await form.locator('[type=submit]').click();await waitText('.gitlab-version-feedback','映射草案已保存。');
    assert.equal(await page.locator('[data-version-mapping-form]').count(),0);
    const deleteOpen=()=>page.locator('[data-version-mapping-delete-open="created-rule"]');
    await deleteOpen().click();
    const deleteDialog=page.locator('[data-version-mapping-delete-dialog]');
    assert.match(await deleteDialog.locator('[data-version-mapping-delete-target]').textContent(),/NEW \/ 1\.0/);
    const beforeCancel=requests.length;
    await deleteDialog.locator('[data-version-mapping-delete-cancel]').click();
    assert.equal(requests.length,beforeCancel);
    assert.equal(await deleteOpen().isVisible(),true);
    await deleteOpen().click();
    failWrite=true;
    await deleteDialog.locator('[data-version-mapping-action="delete"]').click();
    await waitText('.gitlab-version-feedback','隔离版本映射服务不可用');
    assert.equal(await deleteOpen().isVisible(),true);
    await deleteOpen().click();
    failWrite=false;
    await deleteDialog.locator('[data-version-mapping-action="delete"]').click();
    await waitText('.gitlab-version-feedback','草案已删除。');
    assert.equal(await deleteOpen().count(),0);
    await page.locator('[data-version-mapping-edit="mapping-rule"]').click();
    form=page.locator('[data-version-mapping-form]');
    assert.match(await form.textContent(),/当前启用规则持续生效/);
    await form.locator('[name=branch]').fill('release-next');
    await form.locator('[type=submit]').click();await waitText('.gitlab-version-feedback','修订草案已保存，原规则仍生效。验证后可启用。');
    assert.equal(await page.locator('[data-version-mapping-action=disable][data-version-mapping-id="mapping-rule"]').isVisible(),true);
    const activate=()=>page.locator('[data-version-mapping-action="activate"][data-version-mapping-id="revision-rule"]');
    failWrite=true;await activate().click();await waitText('.gitlab-version-feedback','隔离版本映射服务不可用');
    failWrite=false;await activate().click();await waitText('.gitlab-version-feedback','映射已验证并启用。');
    const disable=()=>page.locator('[data-version-mapping-action="disable"][data-version-mapping-id="revision-rule"]');
    const beforeDisableCancel=requests.length;
    page.once('dialog',dialog=>dialog.dismiss());await disable().click();
    assert.equal(requests.length,beforeDisableCancel);
    failWrite=true;page.once('dialog',dialog=>dialog.accept());await disable().click();await waitText('.gitlab-version-feedback','隔离版本映射服务不可用');
    failWrite=false;page.once('dialog',dialog=>dialog.accept());await disable().click();await waitText('.gitlab-version-feedback','映射已停用。');
    assert.equal(await activate().isVisible(),true);
    const writes=requests.filter(item=>item.method!=='GET');
    assert.deepEqual(writes.map(item=>item.method),['POST','POST','POST','POST','PUT','POST','POST','POST','POST']);
    const base='/knowledge-center/api/gitlab/version-mappings';
    assert.deepEqual(writes.map(item=>item.path),[base,base,`${base}/created-rule/delete`,`${base}/created-rule/delete`,`${base}/mapping-rule`,`${base}/revision-rule/activate`,`${base}/revision-rule/activate`,`${base}/revision-rule/disable`,`${base}/revision-rule/disable`]);
    assert.deepEqual(writes[0].body,{productCode:'NEW',matchKind:'EXACT',version:'1.0',connectionId:connection.id,branch:'release'});
    assert.deepEqual(writes[1].body,writes[0].body);
    assert.deepEqual(writes.slice(2,4).map(item=>item.headers['if-match']),['1','1']);
    assert.equal(writes[4].headers['if-match'],'4');
    assert.equal(writes[4].body.branch,'release-next');
    for(const write of writes) assert.ok(write.headers['idempotency-key']);
    assert.deepEqual(writes.slice(5).map(item=>item.headers['if-match']),['1','1','2','2']);
    return 16;
  } finally {
    await page.unroute(pattern,handler);
    await new Promise(resolve=>backend.close(resolve));
  }
}
module.exports={exerciseGitlabMappingHttp};
