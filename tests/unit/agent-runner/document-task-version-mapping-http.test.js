const fs = require('node:fs');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('工单业务版本映射统一入口真实HTTP', () => {
  let root, server, upstream, base, oldMode, connection, mapping, rule, upstreamRequests;
  beforeEach(async () => {
    oldMode = process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;
    process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'database';
    process.env.GITLAB_TOKEN_task_mapping_fixture = 'isolated-token';
    const runtime = path.resolve('runtime/test-results'); fs.mkdirSync(runtime, {recursive:true});
    root = fs.mkdtempSync(path.join(runtime, 'task-mapping-'));
    fs.writeFileSync(path.join(root,'template.xlsx'),'fixture'); fs.writeFileSync(path.join(root,'sample.xlsx'),'fixture');
    upstreamRequests = [];
    upstream = http.createServer((req,res) => {
      upstreamRequests.push({url:req.url,token:req.headers['private-token']});
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify([{name:'main'}]));
    });
    await new Promise(resolve => upstream.listen(0,'127.0.0.1',resolve));
    connection = {id:'repo',host:`http://127.0.0.1:${upstream.address().port}`,project:'team/docs',mode:'sandbox',authMode:'service_account',credentialRef:'task_mapping_fixture',status:'active'};
    mapping = {connectionId:'repo',defaultBranch:'main',enabledBranches:['main']};
    rule = {id:17,rowVersion:3,branch:'main'};
    const domainStore = {
      readPrincipalsAsync:async()=>({items:[{id:'writer',displayName:'编写人'}]}),
      readPlatformGitLabMapping:()=>mapping,
      readPlatformGitLabConnection:()=>connection,
      readPlatformGitLabMappingAsync:async()=>mapping,
      readPlatformGitLabConnectionAsync:async()=>connection,
      resolveGitLabVersionMapping:async(id,product,version)=>{
        expect([id,product,version]).toEqual(['repo','DB','23.4']);return rule;
      },
    };
    const session = {user:{id:'writer'},roles:['PLATFORM_ADMIN'],allowedActions:['platform:manage','knowledge:read','knowledge:write']};
    const handler = createKnowledgeCenterHandler({
      config:{KNOWLEDGE_CENTER_PREFIX:'/knowledge-center',OUTLINE_TEMPLATE_PATH:path.join(root,'template.xlsx'),OUTLINE_SAMPLE_PATH:path.join(root,'sample.xlsx')},
      stores:{domainStore,knowledgeAssetsStore:{read:()=>({handbooks:[{handbookId:'h1',name:'测试手册',ownerA:{principalId:'writer'}}]})}},
      modules:{auth:{authorize:async()=>session}},handbookProductionService:{},
      documentTasksOptions:{filePath:path.join(root,'tasks.json'),defaultOwnerId:'writer'},
      documentTaskCatalog:async()=>({versions:['main','legacy'],outlineVersionId:'published-v1',chapters:[],documents:[{id:'d1',name:'测试文档'}]}),
    });
    server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    base=`http://127.0.0.1:${server.address().port}/knowledge-center/api/document-tasks`;
  });
  afterEach(async()=>{
    for(const service of [server,upstream]) if(service) {service.closeAllConnections();await new Promise(resolve=>service.close(resolve));}
    fs.rmSync(root,{recursive:true,force:true});
    if(oldMode===undefined)delete process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;else process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE=oldMode;
    delete process.env.GITLAB_TOKEN_task_mapping_fixture;
  });
  async function request(suffix,body,expectedStatus=200){
    const response=await fetch(base+suffix,body?{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':`task-mapping-${suffix}`},body:JSON.stringify(body)}:{});
    const payload=await response.json();expect(response.status).toBe(expectedStatus);expect(payload.success).toBe(expectedStatus===200);return expectedStatus===200?payload.data:payload;
  }
  async function importTasks(){
    const tasks=[{number:'T-valid',product:'DB',version:'23.4'},{number:'T-no-product',version:'23.4'},{number:'T-no-version',product:'DB'}];
    const preview=await request('/import?preview=true',{tasks});await request('/import',{tasks,digest:preview.digest});
  }
  const catalog=number=>`/catalog?handbookId=h1&ticketNumber=${number}`;
  async function write(suffix, body, status = 200) {
    const response = await fetch(base + suffix, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `mapping-write-${crypto.randomUUID()}` }, body: JSON.stringify(body) });
    const result = await response.json();
    expect(response.status).toBe(status);
    return status === 200 ? result.data : result.error;
  }
  test('缺少业务产品或版本时提供已启用且可读取分支，不猜测来源业务版本',async()=>{
    await importTasks();
    for(const number of ['T-no-product','T-no-version'])expect(await request(catalog(number))).toMatchObject({versions:['main'],manualVersionSelection:true});
    expect(upstreamRequests).toHaveLength(2);
  });
  test('缺来源版本的范围确认只接受当前可读分支，保持业务版本为空', async () => {
    await importTasks();
    let task = await request('/T-no-version');
    task = await write('/T-no-version/decomposition', { expectedRevision: task.revision, confirm: true,
      ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'writer' }] });
    const proposal = { expectedRevision: task.revision, confirm: true, impact: 'involved',
      documents: [{ id: 'd1', ownerId: 'writer' }] };
    expect((await write('/T-no-version/handbooks/h1', { ...proposal, targetVersion: 'legacy' }, 422)).code).toBe('VERSION_INVALID');
    task = await write('/T-no-version/handbooks/h1', { ...proposal, targetVersion: 'main' });
    expect(task.version).toBeFalsy();
    expect(task.decomposition.handbooks[0]).toMatchObject({ targetVersion: 'main', confirmed: true });
    expect(task.decomposition.handbooks[0].versionMapping).toBeUndefined();
    expect(await request(catalog('T-no-version'))).toMatchObject({ versions: ['main'], manualVersionSelection: true });
  });
  test('映射与连接故障不回退其他版本，恢复后使用真实可读分支',async()=>{
    await importTasks();const validMapping=mapping;
    mapping=null;expect(await request(catalog('T-valid'))).toMatchObject({versions:[],versionMappingError:'该手册尚未配置 GitLab 内容映射'});
    mapping=validMapping;const validConnection=connection;
    connection=null;expect(await request(catalog('T-valid'),null,404)).toMatchObject({error:{code:'GITLAB_CONNECTION_NOT_FOUND',message:'GitLab 仓库连接不存在'}});
    connection=validConnection;connection.status='disabled';
    expect(await request(catalog('T-valid'))).toMatchObject({versions:[],versionMappingError:'仓库连接已停用'});
    connection.status='active';rule=null;
    expect(await request(catalog('T-valid'))).toMatchObject({versions:[],versionMappingError:expect.stringContaining('尚无映射')});
    expect(upstreamRequests).toEqual([]);
    rule={id:17,rowVersion:3,branch:'unavailable'};
    expect(await request(catalog('T-valid'))).toMatchObject({versions:[],versionMappingError:'映射目标分支不存在或当前用户不可读取'});
    rule.branch='main';expect(await request(catalog('T-valid'))).toMatchObject({versions:['main'],versionMapping:{id:17,rowVersion:3,branch:'main'}});
    expect(upstreamRequests.length).toBe(2);
    for(const req of upstreamRequests){expect(req.url).toContain('/repository/branches');expect(req.token).toBe('isolated-token');}
  });
});
