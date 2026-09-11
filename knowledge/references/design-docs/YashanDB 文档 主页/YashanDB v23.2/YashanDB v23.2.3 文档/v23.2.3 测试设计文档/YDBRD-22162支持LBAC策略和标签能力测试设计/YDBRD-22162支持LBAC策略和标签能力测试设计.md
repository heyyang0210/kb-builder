Created by 韩晓盼, last modified on 十二月 19, 2023

# 1. 概述

YashanDB Label Security，通过Label-Based Access Control （简称LBAC）一种基于行标签的访问控制，实现了基于策略对数据库中的表提供行级安全控制功能。

Label Security 是强制访问控制的一种方式，通过在表中添加一个 Label 列来记录每行的 Label 值，在访问时通过比较用户的 Label 和数据的 Label值，达到约束主体（用户）对客体（表中的数据）访问的目的。

本文档适用范围YashanDB支持LBAC策略和标签能力。

需求：    [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中

# 2. 需求分析

## 2.1 功能点分析

（1）LBAC简介

LBAC 由策略、组件、标签构成。  策略是一种预定义标记组件，由等级（level)、范围（compartment）和组（group) 构成，从3个不同的维度对数据进行描述，其中等级在策略中是必须存在的，范围和组可以缺省。

![](https://pingcode.yasdb.com/atlas/files/public/67396cf4a1ad9a3311dc8dd5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFCQUFBQVFBQUlBQUFBQUFBQUFRQUFBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ5MDYsImV4cCI6MTc4MjMxNTcwNn0.6W95tvmH6qNcoQseHJ_qF4gbh05JhchG27uKmbQXQ9c)

标签由等级、范围、组构成，其中等级是必选的，范围和组可以省略。

![](https://pingcode.yasdb.com/atlas/files/public/67396cf48970c2af4f520f66/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFCQUFBQVFBQUlBQUFBQUFBQUFRQUFBQUFBQUFFRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ5MDYsImV4cCI6MTc4MjMxNTcwNn0.6W95tvmH6qNcoQseHJ_qF4gbh05JhchG27uKmbQXQ9c)

说明如下：

- Policy： 就是安全策略，一个安全策略是level，compartment，group，label的集合。
- Level：  等级，这是最基础的安全控制等级，必须设置。
- Compartment：范围，提供第二级的安全控制，是可选的。
- Group：组，提供第三级的安全控制，是可选的。
- Label：标签，最终体现到每一行上的安全标签，必须设置。只有用户被赋予的标签和此行上的标签相同或者等级更高的时候，该行才能够被用户存取。


  


数据库提供了内置的安全管理员 LBACSYS 来管理和使用该功能，安全管理员可以通过创建安全策略、定义策略中的 Label、设置用户的 Label，来定制自己的安全策略。

一个安全策略可以应用到多张表上，一张表也可以应用多个安全策略。每当一个安全策略被应用，这张表上自动会添加一列，用于该安全策略的访问控制。

创建策略等操作对应的权限需要有 LBAC_DBA 角色权限。

（2）实现功能点（与Oracle对比）

  点击此处展开...

实现的程序包

|程序包名|存储过程|描述|
|---|---|---|
|YLS_ENFORCEMENT|ENABLE_YLS|开启YLS|
||DISABLE_YLS|关闭YLS|
|SA_SYSDBA|CREATE_POLICY|创建安全策略|
||DROP_POLICY|删除安全策略|
||ALTER_POLICY|更改安全策略  **（不支持)**|
||ENABLE_POLICY|设置策略为有效  **（不支持)**|
||DISABLE_POLICY|设置策略为无效  **（不支持)**|
|  
,  
,  
,SA_COMPONENTS|CREATE_LEVEL|创建安全策略的级别|
||DROP_LEVEL|删除安全策略的级别|
||CREATE_COMPARTMENT|创建安全策略的范围|
||DROP_COMPARTMENT|删除安全策略的范围|
||CREATE_GROUP|创建安全策略的组  **（不支持)**|
||DROP_GROUP|删除安全策略的组  **（不支持)**|
||ALTER_LEVEL|更改安全策略的等级  **（不支持)**|
||ALER_COMPARTMENT|更改安全策略的范围  **（不支持)**|
||ALER_GROUP|更改安全策略的组  **（不支持)**|
||ALTER_GROUP_PARENT|更改安全策略的组的父组  **（不支持)  **|
|  
,SA_LABEL_ADMIN|CREATE_LABEL|创建标签|
||DROP_LABEL|删除标签|
||ALTER_ALBEL|更改标签  **（不支持)  **|
|  
,  
,  
,  
,  
,  
,  
,  
,SA_POLICY_ADMIN|APPLY_TABLE_POLICY|对表关联策略|
||REMOVE_TABLE_POLICY|移除表关联的策略|
||ENABLE_TABLE_POLICY|设置表关联的策略有效  **（不支持)  **|
||DISABLE_TABLE_POLICY|设置表关联的策略无效  **（不支持)  **|
||APPLY_SCHEMA_POLICY|设置用户下所有表关联的策略  **（不支持)  **|
||ALTER_SCHEMA_POLICY|更改用户关下所有的表联的策略  **（不支持)  **|
||ENABLE_SCHEMA_POLICY|设置用户关联的策略有效  **（不支持)  **|
||DISABLE_SCHEMA_POLICY|设置用户下所有的表关联的策略无效  **（不支持)  **|
||REMOVE_SCHEMA_POLICY|移除用户下所有的表关联的策略  **（不支持)  **|
||POLICY_SUBSCRIBE|**（不支持)  **|
||POLICY_UNSUBSCRIBE|**（不支持)  **|
||GRANT_PROG_PRIVS|**（不支持)  **|
||SET_PROG_PRIVS|**（不支持)  **|
||REVOKE_PROG_PRIVS|**（不支持)  **|
|SA_USER_ADMIN|SET_USER_LABELS|用户关联策略|
||DROP_USER_ACCESS|移除用户关联的策略|
||ADD_GROUPS|**（不支持)  **|
||ALTER_COMPARTMENTS|**（不支持)  **|
||ALTER_GROUPS|**（不支持)  **|
||DROP_ALL_COMPARTMENTS|**（不支持)  **|
||DROP_ALL_GROUPS|**（不支持)  **|
||DROP_COMPARTMENTS|**（不支持)  **|
||DROP_GROUPS|**（不支持)  **|
||ADD_COMPARTMENTS|**（不支持)  **|
||SET_COMPARTMENTS|**（不支持)  **|
||SET_DEFAULT_LABEL|**（不支持)  **|
||SET_GROUPS|**（不支持)  **|
||SET_LEVELS|**（不支持)  **|
||SET_PROG_PRIVS|**（不支持)  **|
||SET_ROW_LABEL|**（不支持)  **|
||SET_USER_PRIVS|**（不支持)  **|
|  
|  
|  
|


