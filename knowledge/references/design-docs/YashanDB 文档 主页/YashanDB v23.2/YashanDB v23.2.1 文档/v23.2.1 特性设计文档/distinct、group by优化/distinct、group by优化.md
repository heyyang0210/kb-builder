Created by 吴昊旻, last modified by  徐千禧 on 一月 23, 2024

  


##   [1. Overview（概述）](#1-overview概述)  

1. distinct及group by需要键值序列做去重，键值数量可缩减来加快执行效率；
1. 缩减规则：
    1. 当键值序列出现在谓词中，且键值符合等价类规则时，键值数量可缩减；
    1. 当键值序列出现常量，但不全是常量时，常量可消除；
    1. 当键值序列全部为常量时，保留一个常量；
    1. 当去重列包含主键列和唯一键索引时，主键列已要求插入的数据非重复，返回的结果不会有重复值，可进行优化。
1. distinct及group by键值数量缩减规则相同，调用同一套核心算法代码；


##   [2. Features（功能特性）](#2-features功能特性)  

```
调研表结构
create table t1 (id int, age int, name int, c4 int, c5 int);
create table t2 (id int, age int, name int, c4 int, c5 int);
insert into t1 values(3,17,4,1,2);
insert into t1 values(4,17,4,1,2);
insert into t2 values(3,17,4,1,2);
insert into t2 values(4,17,4,1,2);
alter table t1 add constraint t1_pk PRIMARY KEY (id);
alter table t2 add constraint t2_pk PRIMARY KEY (id);
```

###   [2.1 Distinct](#21-distinct)  

