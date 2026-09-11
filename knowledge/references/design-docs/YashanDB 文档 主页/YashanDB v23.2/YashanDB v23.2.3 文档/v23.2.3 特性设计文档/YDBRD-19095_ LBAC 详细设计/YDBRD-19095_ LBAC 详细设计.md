Created by 王林, last modified on 十月 18, 2024

SR:      [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中



-   [1 概述](#YDBRD19095:LBAC详细设计-1概述)  
-   [2 功能特性](#YDBRD19095:LBAC详细设计-2功能特性)  
    -   [2.1 LBAC开关](#YDBRD19095:LBAC详细设计-2.1LBAC开关)  
    -   [2.2 策略](#YDBRD19095:LBAC详细设计-2.2策略)  
        -   [2.2.1 创建策略](#YDBRD19095:LBAC详细设计-2.2.1创建策略)  
        -   [2.2.2 删除策略](#YDBRD19095:LBAC详细设计-2.2.2删除策略)  
    -   [2.3 级别](#YDBRD19095:LBAC详细设计-2.3级别)  
        -   [2.3.1 创建等级](#YDBRD19095:LBAC详细设计-2.3.1创建等级)  
        -   [2.3.2 删除等级](#YDBRD19095:LBAC详细设计-2.3.2删除等级)  
    -   [2.4 范围](#YDBRD19095:LBAC详细设计-2.4范围)  
        -   [2.4.1 创建范围](#YDBRD19095:LBAC详细设计-2.4.1创建范围)  
        -   [2.4.2 删除范围](#YDBRD19095:LBAC详细设计-2.4.2删除范围)  
    -   [2.5 标签](#YDBRD19095:LBAC详细设计-2.5标签)  
        -   [2.5.1 创建标签](#YDBRD19095:LBAC详细设计-2.5.1创建标签)  
        -   [2.5.2 删除标签](#YDBRD19095:LBAC详细设计-2.5.2删除标签)  
    -   [2.6 策略应用到表](#YDBRD19095:LBAC详细设计-2.6策略应用到表)  
        -   [2.6.1 对表添加策略](#YDBRD19095:LBAC详细设计-2.6.1对表添加策略)  
        -   [2.6.2 对表移除策略](#YDBRD19095:LBAC详细设计-2.6.2对表移除策略)  
    -   [2.7 设置用户标签](#YDBRD19095:LBAC详细设计-2.7设置用户标签)  
    -   [2.8 删除用户关联的策略](#YDBRD19095:LBAC详细设计-2.8删除用户关联的策略)  
    -   [2.9 函数](#YDBRD19095:LBAC详细设计-2.9函数)  
        -   [2.9.1 LABEL_TO_CHAR](#YDBRD19095:LBAC详细设计-2.9.1LABEL_TO_CHAR)  
        -   [2.9.2 CHAR_TO_LABEL](#YDBRD19095:LBAC详细设计-2.9.2CHAR_TO_LABEL)  
        -   [2.9.3 LBAC$SA_LABELS.FROM_LABEL](#YDBRD19095:LBAC详细设计-2.9.3LBAC$SA_LABELS.FROM_LABEL)  
    -   [2.10 YLS相关表](#YDBRD19095:LBAC详细设计-2.10YLS相关表)  
        -   [2.10.1 YLS$PROPS](#YDBRD19095:LBAC详细设计-2.10.1YLS$PROPS)  
        -   [2.10.2 YLS$POL](#YDBRD19095:LBAC详细设计-2.10.2YLS$POL)  
        -   [2.10.3 YLS$LEVELS](#YDBRD19095:LBAC详细设计-2.10.3YLS$LEVELS)  
        -   [2.10.4 YLS$COMPARTMENTS](#YDBRD19095:LBAC详细设计-2.10.4YLS$COMPARTMENTS)  
        -   [2.10.5 YLS$GROUPS （不支持）](#YDBRD19095:LBAC详细设计-2.10.5YLS$GROUPS（不支持）)  
        -   [2.10.6 YLS$LAB](#YDBRD19095:LBAC详细设计-2.10.6YLS$LAB)  
        -   [2.10.7 YLS$POLT](#YDBRD19095:LBAC详细设计-2.10.7YLS$POLT)  
        -   [2.10.8 YLS$USER_LABELS](#YDBRD19095:LBAC详细设计-2.10.8YLS$USER_LABELS)  
    -   [2.11 YLS序列](#YDBRD19095:LBAC详细设计-2.11YLS序列)  
        -   [2.11.1 YLS$LAB_SEQUENCE](#YDBRD19095:LBAC详细设计-2.11.1YLS$LAB_SEQUENCE)  
        -   [2.11.2 YLS$TAG_SEQUENCE](#YDBRD19095:LBAC详细设计-2.11.2YLS$TAG_SEQUENCE)  
    -   [2.12 YLS 相关视图](#YDBRD19095:LBAC详细设计-2.12YLS相关视图)  
    -   [2.13 锁](#YDBRD19095:LBAC详细设计-2.13锁)  
-   [3 接口](#YDBRD19095:LBAC详细设计-3接口)  
-   [4 功能限制](#YDBRD19095:LBAC详细设计-4功能限制)  
-   [5 详细设计](#YDBRD19095:LBAC详细设计-5详细设计)  
    -   [5.1 控制类型 ](#YDBRD19095:LBAC详细设计-5.1控制类型)  
    -   [5.2 开关](#YDBRD19095:LBAC详细设计-5.2开关)  
    -   [5.3 策略](#YDBRD19095:LBAC详细设计-5.3策略)  
    -   [5.4 标签内容](#YDBRD19095:LBAC详细设计-5.4标签内容)  
    -   [5.5 表上关联的策略信息](#YDBRD19095:LBAC详细设计-5.5表上关联的策略信息)  
    -   [5.6 用户上关联的策略信息](#YDBRD19095:LBAC详细设计-5.6用户上关联的策略信息)  
    -   [5.7 读判断](#YDBRD19095:LBAC详细设计-5.7读判断)  
    -   [5.8 写判断](#YDBRD19095:LBAC详细设计-5.8写判断)  
    -   [5.9 lbac操作对sql缓存的影响](#YDBRD19095:LBAC详细设计-5.9lbac操作对sql缓存的影响)  
    -   [5.10 anlHandler上挂的lbac信息](#YDBRD19095:LBAC详细设计-5.10anlHandler上挂的lbac信息)  
-   [6 自测用例](#YDBRD19095:LBAC详细设计-6自测用例)  
-   [7 资料](#YDBRD19095:LBAC详细设计-7资料)  
-   [8 工作量](#YDBRD19095:LBAC详细设计-8工作量)  
-   [9 遗留](#YDBRD19095:LBAC详细设计-9遗留)  




# 1 概述

YashanDB Label Security，通过Label-Based Access Control （简称LBAC）一种基于行标签的访问控制，实现了基于策略对数据库中的表提供行级安全控制功能。

Label Security 是强制访问控制的一种方式，通过在表中添加一个 Label 列来记录每行的 Label 值，在访问时通过比较用户的 Label 和数据的 Label值，达到约束主体（用户）对客体（表中的数据）访问的目的。

  


LBAC 有策略、组件、标签构成。  策略是一种预定义标记组件，由等级（level)、范围（compartment）和组（group)构成，从3个不同的维度对数据进行描述，其中等级在策略中是必须存在的，范围和组可以缺省。

![](https://pingcode.yasdb.com/atlas/files/public/67396d47a1ad9a3311dc9034/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

标签由等级、范围、组构成，其中等级是必选的，范围和组可以省略。

![](https://pingcode.yasdb.com/atlas/files/public/67396d47a1ad9a3311dc9035/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

说明如下：

- Policy： 就是安全策略，一个安全策略是level，compartment，group，label的集合。
- Level：  等级，这是最基础的安全控制等级，必须设置。
- Compartment：范围，提供第二级的安全控制，是可选的。
- Group：组，提供第三级的安全控制，是可选的。
- Label：标签，最终体现到每一行上的安全标签，必须设置。只有用户被赋予的标签和此行上的标签相同或者等级更高的时候，该行才能够被用户存取。


  


数据库提供了内置的角色 LBAC_DBA 来管理和使用该功能，安全管理员可以通过创建安全策略、定义策略中的 Label、设置用户的 Label，来定制自己的安全策略。

一个安全策略可以应用到多张表上，一张表也可以应用多个安全策略。每当一个安全策略被应用，这张表上自动会添加一列，用于该安全策略的访问控制。

超级用户SYS读写等操作不受LBAC限制。

# 2 功能特性

要实现的功能点如下：

**程序包**

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

  点击此处展开...

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
|LBAC$SA_LABELS.FROM_LABEL|根据level, compartment, group 的值组成的字符串返回level, compartment, group的内容组成的字符串。,LBAC$SA_LABELS 为高级包名。|


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

对用户设置策略，则使用  dcLatchUserByName + 对 lbac spinlock_user。

  


## 2.1 LBAC开关

只有SYS用户或有LBAC_DBA角色的用户能设置开关状态。通过视图DBA_YLS_STATUS查看开关状态。

CALL YLS_ENFORCEMENT.ENABLE_YLS;

CALL YLS_ENFORCEMENT.DISABLE_YLS; 

## 2.2 策略

### 2.2.1 创建策略

通过存储过程SA_SYSDBA.CREATE_POLICY 创建一个标签安全策略。通过视图DBA_SA_POLICIES查看创建的策略。（oracle最大支持策略个数1000个，yasdb 无限制）。

语法

```
SA_SYSDBA.CREATE_POLICY (
  policy_name IN VARCHAR,
  column_name IN VARCHAR DEFAULT NULL,
  default_options IN VARCHAR DEFAULT NULL);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名，最大64字节。|
|column_name|受策略保护的表，要新加列的名称。若为NULL则新加列的名称为policy_name_COL。,不同的策略对应的列名不同。|
|default_options|策略对应的默认选项，在使用策略时，若表或用户没指定选项则使用策略的默认选项。|


  


控制类型选项

|选项名|描述|
|---|---|
|LABEL_DEFAULT|使用会话的默认行标签值，除非用户在INSERT上显式指定了一个标签。  **（不支持）**|
|LABEL_UPDATE|**（不支持）**|
|CHECK_CONTROL|**（不支持）**|
|READ_CONTROL|只有授权的行可用于SELECT、UPDATE等，,和DELETE操作。|
|WRITE_CONTROL|对INSERT,UPDATE,DELETE 操作进行约束，包含：INSERT_CONTROL，,UPDATE_CONTROL, DELETE_CONTROL|
|INSERT_CONTROL|对INSERT操作进行约束|
|DELETE_CONTROL|对DELETE操作进行约束|
|UPDATE_CONTROL|对UPDATE操作进行约束|
|ALL_CONTROL|代表：READ_CONTROL, INSERT_CONTROL, UPDATE_CONTROL, DELETE_CONTROL, LABEL_DEFAULT, LABEL_UPDATE, CHECK_CONTROL  **（不支持）**|
|NO_CONTROL|NO_CONTROL   **（不支持）**|
|HIDE|标签列是否为隐藏列  **（不支持）**|


### 2.2.2 删除策略

通过存储过程SA_SYSDBA.DROP_POLICY 删除一个标签安全策略。

语法

```
SA_SYSDBA.DROP_POLICY ( 
  policy_name IN VARCHAR,
  drop_column BOOLEAN DEFAULT FALSE);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|drop_column|是否删除应用策略时加的列|


  


删除策略时，会级联依次删除用户上加载的策略信息、表上加载的策略信息、策略关联的level, compartment, group，（级联删除整体上不是原子操作，执行删除用户上加载的策略信息、表上加载的策略信息、策略关联的level, compartment, group 是1个个命令单独执行的）。

## 2.3 级别

### 2.3.1 创建等级

通过存储过程SA_COMPONENTS.CREATE_LEVEL创建一个等级。level_num值越大，表示控制的范围越大。通过视图DBA_SA_LEVELS查看创建的LEVEL。

语法

```
SA_COMPONENTS.CREATE_LEVEL (
  policy_name IN VARCHAR,
  level_num IN INTEGER,
  short_name IN VARCHAR,
  long_name IN VARCHAR);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|level_num|等级值（0-9999)  ，值越大，表示控制的范围越大。同一策略下该值具有唯一性。|
|short_name|等级的短名称，最大64字节|
|long_name|等级的长名称，  最大64字节|


### 2.3.2 删除等级

通过存储过程SA_COMPONENTS.DROP_LEVEL删除一个等级。如果该级别正在被label使用，则该等级不能被删除。

语法

```
SA_COMPONENTS.DROP_LEVEL (
  policy_name IN VARCHAR,
  level_num IN INTEGER);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|level_num|等级值。|


## 2.4 范围

### 2.4.1 创建范围

通过存储过程SA_COMPONENTS.CREATE_COMPARTMENT创建范围（compartment）。comp_num 只是数值，不表示范围大小。通过视图DBA_SA_COMPARTMENTS查看已创建的compartment。

语法

```
SA_COMPONENTS.CREATE_COMPARTMENT (
  policy_name IN VARCHAR,
  comp_num IN INTEGER,
  short_name IN VARCHAR,
  long_name IN VARCHAR);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|comp_num|范围值（0-9999），同一策略下该值具有唯一性。|
|short_name|范围的短名称，最大64字节|
|long_name|范围的长名称，最大64字节|


### 2.4.2 删除范围

通过存储过程SA_COMPONENTS.DROP_COMPARTMENT删除一个范围。如果该范围正在被label使用，则该范围不能被删除。

语法

```
SA_COMPONENTS.DROP_COMPARTMENT (
  policy_name IN VARCHAR,
  comp_num IN INTEGER);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|comp_num|范围值|


## 2.5 标签

### 2.5.1 创建标签

通过存储过程SA_LABEL_ADMIN.CREATE_LABEL创建标签。label_tag 只是label对应的数值，无包含关系，具有唯一性。通过视图DBA_SA_LABELS查看已创建的label。

label有两方面用处, 一方面用于表中数据行, 另一方面用于赋给用户; 用于控制用户能访问到的数据。

  


语法

```
SA_LABEL_ADMIN.CREATE_LABEL (
  policy_name IN VARCHAR,
  label_tag IN BINARY_INTEGER,
  label_value IN VARCHAR,
  data_label IN BOOLEAN DEFAULT TRUE);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|label_tag|标签标识值，范围（0-99999999)。不支持值为0，值具有唯一性。|
|label_value|标签内容，由level, compartment, group短名称组成。同一组件类型的短名称以‘，’做间隔，不同组件类型的短名称以‘：’做间隔。|
|data_label|标签是否有效标志，默认值为TRUE，表示可以正常使用该标签作用到行上。|


### 2.5.2 删除标签

通过存储过程SA_LABEL_ADMIN.DROP_LABEL删除标签。

语法

```
SA_LABEL_ADMIN.DROP_LABEL (
  policy_name IN VARCHAR,
  label_tag IN BINARY_INTEGER);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|label_tag|标签标识值|


## 2.6 策略应用到表

### 2.6.1 对表添加策略

通过存储过程SA_POLICY_ADMIN.APPLY_TABLE_POLICY将策略作用到表上。通过视图DBA_SA_TABLE_POLICIES查看表关联的策略。

- table上应用policy后,有且只有数据行label和用户label能匹配上的数据才能被访问到, 默认没有label的数据行永远无法被访问。
- 如对表应用policy之前,表中就存有数据的场景, 在应用policy后需要为这部分数据重复赋label值，否则这些前面就存在的行数据标签列值为NULL只能sys用户才能读取。
- policy应用到table后, 普通用户在不赋权label时无法无法操控数据库, 要为原有数据添加label只能使用特权来绕过YLS的认证（当前不支持SA_USER_ADMIN.SET_USER_PRIVS设置特权操作）。
- 表关联策略后，标签列对应的默认值为sys_context('lbac', policy_name),  表取消策略关联后，若没删除标签列，则标签列的默认值设置为NULL。


  


限制

当前一个表只支持关联1个策略。

  


语法

```
SA_POLICY_ADMIN.APPLY_TABLE_POLICY (
  policy_name IN VARCHAR,
  schema_name IN VARCHAR,
  table_name IN VARCHAR,
  table_options IN VARCHAR DEFAULT NULL,
  label_function IN VARCHAR DEFAULT NULL,
  predicate IN VARCHAR DEFAULT NULL);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|schema_name|模式名|
|table_name|表名|
|table_options|表的强制选项设置，用‘，’隔开。若为NULL则使用策略上定义的default_options值；,若策略上的default_options为NULL则table_options会设置为read_control+write_control。|
|**label_function**|字符串调用函数以返回标签值，以用作默认值  。  **(不支持)**|
|**predicate**|附加谓词，用于与基于标签的谓词结合（使用  AND  或  OR  ）。  **(不支持)**|


  


**sql缓存处理**

对表添加、移除策略时，对表dc进行失效处理。

### 2.6.2 对表移除策略

通过存储过程SA_POLICY_ADMIN.REMOVE_TABLE_POLICY将策略从表上移除。

语法

```
SA_POLICY_ADMIN.REMOVE_TABLE_POLICY (
 policy_name IN VARCHAR,
 schema_name IN VARCHAR,
 table_name IN VARCHAR,
 drop_column IN BOOLEAN DEFAULT FALSE);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|schema_name|模式名|
|table_name|表名|
|drop_column|是否删除表中标签列，为true会删除，否则不删除 |


  


表取消策略关联后，若没删除标签列，则标签列的默认值设置为NULL。

  


## 2.7 设置用户标签

使用存储过程SA_USER_ADMIN.SET_USER_LABELS，通过lables设置用户对应的level, compartment, group。避免组件一个个设置。通过视图DBA_SA_USER_LABELS查看用户关联的策略标签信息。

语法

```
SA_USER_ADMIN.SET_USER_LABELS (
  policy_name IN VARCHAR,
  user_name IN VARCHAR,
  max_read_label IN VARCHAR,
  max_write_label IN VARCHAR DEFAULT NULL,
  min_write_label IN VARCHAR DEFAULT NULL,
  def_label IN VARCHAR DEFAULT NULL,
  row_label IN VARCHAR DEFAULT NULL);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|user_name|用户名|
|max_read_label|指定用户的最大读标记，该标记包含授予用户的最大等级和具有读权限的范围集合|
|max_write_label|指定用户的最大写标记，该标记包含授予用户的最大等级和具有写权限的范围。该参数必须满足如下条件：,（1）max_write_label.level= max_read_label.level。,（2）     max_write_label.comps为 max_read_label.comps的子集。,（3）     max_write_label.groups 为 max_read_label.groups的子集。,如果该参数为空，那么系统自动将其值设置为max_read_label。|
|min_write_label|指定用户的最小写标记，只包含level,不包含compartment和group。,如果该参数为空，那么系统将其值设置为策略内的最小等级。|
|def_label|用户的默认会话标记，包含：level, compartment, group(是max_read_lable.group的子集)。  该参数必须满足如下条件：,（1）def_label.level <= max_read_label.level,（2）def_label.comps 为  max_read_label.comps的子集。,（3）def_label.groups 为  max_read_label.groups的子集。,如果该参数为空，那么系统将其值设置为max_read_lable。|
|row_label|指定写入的行标记值，包含level, compartment(是max_write_label.comps和 def_label.comps的子集), group(是max_write_label.groups 和 def_label.groups的子集)。,如果该参数为空，那么系统将其值设置为def_label (准确的说是 def_write_label).|


  


      有关session label 设置 ：在给用户设置label时, 设定有用户默认的初始化连接数据库的label, 也设定有用户的最大和最小label，session label的取值决定着用户所能操作的数据范围, 某些场景需要在权限范围内调高或调低session权限，

对应exec sa_session.set_label(policy_name, label)  （  **不支持**  ）， label参数用于设定当前session使用的label, 此处取值不能超出设定的最高和最低label范围 。

  


对用户设置策略标签，若标签max_read, max_write, min_write, def_label, row_label 其中有不在标签系统表中存在的，会自动生成对应的标签，标签类型为 USER LABEL， 标签值从序列YLS$LAB_SEQUENCE 获取，标签Tag值从序列YLS$TAG_SEQUENCE 中获取。

用户设置策略标签后，该用户需要重新连接才能加载对应的策略标签信息。

若数据库重启时，用户上挂载的标签不存在，会自动生成标签。

  


**sql缓存处理**

由于在执行sql时，lbac起作用是在exec阶段，因此在取消用户关联策略后，原有执行过的sql缓存不需要额外处理。

## 2.8 删除用户关联的策略

通过存储过程SA_USER_ADMIN.DROP_USER_ACCESS删除用户关联的策略。

语法

```
SA_USER_ADMIN.DROP_USER_ACCESS (
  policy_name IN VARCHAR,
  user_name IN VARCHAR);
```

参数说明

|参数|描述|
|---|---|
|policy_name|策略名|
|user_name|用户名|


## 2.9 函数

### 2.9.1 LABEL_TO_CHAR

函数，返回标签值对应的标签内容。

语法

```
FUNCTION LABEL_TO_CHAR (
  label IN NUMBER)
RETURN VARCHAR;
```

### 2.9.2   CHAR_TO_LABEL

函数，返回标签内容对应的标签值。

语法

```
FUNCTION CHAR_TO_LABEL (
  policy_name IN VARCHAR,
  label_string IN VARCHAR)
RETURN NUMBER;
```

### 2.9.3 LBAC  $SA_LABELS.FROM_LABEL

函数，根据level, compartment, group 的值组成的字符串返回level, compartment, group的内容组成的字符串。

语法

```
FUNCTION LBAC$SA_LABELS.FROM_LABEL(
  label_value_string IN VARCHAR)
RETURN VARCHAR;
```

说明：在查看用户关联的策略视图dba_sa_user_labels 会用到（根据  “0020.%0030%0040%. ”这样的内容，转化为对应的标签内容“level:comp,...:group,...”  ）。

## 2.10 YLS相关表

### 2.10.1 YLS$PROPS

存储lbac开关状态。

**表结构**

|列名|类型|是否可为空|描述|
|---|---|---|---|
|NAME|VARCHAR(64)|NOT NULL|名称|
|VALUE$|VARCHAR(4000)|YES|值|
|COMMENT$|VARCHAR(4000)|YES|备注说明|


**表定义**

```
CREATE TABLE YLS$PROPS
(
    NAME                VARCHAR(64)     NOT NULL,
    VALUE$              VARCHAR(4000),
    COMMENT$            VARCHAR(4000)
)
```

  


### 2.10.2 YLS$POL

存储安全策略信息。

**表结构**

|列名|类型|是否可为空|描述|
|---|---|---|---|
|POL#|BINARY_BIGINT|NOT NULL|策略ID|
|POL_NAME|VARCHAR(64)|NOT NULL|策略名|
|COLUMN_NAME|VARCHAR(64)|NOT NULL|应用到表上的标签列名|
|PACKAGE|VARCHAR(64)|NOT NULL|内容为：LBAC$SA， 作用？|
|POL_ROLE|VARCHAR(64)|NOT NULL|格式：策略名_DBA   **（不支持）**|
|OPTIONS|BINARY_SMALLINT|YES|控制类型选项|
|FLAGS|BINARY_TINYINT|NOT NULL|1：enable (默认值), 2:disable|
|VERSION|BINARY_BIGINT|NOT NULL|版本号，更改策略时，version值会加1|


  


**说明**

POL# 策略ID，不同于Oracle，这个ID是从全局OBJID中获取，不会重复使用。

  


**表定义**

```
CREATE TABLE YLS$POL
(
    POL#             BINARY_BIGINT      NOT NULL,
    POL_NAME         VARCHAR(64)        NOT NULL,
    COLUMN_NAME      VARCHAR(64)        NOT NULL,
    PACKAGE          VARCHAR(64)        NOT NULL,
    POL_ROLE         VARCHAR(64)        NOT NULL,
    OPTIONS          BINARY_SMALLINT,
    FLAGS            BINARY_TINYINT     NOT NULL,
    constraint I_YLS$POL_PK PRIMARY KEY(POL#)
)
/

CREATE UNIQUE INDEX I_YLS$POL2 ON YLS$POL(POL_NAME)
/
CREATE UNIQUE INDEX I_YLS$POL3 ON YLS$POL(COLUMN_NAME)
/
CREATE INDEX I_YLS$POL4 ON YLS$POL(POL#, FLAGS, COLUMN_NAME)
/
```

### 2.10.3 YLS$LEVELS

存储安全策略的等级信息。

**表结构**

|列名|类型|是否为空|描述|
|---|---|---|---|
|POL#|BINARY_BIGINT|NOT NULL|策略ID|
|LEVEL#|BINARY_SMALLINT|NOT NULL|等级值，范围[0, 9999]|
|CODE|VARCHAR(64)|NOT NULL|短名称|
|NAME|VARCHAR(64)|NOT NULL|长名称|


**说明**

  


**表定义**

```
CREATE TABLE YLS$LEVELS
(
    POL#            BINARY_BIGINT       NOT NULL,
    LEVEL#          BINARY_SMALLINT     NOT NULL,
    CODE            VARCHAR(64)         NOT NULL,
    NAME            VARCHAR(64)         NOT NULL,
    CONSTRAINT YLS_LEVEL_RANGE CHECK (level# BETWEEN 0 AND 9999)
)
/

CREATE UNIQUE INDEX I_YLS$LEVELS1 ON YLS$LEVELS(POL#, LEVEL#)
/
CREATE UNIQUE INDEX I_YLS$LEVELS2 ON YLS$LEVELS(POL#, CODE)
/
CREATE UNIQUE INDEX I_YLS$LEVELS3 ON YLS$LEVELS(POL#, NAME)
/
ALTER TABLE YLS$LEVELS ADD CONSTRAINT FK_YLS$LEVELS1 FOREIGN KEY(POL#) REFERENCES YLS$POL (POL#) ON DELETE CASCADE
/
```

### 2.10.4 YLS$COMPARTMENTS

存储安全策略的范围信息

**表结构**

|列名|类型|是否为空|描述|
|---|---|---|---|
|POL#|BINARY_BIGINT|NOT NULL|策略ID|
|COMP#|BINARY_SMALLINT|NOT NULL|范围值，范围[0, 9999]|
|CODE|VARCHAR(64)|NOT NULL|短名称|
|NAME|VARCHAR(64)|NOT NULL|长名称|


**说明**

  


**表定义**

```
CREATE TABLE YLS$COMPARTMENTS
(
    POL#           BINARY_BIGINT        NOT NULL,
    COMP#          BINARY_SMALLINT      NOT NULL,
    CODE           VARCHAR(64)          NOT NULL,
    NAME           VARCHAR(64)          NOT NULL,
    CONSTRAINT YLS_COMP_RANGE CHECK (comp# BETWEEN 0 AND 9999) ENABLE
) 
/

CREATE UNIQUE INDEX I_YLS$COMPS1 ON YLS$COMPARTMENTS(POL#, COMP#)
/
CREATE UNIQUE INDEX I_YLS$COMPS2 ON YLS$COMPARTMENTS(POL#, CODE)
/
CREATE UNIQUE INDEX I_YLS$COMPS3 ON YLS$COMPARTMENTS(POL#, NAME)
/
ALTER TABLE YLS$COMPARTMENTS ADD CONSTRAINT FK_YLS$COMPS1 FOREIGN KEY (POL#) REFERENCES YLS$POL (POL#) ON DELETE CASCADE
/
```

### 2.10.5 YLS$GROUPS   （不支持）

存储安全策略的组信息

**表结构**

|列名|类型|是否为空|描述|
|---|---|---|---|
|POL#|BINARY_BIGINT|NOT NULL|策略ID|
|GROUP#|BINARY_SMALLINT|NOT NULL|组值，范围[0, 9999]|
|CODE|VARCHAR(64)|NOT NULL|短名称|
|NAME|VARCHAR(64)|NOT NULL|长名称|
|PARENT#|BINARY_SMALLINT|YES|组的父级组名称|


**说明**

  


**表定义**

```
CREATE TABLE YLS$GROUPS
(
    POL#           BINARY_BIGINT         NOT NULL,
    GROUP#         BINARY_SMALLINT       NOT NULL,
    CODE           VARCHAR(64)           NOT NULL,
    NAME           VARCHAR(64)           NOT NULL,
    PARENT#        BINARY_SMALLINT,
    CONSTRAINT YLS_GROUP_RANGE  CHECK (GROUP# BETWEEN 0 AND 9999)
) 
/

CREATE UNIQUE INDEX I_YLS$GROUPS1 ON YLS$GROUPS(POL#, GROUP#)
/
CREATE UNIQUE INDEX I_YLS$GROUPS2 ON YLS$GROUPS(POL#, CODE)
/
CREATE UNIQUE INDEX I_YLS$GROUPS3 ON YLS$GROUPS(POL#, NAME)
/
ALTER TABLE YLS$GROUPS ADD CONSTRAINT FK_YLS$GROUPS1 FOREIGN KEY (POL#) REFERENCES YLS$POL (POL#) ON DELETE CASCADE
/
```

### 2.10.6 YLS$LAB

存储标签的信息

|列名|类型|是否为空|描述|
|---|---|---|---|
|TAG#|BINARY_INTEGER|  
|标签序号，递增|
|POL#|BINARY_BIGINT|NOT NULL|策略ID|
|NLABEL|BINARY_BIGINT|NOT NULL|标签值，自动生成的递增，  **自动生成的从1000000000开始？（看到Oracle自动生成的有1000000166）**|
|SLABEL|VARCHAR(4000)|NOT NULL|标签内容|
|ILABEL|VARCHAR(4000)|NOT NULL|标签内容转化为一定格式存储的组件值对应的字符串 |
|FLAGS|BINARY_TINYINT|NOT NULL|默认值3对应USER/DATA LABEL，,2对应USER LABEL|


**说明**

ILABEL 格式：

  


![](https://conf.yasdb.com/download/attachments/153005761/image2024-5-13_15-43-34.png?version=1&modificationDate=1715602688000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

policyId 为策略值对应的字符串，长度20字节，数值不够会补‘0’。

组合标识：长度2字节，包括如下：10 -- 只含有level； 11 -- 含有level, compartment； 12 -- 含有level和group ；13 -- 含有level、compartment和group.

等级制占4个字节。

%compValue%...%表示范围值对应的字符串，前后端都是'%'，多个范围值之间用’%‘隔开，每个占4个字节。若标签中不包含范围，则为空

%groupValue%...%表示组对应的字符串，前后端都是'%'，多个组值之间用’%‘隔开，每个占4个字节。若标签中不包含组，则为空。



**表定义**

```
CREATE TABLE YLS$LAB
(
    TAG#          BINARY_BIGINT,
    POL#          BINARY_BIGINT          NOT NULL,
    NLABEL        BINARY_BIGINT          NOT NULL,
    SLABEL        VARCHAR(4000)          NOT NULL,
    ILABEL        VARCHAR(4000)          NOT NULL,
    FLAGS         BINARY_TINYINT         NOT NULL
) 
/

CREATE INDEX I_YLS$LAB1 ON YLS$LAB (TAG#)
/
CREATE UNIQUE INDEX I_YLS$LAB2 ON YLS$LAB(NLABEL)
/
CREATE INDEX I_YLS$LAB3 ON YLS$LAB(POL#, ILABEL)
/
ALTER TABLE YLS$LAB ADD CONSTRAINT FK_YLS$LAB1 FOREIGN KEY (POL#) REFERENCES YLS$POL (POL#) ON DELETE CASCADE
/
```

### 2.10.7 YLS$POLT

存储表关联的策略信息

|列名|类型|是否为空|描述|
|---|---|---|---|
|POL#|BINARY_BIGINT|NOT NULL|策略ID|
|TBL_NAME|VARCHAR(64)|NOT NULL|表名|
|OWNER|VARCHAR(64)|NOT NULL|执行创建操作的用户名|
|PREDICATE|VARCHAR(256)|YES|**（不支持）**|
|FUNCTION|VARCHAR(1024)|YES|**（不支持）**|
|OPTIONS|BINARY_SMALLINT|YES|控制类型选项|
|FLAGS|BINARY_TINYINT|YES|1：enable (默认值), 2:disable|


**说明**

  


**表定义**

```
CREATE TABLE YLS$POLT
(
    POL#          BINARY_BIGINT          NOT NULL,
    TABLE#        BINARY_BIGINT          NOT NULL,
    OWNER         VARCHAR(64)            NOT NULL,
    PREDICATE     VARCHAR(256),
    FUNCTION      VARCHAR(1024),
    OPTIONS       BINARY_SMALLINT,
    FLAGS         BINARY_TINYINT
) 
/

CREATE UNIQUE INDEX I_YLS$POLT1 ON YLS$POLT(POL#, TABLE#)
/
CREATE INDEX I_YLS$POLT2 ON YLS$POLT(TABLE#)
/
ALTER TABLE YLS$POLT ADD FOREIGN KEY (POL#) REFERENCES YLS$POL (POL#) ON DELETE CASCADE
/
```

### 2.10.8 YLS$USER_LABELS

存储用户关联的策略信息

**表结构**

|列名|类型|是否为空|描述|
|---|---|---|---|
|POL#|BINARY_BIGINT|NOT NULL|策略ID|
|USER#|BINARY_INTEGER|NOT NULL|用户ID|
|MAX_READ|VARCHAR(4000)|YES|最大读标签|
|MAX_WRITE|VARCHAR(4000)|YES|最大写标签|
|MIN_WRITE|VARCHAR(4000)|YES|最小写标签，只含有等级|
|DEF_READ|VARCHAR(4000)|YES|默认读标签|
|DEF_WRITE|VARCHAR(4000)|YES|默认写标签|
|DEF_ROW|VARCHAR(4000)|YES|默认行标签|
|PRIVS|BINARY_SMALLINT|YES|特权项集合  **（不支持）**|


  


**说明**

max_read, max_write, min_write，def_read, def_write, def_row 格式同上面的ilabel格式              (这个格式 是label被删除后还可以显示对应的标签内容)。

**表定义**

```
CREATE TABLE YLS$USER_LABELS
(
    POL#                BINARY_BIGINT    NOT NULL,
    USER_NAME           VARCHAR(64)      NOT NULL,
    MAX_READ            VARCHAR(4000),
    MAX_WRITE           VARCHAR(4000),
    MIN_WRITE           VARCHAR(4000),
    DEF_READ            VARCHAR(4000),
    DEF_WRITE           VARCHAR(4000),
    DEF_ROW             VARCHAR(4000),
    PRIVS               BINARY_SMALLINT
 ) SYSTEM 234 ORGANIZATION HEAP
/

CREATE UNIQUE INDEX I_YLS$USER1 ON YLS$USER_LABELS(POL#, USER_NAME)
/
CREATE INDEX I_YLS$USER2 ON YLS$USER_LABELS(USER_NAME)
/
ALTER TABLE YLS$USER_LABELS ADD CONSTRAINT FK_YLS$USER1 FOREIGN KEY(POL#) REFERENCES YLS$POL (POL#) ON DELETE CASCADE
/
```

  


  


YLS特权项  **(不支持)**

|特权项|描述|
|---|---|
|READ|  
|
|FULL|  
|
|COMPACCESS|  
|
|PROFILE_ACCESS|  
|
|WRITEUP|  
|
|WRITEDOWN|  
|
|WRITEACROSS|  
|


## 2.11 YLS序列

### 2.11.1 YLS$LAB_SEQUENCE

YLS$LAB_SEQUENCE定义

```
CREATE SEQUENCE SYS.YLS$LAB_SEQUENCE
    INCREMENT BY 1
    START WITH 1000000000
    MINVALUE 1000000000
    MAXVALUE 4000000000
    NOCYCLE
    CACHE 20
/
```

用途：自动生成标签时（场景为：用户关联策略时，挂载的标签若不存在则会自动生成标签），获取标签值。

  


### 2.11.2 YLS$TAG_SEQUENCE

```
CREATE SEQUENCE SYS.YLS$TAG_SEQUENCE
    INCREMENT BY 1
    START WITH 1
    MINVALUE 1
    MAXVALUE 4000000000
    NOCYCLE
    CACHE 20
/
```

用途：创建标签时，给定标签的一个编号，该标号可以识别是否对该标签进行了修改。

  


## 2.12 YLS 相关视图

查看开关状态                                select * from dba_yls_status;

查看创建的policy:                         select * from dba_sa_policies;

查看创建的level:                           select * from dba_sa_levels;

查看创建的compartments:           select * from dba_sa_compartments;

查看创建的groups:                       select * from dba_sa_groups;                                                **--**  **不支持**

查看创建的labels:                         select * from dba_sa_labels;

查看table上的policy:                    select * from dba_sa_table_policies;

查看用户的label:                          select * from dba_sa_user_labels;

查看当前session label:                 select sa_session.label('policy_name') from dual;                 **--不支持**

查看当前row label:                       select sa_session.row_label('policy_name') from dual;        ** --不支持**

## 2.13 锁

对表设置策略，则使用表上的Spinlock 进行并发控制 + 对 lbac shareLock。

对用户设置策略，则使用  dcLatchUserByName + 对 lbac shareLock。

# 3 接口

  


# 4 功能限制

（1）只支持上面所列出的具体功能，LBAC对照Oracle 功能，没列出来的均不支持，如group组件，对用户赋特权等。

（2）一个表只允许关联1个安全策略。

  


# 5 详细设计

(1) 有label存在，不能删除有关的level, compartment    
  (2) 策略可以直接删除，即使策略关联了表，用户等。删除策略后，策略关联的东西都被删除(level, compartment, 用户关联的策略信息，表关联的策略信息)    
  ~~(3) label 可以直接删除，即使策略关联了表，用户等。删除label后，不影响 dba_sa_user_labels 查看，但是影响用户查看表数据和插入数据（并不是一定影响，如何判断的？）~~

~~(4) 插入数据操作时，若对应的标签列的值在标签hash桶中不存在，会自动创建标签（类型USER LABEL）~~  。

(5) 用户对应的行标签不存在，则该用户登录会报错（ORA-12414: 内部 LBAC 错误: invalid internal label）。

~~(6) 用户登录时，若max_read, max_write, min_write, def_read, def_write 对应的标签不存在则会创建对应的标签。~~

  


## 5.1 控制类型 

```
typedef enum EnLbacControlType {
    LBAC_NO_CONTROL      = 0,
    LBAC_READ_CONTROL    = 1,
    LBAC_INSERT_CONTROL  = 2,
    LBAC_UPDATE_CONTROL  = 4,
    LBAC_DELETE_CONTROL  = 8,
    LBAC_WRITE_CONTROL   = 14,
    LBAC_LABEL_DEFAULT   = 16,
    LBAC_LABEL_UPDATE    = 32,
    LBAC_CHECK_CONTROL   = 64,
    LBAC_ALL_CONTROL     = 127,
    LBAC_HIDE            = 128,
    LBAC_INVERSE_GROUP   = 256,
} LbacControlType;
```

  


## 5.2 开关

**语句示例**

```
EXEC YLS_ENFORCEMENT.ENABLE_YLS;
EXEC YLS_ENFORCEMENT.DISABLE_YLS;
```

**系统表**

YLS$PROPS

**缓存**

DictManger->lbacMngr->status 对应yls开关状态

**操作图示**

![](https://conf.yasdb.com/download/attachments/135604510/image2023-11-16_11-32-10.png?version=1&modificationDate=1700105244000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

  


  


## 5.3 策略

**语句示例**

```
EXEC SA_SYSDBA.CREATE_POLICY ('p1', 'p1_column', 'read_control, write_control, label_default, hide');
EXEC SA_SYSDBA.DROP_POLICY('p1', true);
```

创建策略时会生成DictEntry.

**结构体设计**

```
新增 
typedef struct StLbacPlyEntry {
    CodUint16   options;           //控制项
    CodUint8    flag;              //状态
    CodChar     reserved[5];
    CodChar     column[64];        //列名
} LbacPlyEntry;

添加到下面结构体中
typedef struct StDictEntry {
  ...
  union {
      ...
      LbacPlyEntry lbacPly;
      ...
  };
} DictEntry;
```

**创建策略图示**

![](https://conf.yasdb.com/download/attachments/135604510/image2023-11-16_14-48-52.png?version=1&modificationDate=1700117045000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

**删除策略**

需要检查用户及表关联的策略信息，若存在则需要将用户上挂载的策略信息删除，若表关联了策略，需要对表加x锁，使表的dc失效。若需要删除策略列，需要删除表的策略列。

策略的entry 删除。

注意：删除策略操作，在异常情况下，可能出现不满足事务的情况。比如有个表被锁时，删除策略时，需要删除该表的策略列，会执行到此会报错中断返回，这样存在一些表的策略列被删除，一些没被删除的情况。

![](https://conf.yasdb.com/download/attachments/135604510/image2023-11-16_15-4-4.png?version=1&modificationDate=1700117957000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

## 5.4 标签内容

标签对应的缓存信息放在hash桶 DictManager→lbacMngr→hashBucketLabel中。

  


**语句示例**

```
EXEC SA_LABEL_ADMIN.CREATE_LABEL ('p1', 1001, 'GENERAL');
EXEC SA_LABEL_ADMIN.CREATE_LABEL ('p1', 1002, 'SENS:RD');
EXEC SA_LABEL_ADMIN.CREATE_LABEL ('p1', 1003, 'SENS:RD,TEST');
EXEC SA_LABEL_ADMIN.CREATE_LABEL ('p1', 1009, 'SECRET:MNG,RD');
//删除
EXEC SA_LABEL_ADMIN.DROP_LABEL(policy_name=>'p1',label_tag=>1001);
EXEC SA_LABEL_ADMIN.DROP_LABEL(policy_name=>'p1',label_tag=>1002);
EXEC SA_LABEL_ADMIN.DROP_LABEL(policy_name=>'p1',label_tag=>1003);
EXEC SA_LABEL_ADMIN.DROP_LABEL(policy_name=>'p1',label_tag=>1009);
```

  


**结构体设计**

```
单个标签对应的结构体信息
typedef Struct StLbacLabel {
    CodUint64        labelTag;
    CodUint64        plyId;
    CodUint8         flag;
    CodChar          reserved[7];
    MemoryContext*   mctx;
    LbacLabelCtx     labelCtx;
} LbacLabel;
 
LbacLabelCtx 对应的结构体信息
 
typedef struct StLbacLabelCtx {
    CodUint16     level;
    CodUint16     compsCount
    CodUint16     groupsCount;
    CodUint16     compsMaxCount
    CodUint16     groupsMaxCount
    CodUint16*    comps;
    CodUint16*    groups;
} LbacLabelCtx;
```

![](https://pingcode.yasdb.com/atlas/files/public/67396d478970c2af4f5211c4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

**说明**

创建hash桶使用的memoryContext 来自   mctxCreate(&handler->kernel->dictm.pool, &mctx)。

为hash桶中每个标签申请的内存来自   mctxCreate(&handler->kernel->dictm.pool, &mctx)，对应hashBucketLabel中 LbacLabel->mctx

**创建label操作图示**

  


![](https://conf.yasdb.com/download/attachments/135604510/image2023-11-16_11-45-42.png?version=1&modificationDate=1700106055000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

## 5.5 表上关联的策略信息

**语句示例**

```
EXEC SA_POLICY_ADMIN.APPLY_TABLE_POLICY ( 'p1', 'regress', 'staff_info', 'label_default, hide, insert_control, update_control, read_control');
//删除
EXEC SA_POLICY_ADMIN.REMOVE_TABLE_POLICY('p1', 'regress', 'staff_info');
```

**结构体设计**

```
typedef struct StTableDict {
    ...
    LbacTable    lbacTable;
} TableDict;
 
LbacTable 结构体定义：
 
typedef struct StLbacTable {
    CodBool       hasEnablePly;   //plys中没有有效的策略则为False
    CodChar       reserved[7];
    List*         tablePlys;  //LbacTablePly , 创建list使用表上的mctx
} LbacTable;
 
LbacTablePly 结构体信息定义：
 
typedef struct StLbacTablePly {
    CodUint64    plyId;
    CodUint16    options;
    CodUint8     flag;
    CodBool      used;       //标志，表上移除策略时，这个值为false, 从而表上再关联策略时可以重用不需要listNew
    CodChar      reserved[4];
}LbacTablePly;
```

  


**表关联策略操作图示**

![](https://pingcode.yasdb.com/atlas/files/public/67396d478970c2af4f5211c5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

说明：

表关联策略时，会添加标签列，这样表的dc会失效，下次再次使用这个表时会重新加载dc。

在dcLoadTableDict时，扫描系统表YLS$POLT，生成LabcTablePly信息添加到  TableDict->lbacTable→tablePlys。

![](https://conf.yasdb.com/download/attachments/135604510/image2023-11-15_21-14-21.png?version=1&modificationDate=1700053775000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

  


**表移除策略时缓存处理**

若需要删除标签列，则dc会失效，下次使用表时，重新加载dc。

若不需要删除标签列时，需要对表 加 lockTableDirectly 使表dc失效。

  


**在verify阶段设置标签列对应的列id值**

verifyKernelTableLbac 函数设置在TableDesc 设置lbacColId

  


**约束**

一个表只允许关联1个安全策略。

## 5.6 用户上关联的策略信息

**语句示例**

```
EXEC SA_USER_ADMIN.SET_USER_LABELS ('p1', 'user_rd',        'SENS:RD',          'SENS:RD',               'SENS',   'SENS:RD', NULL);
//删除
EXEC SA_USER_ADMIN.DROP_USER_ACCESS('p1', 'user_rd');
```

  


**结构体设计**

```
在 UserDict 新增字段 lbacUser。
 
typedef struct StUserDict {
    ...
    LbacUser    lbacUser;
} UserDict;
 
其中
typedef struct StLbacUser {
    CodBool       hasEnablePly;   //plys中没有有效的策略则为False
    CodChar       reserved[7];
    List*         plys;     //LbacUserPly， 创建list使用 UserDict->mctx
} LbacUser;
 
typedef Struct StLbacUserPly {
    CodUint64        plyId;
    CodUint16        minWrite;
    CodBool          used;     //判断是否被使用：移除策略时为FALSE， 下次再关联其他策略时会判断该值是否为FALSE，为FALSE就重用，避免listNew
    CodChar          reserved[5];
    MemoryContext*   mctx;
    LbacLabelCtx*    maxRread;
    LbacLabelCtx*    maxWrite;
    LbacLabelCtx*    defRead;
    LbacLabelCtx*    defWrite;
    LbacLabelCtx*    defRow;
} LbacUserPly;
```

**系统表**

YLS$LAB – 若用户关联的策略时指定的标签在标签表中没有，需要添加到标签表中。

YLS$USER_LABELS 

**缓存**

UserDict上加载策略信息

userDict上对应的lbacNum++

**操作图示**

![](https://conf.yasdb.com/download/attachments/135604510/image2023-11-16_11-21-38.png?version=1&modificationDate=1700104611000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

![](https://conf.yasdb.com/download/attachments/135596503/image2023-11-15_20-59-34.png?version=1&modificationDate=1700052889000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

  


**用户移除策略缓存处理**

userDict→lbacUser.lbacNum++

将userDict→lbacUser.userPlys中该策略信息清除（used改为false）

  


## 5.7 读判断

![](https://pingcode.yasdb.com/atlas/files/public/67396d47a1ad9a3311dc9036/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

标签列值对应的标签内容 与 用户上挂载的标签信息做比较（def_read 的标签内容）。

满足以下条件才可读该行信息：

（1）标签列对应的标签内容的级别 <= def_read.level；

（2）标签列对应的标签内容的groups 为 def_read.groups的子集；

（3）标签列对应的标签内容的compartments 为 def_read.compartments 的子集；

  


## 5.8 写判断

![](https://pingcode.yasdb.com/atlas/files/public/67396d478970c2af4f5211c6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBZ0NBQUFDQUFBQUFBQUFXQUVBQUFBQUlFQUFBQkFBQkFBQUFBQUFBQUFBQUFFUUFDQ0FBSUFBQUFBQUFBSUFBQUFBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBUUFBQUFBQUFBQUFBQUFBQUVBQUFBQkFBQ0FZQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMzMsImV4cCI6MTc4MjMxNzgzM30.9fqhvwXHuD86CWpTEwUUIu1of-nKBLo_cE92dDVxJmQ)

标签列值对应的标签内容 与 用户上挂载的标签信息做比较（def_write, min_write 的标签内容）。

满足以下条件才可读该行信息：

（1）标签列对应的标签内容的级别 >= min_write.level；且 标签列对应的标签内容的级别 <= def_write.level

（2）标签列对应的标签内容的groups 为 def_write.groups的子集；

（3）标签列对应的标签内容的compartments 为 def_write.compartments 的子集；

  


## 5.9 lbac操作对sql缓存的影响

包括如下场景：

（1）user1已执行sql1,  然后对sql1涉及的tabel1 关联策略，那么需要感知tabel1的变化   =》在对表关联策略时，对表加x锁，使表dc失效

（2）user1已执行sql1,  其中 sql1 中的table1 关联了策略，现在对用户关联策略，那么需要感知 user1的变化 =》由于用户上的策略信息只在exec filter 及 exec insert阶段生效，且 用户上挂载的lbac信息 只有在重新连接时才挂载上，所以即使sql 使用缓存anlcontext，不影响最终结果。

（3）user1已执行sql1,  其中 sql1 中的table1 关联了策略，现在策略状态发生了变化，那么需要感知这个策略状态变化 =》当前不支持更改策略有效状态，如果支持后，可以将策略涉及的所有表做失效处理。

（4）yls 开关状态发生变化 =》 由于在执行select 或insert 语句时，只在exec阶段做lbac 相关处理，所有yls开关状态变化不影响

## 5.10 anlHandler上挂的lbac信息

anlHandler 挂的信息 即userDict→lbacUser上信息，为避免并发问题，

方法1：不使用指针指向 userDict→lbacUser, 使用拷贝的方式在anlHandler上放一份。拷贝时，使用latchShared(UserDict→statusLatch) 并发控制（在对用户关联策略、修改关联策略，删除关联策略时需要使用 latchExclusive(UserDict→statusLatch) ）

方法2：  使用指针指向 userDict→lbacUser, 在执行查询时使用latchShared(UserDict→statusLatch) 并发控制（在对用户关联策略、修改关联策略，删除关联策略时需要使用 latchExclusive(UserDict→statusLatch) ）

：：使用了方法1实现，同oracle一致。

  


# 6 自测用例

```
conn sys/Cod-2022@127.0.0.1:1688

create user regress identified by test;
grant dba to regress;
grant connect to regress;
grant lbac_dba to regress;

conn regress/test@127.0.0.1:1521/orclpdb


1、创建表和用户
--创建表staff_info

drop table regress.staff_info;
create table staff_info (id int not null primary key, name varchar2(64) not null  );

--创建用户
drop USER user_rd  cascade;
drop USER user_test  cascade;
drop USER user_manager  cascade;

CREATE USER user_rd      IDENTIFIED BY  12345678; 
CREATE USER user_test    IDENTIFIED BY  12345678;
CREATE USER user_manager IDENTIFIED BY  12345678;

grant connect to user_rd;
grant connect to user_test;
grant connect to user_manager;

--授权
grant all on regress.staff_info to user_rd;
grant all on regress.staff_info to user_test;
grant all on regress.staff_info to user_manager;


2、在安全员下，打开标签功能
exec yls_enforcement.enable_yls;
--exec yls_enforcement.disable_yls;
--然后重新打开数据库


3、在安全员下，建立策略 P1

CALL CREATE_POLICY ('P1', 'p1_column', '');

-- 加 label_default 会自动填充标签列
CALL SA_SYSDBA.CREATE_POLICY ('P1', 'p1_column', 'label_default, hide');

-- 隐藏列
CALL SA_SYSDBA.CREATE_POLICY ('P1', 'p1_column', 'read_control, write_control, label_default, hide');

conn regress/test@127.0.0.1:1521/orclpdb



--创建等级
CALL SA_COMPONENTS.CREATE_LEVEL ( 'P1', 10, 'GENERAL', 'GENERAL');
CALL SA_COMPONENTS.CREATE_LEVEL ( 'P1', 20, 'SENS', 'SENS');
CALL SA_COMPONENTS.CREATE_LEVEL ( 'P1', 30, 'SECRET', 'SECRET');
--创建范围
CALL SA_COMPONENTS.CREATE_COMPARTMENT ( 'P1', 10, 'MNG', 'MANAGER');
CALL SA_COMPONENTS.CREATE_COMPARTMENT ( 'P1', 20, 'QA', 'QA');
CALL SA_COMPONENTS.CREATE_COMPARTMENT ( 'P1', 30, 'RD', 'RD');
CALL SA_COMPONENTS.CREATE_COMPARTMENT ( 'P1', 40, 'TEST', 'TEST');
--创建数据标签
CALL SA_LABEL_ADMIN.CREATE_LABEL ('P1', 1001, 'GENERAL');
CALL SA_LABEL_ADMIN.CREATE_LABEL ('P1', 1002, 'SENS:RD');
CALL SA_LABEL_ADMIN.CREATE_LABEL ('P1', 1003, 'SENS:RD,TEST');
CALL SA_LABEL_ADMIN.CREATE_LABEL ('P1', 1009, 'SECRET:MNG,RD');


4、在安全员下，把策略应用到表staff_info
CALL SA_POLICY_ADMIN.APPLY_TABLE_POLICY ( 'P1', 'REGRESS', 'STAFF_INFO');

CALL SA_POLICY_ADMIN.APPLY_TABLE_POLICY ( 'P1', 'REGRESS', 'STAFF_INFO', 'label_default, hide, insert_control, update_control, read_control');


5、在sso安全员下，创建用户标签
-- SA_USER_ADMIN.SET_USER_LABELS (
-- policy_name      IN VARCHAR2,
-- user_name        IN VARCHAR2,
-- max_read_label   IN VARCHAR2,
-- max_write_label  IN VARCHAR2 DEFAULT NULL,
-- min_write_label  IN VARCHAR2 DEFAULT NULL,
-- def_label        IN VARCHAR2 DEFAULT NULL,
-- row_label        IN VARCHAR2 DEFAULT NULL);
CALL SA_USER_ADMIN.SET_USER_LABELS ('P1', 'user_rd',        'SENS:RD',          'SENS:RD',               'SENS',   'SENS:RD', NULL);
CALL SA_USER_ADMIN.SET_USER_LABELS ('P1', 'user_test',      'SENS:RD,TEST',     'SENS:RD,TEST',          'SENS',   'SENS:RD,TEST', NULL);
CALL SA_USER_ADMIN.SET_USER_LABELS ('P1', 'user_manager',   'SECRET:MNG,RD,TEST',    'SECRET:MNG,RD',    'SECRET', 'SECRET:MNG,RD,TEST', NULL);
    
6、至此安全员设置全部完成，下面使用具体用户登录验证权限是否被控制：

6.1 以用户 user_test 登录，进行插入操作：
conn  user_test/12345678@127.0.0.1:1521/orclpdb
insert into regress.staff_info(id, name) values(3,'TEST');

查询表中的数据及敏感标记，应能提示插入该条数据的敏感标记为 1003：
select p1_column, id, name from regress.staff_info;

6.2 以用户 user_rd 登录，进行插入操作：
conn  user_rd/12345678@127.0.0.1:1521/orclpdb
insert into regress.staff_info(id, name) values(2,'RD');

查询表中的数据及敏感标记，应能提示插入该条数据的敏感标记为 1002：
select p1_column, id, name from regress.staff_info;
用户 user_rd 无法看到id=3的记录


6.3 以用户 user_manager 登录，进行插入操作：
conn  user_manager/12345678@127.0.0.1:1521/orclpdb
insert into regress.staff_info(id, name) values(9,'manager');

查询表中的数据及敏感标记，应能提示插入该条数据的敏感标记为 1009：用户user_manager可以看到所有记录。
select p1_column, id, name from regress.staff_info;
```

  


# 7 资料

  [LBAC - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?spaceKey=YAS&title=LBAC)  

  [LBAC详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119538749)  

  [强制访问控制LBAC概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109582969)  

  [Oracle Label Security Administrator's Guide, 21c](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/index.html#Oracle%C2%AE-Label-Security)  

# 8 工作量

  


# 9 遗留

  


  


  


  


  


  


  


  


  


  


  


  


  


  


  


  


  


## Attachments:

[image2023-10-31_20-54-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDZhMWFkOWEzMzExZGM5MDJmIiwicmVmX2lkIjoiNjczOTZkNDY1OTNmOTljOWZmMjM3OTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDMzLCJleHAiOjE3ODIzOTM0MzN9.KKShaDKsQs6mtLoRRrewMEbggWlsQV2Oj61ZgApge6s)

 (image/png)    


[image2023-11-16_20-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDY4OTcwYzJhZjRmNTIxMWJmIiwicmVmX2lkIjoiNjczOTZkNDY1OTNmOTljOWZmMjM3OTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDMzLCJleHAiOjE3ODIzOTM0MzN9.abEVI4Lykf-WL5PJBq4OK68mSJHXG58R5liqkDdIzNc)

 (image/png)    


[image2023-11-16_21-32-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDc4OTcwYzJhZjRmNTIxMWMyIiwicmVmX2lkIjoiNjczOTZkNDY1OTNmOTljOWZmMjM3OTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDMzLCJleHAiOjE3ODIzOTM0MzN9.yZQGNTdObbZQvkkyUWkTXKARYgAch6dwGmAYsMQxMkQ)

 (image/png)    


## Comments:

|  [](null)  ,2023.11.21 评审,问题：,（1）表很大，比如100W行，用户拥有查看所有数据的权力。在查询一半时，给用户关联策略，缩小用户查看数据的权限，看用户最后是否可以查看全部数据？概括为：对用户关联策略，是否可以对正在执行的sql查询造成影响， 看Oracle现象,（2）多个策略并发关联表，都会向表添加标签列，添加列过程中，是否需要额外再对表加锁控制并发？,（3）对表和用户关联策略时，在集群模式下，都对策略entry→status 进行了状态设置，防止在使用过程中策略被修改、删除，问题：由于已经对策略objid加了集群RW锁，在集群模式下是否还需要设置策略的entry状态来控制并发？,（4）个别描述或图中内容存在问题：policyId 应该为 policyObjId,  (5)  创建策略在集群模式下是否需要对策略的objId 加集群RW锁？,Posted by wanglin at 十一月 21, 2023 17:17|
|---|
