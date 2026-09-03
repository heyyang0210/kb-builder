Created by 张志鹏, last modified on 八月 01, 2024

  


#   [YDBRD-26538](#ydbrd-26538)  

IR链接：    [https://pingcode.yasdb.com/ship/ideas/667d13945d57e18ea9d3bff1](https://pingcode.yasdb.com/ship/ideas/667d13945d57e18ea9d3bff1)  

SR链接：    [https://pingcode.yasdb.com/pjm/items/YDBRD-30199](https://pingcode.yasdb.com/pjm/items/YDBRD-30199)  

##   [1. Overview（概述）](#1-overview概述)  

需求背景：数研院场景，一主多备数据库主机故障之后，数据库重启之后，可以启动到read only状态，对外提供只读访问。    
  主库支持read only特性

##   [2. Features（功能特性）](#2-features功能特性)  

alter database open read only来将主库启动到只读状态。    
  只支持单机。    
  oracle参考：     [https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/ALTER-DATABASE.html#GUID-8069872F-E680-4511-ADD8-A4E30AF67986__I2135540](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/ALTER-DATABASE.html#GUID-8069872F-E680-4511-ADD8-A4E30AF67986__I2135540)      
  Specify OPEN READ ONLY to restrict users to read-only transactions, preventing them from generating redo logs. This setting is the default when you are opening a physical standby database, so that the physical standby database is available for queries even while archive logs are being copied from the primary database site.

Restrictions on Opening a Database

The following restrictions apply to opening a database:

You cannot open a database in READ ONLY mode if it is currently opened in READ WRITE mode by another instance.

You cannot open a database in READ ONLY mode if it requires recovery.

You cannot take tablespaces offline while the database is open in READ ONLY mode. However, you can take data files offline and online, and you can recover offline data files and tablespaces while the database is open in READ ONLY mode.

##   [3. Interfaces（接口）](#3-interfaces接口)  

ALTER DATABASE OPEN READ ONLY/WRITE;  -- read only状态后不可接resetlogs或者upgrade状态    
  alter database open；--缺省情况是：主机以read write启动，备机以read only启动

如下为oracle语法图

![](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/img/startup_clauses.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFrQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MDEsImV4cCI6MTc4MjQ0OTQwMX0.GJZt0oC6d0bw-IgnnC8FNSaGz3imJWswCOfZL1F2zZI)

yashan当前支持语法

![](https://pingcode.yasdb.com/atlas/files/public/67396ea38970c2af4f5219f1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFrQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MDEsImV4cCI6MTc4MjQ0OTQwMX0.GJZt0oC6d0bw-IgnnC8FNSaGz3imJWswCOfZL1F2zZI)

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

与oracle的区别：    
  非一致性关闭，可以启动到open read only模式，会先进行recover,回放redo，但不回滚事务。    
  不可以offline操作

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

以是否会产生redo日志为标准，判断原来代码中判断DB_IS_PRIMARY才能执行的动作，是否替换成READ_WRITE模式才能执行。read only启动不切redo文件。

###   [5.1 Architecture（架构）](#51-architecture架构)  

略

###   [5.2 Data Structures & Flow（数据结构与流程）。](#52-data-structures--flow数据结构与流程)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

不涉及

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

无新增sql语法，审计，权限不涉及。    
  v$logfile，USED_BLOCKS字段查看redo数量，视图内容不变。v$database flush point可通过v$database视图open_mode查看open状态

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

read only主库，只提供只读服务，原则上和备机功能基本一致。备机open read only启动， read write报错。备机switch over是以什么模式启动。（尝试oracle）

alter database open readonly;对主机的影响：

1. 禁止DML
1. 执行DDL，结果同备机，如果备机不能执行，主机也不行，如有发现特殊情况再讨论。
1. 备份，备份不写系统表，同备机。
1. 表空间迁移拦截
1. 导入导出（需要确定是否使用临时表）备机的影响：


##   [7.资料设计章节](#7资料设计章节)  

alter database文档

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

略

## Attachments:

[image2024-5-16_11-35-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTM4OTcwYzJhZjRmNTIxOWVjIiwicmVmX2lkIjoiNjczOTZlYTM3MjgyMDZlZmI5MmYyYTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjAxLCJleHAiOjE3ODI1MjUwMDF9.2XMeSWHbHl93OxDFRkNObq9kDeTPntHdxeR4lKKcr7E)

 (image/png)    


[image2024-5-14_11-41-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTNhMWFkOWEzMzExZGM5ODYwIiwicmVmX2lkIjoiNjczOTZlYTM3MjgyMDZlZmI5MmYyYTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjAxLCJleHAiOjE3ODI1MjUwMDF9.yaQCHNRFXspo-H-jYQRxx8yY1uEXm-B4OrIsM1Z9hf4)

 (image/png)    


[image2024-5-14_10-46-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTM4OTcwYzJhZjRmNTIxOWVkIiwicmVmX2lkIjoiNjczOTZlYTM3MjgyMDZlZmI5MmYyYTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjAxLCJleHAiOjE3ODI1MjUwMDF9.a_mQvDyIm66de1tUojM6jDTPsKvj3veDkMQj9HbPVOg)

 (image/png)    


[image2024-5-14_10-18-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTM4OTcwYzJhZjRmNTIxOWVlIiwicmVmX2lkIjoiNjczOTZlYTM3MjgyMDZlZmI5MmYyYTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjAxLCJleHAiOjE3ODI1MjUwMDF9.-RNz5gu1a090iXO0J__21Ywl7Rww6lcFqHDBjoQeCIE)

 (image/png)    


[image2024-5-14_10-18-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTNhMWFkOWEzMzExZGM5ODYxIiwicmVmX2lkIjoiNjczOTZlYTM3MjgyMDZlZmI5MmYyYTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjAxLCJleHAiOjE3ODI1MjUwMDF9.zoY2uG_DdMlaJ8cYzPZS0E9gYmmQSF2GzXcaG-eBZFU)

 (image/png)    


[image2024-5-14_10-18-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTM4OTcwYzJhZjRmNTIxOWVmIiwicmVmX2lkIjoiNjczOTZlYTM3MjgyMDZlZmI5MmYyYTIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjAxLCJleHAiOjE3ODI1MjUwMDF9.A0_rcrCJTfbpY5BP_XCyT1FM5BJp-eioJpAF-7GI8_s)

 (image/png)    


## Comments:

|  [](null)  ,开发设计评审会议纪要：,1.时间： 2024/08/08,2. 与会人：李燕琼，张志鹏，马志宏，马爽，郑荃,遗留TODO: 导出是否依赖临时表，read only下不能创建临时表。,Posted by zhangzhipeng at 八月 16, 2024 18:28|
|---|
