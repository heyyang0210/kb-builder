Created by 李坤宇, last modified on 七月 19, 2023

#   [YDBRD-13655 : AC并行计划方案设计](#ydbrd-13655--ac并行计划方案设计)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-13655](https://jira.yasdb.com/browse/YDBRD-13655)  

##   [1. Overview（概述）](#1-overview概述)  

本方案是为了支持使用AC时选择并行计划以提升性能。

##   [2. Features（功能特性）](#2-features功能特性)  

当用户指定并行度时，优化器会检查是否能走并行计划，当能并行时生成并行算子并加入计划搜索空间中。

- 并行是通过多线程实现
- 并行的设置可通过 hint指定或设置配置参数，如:


```
   （1）select /*+parallel(t1,2) */ * from t1;   --即是对表进行并行度为2的扫描

   （2）alter session set degree_of_parallel = 2;

```

生成计划如下

```
SQL&gt; explain select /*+parallel(AC_SCAN_TABLE_PARALLEL,4)*/ t1 from AC_SCAN_TABLE_PARALLEL order by 1;

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 3970803982                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  COL TO ROW                    |                      |            |          |             |                                |
|  2 |   EXPAND                       |                      |            |    200000|    47535( 0)|                                |
|  3 |    SORT ORDER BY               |                      |            |    100000|    47524( 0)|                                |
|  4 |     PX COORDINATOR             |                      |            |          |             |                                |
|  5 |      PX N2I LOCAL              | QUEUE_0              |            |    100000|      436( 0)|                                |
|  6 |       AC SCAN                  | AC_SCAN_AC_PARALLEL  | REGRESS    |    100000|       97( 0)|                                |
|  7 |       TABLE ACCESS FULL        | AC_SCAN_TABLE_PARALLEL| REGRESS    |    100000|      110( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   1 - Projection: RemoteTable[1][INTEGER]                      
   2 - Projection: Tuple[0, 0][INTEGER]                         
   3 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][BIGINT]    
   4 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][BIGINT]    
   5 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][BIGINT]    
       PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 4-&gt;1 DEGREE_4,PART_0)
   6 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][BIGINT]    
   7 - Projection: Tuple[0, 0][INTEGER], 1[BIGINT]              

27 rows fetched.


```

- 并行度设置值小于2时，就是非并行执行；并行度最高设置255，高于255也按255处理
- 线程个数由MAX_PARALLEL_WORKERS参数控制，默认为32；因此当并行度高于32时，实际可用的线程个数只有32；当存在多个stage时，多个stage目前是平分线程
- 全表扫跟全索引扫的并行在sender使用测使用sender random，然后发送给coordinater进行汇总读取后输出，所以是 n -> 1


##   [3. Interfaces（接口）](#3-interfaces接口)  

通过配置参数或hint指定并行后，优化器自动适配。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 本方案当前只支持单机并行，待分布式适配后天然支持分布式下并行。
1. 规格上AC SCAN与TABLE FULL SCAN在并行上保持一致。
1. 当前并行都只考虑资源充足的情况进行，资源不足的在该SR暂不涉及；不足的有专门的IR跟踪：    [https://jira.yasdb.com/browse/YDBRD-12255](https://jira.yasdb.com/browse/YDBRD-12255)  
1. 并行一般情况下都能提升执行效率，但是也有可能降低（在数据分布不均匀，都在一个线程做时，其余线程在访问完空表之后进行空等）
1. 设置的并行度只是一个参考值，实际受MAX_PARALLEL_WORKERS参数影响


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

利用已有的CBO内并行框架，添加AC并行相关逻辑，使acscan和part acscan也能生成并行相关信息。    
  实现part ac scan和ac scan算子的derive函数

```
CodResult derivePartAcScan(CboOptimizer* cboOpt, CboOperator* op, ObjectArray* inputOptCtxs, ExtraProp** outProp)
{
    if (inputOptCtxs == NULL) {
        COD_CALL(makeExtraProp(cboOpt-&gt;mctx, outProp));
    } else {
        *outProp = drvdFromOptCtxs(inputOptCtxs, 0);
    }
    if (isValidParalDegree(op-&gt;degree)) {
        COD_CALL(makeRandomParalDesc(cboOpt-&gt;mctx, &amp;(*outProp)-&gt;paralDesc, op-&gt;degree));
    } else if (isValidParalDegree(cboOpt-&gt;degree)) {
        COD_CALL(makeSingleParalDesc(cboOpt-&gt;mctx, &amp;(*outProp)-&gt;paralDesc));
    }
    return COD_SUCCESS;
}

CodResult deriveAcScan(CboOptimizer* cboOpt, CboOperator* op, ObjectArray* inputOptCtxs, ExtraProp** outProp)
{
    if (inputOptCtxs == NULL) {
        COD_CALL(makeExtraProp(cboOpt-&gt;mctx, outProp));
    } else {
        *outProp = drvdFromOptCtxs(inputOptCtxs, 0);
    }
    if (isValidParalDegree(op-&gt;degree)) {
        COD_CALL(makeRandomParalDesc(cboOpt-&gt;mctx, &amp;(*outProp)-&gt;paralDesc, op-&gt;degree));
    } else if (isValidParalDegree(cboOpt-&gt;degree)) {
        COD_CALL(makeSingleParalDesc(cboOpt-&gt;mctx, &amp;(*outProp)-&gt;paralDesc));
    }
    return COD_SUCCESS;
}


```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 直接查询ac和改写ac都能走并行
1. 已有用例开启并行后结果正确性
1. 开启并行后，explain查看计划，是否有px算子，有即说明走了并行。
1. 重点关注join、聚合、groupby场景下是否结果正确。可参考已有非并行用例打开并行后执行结果，理论上结果完全一致且计划上增加了px计划。


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*