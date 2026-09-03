Created by 任艳芬, last modified on 十月 15, 2024

# 1. 概述

LSC表MCOL在查询时效果差 并存在空间膨胀问题 而转冷需要一定的时间 在流式导入和冷热场景下支持关闭MCOL以达到查询性能稳定

# 2. 需求分析

## 2.1 功能点分析

1.参数支持LSC表默认的MCOL能力：  ALTER SYSTEM SET LSC_MCOL_ENABLED=true/false SCOPE=SPFILE/MEMERY/BOTH;

2.语法  支持在建表时或建表后关闭开启MCOL，并支持视图查询：

CREATE TABLE test DISABLE/ENABLE MCOL;

ALTER TABLE test DISABLE/ENABLE MCOL;

3.关闭MCOL后 提供DML能力。已提交数据可见，本事务未提交数据可见，其他事务未提交数据不可见，同一行冲突时后一事务失败。

4.关闭MCOL后 支持多表更新。支持同一事务对多张表更新。支持多表联合更新。

5.  关闭MCOL和DDL,DML操作组合，及并发

## 2.2 应用场景

|场景一：,建表MCOL关闭,insert,insert /*+bulkload*/,select user_tables表属性正确,select 表数据，数据正确,DDL DML符合预期|
|---|
|场景二：,建表指定MCOL打开,insert+commit,insert /*+bulkload*/+commit,alter table disable mcol;,select user_tables表属性正确,select 表数据，数据正确,DDL DML符合预期|
|场景三：,建表A,B MCOL关闭,支持同一事务对多表更新,支持多表联合更新|


## 2.3 规格约束

1. LSC_MCOL_ENABLED配置只影响后续建表的默认MCOL打开关闭情况

2.关闭MCOL后，同事务同一张表，insert /*+bulkload*/和load data，yasldr的ENABLE_BULK=true模式 与 普通dml互斥。

3.关闭MCOL后，事务处理能力受限，同行冲突时，锁不等待，而是后一个事务失败。

4.事务内的语句如果在插入rgd数据后失败 则事务整体回滚 若在插入rgd数据前失败 则语句回滚

# 3. 详细测试设计

## 3.1 测试设计方法

1.主要采用等价类划分和场景覆盖法进行设计

- 不同参数设置：等价类划分
- 不同部署模式+不同表类型+不同类型+不同数据量：场景覆盖法


## 3.2 详细测试设计

# 4. 测试用例

  


# 5. 测试框架设计

自动化用例添加到YTP平台上

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


  


# 7. 工作量评估

## Attachments:

[YDBRD-26165_LSC支持关闭MCOL.emmx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODhhMWFkOWEzMzExZGM5N2EzIiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTA4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODAyLCJleHAiOjE3ODI1MjQyMDJ9.ESBZTDbkKtLnqvebtqHQYqqcX_aelmirL23GI_-xZkg)

 (application/octet-stream)    
