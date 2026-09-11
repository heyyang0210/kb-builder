Created by 徐伟 on 五月 17, 2023

#   [YDBRD-13671: 并行表扫/索引扫 Design](#ydbrd-13671-并行表扫索引扫-design)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-12134](https://jira.yasdb.com/browse/YDBRD-12134)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-13671](https://jira.yasdb.com/browse/YDBRD-13671)  

##   [1. Overview（概述）](#1-overview概述)  

并行是用其他资源来换取缩短执行时间，其作为提升执行效率的重要手段之一，是执行引擎十分重要的特性；而全表扫描跟全索引扫描是并行的基础，实现了它才能开始后续各并行算子的开发。

##   [2. Features（功能特性）](#2-features功能特性)  

- 并行是通过多线程实现
- 并行的设置可通过 hint指定或设置配置参数，如:


```
   （1）select /*+parallel(t1,2) */ * from t1;   --即是对表进行并行度为2的扫描

   （2）alter session set degree_of_parallel = 2;

生成的计划如下所示：
SQL&gt; explain select /*+parallel(t1 2) */ id from prt1 t1;

PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 3526392362
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  PX COORDINATOR                |                      |            |          |             |                                |
|  2 |   PX N2I LOCAL                 | QUEUE_0              |            |         3|             |                                |
|  3 |    PX BLOCK ITERATOR RANDOM    | DEGREE_2             |            |         3|       74( 0)|                                |
|  4 |     INDEX FAST FULL SCAN       | IDX_PRT1             | REGRESS    |         3|       74( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   2 - PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 2-&gt;1 DEGREE_2,PART_0)

17 rows fetched.

    

```

- 并行度设置值小于2时，就是非并行执行；并行度最高设置255，高于255也按255处理
- 线程个数由MAX_PARALLEL_WORKERS参数控制，默认为32；因此当并行度高于32时，实际可用的线程个数只有32；当存在多个stage时，多个stage目前是平分线程
- 并行会使用到tabQueue，每个stage之间通过tabQueue进行数据传输；stage的rootPlan是sender，tabQueue的writer跟reader对应stage的sender跟receiver
- 全表扫跟全索引扫的并行实现是将需要扫描的内容进行分片，然后各个线程去扫各自分片内容；有些线程可能分到的block都为空，因此不会扫描到任何内容
- 全表扫跟全索引扫的并行在sender使用测使用sender random，然后发送给coordinater进行汇总读取后输出，所以是 n -> 1


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult execPxCoordinator(AnlStmt* stmt, AnlPlan* plan);
CodResult fetchPxCoordinator(AnlStmt* stmt, AnlPlan* plan, CodBool* isEof);
CodResult pxAttachR(AnlStmt* stmt, TabQueueReader* reader);
CodResult pxAttachW(AnlStmt* stmt, TabQueueWriter* writer, TabQueueBlockHead** head);
CodResult execPxSender(AnlStmt* stmt, AnlPlan* plan);
CodResult fetchPxSender(AnlStmt* stmt, AnlPlan* plan, CodBool* isEof);
CodResult execPxReceiver(AnlStmt* stmt, AnlPlan* plan);
CodResult fetchPxReceiver(AnlStmt* stmt, AnlPlan* plan, CodBool* isEof);
CodResult fetchTabQueue(AnlStmt* stmt, TabQueueReader* reader, CodBool* isEof);
CodResult preparePxBlockItRange(AnlStmt* stmt, AnlPlan* plan, PxRangeSet* rangeSet);
CodResult execPxBlockIt(AnlStmt* stmt, AnlPlan* plan);
CodResult fetchPxBlockIt(AnlStmt* stmt, AnlPlan* plan, CodBool* isEof);


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 并行当前按白名单的形式打开实现，目前只支持单表的并行，其余并行暂不支持
- 当前并行都只考虑资源充足的情况进行，资源不足的在该SR暂不涉及；不足的有专门的IR跟踪：    [https://jira.yasdb.com/browse/YDBRD-12255](https://jira.yasdb.com/browse/YDBRD-12255)  
- 并行一般情况下都能提升执行效率，但是也有可能降低（在数据分布不均匀，都在一个线程做时，其余线程在访问完空表之后进行空等）
- 设置的并行度只是一个参考值，实际受MAX_PARALLEL_WORKERS参数影响


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1. 在计划阶段根据设置的degree以及具体的算子信息，生成stage，queue，并行算子信息
1. 在执行阶段，首先执行execPxCoordinator，分配handler，算出具体所需线程数，每个stage线程数，tabQueue的每个writer占用一个线程，计算出每个stage负责计算的sliceId跟currSliceId并且启动线程，执行stage
1. 执行stage先执行senderPlan，然后执行pxBlockIt进行数据分片，根据currSliceId算出每个线程应该计算的内容；表中数据实际分多少block进行扫描，以及每个线程扫描block的位置信息由存储返回
1. 当知道每个线程扫描的数据内容之后，每个线程从tabQueue的freeList取出block，将数据放入block中；然后触发detachW，激活事件；主线程事件被激活后从reader的subQueue里取出数据进行读取，读取完成之后将页面放回至tabQueue的freeList中； 期间子线程一直进行数据writer然后存放，直到该线程的数据已经读取完成
1. pxCoordinator读取完tabQueue的数据后，一条条往上吐数据完成整个并行执行。


###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b30a1ad9a3311dc80fc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE3NjMsImV4cCI6MTc4MjMwMjU2M30.drRVFUWVQz0CYs1INDE-Gxzk-Mh_E0BwRbTPFgmy8vg)

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 行表全表扫并行
- 行表indexFastFullScan并行
- 多表join（走非并行）
- 表出现在子查询中（走非并行）
- 表查询后接orderBy，groupBy


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

![](https://pingcode.yasdb.com/atlas/files/public/67396b318970c2af4f520285/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE3NjMsImV4cCI6MTc4MjMwMjU2M30.drRVFUWVQz0CYs1INDE-Gxzk-Mh_E0BwRbTPFgmy8vg)

## Attachments: