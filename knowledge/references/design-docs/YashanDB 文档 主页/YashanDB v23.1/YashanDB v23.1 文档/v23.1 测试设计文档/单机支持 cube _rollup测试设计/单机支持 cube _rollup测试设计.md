Created by 严丽英 on 十月 31, 2023

# 1. 概述

本需求支持实现cube/rollup算子。

# 2. 需求分析

  [YDBRD-13652](https://jira.yasdb.com/browse/YDBRD-13652?src=confmacro)    -  支持Cube算子  完成

  [YDBRD-13651](https://jira.yasdb.com/browse/YDBRD-13651?src=confmacro)    -  支持Rollup算子  完成

### 2.1 功能特性

开发设计见：    [Grouping sets/Rollup/Cube调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=109577164)  

###   [ROLLUP、Cube函数及组合](https://conf.yasdb.com/pages/viewpage.action?pageId=109577164#rollupcube%E5%87%BD%E6%95%B0%E5%8F%8A%E7%BB%84%E5%90%88)  

|Grouping set操作|等价Grouping set子语|
|:---|:---|
|CUBE ((a, b), c)|(a, b, c)、(a, b)、(c)、() 但不包含: (a, c)、(a)、(b, c)、(b)|
|CUBE (a, b, c)|(a, b, c)、(a, b)、(a, c)、(a)、(b, c)、(b)、(c)、()|
|GROUPING SETS(a, b), GROUPING SETS(c, d)|(a, c)、(a, d)、(b, c)、(b, d)|
|ROLLUP ((a, b), c)|(a, b, c)、(a, b)、()，但不包含: (a)|
|ROLLUP (a, b, c)|(a, b, c) 、(a, b)、(a)、()|


### 2.2 接口

语法：SELECT … [GROUPING(dimension_column)…] … GROUP BY … {CUBE | ROLLUP| GROUPING SETS} (dimension_column)

### 2.3 约束

当前 SR 不支持 grouping 函数

# 3. 详细测试设计

  


功能测试设计如下：



### 3.2 并发测试

并发场景：采用功能用例作为并发用例。覆盖：dml/dql 并发、dql/dql 并发。

### 3.3 长稳测试

考虑将功能测试用例放到长稳执行

### 3.4 性能测试

目前已知性能较差，下个版本会有性能优化的需求，当前版本暂不考虑