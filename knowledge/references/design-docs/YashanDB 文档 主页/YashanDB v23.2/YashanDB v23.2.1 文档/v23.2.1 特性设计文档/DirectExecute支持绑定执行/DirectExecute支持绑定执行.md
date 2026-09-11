Created by 苏文, last modified on 十月 13, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

  [YDBRD-18446](https://jira.yasdb.com/browse/YDBRD-18446?src=confmacro)    -  jdbc支持directExecute绑定参数  完成

  [YDBRD-21446](https://jira.yasdb.com/browse/YDBRD-21446?src=confmacro)    -  【jdbc】支持directExecute绑定参数  完成

directExecute表示客户端与服务端只交互一次，客户端发送sql，服务端执行 prepare，execute后返回结果。

目前directExecute尚未支持绑定执行。

本文档对directExecute支持绑定做设计描述。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

directExecute支持绑定执行

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

  


|配置/接口|说明|示例|
|:---:|:---:|:---:|
|clientPrepare配置参数|开启直接执行带绑定参数；,设置true或者 false；,其他非法值忽略不报错，默认为false。|```
jdbc<span class="token operator" style="color: rgb(103,205,204);">:</span>yasdb<span class="token operator" style="color: rgb(103,205,204);">:</span><span class="token operator" style="color: rgb(103,205,204);">/</span><span class="token operator" style="color: rgb(103,205,204);">/</span><span class="token number" style="color: rgb(240,141,73);">192.168</span><span class="token number" style="color: rgb(240,141,73);">.1</span><span class="token number" style="color: rgb(240,141,73);">.1</span><span class="token operator" style="color: rgb(103,205,204);">:</span><span class="token number" style="color: rgb(240,141,73);">1688</span><span class="token operator" style="color: rgb(103,205,204);">/</span>yashan<span class="token operator" style="color: rgb(103,205,204);">?</span>
```,  
|
|void   setClientPrepare  (  boolean   clientPrepare)|YasConnection接口扩展方法|Connection connection = DriverManager.  getConnection(url);    
  ((YasConnection)connection).  setClientPrepare(true);|


  
    
    


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

  


只对PrepareStatement绑定参数执行场景生效；

对CallableStatement存储过程绑定参数不生效。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

  


### 5.1 DirectExecute协议

直接执行支持绑定场景后，请求报文后可跟绑定参数值。

ReqExecute + SqlText   **+ BindParameters**

报文格式：

|stmtId(16)||flag(8)|unused(8)|
|:---:|---|:---:|:---:|
|paramCount(16)||paramSize(16)||
|prefetch(32)||||
|sqlLen(32)||||
|sqlStr(sqlLen)||||
|paramTypeDesc(0 ..   paramCount)||||
|params  (0 .. paramSize  )||||


Ack报文格式不变：AckPrepare + AckExecute + [rows or dmlRows/dmlErrors]

### 5.2 结果集类型修正

场景描述：

1 执行器引入多执行计划，执行前会loadBestPlan，此时才确定投影列类型；

2 如果投影列是一个绑定参数，例如 select ? from dual, 投影列prepare后是unknown类型，类型推导会用varchar兜底；如果绑定值是 int、lob 等其他非varchar类型，客户端无法正确获取结果。

解决方案：

![](https://pingcode.yasdb.com/atlas/files/public/67396c058970c2af4f5208c7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg2ODQsImV4cCI6MTc4MjMwOTQ4NH0.Q6z_A1G9-U7FgUnLndM6rEZnS-MkLgq2hfjr_PyAdlQ)

  


  


1 PlanContext上增加投影列类型信息, 

typedef struct StPlanContext {    
  AnlMemGuardian guardian;    
  CodUint32 refCount; /* for plan invaild */    
  CodUint32 pad;    
  struct StPlanContext* hashNext; /* for plan hash crash list*/

MemoryContext* owner;    
  ObjectArray* datasets; /* optmzr may add dataset */    
  ObjectArray* subQueries; /* <PlanSubQuery> */    
  PlanCheckItems checkItems;    
  ...

...    
  CodUint8 reserved;    
  **CodUint16 projCount;**    
  **CodUint8* projTypes; /* projection types */**    
  union {    
  AnlPlan* plan; /* dml */    
  CodPointer entry; /* ddl entry */    
  };    
  CodUint32 initPos;    
  CodUint32 planHashValue;    
  CodDate firstLoadTime;    
  } PlanContext;

2 CBO生成最优计划后，将CboOperator->planDs→columns 列类型 拷贝到PlanContext上；

3 loadBestPlan后，preExecute时检查是否修正投影列类型；如果需要，服务端定位到Packet中offset(sizeof(CsPacketHead) + sizeof(AckPrepare) + sizeof(AckExecute)), 逐列修改column type；

4  行数据发送，sendColumn投影列类型不再从parseTree取，改为从PlanContext上取 projectTypes；

5 客户端对于查询绑定场景，再次执行时判断绑定类型是否有变化，有变化则从新执行directExecute；无变化则执行走execute（sql已经prepare过）

  


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


*评估代码量KLOC、工作量（人天）。*

  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[directExecute.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDVhMWFkOWEzMzExZGM4NzM1IiwicmVmX2lkIjoiNjczOTZjMDU3MjgyMDZlZmI5MmYwY2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4Njg0LCJleHAiOjE3ODIzODUwODR9.Otc1Nwy6KvSF4dhxK7JQcKkLt7_66IqxqsLpxLwrkoU)

 (image/png)    


[directExecute.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDU4OTcwYzJhZjRmNTIwOGM2IiwicmVmX2lkIjoiNjczOTZjMDU3MjgyMDZlZmI5MmYwY2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4Njg0LCJleHAiOjE3ODIzODUwODR9.mw5_61DIyzOtRViQ8XgDFR5dUPiIOFmZnqy5DXaAS4E)

 (image/png)    
