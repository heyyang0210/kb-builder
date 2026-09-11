Created by 徐瑶, last modified on 八月 22, 2023

# 1. 概述 

支持二级分区导入导出，包括服务端与客户端    


# 2. 需求分析 

## 2.1需求

SR:      [YDBRD-7757](https://jira.yasdb.com/browse/YDBRD-7757?src=confmacro)    -  导入工具支持二级分区  完成

开发设计：    [YDBRD-7757 :The import tool supports secondary partitions 导入工具支持二级分区—客户端](119552931.html)  

## 2.2 功能描述

支持二级分区表的导入

## 2.3 规格限制

（1）现  支持：range-range, range-hash, range-list; hash-range, hash-hash, hash-list; list-range, list-hash, list-list; 共9种组合分区的导入导出。  不支持interval分区，  interval-range, interval-hash, interval-list

（2）支持分区模板

（3）二级分区表中  一个一级分区至少有一个二级分区。

（4）  交付范围为单机。分布式场景对于导入二级分区报错拦截

（5）  sqlloader做服务端：支持csv中数据导入到多张表中，导入到哪些表中，是由语句中指定的。如果没有限制条件，那么这些数据将导入所有的表中；如果有限制条件，才会将数据导入到特定的表中。

         sqlloader做客户端：只支持csv中的数据导入一张表中，不支持导入多张表。

## 2.4 结果校验

校验：与insert对比，校验分区数据

查询子分区个数

select count(*) from dba_tab_subpartitions where TABLE_NAME = '表名'

select count(*) from test01 partition (p1); （统计分区p1数据）

select count(*) from test01 subpartition (sub_p1); （统计子分区sub_p1数据）

# 3. 测试设计方法 

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计 

# 4. 详细测试设计

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|部署形态|  
|1、单机|  
|分布式不支持二级分区|  
|
|表类型|  
|- heap
- tac
- lsc
|nolongging表|  
|  
|
|子分区的分区键类型|  
|数值型：tinyint，smallint，int, bigint，number, float, double,字符型：char, varchar, nchar, nvarchar，raw,时间类型：data, time，timestamp，interval,布尔型：bool|覆盖边界值|超过分区范围，分区键值带默认值，load语句中不带分区键，只带一级分区键不带二级分区键。每种数据类型超过边界值|  
|
|分区键内容|  
|正常值、  边界值,空串、  空格、null,被单双引号包围,特殊字符等|  
|  
|  
|
|子分区个数|  
|- 1个
- 多个
- 1M-1个
,（1）在同一个一级分区下,（2）在不同的一级分区下|  
|  
|  
|
|分区条件|  
|特殊值：maxvalues，default，带双引号,函数,普通常量|  
|  
|  
|
|分区类型组合|（1）range-range,（2）list-range,（3）hash-range|二级分区与一级分区的分区键一样,- 单列
- 多列（最大16列）
,  
|  
|  
|  
|
|  
|  
|二级分区与一级分区的分区键不一样,- 单列
- 多列（最大16列）
,（1）部分不一样,（2）全部不一样|  
|  
|  
|
|  
|  
|二级分区是否使用模板,- 全部使用模板
- 部分使用模板，部分详细定义
- 全都不使用模板，详细定义每个二级分区
- 全都不使用模板，也不定义二级分区（默认创建一个high value bound全部是max value的二分区）
|分区条件,指定表空间：加密……！,嵌套表udt（拦截），lob，,二级分区键加索引，加约束|  
|  
|
|  
|  
|二级  分区有MAXVALUE|  
|  
|  
|
|  
|（1）range-list,（2）list-list,（3）hash-list|二级分区与一级分区的分区键一样,- 单列
- 多列（最大16列）
,  
|  
|  
|  
|
|  
|  
|二级分区与一级分区的分区键不一样,- 单列
- 多列（最大16列）
,（1）部分不一样,（2）全部不一样|  
|  
|  
|
|  
|  
|二级分区是否使用模板,- 全部使用模板
- 部分使用模板，部分详细定义
- 全都不使用模板，详细定义每个二级分区
- 全都不使用模板，也不定义二级分区（默认创建一个high value bound为default的二级分区）
|  
|  
|  
|
|  
|  
|二级分区有default|  
|  
|  
|
|  
|（1）range-hash,（2）list-hash,（3）hash-hash|（1）二级分区与一级分区的分区键一样,- 单列
- 多列（最大16列）
|  
|  
|  
|
|  
|  
|（2）二级分区与一级分区的分区键不一样,- 单列
- 多列（最大16列）
,（1）部分不一样,（2）全部不一样|  
|  
|  
|
|  
|  
|（3）二级分区是否使用模板,- 全部使用模板
- 部分使用模板，部分详细定义
- 全都不使用模板，详细定义每个二级分区
- 全都不使用模板，也不定义二级分区（默认只创建一个二级hash分区）
|  
|  
|  
|
|  
|  
|（4）二级分区是hash分区，覆盖  只指定分区数|  
|  
|  
|
|二级分区存储属性|表空间|default,mms,自定义表空间,是否  指定PCTFREE/PCTUSED/INITRANS/MAXTRANS|  
|  
|  
|
|  
|是否立即创建segment|立即生成：segment creation immediate,延迟生成：segment creation deferred,不指定：默认为deferred|  
|  
|  
|
|数据文件编码与数据库编码|  
|- utf-8
- gdk
- ascii
- iso8859-1
|  
|  
|  
|
|csv文件|内容|csv文件所有记录都在一个子分区,csv文件记录随机在某个子分区,csv文件字段值与表数据类型不一致,含有空值|  
|  
|  
|
|  
|大小|- 大数据量
- 空
- 128K
- 超过2M
|  
|  
|  
|
|  
|csv文件的列与表的列数不一致|（1）csv文件列数<表列数,- csv列数<load语句列数
- csv列数=load语句列数
- csv列数>load语句列数
,（2）csv文件列数=表列数,（3）csv文件列数>表列数,（4）load语句中不包含分区键的列,- 不包含一级分区键
- 不包含二级分区键
- 均不包含
|  
|  
|  
|
|并行度|  
|1,2,8,256|  
|  
|  
|
|数据与导入对象关系|结合trailing nullcols|单文件单表,单文件多表,多文件单表,多文件多表（覆盖非分区表，一级分区表，二级分区表）|  
|  
|  
|
|与其他options结合|ENABLE_BULK|true,- heap（bcp)
- lsc(bulkload)  压缩属性，字典编码，ac
,false|服务端：ENABLE_BULK  值为TRUE，HEAP表使用bcp模式导入，LSC表使用bulkload模式导入，不支持导入TAC表。,客户端：ENABLE_BULK值为TRUE时，yasldr工具使用bulkload模式导入LSC表，不支持导入TAC和HEAP表|  
|  
|
|  
|RUN_LEVEL文件拆分|拆分后导入，二级分区表按二级分区键拆分，  二级分区键不在|只有客户端有，服务端没有|  
|  
|
|表中含有lob列|  
|LOBFILE模式导入,lls模式导入|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|
|并发场景|  
|导入数据和DDL（drop、truncate、alter（增删分区）、create）并发    
  导入数据和DML（delete、insert、update）并发    
  导入数据和DQL(查询表、查询视图等)并发    
  多个会话同时导入|  
