sr:  [https://pingcode.yasdb.com/pjm/items/67d146d56dccc3daa3166162?](https://pingcode.yasdb.com/pjm/items/67d146d56dccc3daa3166162?)  

#YDBRD-38942 分布式substring函数支持outline lob

开发设计：  [YDBRD-38942 substring函数支持outline lob特性设计文档 | 知识管理 - PingCode ](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67ea39cc529b5c0231d06dbc)  

# 1. 概述

本需求支持

单机和分布式场景列执行的substring和substr函数支持outline lob数据。



# 2. 需求分析

## 2.1 功能点分析

分布式支持substring函数入参outline lob类型

分布式支持substr函数入参outline lob列

单机列执行substring和substr函数支持outline lob数据。

## 2.2 应用场景

客户场景

场 景：

1、分布式环境中，clob字段导入超过36000长度的字符串，需要substring函数获取子串，目前不支持，报：YAS-05008 unsupported feature: outline lob，此场景在智慧工会项目使用较多，需要进行支持。客户查询语句为：SELECT SUBSTRING(t2, 1, 4) FROM DEVDBA.TEST_WZG2;其中t2字段为clob类型。

## 2.3 规格约束 

1.不支持输出的长度超过32000

  


# 3. 详细测试设计

## 3.1 测试设计方法

采用等价类，边界值测试设计方法进行用例设计

## 3.2 详细测试设计

  
3.2.1 详细功能用例测试点

|测试场景|测试点|  
有效等价类|备注|无效等价类|  
|
|:---|:---|:---|:---|:---|:---|
|分布式|表类型|lsc 复制表,lac 复制表,lsc分布表,tac分布表,lsc共享表,tac共享表||分布式行存|  
|
|单机|列存|单机lsc表,单机tac表,宽表>256|||  
|
|LOB类型||outline clob||outline blob|  
|
|outline LOB方式||1.disable storage in row,2.构造超过32000长度 |中文 英文  数字 特殊文字 符号等,非空 ,空||  
|
|substring参数-lob列||输入的clob长度小于32000。,输入的clob长度小于32000但是采用行外存储的方式。,输入的clob长度超过32000并且截取长度小于32000。,输入的clob长度超过32000并且截取长度大于32000（预期报错）。,||输入的长度小于32000，截取长度大于输入长度，预期报错|  
|
|location参数||||负数、0，超过clob长度的数,|  
|
||截取长度|输出长度小于32000||截取长度超过32000,负数、0,超过clob长度的数|  
|
|返回值类型测试||clob|||  
|
|SQL场景|在select 中|select 语句带where ，group by， order by, limit  |||  
|
||filter中||||  
|
||dml|delete ,update,insert into,insert into select ,cte|insert into select 查看是否是冷数据，默认是冷数据||  
|
||ddl|create table as select ,create view as select,|||  
|
||函数嵌套|和其他函数嵌套，作为其他函数的入参,自嵌套，作为substr函数的入参|多重嵌套|128层报错|  
|
|性能||select 32列，64列   LOB （行内，行外混合）,单列 outline LOB 多行|||  
|
||select语句嵌套子查询|关联子查询,非关联子查询 outline lob列|||  
|
||列来源|cte ,from子查询|select substr(c1,1,100) from (select c1 from... ),with cte as (select ...),select substr(outline_lob,1,100) from cte||  
|


  


  
3.2.2 dfx设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|不涉及，只是新增了函数支持行外lob列的单点功能|
|KT|不涉及|
|长稳|  
不涉及|
|一致性|不涉及  
|
|三方测试工具  
(sqltest，sqlancer)|  
不涉及|
|安全|不涉及  
|
|DFR|  
不涉及|
|HA|  
不涉及|
|压力|不涉及  
|
|性能|涉及，语句查询耗时，lob列多的时候耗时,select 32列，64列   LOB （行内，行外混合）,单列 outline LOB 多行|
|可维护性|涉及，用例自动化看护  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  


# 5. 测试框架设计

Guider + yasft 

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

工作量   4  *人天*

计划测试完成时间：2025/4/11



会议纪要： 关注dml场景

参会人员: 李攀 胡威振 施新华

会议时间 ：2025/04/09

