Created by 吴煜, last modified on 五月 06, 2024

*详细设计-YDBRD-26063 : 分布式plancache框架优化*

JIRA：    [https://pingcode.yasdb.com/pjm/items/66168fdcfd997db58ad70a47](https://pingcode.yasdb.com/pjm/items/66168fdcfd997db58ad70a47)    ?    
  #YDBRD-26063 分布式plancache框架优化

##   [1. 总述](#1-总述)  

来源于国金认证

  [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b068](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b068)    ?#YASHAN-280  分布式plancache框架优化

###   [1.1 需求来源](#11-需求来源)  

当前CN每次都会序列化一次planContext ，需减少CN上planContext完整序列化次数以及减少DN上反序列化的内容从而提高planCache复用能力。

TP场景下存在大量planContext复用的情况，序列化已经成为性能瓶颈，需要进行planCache框架优化。

支持的部署形态：分布式

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

通过构造精简的DstbPlanKey来确保分布式下planCache的时空唯一性并减少CN端的序列化消耗。

增加CN与DN之间的一次交互提前感知并复用DN上的planCache。

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|dv$sqlarea 的pinned_total字段表示复用次数|是|
|配置参数|配置参数作用、生效方式|shared_pool_size / sql_pool_size 控制plancache数量|是|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|YAS-01373:ERR_DSTB_PLANKEY_MISMATCH，内部瞬时错误，系统自动恢复，用户无需处理。（用户不感知）|是|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

保留会话连接生成的计划、insert 、动态视图 不会保留plancache （即不能复用）

##   [4. 特性](#4-特性)  

1. DstbPlanKey结构体设计。


需要足够精简，并能保证planCache的时空唯一性

1.1  序列化全局结构体:

1.2  对应的序列化和反序列化函数：

```
typedef struct StPlanKeyInfo {     
    CodUint32  hashValue;     
    CodUint16  userId;
    CodUint16  loginUserId;
    CodUint32  totalTextLen;
    CodUint32  bucketId;
    ParseSessParamAttr  parseSessParam; 
} PlanKeyInfo; // CN端申请固定内存  
typedef struct StPlanKeyMsg {     
    //match anlcontext     
    CodDate      dbStartTime;     
    CodUint64    infoAddress;          // 记录info的地址     
    CodDate      firstPlanTime;      
    //match plancontext     
    CodUint32    arrayId;     
    CodUint64    planSeqNum; 
} PlanKeyMsg;  
typedef struct StAnlContextKey {     
    CodUint64    dbStartTime;     
    CodDate      firstPlanTime;     
    CodUint64    infoAddress; 
} AnlContextKey;  
typedef struct StAnlContextAttr {     
    CodUint32      initPos;     
    CodUint32      bucketId; 	
    ...     
    AnlContextKey  planKey;      
    //添加到anlcontext的attr里在dn中缓存起来 
} AnlContextAttr;        
// 序列化函数  
CodResult srlzAnlContextKey(AnlSerializer* srlzr, AnlContextKey* key)  
//完整序列化时AnlContextAttr 加入  
CodResult anlWritePlanKeyMsg(IcsMsgBuilder* builder, PlanKeyMsg* msg)             
// 反序列化函数 
CodResult dsrlzAnlContextKey(AnlSerializer* dsrlzr, AnlContextKey* key)   
CodResult anlReadPlanKeyMsg(IcsMsgReader* reader, PlanKeyMsg* msg)

```

![](https://conf.yasdb.com/download/attachments/150606128/image2024-4-24_11-29-14.png?version=1&modificationDate=1713929355000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkxNjAsImV4cCI6MTc4MjQ0OTk2MH0.OFpZmCuZUlVamu2hdd9dr64_fAJyRVM---8_uqmVtFY)

1. 整体流程概述:
1. 2.1 CN端确定当前sql是软解析会去给PlanKey:


​          2.1.1 判断当前标记stmt->attr->isReused，若为reused，在prepare阶段构建PlanKeyMsg发送给DN

​          2.1.2 DN收到后经过两层匹配，判断planKey是否命中

​          2.1.3 增加procDmlReuseAck，收到dn特殊错误码后触发reExecute

​          2.1.4 交互流程图:

1. CN发送DstbPlanKey:


​    3.1 新增 dstbConstructPlanKeyMsg函数：

```
static CodResult dstbConstructPlanKeyMsg(AnlStmt* stmt, PlanKeyMsg* msg) 

```

​       3.1.1 获取PlanKey里面字段里所需要的值

​       3.1.2 构建出PlanKeyMsg* msg

3.2 doRemoteLeaderCoordPrepare 修改:

```
​ doDstbExecPrepare //新增交互逻辑 COD_CALL(icsMsgWriteUint8(&amp;builder, checkPlanKey)); 
if(attr.isReused) 	
	dstbConstructPlanKeyMsg 
else 	
	dstbConstructPrepareMsg 

```

​          3.2.1 新增预交互逻辑，AnlStmtAttr上增加reuse标记，在之前anltryreusestmt的时候设置上

​          3.2.2 如果是reused，在dstbConstructPrepareMsg里新增 dstbConstructPlanKeyMsg并序列化

​          3.2.3 构造msg，发送给dn

1. DN收到PlanKeyMsg:


​      4.1 dstbPrepareInDataNode中新增DN处理PlanKey的逻辑

```
CodResult anlReadPlanKeyMsg(IcsMsgReader* reader, PlanKeyMsg* msg); 
static CodResult dstbCheckPlanKey(AnlStmt* stmt, IcsMsgReader* reader) dstbPrepareInDataNode { 	
  if (checkPlanKey) 		
     read; 		
     check; 
}  
anlCheckDstbPlanKey
{ 	
    anlContextMatches;
    planContextMatches;
	if (unMatched) 		
	codseterror(); 
}


```

​    4.1.1  anlReadDstbPlanKey 将收到的msg反序列化出来.

​​    4.2 先根据planKey里的sqlValue和endpoint去匹配当前anlContext:

```
    if (!checkAnlContext(stmt-&gt;context, &amp;planKeyMsg, srcEndpoint)) {
        anlSetStatAndCloseCtx(stmt);
        if (dstbTryReUseContexts(stmt, &amp;planKeyMsg, srcEndpoint) != COD_SUCCESS) {
            return COD_ERROR;
        }
    } else {
        anlContextStatReuse(stmt, stmt-&gt;context);
    }

```

​          4.2.1 若跟上一次的不匹配则去dstbTryReUseContexts，去bucket匹配之前缓存的context

```
static CodResult dstbTryReUseContexts(AnlStmt* stmt, PlanKeyMsg* planKeyMsg, CodUint16 srcEndpoint) 
{
    AnlPool*       pool = &amp;stmt-&gt;handler-&gt;inst-&gt;sqlPool[ANL_MAIN_POOL];
    CodUint32      bucketId = planKeyMsg-&gt;hashValue % pool-&gt;bucketCount;
    AnlBucket*     bucket = &amp;pool-&gt;buckets[bucketId];
    
    spinLock(&amp;bucket-&gt;lock, SPINLOCK_SQL_POOL);
    AnlContext* curr = bucket-&gt;head;
    
    while (curr != NULL) {
        if (COD_LIKELY(checkAnlContext(curr, planKeyMsg, srcEndpoint))) {
            return COD_SUCCESS;
        }
        curr = curr-&gt;hashNext;
    }
}

```

​          4.2.1 若跟上一次的不匹配则去dstbTryReUseContexts，去bucket匹配之前缓存的context

​          4.2.2 正常逻辑中anlDeserialize去掉 try reuse逻辑

​    4.3  若再根据planKey里的其他值去匹配planContext:

```
    if (stmt-&gt;context-&gt;planContext-&gt;planSeqNum != planKeyMsg.planSeqNum) {
        PlanContext* curPlan = stmt-&gt;context-&gt;planContexts[planKeyMsg.arrayId];
        while (curPlan != NULL) {
            if (curPlan-&gt;planSeqNum != planKeyMsg.planSeqNum) {
                COD_SET_ERROR(ERR_DSTB_PLANKEY_MISMATCH);
                return COD_ERROR;
            }
            curPlan = curPlan-&gt;hashNext;
        }
    }

```

4.4  若不匹配dn端返回特殊错误码 :

```
	// 新增planKey not match的错误码/cmd DPH_CMD_DML_REUSE_ACK
      通过prepare阶段的ack把错误码传回cn

static CodVoid dstbSendMismatchAck(DstbMsgVersion* ver, CodUint32 sid, IcsMsgHead* head, AnlHandler* handler)

```

1. CN收到DN的prepare消息:


```
    CodResult dphProcDmlReuseAck(AnlStmt* stmt, IcsMsg* msg)     //捕获DN传过来的DPH_CMD_DML_REUSE_ACK 	记录当前的endpoint,wait result之后进行重发 

```

​		5.1 若收到dn不匹配的cmd，cn通过conn的标记获取mismatch的节点list重新发送完整prepareMsg

```
CodResult anlGetMismatchPlanNodeList(AnlHandler* handler, List* execNodeList, List** reExecNodeList)

anlDstbSendMessageListAsync

anlWaitExecuteResult

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

|场景|预期|结果|
|---|---|---|
|cn1执行Q1后, cn2再执行Q1|成功返回结果(并不复用dnplancache)||
|cn1执行Q1后,重启cn1,再执行Q1|成功返回结果(cn上缓存清空)||
|cn跟dn之间的sql_pool_size不一样,重复执行Q1|成功返回结果(观测缓存是否淘汰)||
|元数据变更(alter table or create index) 重复执行Q1|成功返回结果(cache失效，不复用)||
|dn主备切换或重启，重复执行Q1|成功返回结果(重启的dn cache失效，不复用，其他dn可复用)||
|绑定参数|PINNED_TOTAL次数跟复用次数相同||
|匿名块|整个匿名块执行次数跟匿名块里面语句执行次数等于PINNED_TOTAL次数||
|ddl跟dql并发|成功返回结果，不卡死，不core||
||||


自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。