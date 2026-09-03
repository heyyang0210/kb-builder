*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/675939d5c3c68d84e9d685ff?](https://pingcode.yasdb.com/ship/ideas/675939d5c3c68d84e9d685ff?)  

#YASHAN-3538  分布式支持DBMS_STAT高级包的LOCK/UNLOCK接口

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/67652e0a622069d46dfa8c16?](https://pingcode.yasdb.com/pjm/items/67652e0a622069d46dfa8c16?)  

#YDBRD-36769 分布式支持DBMS_STAT高级包的LOCK/UNLOCK接口



# 1 设计简介

*本文档对YashanDB的plsql模块的分布式统计信息支持加锁和解锁特性进行设计，明确主要的数据结构和主要处理过程，作为后续编码阶段的输入和编码、测试人员的指导。*



# 2 特性概述

有时用户会有以下需求

- 不希望收集某些表的统计信息，例如很大的日志表，耗时多又没什么价值
- 有些经常变动很大表，收集完统计信息后很快就过期，用户希望锁定自己认为是“好的”统计信息，以生成期望的执行计划
- 自动收集统计信息时跳过不想收集的表


等等。所以引入统计信息锁定和解锁功能。单机、集群已经实现，本需求将在分布式实现该功能。

### 

需求来源：

      智工项目

场景：

     1、业务深度使用全表delete和truncate，不能保证统计信息最新导致执行计划不对，需要锁定表的统计信息解决该场景问题

需求描述：

    分布式支持DBMS_STAT高级包的LOCK/UNLOCK接口

需求范围：

1. 分布式


## 

# 4 特性设计



## 4.1 总体方案

放开分布式DBMS_STATS高级包如下接口：

  [**锁定统计信息的存储过程**](#31-锁定统计信息的存储过程)  **：**

|存储过程|功能|
|---|---|
|LOCK_PARTITION_STATS|锁住表下某个分区的统计信息（会锁住对应local分区索引的统计信息）|
|LOCK_TABLE_STATS|锁住表(包括各个分区、子分区)的统计信息，并锁住列、直方图和索引的统计信息|
|LOCK_SCHEMA_STATS|锁住schema下现在所有表的统计信息，不会锁住后续在该schema下新建的表。|




  [**解锁统计信息的存储过程**](#31-锁定统计信息的存储过程)  **：**

|存储过程|功能|
|---|---|
|UNLOCK_PARTITION_STATS|解锁表下某个分区的统计信息|
|UNLOCK_TABLE_STATS|解锁表(包括各个分区、子分区)的统计信息，并解锁列、直方图和相关索引的统计信息|
|UNLOCK_SCHEMA_STATS|解锁schema下现在所有表的统计信息|




**规格与约束：**

1.高级包接口只允许从cn调用。

2.有节点组无正常主节点则上述高级包命令不能执行。

3.匿名块里只允许上述高级包单独调用，不支持和其他程序一起调用。

4.延用单机约束：组合分区表不支持调用UNLOCK_PARTITION_STATS。



1.本质上单机的上述高级包是修改了系统表和dc的flags的isLockedStats位，系统表包含TAB$、IND$、TABPART$、INDPART$，dc 包含IndexDesc、TableDesc、TabPartDesc、IdxPartDesc、BaseStats结构体。

2.lock/unlock_table_stats会同时修改表和索引的标志位；lock/unlock_partition_stats会同时修改分区和分区索引的标志位；lock/unlock_schema_stats会修改schema下所有表的标志位。

3.试图修改锁定object的统计信息会报错：对于单机即gather、set和delete会报错，对于分布式则是gather（分布式当前只支持gather)。

4.ankGatherIndexStats和ankGatherTableStats会自动跳过被lock的分区，不会报错；ankGatherSchemaStats和ankGatherDatabaseStats会自动跳过被lock的表，不会报错



## 4.2 功能设计

### 4.2.1 高级包命令下发

1.高级包命令需要全部cn、mn主节点、全部dn主节点执行。

2.通过分布式高级包框架，即分布式一阶段提交ddl流程：(不更新oid的version)

               1. 一阶段执行DDL MN节点执行成功后就commit提交.

               2. MN执行成功之后，后续步骤执行失败都通过异步推送方式保证元数据一致.

![clipbord_1737422972508.png](https://pingcode.yasdb.com/atlas/files/public/678ef881a1ad9a3311de6f17/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDU0NjYsImV4cCI6MTc4MjM1NjI2Nn0.3oiPC__Sqoq-ESk-qxch3oKZGsLZjrPaeJLwsOXHSLs)

3.推送：（收到推送消息的节点对于一般ddl是在preverify和verify阶段根据oid和version进行判断该ddl是否已经执行）

     本高级包命令不在preverify和verify阶段判断是否已经执行，而是在高级包更新系统表前增加判断，dc的标志位是否和修改的值一样，一样则不更新系统表和dc，并返回成功。

     原因：执行阶段以前，不能获取到准确的入参，也即拿不到def，只能通过mn发过来的ddlContext.oid进行判断，这样只能去系统表读该oid对应的flags；但是对于table/partition，还要读其下的索引/分区索引判断，对于schema，需要读其下所有的表来判断，这样的操作不如直接利用高级包的实现。



4.提交：

   各节点执行完即提交。



5.分布式收集统计信息（当前：cn下发命令，第一个dn调用单机高级包gather接口，发送过来后cn调用set接口更新系统表）：

   5.1 cn对于不同对象进行set前，均需要进行判断dc是否已经被锁，被锁则跳过；对于column，判断其所属table dc是否被锁，被锁则跳过。



### 4.2.1 并发控制

用分布式对象锁来保证分布式DDL和异常推送并发执行，通过分布式对象锁保证并发处理。

|操作类型|对象类型|对象锁id|对象锁类型|
|---|---|---|---|
|lock/unlock schema|user|user id|exclusive lock|
|lock/unlock table|table|table owner user id|shared lock|
|||table oid|exclusive lock|
|lock/unlock partition|table partition|table owner user id|shared lock|
|||table oid|shared lock|
|||partition oid|exclusive lock|




# 5 资料设计

修改doc/产品文档/开发手册/PL参考手册/内置高级包/DBMS_STATS.md



# 6 自测用例设计

|测试场景|测试步骤|预期|备注|
|---|---|---|---|
|高级包命令下发|cn执行高级包，全部cn、mn主节点、全部dn主节点对应系统表对应标志位是否改变|正确改变||
|被锁后收集统计信息|修改锁定object的统计信息|报错||
||锁定某个partition，收集表统计信息|跳过锁定的分区，返回成功||
||锁定某张表，收集schema统计信息|跳过锁定的表，返回成功||
||锁定某个schema，收集database统计信息|跳过锁定的表，返回成功||
|执行lock/unlock时某个dn/cn异常|执行lock/unlock时某个dn/cn异常|报错，后台推送保持元数据一致||
|执行lock/unlock时mn异常|执行lock/unlock时mn异常|报错，元数据回滚||
|并发|lock / unlock并发|成功||
||lock/unlock和收集统计信息并发|成功||
|权限控制|连接dn、mn执行高级包命令 |拦截报错||
||测试不同角色执行该高级包表现|||


## 