**不支持的高级包**

|程序包名|存储过程|描述|
|---|---|---|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,SA_SESSION    
    
    
|COMP_READ|  
|
||COMP_WRITE|  
|
||GROUP_READ|  
|
||GROUP_WRITE|  
|
||LABEL|  
|
||MAX_LEVEL|  
|
||MAX_READ_LABEL|  
|
||MAX_WRITE_LABEL|  
|
||MIN_LEVEL|  
|
||MIN_WRITE_LEVEL|  
|
||PRIVS|  
|
||RESTORE_DEFAULT_LABELS|  
|
||ROW_LABEL|  
|
||SET_LABEL|  
|
||SA_USER_NAME|  
|
||SAVE_DEFAULT_LABELS|  
|
||SET_ACCESS_PROFILE|  
|
||SET_ROW_LABEL|  
|
|  
,  
,  
,  
,  
,  
,SA_UTL|CHECK_LABEL_CHANGE|  
|
||CHECK_READ|  
|
||CHECK_WRITE|  
|
||DATA_LABEL|  
|
||GREATEST_LBOUND|  
|
||LEAST_LBOUND|  
|
||NUMERIC_LABEL|  
|
||NUMERIC_ROW_LABEL|  
|
||SET_LABEL|  
|
||SET_ROW_LABEL|  
|
|  
|  
|  
|


