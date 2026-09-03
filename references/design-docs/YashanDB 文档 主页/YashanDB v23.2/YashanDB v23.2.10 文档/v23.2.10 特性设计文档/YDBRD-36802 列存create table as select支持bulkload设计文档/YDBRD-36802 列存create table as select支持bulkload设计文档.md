SR链接:  [ ](https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?)  

  [https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?](https://pingcode.yasdb.com/pjm/items/6766340e64bf51159818a90b?)  

#YDBRD-36802 列存create table as select支持bulkload



## 1. 总述

深圳卫健委电子处方功能需要支持create table as select 支持bulkload功能。

### 1.1 需求来源

   深圳市卫健委

### 1.2 调研文档

  无

### 1.3 需求分析

  崖山数据库单机和分布式需要列存需要create table as select支持bulkload功能，  
  当前已经支持通过insert into 语句指定hint /  *+bulkload*  */方式支持bulkload功能。

### 1.4 数据字典

### 1.5 开源依赖

 无

## 2. 接口

无

## 3. 规格与约束

|约束||
|---|---|
|create table as select支持bulkload当前只支持列存|insert into支持bulkload当前也只支持列存|
|create table as select支持bulkload只对列存lsc表生效|tac表设置bulkload不生效|


## 4. 特性

### 4.1 create table as select支持bulkload功能

1. 设置insert bulkload标志位。


       1. 分布式部署环境下，判断当前是CN节点，在  `makeCTASInsertCtx`  函数中，判断当前是否LSC表，如果是设置 isBulkLoad标志位。

       2. 单机部署环境下create table ddl执行成功后吗，执行insert plan 前判断如果是LSC表，设置   `AnkCursor->AnkCursorAttr->insertAction`  为  `INSERT_ACTION_BULKLOAD`  , 执行bulkload方式insert. 

   4. 分布式执行insertPaln阶段设置   `AnkCursor->AnkCursorAttr->insertAction`  为  `INSERT_ACTION_BULKLOAD`  , 执行bulkload方式insert. 

       1. 分布式部署环境下, 执行insert的DN节点根据CN生产的  `insertPaln->isBulkLoad`  标志位设置，在  `execColInsertSubQuery`  中根据isBulkLoad标志位设置  `AnkCursorAttr->insertAction=INSERT_ACTION_BULKLOAD`  。

## 5. Testcases（自测用例）

测试方案设计: 

|测试项目|||
|---|---|---|
|单机环境执行create table as select lsc表|执行成功，并且bulkload方式插入||
|单机环境执行create table as select tac表|执行成功。||
|单机环境执行create table as select heap表|||
|分布式环境执行create table as select lsc表|执行成功。||
|分布式环境执行create table as select tac表|执行成功。||
|单机环境设置lsc表默认导入为冷数据，执行create table as select lsc表.|执行成功。||
|分布式环境设置lsc表默认导入为冷数据，执行create table as select lsc表|执行成功。||


## 7. 工作量评估

|序号|工作项|时间(单位: 人/天)|日期|
|---|---|---|---|


## 8.资料设计章节

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

## 9.未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。



