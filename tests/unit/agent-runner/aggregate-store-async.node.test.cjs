const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { DatabaseAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
test('并发读取合并、304校验、跨进程修改、冲突重试和写后失效', async () => {
 let revision=1, payload={count:1}, gets=0, full=0, conflict=true;
 const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){
   gets++; await new Promise(r=>setTimeout(r,20));
   if(req.headers['if-none-match']==='"'+revision+'"'){res.writeHead(304);return res.end();}
   full++;res.setHeader('ETag','"'+revision+'"');return res.end(JSON.stringify({payload,revision}));
  }
  let body='';for await(const chunk of req)body+=chunk;
  if(conflict){conflict=false;revision++;payload={count:5};}
  if(Number(req.headers['if-match'])!==revision){res.statusCode=409;return res.end(JSON.stringify({success:false,error:{code:'REVISION_CONFLICT'}}));}
  payload=JSON.parse(body);revision++;res.end(JSON.stringify({success:true,revision}));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const store=new DatabaseAggregateStore('test','state',{}, {baseUrl:'http://127.0.0.1:'+server.address().port});
  const [a,b]=await Promise.all([store.readAsync(),store.readAsync()]);
  assert.equal(gets,1);a.count=99;assert.equal(b.count,1);
  assert.equal((await store.readRecordAsync()).revision,1);assert.equal(full,1);
  revision++;payload={count:3};assert.equal((await store.readAsync()).count,3);assert.equal(full,2);
  const result=await store.transactionAsync(s=>++s.count);
  assert.equal(result,6);assert.equal((await store.readAsync()).count,6);
  assert.equal((await store.readRecordAsync()).revision,4);
  assert.equal(full,3, '写入后由数据库 304 验证本地快照，不重新读取整份聚合');
  revision++;payload={count:8};
  assert.equal((await store.readAsync()).count,8, '外部写入后必须读取新版本');
  assert.equal(full,4);
 }finally{await new Promise(r=>server.close(r));}
});
