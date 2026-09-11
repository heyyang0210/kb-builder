# 1. 概述

DBA_USERS视图支持TEMPORARY_TABLESPACE，INITIAL_RSRC_CONSUMER_GROUP字段

SR链接：

  [https://pingcode.yasdb.com/pjm/items/67051e8ae489dd0868f22042?](https://pingcode.yasdb.com/pjm/items/67051e8ae489dd0868f22042?)  

#YDBRD-33499 DBA_USERS视图支持TEMPORARY_TABLESPACE，INITIAL_RSRC_CONSUMER_GROUP字段

# 2. 需求分析

新数科技监控系统适配  

场 景：
1、/*NDTM*/SELECT USERNAME, USER_ID, PASSWORD, ACCOUNT_STATUS, LOCK_DATE, EXPIRY_DATE, DEFAULT_TABLESPACE, TEMPORARY_TABLESPACE, CREATED, PROFILE, INITIAL_RSRC_CONSUMER_GROUP FROM DBA_USERS

# 3. 详细测试设计

## 3.1 详细测试设计

|字段|场景|预期|
|---|---|---|
|DBA_USERS|创建不同权限用户, SYS/普通用户查询DBA_USERS，INITIAL_RSRC_CONSUMER_GROUP字段|SYS用户下INITIAL_RSRC_CONSUMER_GROUP字段返回SYS_GROUP,普通用户及其它用户INITIAL_RSRC_CONSUMER_GROUP字段返回DEFAULT_CONSUMER_GROUP|
||创建/使用临时表空间+DDL/DML|通过DBA_TABLES过滤该表下的默认使用临时表空间|
||临时表指定undo/swap临时表空间+DDL/DML|通过DBA_TABLES过滤该表下的默认使用临时表空间|
||自建临时表空间名称长度等于64|TEMPORARY_TABLESPACE字段显示正常|
||带特殊字符创建临时表空间|TEMPORARY_TABLESPACE字段显示正常|




2、DFX覆盖说明

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及，并发进行查询|
|KT|不涉及|
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


# 4. 测试框架设计

- *当前的guider和ha框架即可满足*


# 5. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*