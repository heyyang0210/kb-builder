Created by 刘晓旋, last modified on 十月 31, 2023

# 1. 概述

本需求支持实现Grouping Sets算子。

# 2. 需求分析

  [YDBRD-13650](https://jira.yasdb.com/browse/YDBRD-13650?src=confmacro)    -  支持Grouping Sets算子  完成

### 2.1 功能特性

开发设计见：    [Grouping sets/Rollup/Cube调研文档](/pages/createpage.action?spaceKey=YAS&title=Grouping+sets%2FRollup%2FCube%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

###   [GROUPING SETS](https://conf.yasdb.com/pages/viewpage.action?pageId=109577164#grouping-sets)  

Group by Grouping Sets 是对 GROUP BY 子句的扩展，它能够在一个 GROUP BY 子句中一次实现多个集合的分组。它的效果等价于分别将多个相应的行 Group By 子句进行 Union 操作。特别地，一个空的子集意味着将所有的行聚集到一个分组。

例如，GROUPING SETS 语句： SELECT a, b, SUM( c ) FROM t GROUP BY GROUPING SETS ( (a, b), (a), (b), ( ) ); 其查询结果等价于：

SELECT a, b, SUM( c ) FROM t GROUP BY a, b UNION SELECT a, null, SUM( c ) FROM t GROUP BY a UNION SELECT null, b, SUM( c ) FROM t GROUP BY b UNION SELECT null, null, SUM( c ) FROM t ;

|Grouping set子语|等价group by语句|
|:---|:---|
|GROUP BY GROUPING SETS(a, b, c)|GROUP BY a UNION ALL GROUP BY b UNION ALL GROUP BY c|
|GROUP BY GROUPING SETS(a, b, (b, c))|GROUP BY a UNION ALL GROUP BY b UNION ALL GROUP BY b, c|
|GROUP BY GROUPING SETS((a, b, c))|GROUP BY a, b, c|
|GROUP BY GROUPING SETS(a, (b), ())|GROUP BY a UNION ALL GROUP BY b UNION ALL GROUP BY ()|
|GROUP BY GROUPING SETS(a, ROLLUP(b, c))|GROUP BY a UNION ALL GROUP BY ROLLUP(b, c)|


### 2.2 接口

语法：SELECT … [GROUPING(dimension_column)…] … GROUP BY … {CUBE | ROLLUP| GROUPING SETS} (dimension_column)

### 2.3 约束

当前 SR 不支持 grouping 函数

# 3. 详细测试设计

### 3.1 功能测试

功能测试设计如下：

[单机支持 Grouping Sets 测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDZhMWFkOWEzMzExZGM3OTUyIiwicmVmX2lkIjoiNjczOTY5ZDY1OTNmOTljOWZmMjM1MzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDM5LCJleHAiOjE3ODIyOTU4Mzl9.gG1Il1T78yuWB9XaHoJ3VaDXxTKHDf_U3RuktK5Wvxg)

### 3.2 并发测试

并发场景：采用功能用例作为并发用例。覆盖：dml/dql 并发、dql/dql 并发。

### 3.3 长稳测试

考虑将功能测试用例放到长稳执行

### 3.4 性能测试

目前已知性能较差，下个版本会有性能优化的需求，当前版本暂不考虑

## Attachments:

[image2023-8-5_16-15-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDZhMWFkOWEzMzExZGM3OTUzIiwicmVmX2lkIjoiNjczOTY5ZDY1OTNmOTljOWZmMjM1MzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDM5LCJleHAiOjE3ODIyOTU4Mzl9.-tyczcqwj4dT6pWVZriobwoVEf0pICeXlZ07tVIECgU)

 (image/png)    


[单机支持 Grouping Sets 测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDZhMWFkOWEzMzExZGM3OTUyIiwicmVmX2lkIjoiNjczOTY5ZDY1OTNmOTljOWZmMjM1MzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDM5LCJleHAiOjE3ODIyOTU4Mzl9.gG1Il1T78yuWB9XaHoJ3VaDXxTKHDf_U3RuktK5Wvxg)

 (application/x-xmind)    
