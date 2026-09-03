Created by 张璐恒, last modified by  周湘淞 on 十月 19, 2024

JIRA：    [[YDBRD-21110] 分布式支持schema和全库维度收集统计信息 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21110)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#1-overview%E6%A6%82%E8%BF%B0)  

*说明本设计方案的背景、需求。*

分布式支持全库搜集，以及按schema隔离统计信息收集范围。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

*说明本方案的功能特性。*

支持通过高级包和analyze语法收集全库、schema和表的统计信息。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

支持的高级包    `GATHER_TABLE_STATS、GATHER_SCHEMA_STATS、GATHER_DATABASE_STATS `  

参数说明参考    [YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_STATS.html#statoption)  

|特性|规格或约束|说明|备注|
|:---|:---|:---|:---|
|高级包|```
DBMS_STATS<span class="token punctuation">.</span>GATHER_TABLE_STATS <span class="token punctuation">(</span>
    ownname             VARCHAR<span class="token punctuation">,</span>
    tabname             VARCHAR<span class="token punctuation">,</span>
    partname            VARCHAR<span class="token punctuation">,</span>
    estimate_percent    NUMBER<span class="token punctuation">,</span>
    block_sample        BOOLEAN<span class="token punctuation">,</span>
    method_opt          VARCHAR<span class="token punctuation">,</span>
    degree              NUMBER<span class="token punctuation">,</span>
    granularity         VARCHAR<span class="token punctuation">,</span>
    <span class="token keyword">cascade</span>             BOOLEAN
<span class="token punctuation">)</span><span class="token punctuation">;</span>
```|对分布式形态特殊处理|继承单机能力|
|  
|```
DBMS_STATS<span class="token punctuation">.</span>GATHER_SCHEMA_STATS <span class="token punctuation">(</span>
    ownname           VARCHAR<span class="token punctuation">,</span>
    estimate_percent  NUMBER<span class="token punctuation">,</span>
    block_sample      BOOLEAN<span class="token punctuation">,</span>
    method_opt        VARCHAR<span class="token punctuation">,</span>
    degree            NUMBER<span class="token punctuation">,</span>
    granularity       VARCHAR<span class="token punctuation">,</span>
    <span class="token keyword">cascade</span>           BOOLEAN
<span class="token punctuation">)</span><span class="token punctuation">;</span>
```|同上|继承单机能力|
|  
|```
DBMS_STATS<span class="token punctuation">.</span>GATHER_DATABASE_STATS <span class="token punctuation">(</span>
    options             VARCHAR<span class="token punctuation">,</span>
    estimate_percent    NUMBER<span class="token punctuation">,</span>
    degree              NUMBER<span class="token punctuation">,</span>
    method_opt          VARCHAR<span class="token punctuation">,</span>
    granularity         VARCHAR<span class="token punctuation">,</span>
    <span class="token keyword">cascade</span>             BOOLEAN<span class="token punctuation">,</span>
    gather_sys          BOOLEAN
<span class="token punctuation">)</span><span class="token punctuation">;</span>
```|同上|继承单机能力|


支持的语法

ANALYZE TABLE [SCHEMA] TABLE_NAME( [PARTITION] | [ESTIMATE_PERCENT] | [BLOCK_SAMPLE] | [METHOD_OPTION] | [PARALLEL_DEGREE] | [GRANULARITY] | [INDEX_CASCADE])

![](https://pingcode.yasdb.com/atlas/files/public/67396c39a1ad9a3311dc88af/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFSQUNBSUFFQUFBQUFnQ0FBQXdBQUFCQUFBQUFnQUVBQUFBQUFBQUFBQUFEQUFBQUJBQUFBRUFBQUFBQUFBQUFBQUFJQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBQUFCQUFBQUFRQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk4NTMsImV4cCI6MTc4MjMxMDY1M30.tpdCxHXJzjxIwKeGh5RP658BKu4EbkjyyoGTV1tvNAg)

ANALYZE SCHEMA 

ANALYZE SCHEMA OWNER ([ESTIMATE_PERCENT] | [BLOCK_SAMPLE] | [METHOD_OPTION] | [PARALLEL_DEGREE] | [GRANULARITY] | [INDEX_CASCADE])

![](https://pingcode.yasdb.com/atlas/files/public/67396c398970c2af4f520a3f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFSQUNBSUFFQUFBQUFnQ0FBQXdBQUFCQUFBQUFnQUVBQUFBQUFBQUFBQUFEQUFBQUJBQUFBRUFBQUFBQUFBQUFBQUFJQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBQUFCQUFBQUFRQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk4NTMsImV4cCI6MTc4MjMxMDY1M30.tpdCxHXJzjxIwKeGh5RP658BKu4EbkjyyoGTV1tvNAg)

ANALYZE DATABASE 

ANALYZE DATABASE ([OPTIONS] | [ESTIMATE_PERCENT]   | [PARALLEL_DEGREE]    | [METHOD_OPTION] | [GRANULARITY]   |   [INDEX_CASCADE] | [GATHER_SYS])

![](https://pingcode.yasdb.com/atlas/files/public/67396c39a1ad9a3311dc88b0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFSQUNBSUFFQUFBQUFnQ0FBQXdBQUFCQUFBQUFnQUVBQUFBQUFBQUFBQUFEQUFBQUJBQUFBRUFBQUFBQUFBQUFBQUFJQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBQUFCQUFBQUFRQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk4NTMsImV4cCI6MTc4MjMxMDY1M30.tpdCxHXJzjxIwKeGh5RP658BKu4EbkjyyoGTV1tvNAg)

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

*说明本方案对外的功能限制或约束。*

- DBMS_STATS其他函数暂不支持。
- 用户权限，只能操作自己有权限的表、schema和数据库（DBA权限），和单机保持一致。
- mn、dn上支持执行高级包，走本地收集流程。
-     1. 其中，mn本地搜集不到数据，收集结果不具有参考价值。
    1. dn本地搜集之后进行数据还原时，完全和单机保持一致（通过cn收集dn持久化的数据和dn直连持久化下来的数据不一致）。

- 支持在dn、mn上执行analyze sql ，其表现和高级包一致。
- cn扩容时新扩出的cn，或者其它cn异常重启时不会自动同步统计信息，建议扩容完（异常恢复后）后手动收集。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

cn下发命令，dn基本上复用单机流程，搜集完一个表之后把结果发回给cn（并发），cn拿到表后转发给其它cn。

![](https://pingcode.yasdb.com/atlas/files/public/67396c39a1ad9a3311dc88b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFSQUNBSUFFQUFBQUFnQ0FBQXdBQUFCQUFBQUFnQUVBQUFBQUFBQUFBQUFEQUFBQUJBQUFBRUFBQUFBQUFBQUFBQUFJQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBQUFCQUFBQUFRQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk4NTMsImV4cCI6MTc4MjMxMDY1M30.tpdCxHXJzjxIwKeGh5RP658BKu4EbkjyyoGTV1tvNAg)

cn通过高级包、sql得到收集全库、schema或者表的统计信息的命令，跟dn之间通过channel数据交互收集，dn收到后调用单机的能力收集统计信息（可以并行收集），收集完一个表之后拆分成小包进行发送。cn收到一个包后开始持久化统计信息，并且刷新dc；然后将包发给其它cn。所有数据收集并同步完成后，关闭数据通道，cn返回成功。

![](https://pingcode.yasdb.com/atlas/files/public/67396c398970c2af4f520a41/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFSQUNBSUFFQUFBQUFnQ0FBQXdBQUFCQUFBQUFnQUVBQUFBQUFBQUFBQUFEQUFBQUJBQUFBRUFBQUFBQUFBQUFBQUFJQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBQUFCQUFBQUFRQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk4NTMsImV4cCI6MTc4MjMxMDY1M30.tpdCxHXJzjxIwKeGh5RP658BKu4EbkjyyoGTV1tvNAg)

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

#### 流程

通过高级包或者sql进入，

高级包解析复用单机，sql语法新增SQL_ANAYLZE_DATABASE和SQL_ANAYLZE_SCHEMA。

```
SQL_ANAYLZE_TABLE
SQL_ANAYLZE_DATABASE
SQL_ANAYLZE_SCHEMA
```

  


除了解析之外，校验、执行analyze和高级包合并，使用一套流程

校验复用单机流程。

执行阶段分本地执行和cn执行，三种统计范围（表、schema、database）走一个函数。

cn执行的主要函数anlDstbAnalyze，主要流程为：1.构造命令消息；2.发送给dn；3.处理dn的回应；4.转发

```
CodResult anlDstbAnalyze(AnlStmt* stmt, CodPointer def, StatsType StatsType)
{
    DstbStaticPacket dstbStaticPacket = {0};
    if (buildStatsMsg(stmt, &def, &dstbStaticPacket, StatsType) != COD_SUCCESS) {
        return COD_ERROR;
    } //构造统计信息命令msg
    
    if (packTableStaticsMsgIcsMsg()!= COD_SUCCESS) {
        return COD_ERROR;
    } //构造统计信息命令消息

    List* endpointList = NULL;
    if (COD_UNLIKELY(listCreate((AllocMem)anlAllocAppMem, stmt, sizeof(CodUint16), &endpointList) != COD_SUCCESS)) {
        return COD_ERROR;
    }
    if (getAnalyzeEndpoint(stmt,endpointList) != COD_SUCCESS) {
        return COD_ERROR;
    }  //拿dn将要执行统计信息的节点
    
    if(sendStatsMessageToDn() != COD_SUCCESS) {
        return COD_ERROR;
    }  //发送消息
    
    if (waitForAllStatsBack() != COD_SUCCESS) {
        return COD_ERROR;
    }  //处理dn的回应

	if (sendStatsToOtherCn() != COD_SUCCESS) {
        return COD_ERROR;
    }  //发给别的cn
    
    return COD_SUCCESS;
}
```

  


构造消息阶段，新增结构StatsContext，详细结构为

```
typedef struct StStatsContext {
    CodUint64 estimatePercent;
    CodBool   cascade;
    CodChar   methodOpt;
    CodChar   granularity[COD_MAX_NAME_LEN16];
    StatsType statsType;
    union {
        DstbTableStatsInfo    tableStatsInfo;
        DstbSchemaStatsInfo   schemaStatsInfo;
        DstbDatabaseStatsInfo databaseStatsInfo;
    };
} StatsContext;

typedef struct StDstbTableStatsInfo {
    CodChar   ownName[COD_NAME_BUFFER_SIZE];
    CodChar   tableName[COD_NAME_BUFFER_SIZE];  
    CodChar   partName[COD_NAME_BUFFER_SIZE];
    CodBool   blockSample;
    CodUint64 degree;
} DstbTableStatsInfo;

typedef struct StDstbSchemaStatsInfo {
    CodChar   ownName[COD_NAME_BUFFER_SIZE];
    CodBool   blockSample;
    CodUint64 degree;
} DstbSchemaStatsInfo;

typedef struct StDstbDatabaseStatsInfo {
    CodChar   options;
    CodUint64 degree;
    CodBool   gatherSys;
} DstbDatabaseStatsInfo;
```

  


此外新增发送消息命令ICS_CMD_GATHER_STATS，废弃原有ICS_CMD_FETCH_BYTES。

  


cn构造好消息后找到需要执行的dn，这个dn需要从route中取得，并且在拿到节点时是“活着”的。

收集统计信息的dn需要具备的条件：

- 从路由中取到
- 该节点组不为空
- 主节点
- 节点状态正常
- 符合以上条件的第一个节点


cn发送控制消息，将统计信息的需求发送给dn，并且带有channelid，dn本地分配后建立channel，dn回复消息表示channel建立成功后开始执行。

如果在发送成功之后，dn挂了、降备了，由网络异常事件来报错。 

cn跟dn一旦建channel成功，就代表本次统计信息会开始执行，cn会跟其它cn尝试建立channel，如果建立失败则打日志，不报错，不影响后续收集。

dn收到消息后构造GatherTableDef、GatherDatabaseDef或GatherSchemaDef，要增加字段isDstb来区分dn本地执行和cn下发命令之间的区别。

dn在收集schema和database的时候支持表间并行，由每个worker收集完每个表后执行统计信息数据发回。 //todo 单表收集不能加这里，ankgather。。。里

```
void statsWorkerProc(CodThread* thread)
{
    while (!thread->closed) {
        if (worker->status != STATS_WORKING) {
            continue;
        }

        statsWorkerGather(worker);
         
		//新增分布式表间回发数据流程
		if (worker->tastType == STATS_TASK_GATHER_TABLE && worker.stm.isDstb) {
            sendStatisticToCn();
        }
        
    }
```

dn序列化时避免过大需要分包。

cn收齐一个包之后转发给别的cn。如果其它cn发生异常，则关闭相应的channel，打一条日志提示某个cn上的统计信息更新未完成，但不影响后续继续发送。

如果dn发生异常，由网络异常事件来提示本地cn和其它cn断开连接，close channel，结束流程，返回报错。

完成发送后dn close channel。cn关闭与其它cn之间的channel。

#### 序列化分包

这里dn上将统计信息按照列为最小单位序列化，序列化到32M剩下的空间不够装下一个列的上限大小为止。

序列化拆包方式，已知表统计信息有计算公式：

```
global级基础统计信息 = 整表的基础统计信息 + 列数 * (列基础统计信息 + bucket数 * bucket大小) + 索引数 * 索引统计信息
整个statsSet大小 = 基础统计信息 + 分区数 * 基础统计信息
```

带入：    
  表统计信息 = 92bytes    
  列基础统计信息 = 77 bytes    
  bucket最大 = 1000bytes

索引统计信息的结构体IndexStats= 84bytes

得到统计信息分包单位分三种类型

|统计信息分包的最小单位|估值或范围|个数|
|---|---|---|
|整表的基础统计信息|92bytes|1|
|单列统计信息|77bytes + bucket数 * 1000bytes|列数 + 分区数*列数 +（二级分区的）|
|单个索引统计信息|84bytes + 84bytes * 分区数 +（84bytes * 二级分区数）|索引数 |


上述为dn回发给cn统计信息时组包的最小单位，一个包可以包含多个最小单位，一次实际能发几个由具体计算时决定

发送列统计信息时需要带有表信息和分区信息。

#### 全程需要使用的内存

|序号|内存作用|内存来源|内存大小|何时可以释放|备注|
|---|---|---|---|---|---|
|1|cn发消息|codSysAlloc|1MB|发送消息后|待确认是否需要那么大|
|2|dn收到控制消息后反序列化|stmt->handler->inst->appPool|  
|做完本次统计信息之后|  
|
|3|dn收集完统计信息后将单次要发送的统计信息序列化|stmt->handler->inst->appPool|最大32M|消息发送完后|  
|
|4|cn收到消息后将消息还原回结构体|stmt->handler->inst->appPool|最大32M|cn做完持久化、刷dc后|  
|
|5|cn转发给其它cn的消息内存|stmt->handler->inst->appPool|同3|  
|其它cn收消息同本地cn|


#### 节点异常处理

|异常节点|异常场景|预期|
|---|---|---|
|dn|统计信息开始之前第一个dn组挂了|不影响后续执行|
|dn|统计信息开始之前所有dn挂了|正常报错|
|dn|cn拿到dn的endpoint之后发消息之前dn挂了、降备|正常返回报错|
|dn|cn发送统计信息消息之后目标dn挂了、降备|网络异常时间触发断连，正常返回报错|
|其它cn|cn跟其它cn建立channel之前其它cn挂了|不影响收集，挂掉的cn上统计信息版本滞后，尝试有日志|
|其它cn|cn跟其它cn建立channel之后其它cn挂了|不影响收集，挂掉的cn上最新统计信息不全，有日志warning|
|cn|全程cn自己挂了|报错，已建立的连接能断开|
|mn|全程|不影响|


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

全库搜集验证。

schem搜集验证，跨schema搜集验证。

节点异常验证，表格见5中节点异常处理。

数据量过大验证，用现有必现报错overflow的用例执行不报错 。    2023-11-23   必现用例待补充

|测试功能|测试点|测试方法|预期|状态|是否持久化|
|---|---|---|---|---|---|
|高级包->表|命令下发结构体的正确性|1. 白盒测试看结果对不对，+ut，确保后续新加字段能识别出
|序列化前反序列化后结构体长一样|done|  
|
|  
|  
|2.pytest把所有的字段的所有选项试一遍|  
|  
|  
|
|  
|收集到的统计信息回发|1.白盒测试，+ut确定传的都对|  
|  
|  
|
|  
|  
|2.pytest在cn和dn查结果进行对比|  
|done|  
|
|高级包->schema|命令下发结构体的正确性|1. 白盒测试看结果对不对，+ut，确保后续新加字段能识别出
|序列化前反序列化后结构体长一样|done|  
|
|  
|  
|2.pytest把所有的字段的所有选项试一遍|  
|  
|  
|
|高级包->database|命令下发结构体的正确性|1. 白盒测试看结果对不对，+ut，确保后续新加字段能识别出
|序列化前反序列化后结构体长一样|done|  
|
|  
|  
|2.pytest把所有的字段的所有选项试一遍|  
|  
|  
|
|并发|不同session同时收集统计信息|看各个节点状态是否正常，结果是否正确。|  
|  
|  
|
|  
|ddl、统计信息并发|1.收集全库的时候新建表|  
|  
|  
|
|  
|  
|2.收集表的时候删表|  
|  
|  
|
|节点异常|dn异常|统计信息开始之前第一个dn组挂了|不影响后续执行|  
|  
|
|参考5中的异常处理|  
|统计信息开始之前所有dn挂了|正常报错|done|  
|
|  
|  
|cn拿到dn的endpoint之后发消息之前dn挂了、降备|正常返回报错|  
|  
|
|  
|  
|cn发送统计信息消息之后目标dn挂了、降备、缩容|网络异常时间触发断连，正常返回报错|  
|  
|
|  
|cn异常|cn跟其它cn建立channel之前其它cn挂了|不影响收集，挂掉的cn上统计信息版本滞后，尝试有日志|  
|  
|
|  
|  
|cn跟其它cn建立channel之后其它cn挂了|不影响收集，挂掉的cn上最新统计信息不全，有日志warning|  
|  
|
|  
|  
|全程cn自己挂了|报错，已建立的连接能断开|  
|  
|
|  
|mn异常|全程|不影响|  
|  
|
|数据变化|统计信息过程中数据变了|dml并发|  
|  
|  
|
|  
|  
|movechunk|  
|  
|  
|
|统计信息使用|大数据量|找到数据量大，之前会报错的表|不报错|  
|  
|
|  
|用户权限|当前用户当前表|  
|  
|  
|
|  
|  
|当前用户当前schema|  
|  
|  
|
|  
|  
|当前用户无dba，无analyze any权限，别的schema、表、库|  
|  
|  
|
|  
|  
|当前用户无dba，有analyze any权限，别的schema、表、库|  
|  
|  
|
|  
|  
|当前用户有dba，无analyze any权限，别的schema、表、库|  
|  
|  
|
|  
|  
|当前用户无dba，有analyze any权限，别的schema、表、库|  
|  
|  
|
|其它|直连mn执行|  
|  
|  
|  
|
|  
|直连dn执行|  
|  
|  
|  
|
|  
|拦截|其它高级包|拦截|done|  
|
|单机用例覆盖|二级分区|  [standalone/testcase/function2/dbms_stats/subpartition_stats/heap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function2/dbms_stats/subpartition_stats/heap)  |  
|  
|  
|
|  
|schema|  [standalone/testcase/function2/dbms_stats/schema_stats · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function2/dbms_stats/schema_stats)  |  
|  
|  
|
|  
|索引、表|  [standalone/testcase/function2/dbms_stats/tac_stats · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function2/dbms_stats/tac_stats)  |  
|  
|  
|


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#7-document%E8%B5%84%E6%96%99)  

  [YDBRD-17468 & YDBRD-9890 统计信息收集规格对齐 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135594923)  

  [YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_STATS.html#gather-table-stats)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

设计用时：5人天   实际过程因穿插解决别的问题单，共用了10天左右

开发7人天   实际用时14天

- 支持analyze语法：1人天 目标：  analyze按库搜集、按schema搜集的语法打通 实际用时1天
- 框架调整：3人天   实际用时3天
- 收发消息：2人天（没有现有接口）   实际用时8天：原始编码调通4天，但自测中发现了较大的问题做出较大代码调整4天（效果等同于没有开发完）
- 拆包发送：1人天   实际用时2天


自测6人天   实际用时6天

总计18人天   实际用时25天

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=89083717#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

支持二级分区统计信息后，需要增加分布式传输二级分区的流程（或可复用一级分区的拆包、序列化方式）。

由于加了统计信息消息命令的结构体，所以此后统计信息有新加字段需要同步在exec_dstb_stats.h添加。

## Attachments:

[image2023-11-20_16-9-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzk4OTcwYzJhZjRmNTIwYTM5IiwicmVmX2lkIjoiNjczOTZjMzg3MjgyMDZlZmI5MmYwZjI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5ODUzLCJleHAiOjE3ODIzODYyNTN9.Ig0o9pDn_6x9MCD5NfcaAoB2r4SkCBiO6UvUyyhNnsw)

 (image/png)    


[image2023-11-23_11-11-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzlhMWFkOWEzMzExZGM4OGE5IiwicmVmX2lkIjoiNjczOTZjMzg3MjgyMDZlZmI5MmYwZjI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5ODUzLCJleHAiOjE3ODIzODYyNTN9.UtmzMiWtk_Cfc52d55GrcQthxOwSRFd1FbssT11gO0Q)

 (image/png)    


[image2023-11-23_19-47-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzk4OTcwYzJhZjRmNTIwYTNkIiwicmVmX2lkIjoiNjczOTZjMzg3MjgyMDZlZmI5MmYwZjI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5ODUzLCJleHAiOjE3ODIzODYyNTN9.tkfv8Bp68YWQLYyZfhmfOo3R-jpiZujrl24_eq_qc5s)

 (image/png)    


[image2023-11-23_19-51-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzlhMWFkOWEzMzExZGM4OGFkIiwicmVmX2lkIjoiNjczOTZjMzg3MjgyMDZlZmI5MmYwZjI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5ODUzLCJleHAiOjE3ODIzODYyNTN9.qxYje7hZ0VKYlTQRekcsm7ceq-2kk3DJE33QQuAsSmE)

 (image/png)    


## Comments:

|  [](null)  ,原有消息的命令只是在本sr涉及的范围不用了,Posted by zhangluheng at 十一月 24, 2023 11:25|
|---|
|  [](null)  ,分布式暂不支持动态采样，对外不感知,Posted by zhangluheng at 十一月 24, 2023 12:02|
|  [](null)  ,分布式不支持的高级包要拦截、文档确定下是否已经有了说明。,analyze的文档要补齐。,Posted by zhangluheng at 十一月 24, 2023 12:05|
|  [](null)  ,与会人：陈步隆、郭藏龙、刘美秀、曾昭瀚、赵育、张璐恒    
  评审时间： 2023-11-24 17:00 ~ 18:00    
  评审地点：1012,会议主题：分布式支持schema和全库维度收集统计信息设计文档    
  评审纪要信息：,1.分布式暂不支持动态采样，对外不感知    
  2.原有消息的命令只是在本sr涉及的范围不用了    
  3.分布式不支持的高级包要拦截、文档确定下是否已经有了说明。    
  4.analyze的文档要补齐。    
  5.发送统计信息的函数不能放在statsWorkerProc里，要放到ankGatherTableStats中。,评审通过与否：通过,Posted by zhangluheng at 一月 04, 2024 15:04|
