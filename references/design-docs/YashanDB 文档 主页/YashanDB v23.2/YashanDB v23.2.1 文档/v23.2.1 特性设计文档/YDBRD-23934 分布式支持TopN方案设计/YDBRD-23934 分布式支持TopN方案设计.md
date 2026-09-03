Created by 何阳, last modified on 一月 04, 2024

#   [分布式支持TopN Design（分布式支持TpoN方案设计）](#分布式支持topn-design分布式支持tpon方案设计)  

JIRA：    [https://jira.yasdb.com/browse/YDBRD-23934](https://jira.yasdb.com/browse/YDBRD-23934)  

参考链接：    [https://conf.yasdb.com/display/YAS/TopN+Design](https://conf.yasdb.com/display/YAS/TopN+Design)  

##   [1. Overview（概述）](#1-overview概述)  

*简要说明本设计方案的背景、需求。*

分布式支持提取前面排序的N条有序结果

##   [2. Features（功能特性）](#2-features功能特性)  

*说明本方案的功能特性。*

分布式支持了TopN的计划，对单机无任何影响

##   [3. Interfaces（接口）](#3-interfaces接口)  

*列出本方案对外提供的接口、配置参数、API等。*

对外接口没有变更

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

*说明本方案对外的功能限制或约束。*

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](#51-architecture架构)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

*设计主要数据结构、工作流程、序列图等。*

####   [涉及topN的算子](#涉及topn的算子)  

1. SortPlan
1. GroupByPlan
1. PxReceiverPlan
1. DistinctPlan
1. WinFuncDecl // MatDecl


```
// 在分布式上放开topN功能
static inline CodResult initSortPlan(AnlOptimizer* optmzr, CboOperator* cboOp, AnlPlan** anlPlan, PlanType planType)
{
    MemoryContext* mctx = optmzr-&gt;owner;
    COD_CALL(initBasePlan(mctx, cboOp, anlPlan, planType));
    (*anlPlan)-&gt;sort.topN = PHYS_SORT(cboOp)-&gt;sortDesc-&gt;topN;  // 将sort算子的topN赋值给anlPlan上去执行，走SORT_FOT_LIMIT复合排序类型
    (*anlPlan)-&gt;sort.forType = (*anlPlan)-&gt;sort.topN == 0 ? SORT_FOR_DEFAULT : SORT_FOR_LIMIT;
    COD_CALL(anlCopySortColArray2List(mctx, PHYS_SORT(cboOp)-&gt;sortDesc-&gt;sortCols, &amp;(*anlPlan)-&gt;sort.sortExprs));
    COD_CALL(makeSortRsColumns(mctx, cboOp-&gt;projExprs, anlPlan));
    return COD_SUCCESS;
}

// 分布式已经放开 
CodResult createRowDistinct(AnlOptimizer* optmzr, CboOperator* cboOp, PlanDataset* ds, AnlPlan** anlPlan)
{
    /*
     * 赋初值给 DistinctPlan
     */
    (*anlPlan)-&gt;distinct.topN = PHYS_UNIQUE(cboOp)-&gt;topN; //赋初值给topN
    return COD_SUCCESS;
}


// 分布式已经放开 
static inline CodResult initGroupPlan(MemoryContext* mctx, CboOperator* cboOp, AnlPlan** anlPlan, PlanType planType,
                                      PlanDataset* ds)
{
    // 赋初值给GroupByPlan
    (*anlPlan)-&gt;groupBy.topN = PHYS_GROUP(cboOp)-&gt;topN; // 赋值给topN
    return COD_SUCCESS;
}


```

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*  自测关注点：

覆盖全面避免重复测试测试用例的可维护性自测用例设计方法：

边界值等价类正交

```
--- 场景1：3种情况
--- TOP SORT GROUP  目前列表不会生成这个算子(createRowGroup 里面)

--- TOP SORT
explain select * from t1 order by b limit 5 ;

--- TOP SORT DISTINCT
explain select distinct(a) from t1 group by a order by a limit 5;
explain select distinct(a) from t1 group by a order by a limit 5 offset 1;

--- 场景2： 暂未支持，未来支持了窗口函数part limit之后 本特性不支持
--- WINDOW PARTITION TOP SORT


--- 示例：支持topN的计划
SQL&gt; explain select * from t1 order by b limit 5 ;

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 2243065276                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
|  2 |   COL TO ROW                   |                      |            |         5|      301( 0)|                                |
|  3 |    WINDOW                      |                      |            |         5|      301( 0)|                                |
|  4 |     PX N2I REMOTE              | QUEUE_0              |            |         5|      301( 0)|                                |
|  5 |      WINDOW                    |                      |            |         5|      299( 0)|                                |
|  6 |       TOP SORT                 |                      |            |    100000|      299( 0)|                                |
|  7 |        PART SCAN ALL           |                      |            |    100000|      270( 0)| [0,20]                         |
|  8 |         TABLE ACCESS FULL      | T1                   | REGRESS    |    100000|      270( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   2 - Projection: RemoteTable[1][INTEGER], RemoteTable[1][CHAR, 20]
   3 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       Limit Expression: (LIMIT: 5)                             
   4 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       PX RemoteInfo: (RANDOM SENDER -&gt; SORT RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
   5 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       Limit Expression: (LIMIT: 5)                             
   6 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
   7 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
   8 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  

30 rows fetched.


--- 不支持topN的计划
SQL&gt; explain select * from t1 order by b limit  5 ;

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 2963764668                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
|  2 |   COL TO ROW                   |                      |            |         5|      301( 0)|                                |
|  3 |    WINDOW                      |                      |            |         5|      301( 0)|                                |
|  4 |     PX N2I REMOTE              | QUEUE_0              |            |         5|      301( 0)|                                |
|  5 |      WINDOW                    |                      |            |         5|      299( 0)|                                |
|  6 |       SORT ORDER BY            |                      |            |    100000|      299( 0)|                                |
|  7 |        PART SCAN ALL           |                      |            |    100000|      270( 0)| [0,20]                         |
|  8 |         TABLE ACCESS FULL      | T1                   | REGRESS    |    100000|      270( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   2 - Projection: RemoteTable[1][INTEGER], RemoteTable[1][CHAR, 20]
   3 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       Limit Expression: (LIMIT: 5)                             
   4 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       PX RemoteInfo: (RANDOM SENDER -&gt; SORT RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
   5 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
       Limit Expression: (LIMIT: 5)                             
   6 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
   7 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  
   8 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][CHAR, 20]  

30 rows fetched.


```

##   [7. Workload（工作量）](#7-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,会议纪要,参与人：徐晓锋 何阳 刘晓旋 吴煜 韩晓盼,时间：2023年12月13日 10:00~11:00,地点：26栋1012,1. 需要确认limit N，N是什么情况下不走topN计划，具体规格是多少？
1. 需要在分布式下增加分布表，复制表以及混合的相关测试用例
1. 增加测试语法offset N fetch M
,Posted by heyang at 十二月 13, 2023 10:26|
|---|
|  [](null)  ,问题1，N表示的是uint32_max，没有限制,Posted by heyang at 一月 08, 2024 14:11|
