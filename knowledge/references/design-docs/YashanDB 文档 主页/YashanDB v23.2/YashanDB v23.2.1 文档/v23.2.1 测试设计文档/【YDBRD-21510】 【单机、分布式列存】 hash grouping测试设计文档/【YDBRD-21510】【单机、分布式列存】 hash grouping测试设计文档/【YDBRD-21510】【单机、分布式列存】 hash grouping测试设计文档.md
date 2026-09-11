Created by 李凯峰, last modified on 十一月 28, 2023

# 1. 概述

*1.sr：*    [YDBRD-21510](https://jira.yasdb.com/browse/YDBRD-21510?src=confmacro)    *-*  *列存计算支持hash grouping和并行*  *完成*    [YDBRD-21714](https://jira.yasdb.com/browse/YDBRD-21714?src=confmacro)    *-*  *GroupingSets支持DN上执行-优化器*  *完成*

*2.设计文档：*    [Hash Grouping Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Hash+Grouping+Design)  

# 2. 需求分析

## 2.1 功能点分析

- 仅支持列存计算；
- hash grouping主要功能类似于多个分组聚合数据的汇总,其语法主要包括  **grouping sets, rollup, cube；**
- grouping sets、cube、rollup，计划走 hash grouping，  hash grouping计划中替换  Sort Grouping？计划中是否有打印，如何识别？（添加隐藏参数调整计划cost测试）
- 函数   **grouping, grouping_id, group_id**  ** **  支持走 hash grouping；


## 2.2 应用场景

- *TPCDS模型中部分sql有应用（关注q67，跟grouping相关的sql关注结果是否正确）*
- *主要用于分组聚合，*  *可以通过一个查询替代多个独立的聚合查询，得到自己想要的统计数据，从而提升效率*
- *在处理大量数据和复杂的分析需求时特别有用*


## 2.3 规格约束

- 目前仅支持列存计算
- hash grouping sets/rollup/cube入参个数两阶段场景下<=126


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

## 语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396bc1a1ad9a3311dc8539/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFCQUlBQUFJQUFBSUFBSUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBZ0FDQUFBQUFBQUFJQUFBQUFBQUNBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY4MDcsImV4cCI6MTc4MjMwNzYwN30.PZ74AGQgd9kM_9Uu5NZOMC5r34fTfW82pvYRqLsNDyw)

语法：SELECT … [GROUPING(dimension_column)…] … GROUP BY … {CUBE | ROLLUP| GROUPING SETS} (dimension_column)

### 2.1.1  grouping sets

该语句用于指定GROUP BY的分组规则，并将结果聚合，等价于对指定组合执行GROUP BY分组，然后通过UNION ALL将结果联合起来。

语法：

![](https://pingcode.yasdb.com/atlas/files/public/67396bc18970c2af4f5206c3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFCQUlBQUFJQUFBSUFBSUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBZ0FDQUFBQUFBQUFJQUFBQUFBQUNBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY4MDcsImV4cCI6MTc4MjMwNzYwN30.PZ74AGQgd9kM_9Uu5NZOMC5r34fTfW82pvYRqLsNDyw)

|Grouping set子语|等价group by语句|
|:---|:---|
|GROUP BY GROUPING SETS((a, b, c))|GROUP BY a, b, c|
|GROUP BY GROUPING SETS(a, (b), ())|GROUP BY a UNION ALL GROUP BY b UNION ALL GROUP BY ()|
|GROUP BY GROUPING SETS(a, b, (b, c))|GROUP BY a UNION ALL GROUP BY b UNION ALL GROUP BY b, c|
|GROUP BY GROUPING SETS(a, b, c)|GROUP BY a UNION ALL GROUP BY b UNION ALL GROUP BY c|
|GROUP BY GROUPING SETS(a, ROLLUP(b, c))|GROUP BY a UNION ALL GROUP BY ROLLUP(b, c)|


### 2.1.2  rollup

该关键字用于指定ROLLUP执行算子，该算子用于拓展GROUP BY聚集功能，区别在于GROUP BY仅返回每个分组的结果，指定了ROLLUP关键字会返回总计和每个分组的结果。

其等价于对ROLLUP后指定的列字段的每个层次级别创建grouping set，如ROLLUP(A,B,C) == GROUPING SETS((A, B, C), (A, B), (A), ())。

  


![](https://pingcode.yasdb.com/atlas/files/public/67396bc1a1ad9a3311dc853a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFCQUlBQUFJQUFBSUFBSUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBZ0FDQUFBQUFBQUFJQUFBQUFBQUNBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY4MDcsImV4cCI6MTc4MjMwNzYwN30.PZ74AGQgd9kM_9Uu5NZOMC5r34fTfW82pvYRqLsNDyw)

### 2.1.3  cube

该关键字用于指定CUBE执行算子，该算子用于拓展GROUP BY聚集功能，区别在于GROUP BY仅返回每个分组的结果，指定了CUBE关键字会返回所有组合的结果，其中包括每个分组的结果。

其等价于对CUBE后指定的列字段的所有组合创建grouping set，如CUBE(A,B,C) == GROUPING SETS((A, B, C), (A, B), (A, C), (B, C), (A), (B), (C), ())。

###   [ROLLUP、Cube函数及组合](https://conf.yasdb.com/pages/viewpage.action?pageId=109577164#rollupcube%E5%87%BD%E6%95%B0%E5%8F%8A%E7%BB%84%E5%90%88)  

|Grouping set操作|等价Grouping set子语|
|:---|:---|
|CUBE ((a, b), c)|(a, b, c)、(a, b)、(c)、() 但不包含: (a, c)、(a)、(b, c)、(b)|
|CUBE (a, b, c)|(a, b, c)、(a, b)、(a, c)、(a)、(b, c)、(b)、(c)、()|
|GROUPING SETS(a, b), GROUPING SETS(c, d)|(a, c)、(a, d)、(b, c)、(b, d)|
|ROLLUP ((a, b), c)|(a, b, c)、(a, b)、()，但不包含: (a)|
|ROLLUP (a, b, c)|(a, b, c) 、(a, b)、(a)、()|


  


## 3.2 详细测试设计

*使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*

|  
|测试点|细分|预期|备注|
|---|---|---|---|---|
|入参验证|grouping sets、cube、rollup（grouping、grouping_id、group_id函数）语法测试|  
|-|单机分布式已有覆盖，复用用例即可|
|  
|grouping sets、cube、rollup  入参为空、NULL值处理|  
|报错|（）不报错|
|  
|入参长度|入参字符的边界值测试|  
|  
|
|  
|入参个数|两阶段列数<=126（不重复的列）|  
|  
|
|  
|  
|两阶段列数>126（不重复的列）|报错|  
|
|  
|空表测试|1.空表测试,2.测试所有列都是空值的情况，如插入NULL值,3.测试包含大量重复值或完全唯一值的数据,4.表中只有一行数据|  
|  
|
|  
|入参数据类型覆盖|数值型：  TINYINT、SMALLINT、INT、BIGINT、FLOAT、DOUBLE、NUMBER（DECIMAL、NUMERIC）、BIT|  
|  
|
|  
|  
|字符型：  CHAR、VARCHAR(32000)|  
|  
|
|  
|  
|布尔型：BOOLEAN|  
|  
|
|  
|  
|日期型：  DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND|  
|  
|
|  
|  
|大对象型：  BLOB、CLOB、NCLOB、RAW、JSON、XMLTYPE|报错|raw支持比较|
|  
|  
|ROWID、UROWID、UDT、  ST_GEOMETRY|列存都不支持|  
|
|  
|入参类型覆盖：|表列入参|  
|  
|
|  
|  
|常量、表达式、函数|  
|常量报错（表达式返回值为常量的）|
|  
|对象覆盖|表类型覆盖：分区表、二级分区表（tac、lsc表）|  
|（分布式分布键是所有的grouping key的子集，单机是分区键，走一阶段）|
|  
|  
|AC、  SEQUENCE、index|  
|  
|
|  
|  
|视图：自定义、v$、dv$、物化视图|  
|行表不支持（报错）|
|字段交集|部分子集有交集|grouping sets((a,b,c,d,e), (a,b,c)）,grouping sets((a,b,c,d,e), (a,b,c)），grouping sets((a,b,c)，(a,b,c,d,e),）–两个grouping sets顺序不一致|  
|  
|
|  
|子集完全相同|grouping sets((a,b,c), (a,b,c)）|  
|  
|
|  
|子集完全无交集|如:grouping sets((a,b,c,d,e), (f,g), (x,y))|  
|  
|
|  
|子集中带 null|((a,b,null), (a,b), (a), (a,null,c),(a,c,null),(null,null,null)|  
|null报错|
|  
|  
|（）|成功|  
|
|  
|表达式|+-*/|  
|  
|
|  
|结合聚合函数使用|sum/avg/min/max/stddev，grouping/grouping_id/group_id如出现在：聚集函数出现在投影、having 子句中、带子查询、带distinct|  
|  
|
|结合 where filter覆盖|谓词|>、<、>=、<=、<>、!=、between and、in/not in、like/not like、exists/not exists|  
|  
|
|  
|分组列的数据类型|grouping sets、cube、rollup|  
|分组列的类型覆盖支持的所有数据类型|
|  
|并列多个grouping sets、cube、rollup的场景|  
|  
|  
|
|  
|组合|and、or|  
|  
|
|  
|order by/limit/offset|  
|  
|  
|
|  
|distinct|  
|  
|  
|
|与其他函数嵌套使用|覆盖grouping sets/rollup/cube的嵌套使用，其他聚合函数嵌套使用|如：avg、count、max、min、sum、  STDDEV、VARIANCE、MEDIAN、LISTAGG、GROUP_ID、GROUPING、grouping_id|  
|SELECT region, product, year, SUM(profit) FROM sales GROUP BY GROUPING SETS (    
  ROLLUP (region, product),    
  CUBE (region, year),    
  (region, product, year)    
  );|
|  
|GROUP_ID、GROUPING、grouping_id覆盖不同的查询dml类型|  
|  
|  
|
|数据构造|测试数据包含重复数据、非重复数据、null|  
|  
|  
|
|  
|数据集的大小|  
|  
|  
|
|  
|分组列的基数（比如某个列数据都是1，另一个列数据都是非重复数据）|分组的列有大量重复数据以及没有大量重复数据的列一起分组|  
|  
|
|  
|某列存在大量的NULL值，其他分组列都有数据|  
|  
|  
|
|  
|数据倾斜的场景|  
|  
|  
|
|查询|子查询出现在投影列|  
|  
|  
|
|1|子查询出现在表|  
|  
|  
|
|2|子查询出现在filter|  
|  
|  
|
|3|嵌套子查询|  
|  
|  
|
|4|CTE|  
|  
|  
|
|5|join查询|  
|  
|  
|
|6|集合查询|  
|  
|  
|
|7|在匿名块，绑定参数测试|  
|拦截报错|  
|
|8|grouping sets/cube/rollup 组合使用，grouping sets/cube/rollup 有/无公共列、完全相同|如：group by grouping sets((a,b), (c)), rollup((d, e), (f)), cube((a,b), (h)), rollup((a,b), (c)) ...|  
|  
|
|9|投影列上包含多个聚合函数（grouping函数/其他聚合函数）|  
|  
|  
|
|10|grouping 聚合函数与投影列有/无交集|  
|  
|  
|
|11|有/无 ()、有/无 null、有/无常量、有/无函数表达式或运算表达式|以上场景组合测试|  
|  
|
|12|grouping sets/cube/rollup + 聚集函数 + 聚集函数中带 distinct|  
|  
|  
|
|13|grouping 函数中带 distinct|  
|  
|  
|
|14|grouping sets/cube/rollup 是子查询，出现在投影、from、filter 中|  
|  
|  
|
|15|grouping sets/cube/rollup + 投影列覆盖各数据类型的列/常量/表达式/伪列/null|  
|  
|  
|
|16|grouping sets/cube/rollup + grouping 函数|  
,1. grouping 函数的参数是普通列/伪列/常量/表达式/null
1. grouping 函数与普通函数嵌套
1. grouping 函数与集合函数/窗口函数嵌套（非法报错）
1. grouping 聚合函数出现在任意位置（子查询投影、子查询 having 子句、父查询的 having 子句、集合的两边）
1. 投影列上包含多个聚合函数（grouping函数/其他聚合函数）
1. grouping 聚合函数与投影列有/无交集
1. grouping 函数中带 distinct
1. grouping 函数 + PLSQL（参数内是绑定参数，如 grouping(a+:1)、grouping(:1)）
1. grouping 函数 +  其他能绑定 select 的用法 （create ... select、insert ... select、create  materialized view ... select）
|  
|  
|
|17|grouping sets/cube/rollup 在 View 视图内，View 出现在任意位置|  
|  
|  
|
|18|grouping sets/cube/rollup + 集合操作（带谓词下推），覆盖集合操作为子查询的场景，出现在投影、from、filter 中|  
|  
|  
|
|19|grouping sets/cube/rollup + join（left/right/full/inner join/nestloop join/hash join/merge join），覆盖 join 作为子查询的场景|  
|  
|1、join key 是grouping key的子集、非子集、部分交集,2、数据类型隐式转换|
|20|grouping sets/cube/rollup + join + 集合操作（构造复杂查询）|  
|  
|  
|
|21|分组后的记录数 < 分组前的记录数、分组后的记录数 = 分组前的记录数|  
|  
|  
|
|22|grouping sets/cube/rollup + 索引约束/AC 约束|  
|  
|  
|
|23|grouping sets/cube/rollup + 并行|  
|  
|  
|
|24|grouping sets/cube/rollup + PLSQL (有表达式时可以传入绑定变量如： grouping sets ((a+:1),  (b || :2))|  
|报错|  
|
|25|grouping sets/cube/rollup + 其他能绑定 select 的用法 （create ... select、insert ... select、create  materialized view ... select）|  
|  
|  
|
|26|单机grouping sets/cube/rollup 的列是/否分区键，分区键：单个/多个|  
|  
|  
|
|27|分布式上 grouping sets/cube/rollup 的列是/否分布键，分布键：单个/多个|  
|  
|  
|
|28|分布式单CN/多CN、单DN/多DN|  
|  
|  
|
|29|分布式覆盖：分布表、复制表|  
|  
|  
|
|30|分布式分布表+并行、复制表+并行|  
|  
|  
|
|31|grouping sets/cube/rollup 返回的记录数 > columnar_bulk_size|  
|  
|  
|
|32|以上场景 + 收集统计信息，执行结果的正确性|  
|  
|  
|
|覆盖伪列|rowid、rownum、user|  
|  
|rowid拦截|
|dml|insert into select/update/deleter where中|其他能绑定 select 的用法 （create ... select、insert ... select、create  materialized view ... select）|  
|  
|
|分布式场景|分发与合并|多表join，join key是非分布键配合grouping函数使用|  
|  
|
|  
|grouping sets/cube/rollup分布键与子集有交集，无交集，部分交集组合场景|  
|  
|  
|
|TPCDS|  
|TPCDS 的 grouping 函数/grouping sets 相关 SQL 语句的结果正确性|  
|  
|
|并行测试|  
|degree_of_parallel|  
|  
|
|并发/kill测试|  
|CT/KT、数据量大小有影响吗？|  
|  
|
|性能测试|  
|如：使用TPCDS模型测试，对比原算法性能提升多少？预期是提升多大？|  
|  
|
|异常处理测试|  
|测试执行过程中异常场景，如内存不足溢出、磁盘空间不足等场景|  
|  
|
|调整参数配置一直使用hash算法|  
|哪个参数呢，可否提供|  
|  
|
|统计信息|  
|收集统计信息/不收集统计信息|  
|  
|
|执行计划|  
|执行计划的正确性：生成 hash grouping 算子、（并行两阶段时）projection 下面新增隐藏列 grouping_id|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


*梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|是|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|是|
|性能|是|
|可维护性|是|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzFhMWFkOWEzMzExZGM4NTM2IiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODA3LCJleHAiOjE3ODIzODMyMDd9.x4NNcTIrlk2ajIrGrNUyZgJvJBro44C_ZIIpBToytLw)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzFhMWFkOWEzMzExZGM4NTM2IiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODA3LCJleHAiOjE3ODIzODMyMDd9.x4NNcTIrlk2ajIrGrNUyZgJvJBro44C_ZIIpBToytLw)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzFhMWFkOWEzMzExZGM4NTM3IiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODA3LCJleHAiOjE3ODIzODMyMDd9.rSqNn467hUTGax60o3PRSsZw3jR8Hxe4IUYu26hpB3Y)

 (application/msword)    


[image2023-11-6_16-34-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzE4OTcwYzJhZjRmNTIwNmMwIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODA3LCJleHAiOjE3ODIzODMyMDd9.H0X4XaoeNlDdQ5Kkhi_Oqn7nfwyAk-1PeyiY7CZVMhg)

 (image/png)    
