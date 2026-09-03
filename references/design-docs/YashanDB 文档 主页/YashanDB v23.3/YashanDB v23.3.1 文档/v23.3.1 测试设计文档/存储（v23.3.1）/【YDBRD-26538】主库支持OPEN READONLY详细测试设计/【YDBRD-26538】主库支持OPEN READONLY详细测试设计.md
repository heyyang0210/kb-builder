Created by 马爽, last modified on 八月 23, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/667d13945d57e18ea9d3bff1](https://pingcode.yasdb.com/ship/ideas/667d13945d57e18ea9d3bff1)  

SR链接：    [https://pingcode.yasdb.com/pjm/items/YDBRD-30199](https://pingcode.yasdb.com/pjm/items/YDBRD-30199)  

开发设计文档：    [READ ONLY DATABASE详细设计 - 张志鹏 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159446535)  

# 1. 概述

在单机一主多备的环境下，主机故障之后能够以open readonly状态重启数据库，对外提供只读访问。

# 2. 需求分析

## 2.1 功能点分析

### 2.1.1 sql功能图

支持在nomount以及mount状态下执行alter database open readonly（兼容语法alter database open read only)，使主库启动到只读状态。

![](https://pingcode.yasdb.com/atlas/files/public/67396e8b8970c2af4f521941/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)

### 2.1.2 功能点分析

- open readonly状态下对外提供只读，不会发生写redo操作，不会产生任何redo日志
- 仅支持在nomount以及mount状态下执行alter database open readonly，一旦启动到open readonly/readwrite/  resetlogs/upgrade状态，除非重启否则将无法改变状态
- 主库启动到open readonly状态，角色仍为primary
- 备库天然支持alter database open readonly
- alter database open；--缺省情况是：主机以read write启动，备机以read only启动


### 2.1.3 与oracle的区别

a. 非一致性关闭的情况下，可以启动到open read only模式，会先进行recover，回放redo，但不回滚事务

b. 不可以执行offline操作，包含tablespace以及datafile（  alter database datafile file_name offline）

### 2.1.4 redo日志相关观测手段

（1）yasminer解析

yasminer -r redofile 【-n 】

参考手册：    [yasminer工具使用说明 - 陈晓晴 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=72778888)  

（2）v$logfile

used_blocks：  redo文件已使用的页面数量，值不变-→视图内容应不变

（3）v$database

flush_point：数据库当前日志刷盘点，格式{rst}  *{asn}*  {blockid}_{lfn}，值应不变

open_mode：启动模式，查看当前数据库状态

## 2.2 应用场景

### 2.2.1 需求本身的主要应用场景

主库发生故障后，以open readonly状态重启数据库，可以保存特定时间点数据以备后续分析，原则上和备机功能基本一致

### 2.2.2 需求与其他特性的关联

不涉及

## 2.3 规格约束

### 2.3.1 需求定义的规格、约束，系统/模块上下文等

需求范围：仅支持单机ha

约束限制：open readonly模式下只提供只读服务

### 2.3.2 内部机制涉及的规格约束

主机切换到open readonly状态下，任何涉及写redo操作都会拦截报错

1. 禁止DML
1. 执行DDL，结果同备机，如果备机不能执行，主机也不行，如有发现特殊情况再讨论。
1. 备份恢复，open readonly模式下仅支持全量备份+force
1. 表空间迁移拦截
1. 导入导出（需要确定是否使用临时表） 备机的影响，导出支持，导入不支持
1. 支持build


# 3. 详细测试设计

## 3.1 测试设计方法

1、主库发生故障后，以open readonly状态重启数据库，原则上和备机功能基本一致，需要复制单机ha工程作为临时上车工程，保证主库以open readonly状态启动已有业务执行表现同备机一致

2、新增功能场景重点需要观测主库open readonly状态下不会产生任何redo日志，可以采用场景法进行测试

## 3.2 详细测试设计

### 3.2.1 专项覆盖

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及，已有CI工程覆盖|
|KT|涉及，已有CI工程覆盖|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


### 3.2.2 基本场景测试

|测试项|测试场景|参考步骤|预期结果|备注|
|---|---|---|---|---|
|open readonly启动|主机启动到open readonly|1、单机ha，主机故障后以nomount状态重启，执行alter database open readonly,2、主机故障后以mount状态重启，执行alter database open readonly,3、接着执行alter database nomount/mount/open readonly|readwrite|  resetlogs|upgrade报错,4、主机故障后以open状态重启，执行alter database open readonly报错,5、主机故障后以nomount重启，执行alter database open readwrite，再次执行执行alter database open readonly报错,6、主机故障后以nomount重启，执行alter database open upgrade，再次执行执行alter database open readonly报错,7、主机故障后以nomount重启，执行alter database open   resetlogs  ，再次执行执行alter database open readonly报错|成功，查看v$database的open_mode|  
|
|  
|备机启动到open readonly|1、单机ha，备机故障后以nomount状态重启，执行alter database open readonly,2、备机故障后以mount状态重启，执行alter database open readonly,3、接着执行alter database nomount/mount/open readonly|readwrite|  resetlogs|upgrade报错,4、  备机故障后以open状态重启，执行alter database open readonly报错,5、备机故障后以nomount重启，执行alter database open readwrite(  兼容open readwrite语法，结果为以read only启动  ),6、备机故障后以nomount重启，执行alter database open   upgrade（成功的）,7、备机故障后以nomount重启，执行alter database open   resetlogs报错|成功，查看v$database的open_mode|  
|
|主机open readonly下发业务|主机open readonly+dml业务（heap表）,（普通表、分区表、临时表）,  
|1、单机ha，主机create table，并插入数据,2、主机故障后以nomount状态重启，执行alter database open readonly,3、执行select操作成功,4、执行delete/updtae/insert操作报错|dml操作拦截，查看视图观测redo|  
|
|  
|主机open readonly+dml业务（lsc表）,  
|1、单机ha，主机create table，并插入数据,2、主机故障后以nomount状态重启，执行alter database open readonly,3、执行select操作成功,4、执行delete/updtae/insert操作报错|dml操作拦截，查看视图观测redo|  
|
|  
|主机open readonly+dml业务（tac表）,  
|1、单机ha，主机create table，并插入数据,2、主机故障后以nomount状态重启，执行alter database open readonly,3、执行select操作成功,4、执行delete/updtae/insert操作报错|dml操作拦截，查看视图观测redo|  
|
|  
|主机open readonly+ddl业务(表）|1、单机ha，主机创建对象（表）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、执行ddl操作报错,- create/truncate/drop table
- alter table rename to
- alter table row enable roe movement
- alter table add/drop supplemental log data
- alter table shrink space
- alter table enable/disable transform/compact(lsc表）
- alter table nologging/logging
- alter table add/drop/rename to/modify column
- alter table add/drop/truncate partition/subpartition
|ddl操作拦截，查看视图观测redo|  
|
|  
|主机open readonly+ddl业务(表空间）,(普通表空间、临时表空间、数据桶）|1、单机ha，主机创建对象（表）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、执行ddl操作报错,- create/drop tablespace
- alter tablesapce rename to
- alter tablespace add/drop datafile/tempfile
- alter tablespace add/drop/alter databucket
- alter tablespace shrink space
- alter tablespace online/offline
- alter tablespace datafile/tempfile offline（与oracle进行区分）
|ddl操作拦截，查看视图观测redo|  
|
|  
|主机open readonly+ddl业务(用户+profile）|1、单机ha，主机创建对象（用户+profile）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、执行ddl操作报错,- create/alter/drop user
- create/alter/drop profile
|ddl操作拦截，查看视图观测redo|  
|
|  
|主机open readonly+ddl业务(索引）|1、单机ha，主机创建对象（索引）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、执行ddl操作报错|ddl操作拦截，查看视图观测redo|  
|
|  
|主机open readonly+dcl业务（归档日志切换、参数等）|1、单机ha，主机创建对象（表空间、表）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、执行dcl操作报错|成功？查看视图观测redo|  
|
|  
|主机open readonly+build|1、单机ha，主机创建对象（表、表空间、用户、索引）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、主机向备机全量build--成功,4、主机向备机增量build--成功,5、备机向主机build--成功|成功？查看视图观测redo|  
|
|  
|主机open readonly+备份|1、单机ha，主机创建对象（表、表空间、用户、索引）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、主机进行全量备份（只支持full force强制全量备份）,4、主机进行增量备份 （不支持）,5、主机进行备份恢复,6、恢复完成之后启动到open readonly状态—失败 （  why  ）|成功？查看视图观测redo|  
|
|  
|主机open readonly+表空间迁移|1、单机ha，主机创建对象（表空间）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、主机进行表空间迁移|拦截报错，查看视图观测redo|  
|
|  
|主机open readonly+导入导出,（过程中会不会临时表）|1、单机ha，主机创建对象（表）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、主机进行导入导出（  导出不涉及临时表创建就可以，目前自测不涉及，导入需要写数据，不支持  ）|成功，查看视图观测redo|  
|
|  
|主机open readonly+switchover|1、单机ha，主机创建对象（表）,2、主机故障后以nomount状态重启，执行alter database open readonly,3、备机执行switchover后，下发业务（新主下发业务会同步redo到旧主上，不合符真实使用环境，进校验新主是否可以正常下发业务）|成功？查看视图观测redo|  
|
|  
|主机open readonly+failover|1、单机ha，主机创建对象（表）,2、切换主备之间的链路,3、主机故障后以nomount状态重启，执行alter database open readonly,4、备机执行failover后，下发业务|成功？查看视图观测redo|  
|
|  
|主机open readonly+主备不一致关闭|1、单机ha，主机创建对象（表空间）,2、kill关闭+脏页未落盘（大业务）,3、主机故障后以nomount状态重启，执行alter database open readonly|成功？查看视图观测redo|  
|
|  
|主机open readonly+推低水位线|手动测试,1、单机ha，主机创建对象（表空间和表）,2、全表扫描推低水位线,3、记录redo刷盘的初始值,4、主机故障后以nomount状态重启，执行alter database open readonly,查看是否写redo|优先级放低|  
|
|  
|主机open readonly+事务延迟清理|手动测试,1、单机ha，主机重启设置UNDO_RETENTION较大,2、存在延迟清理的xslot,3、记录redo刷盘的初始值,4、主机故障后以nomount状态重启，执行alter database open readonly,查看是否写redo||  
|
|  
|主机open readonly/read only语法兼容    
  主机open readwrite/read write语法兼容|1、# 单机ha，主机故障后以nomount状态重启，执行alter database open readonly,2、# 主机故障后以mount状态重启，执行alter database open read only,3、# 单机ha，主机故障后以nomount状态重启，执行alter database open readwrite,4、# 主机故障后以mount状态重启，执行alter database open read write||  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

|框架|用例路径|用例个数|
|---|---|---|
|ha_regress,  [【YDBRD-26538】主库支持OPEN READONLY上车 (!10007) · Merge requests · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/merge_requests/10007)  |ha_heap/testcase/     ha_schedule/  ‎open_readonly‎|20|


# 6. 测试环境说明

*linux arm环境*

# 7. 工作量评估

工作量：14  *人天*

计划测试完成时间：2024/8/23

实际测试完成时间：2024/8/23

# 8. 上车工程分析

上车工程链接：    [Agile_br23.3_L2_Build #41 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_br23.3_L2_Build/41/)  

|  
|工程链接|失败用例及原因|解决方法|备注|
|---|---|---|---|---|
|  
|单机|  
|  
|  
|
|1|  [Agile_L2_sa_heap_HA_1_docker #5243 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/5243/)  |ha_schedule/standby_backup.py---待开发确认规格,![](https://pingcode.yasdb.com/atlas/files/public/67396e8b8970c2af4f521942/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE),ha_schedule_common/tablespace/tablespace_Encryption/test_sdv_tpsEncryption_04.py—待开发确认规格,ha_schedule_common/tablespace/tablespace_Encryption/test_sdv_ydbrd_26551_backup_AES128_01.py,![](https://pingcode.yasdb.com/atlas/files/public/67396e8c8970c2af4f521943/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)|跑lastfail，已绿,  [Agile_L2_sa_heap_HA_1_docker #5262 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/5262/)  |  
|
|2|  [Agile_L2_sa_tac_HA_1_docker #5086 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_1_docker/5086/)  |ha/ha_TAC/testcase/ha_schedule/standby_–待开发确认规格,![](https://pingcode.yasdb.com/atlas/files/public/67396e8ca1ad9a3311dc97b5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)|跑lastfail，已绿,  [Agile_L2_sa_tac_HA_1_docker #5096 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_1_docker/5096/)  |  
|
|3|  [Agile_L2_sa_tac_HA_2_docker #5109 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/5109/)  |/ha_TAC/testcase/ha_schedule/Parallel_build/test_sdv_ha_parallelBuild_13.py--待开发确认规格,![](https://pingcode.yasdb.com/atlas/files/public/67396e8ca1ad9a3311dc97b6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)|跑lastfail，已绿,  [Agile_L2_sa_tac_HA_2_docker #5119 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/5119/)  |  
|
|4|  [Agile_L2_sa_lsc_HA_1_docker #5101 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/5101/)  |ha_LSC/testcase/ha_schedule/standby_backup.py–待开发确认规格,![](https://pingcode.yasdb.com/atlas/files/public/67396e8ca1ad9a3311dc97b7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)|跑lastfail，已绿,  [Agile_L2_sa_lsc_HA_1_docker #5111 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/5111/)  |  
|
|5|  [Agile_L2_sa_heap_HA_4_docker #4754 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/4754/)  |ha_schedule_common/db_Privilege/system_Privilege/test_sdv_sysPrivilege_user_001.py--需求合入，预期未刷新|跑lastfail，已绿,  [Agile_L2_sa_heap_HA_4_docker #4764 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/4764/)  |  
|
|6|  [Agile_L2_sa_heap_HA_6_docker #4748 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/4748/)  |ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_06.py,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_09.py,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_basic_10.py,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_01.py ,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_03.py,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_04.py,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_06.py,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_07.py,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_17.py,ha_schedule_backup/backup_yasrman/test_sdv_yasrman_18.py,ha_schedule_backup/backup_specify_baseline/test_sdv_backup_specify_baseline_05.py,![](https://pingcode.yasdb.com/atlas/files/public/67396e8ca1ad9a3311dc97b8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)|跑lastfail,  [Agile_L2_sa_heap_HA_6_docker #4770 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/4770/)  |  
|
|7|  [Agile_L2_sa_heap_yasft_arm #4092 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4092/)  |/CBO/left_join/data_type---YAS-00103 no free block in application pool，内存不足,/DCL/lbac/heap---已知问题单DBRD-31359、YDBRD-31922，忽略,/DFX/audit—预期错误,/POC/shenran1/heap/q9_1—排序问题,/ddl_03—预期错误,/dml3—排序问题,/dml5/batch_orderby---未rebase相关代码，YAS-00004 feature "top n limit / offset not const" has not been implemented yet,/function、/gis---排序问题，数据库重启，预期错误,/plsql—预期错误、YAS-00103 no free block in application pool、数据库重启、已知core,/storage/assm—数据库重启,/storage_object—预期错误，session被断开,/system_view---预期错误|跑lastfail,  [Agile_L2_sa_heap_yasft_arm #4104 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4104/)  ,/heap/DFX/audit—未rebase相关代码,/heap/ddl_03/user/userpwd–预期错误,/heap/dml5/batch_orderby–未rebase相关代码,/heap/gis—未rebase相关代码,/heap/plsql/pkg_plsql_recursion–未rebase相关代码,忽略,  
|  
|
|8|  [Agile_L2_sa_lsc_yasft_arm #3672 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/3672/)  |/datatype/datatype_basic_char/lsc–比对成功,/ddl_01/alter_table/lsc---YAS-02023 deadlock detected while waiting for resource死锁,/dml2、/dml3、/dml4—预期错误，排序问题,/function2/dbms_stats/lsc_stats---YAS-02182 failed to gather statistics, reason: failed to allocate 11048 bytes, ColumnarVmBuffer is not enough，内存不足,/function5/test_sdv_bin/lsc—预期错误,/plsql_DBMS_external_01/dbms_metadata/getddl_table_lsc---预期错误|跑lastfail,  [Agile_L2_sa_lsc_yasft_arm #3683 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/3683/)  ,/ddl_02/index/lsc_unique_index/usingIndex/lsc—同名对象报错，资源死锁,/dml2、/dml4–未rebase相关代码,/function5/test_sdv_bin/lsc/test_sdv_YDBRD_7240_bin_lsc_003—未排查出原因，无关，忽略,/plsql_DBMS_external_01/dbms_metadata/getddl_table_lsc/test_sdv_SR17688_getddl_table_lsc_009—排序问题,/system_view/dynamic_view/dynamic_view_all/ydbrd23517_v_dict_cache---预期错误,  
|  
|
|9|  [Agile_L2_sa_upgrade_FT_2_docker #4287 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/4287/)  |未排查出原因|不涉及升级，忽略|  
|
|10|  [Agile_L2_sa_tac_yasft_arm #3473 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3473/)  |/dml3/join/tac—排序问题,/dml3/test_sdv_update/tac/multi_table_update---YAS-02161 no free space in global temporary table cache，buffer不足,/dml4/fetch/tac/test_sdv_dml_fetch_07–运算问题，无关忽略,/dml5/hashgroup/hash_group_crab_mem---SQL> select avg(c1),sum(c2) from test_sr13176_tb001 group by c1,c2 order by 1,2 limit 3;    
  YAS-05001 can not allocate 520000 bytes from columnar vm buffer，buffer不足|跑lastfail,  [Agile_L2_sa_tac_yasft_arm #3484 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/3484/)  ,/ddl_03/synonym/tac/test_sdv_synonym_01–同名对象报错,/dml3/test_sdv_update/tac/multi_table_update/test_sdv_multi_table_update_sub---YAS-02161 no free space in global temporary table cache,/dml4/fetch/tac/test_sdv_dml_fetch_07—运算问题，无关，忽略,/dml5/hashgroup/hash_group_crab_mem---YAS-05001 can not allocate 520000 bytes from columnar vm buffer|  
|
|11|  [Agile_L2_sa_heap_yasft_profile #702 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/702/)  |/storage_object/profile---预期错误|跑lastfail，profile工程框架有问题，忽略,  [Agile_L2_sa_heap_yasft_profile #712 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_profile/712/)  |  
|
|12|  [Agile_L2_sa_upgrade_FT_1_docker #4292 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/4292/)  |未排查出原因|不涉及升级，忽略|  
|
|13|  [Agile_L2_sa_heap_HA_8_docker #172 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/172/)  |ha_schedule_backup/yasrman_domain/test_yasrman_YDBRD_25048_003.py,![](https://pingcode.yasdb.com/atlas/files/public/67396e8ca1ad9a3311dc97b9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)|跑lastfail，已绿,  [Agile_L2_sa_heap_HA_8_docker #191 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/191/)  |  
|
|14|  [Agile_L2_sa_heap_HA_9_docker #164 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/164/)  |ha_schedule_backup/yasrman_domain/test_yasrman_YDBRD_25048_001.py,ha_schedule_backup/backup_yasrman_xmlfile/test_sdv_ydbrd26670_yasrman01.py,![](https://pingcode.yasdb.com/atlas/files/public/67396e8c8970c2af4f521944/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)|跑lastfail，已绿,  [Agile_L2_sa_heap_HA_8_docker #191 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/191/)  |  
|
|15|  [Agile_L2_sa_heap_driver_jdbc_debug_docker #1730 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/1730/)  |未排查出原因|无关，忽略|  
|
|16|  [Agile_L2_sa_heap_driver_python_debug_docker #1724 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/1724/)  |未排查出原因|重跑，已绿,  [Agile_L2_sa_heap_driver_python_debug_docker #1734 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_python_debug_docker/1734/)  |  
|
|  
|集群|  
|  
|  
|
|1|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3369 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3369/)  |/ddl_03/user/userpwd/case_userpwd_sysview—预期错误,/dml3、/function1—排序问题,/system_view/user_view/TAB_VIEW---预期错误,  
|跑lastfail,  [Agile_L2_cluster_heap_yasft_sa_case_arm #3379 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3379/)  ,/heap/ddl_03/user/userpwd/case_userpwd_sysview--预期错误|  
|
|2|  [Agile_L2_cluster_yasft_cluster_case_arm #3564 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3564/)  |/ddl/profile—用例不稳定,/ddl/tablespace/local_swap_tablespace/test_sdv_YDBRD_21721_cluster_create_swapTS_002—参数配置变更,/ddl_03/trigger/trigger_jiagu—已知问题单,/plsql/pkg_plsql_recursion—预期错误,/plsql_DBMS_external/DBMS_SQL/single_instance/to_cursor_number----YAS-00103 no free block in application pool,/system_view/test_sdv_ydbrd_15210/Cluster_dynamic_view—未rebase相关代码,/ycr/common/test_sdv_cluster_ycr_create_cluster_008—比对成功,/ycr/ycr_syntax---预期错误|跑lastfail,  [Agile_L2_cluster_yasft_cluster_case_arm #3576 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/3576/)  ,/ddl/profile—未rebase相关代码,/ddl/tablespace/local_swap_tablespace/test_sdv_YDBRD_21721_cluster_create_swapTS_002—参数配置变更,/ddl_02/trigger、/ddl_03/trigger/trigger_jiagu—未rebase相关代码,/dfx/cluster_audit/EAL4—未rebase相关代码,/dfx/cluster_audit/cluster_syn_audit/test_sdv_ydbrd_13352_cluster_audit_08---排序问题,/plsql—未rebase相关代码,/storage/checkpoint—无关忽略,/system_view/dba_free_space—配置参数变更,/system_view/dynamic_view/v_view/YDBRD_15209—未rebase相关代码,/system_view/gv_subquery/test_sdv_cluster_18732_select_insert_001—预期错误,/system_view/share_pool/test_YDBRD-28580_CLUSTER_pool_02---,YAS-00103 no free block in dictionary cache,/system_view/test_sdv_ydbrd_15210/Cluster_dynamic_view—预期错误,/ycr/common---无关，忽略|  
|
|3|  [Agile_L2_cluster_yasft_yfs_arm #2984 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/2984/)  |未rebase相关代码|跑lastfail,  [Agile_L2_cluster_yasft_yfs_arm #2994 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/2994/)  ,未rebase相关代码，无关，忽略|  
|
|4|  [Agile_L2_cluster_backup_arm_3 #1507 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1507/)  |ha_cluster/testcase/backup/backup_pitr_recent_backupset/test_sdv_yasrman_pitr_recent_09.py,![](https://pingcode.yasdb.com/atlas/files/public/67396e8c8970c2af4f521945/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFFQUlBQUNBQUFBQUFBQkFBQUFBQVVBQUFJQ0FBQ0FnUUFBQUFBSUFBZ0FBQUFBQUVBQVFJQUFBRVFJSUFBQWdBRkFBQUFBQVVBQUFBQUFBUUFBZ0VBQWdBQUFBUUFBRUFBQUFBQUFBQUFCQUFnQWtBQUFBZ0FBQWdBQUFBQklBQUFRQUFBQUFBQUJBQUFBQU1FQUFRQUFBZ0FBQUFBQWlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc4NTEsImV4cCI6MTc4MjQ0ODY1MX0.BwUHBTz2gl6cfuE9rsWloS2vMqKAfg73A8_aL0HSAvE)|跑lastfail，已绿,  [Agile_L2_cluster_backup_arm_3 #1532 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/1532/)  ,  
|  
|
|5|  [Agile_L2_cluster_FT_ha_arm #686 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/686/)  |集群环境搭建失败|重跑,  [Agile_L2_cluster_FT_ha_arm #710 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/710/)  ,  
|  
|
|6|  [Agile_L2_cluster_FT_install_arm #552 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_install_arm/552/)  |未排查出原因|跑lastfail|  
|
|7|  [Agile_L2_cluster_jdbc_arm #1154 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1154/)  |未排查出原因|跑lastfail，已绿,  [Agile_L2_cluster_jdbc_arm #1165 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1165/)  |  
|
|8|  [Agile_L2_cluster_yasft_faultpoint_arm #666 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/666/)  |/fault_point/ResourceJoinExit/test_sdv_ydbrd_16227_FP_015---start ycs fail,check instance status fail|跑lastfail,已绿,  [Agile_L2_cluster_yasft_faultpoint_arm #675 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/675/)  |  
|
|9|  [Agile_L2_cluster_yasft_yasboot_arm #272 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yasboot_arm/272/)  |/yasboot/yasboot_install/test_sdv_ydbrd_26427_yasboot_install_011,Fail to execute yasboot cluster deploy:  task completed, status: FAILED    
  retcode: 1    
  stdout: mkdir arch path failed    
  stderr: |跑lastfail，已绿,  [Agile_L2_cluster_yasft_yasboot_arm #281 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yasboot_arm/281/)  |  
|
|  
|分布式|  
|  
|  
|
|1|  [Agile_L2_dst_tac_yasft_arm #2753 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/2753/)  |/DDL_03/index/function_index/tac/test_sdv_function_index_tac_123—同名对象报错,/DFX/audit—预期错误,/storage_dfx/dcl/userpwd_policy/tac/case_userpwd_sysview—预期错误,/storage_dfx/dcl/userpwd_policy/tac/case_userpwd_sysview---预期错误|无关，忽略|  
|
|2|  [Agile_L2_dst_HA_yasft_arm #2230 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/2230/)  |/heap/multicn/dml/concurrent/heap/test_sdv_dml_concurrent_01_heap---YAS-00004 feature "heap table on distributed" has not been implemented yet未rebase相关代码,  
|无关，忽略|  
|
|3|  [Agile_L2_dst_lsc_yasft_arm #2967 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/2967/)  |/DDL_03/subpartition_ddl/lsc/subpart_06_tbss_du_lsc—已知问题单,/datatype_01/decimal/lsc/test_decimal_testcases_func_lsc_04—运算问题，无关忽略,/system_view/dv_segments/lsc—未rebase相关代码,/system_view/dv_view/lsc、/system_view/test_sdv_yabrd_26326_QUOTA—预期错误,  
|无关，忽略|  
|
|4|  [Agile_L2_dst_FT_yasldr_2 #3901 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_2/3901/)  |未排查出原因|跑lastfail，已绿,  [Agile_L2_dst_FT_yasldr_2 #3911 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_2/3911/)  |  
|


## Attachments:

[主库支持open_readonly文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOGJhMWFkOWEzMzExZGM5N2I0IiwicmVmX2lkIjoiNjczOTZlOGI3MjgyMDZlZmI5MmYyOTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODUxLCJleHAiOjE3ODI1MjQyNTF9.oRnuXY6u44ElShzq8eHdSYsCUlcVjQwfBTe52q1BArQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
