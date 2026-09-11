Created by 钟溱, last modified on 八月 21, 2024

# 1. 需求概述

支持MySQL事务控制相关Set语句

## 1.1相关文档

SR：    [https://pingcode.yasdb.com/pjm/items/66191483fd997db58ad89207](https://pingcode.yasdb.com/pjm/items/66191483fd997db58ad89207)    ?  #YDBRD-26270 支持MySQL事务控制相关Set语句

开发文档：    [详细设计-YDBRD-26270 : 支持兼容MySQL事务控制set语句 Design](https://conf.yasdb.com/pages/viewpage.action?pageId=162992381)  

测试调研：    [YDBRD-26270 支持MySQL事务控制相关Set语句测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=162989823)  

# 2. 需求分析

## 2.1 功能点分析

该SR主要是做两个功能：

1. 系统变量和会话变量autocommit生效
1.  支持START TRANSACTION语句显式起事务


## 2.3 规格约束

事务：

mysql支持的事务隔离级别配置：读未提交、读已提交、  可重复读（默认）  、可串行化

yasdb支持的事务隔离级别配置：  读已提交（默认）  、可串行化2、设置用户变量和系统变量

# 3. 详细测试设计

## 3.1 测试设计方法

测试点分析采用边界值、等价类和场景分析等测试设计工程方法

## 3.2 详细测试设计

|输入条件1|有效等价类1|有效等价类2|备注|无效等价类|备注|
|:---|:---|:---|---|---|:---|
|SET autocommit|关闭自动提交模式：,SET AUTOCOMMIT  =  0  ;|global级，session级,取值范围：    
  0（off/false）,1（on/true）,加引号,|结合DML和DDL语句,,|语法问题|  
|
||开启自动提交模式：,SET AUTOCOMMIT  =  1;|||  
|  
|
||select @@global.autocommit；select @@session.autocommit；,yasql模式：show autocommit;|||  
|  
|
||global级变量默认值为1。session级变量初始化值为global当前值,session1： set @@session.autocommit=0; session2查询结果还为它本身默认值1,但session1：set @@global.autocommit=0; session2查询global结果为0,此时新开一个session3会话，查询seesion会为0|||  
|  
|
||session级别的autocommit的值从0变成1的时候，会把当前未提交的事务进行提交,,  
|||  
|  
|
||session级>yasql客户端（yasql客户端的autocommit设置在mysql兼容模式下不会生效了）,set autocommit OFF；,alter     session     set   compat_vector  =  mysql;,set @@session.autocommit=1;,这时候会自动提交|||  
|  
|
|START TRANSACTION    
    
|显式使用commit,|1、覆盖自动提交SET AUTOCOMMIT  =  1;,2、START TRANSACTION;,3、seesion2必须commit后才可以查询到,  
,和不自动提交SET AUTOCOMMIT  =  0  ;,  
,结合DML和DDL语句,  
,  
|  
|语法问题|  
|
||  
|mysql在start transaction开启以后，并不会更改session.autocommit的值,eg：,set @@session.autocommit=1;    
  select @@session.autocommit;,start transaction;,插入数据等,commit；/rollback,select @@session.autocommit; --值不会改变|  
|  
|  
|
||显式使用rollback|1、START TRANSACTION;,2、插入数据、结合DML和DDL语句,3、ROLLBACK；,4、S2查询结果不包含  插入数据  ，事务成功回滚,  
,事务：    
  设置事务临时保存点：    
  SAVEPOINT TRANSFER_MONEY    
  ----- 执行一些SQL操作    
  ROLLBACK TO SAVEPOINT TRANSFER_MONEY;    
  回到事务临时保存点，不会回滚事务临时保存点之前的数据    
  执行COMMIT/ROLLBACK所有保存点都会释放|  
|  
|  
|
||客户端结束连接|yashan:,1、START TRANSACTION;,2、插入数据,3、close session1,4、S2查询结果包含  插入数据  ，未提交的事务在客户端登出时被提交,切mysql|  
|  
|  
|
|||Mysql:,1、START TRANSACTION;,2、插入数据,3、close session1,4、S2查询结果不包含  插入数据  ，未提交的事务在客户端登出时没有被提交|切换模式的时候，未提交的事务行为按照新模式的提交方式进行处理,  
,切换后START TRANSACTION;|  
|  
|
|||Mysql:,1、autocommit 为1/0/START TRANSACTION;,2、插入数据、结合DML和DDL语句,3、session1 执行 start transaction,4、S2查询结果包含  插入数据  ，未提交的事务在客户端登出时被提交,没有commit和rollback，再执行一次start transaction;     
  相当于 执行先 commit;再执行start transaction;|  
|  
|  
|
|||START TRANSACTION;,过后修改autocommit值以及切换mysql模式|  
|  
|  
|
|||yashan和mysql隔离级别不同|  
|  
|  
|


3.3 经分析不涉及专项测试

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

# 多个session异步执行sql时，当前session1处于等待的状态下，切换到另外一个session2继续执行



说明：

1.注解说明：

**@newSess node1 s1**  ;      创建新session   

**@getSess s1;   **                     连接已创建的一个session

**@closeSess s1**  ;       关闭session s1：

**@subSess s2 { update tablex set f1=1; }; **      { }中的  ** **  **update tablex set f1=1;**  执行时会处于等待不结束状态，因为它要等session s1执行commit后才能结束，所以要启动子线程执行它，主线程会往后执行

**@getSess s1 {commit;}; **        切换到session s1，并执行commit语句，commit后时s2中的  ** **  **update tablex set f1=1;**  会结束执行

**@sessOut s2; **     **切换到session s2，**  获取上面@subSess s2执行的  ** **  **update tablex set f1=1;**  的执行结果

3..整个用例执行完后，也会自动关闭所有session

**备注：用了@newSess的用例中，不能用@conn，因为@conn会关闭之前创建的session，@newSess则不会关闭创建的session**

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


  


## Attachments:

[image2024-7-16_19-43-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjFhMWFkOWEzMzExZGM5NmYyIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.Pr0YRIIPEfE77X8kOtG4WI3zUuZyCz3ycEv8gTz_hBk)

 (image/png)    


[image2024-8-9_15-56-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjE4OTcwYzJhZjRmNTIxODdmIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.HEyZfr0gPQPlqdVfIJiHOJaE_nse5stlkRvL81QBCcA)

 (image/png)    


[image2024-8-12_18-23-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjE4OTcwYzJhZjRmNTIxODgwIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.Y6Eo4-Px7vxn-59yurSWVlRos9t6J8Zm2tmBMcEkp04)

 (image/png)    


[image2023-12-11_18-7-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjFhMWFkOWEzMzExZGM5NmYzIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.n_GtA2e8LfatkOA6ITwwKB4-T-zTHxY8zHneuPMJBL8)

 (image/png)    


[image2024-8-12_20-5-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjJhMWFkOWEzMzExZGM5NmY0IiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.cxAzlalcW72M43jRWVsu_0a0bo09JTelhvSysVcysEg)

 (image/png)    


[image2024-8-12_20-43-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjI4OTcwYzJhZjRmNTIxODgxIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.aRhU2SzW34XTS4yjTHJGm0wlumw55t7sH0NDZSXYgF4)

 (image/png)    


[image2024-8-12_21-13-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjI4OTcwYzJhZjRmNTIxODgyIiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.ELBSrW1-XiEUzcVi3Gs-1d1v0uLXqEw1ZO4ERSAaTYk)

 (image/png)    


[image2024-8-12_21-14-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjJhMWFkOWEzMzExZGM5NmY1IiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.eMkn2Ca9fftv76iCKmcmN_n25_PNE9fOjsW4dfcfgXA)

 (image/png)    


[image2024-8-12_21-19-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjJhMWFkOWEzMzExZGM5NmY2IiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.j1NR0aDwERY_CngbAxhezcCbq_ijOeoqJ2ov8BOtHgY)

 (image/png)    


[image2024-8-12_21-21-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjJhMWFkOWEzMzExZGM5NmY3IiwicmVmX2lkIjoiNjczOTZlNjE1OTNmOTljOWZmMjM4NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjk1LCJleHAiOjE3ODI0NTgwOTV9.mi0Mj3iNq2ig6CzDZQeumkfHs1h-DpwvoOS-aaAOewM)

 (image/png)    
