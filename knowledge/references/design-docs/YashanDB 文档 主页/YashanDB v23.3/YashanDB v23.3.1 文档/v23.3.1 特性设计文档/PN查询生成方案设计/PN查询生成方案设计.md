Created by 郭泽霖, last modified on 七月 03, 2024

#   [PN查询生成方案设计](#pn查询生成方案设计)  

  [IR链接：YASHAN-2858  分布式支持在PN组查询数据](https://pingcode.yasdb.com/ship/ideas/66279c4c009f91eb87f67b1f)  

  [SR链接：YDBRD-26823 分布式支持生成PN查询计划](https://pingcode.yasdb.com/pjm/items/663843ddc36a3d30a86175d9)  

##   [1. 总述](#1-总述)  

  [pn查询概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=130127255)  

本方案主要涉及：

1. 基于PN路由，对分布表生成PN查询计划
1. 适配复制表
1. 适配AC SCAN


###   [1.1 需求来源](#11-需求来源)  

内部技术需求，参见    [YashanDB存算分离总体方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119559628)  

仅支持分布式LSC表

###   [1.2 调研文档](#12-调研文档)  

  [调研分析](https://conf.yasdb.com/pages/viewpage.action?pageId=147770107)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|支持pn table scan|4.3|是|是|
|功能|支持pn runtime filter|4.4|是|是|
|功能|支持pn ac scan|4.5|是|是|
|性能|tpch性能|4.6|是|是|
|可维可测|explain|4.7|否|是|
|兼容性|路由接口修改|4.2|否|是|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|s3|亚马逊对象存储|是|  [Amazon S3](https://en.wikipedia.org/wiki/Amazon_S3)  |
|pn|process node，存算分离架构下的worker承载者|无|  [PNG节点管理](https://conf.yasdb.com/pages/viewpage.action?pageId=130132006)  |


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|配置参数|系统/会话级参数_USED_PN_GROUP，立即生效|指定此参数后，优化器会尝试生成pn查询计划|是|


##   [3. 规格与约束](#3-规格与约束)  

1. 仅支持分布式，需要集群中部署PN，一次只能指定一个PN组
1. PN计划仅支持DQL，仅支持LSC表，不支持索引
1. 涉及冷数据存在S3上的表时才会生成PN计划
1. PN计划不支持lob等混合存储的数据类型


##   [4. 特性](#4-特性)  

已在    [基于PN组的查询计划生成方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=130127255)    中分析

###   [4.1 特性设计](#41-特性设计)  

最终采取抽象出路由兼容层，在planner实现对pn scan展开的方案，屏蔽了复杂的优化流程。

1. genLogiDmlDesc后bind完成，此时就对pn优化项做出决定，并记录在CboOptConfig；后续访问此结构判断是否生成pn查询计划。
1. transGroup阶段，pn scan不implement index scan。
1. extract阶段，获取到pn信息，传入对应的路由接口。
1. planner阶段，将pn scan op转换为merge(冷，px+热)的anlplan，以及生成runtime filter端口
1. rwrt阶段，将路由表附在subCoordPlan上


###   [4.2 路由接口](#42-路由接口)  

  [groupDesc重构方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=153024622)    中已经基本完成了路由接口调整，使用新结构stagePipe描述执行的worker，从而对dn与pn一视同仁。此处只需要将setGroupDesc做出调整，添加入参type与groupNodeId。注意此函数的使用范围不应当超出路由接口层。

pn路由表也挂在AnlContext上，对不同路由表访问目前通过参数来实现：

```
RouteDict* anlGetRouteDict(AnlStmt* stmt, CodBool isPnRoute)
{
    if (stmt-&gt;context == NULL) {
        return NULL;
    }
    return isPnRoute ? stmt-&gt;context-&gt;pnRouteDict : stmt-&gt;context-&gt;routeDict;
}

```

使用举例：

```
CodResult anlGetGroupByChunk(AnlStmt* stmt, CodBool isPnRoute, CodUint32 chunkId, GroupDesc* group)
{
    RouteDict* routeDict = anlGetRouteDict(stmt, isPnRoute);
    COD_PANIC(chunkId &lt; routeDict-&gt;chunkCount, NULL);

    if (isPnRoute) {
        setGroupDesc(group, STAGE_PIPE_NODE, routeDict-&gt;pnGroupId, routeDict-&gt;chunkRoute[chunkId],
                     GROUP_STRATEGY_SINGLE_ENDPOINT);
    } else {
        setGroupDesc(group, STAGE_PIPE_GROUP, routeDict-&gt;chunkRoute[chunkId], COD_INVALID_NODE_ID,
                     GROUP_STRATEGY_SINGLE_ENDPOINT);
    }

    return COD_SUCCESS;
}

```

任何涉及到访问路由表的接口，理论上都需要添加参数isPnRoute判断访问哪个路由表。

###   [4.3 pn table scan](#43-pn-table-scan)  

其实主要就两个实现点：

1. 把一个op拆成一颗anlplan子树，实际上pn和dn上的anlPlan去掉px是完全一样的（除了标志位），因此后序做一个copy即可。不同的场景需要生成不同的子树。
1.     - 复制表只存在dn，如果启用了pn查询，计划层只加一个px让他变成在pn的“复制表”。
    - 新增一个plan merge，作用就是union all，不用union all是因为结构太重

1. 根据dc以及op的dstbStatus，拼凑出一个dn->pn的px，需要补分布键到投影里给px用。


###   [4.4 pn runtime filter](#44-pn-runtime-filter)  

  [runtimefilter端口生成调整](https://conf.yasdb.com/pages/viewpage.action?pageId=141583237)     后，pn场景下，只需要根据pn hot scan的tq补充use端的port即可（create端一定是pn)。另外由于目前不支持一发多收，因此表格中所列的某些场景会退化，导致runtime filter性能变差。

###   [4.5 pn ac scan](#45-pn-ac-scan)  

ac scan和普通的table scan区别不大

1. ac scan热数据端只需要table scan。
1. 如果是纯ac scan，则不需要对热数据扫描。但此时还需要去dn拉元数据，因此groupsMap要加上dn。


###   [4.6 tpch性能](#46-tpch性能)  

主要依赖存储的disk cache，计划侧如果要做精细，还是要依赖dn跟pn做cbo。目前在100g有disk cache的时候也基本差不多。

1. 目前不影响优化流程因此生成的计划逻辑上是一样的，物理上也只是在scan层有区别。
1. runtime filter的影响如上述。可以调整pn场景下默认的阈值
1. hot scan侧因为有px，放在merge的右边，对无热数据场景有优化
1. 由于DFO调度，多加的px在资源受限场景下一定会多加出material，并且也会导致runtime filter失效，这时一定比不过dn


###   [4.7 explain](#47-explain)  

改了pn scan，以及px以及runtime filter的端口使用pn时的表现

```
PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 3297765268                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
|  2 |   COL TO ROW                   |                      |            |          |             |                                |
|  3 |    PX N2I REMOTE               | QUEUE_0              |            |          |             |                                |
|  4 |     SORT ORDER BY              |                      |            |          |             |                                |
|* 5 |      HASH JOIN INNER           |                      |            |          |             |                                |
|  6 |       JOIN FILTER USE          |                      |            |          |             |                                |
|  7 |        MERGE                   |                      |            |          |             |                                |
|* 8 |         PX N2N REMOTE          | QUEUE_1              |            |          |             |                                |
|  9 |          PART SCAN ALL         |                      |            |          |             | [0,20]                         |
|*10 |           TABLE ACCESS HOT     | TEST_PN_SCAN1        | SYS        |          |             |                                |
| 11 |         PART SCAN ALL          |                      |            |          |             | [0,20]                         |
|*12 |          TABLE ACCESS COLD     | TEST_PN_SCAN1        | SYS        |          |             |                                |
|*13 |       JOIN FILTER CREATE       |                      |            |          |             |                                |
| 14 |        MERGE                   |                      |            |          |             |                                |
|*15 |         PX N2N REMOTE          | QUEUE_2              |            |          |             |                                |
| 16 |          PART SCAN ALL         |                      |            |          |             | [0,20]                         |
| 17 |           TABLE ACCESS HOT     | TEST_PN_SCAN2        | SYS        |          |             |                                |
| 18 |         PART SCAN ALL          |                      |            |          |             | [0,20]                         |
| 19 |          TABLE ACCESS COLD     | TEST_PN_SCAN2        | SYS        |          |             |                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   1 - StageInfo: [3]                                           
   2 - Projection: RemoteTable[2][INTEGER], RemoteTable[2][INTEGER], RemoteTable[2][INTEGER], RemoteTable[2][VARCHAR, 4]
   3 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER], Tuple[0, 2][INTEGER], Tuple[0, 3][VARCHAR, 4]
       PX RemoteInfo: (RANDOM SENDER -&gt; SORT RECEIVER : 3-&gt;1 [6-1][6-2][6-3]-&gt;[2])
       StageInfo: [0]                                           
   4 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER], Tuple[0, 2][INTEGER], Tuple[0, 3][VARCHAR, 4]
   5 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER], Tuple[1, 0][INTEGER], Tuple[1, 1][VARCHAR, 4]
       Predicate : access(Tuple[0, 0] = Tuple[1, 0])            
   6 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER]   
   7 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER]   
   8 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER]   
       PX RemoteInfo: (HASH SENDER -&gt; RANDOM RECEIVER : 3-&gt;3 [3][4][5]-&gt;[6-1][6-2][6-3])
       StageInfo: [1]                                           
       Predicate : access(Tuple[0, 0])                          
   9 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER]   
  10 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER]   
       Predicate : RUNTIME FILTER(RUNTIME USE(0): "TEST_PN_SCAN1"."C1" src: [6-1] [6-2] [6-3]  dst: [3] [4] [5] [6-1] [6-2] [6-3] )
  11 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER]   
  12 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER]   
       Predicate : RUNTIME FILTER(RUNTIME USE(0): "TEST_PN_SCAN1"."C1" src: [6-1] [6-2] [6-3]  dst: [3] [4] [5] [6-1] [6-2] [6-3] )
  13 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 4]
       Predicate : RUNTIME FILTER(RUNTIME CREATE(0): Tuple[0, 0] src: [6-1] [6-2] [6-3]  dst: [3] [4] [5] [6-1] [6-2] [6-3] )
  14 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 4]
  15 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 4]
       PX RemoteInfo: (HASH SENDER -&gt; RANDOM RECEIVER : 3-&gt;3 [3][4][5]-&gt;[6-1][6-2][6-3])
       StageInfo: [2]                                           
       Predicate : access(Tuple[0, 0])                          
  16 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 4]
  17 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 4]
  18 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 4]
  19 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 4]

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 检查结果正确性，复用已有DN LSC表用例。
- 基于规格，关注计划合理性，另外可以检查计划中的px端口正确性
- 由于AnlPlan结构变复杂，tableQueue变多，内存开销会变大
- pn scan加复杂filter，子查询等


##   [6.资料设计章节](#6资料设计章节)  

无

##   [7.未来规划](#7未来规划)  

无

  


## Comments:

|  [](null)  ,与会人：徐晓锋，黄靖东，施新华，李潮，郭泽霖    
  会议时间：2024/07/03    
  纪要信息：    
  1.同意技术方案，run    
  2.后续演进考虑pn查询参与cbo    
  3.单表索引考虑放开，参考复制表    
  4.runtime filter支持一对多后，调整pn端口策略    
  5.merge plan用union all代替    
  6.分布键不需要补，反向根据分布键检查，如果不在投影里则只需要生成random sender    
  7.未来考虑支持chunk sender实现此场景下的性能优化    
  8.chunkMeta不能使用context上的分配器,Posted by guozelin at 七月 03, 2024 17:48|
|---|
