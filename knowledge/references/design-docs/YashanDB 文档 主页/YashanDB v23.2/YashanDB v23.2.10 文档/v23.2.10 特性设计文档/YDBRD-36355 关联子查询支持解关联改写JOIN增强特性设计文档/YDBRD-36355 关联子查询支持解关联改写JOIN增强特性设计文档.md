SR链接：  [https://pingcode.yasdb.com/pjm/items/6757ee1b64bf51159814db7b?](https://pingcode.yasdb.com/pjm/items/6757ee1b64bf51159814db7b?)  

#YDBRD-36355 关联子查询支持解关联改写JOIN增强



前置需求文档：  [子查询展开文档](https://pingcode.yasdb.com/wiki/pages/67396c7e593f99c9ff236f1b)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

深燃

###   [1.2 调研文档](#12-调研文档)  

前置需求文档：  [子查询展开文档](https://pingcode.yasdb.com/wiki/pages/67396c7e593f99c9ff236f1b)  

###   [1.3 需求分析](#13-需求分析)  

根据子查询出现位置进行解关联：

1. filter中，whereFilter，havingFilter，connectByFilter，rownumFilter...

2. 投影列

3. joinOn

4. 表函数

5. limit子句



原始逻辑：

如果上面这些场景中子查询中含有ref，全部不能解关联(即底层不能解，上层也不解)。

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

现在规则：（工单的场景为场景1）

场景1. whereFilter中出现的外部引用只与父亲关联，则可以将爷爷和父亲解关联，例如：

```
explain select * from  table1 t1 where exists (
												select * from  table1   t2 where t1.col1 = t2.col1 and not exists (
																													select * from  table2  t3 where t2.col1 = 1 ));
```

改写后计划为：

```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 877691526
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  SUBQUERY                      | QUERY[1]             |            |          |             |                                |
|* 2 |   RESULT                       |                      |            |         1|        1( 0)|                                |
|  3 |    TABLE ACCESS FULL           | TABLE2               | SYS        |         1|        1( 0)|                                |
|* 4 |  HASH JOIN SEMI                |                      |            |         1|        3( 0)|                                |
|  5 |   TABLE ACCESS FULL            | TABLE1               | SYS        |         1|        1( 0)|                                |
|  6 |   VIEW                         |                      |            |         1|        1( 0)|                                |
|* 7 |    TABLE ACCESS FULL           | TABLE1               | SYS        |         1|        1( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   2 - Predicate : filter("T2"."COL1" = 1)
   4 - Predicate : access("T1"."COL1" = "T2"."COL1")
   7 - Predicate : filter(NOT EXISTS QUERY[1])

22 rows fetched.
```

场景2. 投影列中出现的关联子查询中外部引用只与父亲关联，则可以将爷爷和父亲解关联，例如：

```
explain select c01 from tb_ydbrd21590_001  where c02 not in (
													select decrypt_aes128(encrypt_aes128((select c03 from tb_ydbrd21590_001 order by c3 limit 1),'133'),'133') from tb_ydbrd21590_10 );
```

改写后计划为：

```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 928412360
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  SUBQUERY                      | QUERY[1]             |            |          |             |                                |
|  2 |   WINDOW                       |                      |            |         1|      125( 0)|                                |
|  3 |    TABLE ACCESS FULL           | TB_YDBRD21590_001    | SYS        |    100000|      125( 0)|                                |
|* 4 |  HASH JOIN RIGHT ANTI NA       |                      |            |     99900|    15432( 0)|                                |
|  5 |   VIEW                         |                      |            |    100000|    14280( 0)|                                |
|  6 |    PART SCAN ALL               |                      |            |    100000|      125( 0)| [0,1]                          |
|  7 |     PART SCAN ALL              |                      |            |    100000|      125( 0)| [0,5]                          |
|  8 |      TABLE ACCESS FULL         | TB_YDBRD21590_10     | SYS        |    100000|      125( 0)|                                |
|  9 |   TABLE ACCESS FULL            | TB_YDBRD21590_001    | SYS        |    100000|      125( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   1 - Subquery NDV info - NDV percentage: 0.010000, NDV Expression: ("TB_YDBRD21590_10"."C3")
   2 - Limit Expression: (LIMIT: 1)
   4 - Predicate : access(DECRYPT_AES128(ENCRYPT_AES128(QUERY[1], '133'), '133') = "TB_YDBRD21590_001"."C02")

24 rows fetched.
```



