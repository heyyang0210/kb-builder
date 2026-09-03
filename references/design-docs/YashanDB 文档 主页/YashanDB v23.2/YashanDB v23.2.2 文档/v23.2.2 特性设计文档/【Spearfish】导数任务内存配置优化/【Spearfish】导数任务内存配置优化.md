Created by 雷雨璐, last modified on 十月 16, 2024

IR链接：    [[YDBRD-29806] 导数任务内存配置优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-29806)  

  [YDBRD-26048 LSC bulkload导入配置以及视图优化 - PingCode (yasdb.com)](https://pingcode.yasdb.com/pjm/items/661661d1fd997db58ad6f390)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

lsc 稳态数据导入时，  在多列场景，或者  多分区、多并发时，需要分配较多的内存，  导致出现大量换入换出或者内存不足的情况。尤其双rgd导致内存使用成倍提升，多rgd buffer也对内存使用有影响。

因此对导数内存配置进行优化，便于处理导入内存问题。

1、  **rgd导入内存优化**

单分区内rgd数量以及rgd内的buffer数量可配置。

2、  **增加视图查看导入任务**

针对单机与分布式场景，新增v$bulkloadStat和dv$bulkloadStat视图。

  [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1、增加更改正在进行的导入rgd和rgd buffer数量的隐藏参数；

```
alter system set _SCOL_RGD_COUNT = 2, scope = spfile/both;
alter system set _SCOL_RGD_BUFFER_COUNT = 2, scope = spfile/both;
```

2、增加视图查看任务起止时间、导入记录数、内存消耗、换入换出情况等。

单机提供V$bulkloadStat视图（open状态可用），分布式下提供DV$bulkloadStat视图。

```
select * from V$bulkloadStat;
select * from dV$bulkloadStat;
```

每一行表示连接到数据库实例的会话  ，显示会话任务级的内存占用分析。按存在导入任务的handler来展示。

|视图|描述|备注|
|:---|:---|:---|
|DV$BULKLOADSTAT|包含分布式各个节点上会话的相关信息|可通过GLOBAL_SESSION_ID字段建立各个节点间会话之间的联系。|
|V$BULKLOADSTAT|查询  导入任务的相关信息|一个  handler  一行记录|


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

###   [3.1 对外显示](https://conf.yasdb.com/pages/viewpage.action?pageId=138548361#32-%E5%AF%B9%E5%A4%96%E6%98%BE%E7%A4%BA)  

1、增加隐藏参数

|参数名称|描述|配置范围|默认|生效级别|
|---|---|---|---|---|
|_SCOL_RGD_COUNT|更改正在进行的导入rgd数量|1-32|2|spfile/both|
|_SCOL_RGD_BUFFER_COUNT|更改正在进行的  rgd内的buffer数量|1-32|4|spfile/both|


2、视图显示系统的导入任务。

**v$bulkloadStat**

|字段|字段类型|描述|备注|
|---|---|---|---|
|handler_id|SMALLINT|handler id|自身handler ID|
|table_name|VARCHAR(64)|表名称|  
|
|load_start|TIMESTAMP|导入开始时间|  
|
|load_time|BIGINT|当前导入已执行时间|存储内部导入执行时间|
|row_num|BIGINT|导入记录数|  
|
|row_bytes|BIGINT|导入字节数|  
|
|mem_use|BIGINT|导入总内存使用量|单个session的导入总内存|
|mem_quota|BIGINT|导入内存配额|  
|
|swap_bytes|BIGINT|内存换入换出量|  
|
|swap_time|BIGINT|内存换入换出时间|  
|


**dv$bulkloadStat**

|字段|字段类型|描述|备注|
|---|---|---|---|
| GROUP_ID|INTEGER |组ID|  
|
|GROUP_NODE_ID|INTEGER |组内节点ID|  
|
|handler_id|SMALLINT|handler id|自身handler ID|
|GLOBAL_SESSION_ID|INTEGER|分布式全局会话ID|支持在单机进行隐藏，分布式下进行展示|
|table_name|VARCHAR(64)|表名称|  
|
|load_start|TIMESTAMP|导入开始时间|  
|
|load_time|BIGINT|当前导入已执行时间|存储内部导入执行时间|
|row_num|BIGINT|导入记录数|  
|
|row_bytes|BIGINT|导入字节数|  
|
|mem_use|BIGINT|导入总内存使用量|单个session的导入内存|
|mem_quota|BIGINT|导入内存配额|  
|
|swap_bytes|BIGINT|内存换入换出量|  
|
|swap_time|BIGINT|内存换入换出时间|  
|


###   [3.2 函数接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138548361#33-%E5%87%BD%E6%95%B0%E6%8E%A5%E5%8F%A3)  

```
CodResult ftBulkloadStatFetch(AnkCursor* cursor, RowManager* rm);
CodResult ftBulkloadStatFetchEx(AnkCursor* cursor, RowManager* rm);

CodResult dvBulkloadStatFetch(AnkCursor* cursor, RowManager* rm);
CodResult dvBulkloadStatFetchEx(AnkCursor* cursor, RowManager* rm, CodBool isDistribute);
```

```
typedef struct StAnkStat {
    RgdStat      rgdStat;
} AnkStat; 

typedef struct StRgdStat {
    SpinLock        lock;
	CodChar         tableName[COD_NAME_BUFFER_SIZE];
    CodUint64       loadStartTime;
    CodUint64       partNum;
    CodUint64       memUse;
    CodUint64       memQuota;
    CodAtomicUint64 swapInBytes;
    CodAtomicUint64 rowNum;
    CodBool         useable;
} RgdStat;
```

spf_rgd.c：

```
CodResult ankSpfGetStats(AnkHandler* handler, TableDict* dc, RgdStats* rgdStats);
```

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1. 分区内rgd数量减小，可能导致yasldr导入性能下降。
1. 正在进行的导入rgd和rgd buffer数量继续保持，后续启动的使用新参数。
1. 多表导入场景会生成多个rgdInsertCtx，同时产生多个表名称。因此不支持统计。
1. asan版本，由于内存分配器不一样，mem_quota和mem_used无法统计，需要在视图中显示为NULL。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)      [Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=138548361#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

1、隐藏参数实现

将rgdGroup中的rgd生成，由之前的  SPF_MAX_RGDS数组分配方式改为  柔性数组，以灵活使用rgd内存。

2、视图实现

导入任务分为vgd导入与rgd导入，针对rgd导入：

|视图字段|实现|
|---|---|
|handler id|从rgd导入任务的insertCtx上获取handler的id|
|表名称|dc  ->  entry  ->  name。dc在spfRgdInitInsertCtx时，从insertCtx上获取|
|导入开始时间|spfRgdInitInsertCtx时  的  ankNow进行统计，每次用当前时间相减|
|导入分区数|在spfRgdInsert中，每次获取rgdGroup的partId时累加|
|导入记录数|rgdGroupWriteDataSet中的rowCount累加，每次加上rgdBuffer内的记录数|
|导入总内存配额|allocator.quota获取，在每次收集统计信息时更新|
|导入总内存使用量|RgdAllocator上的originAllocator.sizeUsed，在每次收集统计信息时更新|
|换入换出量|rgdWriteBuffer处统计|


隐藏列通过AnkColumn中的isHidden实现，需要隐藏字段是调用下面的宏实现：

```
#define FT_HIDDEN_COLUMN_DEF(colName, colId, colSize, colType) \
    { \
        .name = COD_TEXT_DEF(colName),  \
        .attr = {.id = colId,.size = colSize, .type = colType, .nullable = COD_TRUE, .invisible = COD_FALSE }, .isHidden = COD_TRUE \
    }
```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. 分区表/非分区表的导入，资源充足场景，能正常完成
1. 内存配额耗尽，导入能正常完成，不阻塞
1. 导入结束（成功/失败）等正常/异常场景不会有内存泄漏。
1. 视图正确显示


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

在doc文件目录下增加动态视图v$  bulkloadStat  的介绍（V$  bulkloadStat  .md）

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

预期编码时间：0.5人周

预期自测时间：0.5人周

  


## Attachments:

[image2024-3-29_11-51-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2I4OTcwYzJhZjRmNTIwZTVkIiwicmVmX2lkIjoiNjczOTZjY2I3MjgyMDZlZmI5MmYxNmFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTY3LCJleHAiOjE3ODIzODk5Njd9.WuYECp3b56CVX3lTjw6O9kMBEaxYGQkityzQrx-w3qc)

 (image/png)    


[image2023-8-9_14-38-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2I4OTcwYzJhZjRmNTIwZTVlIiwicmVmX2lkIjoiNjczOTZjY2I3MjgyMDZlZmI5MmYxNmFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTY3LCJleHAiOjE3ODIzODk5Njd9.QCNei-47oYy9r-1qX8Zght8iVNZWgx3tm2d1K0alPQ0)

 (image/png)    


## Comments:

|  [](null)  ,第一次讨论：（2024.04.09）,1、handler id按导入显示，视图挂载到insertCtx上,2、视图新增内存配额字段,3、导入开始时间改为持续时间,4、分区数统计需要加上internal的统计,5、dc从insertCtx上获取,6、换入换出量不使用全局量进行统计，针对线程进行,多表导入场景问题：线程同时导入多表时，以handler为入口会挂载多个rgdInsertCtx,Posted by leiyulu at 四月 09, 2024 16:50|
|---|
|  [](null)  ,评审：（2024.04.10）,1、隐藏参数都修改为最大32，  _SCOL_RGD_COUNT  默认为2,2、内存换入换出次数、  partNum  不需要,3、swapIn_bytes改为swap_bytes,4、增加导入行数字节数、导入开始时间、存储内导入执行时间,5、自测场景下视图正确显示,6、字段  视图规范名称,Posted by leiyulu at 四月 10, 2024 11:19|
