Created by 史鑫, last modified on 十月 15, 2024

#   [User Design（用户方案设计）](#user-design用户方案设计)  

##   [1. Overview（概述）](#1-overview概述)  

审计策略/使能信息导入导出；

##   [2. Features（功能特性）](#2-features功能特性)  

（1）支持审计的导入导出，包括：审计策略的创建/审计的使能。审计日志不进行导出

###   [2.1 规格说明](#21-规格说明)  

（1）支持审计的导入导出，包括：审计策略的创建/审计的使能。

（2）审计仅在全库模式，进行导入导出。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

####   [5.1.1 文件格式](#511-文件格式)  

#### 整体格式

![](https://pingcode.yasdb.com/atlas/files/public/67396ae18970c2af4f51ffc3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBa0FBQUFBQUFBQUlRQUFBQUFBQUFBQUJBQUFBQUFBQUFJQUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk3MDUsImV4cCI6MTc4MjMwMDUwNX0.6SlY0VV2aoQG8azJsHeXYWRi_S2CmfPtMt48kZ1HNYQ)

#### 具体格式

创建

![](https://pingcode.yasdb.com/atlas/files/public/67396ae1a1ad9a3311dc7e3d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBa0FBQUFBQUFBQUlRQUFBQUFBQUFBQUJBQUFBQUFBQUFJQUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk3MDUsImV4cCI6MTc4MjMwMDUwNX0.6SlY0VV2aoQG8azJsHeXYWRi_S2CmfPtMt48kZ1HNYQ)

细节说明：

（1）一个策略，创建时，所有的AUDIT_OPTION在一个语句内。

（2）AUDIT_CONDITION ==NONE，不导出when语句

（3）OBJECT_NAME==NONE，不导出on 对象

（4）AUDIT_OPTION_TYPE 包括：STANDARD ACTION（非对象）、OBJECT ACTION（对象）、ROLE PRIVILEGE，

（5）审计项：AUDIT_OPT_TYPE_PRIVILEGE，AUDIT_OPT_TYPE_ACTION，AUDIT_OPT_TYPE_ROLE，严格顺序

注：toplevel和权限审计，后续支持，暂时打桩

使能

![](https://pingcode.yasdb.com/atlas/files/public/67396ae18970c2af4f51ffc4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBa0FBQUFBQUFBQUlRQUFBQUFBQUFBQUJBQUFBQUFBQUFJQUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk3MDUsImV4cCI6MTc4MjMwMDUwNX0.6SlY0VV2aoQG8azJsHeXYWRi_S2CmfPtMt48kZ1HNYQ)

细节说明：

（1）每条数据，都需要单独导出，因为，同样的策略，针对不同的用户，可指定不同的生效方式。–王林会将其修改，except不能执行多次，因此，except放在同一条语句中。

（2）by 语句分别导出，不能组成一起，因为每条赋能语句，条件不一样。

（3）ENABLED_OPTION==BY USER && ENTITY_NAME==ALL USERS ，则audit policy UNIFIED_AUDIT_UP_3; 不带by

（4）audit policy UNIFIED_AUDIT_UP_3，此时AUDIT_UNIFIED_ENABLED_POLICIES中 SUCCESS==yes ,FAILURE==yes;说明，不敢失败还是成功，都要记录审计日志；SUCCESS==yes ,FAILURE==yes导出语句，不导出whenever

####   [5.1.2 查询方式](#512-查询方式)  

|信息|视图|完整语句|所需信息|关注点|
|---|---|---|---|---|
|创建审计策略|AUDIT_UNIFIED_POLICIES   |create audit policy UNIFIED_AUDIT_UP_2 actions create index, select on sx1.t1 ,delete on sx2.t2 ,update on sx2.v2, update on sx1.v1 when 'concat(''aaaa'', ''bbbb'') = ''aaaabbbb''' evaluate per session;|SQL> desc AUDIT_UNIFIED_POLICIES;    
  NAME NULL? DATATYPE    
  ---------------------------------------------------------------- --------- ---------------------------------    
  POLICY_NAME NOT NULL VARCHAR(64)    
  AUDIT_CONDITION VARCHAR(4000)    
  CONDITION_EVAL_OPT VARCHAR(9)    
  AUDIT_OPTION NOT NULL VARCHAR(64)    
  AUDIT_OPTION_TYPE VARCHAR(16)    
  OBJECT_SCHEMA VARCHAR(64)    
  OBJECT_NAME VARCHAR(64)    
  OBJECT_TYPE VARCHAR(15)    
  AUDIT_ONLY_TOPLEVEL VARCHAR(3)|AUDIT_CONDITION--导出时，要将concat('aaaa', 'bbbb') = 'aaaabbbb' 改成concat(''aaaa'', ''bbbb'') = ''aaaabbbb'' 加上一个单引号。 |
|赋能审计策略|AUDIT_UNIFIED_ENABLED_POLICIES  |--by,audit policy UNIFIED_AUDIT_UP_3 except sx3,sx4 whenever not successful ;,--except,audit policy UNIFIED_AUDIT_UP_3 except sx3,sx4 whenever not successful ;|SQL> desc AUDIT_UNIFIED_ENABLED_POLICIES;    
  NAME NULL? DATATYPE    
  ---------------------------------------------------------------- --------- ---------------------------------    
  POLICY_NAME NOT NULL VARCHAR(64)    
  ENABLED_OPTION VARCHAR(15)    
  ENTITY_NAME NOT NULL VARCHAR(64)    
  ENTITY_TYPE VARCHAR(7)    
  SUCCESS VARCHAR(3)    
  FAILURE VARCHAR(3)|ENABLED_OPTION == except 一条语句导出,ENABLED_OPTION == by user 拆成多条语句导出|


审计设计文档-    [审计详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76912654)  

策略和使能需要audit system系统权限

####   [5.1.3 模式](#513-模式)  

审计不属于某个用户下的对象，仅在全库模式，进行导入导出。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
create role role1;
create role role2;

conn sys/Cod-2022
drop user sx3 cascade;
drop user sx4 cascade;
drop user sx2 cascade;
create user sx3 identified by 1;
create user sx4 identified by 1;
create user sx2 identified by 1;
grant dba to sx2;

conn sys/Cod-2022
drop user sx1 cascade;
create user sx1 identified by 1;
grant dba to sx1;
conn sx1/1;
create table t1(id int);
create view v1 as select * from t1;
drop audit policy UNIFIED_AUDIT_UP_1;
--创建策略
create audit policy UNIFIED_AUDIT_UP_1 actions create index , select on t1;
--使能
conn sys/Cod-2022
drop user sx2 cascade;
create user sx2 identified by 1;
grant dba to sx2;
conn sx2/1;
create table t2(id int);
create view v2 as select * from t2;
drop audit policy UNIFIED_AUDIT_UP_2;
--创建策略
create audit policy UNIFIED_AUDIT_UP_2 actions all,create index, select on sx1.t1 ,all on sx2.t2 ,update on sx2.v2, update on sx1.v1 when 'concat(''aaaa'', ''bbbb'') = ''aaaabbbb''' evaluate per session;
--使能
audit policy UNIFIED_AUDIT_UP_2 by sx1 whenever successful ;
audit policy UNIFIED_AUDIT_UP_2 by sx2 whenever not successful ;
drop audit policy UNIFIED_AUDIT_UP_3;
create audit policy UNIFIED_AUDIT_UP_3 actions all,create index, select on sx1.t1 ,all on sx2.t2 ,update on sx2.v2, update on sx1.v1 when 'concat(''aaaa'', ''bbbb'') = ''aaaabbbb''' evaluate per session;
--始能
audit policy UNIFIED_AUDIT_UP_3 except sx3,sx4 whenever not successful ;
--使能all
noaudit policy UNIFIED_AUDIT_UP_4;
drop audit policy UNIFIED_AUDIT_UP_4;
create audit policy UNIFIED_AUDIT_UP_4 privileges create session,create table actions all,create index, select on sx1.t1 ,all on sx2.t2 ,update on sx2.v2, update on sx1.v1 roles role1,role2 when 'concat(''aaaa'', ''bbbb'') = ''aaaabbbb''' evaluate per session;
--始能
audit policy UNIFIED_AUDIT_UP_4 whenever not successful;
--导出
!exp sys/Cod-2022 file=a  full=y 
--查询
!yasql sys/Cod-2022 -f -e D:\导入导出工具总结\审计导出\select.sql > D:\导入导出工具总结\审计导出\select.expect
--删除用户/策略
conn sys/Cod-2022
drop user sx3 cascade;
drop user sx2 cascade;
drop user sx4 cascade;
drop user sx1 cascade;
noaudit policy UNIFIED_AUDIT_UP_1;
noaudit policy UNIFIED_AUDIT_UP_2;
noaudit policy UNIFIED_AUDIT_UP_2 by sx2;
noaudit policy UNIFIED_AUDIT_UP_3;
noaudit policy UNIFIED_AUDIT_UP_4;
drop audit policy UNIFIED_AUDIT_UP_1;
drop audit policy UNIFIED_AUDIT_UP_2;
drop audit policy UNIFIED_AUDIT_UP_3;
drop audit policy UNIFIED_AUDIT_UP_4;
--导入
!imp sys/Cod-2022 file=a  full=y 
--查询
!yasql sys/Cod-2022 -f -e D:\导入导出工具总结\审计导出\select.sql > D:\导入导出工具总结\审计导出\select.out
--end

--查询
select * from AUDIT_UNIFIED_POLICIES  order by POLICY_NAME ; 
select * from AUDIT_UNIFIED_ENABLED_POLICIES  order by POLICY_NAME ;
```

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

|问题|解决方式|备注|
|---|---|---|
|创建策略----一定会有AUDIT_OPTION |  
|  
|
|审计策略创建的owner，需要导出，导入时切换schema。|  
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
|  
|
|  
|  
|  
|


  


  


## Attachments:

[权限位置.PNG](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTFhMWFkOWEzMzExZGM3ZTNhIiwicmVmX2lkIjoiNjczOTZhZTE1OTNmOTljOWZmMjM1YWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NzA1LCJleHAiOjE3ODIzNzYxMDV9.zlym0ObNUpzlDMD4SDOK-Qc9ID3ET6esMG7qyVIqKik)

 (image/png)    
