Created by 李凯峰, last modified on 十二月 28, 2023

# 1. 概述

*1.sr：*    [YDBRD-21510](https://jira.yasdb.com/browse/YDBRD-21510?src=confmacro)    *-*  *列存计算支持hash grouping和并行*  *完成*    [YDBRD-21714](https://jira.yasdb.com/browse/YDBRD-21714?src=confmacro)    *-*  *GroupingSets支持DN上执行-优化器*  *完成*    [YDBRD-21715](https://jira.yasdb.com/browse/YDBRD-21715?src=confmacro)    *-*  *GroupingSets支持DN上执行-列执行*  *完成*

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

![](https://pingcode.yasdb.com/atlas/files/public/67396bc0a1ad9a3311dc8534/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFHQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUZJQ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY3NzMsImV4cCI6MTc4MjMwNzU3M30.3Jj58jNxW3_BR1PIEbClNeGHjNsR2aS-ZdeT-Lu-nT0)

语法：SELECT … [GROUPING(dimension_column)…] … GROUP BY … {CUBE | ROLLUP| GROUPING SETS} (dimension_column)

### 2.1.1  grouping sets

该语句用于指定GROUP BY的分组规则，并将结果聚合，等价于对指定组合执行GROUP BY分组，然后通过UNION ALL将结果联合起来。

语法：

![](https://pingcode.yasdb.com/atlas/files/public/67396bc08970c2af4f5206bf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFHQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUZJQ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY3NzMsImV4cCI6MTc4MjMwNzU3M30.3Jj58jNxW3_BR1PIEbClNeGHjNsR2aS-ZdeT-Lu-nT0)

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

  


![](https://pingcode.yasdb.com/atlas/files/public/67396bc0a1ad9a3311dc8535/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFHQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUZJQ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY3NzMsImV4cCI6MTc4MjMwNzU3M30.3Jj58jNxW3_BR1PIEbClNeGHjNsR2aS-ZdeT-Lu-nT0)

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

测试设计：

[hash grouping.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzBhMWFkOWEzMzExZGM4NTMwIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.augKWJAOlprUWPcT1BZXHF7DjXjhNm75zuUl2-bFKuQ)

*1.入参验证*

|  
|测试点|细分|预期|备注|原有用例是否已有覆盖|
|---|---|---|---|---|---|
|入参验证|grouping sets、cube、rollup（grouping、grouping_id、group_id函数）语法测试|  
|-|单机分布式已有覆盖，复用用例即可|是|
|  
|grouping sets、cube、rollup  入参为空、NULL值处理|  
|报错|（）不报错|是|
|  
|入参长度|入参字符的边界值测试|  
|  
|否|
|  
|入参个数|两阶段列数<=126（不重复的列）|  
|两阶段场景待构造|否|
|  
|  
|两阶段列数>126（不重复的列）|报错|两阶段最多126不重复的列|否|
|  
|入参数据类型覆盖（grouping   grouping sets、cube、rollup覆盖以下支持的数据类型  ）|数值型：  TINYINT、SMALLINT、INT、BIGINT、FLOAT、DOUBLE、NUMBER（DECIMAL、NUMERIC）、BIT|  
|已有覆盖，与分布键、分区键的子集交互还需要新增用例|否|
|  
|  
|字符型：  CHAR、VARCHAR(32000)|  
|  
|否|
|  
|  
|布尔型：BOOLEAN|  
|  
|否|
|  
|  
|日期型：  DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND|  
|  
|否|
|  
|  
|大对象型：  BLOB、CLOB、NCLOB、RAW、JSON、XMLTYPE|  
|raw支持|否|
|  
|  
|ROWID、UROWID、UDT、  ST_GEOMETRY|  
|列存不支持|  
|
|  
|入参类型覆盖：|1.表列入参,2.常量,3.NULL,4.()空值，空括号,5.绑定参数|  
|1.常量/NULL报错（表达式返回值为常量的都会报错）,2.绑定参数报错|是|
|  
|表达式|（常量+常量、表列+常量、  +-*/  ）|  
|  
|是|
|  
|  
|grouping sets/cube/rollup + 投影列覆盖各数据类型的列/常量/表达式/伪列/null|  
|  
|否|
|函数|  
|函数（grouping_id、group_id、grouping、聚合函数配合使用）|  
|  
|是|
|  
|  
|函数嵌套使用，如grouping sets(avg(c1),sum(c2))等|  
|  
|否|
|  
|  
|投影列上包含多个聚合函数（grouping函数/其他聚合函数/其他窗口函数）|  
|  
|否|
|  
|  
|函数+表达式|  
|  
|是|
|  
|  
|grouping sets/cube/rollup + 聚集函数 + 聚集函数中带 distinct|  
|  
|否|
|  
|  
|grouping 函数中带 distinct|  
|  
|否|
|  
|grouping sets/cube/rollup + grouping 函数|grouping 函数的参数是普通列/伪列/常量/表达式/null|  
|  
|是|
|  
|  
|grouping 函数与普通函数嵌套|  
|  
|是|
|  
|  
|grouping 函数与集合函数/窗口函数嵌套（非法报错）|  
|  
|  
|
|  
|  
|grouping 聚合函数出现在任意位置（子查询投影、子查询 having 子句、父查询的 having 子句、集合的两边）|  
|  
|  
|
|  
|  
|投影列上包含多个聚合函数（grouping函数/其他聚合函数）|  
|  
|  
|
|  
|  
|grouping 聚合函数与投影列有/无交集|  
|  
|  
|
|  
|  
|grouping 函数中带 distinct|  
|  
|  
|
|  
|  
|grouping 函数 + PLSQL（参数内是绑定参数，如 grouping(a+:1)、grouping(:1)）|  
|  
|  
|
|  
|  
|grouping 函数 +  其他能绑定 select 的用法 （create ... select、insert ... select、create  materialized view ... select）|  
|  
|  
|


2.对象覆盖（  grouping sets、cube、rollup（grouping、grouping_id、group_id函数）   使用）

|  
|测试点|细分|预期|备注|
|---|---|---|---|---|
|入参对象覆盖|表类型覆盖|单机：分区表、二级分区表（tac、lsc表）,分布式：分布表、复制表、二级分区表（tac、lsc表）|  
|  
|
|  
|ac对象+  grouping sets、cube、rollup（grouping、grouping_id、group_id函数）|  
|  
|  
|
|  
|SEQUENCE序列+  grouping sets、cube、rollup（grouping、grouping_id、group_id函数）|  
|  
|  
|
|  
|index+  grouping sets、cube、rollup（grouping、grouping_id、group_id函数）|(分区索引、普通索引)|  
|  
|
|  
|视图|自定义视图、v$、dv$、物化视图|  
|v$、dv$属于行表视图，不支持,物化视图列存不支持|
|  
|PL/SQL对象中使用|1.function中, 2.在匿名块中,3.在匿名块+绑定参数|  
|  
|
|  
|  
|grouping sets/cube/rollup + PLSQL (有表达式时可以传入绑定变量如： grouping sets ((a+:1),  (b || :2))|  
|  
|
|  
|伪列|rowid、rownum、user|  
|  
|


3.  grouping sets、cube、rollup字段交集

|  
|测试点|细分|预期|备注|
|---|---|---|---|---|
|grouping sets、cube、rollup字段交集|grouping sets、cube、rollup部分子集有交集|grouping sets((a,b,c,d,e), (a,b,c)）,grouping sets((a,b,c,d,e), (a,b,c)），grouping sets((a,b,c)，(a,b,c,d,e),()）–两个grouping sets顺序不一致|  
|  
|
|  
|grouping sets、cube、rollup子集完全相同|grouping sets((a,b,c), (a,b,c)）|  
|  
|
|  
|grouping sets、cube、rollup子集全无交集|如:grouping sets((a,b,c,d,e), (f,g), (x,y))|  
|  
|
|  
|子集中带 null|((a,b,null), (a,b), (a), (a,null,c),(a,c,null),(null,null,null)|报错|  
|
|  
|子集中带 ()|grouping sets((a,b,c), ()）    
|  
|  
|
|grouping sets/cube/rollup 组合使用|grouping sets/cube/rollup 列有交集| GROUP BY GROUPING SETS (    
  ROLLUP (a, b),    
  CUBE (b, c),    
  (a, b, c)    
  );|  
|  
|
|  
|grouping sets/cube/rollup 列完全相同|GROUP BY GROUPING SETS (    
  ROLLUP (a, b),    
  CUBE (a,b),    
  (a, b)    
  );|  
|  
|
|  
|grouping sets/cube/rollup 子集全无交集|GROUP BY GROUPING SETS (    
  ROLLUP (a, b),    
  CUBE (c,d),    
  (e, f)    
  );|  
|  
|


4.结合 where filter中使用+查询场景

|  
|测试点|细分|预期|备注|
|---|---|---|---|---|
|结合 where filter中使用|谓词覆盖|>、<、>=、<=、<>、!=、between and、in/not in、like/not like、exists/not exists|  
|  
|
|  
|grouping sets、cube、rollup分组列的数据类型|覆盖支持的全部数据类型|  
|  
|
|  
|并列多个grouping sets、cube、rollup的场景|如：grouping sets((a,b,c,d,e), (a,b,c)），grouping sets((a,b,c)，(a,b,c,d,e),()）|  
|  
|
|  
|组合|and、or|  
|  
|
|  
|order by/limit/offset/offset n rows fetch first/next n rows only|  
|  
|  
|
|  
|distinct|覆盖在投影列、子查询等场景中|  
|  
|
|  
|子查询|子查询出现在投影列|  
|  
|
|  
|  
|子查询出现在表|  
|  
|
|  
|  
|子查询出现在filter|  
|  
|
|  
|  
|嵌套子查询|  
|  
|
|  
|  
|grouping sets/cube/rollup 是子查询，出现在投影、from、filter 中|  
|  
|
|  
|CTE查询|  
|  
|  
|
|  
|JOIN查询|grouping sets/cube/rollup + join（left/right/full/inner join/nestloop join/hash join/merge join），覆盖 join 作为子查询的场景|  
|1、join key 是grouping key的子集、非子集、部分交集,2、数据类型隐式转换|
|  
|集合查询|grouping sets/cube/rollup + join + 集合操作（构造复杂查询）|  
|  
|
|  
|  
|grouping sets/cube/rollup + 集合操作（带谓词下推），覆盖集合操作为子查询的场景，出现在投影、from、filter 中|  
|  
|
|  
|grouping sets/cube/rollup 在 View 视图内，View 出现在任意位置|自建视图|  
|  
|
|DML|insert into select/update/deleter where中|grouping sets/cube/rollup + 其他能绑定 select 的用法 （create ... select、insert ... select、create  materialized view ... select）|  
|物化视图列存不支持，可以覆盖测试拦截场景|
|  
|单机、分布式复制表grouping sets/cube/rollup 的列是/否分区键|分区建是  grouping sets/cube/rollup的子集|  
|  
|
|  
|  
|分区建不是  grouping sets/cube/rollup的子集|  
|  
|
|  
|  
|多个分区建|  
|  
|
|  
|  
|单个分区键|  
|  
|
|  
|分布式上 grouping sets/cube/rollup 的列是/否分布键|分布键是  grouping sets/cube/rollup的子集|  
|  
|
|  
|  
|分布键不是  grouping sets/cube/rollup的子集|  
|  
|
|  
|  
|多个分布键|  
|  
|
|  
|  
|单个分布键|  
|  
|


5.并行测试、CT/KT

|  
|测试点|细分|预期|备注|
|---|---|---|---|---|
|并行测试|grouping sets/cube/rollup + 并行|结合以上测试点打开并行测试|  
|  
|
|  
|分布式分布表+并行、复制表+并行|结合以上测试点打开并行测试|  
|  
|
|  
|degree_of_parallel=4|  
|  
|  
|
|CT/KT|使用testkill测试框架|  
|  
|  
|


6.数据构造

|  
|测试点|细分|预期|备注|
|---|---|---|---|---|
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
|  
|分组后的记录数 < 分组前的记录数、分组后的记录数 = 分组前的记录数|  
|  
|  
|


7.特殊场景

|  
|测试点|细分|预期|备注|
|---|---|---|---|---|
|TPCDS（关注性能1G数据量）|返回集|TPCDS 的 grouping 函数/grouping sets 相关 SQL 语句的结果正确性|  
|  
|
|  
|性能|*（关注q67，跟grouping相关的sql关注结果是否正确）搜索包含rollup、cube、grouping sets的用例，执行对比性能*|  
|因为tpcdssql影响性能的因素很多，所以hash grouping单独性能提升多少还不能确定|
|分布式分发与合并的场景|配合hash grouping使用|如：join key非分布键配合grouping函数使用，数据有分发|  
|  
|
|异常处理测试|测试执行过程中异常场景，如内存不足溢出、磁盘空间不足等场景|如columnar_bulk_size参数调小|  
|  
|
|调整参数配置一直使用hash算法|开发需要规划三个隐藏参数|还未给出|  
|  
|
|统计信息|收集统计信息/不收集统计信息|  
|  
|  
|
|执行计划|执行计划的正确性：生成 hash grouping 算子、（并行两阶段时）projection 下面新增隐藏列 grouping_id|  
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

文本用例：

[hashGrouping文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzA4OTcwYzJhZjRmNTIwNmJhIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.VETgc5S1rlbi5f0btkmRmq9hA0q4lJKZ4figvCXM85g)

冒烟用例： 

[hash grouping冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzA4OTcwYzJhZjRmNTIwNmJiIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.L1kh6kBlrDF_AN2rzwugBUrGeslIFuUcPNOGXDcJjqM)

# 5. 测试框架设计

- yasft
- testkill
- 长稳


# 6. 测试环境说明

  


|虚拟机|磁盘|cpu|内存|
|---|---|---|---|
|192.168.4.127|hdd|16|48G|
|192.168.6.184|hdd|8|32G|


# 7. 工作量评估

工作量：14  *人天*

计划测试完成时间：2023/12/22

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzBhMWFkOWEzMzExZGM4NTMxIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.yL6kxOmdax7gWyvgD56om0z5H5Ae-2q18e28sIm6_lU)

## Attachments:

[image2023-11-6_16-34-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzA4OTcwYzJhZjRmNTIwNmJlIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.C9n3TZN0LlO2WuEEPqU8jwGSfAnz-lSDYoCluJcOf7k)

 (image/png)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzBhMWFkOWEzMzExZGM4NTMxIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.yL6kxOmdax7gWyvgD56om0z5H5Ae-2q18e28sIm6_lU)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzBhMWFkOWEzMzExZGM4NTMzIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.12EvA_9633k83alo8yJaIv3J8BtKRgAJOsfR3kxvPx8)

 (application/msword)    


[hash grouping.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzBhMWFkOWEzMzExZGM4NTMwIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.augKWJAOlprUWPcT1BZXHF7DjXjhNm75zuUl2-bFKuQ)

 (application/x-xmind)    


[hashGrouping文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzA4OTcwYzJhZjRmNTIwNmJhIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.VETgc5S1rlbi5f0btkmRmq9hA0q4lJKZ4figvCXM85g)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[hash grouping冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzA4OTcwYzJhZjRmNTIwNmJiIiwicmVmX2lkIjoiNjczOTZiYzA3MjgyMDZlZmI5MmYwOWQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzczLCJleHAiOjE3ODIzODMxNzN9.L1kh6kBlrDF_AN2rzwugBUrGeslIFuUcPNOGXDcJjqM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
