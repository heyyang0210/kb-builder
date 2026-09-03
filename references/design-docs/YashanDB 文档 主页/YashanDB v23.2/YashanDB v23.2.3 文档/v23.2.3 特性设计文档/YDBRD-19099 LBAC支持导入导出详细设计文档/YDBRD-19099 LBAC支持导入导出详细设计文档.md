Created by 袁昊坤, last modified on 六月 03, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/661155b5579a3edb84d68864](https://pingcode.yasdb.com/pjm/items/661155b5579a3edb84d68864)    *?*    
  *#YDBRD-19099 支持LBAC策略的导入导出能力*

##   [1. 总述](#1-总述)  

EXP/IMP支持LBAC策略。

交付形态：单机。

###   [1.1 需求来源](#11-需求来源)  

master将支持LBAC策略和标签能力，需同步支持EXP/IMP。

###   [1.2 调研文档](#12-调研文档)  

_    [https://conf.yasdb.com/pages/viewpage.action?pageId=133593853 ](https://conf.yasdb.com/pages/viewpage.action?pageId=133593853%C2%A0)      -- LBAC 调研

###   [1.3 需求分析](#13-需求分析)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|EXP|导出|支持将指定lbac数据进行导出|是|是|
|IMP|导入|支持将指定lbac数据导入|是|是|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|exportLbac||导出lbac|是|
|exportLbacSwitch||导出lbac开关|是|
|exportLbacPolicies||导出lbac策略|是|
|exportLbacLevels||导出lbac等级|是|
|exportLbacCompartments||导出lbac范围|是|
|exportLbacLabels||导出lbac标签|是|
|exportLbacTablePolicy||导出lbac策略应用到表|是|
|exportLbacUserLabels||导出lbac设置用户标签|是|
|exportCloseLbacSwitch||还原lbac开关|是|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

lbac仅在全库模式，进行导入导出。

FULL模式用于导出整库的数据，包括：

用户元数据用户下的所有对象元数据用户下的表数据所有的系统权限所有的对象权限所有的角色所有的审计策略/使能所有的OUTLINE所有的PROFILE所有的SQLMAP所有的定时任务执行本模式导出的数据库用户必须拥有DBA角色权限。其中，Value值的含义为：

Y：导出所有用户下的数据。N：导出登录用户下的数据。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

lbac设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=135606670](https://conf.yasdb.com/pages/viewpage.action?pageId=135606670)  

在exp_imol.c的exportFull中添加exportLbac导出函数。

####   [4.1.1查询涉及lbac的系统表，根据相关语法，拼接出创建该策略所有相关信息的sql语句。](#411查询涉及lbac的系统表根据相关语法拼接出创建该策略所有相关信息的sql语句)  

本需求只支持导入导出以下六种SQL创建等语句，对于删除策略等语句不做处理，支持语句如下：

#####   [创建策略的语句：](#创建策略的语句)  

涉及视图：DBA_SA_POLICIES。

|字段|类型|说明|
|---|---|---|
|POLICY_NAME|VARCHAR(64)|策略名称|
|COLUMN_NAME|VARCHAR(64)|标签列名称，受策略保护的表会增加此名称的列|
|STATUS|VARCHAR(8)|状态类型<br>*   ENABLE<br>*   DISABLE|
|POLICY_OPTIONS|VARCHAR(256)|策略控制项|
|POLICY_SUBSCRIBED|VARCHAR(5)|不支持，恒为FALSE|


涉及语法：

```
SA_SYSDBA.CREATE_POLICY (
  policy_name IN VARCHAR,
  column_name IN VARCHAR DEFAULT NULL,
  default_options IN VARCHAR DEFAULT NULL);

```

#####   [创建等级的语句：](#创建等级的语句)  

涉及视图：DBA_SA_LEVELS

|字段|类型|说明|
|---|---|---|
|POLICY_NAME|VARCHAR(64)|策略名称|
|LEVEL_NUM|SMALLINT|等级值|
|SHORT_NAME|VARCHAR(64)|短名称|
|LONG_NAME|VARCHAR(64)|长名称|


涉及语法：

```
SA_COMPONENTS.CREATE_LEVEL (
  policy_name IN VARCHAR,
  level_num IN INTEGER,
  short_name IN VARCHAR,
  long_name IN VARCHAR);

```

#####   [创建范围的语句：](#创建范围的语句)  

涉及视图：DBA_SA_COMPARTMENTS

|字段|类型|说明|
|---|---|---|
|POLICY_NAME|VARCHAR(64)|策略名称|
|COMP_NUM|SMALLINT|范围值|
|SHORT_NAME|VARCHAR(64)|短名称|
|LONG_NAME|VARCHAR(64)|长名称|


涉及语法：

```
SA_COMPONENTS.CREATE_COMPARTMENT (
  policy_name IN VARCHAR,
  comp_num IN INTEGER,
  short_name IN VARCHAR,
  long_name IN VARCHAR);

```

#####   [创建标签的语句：](#创建标签的语句)  

涉及视图：DBA_SA_LABELS

|字段|类型|说明|
|---|---|---|
|POLICY_NAME|VARCHAR(64)|策略名称|
|LABEL|VARCHAR(4000)|标签内容|
|LABEL_TAG|BIGINT|标签值|
|LABEL_TYPE|VARCHAR(15)|标签类型<br>*   USER LABEL<br>*   USER/DATA LABEL|


涉及语法：

```
SA_LABEL_ADMIN.CREATE_LABEL (
  policy_name IN VARCHAR,
  label_tag IN BINARY_INTEGER,
  label_value IN VARCHAR,
  data_label IN BOOLEAN DEFAULT TRUE);

```

当LABEL_TYPE值为 USER LABEL时，data_label值为FALSE，当LABEL_TYPE值为USER/DATA LABEL时，data_label值为TRUE。

#####   [将策略作用到表上的语句：](#将策略作用到表上的语句)  

涉及视图：DBA_SA_TABLE_POLICIES

|字段|类型|说明|
|---|---|---|
|POLICY_NAME|VARCHAR(64)|策略名称|
|SCHEMA_NAME|VARCHAR(64)|用户名|
|TABLE_NAME|VARCHAR(64)|表名|
|STATUS|VARCHAR(8)|状态类型<br>*   ENABLE<br>*   DISABLE|
|TABLE_OPTIONS|VARCHAR(4000)|应用到表上的策略控制项|
|FUNCTION|VARCHAR(1024)|不支持，恒为NULL|
|PREDICATE|VARCHAR(256)|不支持，恒为NULL|


涉及语法：

```
SA_POLICY_ADMIN.APPLY_TABLE_POLICY (
  policy_name IN VARCHAR,
  schema_name IN VARCHAR,
  table_name IN VARCHAR,
  table_options IN VARCHAR DEFAULT NULL,
  label_function IN VARCHAR DEFAULT NULL,
  predicate IN VARCHAR DEFAULT NULL);

```

#####   [设置用户标签的语句：](#设置用户标签的语句)  

涉及视图：DBA_SA_USER_LABELS

|字段|类型|说明|
|---|---|---|
|USER_NAME|VARCHAR(64)|用户名称|
|POLICY_NAME|VARCHAR(64)|策略名称|
|MAX_READ_LABEL|VARCHAR(4000)|最大读标签内容|
|MAX_WRITE_LABEL|VARCHAR(4000)|最大写标签内容|
|MIN_WRITE_LABEL|VARCHAR(4000)|最小写标签内容|
|DEFAULT_READ_LABEL|VARCHAR(4000)|默认读标签内容|
|DEFAULT_WRITE_LABEL|VARCHAR(4000)|默认写标签内容|
|DEFAULT_ROW_LABEL|VARCHAR(4000)|默认行标签内容|


涉及语法：

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

####   [4.1.2 对拼接好的sql语句进行导入导出。](#412-对拼接好的sql语句进行导入导出)  

lbac仅在全库模式，进行导入导出。可参考审计导入导出：    [https://conf.yasdb.com/pages/viewpage.action?pageId=89094607](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607)  

添加case LBAC分支，同审计导出，走importPolicy流程。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```
conn sys/Cod-2022@127.0.0.1:1688
 
create user regress identified by regress;
grant dba to regress;
grant connect to regress;
grant lbac_dba to regress;

conn regress/regress@127.0.0.1:1688

--1、创建表和用户
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
grant all privileges on regress.staff_info to user_rd;
grant all privileges on regress.staff_info to user_test;
grant all privileges on regress.staff_info to user_manager;

--2、在安全员(sys用户和带有dba+lbac_dba角色权限的用户)下，打开标签功能 ,
conn sys/Cod-2022@127.0.0.1:1688

exec yls_enforcement.enable_yls;
--exec yls_enforcement.disable_yls;
--然后重新打开数据库
 
 
--3、在安全员下，建立策略 P1
 
CALL SA_SYSDBA.CREATE_POLICY ('P1', 'P1_column', 'READ_CONTROL,WRITE_CONTROL');
 
-- 加 label_default 会自动填充标签列
CALL SA_SYSDBA.CREATE_POLICY ('P1', 'p1_column', 'label_default, hide');
 
-- 隐藏列
CALL SA_SYSDBA.CREATE_POLICY ('P1', 'p1_column', 'read_control, write_control, label_default, hide');
 
conn regress/regress@127.0.0.1:1688

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
 
 
--4、在安全员下，把策略应用到表staff_info
CALL SA_POLICY_ADMIN.APPLY_TABLE_POLICY ( 'P1', 'REGRESS', 'STAFF_INFO');
  
 
--5、在sso安全员下，创建用户标签
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

SELECT POLICY_NAME,COLUMN_NAME,STATUS,POLICY_OPTIONS,POLICY_SUBSCRIBED FROM DBA_SA_POLICIES;
SELECT POLICY_NAME,LEVEL_NUM,SHORT_NAME,LONG_NAME FROM DBA_SA_LEVELS;
SELECT * FROM DBA_SA_COMPARTMENTS;
SELECT * FROM DBA_SA_LABELS;
SELECT * FROM DBA_SA_TABLE_POLICIES;
SELECT * FROM DBA_SA_USER_LABELS;

--导出
./exp sys/Cod-2022 file=a  full=y

例如：./exp sys/Cod-2022@127.0.0.1:1688 full=y file=/mnt/c/Users/yuanhaokun/Desktop/test.txt

--导入
./imp sys/Cod-2022 file=a  full=y

例如：./imp sys/Cod-2022@127.0.0.1:1688 full=Y FILE=/mnt/c/Users/yuanhaokun/Desktop/test.txt


```

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。