**函数**

|函数名|描述|
|---|---|
|CHAR_TO_LABEL|根据标签内容返回对应的标签值|
|LABEL_TO_CHAR|根据标签值返回对应的标签内容|
|lbacsys.lbac$sa_labels.from_label|根据level, compartment, group 的值组成的字符串返回level, compartment, group的内容组成的字符串|


**表**

|表名|描述|
|---|---|
|YLS$PROPS|存储开关状态|
|YLS$POL|存储策略信息|
|YLS$LEVELS|存储级别信息|
|YLS$COMPARTMENTS|存储范围信息|
|YLS$GROUPS|存储组信息|
|YLS$LAB|存储标签信息|
|YLS$POLT|存储表关联的策略信息|
|YLS$USER_LABELS|存储用户关联的策略信息|


  


**视图**

|视图名|描述|
|---|---|
|DBA_YLS_STATUS|查看开关状态|
|DBA_SA_POLICIES|查看创建的安全策略|
|DBA_SA_LEVELS|查看安全策略的级别|
|DBA_SA_COMPARTMENTS|查看安全策略的范围|
|DBA_SA_GROUPS|查看安全策略的组|
|DBA_SA_LABELS|查看创建的标签|
|DBA_SA_TABLE_POLICIES|查看表关联的安全策略|
|DBA_SA_USER_LABELS|查看用户关联的标签|


  


**锁**

创建policy，level, compartment, group 新增 SPINLOCK_LBAC 进行并发控制。

对表设置策略，则使用表上的Spinlock 进行并发控制 + 对 lbac shareLock。

对用户设置策略，则使用  dcLatchUserByName + 对 lbac shareLock。

  


（3）语法简概（具体参数说明见开发设计文档）

1. LBAC开关


```
只有LBACSYS用户能设置开关状态。通过视图DBA_YLS_STATUS查看开关状态。

CALL LBACSYS.YLS_ENFORCEMENT.ENABLE_YLS;

CALL LBACSYS.YLS_ENFORCEMENT.DISABLE_YLS;
```

        2.策略

```
创建策略
SA_SYSDBA.CREATE_POLICY (
  policy_name IN VARCHAR,
  column_name IN VARCHAR DEFAULT NULL,
  default_options IN VARCHAR DEFAULT NULL);

删除策略
SA_SYSDBA.DROP_POLICY (
  policy_name IN VARCHAR,
  drop_column BOOLEAN DEFAULT FALSE);
```

        3.等级

```
创建等级
SA_COMPONENTS.CREATE_LEVEL (
  policy_name IN VARCHAR,
  level_num IN INTEGER,
  short_name IN VARCHAR,
  long_name IN VARCHAR);

删除等级
SA_COMPONENTS.DROP_LEVEL (
  policy_name IN VARCHAR,
  level_num IN INTEGER);
 
SA_COMPONENTS.DROP_LEVEL (
  policy_name IN VARCHAR,
  short_name IN VARCHAR);
```

        4.范围

```
创建范围
SA_COMPONENTS.CREATE_COMPARTMENT (
  policy_name IN VARCHAR,
  comp_num IN INTEGER,
  short_name IN VARCHAR,
  long_name IN VARCHAR);

删除范围
SA_COMPONENTS.DROP_COMPARTMENT (
  policy_name IN VARCHAR,
  comp_num IN INTEGER);
 
SA_COMPONENTS.DROP_COMPARTMENT (
 policy_name IN VARCHAR,
 short_name IN VARCHAR);
```

        5.标签

