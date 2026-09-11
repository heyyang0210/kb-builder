Created by 周彬鑫 on 九月 26, 2024

# 1. 概述

IR：    [YASHAN-925 【mysql兼容】支持特定的视图&系统表](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ed?%20#YASHAN-925%20%20%E3%80%90mysql%E5%85%BC%E5%AE%B9%E3%80%91%E6%94%AF%E6%8C%81%E7%89%B9%E5%AE%9A%E7%9A%84%E8%A7%86%E5%9B%BE&%E7%B3%BB%E7%BB%9F%E8%A1%A8)  

SR：    [https://pingcode.yasdb.com/pjm/items/66192c8cfd997db58ad8a666](https://pingcode.yasdb.com/pjm/items/66192c8cfd997db58ad8a666)      
  #YDBRD-26298 支持information_schema权限相关系统视图

支持特定的视图&系统表：  SCHEMA_PRIVILEGES、TABLE_PRIVILEGES、USER_PRIVILEGES

# 2. 需求分析

## 2.1 功能点分析

-   [YDBRD-26298 支持information_schema权限相关系统视图-测试调研](/pages/createpage.action?spaceKey=YAS&title=%E5%A4%8D%E5%88%B6%E4%BB%8E+YDBRD-26298+%E6%94%AF%E6%8C%81information_schema%E6%9D%83%E9%99%90%E7%9B%B8%E5%85%B3%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE-%E6%B5%8B%E8%AF%95%E8%B0%83%E7%A0%94)  
- 支持SCHEMA_PRIVILEGES、TABLE_PRIVILEGES、USER_PRIVILEGES系统视图，  级别分别是：数据库层级、表级、全局级别


## 2.2 应用场景

       对用户、对象执行grant或者revoke操作，在视图中查看具体所对应的权限是否被记录，查看对象如下：

- ### SCHEMA_PRIVILEGES表


该SCHEMA_PRIVILEGES表提供有关架构（数据库）特权的信息。它从mysql.db系统表中获取其值。该SCHEMA_PRIVILEGES表包含以下列：

GRANTEE  ：授予特权的帐户名称， 格式。 ‘user_name’@‘host_name’    
  TABLE_CATALOG ：模式所属的目录的名称。此值始终为def。    
  TABLE_SCHEMA：模式的名称。    
  PRIVILEGE_TYPE：授予的特权。该值可以是可以在架构级别授予的任何特权；每行列出一个特权，因此，受授权者所拥有的每个模式特权都有一行。    
  IS_GRANTABLE：如果用户具有 GRANT OPTION特权YES， 否则NO。输出不会使用列出 GRANT OPTION为单独的行PRIVILEGE_TYPE=‘GRANT OPTION’。

- ### TABLE_PRIVILEGES表


该TABLE_PRIVILEGES表提供有关表特权的信息。它从mysql.tables_priv系统表中获取其值 。该TABLE_PRIVILEGES表包含以下列：

GRANTEE：授予特权的帐户名称， 格式。 ‘user_name’@‘host_name’    
  TABLE_CATALOG：该表所属的目录的名称。此值始终为def。    
  TABLE_SCHEMA：表所属的模式（数据库）的名称。    
  TABLE_NAME：表的名称。    
  PRIVILEGE_TYPE：授予的特权。该值可以是可以在表级别上授予的任何特权。每行仅列出一个特权，因此，被授予者每张表拥有一行特权。    
  IS_GRANTABLE：如果用户具有 GRANT OPTION特权YES， 否则NO。输出不会使用列出 GRANT OPTION为单独的行PRIVILEGE_TYPE=‘GRANT OPTION’。

- ### USER_PRIVILEGES表


该USER_PRIVILEGES表提供有关全局特权的信息。它从mysql.user系统表中获取其值 。该USER_PRIVILEGES表包含以下列：

GRANTEE：授予特权的帐户名称， 格式。 ‘user_name’@‘host_name’    
  TABLE_CATALOG：目录的名称。此值始终为 def。    
  PRIVILEGE_TYPE：授予的特权。该值可以是可以在全局级别上授予的任何特权。每行列出一个特权，因此，受赠方所拥有的每个全局特权都有一行。    
  IS_GRANTABLE：如果用户具有 GRANT OPTION特权YES， 否则NO。输出不会使用列出 GRANT OPTION为单独的行PRIVILEGE_TYPE=‘GRANT OPTION’。

## 2.3 规格约束

- 不支持某些mysql独有权限，详见    [check_user_privilege](https://conf.yasdb.com/pages/createpage.action?spaceKey=~longxiaohua&title=check_user_privilege&linkCreation=true&fromPageId=156132637)     中需要验证的为AUTH_NONE对应的权限。
- 不支持权限控制到列，因此mysql.columns_priv视图查询结果恒为空，mysql.table_privs视图查询的Column_priv字段结果恒为空。
- 受限于  table_privilege_map$ 字段， mysql.table_privs视图查询的Table_priv字段不会出现'Create','Drop','Grant','Show view','Create view','Trigger' （create view是系统级权限，不在此处显示）。
- 不支持授予权限给FUNCTION或PROCEDURE类型的对象（feature "privileges on specified object type" has not been implemented yet），因此mysql.procs_priv视图查询的结果恒为空。
- enum，set，text，blob类型当前不支持, desc 分别显示为char, varchar, varchar, char。


SCHEMA_PRIVILEGES视图

|GRANTEE|TABLE_CATALOG|TABLE_SCHEMA|PRIVILEGE_TYPE|IS_GRANTABLE|
|:---|:---|:---|:---|:---|
|user@host|def|USER|mysql.db下对应priv列为yes，每个为一行|是否有grant权限（grant_priv）|


TABLE_PRIVILEGES视图

|GRANTEE|TABLE_CATALOG|TABLE_SCHEMA|TABLE_NAME|PRIVILEGE_TYPE|IS_GRANTABLE|
|:---|:---|:---|:---|:---|:---|
|user@host|def|TABLE所属SCHEMA|TABLE_NAME|mysql.tables_priv下对应priv列为yes，每个为一行|是否有grant权限（grant_priv）|


USER_PRIVILEGES视图

|GRANTEE|TABLE_CATALOG|PRIVILEGE_TYPE|IS_GRANTABLE|
|:---|:---|:---|:---|
|user@host|def|mysql.user下对应priv列为yes，每个为一行|是否有grant权限（grant_priv）|


约束上同mysql.db， mysql.user, mysql.tables_priv三表    
  目前权限类型暂无USAGE

# 3. 详细测试设计

## 3.1 测试设计方法

对于本次设计主要采用场景法

- 通过构造不同权限场景，在视图中查看是否记录了相应的权限；取消权限后，视图中相应的场景也要减少


## 3.2 详细测试设计

视图字段验证：  数据来源，  字段个数与数据类型与mysql.db，mysql.tables_priv，mysql.user表一致

- **视图验证**
- 涉及场景：
- 1.环境：单机


|序号|视图名|字段个数|数据来源|备注|
|---|---|---|---|---|
|1|*SCHEMA_PRIVILEGES*|5|字段数据来源于mysql.db|  
|
|2|*TABLE_PRIVILEGES*|6|字段数据来源于mysql.tables_priv|  
|
|3|*USER_PRIVILEGES*|4|字段数据来源于mysql.user|  
|


|序号|测试场景|用例详细描述|预期|备注|
|---|---|---|---|---|
|1|基础场景|查询这3个视图，和数据来源视图|字段准确，数据类型准确|兼容模式/(非兼容模式)|
|  
|  
|通过dba_tab_columns查询视图的字段|可查询，字段准确，数据类型准确|  
|
|  
|  
|创建普通表，在所有涉及的视图中查看此表权限信息，验证视图的数据来源|可查询|  
|
|2|*TABLE_PRIVILEGES*  视图,    （相同表级权限）|（一）给予一个用户user1一张表table1的权限：,全部权限：,1.insert、update、delete、select、alter、references、index table1,2.将这个表的ALL PRIVILEGES权限授予用户user1,3.收回全部权限,部分权限：,1.delete、select、alter,2.收回部分权限,（二）给予一个用户user1多张表t1,t2,t3的权限：,1.授予user1   t1的insert、update、delete权限,,2.授予user1   t2的select、alter权限,,3.授予user1   t3的references、index权限,4.收回user1   t1和t2的所有权限|  
,  
,可查询,可查询,查询结果为空,  
,可查询,查询结果为空,  
,可查询,可查询,可查询,查询结果为空|覆盖SYS用户，DBA用户授权|
|  
|  
|（三）给予一个角色role1一张表table1的权限：,全部权限：,1.insert、update、delete、select、alter、references、index ,2.将role1给予用户user1，创建角色role2和用户user2，将role1授予role2，在将role2给予user2,3.解除role1对role2的授权,部分权限：,1.授予role1部分权限，创建用户user1,将role1授予user1,2.再将剩余的部分权限直接授予user1,3.收回role1   user1的授权|  
,  
,可查询,可查询,查询结果为空,  
,可查询,可查询,查询结果为空|  
|
|  
|  
|（四）创建用户user1、user2、表t1：,1.将表t1的select,update,insert,delete权限授予use1,带with grant option，,2.将表t1的alter、references、index授予user1不带with grant option,,3.将user1用户的insert、update、delete、select、alter、references、index权限授予user2,4.收回user2  user1的权限|  
,可查询,可查询,部分可查询,查询结果为空|  
|
|3|*SCHEMA_PRIVILEGES*  视图,    （相同系统级权限）|（一）创建一个新用户，授予这个新用户系统级级别的权限：,1.给予新用户user1,select any table的权限,2.收回user1用户的select any table的权限|  
,可查询,查询结果为空|覆盖系统级别的权限(表、表空间、索引、序列、同义词、视图、存储过程、触发器、with grant option)|
|  
|  
|(二)创建一个角色，授予这个角色所有系统级别的权限，,1.将这个角色授予用户,2.收回角色用户的授权,3.重新授予这个用户部分系统级别的权限|  
,可查询,可查询,查询结果为空|  
|
|4|*USER_PRIVILEGES*  视图,（相同全局级别权限）|创建一个新用户，将SYSDBA和SYSOPER角色授予这个新用户,解除SYSDBA和SYSOPER角色对新用户的权限|可查询,查询结果为空|覆盖系统级别的权限(表、表空间、索引、序列、同义词、视图、存储过程、触发器、with grant option)|
|  
|  
|1.创建一个角色，授予这个角色所有系统级别的权限，在将这个角色授予用户,2.解除这个角色对用户的授权,3.重新授予这个用户部分系统级别的权限|可查询,查询结果为空,可查询|  
|
|5|不同级别间权限隔离|TABLE_PRIVILEGES、SCHEMA_PRIVILEGES、  *USER_PRIVILEGES权限相互*  隔离|  
|  
|
|6|其他正常与异常场景对比|1.在information_schema下查系统视图：不带information_schema.view、带information_schema.view,2.非information_schema下查系统视图：不带information_schema.view、带information_schema.view,3.创建同名表/视图：  创建SCHEMA_PRIVILEGES、TABLE_PRIVILEGES、USER_PRIVILEGES同名表、视图,4.视图同名作别名：  表别名、字段别名,5.    [用check_user_privilege](https://conf.yasdb.com/pages/createpage.action?spaceKey=~longxiaohua&title=check_user_privilege&linkCreation=true&fromPageId=156132637)       内置函数，判断用户是否具有特定权限,6.不用    [check_user_privilege](https://conf.yasdb.com/pages/createpage.action?spaceKey=~longxiaohua&title=check_user_privilege&linkCreation=true&fromPageId=156132637)    内置函数，直接判断用户是否具有特定权限,7.拼写错误字段：视图名拼写错误|  
|  
|
|7|公共场景测试|覆盖查询方式(直接查询，联合查询，like,带filter和不带filter,写操作拦截)|  
|  
|
|8|并发|grant,revoke和select * 视图并发|无core和卡住的问题|  
|


|系统级DFX分类|是否涉及|
|:---|:---|
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
|可维护性|不涉及|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；


[支持information_schema权限相关系统视图_冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmY4OTcwYzJhZjRmNTIxOGIxIiwicmVmX2lkIjoiNjczOTZlNmY1OTNmOTljOWZmMjM4NDc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMDYyLCJleHAiOjE3ODI0NTg0NjJ9.42FwFK5PTecOmSwaXrgPQyCNCLQmLBCDnViNFI6AQcI)

1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：1  *人7天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmZhMWFkOWEzMzExZGM5NzI0IiwicmVmX2lkIjoiNjczOTZlNmY1OTNmOTljOWZmMjM4NDc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMDYyLCJleHAiOjE3ODI0NTg0NjJ9.cZmoibWnD5TVs_9h5tLh9cB_lidtTY7GQ8pwnZSIDP4)

## Attachments:

[支持information_schema权限相关系统视图_冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmY4OTcwYzJhZjRmNTIxOGIxIiwicmVmX2lkIjoiNjczOTZlNmY1OTNmOTljOWZmMjM4NDc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMDYyLCJleHAiOjE3ODI0NTg0NjJ9.42FwFK5PTecOmSwaXrgPQyCNCLQmLBCDnViNFI6AQcI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmZhMWFkOWEzMzExZGM5NzI0IiwicmVmX2lkIjoiNjczOTZlNmY1OTNmOTljOWZmMjM4NDc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMDYyLCJleHAiOjE3ODI0NTg0NjJ9.cZmoibWnD5TVs_9h5tLh9cB_lidtTY7GQ8pwnZSIDP4)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmZhMWFkOWEzMzExZGM5NzI1IiwicmVmX2lkIjoiNjczOTZlNmY1OTNmOTljOWZmMjM4NDc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMDYyLCJleHAiOjE3ODI0NTg0NjJ9.wu6q4drSdjPwp0SVb5BKd2TlaT6nPkFMf4Ip0ggnmRE)

 (application/msword)    
