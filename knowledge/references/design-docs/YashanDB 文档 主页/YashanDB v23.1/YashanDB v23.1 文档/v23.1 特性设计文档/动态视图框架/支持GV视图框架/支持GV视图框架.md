Created by 谭思宇, last modified by  许中立 on 一月 30, 2024

  [YDBRD-15211](https://jira.yasdb.com/browse/YDBRD-15211?src=confmacro)    -  支持GV视图框架  完成

##   [1. Overview（概述）](#1-overview概述)  

优化器在集群global_view查询场景下生成PX相关算子。

##   [2. Features（功能特性）](#2-features功能特性)  

本次更新后不同的系统视图在不同部署环境下的表现

|部署场景|v$|dv$|gv$|x$|
|---|---|---|---|---|
|单机|正常输出|仅用于分布式|正常输出|非sys用户无法查询|
|分布式|仅输出CN数据|查询所有节点数据|无法查询|非sys用户无法查询，仅输出CN数据|
|集群|仅输出客户端连接节点数据|无法查询|输出当前集群所有活节点数据|非sys用户无法查询，仅输出当前节点数据|


###   [2.1 X$](#21-x)  

本次架构更新增加了X$系统表，内部类型为fixed_table，该类型系统表仅有sys用户可以直接访问，其余用户都需要通过v$进行访问。

新增以下四个X$系统表：

- X$INSTANCE


```
SQL&gt; desc x$instance;
NAME                                                             NULL?     DATATYPE
---------------------------------------------------------------- --------- ---------------------------------
PHASE                                                                      INTEGER
VERSION                                                                    VARCHAR(64)
STARTUP_TIME                                                               TIMESTAMP
HOST_NAME                                                                  VARCHAR(256)
DATA_HOME                                                                  VARCHAR(256)
INSTANCE_NUMBER                                                            INTEGER
INSTANCE_NAME                                                              VARCHAR(64)
PARALLEL                                                                   BOOLEAN


```

- X$FIXED_TABLE


```
SQL&gt; desc x$fixed_table;
NAME                                                             NULL?     DATATYPE
---------------------------------------------------------------- --------- ---------------------------------
IDX                                                                        INTEGER
FT_NAME                                                                    VARCHAR(64)
FT_VERSION                                                                 INTEGER


```

- X$FIXED_VIEW


```
SQL&gt; desc x$fixed_view;
NAME                                                             NULL?     DATATYPE
---------------------------------------------------------------- --------- ---------------------------------
IDX                                                                        INTEGER
FV_NAME                                                                    VARCHAR(64)
FV_VERSION                                                                 INTEGER
FV_TEXT                                                                    VARCHAR(1000)


```

- X$AXCTOPO


```
SQL&gt; desc x$axctopo;
NAME                                                             NULL?     DATATYPE
---------------------------------------------------------------- --------- ---------------------------------
ID                                                                         INTEGER
MASTER                                                                     INTEGER
INSTMAP                                                                    BIGINT
VERSION                                                                    INTEGER
ROLE                                                                       VARCHAR(64)

```

###   [2.2 GV$](#22-gv)  

本次需求新增3个GV$视图gv$instance, gv$fixed_table, gv$fixed_view_definition，这些视图在分布式下无法查询，在单机下查询结果与查询对应的V$结果一致。

在集群下查询这些视图时将会汇聚所有活着节点的数据到当前连接节点中。

###   [2.3 集群节点间通信](#23-集群节点间通信)  

由于集群下查询gv$视图需要将所有的节点的信息全部汇聚到当前客户端连接的节点上，因此需要执行实现集群下的节点数据交互，当前方案为复用PX及ICS框架。

###   [2.4 视图权限](#24-视图权限)  

新增角色

##   [3. Detail Design（详细设计）](#3-detail-design详细设计)  

- verify部分：gv$在查询时通过标记位标明用户输入时需要查询global
- rewrite部分：gv$在rewrite阶段不进行viewScan上提，保留viewScan
- plan阶段：对gv$的viewScan上增加PX与pxcoord


##   [5. Compatibility（兼容性）](#5-compatibility兼容性)  

本次架构迁移了原有V$INSTANCE的实现，不应影响到任何原有的单机或分布式视图（即原有的v$与dv$）。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

计划示例如下

```
-- 集群部署，三节点
SQL&gt; explain select * from gv$instance;

PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 3541734265
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  CLUSTER COORDINATOR           |                      |            |          |             |                                |
|  2 |   PX N2I REMOTE                | QUEUE_0              |            |10000000000|  1255184( 0)|                                |
|  3 |    VIEW                        |                      |            |10000000000|  1255184( 0)|                                |
|  4 |     NESTED LOOPS INNER         |                      |            |10000000000|   717984( 0)|                                |
|  5 |      TABLE ACCESS FULL         | X$INSTANCE           | SYS        |    100000|      442( 0)|                                |
|  6 |      TABLE ACCESS FULL         | X$AXCTOPO            | SYS        |    100000|      442( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   2 - PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [0][1][2]-&gt;[0])

19 rows fetched.


-- 双gv视图join
SQL&gt; explain select * from gv$instance I, gv$fixed_table F where f.inst_id = I.inst_id;

PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 3803283265
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  CLUSTER COORDINATOR           |                      |            |          |             |                                |
|* 2 |   HASH JOIN INNER              |                      |            |20000000000| 20807888( 0)|                                |
|  3 |    PX N2I REMOTE               | QUEUE_0              |            |10000000000|  1255184( 0)|                                |
|  4 |     VIEW                       |                      |            |10000000000|  1255184( 0)|                                |
|  5 |      NESTED LOOPS INNER        |                      |            |10000000000|   717984( 0)|                                |
|  6 |       TABLE ACCESS FULL        | X$INSTANCE           | SYS        |    100000|      442( 0)|                                |
|  7 |       TABLE ACCESS FULL        | X$AXCTOPO            | SYS        |    100000|      442( 0)|                                |
|  8 |    PX N2I REMOTE               | QUEUE_1              |            |    200000|      900( 0)|                                |
|  9 |     VIEW                       |                      |            |    200000|      900( 0)|                                |
| 10 |      UNION ALL                 |                      |            |    200000|      889( 0)|                                |
| 11 |       TABLE ACCESS FULL        | X$FIXED_TABLE        | SYS        |    100000|      442( 0)|                                |
| 12 |       TABLE ACCESS FULL        | X$FIXED_VIEW         | SYS        |    100000|      442( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   2 - Predicate : access("I"."INST_ID" = "F"."INST_ID")
   3 - PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [0][1][2]-&gt;[0])
   8 - PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [0][1][2]-&gt;[0])

27 rows fetched.

-- 与非gv视图join
SQL&gt; explain select * from x$instance I join (select * from gv$instance) f on f.inst_id = I.instance_number;

PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 4078150775
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  CLUSTER COORDINATOR           |                      |            |          |             |                                |
|* 2 |   HASH JOIN INNER              |                      |            |10000000000| 20806452( 0)|                                |
|  3 |    PX N2I REMOTE               | QUEUE_0              |            |10000000000|  1255184( 0)|                                |
|  4 |     VIEW                       |                      |            |10000000000|  1255184( 0)|                                |
|  5 |      NESTED LOOPS INNER        |                      |            |10000000000|   717984( 0)|                                |
|  6 |       TABLE ACCESS FULL        | X$INSTANCE           | SYS        |    100000|      442( 0)|                                |
|  7 |       TABLE ACCESS FULL        | X$AXCTOPO            | SYS        |    100000|      442( 0)|                                |
|  8 |    TABLE ACCESS FULL           | X$INSTANCE           | SYS        |    100000|      442( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   2 - Predicate : access("GV$INSTANCE"."INST_ID" = CAST("I"."INSTANCE_NUMBER" AS NUMBER))
   3 - PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [0][1][2]-&gt;[0])

22 rows fetched.



```

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*