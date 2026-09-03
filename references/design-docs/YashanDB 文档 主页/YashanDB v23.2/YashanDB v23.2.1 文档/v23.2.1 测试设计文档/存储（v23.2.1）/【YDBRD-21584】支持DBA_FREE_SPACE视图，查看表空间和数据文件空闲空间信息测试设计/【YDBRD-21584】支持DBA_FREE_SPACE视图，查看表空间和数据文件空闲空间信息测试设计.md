Created by 郑荃, last modified by  刘大境 on 十一月 14, 2023

**测试详细设计目的：**    
  **对新增DBA_FREE_SPACE视图各个新增字段，变化校验测试**

**SR链接：**    [[YDBRD-21584] 支持DBA_FREE_SPACE视图，查看表空间和数据文件空闲空间信息 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21584)  

**开发设计文档：**    [DBA_FREE_SPACE设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133576580)  

# 1. 概述

支持DBA_FREE_SPACE视图，可以查询表空间内各个数据文件的空间空闲信息。

# 2. 需求分析

## 2.1 功能点分析

- 新增  DBA_FREE_SPACE，可以  显示数据库所有ONLINE数据文件的空闲空间信息
- 具体字段如下


|Column|Datatype|NULL|Description|
|:---|:---|:---|:---|
|  `TABLESPACE_NAME`  |  `VARCHAR2(30)`  |  
|Name of the tablespace containing the extent|
|  `FILE_ID`  |  `NUMBER`  |  
|Absolute file number of the data file containing the extent|
|  `BLOCK_ID`  |  `NUMBER`  |  
|Starting block number of the extent   ( 数据块的起始块号)|
|  `BYTES`  |  `NUMBER`  |  
|Size of the extent (in bytes) (数据块大小字节)|
|  `BLOCKS`  |  `NUMBER`  |  
|Size of the extent (in Oracle blocks)  （数据块的大小（以Oracle块为单位))|
|  `RELATIVE_FNO`  |  `NUMBER`  |  
|Relative file number of the file containing the extent(包含数据块的文件的相对文件号)|


## 2.2 应用场景

- 通过查询  DBA_FREE_SPACE视图，可以查询出数据文件的连续的空闲空间的情况


## 2.3 规格约束

- OFFLINE TABLESPACE或 OFFLINE DATAFILE是OFFLINE不会显示任何EXTENT空闲记录
- 如果数据文件没有任何空闲空间(FREE BLOCKS为0)，则该视图中不会有任何关于该文件的EXTENT空闲记录
- 只统计表空间当前未分配的EXTENT，在回收站中未归还的EXTENT不统计入该视图


# 3. 详细测试设计

## 3.1 测试设计方法

对本次测试设计，主要采用场景法和错误分析法

- 通过不同场景的构造，查询视图观测各个字段是否符合构造的预期
- 对于视图异常值做反向校验


## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳|涉及|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|/|
|HA|涉及|
|压力|/|
|性能|/|
|可维护性|/|


