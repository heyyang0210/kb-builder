Created by 刘晓旋, last modified on 十二月 12, 2023

IR链接：    [YDBRD-20447](https://jira.yasdb.com/browse/YDBRD-20447?src=confmacro)    -  支持hash Grouping和并行  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

- 该需求主要来源于 TPC-DS 中使用了 rollup 相关语法，需要支持 grouping 的执行，以及一些相关函数。
- hash grouping 主要功能类似于多个分组聚合数据的汇总,其语法主要包括   **grouping sets, rollup, cube**  ，需要实现的函数包括：  **grouping,grouping_id,group_id**  。
- grouping sets：其用法例如   **group by grouping sets(a,b)**  ，其相当于   **group by a 和 group by b 数据的集合**  （group by a 时 b 列填空，group by b 时 a 列填空，下同）。
- rollup：其用法例如   **group by rollup(a,b)**  ，其相当于   **group by a，b，group by a, group by null 的集合**  （group by null 实际上就是对所有数据不分组做聚合，分组列填空，使用 group by null 方便表示）。  **rollup(a,b)<=>grouping sets((a,b),a,null)**  .
- cube：其用法例如   **group by cube(a,b)**  ，其相当于   **group by a,b , group by a, group by b, group by null 的集合**  。  **cube(a,b)<=>grouping sets((a,b),a,b,null)**  .
- grouping 函数参考：    [https://conf.yasdb.com/display/YAS/Grouping+Grouping_Id+Group_Id+Analyse](https://conf.yasdb.com/display/YAS/Grouping+Grouping_Id+Group_Id+Analyse)  
- starrocks 官方 TPC-DS 语句：    [https://docs.starrocks.io/zh-cn/latest/benchmarking/tpc_ds_99_sql](https://docs.starrocks.io/zh-cn/latest/benchmarking/tpc_ds_99_sql)  


##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1、grouping sets、cube、rollup，计划走 hash grouping

2、函数   **grouping, grouping_id, group_id **  支持走 hash grouping

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

不涉及

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

主要应用于 AP 场景如 TPCDS

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

1. 测试数据包含重复数据、非重复数据、null
1. grouping 函数的参数是普通列/伪列/常量/表达式/null
1. grouping 函数与普通函数嵌套
1. grouping 函数与集合函数/窗口函数嵌套（非法报错）
1. grouping 聚合函数出现在任意位置（子查询投影、子查询 having 子句、父查询的 having 子句、集合的两边）
1. 投影列上包含多个聚合函数（grouping函数/其他聚合函数）
1. grouping 聚合函数与投影列有/无交集
1. grouping 函数中带 distinct
1. grouping 函数 + PLSQL（参数内是绑定参数，如 grouping(a+:1)、grouping(:1)）
1. grouping 函数 +  其他能绑定 select 的用法 （create ... select、insert ... select、create  materialized view ... select）
1. grouping 函数 + 临时表
1. grouping sets/cube/rollup 字段覆盖所有数据类型
1. grouping sets/cube/rollup 字段覆盖伪劣如：rowid、rownum、user
1. grouping sets/cube/rollup：有交集列（grouping sets((a,b),(a))）/无交集列（grouping sets((a,b),(c,d))）/ 完全相同（grouping sets((a,b),(a,b))）
1. grouping sets/cube/rollup：有/无 ()、有/无 null、有/无常量、有/无函数表达式或运算表达式
1. grouping sets/cube/rollup 有多个组 (如 > 1000 个)，如：grouping sets ((a), (b), (c,d), (e,f,g), (h), () ...)
1. grouping sets/cube/rollup 组合使用，grouping sets/cube/rollup 有/无公共列、完全相同，如：group by grouping sets((a,b), (c)), rollup((d, e), (f)), cube((a,b), (h)), rollup((a,b), (c)) ...
1. grouping sets/cube/rollup 与其他关键字组合，如：distinct、having、orderby 等
1. grouping sets/cube/rollup + 聚集函数 + 聚集函数中带 distinct
1. grouping sets/cube/rollup + 投影列覆盖各数据类型的列/常量/表达式/伪列/null
1. grouping sets/cube/rollup + 普通函数/聚集函数/窗口函数
1. grouping sets/cube/rollup + grouping 函数
1. grouping sets/cube/rollup 是子查询，出现在投影、from、filter 中
1. grouping sets/cube/rollup 在 View 视图内，View 出现在任意位置
1. grouping sets/cube/rollup + CTE
1. grouping sets/cube/rollup + 集合操作（带谓词下推），覆盖集合操作为子查询的场景，出现在投影、from、filter 中
1. grouping sets/cube/rollup + join（left/right/full/inner join/nestloop join/hash join/merge join），覆盖 join 作为子查询的场景
1. grouping sets/cube/rollup + join + 集合操作（构造复杂查询）
1. 分组后的记录数 < 分组前的记录数、分组后的记录数 = 分组前的记录数
1. grouping sets/cube/rollup + 索引约束/AC 约束
1. grouping sets/cube/rollup + 并行
1. grouping sets/cube/rollup + PLSQL (有表达式时可以传入绑定变量如： grouping sets ((a+:1),  (b || :2))
1. grouping sets/cube/rollup + 其他能绑定 select 的用法 （create ... select、insert ... select、create  materialized view ... select）
1. grouping sets/cube/rollup + 临时表
1. grouping sets/cube/rollup 的列是/否分区键，分区键：单个/多个
1. 分布式上 grouping sets/cube/rollup 的列是/否分布键，分布键：单个/多个
1. 分布式单CN/多CN、单DN/多DN
1. 分布式覆盖：分布表、复制表
1. 分布式分布表+并行、复制表+并行
1. grouping sets/cube/rollup 返回的记录数 > columnar_bulk_size
1. 以上场景 + 收集统计信息，执行结果的正确性
1. 访问计划正确性（生成 hash grouping 算子、（并行两阶段时）projection 下面新增隐藏列 grouping_id）
1. TPCDS 的 grouping 函数/grouping sets 相关 SQL 语句的结果正确性


  


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

ct/kt：dml/dql 之间并发、dql/dql 之间并发

长稳：数据量较大的情况

性能：TPCDS

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

自动化看护

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

1、由于列存内部是按批次取数的，需要关注查询返回的数据量比一个批次的数据量多的场景（批次配置：COLUMNAR_BULK_SIZE）

2、分布式关注两阶段节点分发场景、单cn/多cn/单dn/多dn

## Attachments:

[image2023-10-25_18-57-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzdhMWFkOWEzMzExZGM4MzMwIiwicmVmX2lkIjoiNjczOTZiNzc3MjgyMDZlZmI5MmYwNjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NjUyLCJleHAiOjE3ODIzODEwNTJ9.h-xPCEHwlcjERyweZjNay3i_sDpniLv1wwHW6elEv3A)

 (image/png)    


[image2023-10-25_18-57-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzg4OTcwYzJhZjRmNTIwNGI4IiwicmVmX2lkIjoiNjczOTZiNzc3MjgyMDZlZmI5MmYwNjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NjUyLCJleHAiOjE3ODIzODEwNTJ9.Qt-zZ5lOAWyhphZ8xZqQ4SsmoVLC1xeLv30fvGet-OY)

 (image/png)    


[image2023-10-25_18-56-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzg4OTcwYzJhZjRmNTIwNGI5IiwicmVmX2lkIjoiNjczOTZiNzc3MjgyMDZlZmI5MmYwNjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NjUyLCJleHAiOjE3ODIzODEwNTJ9.fjA9y0UIfE0tewz2pwzOQs8g8Ofv98cj0nVkLGr143I)

 (image/png)    


[image2023-10-25_18-56-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzg4OTcwYzJhZjRmNTIwNGJhIiwicmVmX2lkIjoiNjczOTZiNzc3MjgyMDZlZmI5MmYwNjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NjUyLCJleHAiOjE3ODIzODEwNTJ9.80gVxVBBrU323H42gKTkIVAfxdkbdd-MUJTU8JJKdXM)

 (image/png)    
