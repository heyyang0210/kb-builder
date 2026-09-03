Created by 李嘉瑞, last modified on 十二月 13, 2023

*详细设计-YDBRD-23668 : Any Subquery Optimization Design（ Any子查询优化方案设计）*

* IR链接：*    [YDBRD-23377](https://jira.yasdb.com/browse/YDBRD-23377?src=confmacro)    *-*  *TPCDS优化-Any 查询优化*  *设计中*

*SR链接：*    [YDBRD-23668](https://jira.yasdb.com/browse/YDBRD-23668?src=confmacro)    *-*  *列存Any子查询优化*  *开发中*

##   [1. 总述](#1-总述)  

该方案主要针对于语句中使用了col=any(subquery)和col!=all(subquery)的场景进行优化（要求subquery为非关联子查询），当col中数据量较大且subquery较复杂（执行时间较长）时性能有明显提升。

**（该方案只考虑非关联子查询的场景，以下提到的any子查询均默认为非关联子查询）**

###   [1.1 需求来源](#11-需求来源)  

- 需求来源于TPC-DS中的query45，具体语句如下：
- (语句中的in子查询被改写为了any， in(subquery)   **<==>**   =any(subquery))


```
-- query 45
select  ca_zip, ca_city, sum(ws_sales_price)
from web_sales, customer, customer_address, date_dim, item
where ws_bill_customer_sk = c_customer_sk
  and c_current_addr_sk = ca_address_sk
  and ws_item_sk = i_item_sk
  and ( substr(ca_zip,1,5) in ('85669', '86197','88274','83405','86475', '85392', '85460', '80348', '81792')
    or
        i_item_id in (select i_item_id
                      from item
                      where i_item_sk in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29)
        )
    )
  and ws_sold_date_sk = d_date_sk
  and d_qoy = 2 and d_year = 2001
group by ca_zip, ca_city
order by ca_zip, ca_city
    limit 100;

```

###   [1.2 需求分析](#12-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|子查询结果正确|子功能1通过什么方案满足|是|是|
|性能|特定场景性能提升（col=any(subquery)/col!=any(subquery)）|该场景下关键性能指标通过什么方案满足|是|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|col = any(subquery)|返回满足any子查询的结果|----|是|
|col != all(subquery)|返回满足all子查询的结果|----|是|
|col in(subquery)|可能被改写为 col = any(subquery)|具体见explain|是|
|col not in(subquery)|可能被改写为 col != all(subquery)|具体见explain|是|


##   [3. 规格与约束](#3-规格与约束)  

- 只支持非关联子查询的性能优化
- 特殊场景下无性能优化，可能性能更差（具体场景如，子查询只执行一行或执行行数较少并且执行一次子查询很快）


##   [4. 特性](#4-特性)  

- any前只可使用比较运算符：=, !=, >, >=, <, <=。其中除=和!=以外的所有运算符的场景都可被改写为聚合+比较运算符，此方案不涉及，具体改写计划如下（只列举一个，其他类似）：


```
SQL&gt; explain select * from t1 where a &gt; any(select a from t2);

PLAN_DESCRIPTION                                                 
---------------------------------------------------------------- 
SQL hash value: 998067847                                       
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | Rows     | Cost(%CPU)  | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |             |                                |
|  1 |  RESULT                        | QUERY[1]             |            |          |             |                                |
|  2 |   AGGREGATE                    |                      |            |         1|      134( 0)|                                |
|  3 |    TABLE ACCESS FULL           | T2                   | REGRESS    |    100000|      132( 0)|                                |
|  4 |  COL TO ROW                    |                      |            |     33000|      276( 0)|                                |
|* 5 |   TABLE ACCESS FULL            | T1                   | REGRESS    |     33000|      276( 0)|                                |
+----+--------------------------------+----------------------+------------+----------+-------------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   1 - Projection: Tuple[0, 0][INTEGER]                         
   2 - Projection: MIN(Tuple[0, 0])[INTEGER]                    
   3 - Projection: Tuple[0, 0][INTEGER]                         
   4 - Projection: RemoteTable[1][INTEGER], RemoteTable[1][INTEGER], RemoteTable[1][INTEGER], RemoteTable[1][INTEGER]
   5 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][INTEGER], Tuple[0, 2][INTEGER], Tuple[0, 3][INTEGER]
       Predicate : filter(Tuple[0, 0] &gt; QUERY[1])

```

###   [4.1 特性设计](#41-特性设计)  

- 当前any子查询执行流程为：在子查询上面套一个过滤条件，将过滤的列设为参数，对于每行数据执行一次子查询。由于非关联子查询的结果不受子查询外部影响，其结果固定，没有必要多次重复执行。
- 优化方案如下：


```
- 首先判断场景（列执行transform阶段）：是否满足以下三个条件，只有满足条件才可以优化，否则使用原来的方式执行。
  1.子查询为非关联子查询
  2.子查询类型为any/all
  3.比较条件为=any或!=all
- 执行前准备（transform阶段）：原始流程any子查询会将被过滤的列映射为参数，如果上一步判断可以使用优化分支，则取消参数映射。
- 第一次执行（**evaluate阶段1**）：执行子查询，获取子查询的所有数据，计算hash值，将所有数据插入到hash set中。查看过滤数据是否在hash set中，即可知道过滤结果。
- 第二次执行：使用建立好的hash set，在hash set中查询被过滤数据，获取过滤结果。

```

- 使用hash set过滤数据


```
需要跳过invalid值和null值，所有的invalid值和null值都是不符合过滤条件的。
如果过滤条件是=any，那能在hash set中查询到被过滤数据，过滤结果即为true，过滤条件为!=all相反。

```

- **evaluate阶段1**  详细设计：


```
- 执行前准备：需要新增两个成员，Hashset和一个可以在内存和文件之间切换的数据存储结构（HashJoin中有类似定义valuesets）。
- 执行步骤1：获取一批子查询数据（一个columnset），将其插入到hash set中
- 执行步骤2：检查使用内存和分配配额，保证预留给hash set可以rebuild的内存
- 执行步骤3：如果配额不足，并且无可用配额。将所有的数据写文件，并且后续执行获取的数据（columnset）都写盘
- 执行步骤4：如果全部数据都已经写文件了，内存配额还是不够用，把hash set也写文件。
- 执行步骤5：重新从步骤1开始执行，直到子查询所有的数据都fetch完毕

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 无新增功能，当前用例已有覆盖
- 性能测试


##   [6.资料设计章节](#6资料设计章节)  

不涉及

##   [7.未来规划](#7未来规划)  

暂无

## Comments:

|  [](null)  ,Posted by lijiarui at 十二月 13, 2023 17:33|
|---|
|评审方案|Any子查询优化设计文档|
|与会人|李嘉瑞、黄靖东、  孟麟、周彬鑫|
|评审时间|2023/12/13 15:00-16:00|
|评审地点|25栋708会议室|
|评审纪要信息|- 对于all的场景，子查询结果中含null时，返回结果全为false，需要特殊处理
- 内存不足场景增加ut测试
|
|评审是否通过|通过|
|  [](null)  ,备注：crab内部算子可用最大配额计算方式如下,columnar_vm_buffer_size * columnarMaterial_percent * COLUMNAR_MAX_OPERATOR_MEM_PERCENT * 80% （单机）    
  columnar_vm_buffer_size * columnarMaterial_percent * COLUMNAR_MAX_OPERATOR_MEM_PERCENT * COLUMNAR_MAX_STAGE_MEM_PERCENT （分布式）,Posted by lijiarui at 十二月 13, 2023 17:34|


|评审方案|Any子查询优化设计文档|
|---|---|
|与会人|李嘉瑞、黄靖东、  孟麟、周彬鑫|
|评审时间|2023/12/13 15:00-16:00|
|评审地点|25栋708会议室|
|评审纪要信息|- 对于all的场景，子查询结果中含null时，返回结果全为false，需要特殊处理
- 内存不足场景增加ut测试
|
|评审是否通过|通过|
