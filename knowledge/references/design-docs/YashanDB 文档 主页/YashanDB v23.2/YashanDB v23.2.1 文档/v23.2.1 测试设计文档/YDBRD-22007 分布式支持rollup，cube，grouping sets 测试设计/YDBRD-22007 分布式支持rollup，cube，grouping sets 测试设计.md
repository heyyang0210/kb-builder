Created by 刘美秀, last modified on 十二月 14, 2023

# 1. 概述

分布式支持实现  Grouping Sets/rollup/  cube算子，继承单机能力

# 2. 需求分析

SR：    [YDBRD-22007](https://jira.yasdb.com/browse/YDBRD-22007?src=confmacro)    -  分布式支持rollup，cube，grouping sets  完成

开发设计：    [YDBRD-22007 分布式支持rollup](https://conf.yasdb.com/pages/viewpage.action?pageId=133589099)    /    [Grouping sets/Rollup/Cube调研文档 ](https://conf.yasdb.com/pages/viewpage.action?pageId=109577164)  

## 2.1 功能点分析

![](https://pingcode.yasdb.com/atlas/files/public/67396ba9a1ad9a3311dc849e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBZ0FBQUFDQUFBQUFRQUFBQUlBQUFBaUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNDQsImV4cCI6MTc4MjMwNjk0NH0.Y55kNT9IfUP9bAbkqLsuxI3oVkkGNiaNYD-XZkmjxxU)

语法：SELECT … [GROUPING(dimension_column)…] … GROUP BY … {CUBE | ROLLUP| GROUPING SETS} (dimension_column)

### 2.1.1  grouping sets

该语句用于指定GROUP BY的分组规则，并将结果聚合，等价于对指定组合执行GROUP BY分组，然后通过UNION ALL将结果联合起来。

语法：

![](https://pingcode.yasdb.com/atlas/files/public/67396ba9a1ad9a3311dc849f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBZ0FBQUFDQUFBQUFRQUFBQUlBQUFBaUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNDQsImV4cCI6MTc4MjMwNjk0NH0.Y55kNT9IfUP9bAbkqLsuxI3oVkkGNiaNYD-XZkmjxxU)

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

  


![](https://pingcode.yasdb.com/atlas/files/public/67396ba98970c2af4f520627/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBZ0FBQUFDQUFBQUFRQUFBQUlBQUFBaUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNDQsImV4cCI6MTc4MjMwNjk0NH0.Y55kNT9IfUP9bAbkqLsuxI3oVkkGNiaNYD-XZkmjxxU)

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


  


## 2.2 应用场景

对于需要分组计算的场景，使用  Grouping Sets/rollup/  cube会更方便简洁，查询性能更优

Grouping Sets/rollup/  cube在执行计划中都生成同一个算子SORT GROUPING SETS

## 2.3 约束

（1）入参个数 <=256

# 3. 详细测试设计

存储类型：lsc，（tac本地验证）

表类型：分区表、二级分区表

功能测试设计如下：

|NUM|类型|测试点|细分|预期|备注|
|---|---|---|---|---|---|
|1|入参验证|语法验证|-|-|单机已覆盖，分布式无需重复验证|
|2|  
|入参为空值|-|-|单机已覆盖，分布式无需重复验证|
|3|  
|入参个数|列数<4096|  
|  
|
|4|  
|  
|列数=4096|  
|  
|
|5|  
|  
|算子(4096列)|  
|  
|
|6|  
|入参长度|  
|  
|  
|
|7|  
|入参值类型覆盖|数值类型：tinyint/smallint/int/bigint/float/number/bit/boolean|  
|  
|
|8|  
|  
|字符串类型：char/varchar|  
|  
|
|9|  
|  
|时间类型：date/time/timestamp/ym interval/ds interval|  
|  
|
|10|  
|  
|大对象类型：raw|  
|  
|
|11|  
|  
|blob/clob/json|拦截|  
|
|12|  
|入参类型覆盖|表列|  
|  
|
|13|  
|  
|常量|  
|  
|
|14|  
|  
|表达式|  
|  
|
|15|  
|  
|函数|  
|  
|
|16|  
|对象覆盖|表类型：分区表、二级分区表|  
|  
|
|17|  
|  
|AC|  
|  
|
|18|  
|  
|视图：自定义、v$、dv$|  
|  
|
|19|字段交集|部分子集之间有交集|外层顺序不一致grouping sets((a,b,c,d,e), (a,b,c)）    
  grouping sets((a,b,c)，(a,b,c,d,e),）|  
|  
|
|20|  
|  
|内层顺序不一致 grouping sets((a,b,c)，(b,c,a), (a,c)）|  
|  
|
|21|  
|多个子集之间无交集|如:grouping sets((a,b,c,d,e), (f,g), (x,y))|  
|  
|
|22|  
|子集中带 null|((a,b,null), (a,b), (a), (a,null,c),(a,c,null),(null,null,null)|拦截|  
|
|23|结合聚合函数覆盖|聚集函数出现在投影、having 子句|sum/avg/min/max/stddev|  
|  
|
|24|结合 where filter覆盖|谓词|>、<、>=、<=、<>、!=、between and、in/not in、like/not like、exists/not exists|  
|  
|
|25|  
|组合|and、or|  
|  
|
|26|  
|order by/limit/offset|  
|  
|  
|
|27|  
|distinct|  
|  
|  
|
|28|查询场景|子查询出现在投影|  
|  
|  
|
|29|  
|子查询出现在表|  
|  
|  
|
|30|  
|子查询出现在filter|  
|  
|  
|
|31|  
|嵌套子查询|  
|  
|  
|
|32|  
|CTE|  
|  
|  
|
|33|  
|join查询|  
|  
|  
|
|34|  
|集合查询|  
|  
|  
|
|35|  
|在匿名块，绑定参数|  
|  
|  
|
|36|dml|insert into select/update/deleter where中|  
|  
|  
|
|37|执行计划|新增算子SORT GROUPING SETS|  
|  
|  
|
|38|统计信息|收集统计信息后查询|  
|  
|  
|
|39|并行|  
|  
|  
|  
|


  


DFX：

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|不涉及|
|一致性|不涉|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|是|
|压力|不涉|
|性能|否，该SR 不考虑，其他SR条件下推验证|
|可维护性|不涉|


# 4. 测试用例

冒烟文本用例：

文本用例：

全量用例

# 5. 测试框架设计

使用yasft框架

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器类型|操作系统|内存|磁盘空间|CPU|服务器个数|部署节点|
|:---|:---|---|---|---|:---|:---|
|VM|CentOS Linux release 7.6.1810 (Core)|26G|750G|8C|2|3mn2cn3dn|


  


# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：

  


## Attachments:

[YDBRD-22007测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYThhMWFkOWEzMzExZGM4NDk2IiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.S5M3_HKnA-vhr5y__vm8yAoUcwT0RqF-4zBWkHjau44)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[test_sdv_ydbrd22007_grouping_sets_01.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTg4OTcwYzJhZjRmNTIwNjIwIiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.FsoVokKDVqJ3FtfBd9AXF2UN0j0qzaaLKwxX21aWcL4)

 (application/octet-stream)    


[test_sdv_ydbrd22007_rollup_01.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTg4OTcwYzJhZjRmNTIwNjIxIiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.ItVVzxEDAT5L4imJ10VIi2LKHIUIbIGAc5sQxF9dinI)

 (application/octet-stream)    


[test_sdv_ydbrd22007_cube_01.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYThhMWFkOWEzMzExZGM4NDk3IiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.sn0-xNfetqiSdWfKl18fEDSZOxIPF34PuMqDGx0umUY)

 (application/octet-stream)    


[YDBRD-22007测试用例.pdf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTg4OTcwYzJhZjRmNTIwNjIyIiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.F-NmH1EDsTLpc2601MjwC-RRn3i0lDSoMVPrKX7QVwc)

 (application/pdf)    


[分布式支持 grouping sets.pdf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYThhMWFkOWEzMzExZGM4NDk4IiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.uLQoJjE14j5LjkRpNByG62on1Jkq7O1HoO-m5Cbx-ZA)

 (application/pdf)    


[分布式支持cube_and_rollup .pdf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYThhMWFkOWEzMzExZGM4NDk5IiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.oyzZsQ7bSyG_e9e2l-JmjlnHBd3cWKpZXRXtd95hD3Y)

 (application/pdf)    


[test_sdv_rollup_01.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTk4OTcwYzJhZjRmNTIwNjI1IiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.eUf19yW1GtfrrFSft2x8-SQsZKew21PoG5JvrwZL7Zo)

 (application/octet-stream)    


[test_sdv_cube_01.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTlhMWFkOWEzMzExZGM4NDljIiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.Zg2uWe4_JkDwKw5LG1S95mVYqzdQijjiajgD1yCzwFo)

 (application/octet-stream)    


[test_sdv_grouping_sets_01.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTlhMWFkOWEzMzExZGM4NDlkIiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.lAXFUblNon2K3zRZfn9w6H4hRVRFOUlhZ6FBPwNqsYM)

 (application/octet-stream)    


[YDBRD-22007测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTk4OTcwYzJhZjRmNTIwNjI2IiwicmVmX2lkIjoiNjczOTZiYTg3MjgyMDZlZmI5MmYwOGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTQ0LCJleHAiOjE3ODIzODI1NDR9.1WmbqLLyOBxIN7azGLmLZet4D-Nz9PLwPBmq5oPRpo8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：张璐恒，谭思宇，赵育，刘美秀    
  会议时间：2023/11/07 15:00-16:00    
  会议地点：1012    
  纪要信息：    
  1.语法验证部分，单机已覆盖，分布式不需要重复验证    
  2.分布式下关注基于行表的查询拦截：v$/dv$    
  3.设置并行度查询,评审通过与否：通过,Posted by liumeixiu at 十二月 12, 2023 16:55|
|---|
|  [](null)  ,规格变更：  不再允许grouping sets、cube、rollup中出现null和常量    
    [https://jira.yasdb.com/browse/YDBRD-23336](https://jira.yasdb.com/browse/YDBRD-23336)  ,Posted by liumeixiu at 十二月 12, 2023 16:57|
