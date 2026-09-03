Created by 孟麟, last modified on 六月 28, 2024

# 1. 概述

本测试设计覆盖  SQL_MODE中PIPES_AS_CONCAT和REAL_AS_FLOAT

  [https://pingcode.yasdb.com/pjm/items/66190382fd997db58ad879df](https://pingcode.yasdb.com/pjm/items/66190382fd997db58ad879df)    ?    
  #YDBRD-26240 SQL_MODE支持PIPES_AS_CONCAT

  [https://pingcode.yasdb.com/pjm/items/6619044afd997db58ad87bd7](https://pingcode.yasdb.com/pjm/items/6619044afd997db58ad87bd7)    ?    
  #YDBRD-26243 SQL_MODE支持REAL_AS_FLOAT

## 1.1相关文档

开发文档：    [特性设计-YDBRD-26243：SQL_MODE支持REAL_AS_FLOAT/PIPES_AS_CONCAT/ANSI_QUOTES设计文档](156112199.html)  

测试调研：    [YASHAN-935_测试调研](/pages/createpage.action?spaceKey=YAS&title=YASHAN-935_%E6%B5%8B%E8%AF%95%E8%B0%83%E7%A0%94)  

# 2. 需求分析

## 2.1 功能点分析

1、mysql表现

（1）PIPES_AS_CONCAT和REAL_AS_FLOAT

|MODE项|默认开启|开启|关闭|
|---|---|---|---|
|PIPES_AS_CONCAT|NO|||视为连接符|||视为or运算符|
|REAL_AS_FLOAT|NO|real作为float类型|未开启，即默认real作为double类型|


（2）sql_mode分为全局和会话，每开启一个新客户端（session），会话的sql_mode继承自当前全局的sql_mode，可以修改会话sql_mode，会话中执行的SQL以会话sql_mode为准

## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

1、sqlmode的设置语法为：

set sql_mode = 'text,text...';或set sql_mode = '';其中的text必须为存在的sql_mode,当不指定任何内容时，视为将所有sqlmode置为false

2、sqlmode的查询语法为：

select @@sql_mode;当出现不存在的sqlmode时，报错处理

3、本需求只支持REAL_AS_FLOAT/PIPES_AS_CONCAT，其他SQL modes在另外的需求支持

——来自开发文档

# 3. 详细测试设计

## 3.1 测试设计方法

测试点分析采用边界值、等价类和场景分析等测试设计工程方法

## 3.2 详细测试设计

1、功能测试分析

|测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|SQL MODE变量|session.sql_mode继承global.sql_mode|  
|global.sql_mode新增（单个/多个相同值）、删除、不变、设置为‘’|1、已开session的sql_mode不变,2、新开session的sql_mode与global.sql_mode一致,3、sql_mode控制的功能生效|global.sql_mode设置失败(不支持的值)：,非‘’设置失败（修改旧的/新增）、‘’设置失败（只单个/多个错误的，多个正确和错误混合）|配置失败，保持原值不变，控制的功能不变|
|  
|session.sql_mode变化|  
|session.sql_mode新增（单个/多个相同值）、删除、不变、设置为‘’|1、该session的sql_mode更新，sql_mode控制的功能生效,2、新开session与global一致|session.sql_mode设置失败(不支持的值)：,同上|配置失败，保持原值不变，控制的功能不变|
|REAL_AS_FLOAT|关闭（默认）|  
|出现数据类型的地方：,1、create table（普通表/临时表）,2、alter table：新增列，修改列数据类型,3、cast函数 cast(xx as real)：查询（投影列、filter、子查询、create view as select、create table as select、create table列default含函数、CTE）|double类型|mysql模式下未适配场景(物化视图；匿名块、存储过程、UDF、UDP、UDT)|按yashan的real为float别名处理,--当前与支持的场景一致，plsql后面确定规则后再关注|
|  
|开启|  
|同上|float类型|同上|同上|
|  
|关闭<->开启切换|  
|多次切换，每次切换后测试场景同上；并check前一个模式下的表、数据|同上；前一个模式下的内容/结果不变|同上|同上|
|PIPES_AS_CONCAT|关闭（默认）|  
|出现||的SQL：,1、查询（投影列、filter、create view as select、create table as select、CTE）,2、create table：default值含||表达式、check含||表达（单列和constraint）,3、alter table：新增列/修改列default，新增/修改check（含修改[开启|关闭]模式下创建的表）|or逻辑运算|物化视图、匿名块、存储过程、UDF、UDP|按连接符处理,--同上|
|  
|开启|  
|同上|连接符|同上|同上|
|  
|关闭<->开启切换|  
|多次切换，每次切换后测试场景同上；并check前一个模式下的表、数据|同上；前一个模式下的内容/结果不变|同上|同上|


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

1. 冒烟：
1. 文本用例：


# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：