|功能|设计表现|设计说明|
|---|---|---|
|select distinct id, age from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 661348366
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  TABLE ACCESS FULL             | T1                   | REGRESS    |         2|       13( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

9 rows fetched.
```|由于投影列中包含主键列，主键列要求不可插入重复值，因此返回结果集中所有列不可能有完全一样的数据。因此走distinct是没有必要的，可以直接将distinct进行消除，即只要投影列中存在主键列即可消除distinct。|
|select distinct 1,2, age from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 1929643080
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  SORT DISTINCT                 |                      |            |         1|       14( 0)|                                |
|  2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |         2|       13( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: ("T1"."AGE")

15 rows fetched.
```|去重列中的每一个常量都是等价的，返回的结果集行数是表中有重复值的列的行数。若去重列包含非常量列时，仅需对非常量列进行去重，若去重列全为常量时，仅需对其中一个常量进行去重，即能实现相同的效果|
|select distinct 1, 2, 3 from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 307083775
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  HASH DISTINCT                 |                      |            |         2|        8( 0)|                                |
|  2 |   INDEX FAST FULL SCAN         | IDX_R1               | REGRESS    |         2|        6( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: (1)

15 rows fetched.
```||
|select distinct 1, count(*) from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 559366132
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  AGGREGATE                     |                      |            |         1|        6( 0)|                                |
|  2 |   INDEX FAST FULL SCAN         | IDX_R1               | REGRESS    |         2|        6( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

10 rows fetched.
```|语句包含汇聚函数的时候，结果集仅会返回一条记录，因此不需要走distinct，可直接消除。|
|select distinct c4, c5 from t1 where c4 = c5;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 2718661906
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  SORT DISTINCT                 |                      |            |         1|       14( 0)|                                |
|* 2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |         1|       13( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: ("T1"."C4")
   2 - Predicate : filter("T1"."C4" = "T1"."C5")

16 rows fetched.
```|去重列中包含属于同一等价类的列，返回的结果数据均相同，对哪一列去重都是等价的，因此可以仅对相同等价类内的某一列进行去重。|
|select distinct c4, c5, age from t1 where c4 = c5;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 2718661906
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type | Name | Owner | Rows | Cost(%CPU) | Partition info |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| 0 | SELECT STATEMENT | | | | | |
|* 1 | SORT DISTINCT | | | 1| 14( 0)| |
|* 2 | TABLE ACCESS FULL | T1 | REGRESS | 1| 13( 0)| |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

1 - Distinct Expression: ("T1"."C4", "T1"."AGE")
2 - Predicate : filter("T1"."C4" = "T1"."C5")

16 rows fetched.
```||
|select distinct c3, random from t1;(包含内置函数）|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 2578245111
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  HASH DISTINCT                 |                      |            |      1000|      140( 0)|                                |
|  2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |    100000|      132( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: ("T1"."C3")

15 rows fetched.
```|random补的是相同的随机值，与一般const相同，因此可以当作一般常量处理|
|select distinct c3, to_char(1) from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 2684866600
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  HASH DISTINCT                 |                      |            |      1000|      140( 0)|                                |
|  2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |    100000|      132( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: ("T1"."C3")

15 rows fetched.
```|对于内置函数，采用isExprGeneralConst进行判断，对内置函数进行递归，即当内置函数内部是常量时才会当作常量类型进行处理|
|select distinct c3, to_char(c1) from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 1733889250
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  HASH DISTINCT                 |                      |            |      1000|      147( 0)|                                |
|  2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |    100000|      132( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: ("T1"."C3", TO_CHAR("T1"."C1"))

15 rows fetched.
```||
|select distinct 1 c1, 2 c2 from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 55782146
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  SORTED DISTINCT               |                      |            |      1000|       97( 0)|                                |
|  2 |   INDEX FAST FULL SCAN         | UK_T1_1              | REGRESS    |    100000|       92( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: (1)

15 rows fetched.
```|对于别名，打印的是实际的列名|
|select distinct c1 a, c2 b from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 2238970423
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  HASH DISTINCT                 |                      |            |      1000|      140( 0)|                                |
|  2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |    100000|      132( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: ("T1"."C2")

15 rows fetched.
```||
|select sum (distinct id) from t1;|```
explain select sum (distinct id) from t1;

PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 4053623050
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  AGGREGATE                     |                      |            |         1|      405( 0)|                                |
|  2 |   SORT                         |                      |            |    100000|      400( 0)|                                |
|  3 |    INDEX FAST FULL SCAN        | PK_T1                | REGRESS    |    100000|       92( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

11 rows fetched.
```|只有distinct没有groupby时，含有聚合函数就一定消除distinct，改成sort aggregate, 表现与Oracle保持一致。|
|select sum (distinct c1) from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 1811680774
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  AGGREGATE                     |                      |            |         1|      444( 0)|                                |
|  2 |   SORT                         |                      |            |    100000|      440( 0)|                                |
|  3 |    TABLE ACCESS FULL           | T1                   | REGRESS    |    100000|      132( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

11 rows fetched.
```||
|select distinct (sum(c3)) from t1;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 1811680774
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  AGGREGATE                     |                      |            |         1|      444( 0)|                                |
|  2 |   SORT                         |                      |            |    100000|      440( 0)|                                |
|  3 |    TABLE ACCESS FULL           | T1                   | REGRESS    |    100000|      132( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

11 rows fetched.
```||
|select distinct (sum(c3)) from t1 group by c3;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 4016183199
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  SORT DISTINCT                 |                      |            |      1000|      143( 0)|                                |
|* 2 |   HASH GROUP                   |                      |            |      1000|      142( 0)|                                |
|  3 |    TABLE ACCESS FULL           | T1                   | REGRESS    |    100000|      132( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Distinct Expression: (SUM("T1"."C3"))
   2 - Group Expression: ("T1"."C3")

17 rows fetched.
```|groupby和distinct同时存在时暂时不做优化|


###   [2.2 Group By](#22-group-by)  

|功能|设计表现|设计说明|
|---|---|---|
|select name from t1 group by name,2;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 2747859402
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  HASH GROUP                    |                      |            |      1000|      140( 0)|                                |
|  2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |    100000|      133( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Group Expression: ("T1"."NAME")

15 rows fetched.
```|分组列中的每一个常量都是等价的，若分组列包含非常量列时，仅需对非常量列进行去重，若去重列全为常量时，仅需对其中一个常量进行分组，即能实现相同的效果。    
    
|
|select 1,2+3 from t1 group by 1,2+3;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 176559332
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  GROUP                         |                      |            |      1000|       94( 0)|                                |
|  2 |   INDEX FAST FULL SCAN         | T1_PK                | REGRESS    |    100000|       92( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Group Expression: (5)

15 rows fetched.
```||
|select c4, c5 from t1 group by c4, c5 having c4=c5;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 113649833
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  HASH GROUP                    |                      |            |         1|       14( 0)|                                |
|* 2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |         1|       13( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Group Expression: ("T1"."C4")
   2 - Predicate : filter("T1"."C4" = "T1"."C5")

16 rows fetched.
```|分组列中包含属于同一等价类的列，返回的结果数据均相同，对哪一列分组都是等价的，因此可以仅对相同等价类内的某一列进行分组。|
|select c4, c5 from t1 group by c4, c5, age having c4=c5;|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 3024792936
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|* 1 |  HASH GROUP                    |                      |            |         1|       14( 0)|                                |
|* 2 |   TABLE ACCESS FULL            | T1                   | REGRESS    |         1|       13( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Group Expression: ("T1"."C4", "T1"."AGE")
   2 - Predicate : filter("T1"."C4" = "T1"."C5")

16 rows fetched.
```||


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
[LOGIOPTMZDISTGROUPBY] = {.transformCfg = NULL, .transform = tryOptmzRsColsByFD}
CodResult tryOptmzRsColsByFD(TransContext* transCtx, CboGroupExpr* srcGExpr, CboMemo* cboMemo, CboGroupExpr** dstGExpr)
static CodResult tryRemoveRepeatRsCols(ObjectArray* computeExprs)
static CodResult tryOptmzRsColsByIndex(FuncDeps* funcDeps, CodUint32 dsId, ObjectArray* computeExprs)
static CodResult tryOptmzRsColsByEq(MemoryContext* mctx, FuncDeps* funcDeps, ObjectArray* computeExprs)
static CodResult tryOptmzRsColsByConst(ObjectArray* computeExprs)

static CodResult explainDistGroupBy(AnlStmt* stmt, const ExplainAnnex* annex, Variant* value, CodBool* isSent)
static CodResult explainPushDistGroupBy(AnlStmt* stmt, ObjectArray* computeExprs, CodUint16 planId, ExplainAnnexType type)

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 规格](#41-规格)  

- 提取所有表的主键索引，消除无效的去重/分组列，消除distinct
- 消除去重/分组列中属于相同主键类的列
- 消除去重列中的常量
- 仅有distinct没有group by的时候，去重列包含汇聚函数消除distinct，直接走aggr
- 执行计划中打印去重有效列信息
- 1.把常量优化规则从tryOptmzRsCols中拿出来，做单独一个函数    
  2.等价类优化之后，要进行替换，即a,b from t1 where a=2 and b=2的时候，distinct expression会打印成 distinct expression（2）    
  3.等价类优化之后再做常量消除，如果a,b,'a' from t1 where a=2 and b=2的时候，等价类会替换成a=2,'a'，即为全常量的场景，再进一步做常量消除    
  4.移到trans阶段去做，将上述所有逻辑全部移到trans_unique和trans_group阶段去调用，消除和优化都挪（消除怎么挪没有想法，直接return COD_SUCCESS？）全常量的话走sorted distinct    
  并且加一个排序（这个排序是把distinct值大的放在前面，要用到统计信息，那就是还调用cost接口？）    
  6.distinctplan里的sortExpr执行改，我这边需要改动嘛？
- 7.列存打印


###   [4.2 约束](#42-约束)  

- 当前版本不支持多表场景下的distinct消除，对于多表的情况，统计信息会记录是否为唯一行，即主键特征，来确定是否需要消除distinct
- 当前版本不支持无not null约束的唯一键索引的distinct消除
- 当前版本不支持groupby主键消除
- groupingSet不优化，原因是优化不到groupId
- 同时存在distinct和groupby的时候，当分组列为去重列的子集时，消除distinct，保留groupby（都有去重作用）
- 当返回结果只有一条时（通过cbo_stats中max_row判断)，消除distinct。
- 规则4、5可以放在trans_unique阶段做，入口函数为isUniqueRemovable


  


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

- 该设计在transform阶段进行优化，放在distinct和groupby的逻辑转物理op之前；
- 该设计主要是利用在groupByExprs结构体中新加一个数组computeExprs，来保存distinct中的有效去重列和group by的有效分组列；
- 考虑到子查询的场景，需要将当前查询的所有投影列投影出去，不能删除groupByExprs.groupExprs上的内容。因此该设计是对groupByExprs.groupExprs上深复制到groupByExprs.computeExprs上，对无效列进行删减。原先的validCount由groupByExprs.computeExprs.count替换。


###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c0a8970c2af4f5208d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUVBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg3MjUsImV4cCI6MTc4MjMwOTUyNX0.BhVGC3Z_mcAi7-m1VsL1RMbLYGUyOteQIyorvOVLGl8)

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

```
typedef struct StGroupByExprs {
    ObjectArray* groupExprs; // Expr is stored in this
    ObjectArray* computeExprs;
    CodUint32    validCount;
    CodBool      isExpr;
    CodUint8     unused[3];
} GroupByExprs;

typedef struct StOpLogiGroup {
    OP_HEAD

    union {
        GroupByExprs* groupByExprs;
        GroupingSets* sets;
    };
    AggrDesc        aggrDesc;
    Filter*         havingFilter;
    AnlTableBitmap* tabBitmap;
    CodBool         isPushedDown;     // group has been pushed down
    CodBool         isTrsfFromGroup;  // the group is generated by upper group pushing down.
    CodBool         needNvl;
    CodUint8        logiGroupType;
    CodUint8        unused[1];
} OpLogiGroup;

typedef struct StOpLogiDistinct {
    OP_HEAD

    GroupByExprs* groupByExprs;
} OpLogiDistinct;

typedef struct StOpPhysGroup {
    OP_HEAD

    union {
        GroupByExprs* groupByExprs;
        GroupingSets* sets;
    };
    AggrDesc* aggrDesc;
    Filter*   havingFilter;
    CodUint32 topN;
    CodUint8  type;
    CodBool   isPushedDown;     // group has been pushed down
    CodBool   isTrsfFromGroup;  // the group is generated by upper group pushing down.
    CodBool   needNvl;
    CodUint8  unused[5];
} OpPhysGroup;

typedef struct StOpPhysUnique {
    OP_HEAD

    GroupByExprs* groupByExprs;
    SortDesc*     sort;
    CodUint32     topN;
    MatId         matId;
    CodUint8      type;
    CodUint8      unused[2];
} OpPhysUnique;

typedef enum EnExplainAnnexType {
    EXPN_PROJ_VARS,
    EXPN_PREDICATE_FILTER,
    EXPN_PREDICATE_INDEX,
    EXPN_PREDICATE_AC,
    EXPN_PREDICATE_HASH,
    EXPN_PREDICATE_MERGE,
    EXPN_PREDICATE_RANGESET,
    EXPN_PREDICATE_SPATIAL_INDEX,
    EXPN_EXECUTION,
    EXPN_COLUMN_RUNTIME_FILTER,
    EXPN_ROW_RUNTIME_FILTER,
    EXPN_WINDOW_DECL,
    EXPN_WINDOW,
    EXPN_GROUP_BY_EXPRS,
    EXPN_DISTINCT_EXPRS,
    EXPN_HASH_KEYS,
    EXPN_PX_REMOTE_INFO,
    EXPN_PX_LOCAL_INFO,
} ExplainAnnexType;

typedef struct StDistinctPlan {
    ObjectArray* columns;
    AnlPlan*     child;
    ObjectArray* rsCols;
    ObjectArray* computeExprs;
    CodUint32    validCount;
    List*        sortExprs;
    MatDecl*     matDecl;
    CodUint32    topN;
    CodUint16    resId;
    CodUint8     type;
    CodUint8     reserved;
} DistinctPlan;

typedef struct StGroupByPlan {
    ObjectArray*  rsCols;
    AnlPlan*      child;
    ObjectArray*  aggrExprs;
    GroupingSets* groupingSets;
    List*         groupExprs;
    GrpctContext* grpctContext;
    Filter*       havingFilter;
    MatDecl*      matDecl;
    CodUint32     topN;
    ObjectArray*  computeExprs;
    CodUint32    validCount;
    AggrMode      mode;
    CodUint16     resId;
    CodBool       hasAggr;
    CodBool       isValueInline;
    CodBool       aggrPending;
    CodUint8      unused[7];
} GroupByPlan;

```

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

将groupbyOp和distinctOp中的columns和validCount都改成groupByExprs, 用来兼容groupingSet

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. distinct/group by包含主键列的场景
1. distinct/group by包含汇聚函数的场景
1. distinct/group by包含多个等价类的场景
1. distinct/group by包含常量的场景，各个类型的常量（sysvar/param/const/datatype/ref/function?）
1. 多表场景下distinct/group by包含常量/等价类的场景


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments:

[image2023-11-15_10-38-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDlhMWFkOWEzMzExZGM4NzNlIiwicmVmX2lkIjoiNjczOTZjMDk3MjgyMDZlZmI5MmYwY2M4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzI1LCJleHAiOjE3ODIzODUxMjV9.nNRVgEF3f95Zf_wEltT6nS0P1PwseA-sq4dYrZVRp8E)

 (image/png)    


[image2023-10-26_14-19-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDlhMWFkOWEzMzExZGM4NzNmIiwicmVmX2lkIjoiNjczOTZjMDk3MjgyMDZlZmI5MmYwY2M4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzI1LCJleHAiOjE3ODIzODUxMjV9.PVrQWBh1u6RlYISLe6Z2H9vc8Kscok9TQOHvWYq072A)

 (image/png)    


[image2023-10-26_12-0-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGFhMWFkOWEzMzExZGM4NzQxIiwicmVmX2lkIjoiNjczOTZjMDk3MjgyMDZlZmI5MmYwY2M4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzI1LCJleHAiOjE3ODIzODUxMjV9.YXaBciAdeseSCYsAam-2FJnbSOVGVCspibryeNDq2UE)

 (image/png)    