```
1、数据行
创建数据标签
SA_LABEL_ADMIN.CREATE_LABEL (
  policy_name IN VARCHAR,
  label_tag IN BINARY_INTEGER,
  label_value IN VARCHAR,
  data_label IN BOOLEAN DEFAULT TRUE);

删除数据标签
SA_LABEL_ADMIN.DROP_LABEL (
  policy_name IN VARCHAR,
  label_tag IN BINARY_INTEGER);
 
SA_LABEL_ADMIN.DROP_LABEL (
  policy_name IN VARCHAR,
  label_value IN VARCHAR);

2、用户
创建用户标签
SA_USER_ADMIN.SET_USER_LABELS (
  policy_name IN VARCHAR,
  user_name IN VARCHAR,
  max_read_label IN VARCHAR,
  max_write_label IN VARCHAR DEFAULT NULL,
  min_write_label IN VARCHAR DEFAULT NULL,
  def_label IN VARCHAR DEFAULT NULL,
  row_label IN VARCHAR DEFAULT NULL);

删除用户标签
SA_USER_ADMIN.DROP_USER_ACCESS (
  policy_name IN VARCHAR,
  user_name IN VARCHAR);
```

       6.策略应用到表

通过存储过程SA_POLICY_ADMIN.APPLY_TABLE_POLICY将策略作用到表上。通过视图DBA_SA_TABLE_POLICIES查看表关联的策略。

- table上应用policy后,有且只有数据行label和用户label能匹配上的数据才能被访问到, 默认没有label的数据行永远无法被访问。
- 如对表应用policy之前,表中就存有数据的场景, 在应用policy后需要为这部分数据添加label。
- policy应用到table后, 普通用户在不赋权label时无法无法操控数据库, 要为原有数据添加label只能使用特权来绕过YLS的认证（当前不支持SA_USER_ADMIN.SET_USER_PRIVS设置特权操作）。


**当前一个表只支持关联1个策略。**

```
对表添加策略
SA_POLICY_ADMIN.APPLY_TABLE_POLICY (
  policy_name IN VARCHAR,
  schema_name IN VARCHAR,
  table_name IN VARCHAR,
  table_options IN VARCHAR DEFAULT NULL,
  label_function IN VARCHAR DEFAULT NULL,
  predicate IN VARCHAR DEFAULT NULL);

对表移除策略
SA_POLICY_ADMIN.REMOVE_TABLE_POLICY (
 policy_name IN VARCHAR,
 schema_name IN VARCHAR,
 table_name IN VARCHAR,
 drop_column IN BOOLEAN DEFAULT FALSE);
```

## 2.2 应用场景

- LBAC是将行标签与用户的标签授权进行比较，能够轻松地将敏感信息限制为仅授权用户访问。 这样，具有不同权限级别的用户可以访问表中特定的数据行，从而实现多级安全 (MLS) 的要求。对于合规和信创有重要意义


## 2.3 规格约束

- 只支持上面所列出的具体功能，LBAC对照Oracle 功能，没列出来的均不支持，如group组件，对用户赋特权等
- 除以上不支持的功能外，目前仅有一处与Oracle没有保持一致：  一个表只允许关联1个安全策略
- YLS$表中与name相关的字段，为了与yashan现有字段保持一致，均改为64字节，与Oracle（短名称30字节，长名称80字节）不一致


# 3. 详细测试设计

## 3.1 测试设计方法

边界值，等价类，场景分析等。

## 3.2 详细测试设计

*1、使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*    
    


[支持LBAC策略和标签测试设计（单机）.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjNhMWFkOWEzMzExZGM4ZGQxIiwicmVmX2lkIjoiNjczOTZjZjM3MjgyMDZlZmI5MmYxOTA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTA2LCJleHAiOjE3ODIzOTEzMDZ9.n7Tuppn-rhOUhQV-mb0zD3ESoNCNJHvgr_LLB_KZWFg)

