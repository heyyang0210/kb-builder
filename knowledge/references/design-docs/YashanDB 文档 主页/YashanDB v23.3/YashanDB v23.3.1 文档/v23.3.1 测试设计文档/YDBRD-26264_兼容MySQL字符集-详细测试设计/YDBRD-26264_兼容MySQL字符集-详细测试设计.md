Created by 孟麟, last modified on 七月 04, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/661911fefd997db58ad8901b](https://pingcode.yasdb.com/pjm/items/661911fefd997db58ad8901b)    ?    
  #YDBRD-26264 兼容MySQL字符集

描述：  支持latin1、utf8mb4字符集

## 1.1相关文档

开发文档：    [特性设计-YDBRD-26264：兼容MySQL字符集](153016058.html)  

测试调研：    [YASHAN-927_测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=153020791)  

# 2. 需求分析

## 2.1 功能点分析

本需求实现mysql兼容模式下，将mysql字符集映射到yashan字符集，latin1映射iso88591、utfmb4映射utf8

**1、字符集映射**

（1）服务端字符集：当前崖山只支持在创建数据库时指定字符集，后续无法修改，mysql支持create schema、create table指定字符集（包括alter），有其他需求实现在mysql模式下进行上述ddl语法兼容；

（2）客户端字符集：客户端需求实现（mysql客户端）

（3）映射iso88591和utf8，  **不映射的GBK、ASCII、GB18030，mysql模式和yashan模式一致**

综上，本需求只考虑映射功能，在mysql模式下，查询字符集iso88591显示latin1，utf8显示utfmb4，  **yashan本身的show parameter char命令和V$SYSTEM_PARAMETER不变**

SQL> show parameter char;

name value    
  ---------------------------------------------------------------- ----------------------------------------------------------------    
  CHARACTER_SET UTF8    
  NATIONAL_CHARACTER_SET UTF16    
  NLS_NUMERIC_CHARACTERS .,

3 rows fetched.

SQL> select * from V$SYSTEM_PARAMETER where NAME like '%SET%';

NAME VALUE DEFAULT_VALUE IS_DEPRECATED    
  ---------------------------------------------------------------- ---------------------------------------------------------------- ---------------------------------------------------------------- -------------    
  CHARACTER_SET UTF8 UTF8 FALSE     
  NATIONAL_CHARACTER_SET UTF16 UTF16 FALSE

2 rows fetched.

**2、新增字典序字段，设置默认字典序**

（1）mysql的latin1默认为  latin1_swedish_ci，当前还为实现该字典序(YDBRD-26265)，默认为latin1_general_ci，utf8mb4默认为utf8mb4_general_ci

（2）mysql查询字典序的方法：1）SHOW VARIABLES，  **2）select @@CHARACTER_SET_SERVER; 支持方法2）**

（3）yashan模式下，暂无查询和修改collection的方法

mysql> SHOW VARIABLES LIKE 'character_set_server';    
  +----------------------+--------+    
  | Variable_name | Value |    
  +----------------------+--------+    
  | character_set_server | latin1 |    
  +----------------------+--------+    
  1 row in set (0.00 sec)

mysql> SHOW VARIABLES LIKE 'collation_server';    
  +------------------+-------------------+    
  | Variable_name | Value |    
  +------------------+-------------------+    
  | collation_server | latin1_swedish_ci |    
  +------------------+-------------------+

mysql> select @@COLLATION_SERVER;    
  +--------------------+    
  | @@COLLATION_SERVER |    
  +--------------------+    
  | latin1_swedish_ci |    
  +--------------------+    
  1 row in set (0.00 sec)

mysql> select @@CHARACTER_SET_SERVER;    
  +------------------------+    
  | @@CHARACTER_SET_SERVER |    
  +------------------------+    
  | latin1 |    
  +------------------------+    
  1 row in set (0.00 sec)

## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

暂不支持：

1. 创建数据库、表和字段时指定字符集
1. DML中修改字符集
1. 字符序仅支持设置为默认，后续功能在字符序需求中补齐
1. mysql支持表级、列级设置字符集，数据库字符集
1. mysql的charset与ncharset不分开，可能会出现设置UTF16的情况
1. 不支持对字符集进行设置修改，启库设置时须按yashan流程（流程上支持，但不生效）


# 3. 详细测试设计

## 3.1 测试设计方法

测试点分析采用场景分析等测试设计工程方法

## 3.2 详细测试设计

1、功能测试分析

|命令|yashan模式|mysql模式|ISO8859-1|UTF8|ASCII|GBK|GB18030|
|---|---|---|---|---|---|---|---|
|show parameter char;|支持|支持|mysql和崖山模式结果一致|||||
|select * from V$SYSTEM_PARAMETER where NAME like '%SET%'|支持|支持||||||
|select @@COLLATION_SERVER;|不支持|支持|latin1_general_ci|utf8mb4_general_ci|ascii_general_ci|gbk_general_ci|gb18030_general_ci|
|select @@CHARACTER_SET_SERVER;|不支持|支持|latin1|utf8mb4|ascii|gbk|gb18030|


|测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|字符集映射和默认排序规则|yashan建库方式|  
|1、yasboot部署，默认建库,2、已部署，create database|  
|/|/|
|  
|字符集|  
|1、yasql：ISO8859-1和UTF8，yashan模式查询字符集，mysql模式下查询字符集和字符序,2、mysql客户端：查询字符集和字符序|做映射，预期见上表，yasql和mysql查询结果一致|1、ASCII、GBK、GB18030，yashan模式查询字符集，mysql模式下查询字符集和字符序,2、mysql客户端：查询字符集和字符序|不做映射，预期见上表，yasql和mysql查询结果一致|


2、经分析不涉及专项测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|N|
|KT|N|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


# 4. 测试用例

1. 冒烟：mysql模式下，执行select @@COLLATION_SERVER;和 select @@CHARACTER_SET_SERVER;结果正确
1. 文本用例：


[YDBRD-26264_兼容MySQL字符集_测试执行过程.docx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjA4OTcwYzJhZjRmNTIxODc4IiwicmVmX2lkIjoiNjczOTZlNjA3MjgyMDZlZmI5MmYyN2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjM3LCJleHAiOjE3ODI0NTgwMzd9.6q5BzFdA2cYkvZwBtihOJj1meUPMhdUmRkqSiedM9Tk)

# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：1  *人天*

计划测试完成时间：

## Attachments:

[YDBRD-26264_兼容MySQL字符集_测试执行过程.docx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjA4OTcwYzJhZjRmNTIxODc4IiwicmVmX2lkIjoiNjczOTZlNjA3MjgyMDZlZmI5MmYyN2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjM3LCJleHAiOjE3ODI0NTgwMzd9.6q5BzFdA2cYkvZwBtihOJj1meUPMhdUmRkqSiedM9Tk)

 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)    


[image2024-5-16_15-15-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjA4OTcwYzJhZjRmNTIxODc5IiwicmVmX2lkIjoiNjczOTZlNjA3MjgyMDZlZmI5MmYyN2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjM3LCJleHAiOjE3ODI0NTgwMzd9.T5Q68SfuxXmniyBkaCvh-C7HRQ_HX5jWEnTYEb3zvtY)

 (image/png)    


[image2024-5-14_9-23-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjA4OTcwYzJhZjRmNTIxODdhIiwicmVmX2lkIjoiNjczOTZlNjA3MjgyMDZlZmI5MmYyN2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjM3LCJleHAiOjE3ODI0NTgwMzd9.6BkXLivVSCKl74a4eWbjgO-kD6OwnXGbe1BuDmtrOTU)

 (image/png)    
