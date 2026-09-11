Created by 郑荃, last modified by  刘大境 on 十一月 27, 2023

# 1. 概述

基础DDL操作，用户如果创建错误或者重新规划表空间名称，目前需要重建表空间，代价很大。

支持rename tablespace，在线重命名表空间，  ALTER     TABLE  SPACE old_tablespace_name RENAME   TO   new_tablespace_name;

# 2. 需求分析

SR：    [YDBRD-21551](https://jira.yasdb.com/browse/YDBRD-21551?src=confmacro)    -  支持rename tablespace，在线重命名表空间  完成

设计：    [RENAME TABLESPACE设计文档](135595272.html)  

## 2.1 功能点分析

语法：

ALTER     TABLESPACE     space_old_name     RENAME     TO     space_new_name;

- RENAME TABLESPACE仅会修改表空间名称，不会修改表空间ID
- RENAME TABLESPACE会更新数据库中所有对表空间名引用，包括控制文件、数据字典


## 2.2 应用场景

- 需求本身的主要应用场景：
    - 用户创建了错误的表空间或者需要重新规划表空间的名称时，重建表空间
- 需求与其他特性的关联场景：
    - 表空间相关对象：rename后各种创建、修改、删除、查询对象的操作正常。 对象跟表空间有关系（表、BTREE、AC、LOB、RTREE、物化视图）
    - 约束、依赖关系：renmae以后  表空间中存储的对象之间的依赖关系正常：外键约束、触发器等
    - 备份恢复、表空间迁移：rename以后备份恢复、表空间迁移正常
    - 表空间各种操作：rename表空间的各种操作正常（online、offline、add/drop datafile、shrink tablespace）
    - 视图：rename以后表空间的各种统计信息查询跟rename前（v$tablespace、v$datafile、DBA_FREE_SPACE、DBA_TABLESPACE、DBA_DATA_FILES、DBA_DATA_BUCKETS、DBA_SEGEMETNS）
    - DDL：rebuild index使用rename后的表空间


## 2.3 规格约束

- 不能重命名内置表空间
- 不能重命名OFFLINE表空间
- 不能重命名为已存在的表空间


# 3. 详细测试设计

## 3.1 测试设计方法

*语法：主要采用等价类划分的方式，划分有效等价类和无效等价类进行覆盖*

*功能：*  *采用场景法，验证rename前后跟表空间、以及表空间中的各个对象操作功能正常*

*测试范围*

- 部署模式：单机、集群，分布式（拦截）
- 表空间加密表空间、压缩表空间、自定表空间、bucket表空间、mms表空间、内建表空间（SYSTEM、SYSAUX、TEMP、SWAP、USERS、UNDO）
- 对象：表、索引、AC、LOB、物化视图
- 表：行表、列表、普通表、分区表（一级分区、二级分区）
- 索引：  BTREE、RTREE、普通索引、local索引、唯一索引


测试关注：

- rename后新的表空间alter、drop正常，在新的表空间上对象正常
- rename后旧的表空间不能用
- 表空间和其他对象的视图中表空间信息都已更新成新的表空间


## 3.2 详细测试设计

#### 3.2.1 详细功能测试点:

##### 3.2.1 .1 语法

|输入条件|有效等价类|无效等价类|备注|
|---|---|---|---|
|old_tablespace_name |用户自定义表空间|表空间不存在|  
|
|  
|  
|内置表空间：,USERS、TEMP、SWAP、undo、  SYSTEM、SYSAUX|  
|
|new_tablespace_name|不冲突的新名称|新的表空间与旧的表空间同名|  
|
|  
|  
|跟已有的其他表空间重名（自建、内建）|  
|
|  
|  
|不符合对象命名规范的名称,1、以数字、特殊字符开头,2、超过对象上限,3、包含保留字|  
,  
|
|rename to关键字|  
|关键字错误、缺失、重复|  
|


##### 3.2.1 .2功能场景

功能验证需要结合3.1章节的对象，结合不同场景覆盖所有的测试对象

|测试场景|用例详细描述|预期|备注|
|---|---|---|---|
|rename tablespace功能测试|1、reanme前先在表空间创建对应的对象,2、rename tablespace ,3、查询表空间下所有对象所在的表空间位置是否发生变化,*DBA_TABLES*,*DBA_PART_TABLES*,DBA_TAB_PARTITIONS、,DBA_TAB_SUBPARTITIONS,DBA_INDEXES、,DBA_PART_INDEXES、,DBA_IND_PARTITIONS,DBA_IND_SUBPARTITIONS、,DBA_MIVEWS,DBA_LOB_PARTITIONS、,DBA_LOBS、,DBA_LOB_SUBPARTITIONS、,DBA_LSC_SLICE_STAT、,DBA_ACS,DBA_SEGEMENTS,DBA_USERS,DBA_OBJECTS(查看下状态，失效对象是否一致),V$DICT_DIRECTORY,4、查询该表空间下的所有对象,5、查询表空间相关视图,v$tablespace、 v$dafafiles、DBA_TABLESPACE、DBA_DATA_FILES、DBA_FREE_SPACE|2、rename成功,3、查询视图，所有的对象都已经修改到了新的表空间,4、查询对象数据正确,5、已经变成最新的名称，无残留的旧的表空间名称，,视图中其他信息显示正确，表空间ID没有发生变化|*表空间覆盖：加密表空间、压缩表空间、自定表空间、bucket表空间、mms表空间、内建表空间*,对象：表、索引、AC、LOB、物化视图  表：行表、列表、普通表、分区表（一级分区、二级分区）  索引：  BTREE、RTREE、普通索引、local索引、唯一索引|
|  
|rename tablespace，对表空间做修改操作  （online、offline、add/drop datafile、shrink tablespace），查看相关视图|可以修改成功,相关视图信息正确|  
|
|  
|A rename 到A_new，然后再rename 到A，  查看相关视图，  来回rename几次，|可以来回rename，视图也能对应变化|  
|
|  
|A rename 到A_new,drop A，drop  A_new|drop A报表表空间不存在,drop A_new成功|  
|
|  
|1、表空间offline，rename 表空间,2、online表空间，rename表空间|1、rename失败,2、rename成功|  
|
|  
|rename后datafile的路径超过255|rename报错，原有表空间可以正常使用|  
|
|  
|rename read noly表空间|报错|先进行表空间迁移，在rename源端的表空间|
|  
|用户默认表空间为用户自定义表空间，rename表空间，查询DBA_USERS,用户创建表，不指定表空间|用户默认表空间发生变化,默认创建到rename后的表空间|  
|
|rename后对于表的各种操作正常|创建table，指定表到rename后的表空间,创建table，指定表到rename前的表空间|成功，对表增删改查成功,报表空间不存在|表覆盖：行表、列表、普通表、分区表（一级分区、二级分区）、临时表    
    
|
|  
|reaname后，对表空间内的表做alter操作,alter table add column,alter table drop column,alter table modify column,alter table rename,alter table shrink table,alter table alter slice|alter操作成功||
|  
|rename后，对表空间内的表做drop/truncate操作|删除成功，查看表相关视图，也无该表的记录||
|  
|1、开启回收站，drop/truncate表,2、rename tablespace,3、flashback table恢复表|2、可以reanme成功,3、恢复后表到了新的表空间，查看数据也正常||
|  
|  
|  
||
|rename后对于索引的各种操作正常|1、创建索引，指定索引到rename后的表空间,2、创建索引，指定索引到rename前的表空间|1、成功，索引执行计划正确，数据增删改成成功，索引相关视图查询表空间正确,2、报表空间不存在|索引覆盖：  *BTREE、RTREE、普通索引、local索引、唯一索引*,*rebuild index覆盖：普通索引、索引的分区*,  
|
|  
|有A、B、C 3个表空间，A未rename，B rename 到 B_new，C rename到C_new,1、索引创建在A表空间， rebuild  index  B_new表空间,2、索引创建在B表空间，B rename后，索引从B_new rebuild index 到B_new ,3、索引创建在B表空间，B rename后，索引从B_new rebuild index 到C_new |1、rebuild成功，索引相关视图查询表空间已经到B_new上，通过索引查询数据正确，索引执行计划正确,2、rebuild成功，索引相关视图查询表空间已经到B_new上，通过索引查询数据正确，索引执行计划正确,3、rebuild成功，索引相关视图查询表空间已经到C_new上，通过索引查询数据正确，索引执行计划正确||
|  
|rename前，索引为失效状态，rename以后，索引状态依然为失效（invisiable、unusable、useable）|rename前后状态一致||
|rename后，LOB功能正常|表空间A，rename为A_new,1、创建表带LOB类型，指定LOB的表空间在A，rename 表空间A后，查看LOB相关视图，查询和修改LOB数据,2、创建表带LOB类型,指定LOB的表空间在A_new，查看LOB相关视图，查询和修改LOB数据|1、创建成功，rename表空间后，LOB相关视图已经变成最新的表空间，查询和修改LOB数据成功,1、创建成功，LOB相关视图为最新的表空间，查询和修改LOB数据成功|CLOB、BLOB、  JSON|
|rename后，LSC相关功能正常|1、创建LSC表后，插入数据，做alter slice转换,2、构造多个slice，然后做合并,3、表空间A，rename为A_new,4、创建AC，查询LSC、AC相关视图,5、再新增数据，做alter slice转换,6、AC查询,7、对rename前的冷数据，rename后的冷数据做修改，查询,8、查询LSC、AC相关视图|4、创建成功，且相关视图信息正确,5、成功,6、查询数据正确,7、成功,8、相关视图信息正确|LSC覆盖普通表、一级分区、二级分区|
|  
|rename tablespace后， 验证延迟清理，和归档清理功能|功能正常,rename以后可以正常清理|  
|
|物化视图|1、物化视图和基表都在A表空间，A表空间rename A_new，查看物化视图相关视图， 查看物化视图的数据是否正确,2、修改基表数据，然后更新物化视图，物化视图更新成功|1、物化视图和基表相关视图统计正确，物化视图数据查询正确,2、基表数据修改后，物化视图可以刷新成功|  
|
|  
|1、基表在A表空间，物化视图在B表空间，A表空间rename A_new，查看物化视图相关视图， 查看物化视图的数据是否正确,2、修改基表数据，然后更新物化视图，物化视图更新成功|1、物化视图和基表相关视图统计正确，物化视图数据查询正确,2、基表数据修改后，物化视图可以刷新成功|  
|
|  
|1、基表在B表空间，物化视图在A表空间，A表空间rename A_new，查看物化视图相关视图， 查看物化视图的数据是否正确,2、修改基表数据，然后更新物化视图，物化视图更新成功|1、物化视图和基表相关视图统计正确，物化视图数据查询正确,2、基表数据修改后，物化视图可以刷新成功|  
|
|表空间迁移|给表空间中创建表（普通表、分区表）、索引、AC，rename tablespace 然后进行表空间迁移|可以成功迁移，迁移后视图信息正确，对象的功能正常|  
|
|备份恢复|1、rename  tablespace ，并且在新的表空间新增，修改对象，给对象对DML，然后做备份,2、拿备份集恢复,3、恢复成功后查询|2、可以恢复成功，恢复后查询相关视图，依然是rename  后的表空间，数据查询也正确|  
|
|  
|恢复过程中，rename tablespace|  
|  
|
|约束依赖|A表为父表在A表空间，B表为子表在B表空,B 表空间 rename B_new，查看约束关系是否依然生效|外键约束依然存在|  
|
|  
|A表为父表在A表空间，B表为子表在B表空,A 表空间 rename A_new，查看约束关系是否依然生效|外键约束依然存在|  
|
|触发器|A表为  触发对象  在A表空间，B表为  触发事件的表  在B表空,A 表空间 rename A_new，对A表做DML，查看B表是否能够对应触发|可以正常触发|  
|
|拦截|分布式不支持应该拦截|  
|  
|
|集群|复用单机用例，场景上实例1修改表空间，实例1和实例2均进行查询，并对相关对象进行增删改查操作|  
|  
|
|  
|集群启停、在线恢复用例里面，增加一些rename用例(rename 语句添加在用例的靠前位置)|  
|  
|


**3.2.2涉及的测试DFX**

|分类|用例详细描述|预期|备注|
|---|---|---|---|
|HA|1、reanme前先在表空间创建对应的对象,2、在主机上rename tablespace ,3、在备机查询表空间下所有对象所在的表空间位置是否发生变化,4、查询该表空间下的所有对象,5、查询表空间相关视图,v$tablespace、 v$dafafiles、DBA_TABLESPACE、DBA_DATA_FILES、DBA_FREE_SPACE|2、rename成功,3、查询视图，所有的对象都已经修改到了新的表空间,4、查询对象数据正确,5、已经变成最新的名称，无残留的旧的表空间名称，,视图中其他信息显示正确|*DBA_TABLES*,*DBA_PART_TABLES*,DBA_TAB_PARTITIONS、,DBA_TAB_SUBPARTITIONS,DBA_INDEXES、,DBA_PART_INDEXES、,DBA_IND_PARTITIONS,DBA_IND_SUBPARTITIONS、,DBA_MIVEWS,DBA_LOB_PARTITIONS、,DBA_LOBS、,DBA_LOB_SUBPARTITIONS、,DBA_LSC_SLICE_STAT、,DBA_ACS,DBA_SEGEMENTS,DBA_USERS,DBA_OBJECTS(查看下状态，失效对象是否一致)|
|  
|rename tablespace后做switchover|可以switchover成功，switchover成功后检验数据正确|  
|
|CT/KT|rename tablespace +增删改查数据并发|  
|  
|
|  
|多个session并发 rename  tablespace |  
|  
|
|  
|rename  tablespace + create tablespace+drop tablespace并发|  
|  
|
|  
|rename  tablespace + create tablespace+drop tablespace并发+增删改查数据并发|  
|  
|
|  
|长查询，查询过程中，表空间被rename掉|  
|  
|
|  
|rename  tablespace +online/offline|  
|  
|
|  
|rename  tablespace +rebuid index|  
|  
|
|长稳|rename tablespace，然后跑长稳|  
|  
|
|升级|升级成功后，rename表空间|可以rename成功，并且相关表空间和对象功能正常|  
|


|系统级DFX分类|是否涉及|
|---|---|
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


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *功能部分放yasft上看护*
- *HA、备份恢复、表空间迁移放ha_regress上看护*
- *CT/KT放testkill框架看护*


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|linux|
|部署|单机、集群、分布式|


# 7. 工作量评估

工作量：  *2人周*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[支持rename tablespace在线命名表空间名称冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTk4OTcwYzJhZjRmNTIwN2Y5IiwicmVmX2lkIjoiNjczOTZiZTk3MjgyMDZlZmI5MmYwYjg0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODY3LCJleHAiOjE3ODIzODQyNjd9.OAH7CWT_KmK5WqeIv7YvNO82oJyeeRYn8eh9x51ee_U)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
