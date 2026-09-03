# 1. 概述

支持all_all_tables视图

SR链接：  [https://pingcode.yasdb.com/pjm/items/67051dd0e489dd0868f21ff0?](https://pingcode.yasdb.com/pjm/items/67051dd0e489dd0868f21ff0?)  

#YDBRD-33496 支持dba_all_tables视图

# 2. 需求分析

兼容ORACLE，原场景可以使用all_tables代替

## 2.1 功能点分析

dba_all_tables就是完全复用的dba_tables功能字段一样

# 3. 详细测试设计

复用 dba_tables历史用例，dba_all_tables替换原dba_tables进行测试

## 3.2 详细测试设计

|字段|场景|预期|
|---|---|---|
|dba_all_tables|分区表/临时表/嵌套表/普通表 做DDL+DML    |与dba_tables视图预期现象保持一致|
||增删列，rename table_name|与dba_tables视图预期现象保持一致|
||不同权限用户，查询dba_all_tables|与dba_tables视图预期现象保持一致|
||||




2、DFX覆盖说明

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及，并发进行查询|
|KT|不涉及|
|长稳|涉及，长稳补充视图查询|
|一致性|不涉及|
|三方测试工具  
(sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及，备机查询|
|压力|不设计|
|性能|不涉及|
|可维护性|不涉及|


# 4. 测试框架设计

- *当前的guider和ha框架即可满足*


# 5. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*