Created by 马士杰, last modified on 七月 12, 2024

详细设计-YDBRD26278

SR链接：    [https://pingcode.yasdb.com/pjm/items/66191514fd997db58ad89285](https://pingcode.yasdb.com/pjm/items/66191514fd997db58ad89285)    ?    
  #YDBRD-26278 兼容MySQL Set语句

# 1.总述

支持MySQL兼容的  特定的运维&管理语法 （做语法兼容，暂不支持功能）

## 1.1 需求来源

MySQL兼容性支持

支持形态：单机

## 1.2 调研文档

调研文档见：    [MySQL兼容支持set语句调研 - 马士杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159428361)  

  


## 1.3 需求分析

本需求中支持的set语句列表如下：

  点击此处展开...

（2）SET character_set_results = NULL 

（3）SET SESSION 

3.1 SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ

 3.2 SET SESSION character_set_results 

3.3 SET SESSION NET_READ_TIMEOUT= 86400 

3.4 SET SESSION NET_WRITE_TIMEOUT= 86400

 3.5 SET SQL_QUOTE_SHOW_CREATE=1

 3.7 SET SESSION WAIT_TIMEOUT = 2147483 

3.8 SET SESSION NET_WRITE_TIMEOUT = 2147483 

3.9 SET SESSION SQL_LOG_BIN = 0 

（4）SET SQL_SELECT_LIMIT=200 

（5）SET foreign_key_checks = 1 

（7）SET NAMES utf8mb4 

# 2.接口

本需求没有新增接口，相关接口已在myParseSet中，只需补充对应的关键字枚举

  


# 3.规格与约束

set语句中的变量或表达式不合法导致赋值失败时，整个语句失败，不影响原值

set的语法：

全局：

set @@GLOBAL.SQL_MODE = '';

会话

set @@session.sql_mode = '';

查询

select @@global.sql_mode;

select @@session.sql_mode;

select @@sql_mode;

暂时不支持多变量赋值

  


# 4. 特性

## 4.1 特性设计

1.parse：通过myParseSet解析set后对应的关键字，选择对应的parseSet函数

将set的内容（部分是=后的内容，部分语法没有= ）作为expr挂在setDef→charsetName上

2.verify：通过myVerifySet检查expr中内容的合法性

3.exec：通过myExecVar，根据subType判断是session变量还是global变量，在MyVarContext中寻找对应的变量，修改对应的myVariant

4.查询：和exec的流程类似，也会根据subType判断是session变量还是global变量，在MyVarContext中寻找对应的变量，但是不修改，直接返回myVariant的value

# 5.Testcases

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


  


# 6.资料设计章节

  


# 7.未来规划

支持MySQL事务控制相关的set语句

见sr     [https://pingcode.yasdb.com/pjm/items/66191483fd997db58ad89207](https://pingcode.yasdb.com/pjm/items/66191483fd997db58ad89207)    ?    
  #YDBRD-26270 支持MySQL事务控制相关Set语句

  


  


## Comments:

|  [](null)  ,1.右值表达式的规格,2.用户变量的规格限制,Posted by mashijie at 七月 12, 2024 14:43|
|---|