```
# 支持LBAC策略和标签能力测试设计

## 需求规格：
1.启动和禁用LBCA
2.标签管理：支持创建删除标签，标签实现基于Level和标签和基于隔离区的标签，可以设置用户标签，session标签和行标签。
3.策略管理：支持创建删除策略
4.用户权限与角色支持：增加安全管理员角色与安全管理员。
5.安全谓词：根据配置，生成对应的安全谓词。

## 功能测试

### LBAC开关

- 关闭

	- 默认关闭？

	- 执行创建策略、标签会报错

- 开启

	- 不会报错

### 策略（Policy）

- 自身

	- 创建安全策略

		- 基本语法

			- 不报错

		- 最大支持1000个策略（没有这个限制？）

			- <=1000

			- >1000

		- 策略名

			- 最大64字节

				- <=64

				- >64

			- 唯一

			- 中文、符号等

		- default_options（控制类选项）

			- LABEL_DEFAULT

				- 表或用户没指定默认选项

				- 除非
用户在INSERT上显式指定了一个标签？？？

			- READ_CONTROL

				- 只有授权的行可用于SELECT、UPDATE等，
和DELETE操作。

			- WRITE_CONTROL

				- 对INSERT,UPDATE,DELETE 操作进行约束，包含：INSERT_CONTROL，
UPDATE_CONTROL, DELETE_CONTROL

			- INSERT_CONTROL

				- 对INSERT操作进行约束

			- DELETE_CONTROL

				- 对DELETE操作进行约束

			- UPDATE_CONTROL


				- 对UPDATE操作进行约束

			- HIDE

				- 标签列是否为隐藏列

			- LABEL_UPDATE

			- CHECK_CONTROL

			- ALL_CONTROL

			- NO_CONTROL

			- 其他值

			- 多次写重复

		- 入参个数、非法字符等

	- 删除安全策略

		- 基本语法

			- 不报错

		- 策略被label使用

			- 删除策略成功

		- 删除策略成功

			- 查询策略关联的level, compartment, group，不存在？

		- 非法场景（大小写）

	- 查看视图

		- DBA_SA_POLICIES

- 组成

	- 等级（level）

		- 创建等级

			- 基本语法

				- 不报错

			- 等级值

				- 0<= <=9999

				- >9999

				- <0

				- 不同一策略下创建两个相等等级值

					- 不报错

				- 同一策略下创建两个相等等级值

					- 报错

				- 带小数的数值？十六进制等？非法

					- 报错

				- 非数值

			- 短/长名称长度

				- <=64

				- >64

			- 等级个数（一个策略下）

				- <=9999

				- >9999

					- 报错

			- 入参值（null、空、空串，非法），入参个数

		- 删除等级

			- 基本语法

			- 等级被label使用

				- 删除等级失败

			- 非法

		- 查看视图

			- DBA_SA_LEVELS

	- 范围（compartment）

		- 创建范围

			- 基本语法

			- 范围值

				- 0<= <=9999

				- >9999

				- <0

				- 不同一策略下创建两个相等等级值

					- 不报错

				- 同一策略下创建两个相等范围值

					- 报错

				- 带小数的数值？

			- 范围个数（一个策略下）

				- <=9999

				- >9999

					- 报错

			- 短/长名称长度

				- <=64

				- >64

				- 短名称不能重复，长名称可以重复（同一个策略下）

		- 删除范围

			- 基本语法

			- 等级被label使用

				- 删除范围失败

		- 查看视图

			- DBA_SA_COMPARTMENTS

	- 组（group）

		- 暂未实现

### 标签（label）

- 组成

	- 等级（level）

		- 范围（compartment）

			- 组（group）

- 分类

	- 数据标签

		- 创建标签

			- 基本语法

				- CREATE_LABEL

			- 标签标识值

				- 0<= <=99999999

				- >99999999

				- <0

				- 不同一策略下创建两个相等标签标识值

					- 不报错

				- 同一策略下创建两个相等标签标识值

					- 报错

				- 带小数的数值？

			- 标签内容

				- 同一组件类型的短名称以‘，’做间隔，不同组件类型的短名称以‘：’做间隔

				- 同一组件类型用’ ：‘，不同组件用’ ，‘

					- 报错

				- 标签内容为level, compartment, group长名称

					- 报错

				- 4000

		- 删除标签

			- 基本语法

				- DROP_LABEL

			- 非法场景

		- 查看视图

			- DBA_SA_LABELS

	- 用户标签

		- 创建用户标签

			- 基本语法

				- SET_USER_LABELS

			- max_read_label

				- 用户的最大读标记

					- 授予用户的最大等级

					- 具有读权限的范围集合

			- max_write_label

				- max_write_label.level= max_read_label.level

				- max_write_label.level != max_read_label.level

					- 报错

				- max_write_label.comps为 max_read_label.comps的子集

				- max_write_label.comps不为 max_read_label.comps的子集

					- 报错

				- null

					- max_read_label

			- min_write_label

				- 只包含level,不包含compartment和group

				- 都包含

					- 报错

			- def_label

				- def_label.level <= max_read_label.level

				- def_label.level > max_read_label.level

					- 报错

				- def_label.comps 为max_read_label.comps的子集

				- def_label.comps 不为max_read_label.comps的子集

					- 报错

				- null

					- max_read_lable

			- row_label

				- 包含level, compartment(是max_write_label.comps和 def_label.comps的子集)

				- 只包含存在的leve

				- 只包含compartment(是max_write_label.comps和 def_label.comps的子集)

					- 报错

				- 包含level, compartment(不是max_write_label.comps和 def_label.comps的子集)

					- 报错

				- 不能存在的level、compartmen

					- 报错

			- 非法（不能存在、删除等级范围后创建报错？大小写）

		- 删除用户标签

			- 基本语法

				- DROP_USER_ACCESS

			- 非法

		- 查看视图

			- DBA_SA_USER_LABELS

		- 删用户，系统表、视图信息还存在？重新创建该用户，能否和之前表现一致

		- 子主题 5

### 策略应用到表

- 对表添加策略

	- 基本语法

		- APPLY_TABLE_POLICY

	- 不插入数据的表

		- 策略应用到表

			- 数据行标签<=用户标签

				- 用户可以访问

			- 数据行标签>用户标签

				- 用户无法访问

			- 用户没有被赋标签

				- 用户无法访问

	- 插入数据的表

		- 策略应用到表

			- 有label的数据行

				- 数据行标签<=用户标签

					- 用户可以访问

				- 数据行标签>用户标签

					- 用户无法访问

				- 用户没有被赋标签

					- 用户无法访问

			- 没有label的数据行

				- 用户永远无法访问

				- 添加数据行标签（采用update？）

					- 数据行标签<=用户标签

						- 用户可以访问

					- 数据行标签>用户标签

						- 用户无法访问

					- 用户没有被赋标签

						- 用户无法访问

	- 关联策略个数

		- 一个表一个策略

		- 多个表同一个策略

		- 一个表多个策略

			- 报错

	- 表的强制选项设置（table_options）

		- 策略上定义的相关default_options

		- NULL

			- 使用策略上定义的default_options值（不为null）

			- default_options值为null

				- 报错？

- 对表移除策略

	- 基本语法

		- REMOVE_TABLE_POLICY

	- drop_column

		- true

			- 删除表中标签列

		- 其它

			- 不删

- 新增列

	- 使用desc查看表新增列

	- 作为where后面的字段

- 查看视图

	- DBA_SA_TABLE_POLICIES

- 重复添加移除的场景：执行了SQL、添加策略关联、移除了SQL、再次执行SQL、重新添加策略关联、执行SQL、移除、执行SQL

### 函数

- LABEL_TO_CHAR

	- 语法

		- FUNCTION LABEL_TO_CHAR (
  label IN NUMBER)
RETURN VARCHAR;

		- 返回标签值对应的标签内容

	- 入参个数

		- 0，2

			- 报错

		- 1

	- 入参值

		- null

		- 空、空串

		- 列

		- 隐式转换

		- 函数返回值

	- 异常场景

		- 入参值非法（中文、符号、字母、不存在的标签值），入参类型（udt、record、其他），带括号，四则运算，布尔

	- dml场景中使用

	- 大小写

- CHAR_TO_LABEL

	- 语法

		- 
FUNCTION CHAR_TO_LABEL (
  policy_name IN VARCHAR,
  label_string IN VARCHAR)
RETURN NUMBER;

		- 返回标签内容对应的标签值

	- 入参个数

		- 0，1，3

			- 报错

		- 2

	- 入参值

		- null

		- 空、空串

		- 列

	- 异常场景

		- 入参值非法（中文、符号、不存在的标签值、常量、涉及表达式）

	- dml场景中使用

- LBACSYS.LBAC$SA_LABELS.FROM_LABEL

	- 语法

		- FUNCTION LBACSYS.LBAC$SA_LABELS.FROM_LABEL(
  label_value_string IN VARCHAR)
RETURN VARCHAR;

	- 根据level, compartment, group 的值组成的字符串返回level, compartment, group的内容组成的字符串

	- 入参个数

		- 0，2

			- 报错

		- 1

	- 入参格式

		- 类似0010.%0010%0020%0030%0040%

		- 不带, 或 %

			- 报错

		- 单个非法性

	- 入参值

		- null

		- 空、空串

		- 列

	- 异常场景

		- 入参值非法（中文、符号、字母）

### 多表、子查询、集合

### 不支持语法

- ALTER_POLICY

- ENABLE_POLICY

- 其他见https://conf.yasdb.com/pages/viewpage.action?pageId=135606670

## 部署形态

### 单机

- 主备同步

	- 主机的操作是否可以完全同步到备机

	- 执行一系列操作后，备机升主机，再执行测试看是否符合预期 

	- 异常

### 分布式

- 拦截

## 表/视图类型

### heap

- 带索引

	- 带条件

	- 回表/不回表

- 不带索引

### 视图

- 普通视图

- 物化视图

### 列表

- 拦截

## 专项测试

### 并发测试

- 正常查询时用到了 LBAC  强制访问控制，正在使用时，并发执行删除策略 或删除标签操作（删除表或用户）

	- join（执行时间长些）

	- 相同、不同对象之间并发

		- 开关、应用、创建删除

	- dml和LBAC之间并发

	- 并发查询时，创建策略、标签、应用

	- 查询和dml和关闭LBAC开关并发

- 不core

### 性能测试

- 在关闭LBAC的情况下，保证原有用例性能不会有所下降

- 在开启LBAC的情况下，性能不能有所下降

	- 摸底降低多少？

### 有关缓存失效

- session1: sql1 用到了强制访问控制，新开个session2 ：移除用户关联的策略，然后看session1 继续执行同样的sql1 ,看下查询结果有没有变化

- 执行 SQL 后，添加/删除策略、添加/删除用户关联策略、添加/删除策略应用到表等（等级、范围）

- 执行 SQL 后，删除用户，关联删除，查看相关表/视图；删除表，关联删除，查看相关表/视图

- 关闭LBAC

## YLS表/视图

### YLS相关表

- YLS$PROPS

	- 存储lbac开关状态

- YLS$POL

	- 存储安全策略信息

	- sys.obj$

- YLS$LEVELS

	- 存储安全策略的等级信息

- YLS$COMPARTMENTS

	- 存储安全策略的范围信息

- YLS$GROUPS

- YLS$LAB

	- 存储标签的信息

- YLS$POLT

	- 存储表关联的策略信息

- YLS$USER_LABELS

	- 存储用户关联的策略信息

### YLS 相关视图

- 查看开关状态 

	- select * from dba_yls_status;

- 查看创建的policy

	- select * from dba_sa_policies;

- 查看创建的level

	- select * from dba_sa_levels;

- 查看创建的compartments

	- select * from dba_sa_compartments;

- 查看创建的groups

	- select * from dba_sa_groups;

- 查看创建的labels

	- select * from dba_sa_labels;

- 查看table上的policy

	- select * from dba_sa_table_policies;

- 查看用户的label

	- select * from dba_sa_user_labels;

- 查看当前session label

- 查看当前row label:

### 测试方法

- 进行LBAC相关操作后，对应查看相关表或相关视图
```

  


