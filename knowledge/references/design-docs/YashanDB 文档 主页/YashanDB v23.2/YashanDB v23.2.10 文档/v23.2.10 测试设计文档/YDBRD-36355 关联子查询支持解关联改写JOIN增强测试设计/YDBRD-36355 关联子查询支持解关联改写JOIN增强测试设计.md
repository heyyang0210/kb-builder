#   
﻿  [ 1. 概述 ](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  ﻿

本文描述关联子查询解关联规格增强测试设计

﻿  




SR链接:  [   ](https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?)  ﻿

﻿     [https://pingcode.yasdb.com/pjm/items/6757ee1b64bf51159814db7b?](https://pingcode.yasdb.com/pjm/items/6757ee1b64bf51159814db7b?)  

#YDBRD-36355 关联子查询支持解关联改写JOIN增强

开发设计文档：  [(2237) 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/pages/67650c5fa03b8234860b88b9)  

﻿

# ﻿  [ 2. 需求分析 ](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  ﻿

**需求分析：**

根据子查询出现位置进行解关联：

1. filter中，whereFilter，havingFilter，connectByFilter，rownumFilter...

2. 投影列

3. joinOn

4. 表函数

5. limit子句



原始逻辑：

如果上面这些场景中子查询中含有ref，全部不能解关联(即底层不能解，上层也不解)。

  
  **规格约束：**

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



﻿  


# 3.测试设计

## 3.1 测试设计方法

 使用等价类划分法和场景法进行测试用例设计  
﻿

## 3.2 详细测试设计

 3.2.1 详细功能用例测试点

﻿  


|测试点|预期|备注||
|---|---|---|---|
|3层嵌套in子查询，子查询where条件只和父查询关联|支持，爷爷和父亲会解关联|||
|3层嵌套in子查询，子查询只和父查询关联，关联位置是投影列|支持，爷爷和父亲会解关联|||
|3层嵌套子查询，in not/in ,exists,not/exists 组合，子查询只和父查询关联|支持，爷爷和父亲会解关联|||
|3层嵌套子查询，子查询和父查询关联，加和祖父查询关联|支持解关联为join|||
|投影列中出现的关联子查询中外部引用只与父亲关联,4层嵌套|支持|||
|where条件中出现的关联子查询只和父查询关联，4层嵌套|支持|||
|where条件中出现的关联子查询只和父查询关联，8层嵌套|支持|||
|not exists和其他组合，where条件是param compare cloumn|支持自底向上解关联|||
|not exists和其他组合，where条件不是param compare cloumn||||
|投影列中出现的关联子查询中外部引用只与父亲关联|可以将爷爷和父亲解关联|||
|||||




﻿

3.2.2 dfx功能涉及情况说明

﻿



||||
|---|---|---|
|测试项|是否涉及|测试点|
|CT/KT|是|  
CT |
|长稳|-|﻿|
|一致性|-|﻿|
|安全|-|﻿|
|HA|-|﻿|
|压力|-|﻿|
|性能|是|测试解关联后不解关联相同SQL耗时对比|
|资料|否|﻿  
|


﻿

﻿

﻿

# 4. 测试用例

﻿

# 5. 测试框架设计

- 采用guider测试框架进行用例自动化


# 6. 测试环境说明

﻿





|||
|---|---|
|服务器|﻿|
|操作系统|Linux|
|部署|单机 |


﻿

# 7. 工作量评估

工作量：1人/周

计划测试完成时间：2025/2/13

﻿

﻿  


会议纪要：

性能：测试解关联后不解关联相同SQL耗时对比  
﻿

与会人员：李攀，陈关羽，赵育

会议时间 ：2025.12.20