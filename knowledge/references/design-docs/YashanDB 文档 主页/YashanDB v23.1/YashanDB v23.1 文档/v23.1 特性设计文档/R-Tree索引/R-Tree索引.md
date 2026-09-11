Created by 张锐, last modified on 十月 21, 2024

##   [1. ](#1-rtree-design)      [Rtree Design](https://conf.yasdb.com/pages/viewpage.action?pageId=113970572)  

##   [2. ](#2-rtree-structure-and-basic-operation)      [Rtree Structure and Basic Operation](https://conf.yasdb.com/display/YASDOC/Rtree+Structure+and+Basic+Operation)  

##   [3. ](#3-rtree-build-tree)      [Rtree Build Tree](https://conf.yasdb.com/display/YASDOC/Rtree+Build+Tree)  

##   [4. ](#4-rtree-scan)      [Rtree Scan](https://conf.yasdb.com/display/YASDOC/Rtree+Scan)  

##   [5. ](#5-rtree-structure-operation)      [Rtree Structure Operation](https://conf.yasdb.com/display/YASDOC/Rtree+Structure+Operation)  

##   [6. ](#6-rtree-cr-block-and-rollback)      [Rtree CR Block and Rollback](https://conf.yasdb.com/display/YASDOC/Rtree+CR+Block+and+Rollback)  

###   [功能](#功能)  

- 支持创建rtree索引，rtree存储d维矩形框，存储2个d维的点，一个d维的点存储d个数值类型（float，double，number）
- 支持DML：插入，删除，更新，以及对应的回滚
- 支持扫描，扫描接口：给定矩形框，返回所有和其相交的矩形框（匹配函数可以定制化）
- 支持MVCC（基本事务，一致性查询）
- 支持基本索引DDL（元信息修改类和btree索引一样，rebuild和create在buildTree阶段和btree索引区分，coalesce不支持）
- 支持分区（上层代码与btree索引一致）


###   [规格](#规格)  

- 维度上限：6维
- 不支持unique rtree索引
- 不支持create/rebuild online
- 不支持可串行化事务
- rtree高度上限：24层
- rtree只支持单列索引，不支持多列复合rtree索引
- 支持单机


###   [计划](#计划)  

|任务|状态|人力（单位：人周）|优先级|（计划）启动时间|
|---|---|---|---|---|
|rtree选型，分裂算法，build tree算法，rtree行为确定|已完成||||
|元信息设计，物理页面设计，接口设计，dc设计，index上层代码抽象|已完成|2|必须|2023-3-6|
|rtree build tree算法|已完成|2|必须|2023-3-20|
|rtree 基础代码（逻辑代码与btree分离，底层物理操作代码尽量复用btree）|已完成|4|必须|2023-4-10|
|rtree cr构建，undo|已完成|1|必须|2023-5-8|
|rtree split算法，rtree结构变更代码|已完成|2|必须|2023-5-10|
|rtree扫描算法|已完成|1|必须|2023-5-4|
|rtree索引ddl，分区|已完成|1|高||
|整体自测（包含各个任务预留的机动时间）|已完成|2|必须||
|rtree各个模块文档|已完成|1|低||
|总计|已完成|16|||


注：尽量按照计划往前赶

- sql适配rtree index
- null值不插入rtree中


###   [后续规划](#后续规划)  

|任务|状态|人力（单位：人周）|优先级|（计划）启动时间|
|---|---|---|---|---|
|rtree cache|待启动||高（缓解查询buffer冲突）||
|rtree支持统计信息|待启动||高（计划选择）||
|并行创建rtree index|待启动||中（当前的并行只是在扫描进mtrl做了并行，在STR build的递归过程中没有并行，需要考虑一下收益。递归过程中做并行的话，消耗资源比较多，并发控制比较复杂）||
|rtree动态空闲空间管理|待启动||是否有必要？（动态回收只能回收空页。但是实际gis应用中，dml很少，大概率不会删空）||