|  
|  
|
|异常场景|  
|导入过程中ctrl+c,导入过程中session被强杀,导入过程中数据库节点异常,导入过程中数据库配置large_pool_size不足|  
|  
|  
|


# 5. 测试用例 

# 6. 测试框架设计

本次测试采用导入导出测试框架实现。

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-7-27_19-8-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmVhMWFkOWEzMzExZGM3Njg4IiwicmVmX2lkIjoiNjczOTY5NmU1OTNmOTljOWZmMjM0ZWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDYxLCJleHAiOjE3ODIyMTM4NjF9.qFDj1kZTt-tkmXycXb3Rsj9GMjKrHW7rct3pL6NAg04)

 (image/png)    


[image2023-7-27_19-9-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmVhMWFkOWEzMzExZGM3Njg5IiwicmVmX2lkIjoiNjczOTY5NmU1OTNmOTljOWZmMjM0ZWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDYxLCJleHAiOjE3ODIyMTM4NjF9.LK8z0WWO5nEW4sFrT5k2NQcX5yei6rIN6gyWkPSD7zk)

 (image/png)    


[image2023-7-27_19-8-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmVhMWFkOWEzMzExZGM3NjhhIiwicmVmX2lkIjoiNjczOTY5NmU1OTNmOTljOWZmMjM0ZWIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDYxLCJleHAiOjE3ODIyMTM4NjF9.R-e9TWM0TbjtnkX12S68HHSEqRouUbJY-ImwOTFm7mE)

 (image/png)    
