Created by 钟溱, last modified on 七月 19, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/66191514fd997db58ad89285](https://pingcode.yasdb.com/pjm/items/66191514fd997db58ad89285)    ?    
  #YDBRD-26278 兼容MySQL Set语句

支持MySQL兼容的  特定的运维&管理语法 （做语法兼容，暂不支持功能）

## 1.1相关文档

开发文档：    [【MySQL兼容】支持MySQL set语句设计文档](159428928.html)  

测试调研：    [YDBRD-26278-兼容MySQL Set语句-调研](https://conf.yasdb.com/pages/viewpage.action?pageId=156138254)  

# 2. 需求分析

## 2.1 功能点分析

语法兼容，以下Set语句    
    
  （1）SET character_set_results = NULL    
  （2）SET SESSION/global    
  2.1 SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ    
  2.2 SET SESSION character_set_results    
  2.3 SET SESSION   NET_READ_TIMEOUT  = 86400    
  2.4 SET SESSION SQL_QUOTE_SHOW_CREATE=1    
  2.5 SET SESSION WAIT_TIMEOUT = 2147483    
  2.6 SET SESSION NET_WRITE_TIMEOUT = 2147483    
  2.7 SET SESSION SQL_LOG_BIN = 0    
  2.8 SET SESSION SQL_SELECT_LIMIT=200    
  2.9 SET SESSION foreign_key_checks = 1    
  （3）SET NAMES utf8mb4

（4）USE Statement

## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

set语句任何赋值失败，整个语句失败，不影响原值

set的语法：

全局：

set @@GLOBAL.character_set_results= '';

会话

set @@session.set @@GLOBAL.character_set_results= '';

查询

select @@global.character_set_results;

select @@session.character_set_results;

select @@character_set_results;

暂时不支持多变量赋值

# 3. 详细测试设计

## 3.1 测试设计方法

测试点分析采用边界值、等价类和场景分析等测试设计工程方法

## 3.2 详细测试设计

1、功能测试分析

|输入条件1|有效等价类|备注|输入条件2|备注|无效等价类|
|:---|:---|:---|---|---|:---|
|character_set_results ,  
|SET character_set_results = NULL,SET @@SESSION.character_set_results = NULL,SET @@global.character_set_results = NULL|有@@的时候中间要有. 没有@@的时候中间是空格,恢复默认：    
  SET global character_set_results   = default|  
|  
|为空，空串|
||SET character set utf8;,SET charset UTF8MB4;|需确认是否需要支持,支持|  
|  
|  
|
|NAMES   |SET NAMES utf8mb4|不能加  SESSION和global  取值范围：    
  ASCII/GB18030/GBK/LATIN1/,UTF8、UTF8MB3、UTF8MB4,SET NAMES default;|  
|  
|不允许的字符集：,ucs2   utf16   utf16le   utf32|
|设置会话系统变量,  
    
    
    
    
    
    
    
|1、SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ    
    
|READ UNCOMMITTED,READ COMMITTED,REPEATABLE READ,SERIALIZABLE,  
|  
|  
|非给定范围：,WRITE-COMMITTED,给定范围值进行组合：,READ-UNCOMMITTED、READ-COMMITTED,其他类型值：,1、true、’test’、null|
||~~2、SET SESSION character_set_results~~    
    
|~~默认值为~~    
  ~~UTF8MB4~~    
  ~~取值范围：~~    
  ~~ASCII/GB18030/GBK/LATIN1/~~,~~UTF16/UTF8~~,~~UTF8MB3/~~,~~UTF8MB4~~|  
|  
|  
|
||3、SET SESSION NET_READ_TIMEOUT= 86400|NET_READ_TIMEOUT 1~31536000|EXPR_ADD     
    
  EXPR_SUB     
    
  EXPR_MUL     
    
  EXPR_MOD     
    
  EXPR_DIV     
    
  EXPR_CAT,EXPR_AND,EXPR_OR,EXPR_XOR,EXPR_NEG,EXPR_FILTER,  
,  
,  
,  
|  
,,  
|超过边界值,非法类型：,‘1’、true、’test’、null|
||~~4、SET SESSION NET_WRITE_TIMEOUT= 86400~~|~~NET_WRITE_TIMEOUT 1~31536000~~|||  
|
||5、SET SESSION SQL_QUOTE_SHOW_CREATE=1|SQL_QUOTE_SHOW_CREATE 0 1|||  
|
||~~6、SET SESSION WAIT_TIMEOUT = 2147483~~|~~WAIT_TIMEOUT 1-2147483~~|||  
|
||7、SET SESSION SQL_LOG_BIN = 0|SQL_LOG_BIN 0 1|||  
|
||8、SET   SESSION   SQL_SELECT_LIMIT=200|最大值是2^63,默认值为最大值,（mysql最大值是2^64）|||  
|
||9、SET   SESSION   foreign_key_checks = 1|FOREIGN_KEY_CHECKS = {0 | 1}|||OFF、ON|
|设置全局系统变量|同上  SET global|同上|||  
|
|用户自定义变量表达式|EXPR_SYSVAR,EXPR_CONST,EXPR_QUERY,EXPR_FUNCTION,EXPR_CASE,为右值|  
|||  
|
|多变量赋值|不支持|  
|||SET character_set_results = NULL，UTF8MB4;|


2、  设置用户变量和系统变量

|  
|yashandb表达式类型|说明及语句|备注|
|:---|:---|:---|---|
|1|EXPR_SYSVAR|set @start_time=current_date;,set @start_time=null;,SET @start_global_value = @@global.sql_select_limit;|在表达式中引用系统变量|
|2|EXPR_CONST|set @@global.  NAMES     ='  utf8mb4  '|表示常量的表达式类型|
|3|EXPR_QUERY|set @@global.sql_mode=(select @@sql_mode)    
  set @@global.  FOREIGN_KEY_CHECKS  =(select 1 from dual);,set @@global.wait_timeout=(select @@session.interactive_timeout)|查询包括    `SELECT`    语句|
|4|EXPR_FUNCTION|set @start_time=sysdate(),set @@global.wait_timeout=  (  ADD_MONTHS  (  DATE  '2021-5-31'  ,  -  3));|函数|
|5|EXPR_CASE|SET @@session.wait_timeout = (CASE WHEN @@session.wait_timeout > 2600 THEN 2700 WHEN @@session.wait_timeout < 2600 THEN 2500 ELSE 2600 END);|查询表达式中使用的       `CASE`       语句|


3、经分析不涉及专项测试

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

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


  


  


  


  


  


  


## Attachments:

[image2024-7-16_19-43-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjM4OTcwYzJhZjRmNTIxODg5IiwicmVmX2lkIjoiNjczOTZlNjM3MjgyMDZlZmI5MmYyN2NlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNzcwLCJleHAiOjE3ODI0NTgxNzB9.zoUmahJ-1BR1QIGVxuGCLSRe81czZ3CEDIbwmMSf_-o)

 (image/png)    
