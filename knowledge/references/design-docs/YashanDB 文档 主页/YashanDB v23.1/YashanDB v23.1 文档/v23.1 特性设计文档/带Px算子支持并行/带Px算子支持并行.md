Created by 林博 on 四月 13, 2023

IR链接：    [YDBRD-4698](https://jira.yasdb.com/browse/YDBRD-4698)     / SR链接：    [YDBRD-8127](https://jira.yasdb.com/browse/YDBRD-8127)  

##   [1. Overview（概述）](#1-overview概述)  

本设计方案是分布式TPCH调优的一个优化点。

##   [2. Features（功能特性）](#2-features功能特性)  

在分布式场景下，支持带Px的算子也可以并行，包括HashJoin/HashGroup等，也就是这些算子的子节点包含了Px，也可以并行。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

- 计划侧：在Px算子之上添加Px I2N Local算子；
- 执行侧：添加Hash Redistribute/Broadcast/Random三种分发的I2N实现；


示例：

- 数据


```
drop table if exists test_parallel;
drop table if exists test_parallel_02;
create table test_parallel(c1 int,c2 boolean,c3 number(5,2)) organization tac;
create table test_parallel_02(c1 int,c2 boolean,c3 number(5,2)) organization tac;
insert into test_parallel values (-101,1,1);
insert into test_parallel values (-100,1,-98);
insert into test_parallel values (101,0,100);
insert into test_parallel values (102,0,100);
insert into test_parallel_02 values (-101,1,1);
insert into test_parallel_02 values (-100,1,-98);
insert into test_parallel_02 values (101,0,100);
insert into test_parallel_02 values (102,0,100);
commit;                                     

```

- 修改前：


```
-- alter session set DEGREE_OF_PARALLEL = 8;
SQL&gt; explain select count(t1.c1) from test_parallel t1 join test_parallel_02 t2 on t1.c2 = t2.c2;

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 721947925                                       
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
|  2 |   COL TO ROW                   |                      |            |          |             |                                |
|  3 |    AGGREGATE                   |                      |            |         1|     1853( 0)|                                |
|  4 |     PX N2I REMOTE              | QUEUE_0              |            |    100000|     1848( 0)|                                |
|* 5 |      HASH JOIN INNER           |                      |            |    100000|     1508( 0)|                                |
|* 6 |       PX N2N REMOTE            | QUEUE_1              |            |    100000|      558( 0)|                                |
|  7 |        PX COORDINATOR          |                      |            |          |             |                                |
|  8 |         PX N2I LOCAL           | QUEUE_2              |            |    100000|      394( 0)|                                |
|  9 |          PX BLOCK ITERATOR RANDOM| DEGREE_8             |            |    100000|       55( 0)|                                |
| 10 |           TABLE ACCESS FULL    | TEST_PARALLEL        | SYS        |    100000|       55( 0)|                                |
|*11 |       PX N2N REMOTE            | QUEUE_3              |            |    100000|      558( 0)|                                |
| 12 |        PX COORDINATOR          |                      |            |          |             |                                |
| 13 |         PX N2I LOCAL           | QUEUE_4              |            |    100000|      394( 0)|                                |
| 14 |          PX BLOCK ITERATOR RANDOM| DEGREE_8             |            |    100000|       55( 0)|                                |
| 15 |           TABLE ACCESS FULL    | TEST_PARALLEL_02     | SYS        |    100000|       55( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+


```

- 修改后：


```
SQL&gt; explain select count(t1.c1) from test_parallel t1 join test_parallel_02 t2 on t1.c2 = t2.c2;

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 721947925                                       
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  DISTRIBUTED COORDINATOR       |                      |            |          |             |                                |
|  2 |   COL TO ROW                   |                      |            |          |             |                                |
|  3 |    AGGREGATE                   |                      |            |         1|     1170( 0)|                                |
|  4 |     PX N2I REMOTE              | QUEUE_0              |            |         1|     1170( 0)|                                |
|  5 |      AGGREGATE                 |                      |            |         1|     1170( 0)|                                |
|  6 |       PX COORDINATOR           |                      |            |          |             |                                |
|  7 |        PX N2I LOCAL            | QUEUE_1              |            |         1|     1170( 0)|                                |
|  8 |         AGGREGATE              |                      |            |         1|     1170( 0)|                                |
|* 9 |          HASH JOIN INNER       |                      |            |    100000|     1170( 0)|                                |
|*10 |           PX I2N LOCAL         | QUEUE_2              |            |    100000|      560( 0)|                                |
|*11 |            PX N2N REMOTE       | QUEUE_3              |            |    100000|      558( 0)|                                |
| 12 |             PX COORDINATOR     |                      |            |          |             |                                |
| 13 |              PX N2I LOCAL      | QUEUE_4              |            |    100000|      394( 0)|                                |
| 14 |               PX BLOCK ITERATOR RANDOM| DEGREE_8             |            |    100000|       55( 0)|                                |
| 15 |                TABLE ACCESS FULL| TEST_PARALLEL        | SYS        |    100000|       55( 0)|                                |
|*16 |           PX I2N LOCAL         | QUEUE_5              |            |    100000|      560( 0)|                                |
|*17 |            PX N2N REMOTE       | QUEUE_6              |            |    100000|      558( 0)|                                |
| 18 |             PX COORDINATOR     |                      |            |          |             |                                |
| 19 |              PX N2I LOCAL      | QUEUE_7              |            |    100000|      394( 0)|                                |
| 20 |               PX BLOCK ITERATOR RANDOM| DEGREE_8             |            |    100000|       55( 0)|                                |
| 21 |                TABLE ACCESS FULL| TEST_PARALLEL_02     | SYS        |    100000|       55( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+


```

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

- 在transform Px Receiver的时候判断是否是I2N：


```
// local Px Receiver 
self.degree() &gt; 1 &amp;&amp; child.degree() == 1

```

- I2N分发算子在bind的时候child只bind一次：


```
if self.one2n {
    // Only need to bind child one times.
    if id == 0 {
        let child = self.child.bind(&amp;new_context)?;
        runtime_context.set_child(child);
    }
	// ...
}

```

- I2N分发算子在执行时，由第一个拿到child的线程执行child：


```
if !self.init {
    if let Some(child) = self.runtime_context.get_child() {
        self.child = Some(child);
    }
    self.init = true;
}

```

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

  
