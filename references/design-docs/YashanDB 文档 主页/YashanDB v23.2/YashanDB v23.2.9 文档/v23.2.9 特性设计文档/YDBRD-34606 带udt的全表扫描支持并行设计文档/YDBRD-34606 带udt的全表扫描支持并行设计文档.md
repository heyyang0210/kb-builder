IR链接：  [https://pingcode.yasdb.com/ship/ideas/670cb68552495bd785c5a736?](https://pingcode.yasdb.com/ship/ideas/670cb68552495bd785c5a736?)  

SR链接：  [https://pingcode.yasdb.com/pjm/items/67186487e489dd0868fcba18?](https://pingcode.yasdb.com/pjm/items/67186487e489dd0868fcba18?)  

# 1. 总述

本文档设计了带udt的全表扫描支持并行的方案，包括生成计划和执行。

## 1.1 需求来源

需求来源于丰图适配、深燃5G巡线系统。

## 1.2 需求背景

1.POSTGIS函数支持并行，在比拼的时候，崖山对应计划和执行也需要支持并行才能达到性能目标。

2.经分析，识别需求带udt的全表扫描支持并行扫描和执行，可以提升效率。

## 1.3 需求范围

单机行表、集群行表。

## 1.4 开源依赖

无



# 2. 接口

|接口|接口表现|接口说明|
|---|---|---|
|explain select func(udt) from table |计划上table scan层支持udt并行|打印udt并行计划|
|select func(udt) from table;|开了并行执行udt相关查询不会报错，并且性能比非并行要好|执行udt并行语句|


## 3. 规格与约束

1. udt在table scan层支持并行。
1. 非聚合函数的udt查询支持并行。
1. 聚合函数和表函数的udt查询暂不支持并行。
1. rtree 索引于udt暂不支持并行。
1. udt在table scan的filter上。


## 4. 特性

1. udt已经具备并行条件，从执行计划上放开即可。
1. 对于gis聚合函数的情况，先拦截并行，即按照非并行执行。
1. 空间索引暂时不支持并行，按照非并行执行。


## 5. Testcases（自测用例）

1. 普通gis函数的并行执行与执行计划。
1. 聚合函数的并行执行与执行计划。
1. 空间索函数并行执行与执行计划。
1. 性能验证测试。


## 6.资料设计章节

## 7.未来规划

后续支持聚合函数与空间索引的并行。