Created by 徐瑶, last modified on 十二月 18, 2023

# 1. 概述

本文描述  分布式dbms_metadata.get_ddl支持获取列存DDL  测试设计

## 1.1 相关文档

SR:         [YDBRD-23777](https://jira.yasdb.com/browse/YDBRD-23777?src=confmacro)    -  分布式dbms_metadata.get_ddl支持获取列存DDL  完成  --23.1

  [YDBRD-21730](https://jira.yasdb.com/browse/YDBRD-21730?src=confmacro)    -  分布式dbms_metadata.get_ddl支持获取列存DDL  完成  --23.2

开发设计文档：    [DBMS_METADATA.GET_DDL Support Dstb Design](/pages/createpage.action?spaceKey=YAS&title=DBMS_METADATA.GET_DDL+Support+Dstb+Design)  

调研文档：    [01-分布式dbms_metadata.get_ddl获取列存DDL测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=135617588)  

概要设计文档：    [02-分布式dbms_metadata.get_ddl获取列存DDL测试概设](135617599.html)  

create table语法图：    [06-CREATE TABLE语法图](https://conf.yasdb.com/pages/viewpage.action?pageId=127642193)  

来源：    [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html#%E9%80%9A%E7%94%A8%E6%8F%8F%E8%BF%B0](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html#%E9%80%9A%E7%94%A8%E6%8F%8F%E8%BF%B0)  

![](https://pingcode.yasdb.com/atlas/files/public/67396bb9a1ad9a3311dc8506/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFFQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQVFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY1NTgsImV4cCI6MTc4MjMwNzM1OH0.yuCDyo1pUdW76Han9G2oiwbXB_zhgMbJdM1wRvghgSQ)

# 2. 需求分析

## 2.1 功能点分析

- 本需求主要需要在原有dbms_metadata.get_ddl的基础上，适配分布式的建表语句，而分布式表又分为sharded表（分布表）和duplicated表（复制表）。
- 分布式建表语句和单机的主要区别在于create sharded/duplicated table、表分区partition和表空间tablespace


**sharded表与单机建表语法区别**

|语句|具体用法|sharded情况|单机情况|是否需要适配|
|:---|:---|:---|:---|:---|
|建表头|create sharded table|支持|不支持|需要|
|table表空间集|tablespace set users|支持|不支持|需要|
|table表空间|tablespace users|不支持|支持|需要|
|partition表空间|partition ... tablespace users|不支持|支持|需要|
|subpartition表空间|subpartition ... tablespace users|不支持|支持|需要|
|index表空间|using index ... tablespace users|不支持|支持|需要|
|lob表空间集|lob ... store as ... tablespace users|不支持|支持|需要|
|range分区|partition by range|不支持|支持|不需要|
|list分区|partition by list|不支持|支持|不需要|


注：sharded表中，hash分区只能设置固定数量的分区个数，跟数据节点的chunk数有关；子分区除了不能设置表空间外，跟单机一样，可以range, list, hash

**duplicated表与单机的区别**

|语句|具体用法|duplicated情况|单机情况|是否需要适配|
|:---|:---|:---|:---|:---|
|建表头|create duplicated table|支持|不支持|需要|


## 2.2 应用场景

1）本需求主要需要在原有dbms_metadata.get_ddl的基础上，适配分布式的建表语句，而分布式表又分为sharded表（分布表）和duplicated表（复制表）。

2）分布式场景：

- 分布式场景下，连接  不同节点（mn，cn，dn）使用get_ddl
- 多CN环境下，并发应对


3）权限安全

- get_ddl用户要能够对其可访问的表进行get_ddl操作，不能对其不可访问的表进行get_ddl操作


## 2.3 规格约束

- 本需求针对分布式  **只支持LSC表**  ，不支持HEAP表和TAC表
- 分布式get_ddl与单机的区别主要有以下几点：


1. create table时，分布式需要加上sharded或duplicated
1. sharded表只有表空间集tablespace set，没有表空间tablespace，需要专门适配
1. sharded表不支持设置其他表空间，例如分区、索引、lob等
1. 不输出兼容的语法，例如：storage_clause，basicfile|securefile，parallel_clause，cache_clause等


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；  本SR高级包参数的校验在老功能中已全量覆盖，本次弱化这部分测试，且可复用单机列存支持DBMS_METADATA.GET_DDL的用例

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|部署|分布式|lsc|  
|tac|  
|
|表类型-duplicated table|  
|建表create table修改为create duplicated table|修改后复用单机列存支持DBMS_METADATA.GET_DDL的用例|  
|  
|
|sharded table|表头|建表create table修改为create sharded table|  
|  
|  
|
|  
|表空间|表的tablespace修改为tablespace set|  
|  
|  
|
|  
|表分区partitions|一级分区：hash,- 分区数：自动，等于chunk个
- 分区名
- （1）英文（大小写）、中文、特殊字符表情等
- （2）  是否带有单双引号
,      （3）名称长度1-64,- 分区索引：
|分区数：  每个节点组的分片数：  DS_SCALE_OUT_FACTOR|- 一级分区为range、list（报错）
- 分区设置表空间（拦截报错）
- 自定义分区数，不等于chunk（报错）
- 分区名长度大于64
- 分区索引设置表空间（拦截报错）
|  
|
|  
|  
|二级分区：range、list、hah,- 分区数：自动，自定义个数
- 分区名
- （1）英文（大小写）、中文、特殊字符表情等
- （2）  是否带有单双引号
,      （3）名称长度1-64|  
|分区设置表空间（拦截报错）,分区名长度大于64|  
|
|  
|约束|using_index_clause    
  不支持指定表空间|![](https://pingcode.yasdb.com/atlas/files/public/67396bb9a1ad9a3311dc8507/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFFQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQVFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY1NTgsImV4cCI6MTc4MjMwNzM1OH0.yuCDyo1pUdW76Han9G2oiwbXB_zhgMbJdM1wRvghgSQ)|using index指定表空间（拦截报错）,using index （create index）指定表空间（拦截报错）|  
|
|  
|索引|lsc  支持create index,不支持指定表空间|  
|create index 指定表空间（拦截报错）|  
|
|  
|lob_clauses|不支持指定表空间|  
|lob设置表空间（拦截报错）|  
|
|  
|权限|- 具有dba权限的用户getddl操作  all_tables视图下所有的  普通表，系统表
- 用户1建表，有dba权限的用户2查询（所有表）
- 用户1建表，有登录权限但无dba权限的用户2查询（该用户下的表）
- 用户1建表，有登录权限且有  SELECT ANY TABLE  权限的用户2查询（除sys外任意表）
- 用户1建表，有登录权限且有  ALL PRIVILEGES  权限的用户2查询（除sys外任意表）
- 用户1建表，其他有登录权限且有select on 用户1.表1 权限的用户2查询（本用户下的表以及用户1.表1 ）
- 用户1建表空间，用户2建表指定用户1的表空间，有dba权限的用户3查询
- 用户1建表空间，用户2建表指定用户1的表空间，有登录权限但无dba权限的用户3查询
- 用户1建表空间，用户2建表指定用户1的表空间，有登录权限且有  SELECT ANY TABLE  权限的用户3查询（除sys外任意表）
- 用户1建表空间，用户2建表指定用户1的表空间，有登录权限且有  ALL PRIVILEGES  权限的用户3查询（除sys外任意表）
- 用户1建表空间，用户2建表指定用户1的表空间，其他有登录权限且有select on 用户1.表1 权限的用户3查询（本用户下的表以及用户1.表1 ）
|用户查询all_tables视图，对可访问的表能够进行get_ddl操作，,不可访问的表无法进行get_ddl操作|  
|  
|
|  
|  
|- 将get_ddl整体转为其他数据类型
,将getddl转为char，varchar，nchar，nvarchar等,- 将get_ddl结果整体插入不同数据类型列中
|  
|  
|  
|
|  
|分布式节点|- 直连不同节点（mn，cn，dn）使用get_ddl
- mn节点创建表，连cn，dn使用get_ddl
- cn节点创建表，连dn，mn使用get_ddl
- dn节点创建表，连cn，mn使用get_ddl
|查询不同步，先手动操作,只能连接cn建表|  
|  
|
|可靠性|  
|- getddl操作过程中kill session
- getddl操作过程中kill 进程
- getddl操作过程中ctrl+c
- 查询高级包的同时，删除查询的高级包
|  
|  
|  
|
|并发|  
|- 不同session并发getddl操作
- ddl、dml背景下getddl操作
- 查询视图背景下getddl
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|


  


  


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

*1） 自动化用例：Guider框架执行用例，生成预期，使用jdbc*  *模式执行。*

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：2023.12.18

  


## Attachments:

[get_ddl分布式文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjk4OTcwYzJhZjRmNTIwNjkxIiwicmVmX2lkIjoiNjczOTZiYjk1OTNmOTljOWZmMjM2NjUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTU4LCJleHAiOjE3ODIzODI5NTh9.QxNO_br_esiuTtxdR7XoSMvZwBucr8SmIpMisq4wyq0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,与会人：林永豪、唐嘉欣、贺天欢、徐瑶    
  评审时间：2023-12-08 11:00-12:00    
  评审地点：702,会议主题：分布式dbms_metadata.get_ddl支持获取列存DDL测试设计    
  评审纪要信息：,1.重点需  适配分布式的建表语句,2.  连接  不同节点（mn，cn，dn）使用get_ddl需注意  只能连接cn建表,3.需注意23.1和master的差异,评审通过与否：通过,Posted by xuyao at 十月 18, 2024 09:55|
|---|
