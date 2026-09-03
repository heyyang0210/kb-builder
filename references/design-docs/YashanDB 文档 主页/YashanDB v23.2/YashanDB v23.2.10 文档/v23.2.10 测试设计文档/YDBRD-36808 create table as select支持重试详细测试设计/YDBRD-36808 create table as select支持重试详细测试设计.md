

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR:  [https://pingcode.yasdb.com/pjm/items/676e662074f36f855306464e?](https://pingcode.yasdb.com/pjm/items/6766352a622069d46dfaab83?)  

  [#YDBRD-36983 支持审计或者记录MYSQL客户端登录登出的用户信息](https://pingcode.yasdb.com/pjm/items/6766352a622069d46dfaab83?)  

#YDBRD-36808 create table as select支持重试

设计文档:  [(4766) YDBRD-36808 create table as select支持重试 详细设计文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67690c00a03b8234860c00f5)  

关于create table as select流程梳理

1.首先执行DDL

2.判断是否存在CTAS

3.如存在，执行CTAS，执行成功，提交事务

4.如果执行失败，在失败分支立刻回滚insert into select事务

5.判断错误码是否需要重试执行，如重试则返回第三步，当前最大重试时间为30s，列执行，配额相关错误码不受超时时间控制，即不超时重试。

6.不需要重试，失败流程直接退出

# 2. 需求分析

## 2.1 功能点分析

- **测试create table as select失败的场景并能重试**


## 2.2 应用场景

- create table as select


## 2.3 规格约束

- 交付范围为分布式
- 当前分布式行表不支持create table as select，仅支持列表


# 3. 详细测试设计

## 3.1 测试设计方法

根据需求主要采用：

等价类、边界值、场景法、错误推测法编写测试设计

## 3.2 详细测试设计

功能

|测试项|测试点|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|部署模式|分布式|||||
|表类型|LSC、TAC|LSC：冷数据||||
|重试场景（开发内部代码判断方式：根据错误码来判定，如果抛出这个错误码，且最大资源够执行一次，那么就会重试）|execQuotaRetry（资源不足需要重试）|||||
|||ERR_ANS_EXEC_PX_RES_UNAVAILABLE--4464,（并行资源不足）|修改yasboot cluster config set -c yashandb -k RSRC_MODE -v ALL -d，后调小MAX_PARALLEL_WORKERS及PQ_POOL_SIZE参数构造|||
|||ERR_RES_QUOTA_PX_CONGESTION--8416,（并行资源冲突）|如调整DEGREE_OF_PARALLEL和MAX_PARALLEL_WORKERS参数为8，开俩session执行6并行的sql构造|||
|||ERR_RES_USER_MEM_QUOTA_CONGESTION--8415,（内存资源不足）|SCOL_DATA_BUFFER_SIZE调小 ，宽表，数据量大一点构造,|||
||colNeedReExecute--6421 ,（列执行相关错误需要重试）||COLUMNAR_VM_BUFFER_SIZE，hash join构造，大数据量宽表构造|||
||dstbCmErrorCodeNeedRetry ,(cm集群管理相关错误需要重试)|||||
|||ERR_DSTB_CM_NORMAL_NODE_NOT_FOUND--1423|把集群某个组的节点全KILL，或者构造某一瞬间某个组节点全不可用的状态构造|||
|||ERR_DSTB_CM_PRIMARY_NODE_NOT_FOUND--1409|构造某个组的节点不存在主节点，但是存在备节点的场景构造|||
||plan cache失效（23.2不涉及）|ERR_DSTB_CONTEXT_MISMATCH|23.2版本不涉及|||
|||ERR_DSTB_PLAN_CONTEXT_MISMATCH|23.2版本不涉及|||
||crab或者ank相关错误码|ERR_CRAB_MEM_ALLOC_ERROR--5001|COLUMNAR_VM_BUFFER_SIZE、COLUMNAR_MATERIAL_PERCENT不足|||
|||ERR_CRAB_ALLOC_MATERIAL_QUOTA_ERROR--5016|COLUMNAR_VM_BUFFER_SIZE、COLUMNAR_MATERIAL_PERCENT不足|||
|||ERR_ANK_CONSISTENT_WRITE--2208|事务冲突--ctas是否涉及(测试这边无法构造这个场景，ctas ddl执行过程中不存在事务冲突)|||
||dphConnNeedRetry,（会话相关错误）|||||
|||ERR_DSTB_INVALID_SESSION--1201|SELECT USERENV('GSID') FROM dual;,SELECT global_session_id, serial# ,FROM DV$SESSION WHERE global_session_id IN (131091) AND group_id=2 AND group_node_id=1;,ALTER SYSTEM KILL SESSION '131091,5';,cn上查到正在使用的dn的session，到对应的dn节点session中KILL 掉dn的session|||
|||ERR_ANS_INSTANCE_SERVICE_UNAVAILABLE--6027|数据库在nomount状态下，或者在redo回放的状态，如主备切换、备份恢复，即非open数据库没对外提供服务的状态下|||
|||ERR_ANS_DB_NOT_READWRITE--6010|备机不可读，即dn在降备后，cn不知道这个dn降备了，然后找这个dn拿数据，出现备机不可读的错误|||
|一般非重试错误||||||
|testkill|ctas语句并发执行||和其他的特性并发，如视图等特性测试|||
||ctas语句并发执行中KILL数据库节点|||||
||ctas语句并发执行中KILLyasql进程|||||
||ctas语句执行中断网|||||
||ctas语句执行中发生主备切换|||||
|驱动|jdbc连yashan执行ctas语句资源不足等重试场景|||||
||jdbc连yashan执行ctas语句过程中kill连接|||||
|权限不足|1.用户缺乏在目标表空间创建表的权限,2.用户缺乏对源表或者视图的读取权限|||||
|表空间|1.目标表空间已满，无法接受新的数据,2.表空间状态不正常，如被设置为只读|||||
|对象名称冲突|目标创建的表已存在|||||
|数据类型不兼容|1.源数据中的某些数据类型在创建新表时不支持或转换失败|||||
|查询错误|1.查询语法错误,2.查询中引用的对象不存在|||||
|资源限制|内存不足场景,超过了会话查询的最大并发限制|||||
|分区|如创建分区表指定的分区键不符合要求导致创建失败|||||
|数据文件不可用状态||||||
|违反约束情况|主键、check、外键、not null约束|||||
|系统资源不足|系统的cpu资源、内存不足|||||
|行外lob|构造执行失败的场景，如内存不足、并发资源不足等|||||
|超时时间|如果是配额相关，或者列执行相关的错误码不考虑30s的超时时间，一直等重试，如节点找不到的情况下就有重试30s的限制，关注v$session视图重试次数|||||
|||||||


*yashan+mysql 5.7已支持数据类型转换矩阵*



1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- operators_perf框架


# 6. 测试环境说明

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


# 7. 工作量评估

工作量：8  *人天*

计划测试完成时间：2023/11/21日

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdhNTc0OGU3MDBhYTI4MDEyNjFmMjhhIiwicmVmX2lkIjoiNjdhNTc0OGU3MDBhYTI4MDEyNjFmMjk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQxNjQxLCJleHAiOjE3ODI0MjgwNDF9.SD_lO9iriGbtDffVwIAL_kCXqUkAoDDSxTB44_KSbF8)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdhNTc0OGU3MDBhYTI4MDEyNjFmMjhhIiwicmVmX2lkIjoiNjdhNTc0OGU3MDBhYTI4MDEyNjFmMjk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQxNjQxLCJleHAiOjE3ODI0MjgwNDF9.SD_lO9iriGbtDffVwIAL_kCXqUkAoDDSxTB44_KSbF8)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdhNTc0OGU3MDBhYTI4MDEyNjFmMjg4IiwicmVmX2lkIjoiNjdhNTc0OGU3MDBhYTI4MDEyNjFmMjk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQxNjQxLCJleHAiOjE3ODI0MjgwNDF9.hSNEMLAt4lriImgwrV_Dj_5uj6R9A2Kj0VwMDS7SfpA)

 (application/msword)    




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
