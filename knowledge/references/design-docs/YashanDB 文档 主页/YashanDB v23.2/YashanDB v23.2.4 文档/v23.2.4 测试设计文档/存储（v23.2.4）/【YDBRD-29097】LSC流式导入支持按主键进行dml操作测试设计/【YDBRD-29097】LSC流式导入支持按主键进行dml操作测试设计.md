Created by 任艳芬, last modified on 十月 15, 2024

# 1. 概述

需求场景：flink流式导入时可能有少量dml操作，并且一般基于主键条件的单行删除更新。

需求目标：lsc表需要放开dedup导入时的dml限制，并且加速基于唯一索引的dml速度。

需求范围：分布式，lsc

# 2. 需求分析

## 2.1 功能点分析

1.进行BULKLOAD导入的表允许进行带索引条件的dml操作。

2.LSC表支持索引回表。

## 2.2 应用场景

建lsc表，唯一索引

1. 同一事务内，bulkload后，非rgd数据的dml操作。

2. 同一事务内，bulkload后，rgd数据的dml操作。

3. bulkload后未提交，另一事务执行rgd数据dml。

## 2.3 规格约束

1. 只支持非rgd数据的回表 如果待dml的数据落在rgd内 则直接报错。

2. LSC flink导入只能支持带唯一索引条件的dml操作。

# 3. 详细测试设计

## 3.1 测试设计方法

- 主要采用场景覆盖法


## 3.2 详细测试设计

|编号|测试点|测试场景|备注|
|---|---|---|---|
|1|同一事务内，bulkload后，非rgd数据的dml操作|lsc表，带主键,插入热数据/冷数据key1 key2 key3，提交,dedup插入key1 ,delete /*+ full(a)*/ key2，成功,update /*+ index(a)*/ key3, 成功,insert /*+ index(a)*/ into on duplicate key update 成功|  
|
|2|同一事务内，bulkload后，rgd数据的dml操作|lsc表，带主键,插入热数据/冷数据key1 key2 key3，提交,dedup插入key1 key2 key3,delete /*+ full(a)*/ key2，0 rows affected,update /*+ index(a)*/ key3，报错 rgd数据不支持update/delete/merge,delete /*+ index(a)*/ 包含热数据，rgd数据和非rgd数据,insert /*+ index(a)*/ into on duplicate key update 成功|  
|
|3|bulkload后未提交，另一事务执行rgd数据dml|lsc表，带主键,会话1，插入热数据/冷数据key1 key2 key3，提交，dedup插入数据key1 key2 key3,会话2，delete /*+ full(a)*/ key2，等锁,update /*+ index(a)*/ key3，等锁,insert /*+ index(a)*/ into on duplicate key update 成功，等锁|  
|
|4|并发测试|lsc带主键的表，insert  /*+bulkload deduplicate*/ 操作和dml操作并发|  
|


# 4. 测试用例

文本用例：见详细设计

# 5. 测试框架设计

使用Guider原有功能，不做特殊设计

# 6. 测试环境说明

部署：单机+分布式

# 7. 工作量评估

工作量：6  *人天*

计划测试完成时间：2024/6/8

## Comments:

|  [](null)  ,测试评审参与人：万谦，易文亮，任艳芬,评审时间：2024/6/3 17:20,会议纪要：,1.增加  insert  into on duplicate key update   语法测试,2.增加数据量，测试到多slice,Posted by renyanfen at 六月 03, 2024 17:32|
|---|
