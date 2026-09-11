Created by 叶显昊, last modified on 五月 06, 2024

#   [YDBRD-26323: 子查询采用独立的stage设计文档](#ydbrd-26323-子查询采用独立的stage设计文档)  

SR链接：    [https://pingcode.yasdb.com/pjm/items/661940e2fd997db58ad8c081?%20=#YDBRD-26323%20%E5%88%86%E5%B8%83%E5%BC%8F%E5%92%8C%E5%B9%B6%E8%A1%8C%E5%AD%90%E6%9F%A5%E8%AF%A2%E4%BC%98%E5%8C%96](https://pingcode.yasdb.com/pjm/items/661940e2fd997db58ad8c081?%20=#YDBRD-26323%20%E5%88%86%E5%B8%83%E5%BC%8F%E5%92%8C%E5%B9%B6%E8%A1%8C%E5%AD%90%E6%9F%A5%E8%AF%A2%E4%BC%98%E5%8C%96)  

##   [1. 总述](#1-总述)  

子查询是一个表达式，其挂着一颗 Plan树，子查询表达式的数据来源于plan树的执行结果。当前子查询的算子的执行是由父查询执行子查询表达式时触发其执行的，子查询的通信资源（例如Table queue,其下面如果有Px节点）是挂在主Stage上的，存在的问题就是子查询无法给多Stage使用（Tpcds Q23）,在一个stage多个实例使用时也有问题，Execute(bind时)，Table queue已经和对于stage的statement绑定了，执行又是被另外的stage实例执行，导致的问题就是执行时需要切换线程栈，同时要保证bind时的stament还没有被释放，导致Stage 实例之间有依赖。子查询的plan在独立stage运行，可以让子查询plan脱离父查询独立执行，同时给多子查询提供结果。

###   [1.1 需求来源](#11-需求来源)  

需求来源：功能完善，增强子查询能力。

合理性：当前分布式子查询执行是在表达式计算再去fetch下层plan，依赖于父查询的执行流程，子查询不会主动执行完，修改之后子查询执行不依赖于父查询的通信执行资源。

性能：增加独立stage，则子查询的plan可以独立执行完成，将结果暂存在物化区，之后可以释放内存资源，父查询有更多内存可以使用。

支持形态：单机列存，分布式列存。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

####   [子功能1 同一个静态子查询可被多个stage使用](#子功能1-同一个静态子查询可被多个stage使用)  

方案：之前子查询依赖于父查询执行，修改之后子查询独立执行，将结果暂存，可被多个stage使用。（解决tpcds q23子查询被多个stage使用问题）

####   [子功能2 关联子查询在独立stage使用](#子功能2-关联子查询在独立stage使用)  

方案：subquery sender和subquery receiver需要支持参数、finish和rescan，如果是关联子查询，子查询执行完暂不释放资源，sender阻塞，等待receiver的finish和rescan以及释放资源消息。

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

子查询stage不受MAX_WORKERS_PER_EXEC参数限制。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

场景描述：子查询在独立stage执行

计划改写流程

- 新增subquery sender和subquery receiver，


```
typedef struct StSubqSendPlan {
    AnlPlan *child;
    MatDecl *matDecl;
    ObjectArray *exprs;
    CodUint16 stageId;
    CodUint16 brotherId;

    CodBool isShared;
    CodUint8 unused;
} SubqSendPlan;

typedef struct StSubqRecvPlan {
    QueryNodePlan head;
    AnlPlan *child;
    MatDecl *matDecl;
    ObjectArray *exprs;
    CodBool isShared;
    CodUint8 unused[7];
} SubqRecvPlan;

```

- trsfSubQuery时，在父查询stage之后新增stage。


```
    ...

    PxStage *stage;
    COD_CALL(
            createPxStage(context-&gt;optmzr-&gt;owner, context-&gt;pxDecl, NULL, plan-&gt;degree == 0 ? 1 : plan-&gt;degree, &amp;stage));

    ...

```

- 获取子查询的plan，将子查询的plan（result）改写为subquery sender和subquery receiver，sender为新增stage的rootPlan。


```
    ...

    AnlPlan *subqSendPlan;
    COD_CALL(anlAllocMem(context-&gt;optmzr-&gt;owner, sizeof(AnlPlan), (CodChar **) &amp;subqSendPlan));
    *subqSendPlan = *plan;
    subqSendPlan-&gt;type = PLAN_SUBQUERY_SENDER;
    subqSendPlan-&gt;subqSender.child = result.child;
    subqSendPlan-&gt;subqSender.exprs = plan-&gt;projExprs;
    subqSendPlan-&gt;subqSender.matDecl = NULL;
    subqSendPlan-&gt;subqSender.stageId = stage-&gt;id;
    subqSendPlan-&gt;subqSender.brotherId = prevStage-&gt;childStages == NULL ? 0 : prevStage-&gt;childStages-&gt;count;
    subqSendPlan-&gt;subqSender.isShared = COD_FALSE;

    plan-&gt;type = PLAN_SUBQUERY_RECEIVER;
    plan-&gt;subqReceiver.child = subqSendPlan;
    plan-&gt;subqReceiver.exprs = plan-&gt;projExprs;
    plan-&gt;subqReceiver.matDecl = NULL;
    plan-&gt;subqReceiver.isShared = COD_FALSE;

    ...

```

- 设置stage


```
    ...

    stage-&gt;rootPlan = subqSendPlan;
    stage-&gt;parentPlan = NULL;
    stage-&gt;parentId = prevStage-&gt;id;
    stage-&gt;brotherId = prevStage-&gt;childStages == NULL ? 0 : prevStage-&gt;childStages-&gt;count;
    stage-&gt;recvQueueCount = 1;
    stage-&gt;hasMat = COD_TRUE;
    stage-&gt;groupCount = context-&gt;stage-&gt;groupCount;
    stage-&gt;portGroups = context-&gt;stage-&gt;portGroups;

    PxStage *parentStage = prevStage;
    COD_CALL(addChildStage(context-&gt;optmzr-&gt;owner, parentStage, COD_INVALID_UINT16, stage));

    if ((query == NULL || query-&gt;staticId != COD_INVALID_UINT16) &amp;&amp;
        context-&gt;optmzr-&gt;stmt-&gt;planContext-&gt;execMode == EXEC_MODE_STANDALONE) {
    }
    context-&gt;stage = stage;

    ...

```

- 改写后计划如下，新增了     `stage[4]`    ：


```
SQL&gt; explain select * from t1 where (select max(c1) from t1) &lt;= c1;

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  SUBQUERY                      | QUERY[1]             |            |          |             |                                |
|  2 |   MATERIAL                     |                      |            |         1|       45( 0)|                                |
|  3 |    PX I2N REMOTE               | QUEUE_1              |            |         1|       45( 0)|                                |
|  4 |     AGGREGATE                  |                      |            |         1|       43( 0)|                                |
|  5 |      PX N2I REMOTE             | QUEUE_2              |            |         1|       43( 0)|                                |
|  6 |       AGGREGATE                |                      |            |         1|       41( 0)|                                |
|  7 |        PART SCAN ALL           |                      |            |    100000|       40( 0)| [0,20]                         |
|  8 |         TABLE ACCESS FULL      | T1                   | REGRESS    |    100000|       40( 0)|                                |
|  9 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
| 10 |   COL TO ROW                   |                      |            |     33000|       91( 0)|                                |
| 11 |    PX N2I REMOTE               | QUEUE_0              |            |     33000|       91( 0)|                                |
| 12 |     PART SCAN ALL              |                      |            |     33000|       88( 0)| [0,20]                         |
|*13 |      TABLE ACCESS FULL         | T1                   | REGRESS    |     33000|       88( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Projection: Tuple[0, 0][INTEGER]
       StageInfo: [4]
   2 - Projection: Tuple[0, 0][INTEGER]
   3 - Projection: Tuple[0, 0][INTEGER]
       PX RemoteInfo: (BROADCAST SENDER -&gt; RANDOM RECEIVER : 1-&gt;3 [2]-&gt;[3][4][5])
       StageInfo: [1]
   4 - Projection: MAX(Tuple[0, 0])[INTEGER]
   5 - Projection: Tuple[0, 0][INTEGER]
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
       StageInfo: [2]
   6 - Projection: MAX(Tuple[0, 0])[INTEGER]
   7 - Projection: Tuple[0, 0][INTEGER]
   8 - Projection: Tuple[0, 0][INTEGER]
   9 - StageInfo: [3]
  10 - Projection: RemoteTable[1][INTEGER]
  11 - Projection: Tuple[0, 0][INTEGER]
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
       StageInfo: [0]
  12 - Projection: Tuple[0, 0][INTEGER]
  13 - Projection: Tuple[0, 0][INTEGER]
       Predicate : filter(QUERY[1] &lt; Tuple[0, 0])

Stage Information (identified by stage group id):
---------------------------------------------------

   - max workers per execute: 8
  group 0 - [2, 1, 4, 0, 3]


```

- 嵌套子查询


```
SQL&gt; explain select * from t1 where (select max(c1) from t1 where c1 &lt;= (select min(c1) from t1)) &lt;= c1;

PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 3674910323
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  SUBQUERY                      | QUERY[2]             |            |          |             |                                |
|  2 |   MATERIAL                     |                      |            |         1|       92( 0)|                                |
|  3 |    PX I2N REMOTE               | QUEUE_1              |            |         1|       92( 0)|                                |
|  4 |     AGGREGATE                  |                      |            |         1|       90( 0)|                                |
|  5 |      PX N2I REMOTE             | QUEUE_2              |            |         1|       90( 0)|                                |
|  6 |       AGGREGATE                |                      |            |         1|       88( 0)|                                |
|  7 |        PART SCAN ALL           |                      |            |     33000|       88( 0)| [0,20]                         |
|* 8 |         TABLE ACCESS FULL      | T1                   | REGRESS    |     33000|       88( 0)|                                |
|  9 |  SUBQUERY                      | QUERY[1]             |            |          |             |                                |
| 10 |   MATERIAL                     |                      |            |         1|       45( 0)|                                |
| 11 |    PX I2N REMOTE               | QUEUE_3              |            |         1|       45( 0)|                                |
| 12 |     AGGREGATE                  |                      |            |         1|       43( 0)|                                |
| 13 |      PX N2I REMOTE             | QUEUE_4              |            |         1|       43( 0)|                                |
| 14 |       AGGREGATE                |                      |            |         1|       41( 0)|                                |
| 15 |        PART SCAN ALL           |                      |            |    100000|       40( 0)| [0,20]                         |
| 16 |         TABLE ACCESS FULL      | T1                   | REGRESS    |    100000|       40( 0)|                                |
| 17 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
| 18 |   COL TO ROW                   |                      |            |     33000|      139( 0)|                                |
| 19 |    PX N2I REMOTE               | QUEUE_0              |            |     33000|      139( 0)|                                |
| 20 |     PART SCAN ALL              |                      |            |     33000|      136( 0)| [0,20]                         |
|*21 |      TABLE ACCESS FULL         | T1                   | REGRESS    |     33000|      136( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Projection: Tuple[0, 0][INTEGER]
       StageInfo: [6]
   2 - Projection: Tuple[0, 0][INTEGER]
   3 - Projection: Tuple[0, 0][INTEGER]
       PX RemoteInfo: (BROADCAST SENDER -&gt; RANDOM RECEIVER : 1-&gt;3 [2]-&gt;[3][4][5])
       StageInfo: [1]
   4 - Projection: MAX(Tuple[0, 0])[INTEGER]
   5 - Projection: Tuple[0, 0][INTEGER]
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
       StageInfo: [2]
   6 - Projection: MAX(Tuple[0, 0])[INTEGER]
   7 - Projection: Tuple[0, 0][INTEGER]
   8 - Projection: Tuple[0, 0][INTEGER]
       Predicate : filter(Tuple[0, 0] &lt;= QUERY[1])
   9 - Projection: Tuple[0, 0][INTEGER]
       StageInfo: [7]
  10 - Projection: Tuple[0, 0][INTEGER]
  11 - Projection: Tuple[0, 0][INTEGER]
       PX RemoteInfo: (BROADCAST SENDER -&gt; RANDOM RECEIVER : 1-&gt;3 [2]-&gt;[3][4][5])
       StageInfo: [3]
  12 - Projection: MIN(Tuple[0, 0])[INTEGER]
  13 - Projection: Tuple[0, 0][INTEGER]
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
       StageInfo: [4]
  14 - Projection: MIN(Tuple[0, 0])[INTEGER]
  15 - Projection: Tuple[0, 0][INTEGER]
  16 - Projection: Tuple[0, 0][INTEGER]
  17 - StageInfo: [5]
  18 - Projection: RemoteTable[1][INTEGER]
  19 - Projection: Tuple[0, 0][INTEGER]
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
       StageInfo: [0]
  20 - Projection: Tuple[0, 0][INTEGER]
  21 - Projection: Tuple[0, 0][INTEGER]
       Predicate : filter(QUERY[2] &lt;= Tuple[0, 0])

Stage Information (identified by stage group id):
---------------------------------------------------

   - max workers per execute: 8
  group 0 - [4, 3, 7, 2, 1, 6, 0, 5]


```

执行流程

- subquery sender和subquery receiver
    - 非关联子查询允许多个receiver，关联子查询只支持一个receiver。
    - 共享同一个ColumnSetStoreCollector实例，子查询独立执行将结果存储在ColumnSetStoreCollector实例中，父查询从中读取。
    - 共享一个状态completed，表示子查询是否已经完成。
    - 共享一个状态order，表示父查询对于子查询运行的需求，父查询根据需求设置状态：
        - 子查询
            - 当处于hang状态时子查询算子阻塞执行，
            - 处于run状态时子查询算子执行并写入暂存区，执行完成后设置completed并将状态置为hang，
            - 处于finish状态时子查询算子调用finish并将状态置为hang，
            - 处于rescan状态时子查询算子调用rescan并将状态置为hang，
            - 处于exit状态时子查询算子终止执行退出。
    - 如果是关联子查询，则共享同一个param_provider，用于父查询向子查询传递更新参数。
- 静态子查询：
    - fetch
        - sender最开始处于hang状态，等待receiver设置order状态为run。
        - 任一receiver设置order状态为run，则sender开始执行并写入暂存区，receiver等待completed状态。
        - sender执行完之后设置completed状态，退出，receiver从暂存区读取数据。
    - rescan/finish
        - receiver自行rescan暂存区，不会传递到sender
- 关联子查询：
    - fetch
        - sender最开始处于hang状态，等待receiver设置参数并设置order状态为run。
        - receiver设置参数并将状态设置为run，等待completed状态以及sender将order状态设置为hang。
        - sender开始执行，执行过程中判断receiver是否有将order状态设置为finish，
            - 如果有则终止执行调用finish并将order状态设置为hang。
            - 否则继续执行，sender执行完之后设置completed状态，将order状态设置为hang。
        - 在hang状态下如果receiver将order状态设置为rescan，则sender调用rescan并将order状态设置为hang。
        - 当receiver进入退出流程时，将order状态设置为exit，通知sender退出。
    - finish
        - receiver设置order状态为finish，等待sender完成将order状态设为hang。
    - rescan
        - 检查参数是否更新，
            - 如果参数更新：
                - receiver设置order状态为finish，等待sender完成将order状态设为hang，
                - 设置参数，
                - 设置order状态为rescan，等待sender完成将order状态设为hang。
            - 否则receiver自行rescan暂存区，不会传递到sender。
- stage退出
    - 子查询stage退出有三种情况：
        - 关联子查询执行结束退出：关联子查询等待父查询设置结束状态退出。
        - 非关联子查询执行结束退出：执行结果在暂存区无需等待，直接退出。
        - 非关联子查询不执行，父查询直接退出：coordinator进入退出流程后等待非子查询的stage都退出后，通知子查询stage退出。


![](https://pingcode.yasdb.com/atlas/files/public/67396d778970c2af4f5212d6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1NTAsImV4cCI6MTc4MjMxOTM1MH0.LujQumm1zMcoV6P99MJLNcxa1wJCrU9YBbIF6eS--eM)

![](https://pingcode.yasdb.com/atlas/files/public/67396d778970c2af4f5212d7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1NTAsImV4cCI6MTc4MjMxOTM1MH0.LujQumm1zMcoV6P99MJLNcxa1wJCrU9YBbIF6eS--eM)

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

下列子查询流程组合是否按照预期执行：

1. 静态/非静态
1. plain/exists/any/all
1. 正常场景/数据量不对/父查询报错/子查询报错/interrupt/rescan/finish


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

## Attachments:

[subquery_proc.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzY4OTcwYzJhZjRmNTIxMmQ0IiwicmVmX2lkIjoiNjczOTZkNzY3MjgyMDZlZmI5MmYxZjQxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NTUwLCJleHAiOjE3ODIzOTQ5NTB9.sMjWWOkZD6pJswaYOhKaiVEIaIN2ktQv6mm--VUNRBQ)

 (image/png)    
