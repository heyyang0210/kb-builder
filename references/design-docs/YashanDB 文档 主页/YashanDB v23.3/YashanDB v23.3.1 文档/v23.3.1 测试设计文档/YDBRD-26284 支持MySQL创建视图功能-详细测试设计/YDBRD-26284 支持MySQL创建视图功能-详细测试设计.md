Created by 胡晓畔, last modified on 七月 13, 2024

  


# 1. 概述

崖山DB在兼容模式下，适配mysql的create  * VIEW语法。*

# 2. 需求分析

## 2.1 功能点分析

语法图：

![](https://conf.yasdb.com/download/attachments/150618898/create_view.GIF?version=2&modificationDate=1713842156000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4MDEsImV4cCI6MTc4MjM4MjYwMX0.w_SqUqgjh6trkMN2uar1HcsF_Fla7Bwt5Gq8fMn1A2I)

## 2.2 应用场景

客户使用场景：

CREATE OR REPLACE ALGORITHM = UNDEFINED DEFINER = `root`@`%` SQL SECURITY DEFINER VIEW `test`.`test_view` AS SELECT test_table.C2 FROM test_table

关联场景:

schema的使用

新增视图，视图名称待定

用户权限体现[SQL SECURITY   部分  ]

## 2.3 规格约束

1.仅仅语法兼容，并不实现具体功能的部分：

- algorithm 三种算法，包含ALGORITHM = TEMPTABLE ，最后带 WITH CHECK OPTION 报错的情况
- with check option
- DEFINER = `root`@`%` 或者DEFINER = `root`@`localhost`这种应用


2.algorithm、definer、sql security是按序的，可缺省但是不能重复设置

3.mysql和yashan访问schema的差异：

- mysql: select子句里的table对象，如果不指定schema则默认使用当前会话schema
- yashan: select子句里的对象，如果不指定schema则默认使用视图的schema，如果视图的schema也没指定则默认当前会话schema


# 3. 详细测试设计

## 3.1 测试设计方法

从create VIEW语法何功能出发，覆盖语法路径组合，结合等价类，边界值，场景法 ，错误猜测法等，输出测试点

## 3.2 详细测试设计

|测试场景|测试点|  
|预期|备注|
|---|---|---|---|---|
|create VIEW  |正确语法覆盖|带replace，存在同名视图|预期成功|  
|
|  
|  
|不带replace，存在同名视图|预期报错|  
|
|  
|  
|不带replace，不存在同名视图|预期成功|  
|
|  
|algorithm，definer，sql security|全部按序包含|成功|  
|
|  
|  
|存在缺省|成功|  
|
|  
|  
|乱序|报错|  
|
|  
|  
|重复设置|报错|  
|
|  
|  
|支持的范围外|报错|  
|
|  
|with check option|覆盖组合|  
|  
|
|  
|with check option组合algorithm|UNDEFINED   |  
|  
|
|  
|  
|merge|  
|  
|
|  
|  
|temptable |报错|三种组合都报错|
|  
|DEFINER =   USER|校验语法兼容，实际不生效,覆盖  DEFINER =       `root`    @    `%`  ,DEFINER = `root`@`localhost`等,  
|成功|  
|
|  
|  
|非法user|  
|直接拦截？|
|  
|  
|非法IP|  
|暂时不关注|
|  
|SQL SECURITY DEFINER|DEFINER|  
|  
|
|  
|SQL SECURITY invoker,-- 权限重点测试|构造场景，做基表和视图的权限校验,比如：,对VIEW有权限，对基表有权限 ,对VIEW有权限，对基表无权限|  
|create view的权限,查表的权限,查视图的权限,--分开组合校验权限|
|  
|*select_statement*   ,  
|全表，带 where条件|  
|  
|
|  
|  
|表的部分列|  
|  
|
|  
|  
|子查询， 表达式等|  
|  
|
|  
|  
|不带schema的表|  
|a 用户登录，use database c, b.view  from  表(c),按MySQL的逻辑实现,--重点关注|
|  
|数据类型|当前SR不考虑数据类型映射|  
|  
|
|相关视图|新增视图 字段|正确显示|  
|  
|
|  
|新增视图 功能,MYSQL.STORED_OBJECT_OPTIONS$|正常查询，且查询结果正确,create_schema_id：创建视图时当前会话的user id,definer id：指定definer的时候，definer对应的user id；默认是当前会话的user id|  
|  
|
|  
|兼容模式下的其他视图|  
|  
|列出需要校验的视图信息？--不涉及|
|视图应用,-- 权限重点关注|insert|对视图，基表插入数据,insert VIEW，报错,insert 基表，VIEW可以看见新增数据|  
|  
|
|  
|  
|含子查询|  
|  
|
|  
|  
|函数表达式|  
|  
|
|  
|  
|其他表达式|  
|  
|
|  
|  
|绑定参数|  
|  
|
|  
|update |对视图，基表更新数据,update VIEW，报错,update基表，VIEW可以看见数据更新|  
|  
|
|  
|  
|含子查询|  
|  
|
|  
|  
|函数表达式|  
|  
|
|  
|  
|其他表达式|  
|  
|
|  
|  
|绑定参数|  
|  
|
|  
|delete |对视图，基表删除数据,delete VIEW，报错,delete  基表，VIEW可以看见数据删除|  
|  
|
|  
|  
|含子查询|  
|  
|
|  
|  
|函数表达式|  
|  
|
|  
|  
|其他表达式|  
|  
|
|  
|  
|绑定参数|  
|  
|
|  
|alter,  
|增加列|  
|  
|
|  
|  
|修改基表列名，列数据类型,  
|视图不可用|alter语法与mysql不同时，如何表现 ,ALTER TABLE table_mysql   **CHANGE**   COLUMN b bb tinyint;,-- 当前不关注语法差异|
|  
|  
|列约束|  
|  
|
|  
|  
|删除列|  
|  
|
|  
|  
|修改视图名|  
|  
|


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|  
|
|KT|  
|
|长稳|√|
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
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

Guider + yasft 

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  
