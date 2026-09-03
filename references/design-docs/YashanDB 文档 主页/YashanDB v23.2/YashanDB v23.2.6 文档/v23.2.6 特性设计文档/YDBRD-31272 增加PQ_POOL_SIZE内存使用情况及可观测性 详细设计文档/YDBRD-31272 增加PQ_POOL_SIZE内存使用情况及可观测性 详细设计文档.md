Created by 林俊喆, last modified on 九月 19, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/66618a6e5d57e18ea9d2021f](https://pingcode.yasdb.com/ship/ideas/66618a6e5d57e18ea9d2021f)    ?    
  #YASHAN-2912 PQ_POOL_SIZE内存使用情况可观测性

SR链接：    [https://pingcode.yasdb.com/pjm/items/66b32a0c8f5ee191734b1d1d](https://pingcode.yasdb.com/pjm/items/66b32a0c8f5ee191734b1d1d)    ?    
  #YDBRD-31272 增加PQ_POOL_SIZE内存使用情况及可观测性

##   [1. 总述](#1-总述)  

成熟模块的特性，概要设计和详细设计合一，必须说明本设计方案的需求来源，需求分析，功能概要描述。  **此类型设计文档要给出IR到SR拆分的依据。**

关键特性的SR设计，总述可以链接IR的概要设计文档，此处开始主要讲对应SR特性的需求范围。

yashanDB当前PQ_POOL内存主要用于：

1. 并行执行时，stage间通过table queue进行数据传输，收发缓冲区从PQ_POOL中分配。当前包括分布式下跨节点的行列执行、集群下global view查询。
1. 分布式下，统计信息收集，从DN发送给CN，从CN同步到其他CN，收发缓冲区从PQ_POOL中分配。
1. 分布式下，接收控制消息使用的内存从PQ_POOL中分配。


当前yashanDB中且PQ_POOL的上限配置参数PQ_POOL_SIZE为隐藏参数，PQ_POOL相关信息展示仅为V/GV$SGA中的parallel execute buffer项展示当前PQ_POOL的大小。

需求主要影响范围：

1. PQ_POOL_SIZE从隐藏参数修改为正式参数，补充文档描述。
1. 增加PQ_POOL节点级使用情况展示。
1. 增加PQ_POOL会话级使用情况展示。


###   [1.1 需求来源](#11-需求来源)  

原始的客户需求描述。关注需求的来源、规格、合理性，要用明确的语言描述，不能模棱两可。要把客户的业务场景描述清楚，知道客户希望怎么用，而且除了功能特性要求，也要尽可能了解非功能特性要求，例如性能、安全等。

**需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分行存和列存。**

- 支持形态：单机、集群、分布式


###   [1.2 调研文档](#12-调研文档)  

**概述**   友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  [PQ_POOL内存可观测性调研](https://conf.yasdb.com/pages/viewpage.action?pageId=167159796)  

###   [1.3 需求分析](#13-需求分析)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|PQ_POOL内存使用情况展示||是|是|
|性能|性能场景|每个线程单独统计，避免线程间同步|否|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|仅通过查询动态视图展示，同动态视图|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|不修改系统表字段，不涉及|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|PQ_POOL|PARALLEL QUERY POOL <br>1. 用于并行计算时跨线程数据传输的收发缓冲区内存<br>2. 用于分布式下统计信息收集收发缓存<br>3. 用于分布式下接收控制消息使用内存|否||


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

###   [动态视图](#动态视图)  

  `GV/V$SGASTAT`    视图增加记录：

|POOL|NAME|意义|
|---|---|---|
|PARALLEL EXECUTE BUFFER|used memory|当前PQ_POOL内存使用量|
|PARALLEL EXECUTE BUFFER|free memory|当前PQ_POOL内存剩余量|
|PARALLEL EXECUTE BUFFER|max memory used|节点历史(从节点启动到当前)PQ_POOL内存使用峰值|


  `GV/V$STATNAME`    增加记录：

|STATISTIC#|NAME|CLASS|意义|
|---|---|---|---|
||parallel execute buffer used memory||当前PQ_POOL内存使用量|
||parallel execute buffer max memory used||系统或会话历史PQ_POOL内存使用峰值|


  `GV/V$SESSTAT`    及    `GV/V$SYSSTAT`    分别增加会话级和节点级上述两个统计项

##   [3. 规格与约束](#3-规格与约束)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

无

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

####   [4.1.1 节点级统计项](#411-节点级统计项)  

当前PQ_POOL内存池使用    `ani_mem_manager.c`    中定义的内存分配器进行管理，该内存分配器当前记录了内存分配的高水位线HWM（历史最大分配量），当前已使用的内存量，剩余内存量，可以支持PQ_POOL节点级的信息展示。

增加以下函数用于获取相关信息：

```
CodUint64 mmGetFreeBytes(MemManager* manager);
CodUint64 mmGetAllocBytes(MemManager* manager);
CodUint64 mmGetHwmBytes(MemManager* manager);
void      mmLock(MemManager* manager);
void      mmUnlock(MemManager* manager);

```

修改    `sgaStatFetch`    函数以及    `SgaPoolType`    枚举，增加三条记录。

```
typedef enum EnSgaPoolType {
    ...
    PQ_POOL_USED,
    PQ_POOL_FREE,
    PQ_POOL_HWM,
    SGA_POOL_TYPE_COUNT
} SgaPoolType;

static CodResult sgaStatFetch(AnkCursor* cursor, RowManager* rm, CodBool fixedTable)
{
    ...
    switch (attr-&gt;rowId.value) {
        ...
        case PQ_POOL_USED:
            ...
        case PQ_POOL_FREE:
            ...
        case PQ_POOL_HWM:
            ...
    }
}

```

修改    `dvStatSet`    函数以及    `StatType`    枚举，增加两条记录。

```
typedef enum EnStatType {
    ...
    PQ_POOL_ALLOC,
    PQ_POOL_HWM,
}

CodVoid dvStatSet(CodUint64* values, AnlHandler* anlHandler);

```

4.1.2 会话级统计项

当前没有统计每个会话当前使用的PQ_POOL内存大小以及历史峰值，需要补充该部分统计。并行执行时一个会话在一个节点上通常有多个线程，每个线程有自己的执行句柄，每个线程统计自己的使用情况，可以通过    `GV/V$PX_SESSION`    找到一个会话下的所有并行线程，再通过    `GV/V$SESSTAT`    查询所有相关的统计项。

在以下结构上增加字段用于统计：

```
typedef struct StPqStat {
    CodUint64 hwmBytes;    // 记录该会话本次执行时使用的PQ_POOL内存峰值
    CodUint64 allocBytes;  // 记录该会话当前使用的PQ_POOL内存
} PqStat;

typedef struct StAnlStat {
    ...
    PqStat pqStat;
} AnlStat;

```

当前统计申请PQ_POOL内存可参考申请    `MEM_RSRC_PQ_POOL`    类型的内存配额调用    `aniMemRsrcAllocSpaQuota`    ，统计释放PQ_POOL内存可参考释放    `MEM_RSRC_PQ_POOL`    类型的内存配额调用    `aniMemRsrcFreeSpaQuota`    。

增加函数更新统计值，由于每个线程更新自己的统计值，动态视图查询对该数值只读，因此不考虑并发：

```
CodVoid anlUpdatePqStat(AnlStmt* stmt, CodInt64 bytes);

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


|部署模式|测试场景|预期||
|---|---|---|---|
|单元测试|接口测试，测试更新值的函数逻辑，主要测试历史峰值是否更新正确<br>反复申请释放，校验更新后统计值是否符合预期|||
|分布式|执行dml同时启动并行会话查询    `V$SGASTAT`    以及    `V$SYSSTAT`    以及    `V$SESSTAT`  |||
|分布式|执行收集统计信息同时启动并行会话查询    `V$SGASTAT`    以及    `V$SYSSTAT`    以及    `V$SESSTAT`  |||
|分布式|执行ddl同时启动并行会话查询    `V$SGASTAT`    以及    `V$SYSSTAT`    以及    `V$SESSTAT`  |||
|分布式|无并行会话时查询    `V$SGASTAT`    以及    `V$SYSSTAT`    以及    `V$SESSTAT`  |||
|分布式|测试增加统计值对分布式TPCH及TPCDS性能是否有影响|无明显影响||


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

|文档|修改|备注|
|---|---|---|
|anchorbase/doc/产品文档/参考手册/配置参数.md|增加PQ_POOL_SIZE描述||
||||
||||


##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。