SR链接

  [https://pingcode.yasdb.com/pjm/items/66110085579a3edb84d49dc0](https://pingcode.yasdb.com/pjm/items/66110085579a3edb84d49dc0)    ?    
  #YDBRD-11777 【共享集群】集群支持create/rebuild index online

开发设计文档：

# 1. 概述

集群适配rebuild index online功能， 集群不同于单机，有多个实例，rebuild index online过程中的jt信息要同步多个实例，rebuild index online过程中可能存在实例的退出和加入，要做响应的处理

# 2. 需求分析

## 2.1 功能点分析

- 在索引create/rebuild过程中不阻塞dml。
- online 操作使用journal table完成，在online操作期间，并发的dml操作同步维护journal table，在online操作后期merge journal table数据到btree。
    - 只支持btree索引
    - 并不是全过程都不阻塞dml，在create/rebuild 刚开始和要结束的短时间内会阻塞dml
- 集群的特点
    - 集群下有实例进行online操作时，同步jt信息给其他实例
    - online操作结束后广播失效所有jt信息
    - 集群reform需求做额外的处理，集群topo出现变动，此时需要清理所有在线DDL，包括主节点以及其他节点在线DDL的内存残留


## 2.2 应用场景

需求本身的主要应用场景

- 创建索引的过程中，不想阻塞dml业务，可以使用online方式创建


需求与其他特性的关联场景

- 外键：rebuild 父表的索引，不应该阻塞子表的业务， rebuild 子表的业务也不应该阻塞父表的业务
- add、drop 、split、merge partiton 后索引失效，失败后使用rebuild index online的工程


## 2.3 规格约束

- 在进行online操作时若有集群实例加入或退出则online操作失败
- 在广播同步jt信息时若有实例未处于openphase3，则online操作失败


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用场景法，对集群rebuild index online过程中可能存在的场景进行设计

1、基本的功能、语法，直接复用单机即可

2、集群状态正常的情况下，create/alter rebuild index online的过程中， 各个实例做dml操作

3、集群执行online操作时并发实例的加入和退出。

4、有实例故障、正在启动的状态下 做rebuild index online

## 3.2 详细测试设计

索引类型：普通索引，唯一索引、reverse索引、函数索引、本地索引

表类型：普通表、分区表（一级分区、二级分区）

并发的DML业务覆盖：

|dml业务|业务说明|备注|
|---|---|---|
|insert|insert+delete  delete和insert在一个事务，delete的是插入的数据|  
|
|  
|delete+insert insert 刚刚delete的值|  
|
|  
|普通insert|  
|
|  
|insert into select 批插/并行插入|  
|
||insert  on duplicate key||
|delete|delete已有数据|  
|
|  
|update+delete，delete和update再同一个事务，delete的是刚刚update的数据|  
|
|update|更新的值跟当前已有的数据value相同---rowid相同|  
|
|  
|更新的值跟当前已有的数据value相同---rowid不相同|  
|
|  
|更新的值跟当前已有数据的value不相同|  
|


测试场景说明：

|分类|场景详细说明|预期|备注|
|---|---|---|---|
|并发(CT/KT)|create/alter rebuild index online的过程中，多个实例并发dml|rebuild和dml结束后，数据量正常，索引信息正确|rebuild 可以到其他表空间，这样便于观测是走的新的索引，还是旧的索引|
|  
|create/alter rebuild index online的过程中，多个实例并发dml， 再有ddl并发（create、drop 、alter 索引、add\  drop partition、split\merge分区会失效索引  ）|没有core和卡主|  
|
|故障场景|create/alter rebuild index online的过程中，非 rebuild实例退出|rebuild失败|退出方式，kill 、shutdown --abort|
|  
|create/alter rebuild index online的过程中，rebuild 所在的实例退出|rebuild失败，索引还是旧的|退出方式，kill 、shutdown --abort|
|  
|有实例正在shutdown状态，执行create/alter rebuild index online|  
rebuild失败|  
|
|  
|有实例已经退出集群后，执行create/alter rebuild index online|  
rebuild失败|  
|
|  
|create/alter rebuild index online的过程中，有实例恢复加入集群|  
rebuild失败|  
|
|一致性|DML过程中create index /rebuild online， 一致性走索引扫描（纯并发，或者带故障）|一直满足一致性条件|  
|


  


  


DFX覆盖说明：

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|涉及|
|一致性|涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；


|SR编号|SR名称|用例编号|用例测试点|
|:---|:---|:---|:---|
|YDBRD-11777|集群支持create/rebuild index online|test_rebuild_index_online_rebuild_001|集群复用单机的基本功能用例执行成功|
|YDBRD-31577|集群支持create/rebuild index online|test_sdv_ydbrd_31577_table_encry_002|dml过程中，执行rebuild index online ，无实例退出或者加入，可以build 成功，成功后数据也正确|
|YDBRD-31577|集群支持create/rebuild index online|test_sdv_ydbrd_31577_table_encry_003|create/alter rebuild index online的过程中，非 rebuild实例退出，rebuild失败|
|YDBRD-31577|集群支持create/rebuild index online|test_sdv_ydbrd_31577_table_encry_004|有实例已经退出集群后，执行create/alter rebuild index online，rebuild失败|
|YDBRD-31577|集群支持create/rebuild index online|test_sdv_ydbrd_31577_table_encry_005|create/alter rebuild index online的过程中，有实例恢复加入集群，rebuild失败|


    2.启动测试之前提供文本用例，并完成大部分自动化用例；

  [【YDBRD-33490】集群支持rebuild index测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdhOWIzNTY5OGFjMjk1YjY5YmUwYzRhIiwicmVmX2lkIjoiNjczOWM4Y2Y1OTNmOTljOWZmMjVhZjRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5MDY5LCJleHAiOjE3ODI1NDU0Njl9.d6aYwbgRMMFqobIl2wWTpRCxIcXnFuhNyPfOQFX86V8)  

# 5. 测试框架设计

- *当前的guider即可满足*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *10人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  