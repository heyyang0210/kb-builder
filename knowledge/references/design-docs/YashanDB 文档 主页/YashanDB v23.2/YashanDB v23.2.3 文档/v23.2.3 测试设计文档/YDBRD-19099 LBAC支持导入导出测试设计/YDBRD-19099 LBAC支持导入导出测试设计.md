Created by 刘晓旋, last modified on 十月 09, 2024

# 1. 概述

IR链接：    [#YASHAN-959](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b30f)  

SR链接：    [#YDBRD-19099](https://pingcode.yasdb.com/pjm/items/661155b5579a3edb84d68864)  

EXP/IMP支持导入导出 LBAC 策略。

# 2. 需求分析

## 2.1 功能点分析

1、通过 EXP 工具在 FULL 模式下导出 LBAC 策略相关的数据。目前只支持导出以下6种 SQL 语句：

1）创建策略的语句

```
SA_SYSDBA.CREATE_POLICY (
  policy_name IN VARCHAR,
  column_name IN VARCHAR DEFAULT NULL,
  default_options IN VARCHAR DEFAULT NULL);
```

2）  创建等级的语句

```
SA_COMPONENTS.CREATE_COMPARTMENT (
  policy_name IN VARCHAR,
  comp_num IN INTEGER,
  short_name IN VARCHAR,
  long_name IN VARCHAR);
```

3）创建范围的语句

```
SA_COMPONENTS.CREATE_COMPARTMENT (
  policy_name IN VARCHAR,
  comp_num IN INTEGER,
  short_name IN VARCHAR,
  long_name IN VARCHAR);
```

4）  创建标签的语句

```
SA_LABEL_ADMIN.CREATE_LABEL (
  policy_name IN VARCHAR,
  label_tag IN BINARY_INTEGER,
  label_value IN VARCHAR,
  data_label IN BOOLEAN DEFAULT TRUE);
```

5）将策略作用于表的语句

```
SA_POLICY_ADMIN.APPLY_TABLE_POLICY (
  policy_name IN VARCHAR,
  schema_name IN VARCHAR,
  table_name IN VARCHAR,
  table_options IN VARCHAR DEFAULT NULL,
  label_function IN VARCHAR DEFAULT NULL,
  predicate IN VARCHAR DEFAULT NULL);
```

6）设置用户标签的语句

```
SA_USER_ADMIN.SET_USER_LABELS (
  policy_name IN VARCHAR,
  user_name IN VARCHAR,
  max_read_label IN VARCHAR,
  max_write_label IN VARCHAR DEFAULT NULL,
  min_write_label IN VARCHAR DEFAULT NULL,
  def_label IN VARCHAR DEFAULT NULL,
  row_label IN VARCHAR DEFAULT NULL);

def_label值为DEFAULT_WRITE_LABEL值。
```

  


2、通过 IMP 工具在 FULL 模式下导入 LBAC 策略相关的数据，支持导入的语句同上。

## 2.2 应用场景

1、导出

exp sys/Cod-2022 file=out.dump full=y 

2、导入

imp sys/Cod-2022 file=out.dump full=y 

## 2.3 规格约束

LBAC 仅支持全库模式下的导入导出，不支持在 owner、table 模式下导入导出。

FULL 模式用于导出整库的数据，包括：

用户元数据

用户下的所有对象元数据

用户下的表数据

所有的系统权限

所有的对象权限

所有的角色

所有的审计策略/使能

所有的 OUTLINE 所有的 PROFILE

所有的 SQLMAP 所有的定时任务

执行本模式导出的数据库用户必须拥有 DBA 角色权限。

其中，Value 值的含义为：Y：导出所有用户下的数据。 N：导出登录用户下的数据。

  


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：场景法覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用 xmind 的方式*
    1. *导出 LBAC 数据*
    1. *导入 LBAC 数据*


**a. 导出 LBAC 测试**

|测试场景|测试项|等价类|备注|
|---|---|---|---|
|导出 LBAC SQL 语句|CALL LBACSYS.YLS_ENFORCEMENT.ENABLE_YLS;|  
|  
|
||SA_SYSDBA.CREATE_POLICY|1个策略、多个策略|  
|
||SA_COMPONENTS.CREATE_LEVEL|1个等级、多个等级（1个策略最大支持9999个等级）|  
|
||SA_COMPONENTS.CREATE_COMPARTMENT|1个范围、多个范围（1个策略最大支持9999个范围）|  
|
||SA_LABEL_ADMIN.CREATE_LABEL|1个标签、多个标签|  
|
||SA_POLICY_ADMIN.APPLY_TABLE_POLICY|应用1个表、多个表|  
|
||SA_USER_ADMIN.SET_USER_LABELS|设置1个用户、多个用户|  
|
|模式|FULL模式|FULL=Y|预期：可导出以上6种 SQL 语句|
||FULL模式|FULL=N|预期：无法导出 LBAC 数据|
||OWNER 模式|OWNER 模式|预期：无法导出 LBAC 数据|
||TABLE 模式|TABLE 模式|预期：无法导出 LBAC 数据|
|开关状态|导出前的为打开状态|LBACSYS.YLS_ENFORCEMENT.ENABLE_YLS|  
|
||导出前的为关闭状态|LBACSYS.YLS_ENFORCEMENT.DISABLE_YLS;|导出文件最终会还原成   DISABLE_YLS 状态|
|权限|导出用户具有 LBAC 权限|sys 用户,lbac_dba 用户|预期：导出成功|
||导出用户不具有 LBAC 权限|普通用户,dba 用户|预期：普通用户导出失败，dba 用户可以导出其他有权限的系统元数据，也导出 lbac 的数据|
|可见性测试|导出的过程中改变开关的状态|LBACSYS.YLS_ENFORCEMENT.ENABLE_YLS,LBACSYS.YLS_ENFORCEMENT.DISABLE_YLS;|  
|
||导出的过程创建策略数据|SA_SYSDBA.CREATE_POLICY    
  SA_COMPONENTS.CREATE_LEVEL    
  SA_COMPONENTS.CREATE_COMPARTMENT    
  SA_LABEL_ADMIN.CREATE_LABEL    
  SA_POLICY_ADMIN.APPLY_TABLE_POLICY    
  SA_USER_ADMIN.SET_USER_LABELS|疑问：导出文件中新的策略数据是否可见？|
||导出的过程删除策略数据|SA_SYSDBA.DROP_POLICY    
  SA_COMPONENTS.DROP_LEVEL    
  SA_COMPONENTS.DROPE_COMPARTMENT    
  SA_LABEL_ADMIN.DROP_LABEL    
  SA_POLICY_ADMIN.REMOVE_TABLE_POLICY    
  SA_USER_ADMIN.DROP_USER_ACCESS|疑问：导出文件中被删除的策略数据是否可见？|
|系统视图测试|是否导出了 LBAC 相关的系统视图|DBA_SA_POLICIES,DBA_SA_LEVELS,DBA_SA_COMPARTMENTS,DBA_SA_LABELS,DBA_SA_TABLE_POLICIES,DBA_SA_USER_LABELS|  
|


**b. 导入 LBAC 数据测试**

|测试场景|测试项|等价类|备注|
|---|---|---|---|
|导入 LBAC SQL 语句|CALL LBACSYS.YLS_ENFORCEMENT.ENABLE_YLS;|  
|  
|
||SA_SYSDBA.CREATE_POLICY|1个策略、多个策略|  
|
||SA_COMPONENTS.CREATE_LEVEL|1个等级、多个等级（1个策略最大支持9999个等级）|  
|
||SA_COMPONENTS.CREATE_COMPARTMENT|1个范围、多个范围（1个策略最大支持9999个范围）|  
|
||SA_LABEL_ADMIN.CREATE_LABEL|1个标签、多个标签|  
|
||SA_POLICY_ADMIN.APPLY_TABLE_POLICY|应用1个表、多个表|  
|
||SA_USER_ADMIN.SET_USER_LABELS|设置1个用户、多个用户|  
|
|模式|FULL模式|FULL=Y|预期：可导入以上6种 SQL 语句|
||FULL模式|FULL=N|预期：无法导入 LBAC 数据|
||OWNER 模式|OWNER 模式|预期：无法导入 LBAC 数据|
||TABLE 模式|TABLE 模式|预期：无法导入 LBAC 数据|
|开关状态|导入前为打开状态|LBACSYS.YLS_ENFORCEMENT.ENABLE_YLS|预期：导入成功|
||导入前为关闭状态|LBACSYS.YLS_ENFORCEMENT.DISABLE_YLS;|预期：导入成功|
|权限|导入用户具有 LBAC 权限|sys 用户,lbac_dba 用户|预期：导入成功|
||导入用户不具有 LBAC 权限|普通用户,dba用户|预期：导入失败|
|可见性测试|导入的过程中改变开关的状态|LBACSYS.YLS_ENFORCEMENT.ENABLE_YLS,LBACSYS.YLS_ENFORCEMENT.DISABLE_YLS;|  
|
||导入的过程创建策略数据|SA_SYSDBA.CREATE_POLICY    
  SA_COMPONENTS.CREATE_LEVEL    
  SA_COMPONENTS.CREATE_COMPARTMENT    
  SA_LABEL_ADMIN.CREATE_LABEL    
  SA_POLICY_ADMIN.APPLY_TABLE_POLICY    
  SA_USER_ADMIN.SET_USER_LABELS|疑问：导入后新的策略数据是否可见？|
||导入的过程删除策略数据|SA_SYSDBA.DROP_POLICY    
  SA_COMPONENTS.DROP_LEVEL    
  SA_COMPONENTS.DROPE_COMPARTMENT    
  SA_LABEL_ADMIN.DROP_LABEL    
  SA_POLICY_ADMIN.REMOVE_TABLE_POLICY    
  SA_USER_ADMIN.DROP_USER_ACCESS|疑问：导入后被删除的策略数据是否可见？|
|系统视图测试|导入后检查 LBAC 相关的系统视图|DBA_SA_POLICIES,DBA_SA_LEVELS,DBA_SA_COMPARTMENTS,DBA_SA_LABELS,DBA_SA_TABLE_POLICIES,DBA_SA_USER_LABELS|  
|
|LBAC 功能测试|导入完成后，检查访问控制功能是否正确|查询应用策略后的用户数据、表数据，行数据的可见性功能是否正确|  
|


  


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*    


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|
|兼容性|集群不支持 LBAC,分布式不支持 LBAC|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件 

[LBAC导入导出冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWM4OTcwYzJhZjRmNTIwZjFkIiwicmVmX2lkIjoiNjczOTZjZWM1OTNmOTljOWZmMjM3NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzU0LCJleHAiOjE3ODIzOTExNTR9.UWkO60wJLV1W9Kmu-Hxwdz1CWFwzZV5xtJ2TxXHEPEw)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：

## Attachments:

[image2024-5-17_18-47-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWM4OTcwYzJhZjRmNTIwZjFlIiwicmVmX2lkIjoiNjczOTZjZWM1OTNmOTljOWZmMjM3NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzU0LCJleHAiOjE3ODIzOTExNTR9.E7rqflyWr2sC9IW3Ajq7dkmCiTGF3UO9gkcX_wDMDSo)

 (image/png)    


[image2024-4-29_18-8-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWM4OTcwYzJhZjRmNTIwZjFmIiwicmVmX2lkIjoiNjczOTZjZWM1OTNmOTljOWZmMjM3NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzU0LCJleHAiOjE3ODIzOTExNTR9.olef-Htt7rA8-xAw_Tf-gAr_ZBweuhkerQ6e0Z4Xg-g)

 (image/png)    


[image2024-4-29_18-8-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWM4OTcwYzJhZjRmNTIwZjIwIiwicmVmX2lkIjoiNjczOTZjZWM1OTNmOTljOWZmMjM3NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzU0LCJleHAiOjE3ODIzOTExNTR9.iCEBCZyracPGNSzuk6579ZsbbiaPI8HL2fb7eLRuDpw)

 (image/png)    


[image2024-4-29_18-7-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWNhMWFkOWEzMzExZGM4ZDkyIiwicmVmX2lkIjoiNjczOTZjZWM1OTNmOTljOWZmMjM3NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzU0LCJleHAiOjE3ODIzOTExNTR9.K-dHDrvZ-f3y64kq-242wJEX4AuTvEDo-Zfpj3wdCW0)

 (image/png)    


[image2024-4-29_18-7-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWNhMWFkOWEzMzExZGM4ZDkzIiwicmVmX2lkIjoiNjczOTZjZWM1OTNmOTljOWZmMjM3NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzU0LCJleHAiOjE3ODIzOTExNTR9.AOQ8r_SC-ZjPomug0eBrab2EAQi03zGqibJEs7MHWDw)

 (image/png)    


[image2024-4-29_18-7-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWM4OTcwYzJhZjRmNTIwZjI0IiwicmVmX2lkIjoiNjczOTZjZWM1OTNmOTljOWZmMjM3NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzU0LCJleHAiOjE3ODIzOTExNTR9.cYHNKzwWv5VZY_3AcrMORgc-axBUrXZh4HA5PRAkPjA)

 (image/png)    


[LBAC导入导出冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWM4OTcwYzJhZjRmNTIwZjFkIiwicmVmX2lkIjoiNjczOTZjZWM1OTNmOTljOWZmMjM3NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzU0LCJleHAiOjE3ODIzOTExNTR9.UWkO60wJLV1W9Kmu-Hxwdz1CWFwzZV5xtJ2TxXHEPEw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
