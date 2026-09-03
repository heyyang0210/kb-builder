Created by 孟麟, last modified on 十二月 18, 2023

# **dblink视图功能测试设计**

# 1. 概述

  [YDBRD-22623](https://jira.yasdb.com/browse/YDBRD-22623?src=confmacro)    *-*  *DBLINK的DFX视图添加*  *完成*

新增dblink 4个视图，用于dblink元数据观测。  基于Yashan的  视图框架  添加四个DFX视图，单机两个（V$DBLINK_OBJ_STAT、V$DBLINK_MEM_STAT），集群两个（GV$DBLINK_OBJ_STAT、V$DBLINK_MEM_STAT），集群视图比单机多实例ID字段，其他字段含义和存储内容一致。

# 2. 需求分析

## 2.1 功能点分析

1、单机视图：V$DBLINK_OBJ_STAT

本视图显示所有database link在沙箱进程yex_server上创建的对象的相关统计信息，每个link一行记录，与开发确认，补充‘字段分析说明’：

|字段|类型|描述|字段分析|
|:---|:---|:---|---|
|EXT_OBJ_ID|INTEGER|对象ID|yex_server进程中的link id信息，与数据库没有关联|
|EXT_OBJ_NAME|VARCHAR(64)|对象名称|dblink名称，与dba_db_link视图中db_link字段一致|
|EXT_OBJ_USERID|INTEGER|对象USERID|与dba_user中user_id字段一致|
|~~EXT_OBJ_VERSION~~|~~INTEGER~~|~~对象版本号~~|与开发对齐删除,~~1、首次创建时=0，每次alter +1，drop后归0（drop时如果还有正在使用的，使用完后才归0）~~,~~2、再次被创建后为0，后续alter和drop操作同上~~|
|EXT_OBJ_VALID|BOOLEAN|对象是否有效，TRUE表示有效，FALSE表示无效|1、  初始默认值是false（创建未使用），被使用后false->true,2、drop/alter时，存在正在使用的，仍为true，使用完true→false，drop/alter操作后本条记录会被删除,3、drop/alter时，不存在正在使用的true->false，drop/alter操作后本条记录会被删除|
|EXT_OBJ_REF|INTEGER|对象被引用的计数值|当前正在被使用计数：,1、相同语句中多处使用（相同表，不同表），出现几处，计数就为几,2、并发场景，多语句同时使用，计数=每个语句中出现次数和|


2、单机视图：V$DBLINK_MEM_STAT

本视图显示所有database link在沙箱进程yex_server上使用的内存的相关统计信息，固定2行分别是yashan、oracle，当前不体现不支持的mysql和odbc，与开发确认，并补充‘字段分析说明’：

|字段|类型|描述|字段分析|
|:---|:---|:---|---|
|EXT_DRIVER_NAME|VARCHAR(64)|驱动名称|固定2种：yashan、oracle|
|~~EXT_DRIVER_INIT~~|~~BOOLEAN~~|~~驱动是否已初始化，TRUE表示已初始化，FALSE表示未初始化~~|沟通后删除,~~1、首次拉起未被使用为false；被使用中false->true；yex_server kill后拉起为true/false->false~~,~~2、true->false：使用结束~~|
|EXT_CONNECTION_COUNT|INTEGER|驱动上与远程数据库建立连接的数量|计数=正在被使用中的link数,1、同一个link被多处使用，出现几处，计数就为几,2、多个link被同时使用，为每个link使用计数之和|
|EXT_CONNECTION_MEMORY|INTEGER|驱动上连接占用内存大小|1、>0，有link正在被使用，使用的link越多，值越大,2、=0，无link被使用|
|EXT_STATEMENT_MEMORY|INTEGER|驱动上语句执行资源占用内存大小|1、>0，与语句有关，相同表的查询，返回的结果集越大，值越大,2、=0，无link被使用|


3、集群视图：GV$DBLINK_OBJ_STAT，与单机V$DBLINK_OBJ_STAT功能一致，集群各实例汇总信息

|字段|类型|描述|字段分析|
|:---|:---|:---|---|
|INST_ID|NUMBER|实例ID|当前执行查询所在的集群实例ID|
|EXT_OBJ_ID|INTEGER|对象ID|同单机|
|EXT_OBJ_NAME|VARCHAR(64)|对象名称|同单机|
|EXT_OBJ_USERID|INTEGER|对象USERID|同单机|
|~~EXT_OBJ_VERSION~~|~~INTEGER~~|~~对象版本号~~|~~1、同单机~~,~~2、不同实例上操作表现一致~~|
|EXT_OBJ_VALID|BOOLEAN|对象是否有效，TRUE表示有效，FALSE表示无效|1、同单机,2、不同实例上操作表现一致|
|EXT_OBJ_REF|INTEGER|对象被引用的计数值|1、同单机,2、不同实例上同时使用，计数累积|


4、V$DBLINK_MEM_STAT，与单机V$DBLINK_MEM_STAT功能一致，集群每个实例独立

|字段|类型|描述|字段分析|
|:---|:---|:---|---|
|INST_ID|NUMBER|实例ID|当前查询所在的集群实例ID|
|EXT_DRIVER_NAME|VARCHAR(64)|驱动名称|同单机|
|~~EXT_DRIVER_INIT~~|~~BOOLEAN~~|~~驱动是否已初始化，TRUE表示已初始化，FALSE表示未初始化~~|NA|
|EXT_CONNECTION_COUNT|INTEGER|驱动上与远程数据库建立连接的数量|同单机|
|EXT_CONNECTION_MEMORY|INTEGER|驱动上连接占用内存大小|1、同单机,2、不同实例上执行表现一致|
|EXT_STATEMENT_MEMORY|INTEGER|驱动上语句执行资源占用内存大小|1、同单机,2、不同实例上执行表现一致|


## 2.2 应用场景

1、单机和集群dblink元数据管理和使用场景

2、其他特性关联：无

## 2.3 规格约束

1、支持单机和集群

2、可以观测Yashan->Yashan、Yashan->Oracle两种数据库链接的使用情况

# 3. 详细测试设计

## 3.1 测试设计方法

视图各字段的测试设计方法，针对字段取值：使用边界值，等价类，以及场景分析法

## 3.2 详细测试设计

1、视图通用测试点

见xmind

2、单机V$DBLINK_OBJ_STAT，元数据的状态强相关

（1）整体上，1）create、alter、drop操作组合；2）创建1024，使用/alter，drop；3）创建超过1024，使用/alter，drop；验证记录的数量与dba_db_link是否一致，字段值是否正确。

（2）针对每个字段的状态，单独分析测试场景：

|字段|类型|描述|字段分析|测试点分析|
|:---|:---|:---|---|---|
|EXT_OBJ_ID|INTEGER|对象ID|yex_server进程中的link id信息，与数据库没有关联|不关注|
|EXT_OBJ_NAME|VARCHAR(64)|对象名称|dblink名称，与dba_db_link视图中db_link字段一致|与dba_db_link、all_db_link、user_db_link进行关联查询|
|EXT_OBJ_USERID|INTEGER|对象USERID|与dba_user中user_id字段一致|与dba_user进行关联查询|
|~~EXT_OBJ_VERSION~~|~~INTEGER~~|~~对象版本号~~|~~1、首次创建时=0，每次alter +1，drop后归0（drop时如果还有正在使用的，使用完后才归0）~~,~~2、再次被创建后为0，后续alter和drop操作同上~~|~~1、alter时，link正在被使用~~,~~2、drop时，link正在被使用~~,~~3、反复create-alter-drop相同link~~|
|EXT_OBJ_VALID|BOOLEAN|对象是否有效，TRUE表示有效，FALSE表示无效|1、  初始默认值是false（创建未使用），被使用后false->true,2、drop/alter时，存在正在使用的，仍为true，使用完true->false，drop操作本条记录会被删除，alter会保留,3、drop/alter时，不存在正在使用的true->false，drop操作本条记录会被删除，alter会保留|同EXT_OBJ_VERSION|
|EXT_OBJ_REF|INTEGER|对象被引用的计数值|当前正在被使用计数：,1、相同语句中多处使用（相同表，不同表），出现几处，计数就为几,2、并发场景，多语句同时使用，计数=每个语句中出现次数和|1、语句类型：DML（select，insert，update，delete，insert select）,2、使用link，出现的位置和数量,（1）1条语句中相同表多处使用,（2）1条语句中不同表多处使用,（3）多条语句中同时使用,（4）pl/sql中多处使用；cte；yasql执行SQL文件|


3、单机V$DBLINK_MEM_STAT，与使用link强相关

|字段|类型|描述|字段分析|测试点分析|
|:---|:---|:---|---|---|
|EXT_DRIVER_NAME|VARCHAR(64)|驱动名称|固定2种：yashan、oracle|创建并使用yasdb->yasdb，yasdb->oracle的link|
|~~EXT_DRIVER_INIT~~|~~BOOLEAN~~|~~驱动是否已初始化，TRUE表示已初始化，FALSE表示未初始化~~|沟通后删除,1、首次拉起未被使用为false；被使用中false->true；yex_server kill后拉起为true/false->false,2、true->false：使用结束|NA|
|EXT_CONNECTION_COUNT|INTEGER|驱动上与远程数据库建立连接的数量|计数=正在被使用中的link数,1、同一个link被多处使用，出现几处，计数就为几,2、多个link被同时使用，为每个link使用计数之和|1、单link场景同：EXT_OBJ_REF,2、多link场景（1）1条语句出现2+个不同link，出现1次（2）1条语句出现2+个不同link，出现多次（3）多语句中同时使用|
|EXT_CONNECTION_MEMORY|INTEGER|驱动上连接占用内存大小|1、>0，有link正在被使用，使用的link越多，值越大,2、=0，无link被使用|场景同上，观察合理性：link使用越多，内存越大|
|EXT_STATEMENT_MEMORY|INTEGER|驱动上语句执行资源占用内存大小|1、>0，与语句有关，相同表的查询，返回的结果集越大，值越大,2、=0，无link被使用|1、相同表，查询返回不同数据量，观察内存大小合理性,2、不同表，查询返回不同数量，观察内存大小合理性|


5、集群GV$DBLINK_OBJ_STAT，全局

（1）单实例上执行用例与单机相同

（2）不同实例上执行，表现一致，计数累积

6、集群V$DBLINK_MEM_STAT，实例独立

（1）单实例上执行用例与单机相同

（2）不同实例上执行表现一致，相互独立

7、其他专项分析

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及，加入查询视图的语句|
|KT|涉及，yasdb/yex_server故障，加入查询视图的语句|
|长稳|涉及，加入查询视图的语句|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


# 4. 测试用例

# 5. 测试框架设计

功能使用guider框架可满足，专项使用testkill等框架可满足。

# 6. 测试环境说明

通用测试环境，无特殊要求

# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：11-24

## Attachments:

[YDBRD-22623_dblink新增视图-测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjI4OTcwYzJhZjRmNTIwNjU5IiwicmVmX2lkIjoiNjczOTZiYjI3MjgyMDZlZmI5MmYwOTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MzYwLCJleHAiOjE3ODIzODI3NjB9.5PjJ9L8FOQyIp34joi6Y0bYqAz5QXPQg1Myp2KyCSvQ)

 (application/x-xmind)    


[YDBRD-22623文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjI4OTcwYzJhZjRmNTIwNjVhIiwicmVmX2lkIjoiNjczOTZiYjI3MjgyMDZlZmI5MmYwOTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MzYwLCJleHAiOjE3ODIzODI3NjB9.Gtd4NRU2Fa8_CdWnTZgkQMdMqrnoR5V1BDFeBc2trFc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
