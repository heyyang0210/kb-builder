Created by 陈伟旭, last modified on 八月 26, 2024

# 1. 概述

本文描述支持MySQL锁表功能

调研文档：    [YDBRD-26259 支持mysql锁表功能 - 马文英 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=162989016)  

SR链接:    [https://pingcode.yasdb.com/pjm/items/66190f1ffd997db58ad88ba2](https://pingcode.yasdb.com/pjm/items/66190f1ffd997db58ad88ba2)    ?#YDBRD-26259 支持MySQL锁表功能

# 2. 需求分析

## 2.1 功能点分析

语法：

LOCK     {  TABLE     |     TABLES  }     *tbl_name*     [  [  AS  ]     *alias*  ]     *lock_type*     [  ,     *tbl_name*     [  [  AS  ]     *alias*  ]     *lock_type*  ]     .  .  .

*lock_type*  : {     READ     [  LOCAL  ]     |     WRITE     }

UNLOCK     {  TABLE     |     TABLES  }

- lock table read锁定表只能读，不能更新表；其他session可以在不获得read锁时读表
- lock table write获得锁的session可读可写
- unlock显示释放表锁，释放之前获得的锁
- 当前session，lock table锁定表后，再次lock table会释放之前的锁
- 一个session通过lock table锁定表后，其他session不能update表 和 获取 write锁
- lock table 时lock tables的别名，  是否都可以锁定多表？（不支持别名）
- 锁定的表可以是临时表但不生效


## 2.2 应用场景

支持MySQL锁表功能

当一组操作需要操作一批表时，通过lock tables 一次锁表可以提高操作的效率

## 2.3 规格约束

- Mysql：LOCK TABLES前如果有建立了触发器，会隐式的把当前的触发器涉及到的表也LOCK上。【  **YASHAN不对齐**  】（lock 触发器涉及的表直接报错）
- Mysql：LOCK TABLES 和 UNLOCK TABLES 不能在存储程序。【  **YASHAN对齐**  】
- **lock table后禁用所有ddl（**  **无论对获锁表、未锁表执行DDL操作都会拦截**  **）**
- ~~**lock table**~~  ~~**不能锁动态视图 （v$）**~~
- ~~**不支持锁普通视图**~~
- **所有视图都不支持，view lock报错**


# 3. 详细测试设计

## 3.1 测试设计方法

|MySQL锁表|测试点|有效等价类|备注|无效等价类|
|---|---|---|---|---|
|lock tables   read/write|单表|普通表table|  
|owner下不存在的表、动态视图|
|  
|  
|分区表|  
|  
|
|  
|  
|表名为中文|  
|  
|
|  
|  
|~~表别名~~|不支持|  
|
|  
|  
|临时表temporary table|锁定的表可以是临时表但不生效|  
|
|  
|多表|同上|  
|  
|
|unlock tables|  
|  
|  
|  
|


  


目前崖山的read、write锁没有区别，都是可读可写

|MySQL锁表|输入条件|测试场景|预期|备注|
|---|---|---|---|---|
|**lock table 获取锁（单表）**|**read **|会话1 lock table read锁定表后，可以获得  write锁（已获锁的表） |正常执行|  
|
|  
|  
|会话1 lock table read锁定表后，可以再次lock获得  read锁（已获锁的表） |正常执行|  
|
|  
|  
|会话1 lock table read锁定表后，其他会话可以同时获得read锁  （已获锁的表） |其他会话阻塞|  
|
|  
|  
|会话1 lock table read锁定表后，其他会话  可以获得 read锁（未获锁的表）|其他会话正常执行|  
|
|  
|  
|会话1 lock table read锁定表后，其他会话不  可以获得 write锁（已获锁的表） |其他会话执行lcok write会阻塞|  
|
|  
|  
|会话1 lock table read锁定表后，其他会话  可以获得 write锁（未获锁的表）|其他会话正常执行|  
|
|  
|**write**|会话1 lock table write锁定表后，可以获得read  锁（已获锁的表） |正常执行|  
|
|  
|  
|会话1 lock table write锁定表后，可以再次lock获得write  锁（已获锁的表） |正常执行|  
|
|  
|  
|会话1 lock table write锁定表，其他会话执行lock tables read和lock tables write   （已获锁的表） |会话阻塞|  
|
|  
|  
|会话1 lock tables write锁定表，其他会话执行lock tables read和lock tables write   （未获锁的表）|会话1 wirte锁表后，切换会话2，除了已获锁表，可以read、 write锁其他表|  
|
|  
|  
|  
|  
|  
|
|**lock tables 获取锁（多表）**|**read**|会话1 lock tables 多表 read锁定表后，可以获得  write锁|正常执行|  
|
|  
|  
|会话1 lock tables 多表 read锁定表后，其他会话可以同时获得read锁  （已获锁的表） |其他会话阻塞|  
|
|  
|  
|会话1 lock tables 多表 read锁定表后，其他会话可以同时获得read锁  （未获锁的表） |其他会话正常执行|  
|
|  
|  
|会话1 lock tables 多表 read锁定表后，其他会话不  可以获得 write锁（已获锁的表）|其他会话执行lcok write会阻塞|  
|
|  
|  
|会话1 lock tables 多表 read锁定表后，其他会话不  可以获得 write锁（未获锁的表）|其他会话正常执行|  
|
|  
|**write**|会话1 lock tables write锁定表，其他会话执行lock tables read和lock tables write （获锁表）|mysq表现阻塞|  
|
|  
|  
|会话1 lock tables write锁定表，其他会话执行lock tables read和lock tables write （未获锁表）|会话1 wirte锁表后，切换会话2，除了已获锁表，可以read、 write锁其他表|  
|
|  
|  
|  
|  
|  
|
|**lock table 获取锁后进行访问（单表）**|**lock后，对未获锁的表访问**|会话1 lock tables read锁定表，查询未锁定的表；|预取报错Table 'test2' was not locked with LOCK TABLES|  
|
|  
|  
|会话1 lock tables read锁定表，其他会话查询未锁定的表|会话1 ，查询未锁表，预期报错,其他会话查询未锁表，正常执行|  
|
|  
|  
|会话1 lock tables read锁定表，对未锁的表执行插入insert 预期报错；其他会话对未锁的表执行插入insert 正常执行|会话1 对未锁的表执行DML操作报错；,切换到会话2，对未锁的表执行DML操作正常执行|  
|
|  
|  
|会话1 lock tables read锁定表，对未锁的表执行更新update 预期报错；其他会话对未锁的表执行更新update 正常执行|会话1 对未锁的表执行DML操作报错；,切换到会话2，对未锁的表执行DML操作正常执行|  
|
|  
|  
|会话1 lock tables read锁定表，对未锁的表执行删除delete 预期报错；其他会话对未锁的表执行删除delete 会正常执行|会话1 对未锁的表执行DML操作报错；,切换到会话2，对未锁的表执行DML操作正常执行|  
|
|  
|  
|会话1 lock tables write锁定表，查询未获锁的表|write锁后，查询未获锁的表。预期报错|  
|
|  
|  
|会话1 lock tables write锁定表，其他会话查询未获锁的表|会话1 write锁后，切换会话2，查询未获锁的表，正常执行|  
|
|  
|  
|会话1 lock tables write锁定表，对未获锁的表执行插入insert 预期报错；其他会话对未获锁的表执行插入insert 正常执行|会话1 对未锁的表执行DML操作报错；,切换到会话2，对未锁的表执行DML操作正常执行|  
|
|  
|  
|会话1 lock tables write锁定表，对未获锁的表执行更新update 预期报错；其他会话对未获锁的表执行更新update 正常执行|会话1 对未锁的表执行DML操作报错；,切换到会话2，对未锁的表执行DML操作正常执行|  
|
|  
|  
|会话1 lock tables write锁定表，对未获锁的表执行删除delete 预期报错；其他会话对未获锁的表执行删除delete 正常执行|会话1 对未锁的表执行DML操作报错；,切换到会话2，对未锁的表执行DML操作正常执行|  
|
|  
|  
|会话1 lock普通表后，查询系统表正常，但系统视图报错|会话1 lock table后，查询系统表正常执行；,查询系统视图，预期报错|  
|
|  
|  
|物化视图|兼容模式下不支持创建物化视图，预期报错|  
|
|  
|  
|会话1lock read、write后只能访问lock的表，其他表不能访问（information schema中的表仍可访问）|会话1 lock table后，未获锁的表不能查询，但  information schema视图的表可以访问,语句：,lock table test2 read;,select TABLE_SCHEMA from information_schema.TABLES where TABLE_NAME='test1';|  
|
|  
|  
|会话1lock read、write后只能访问lock的表，其他表不能访问（information schema中的表仍可访问），切到会话2，information schema中的表仍可访问|会话1 lock table后，  information schema视图的表可以访问；,切换到会话2，information schema视图的表仍然可以访问；|  
|
|  
|**lock后，对获锁的表访问**|会话1 lock tables read锁定表，可以查询获锁表；其他会话查询获锁表|会话1 查询获锁表正常执行；,会话2查询获锁表 正常执行|  
|
|  
|  
|会话1 lock tables read 锁表，查询获锁表时带  表别名|正常执行|  
|
|  
|  
|会话1 lock tables read 带表别名，查询获锁表时带表别名 ；其他会话也可以查询获锁表|lock 时不支持带表别名，预期报错|  
|
|  
|  
|会话1 lock tables read 带表别名，查询获锁表时不带表别名 |lock 时不支持带表别名，预期报错|  
|
|  
|  
|会话1 lock tables read锁定表，对lock获锁的表执行插入insert 正常执行；其他会话对lock获锁的表执行插入insert |会话1 lock table read 后，执行DML操作正常执行；,会话2执行DML操作 会话阻塞|其他会话执行DML操作会阻塞，只能本地手动执行|
|  
|  
|会话1 lock tables read锁定表，对lock获锁的表执行更新update 正常执行；其他会话对lock获锁的表执行更新update|会话1 lock table read 后，执行DML操作正常执行；,会话2执行DML操作 会话阻塞|其他会话执行DML操作会阻塞，只能本地手动执行|
|  
|  
|会话1 lock tables read锁定表，对lock获锁的表执行删除delete 正常执行；其他会话对lock获锁的表执行删除delete |会话1 lock table read 后，执行DML操作正常执行；,会话2执行DML操作 会话阻塞|其他会话执行DML操作会阻塞，只能本地手动执行|
|  
|  
|会话1 lock tables write锁定表，查询获锁表|正常执行|  
|
|  
|  
|会话1 lock tables write锁定表，查询获锁表 带表别名|正常执行|  
|
|  
|  
|会话1 lock tables write 带表别名，查询获锁表时不带表别名|lock 时不支持带表别名，预期报错|  
|
|  
|  
|会话1 lock tables write锁定表，其他会话查询和更改获锁表|会话1 lock table write 后，切换到会话2，对获锁表执行DML操作，会话阻塞|  
|
|  
|  
|会话1 lock tables write锁定表，对lock获锁的表执行插入insert|正常执行|  
|
|  
|  
|会话1 lock tables write锁定表，对lock获锁的表执行更新update|正常执行|  
|
|  
|  
|会话1 lock tables write锁定表，对lock获锁的表执行删除delete|正常执行|  
|
|  
|  
|会话1 lock table 锁定表，在查询语句中多次访问同一个表|yashan预期正常执行,![](https://pingcode.yasdb.com/atlas/files/public/67396e5fa1ad9a3311dc96ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE2MTAsImV4cCI6MTc4MjM4MjQxMH0.c0Rv_zlFgzQIarMSb4YPOviQJUlQSTHzrEPkXKsYmiA)|  
|
|  
|  
|lock tables read lcocal，其他会话可以insert|不支持local,会话1执行下列语句：,create table test3( id int , name varchar(12)) engine=MyISAM;,lock table test3 read local;,会话2执行下列语句：,insert into test3 values(1,'test');|  
|
|  
|  
|会话1 lock 表1 read，切换到会话2 lock 表2read， 表3 read 后，会话1查询获锁表正常，再查询表2 表3会报错；会话2同理|会话1： lock table test1 read；会话2： lock table test2 read，test3 read；,在会话1查询 test1表正常执行，查询test2、test3表 预期报错,切换到会话2，查询test1表预期报错，查询test2、test3表正常执行|  
|
|  
|  
|会话1 lock 表1 write，会话2lock 表write， 表3 read后，会话1对获锁表执行DML操作正常执行，再对表2 表3执行DML会报错；会话2同理|会话1： lock table test1 read；会话2： lock table test2 read，test3 read；,在会话1 对 test1表 执行DML操作正常执行，对test2、test3表执行DML操作，预期报错,切换到会话2，对 test1表 执行DML操作 预期报错，查询test2、test3表 执行DML操作，正常执行|  
|
|  
|  
|外键：会话1 子表有外键约束的条件下，对父表lock write锁后，对父表执行DML操作，查看父表的数据已经变更；unlock解锁后，再查询子表，子表的数据也会发生变化|子表外键约束的条件下，父表数据变更，子表也会变化|  
|
|  
|  
|  
|  
|  
|
|**lock tables 获取锁后进行访问（多表）**|**lock后，对未获锁的表访问**|同上|  
|  
|
|  
|**lock后，对获锁的表访问**|同上|  
|  
|
|  
|  
|补充：lock tables 多表时，表1为read锁，表2为write锁，,执行DML操作 insert 表2 select 表1|正常执行|  
|
|  
|  
|lock tables 多表时，表1为read锁，表2为write锁，,执行DML操作 insert 表1 select 表2|正常执行|  
|
|  
|  
|  
|  
|  
|
|**lock table释放**|  
|会话1 lock table 表1 read后，查询表2会报错；再次lock table 表2 read  ，会释放之前的锁，查询表2成功，查询表1报错|会话1 lock 表1后，再次lock 表2，会释放之前的锁|  
|
|  
|  
|会话1 lock table表1 read 后，查询获锁表成功，查询表2会报错；再次lock table 表2 read，表3 write，会释放之前的锁，查询表2、3成功，表1报错|会话1 lock 表1后，再次lock 表2，会释放之前的锁|  
|
|  
|  
|会话1 lock table后，会话异常断开，重开一个会话，查询未获锁的表。（kill 、exit）|正常执行|  
|
|  
|  
|lock table前建立了触发器，触发器涉及的表不能lock|触发器涉及的表，lock时报错|  
|
|  
|  
|lock table后，执行commit 不会释放 lock获得的锁|lock锁不会释放|  
|
|  
|  
|lock table后，执行rollback 不释放 lock获得的锁|lock锁不会释放|  
|
|  
|  
|直接unlock table\tables|正常执行|  
|
|  
|lock 单表|lock table 表 read ，执行DML操作 正常执行，unlock table/tables后正常执行DML操作|正常执行|  
|
|  
|lock 多表|lock tables多表 read ，执行DML操作 正常执行，unlock table/tables后正常执行DML操作|正常执行|  
|
|  
|  
|  
|  
|  
|
|**lock tables后，拦截**  **DDL操作（**  **无论对获锁表、未锁表执行DDL操作都会拦截**  **）**|  
|覆盖DDL：    [SQL语句 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/00SQL%E8%AF%AD%E5%8F%A5.html)  |lock 锁后，DDL操作拦截报错|  
|
|兼容模式|  
|切换兼容模式，lock锁依然存在，不释放|来回切换兼容模式，lock锁依旧存在|  
|


  


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT| 涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

## Comments:

|  [](null)  ,跟开发对齐了下,1.lock table和unlock table不支持存储过程,2.yashan没有lock table权限，不进行权限测试,3.锁视图会报错‘视图不能锁’，失效视图也是一样的报错,4.系统表和系统视图 lock报错，系统表查询正常，系统视图查询报错,5.lock table后拦截所有DDL操作，对已锁定的表执行DDL操作也会报错拦截,Posted by chenweixu at 八月 13, 2024 10:05|
|---|