*2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
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


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[冒烟用例及全量文本用例（单机）.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjQ4OTcwYzJhZjRmNTIwZjVlIiwicmVmX2lkIjoiNjczOTZjZjM3MjgyMDZlZmI5MmYxOTA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTA2LCJleHAiOjE3ODIzOTEzMDZ9.cFisOcfGZyBEPXkuvLdgUclzfr9Y7Ofom9fbIb0Q-EQ)

# 5. 测试框架设计

      沿用guider框架

# 6. 测试环境说明

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


# 7. 工作量评估

工作量：1人15天

计划测试完成时间：2023年12月26日

  


## Attachments:

[冒烟用例及全量文本用例（单机）.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjQ4OTcwYzJhZjRmNTIwZjVlIiwicmVmX2lkIjoiNjczOTZjZjM3MjgyMDZlZmI5MmYxOTA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTA2LCJleHAiOjE3ODIzOTEzMDZ9.cFisOcfGZyBEPXkuvLdgUclzfr9Y7Ofom9fbIb0Q-EQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[支持LBAC策略和标签测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjQ4OTcwYzJhZjRmNTIwZjVmIiwicmVmX2lkIjoiNjczOTZjZjM3MjgyMDZlZmI5MmYxOTA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTA2LCJleHAiOjE3ODIzOTEzMDZ9.O2QLf-pof2amoaRwROlLUjonQpOCFyXy-awbd6_iNvw)

 (application/x-xmind)    


[冒烟用例及全量文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjRhMWFkOWEzMzExZGM4ZGQyIiwicmVmX2lkIjoiNjczOTZjZjM3MjgyMDZlZmI5MmYxOTA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTA2LCJleHAiOjE3ODIzOTEzMDZ9.kk8J0J0vusIkgY1118DnPQMH7h-T2dtXWNKTAbN8DKQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[支持LBAC策略和标签测试设计（单机）.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjQ4OTcwYzJhZjRmNTIwZjY0IiwicmVmX2lkIjoiNjczOTZjZjM3MjgyMDZlZmI5MmYxOTA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTA2LCJleHAiOjE3ODIzOTEzMDZ9.6FAGxwbjwpW0Z9VSI8LJW-JZ2kQ1Uqw8sF5uGywyVXg)

 (application/x-xmind)    


[支持LBAC策略和标签测试设计（单机）.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjNhMWFkOWEzMzExZGM4ZGQxIiwicmVmX2lkIjoiNjczOTZjZjM3MjgyMDZlZmI5MmYxOTA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0OTA2LCJleHAiOjE3ODIzOTEzMDZ9.n7Tuppn-rhOUhQV-mb0zD3ESoNCNJHvgr_LLB_KZWFg)

 (application/x-xmind)    


## Comments:

|  [](null)  ,会议纪要,参与人：罗继鸿、张鹏飞 、郝鑫刚、王林、刘晓旋、韩晓盼,评审时间：2023年11月24日,评审地点：25座702会议,遗留问题：,1、创建策略时，参数  default_options内容是否生效？,2、集群是否需要单独拆一个SR进行测试？,3、涉及到的标签转换能力函数是否需要单独拆一个SR进行测试？,评审结论：通过,Posted by hanxiaopan at 十二月 19, 2023 18:28|
|---|
