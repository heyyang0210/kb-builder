Created by 吴昊旻, last modified on 十月 22, 2024

优化器优先支持or关联的子查询改join.。

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66d960c556ee364dc203dc15](https://pingcode.yasdb.com/pjm/items/66d960c556ee364dc203dc15)    *?*    
  *#YDBRD-32503 优化器支持or改为了集合操作（CONCATENATION）*    


##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#1-%E6%80%BB%E8%BF%B0)  

filter里带了or时，执行计划较差，通过改写为UNION之后将子查询改成join来实现

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

外场工单：    [[SAISSUE-479] SQL语句 where条件带or执行时间长 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/SAISSUE-479)  

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

/

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

场景慢的原因是子查询通过filter的方式来执行的，其执行成本为调用次数*子查询的执行成本。假设子查询的执行次数为m，子查询的执行时间和子查询的条数成比例，子查询的执行为n，则子查询filter的执行成本为：O(m*n)，优化思路为降低m*n的代价，比如：如果子查询转为Join，可以使用hash join的方式，则m * n 优化为：n建内存hash表的成本 + m* O（1）的hash表查找成本。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|where谓词中出现filterOr连接一般谓词加in/exists子查询|动态改写路径下，新增改写路径，将原语句改写成等价的集合操作之后，将集合操作中的子查询改join|是|是|
|功能|invertFilter|对filter嵌套一层lnnvl函数来实现filter翻转|是|是|
|性能|改写成join之后选上索引|  
|是|是|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#2-%E6%8E%A5%E5%8F%A3)  

```
CodResult txformScanFilterOr2Union(TransContext* transCtx, CboGroupExpr* srcGExpr, CboMemo* cboMemo,
                                   CboGroupExpr** dstGExpr)
```

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=163003183#id-谓词扩展-规格)  

A，filter改union的filter只能在表扫描上可以改，CTE，视图，from子查询等暂时不支持。join或者having filter上出现or，也不能更改。    
  B，filter中只能有一个or，or的一边是exists或者in子查询。另外一边是and或者in列表（not in暂时不支持，in列表可能有个数上限）或者比较操作符，其他的filter都暂时不支持。

C，由于copyOpTree中未对winFuncOp/CountOp/AggrOp/ConnectByOp做复制，因此在该需求中若exists/in子查询中出现上述op，暂时禁用改写。

D，分布式/列存/多表场景/DML语句禁用该改写

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#4-%E7%89%B9%E6%80%A7)  

1. 示例语句


|示例语句|原master表现|预期表现|
|---|---|---|
|,select * from cbo_rwrt_subq_t1 t1 where c2 in (1,2,3) or exists (select 1 from cbo_rwrt_subq_t2 t2 where t2.c4 = 3 and t2.c3 = t1.c1);,等价于,select * from (select * from cbo_rwrt_subq_t1  t1  where c2 in (1,2,3) union all (select * from cbo_rwrt_subq_t1 t1 where exists (select 1 from cbo_rwrt_subq_t2 t2 where t2.c4 = 3 and t2.c3 = t1.c1) and lnnvl(c2 in (1,2,3))));,集合操作的子查询中的filterExists再通过复用静态改写staticTransSubq2Join来实现转|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 1984175824
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  SUBQUERY                      | QUERY[1]             |            |          |             |                                |
|* 2 |   TABLE ACCESS BY INDEX ROWID  | CBO_RWRT_SUBQ_T2     | REGRESS    |         1|        1( 0)|                                |
|* 3 |    INDEX RANGE SCAN            | CBO_RWRT_SUBQ_T2_C3_INDEX| REGRESS    |         1|        1( 0)|                                |
|* 4 |  TABLE ACCESS FULL             | CBO_RWRT_SUBQ_T1     | REGRESS    |         3|        1( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   2 - Predicate : filter("T2"."C4" = 3)
   3 - Predicate : access("T2"."C3" = "T1"."C1")
   4 - Predicate : filter("T1"."C2" IN [1, 2, 3] OR EXISTS QUERY[1])

19 rows fetched.
```|```
PLAN_DESCRIPTION
----------------------------------------------------------------
SQL hash value: 1984175824
Optimizer: ADOPT_C

+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  VIEW                          |                      |            |         3|        1( 0)|                                |
|  2 |   UNION ALL                    |                      |            |         3|        1( 0)|                                |
|  3 |    TABLE ACCESS BY INDEX ROWID | CBO_RWRT_SUBQ_T1     | REGRESS    |         2|        1( 0)|                                |
|* 4 |     INDEX RANGE SCAN           | CBO_RWRT_SUBQ_T1_C2_INDEX| REGRESS    |         2|        1( 0)|                                |
|  5 |    NESTED INDEX LOOPS INNER    |                      |            |         1|        1( 0)|                                |
|  6 |     SORT DISTINCT              |                      |            |         1|        1( 0)|                                |
|  7 |      TABLE ACCESS BY INDEX ROWID| CBO_RWRT_SUBQ_T2     | REGRESS    |         1|        1( 0)|                                |
|* 8 |       INDEX RANGE SCAN         | CBO_RWRT_SUBQ_T2_C4_INDEX| REGRESS    |         1|        1( 0)|                                |
|* 9 |     TABLE ACCESS BY INDEX ROWID| CBO_RWRT_SUBQ_T1     | REGRESS    |         1|        1( 0)|                                |
|*10 |      INDEX RANGE SCAN          | CBO_RWRT_SUBQ_T1_C1_INDEX| REGRESS    |         1|        1( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+

Operation Information (identified by operation id):
---------------------------------------------------

   4 - Predicate : access("T1"."C2" IN (1, 2, 3))
   6 - Distinct Expression: ("T2"."C3")
   8 - Predicate : access("T2"."C4" = 3)
   9 - Predicate : filter(LNNVL("T1"."C2" = 1) BOOL AND LNNVL("T1"."C2" = 3) BOOL AND LNNVL("T1"."C2" = 2) BOOL)
  10 - Predicate : access("T1"."C1" = "T2"."C3")

27 rows fetched.
```|


  


###   [4.1 在transform中的改写逻辑](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

1. 对scan上的or谓词作分割，分为in/exists子查询谓词A和需要翻转的谓词B。
1. 对需要反转的谓词B嵌套Lnnvl函数，构造为新的谓词C。
1. 将谓词C和子查询谓词A用and combine。
1. 构造unionall，构造为(select * from table where B) union all (select * from table from A and C）
1. 由于改写union多创建了几个ds，所以需要对应将新的ds中的ref表达式做remap【例：上述示例语句中，原语句有2个ds，改写成集合操作之后有4个ds】
1. 调用静态改写中，子查询改join的流程，将exists/in子查询改join。
1. 将新改写的路径加入备选路径中，当新路径cost小于原路径时即选择。


  [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

## Attachments:

[image2024-9-27_9-46-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGM4OTcwYzJhZjRmNTIxNTg3IiwicmVmX2lkIjoiNjczOTZkZGI1OTNmOTljOWZmMjM4MDU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNDg1LCJleHAiOjE3ODIzOTg4ODV9.04NqsbyzShcFqBSrcVHD6dbirsmK0RgVeSE_C4WkC5E)

 (image/png)    