|编号|测试场景|用例详细描述|预期|优先级|备注|
|---|---|---|---|---|---|
|1|正常拦截场景|对DBA_FREE_SPACE执行DDL/DML操作，不报错,创建同名DBA_FREE_SPACE视图,无DBA权限用户查询DBA_FREE_SPACE视图失败|报错拦截，创建同名视图失败|高|查视图 不能超10秒以上|
|2|语法|带filter,join：  本地视图与本地视图，本地视图与分布式视图，本地视图与系统表，本地视图与普通表,子查询,group by  order by,desc视图  DBA_FREE_SPACE  ALL_FREE_SPACE、USER_FREE_SPACE（后续会补|查询结果正常，字段准确|高|  
|
|3|正常功能场景|自动拓展表空间，MMS表空间，透明表空间，加密表空间，压缩表空间，给每个表插入数据，查询DBA_FREE_SPACE,最后给每个表做shrink space，查询DBA_FREE_SPACE视图是否正常变化|查询结果正常，字段准确|高|  
|
|4|  
|truncate 前查询视图空闲空间 ,truncate表空间表数据，检查DBA_FREE_SPACE视图空间信息变化是否正常|查询结果正常，字段准确，空闲空间会变大|高|  
|
|5|  
|delete 表空间表数据，检查DBA_FREE_SPACE视图空间信息是否变化|查询结果正常，数据不会变化|  
|  
|
|6|  
|drop  表，检查DBA_FREE_SPACE视图空间信息是否变化|  
|  
|  
|
|7|  
|选择一个表空间，将一个或多个对象（例如表、索引等）分配到新表空间，查询DBA_FREE_SPACE视图，确认新表空间的空间信息是否正确显示。|查询结果正常，字段准确|高|  
|
|8|  
|做完DML 视图rollback，查询DBA_FREE_SPACE视图   ,  
, 空闲空间可能会减少|视图不展示？|高|  
|
|9|  
|表空间online 和offline状态下查询DBA_FREE_space视图|OFFLINE不会显示任何EXTENT空闲记录|高|  
|
|10|  
|多个表空间，带DML业务 +查询 视图、时间长短观测|  
|  
|  
|
|11|  
|开启回收站、truncate/drop表、分区、  查询DBA_FREE_SPACE视图,truncate/drop表一级分区，查询DBA_FREE_SPACE|  
|  
|  
|
|12|  
|通过ALTER TABLESPACE语句调整表空间的大小，例如扩大或缩小表空间，查询DBA_FREE_SPACE字段值|  
|  
|  
|
|13|  
|索引重建、表、分区重建、是否会影响DBA_FREE_SPACE视图空闲空间信息？|  
|  
|  
|
|14|  
|构造一个表空间，多个空闲段空间，查询DBA_FREE_SPACE视图|  
|  
|  
|
|15|  
|结合v$datafile视图、对比DBA_FREE_SPACE视图|  
|  
|  
|
|16|  
|表空间分配方式设置extent uniform size|  
|  
|  
|
|17|  
|add/drop datafile|  
|  
|  
|
|18|文件类操作|向非自动拓展的表空间中插入大量数据，使其空间不足，查询DBA_FREE_SPACE视图|  
|  
|  
|
|19|  
|tablespace 设置online/offline ，查询DBA_FREE_SPACE视图|  
|  
|  
|
|20|分布式|覆盖以上单机基础场景|查询结果正常，字段准确|中|  
|
|21|集群|1.覆盖以上单机基础场景,2.不同实例间业务+查询|查询结果正常，字段准确|高|  
|
|22|长稳场景|无需构造业务场景，单加一句查询DBA_FREE_SPACE视图|  
|  
|  
|
|23|升级|1. 旧版本：创建表空间，创建表、索引分别带上表空间 做DML操作 shrink space,2. 升级,3.新版本：查询DBA_FREE_SPACE|  
|  
|  
|
|24|并发|前置：创建表空间、创建分区表、普通表、带索引对象/不带索引对象,过程体组合：1.online/offline  +查询DBA_FREE_SPACE视图,2.DML  + shrink space  +查询DBA_FREE_SPACE视图,3.创建表带索引对象、DML、删除+查询,4。创建和删除表空间+ 查询|无core|高|  
|
|25|HA|1.主机建表、表空间，插数据、主机备份,2.主备切换，新主机shrink space ，备机查询DBA_FREE_SPACE视图,3.主备倒换、主机清库、查询DBA_FREE_SPACE视图、,4.恢复、再查询一次查询DBA_FREE_SPACE视图,  
,不同页面大小16K 32K，DDL/DML 对表空间shirnk space ，查询DBA_FREE_SPACE视图,构造其中一个空闲BLOCK损坏，加DML业务  、查询DBA_FREE_SPACE视图|查询结果正常|中|  
|


# 4. 测试文本用例

# 5. 测试框架设计

### 本次测试设计yasft、HA、testkill框架

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *1人/7天*

计划测试完成时间：11月17日

## Attachments:

[DBA_FREE_SPACE视图冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWFhMWFkOWEzMzExZGM4NjZlIiwicmVmX2lkIjoiNjczOTZiZWE1OTNmOTljOWZmMjM2ODNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODc5LCJleHAiOjE3ODIzODQyNzl9.5UygNQJKxd2AvCr_pm4OoG5F4gDaWThKFsLI7cwO3Io)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
