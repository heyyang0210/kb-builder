Created by 陈瑞, last modified on 十一月 14, 2024

# **1. 概述**

支持MySQL兼容模式下，系统权限管理，复用YASHAN的已有的权限能力。

SR:  [https://pingcode.yasdb.com/pjm/items/670dce72e489dd0868f779f4?](https://pingcode.yasdb.com/pjm/items/670dce72e489dd0868f779f4?)  

#YDBRD-34152 【mysql兼容】支持MySQL系统权限管理

调研文档：    [【YDBRD-34154】【mysql兼容】支持MySQL系统权限管理系统级权限 测试调研 - YashanDB - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=171081535)  

# **2. 需求分析**

## **2.1 需求来源：**

1、当前YashanDB的权限分为系统级权限、对象级权限。

1. yashan系统级权限：用于控制一系列系统级操作的权限，  如表的DDL、表空间等操作；系统级权限大多数不涉及具体的对象，而代表了允许一类操作。grant命令对于全局参数
1. mysql系统级权限：指某个用户（或角色）拥有某个特定权限后，可以在数据库上执行相应的操作，而不需要关心该操作实际发生的关系模式范围。


  


2、yashan/oracle代表的一类数据库，和mysql代表的一类数据库。user和schema的含义不同

1. **yashan / oracle**  ：user和schema 是同义词
1. **mysql：**    
  user：user下没有任何对象,可以连接到 MySQL 数据库并执行操作的实体。每个用户都有一个用户名和密码    
  schema和database是同义词：没有连接权限。可创建对象在schema下


那么。mysql的系统级权限语法为指定所有的   库.表   与 yashan的系统级别权限对应。

  


比如同样对user1赋权    [](https://conf.yasdb.com/pages/resumedraft.action?draftId=177832885&draftShareId=d98928de-08aa-4a3b-9691-38f16ea291b6&)  

          mysql：GRANT delete ON   *** . * **   TO user1;    -->    yashan：GRANT delete   any   table to user1

          mysql：GRANT create tablespace ON   *** . * **   TO user1;    -->    yashan：GRANT create tablespace to user1;

复用YASHAN的已有的权限能力

  


3、但是mysql中的系统权限 和 yashan的权限映射有差异需要对应起来，另外mysql和yashan的有一些各自独有的权限。需要在本次测试中对比实现是否符合预期

## **2.2 功能点分析**

**1、语法执行正常，**  **行为与MySQL对齐**  **，对于mysql支持但是yashan不支持的权限，设置时报错非法的权限类型**

GRANT   *priv_type*   ON  *.*  TO   *user*   [WITH GRANT OPTION ];

REVOKE   *priv_type *  ON *.* FROM   *user*  ;

  


**2、视图正常**

系统权限在mysql.user，information_schema.user_privileges视图中显示正常。  名称与MySQL对齐

设置成功字段值为Y,未设置或取消权限为N

information_schema.user_privileges，user显示正确

- GRANTEE：  授予权限的用户。
- TABLE_CATALOG：  数据库目录。
- PRIVILEGE_TYPE：  权限类型，如     SELECT  ,     INSERT  ,     UPDATE     等。
- IS_GRANTABLE：  当前用户拥有的权限是否可以被再授予给其他用户


  


**3、**  **schema级权限，名称与行为与MySQL对齐。   --旧用例覆盖，未覆盖到的补齐    **

支持了DROP、ALTER ROUTINE、TRIGGER、Index权限

mysql.db，information_schema.schema_privileges视图中显示正常

- DROP 对应的是DROP ANY TABLE 和 DROP ANY VIEW 权限；
- TRIGGER   该权限代表允许创建，删除，执行，显示触发器的权限 
- ALTER ROUTINE 对应的是ALTER ANY  PROCEDURE权限；
- INDEX 对应的是 DROP ANY INDEX 和 CREATE ANY INDEX；
- CREATE VIEW 行为需要 CREATE VIEW + SELECT 权限， DROP VIEW 需要 DROP 权限。  如果是 create or replace view 行为需要drop view权限


  


## 2.3 应用场景

## 2.3 规格约束

# 3. 详细测试设计

## 3.1 测试设计方法

1、对于yashan支持的权限，本次也支持。

对于系统管理类的权限，直接  验证；对于对象类的系统权限，  在兼容模式下，创建两个database(schema)，分别包含不同对象。

- 赋权后验证，执行对应sql在两个database正确
- 撤销后验证，执行对应sql在两个database报错


2、对于yashan不支持的  PRIVILEGE_TYPE  ，mysql兼容做无效等价类测试。

3、与schema级别授权交互。只revoke 部分权限，或者部分库

4、mysql的其他差异点确认

- 相同重复授权/撤销不报错  --对齐
- 支持一次给多个user授权 --暂不支持
- 一次授权多个权限    已有sr，待支持后后续sr做加固测试  --暂不支持
- 可选项 WITH {GRANT OPTION] 是否支持 
-    *.    *  中间有空格也可，是否是mysql bug？  --保持差异
- 直接user插入user的一行？是否支持 --不支持
- show privileges，show grants 是否支持 --不支持


5、权限什么时候生效。

     不切换用户查看，登录用户查看

## 3.2 详细测试设计

  


**以下每个 privilege_type ;**

**grant 后执行sql验证成功，查看视图**  **information_schema.user_privileges，mysql.user显示正确;**

**revoke 后执行sql验证失败，查看视图information_schema.user_privileges，mysql.user显示正确;**

**对于对象类的系统权限，在两个库都验证执行一次。确保其全局性**

  


|**privilege_type**|含义|映射|备注|测试sql(  sys schema除外  )|
|---|---|---|---|---|
|**ALL/ALL PRIVILEGES**|允许所有权限|1、revoke ALL [PRIVILEGES]，mysql是会把所有之前赋过的权限都 回收，yashan ALL [PRIVILEGES]。,  
|保持差异|1、以下sql,2、revoke 后收回所有权限。,3、重复授权不报错,  
,  
|
|**CREATE USER**|该权限代表允许创建、修改、删除、重命名user的权限|CREATE USER,ALTER USER,DROP USER|  
,一对多|1、create user,2、alter user ,3、drop user,4、重命名|
|**GRANT OPTION**|允许用户授予自己拥有的权限|不支持,mysql代表的含义是，  允许用户授予自己拥有的所有权限(已拥有的和将来拥有的)，yashan 使用 with  admin option，代表可授予   *priv_type1*    权限给其他用户|\|1、grant   **GRANT OPTION xxxx   --支持**,2、with   **GRANT OPTION  --后面sr支持**|
|**SUPER**|超级权限，允许用户执行一些管理操作，如终止线程、设置全局系统变量等|不支持|\|报错|
|**RELOAD**|允许用户刷新表和日志|不支持|\|报错|
|**SHUTDOWN**|允许用户关闭 MySQL 服务器|不支持|\|报错|
|**PROCESS**|允许用户查看所有线程的运行状态|不支持|\|报错|
|**FILE**|允许用户读写文件|File|\|报错|
|**SELECT**|从表中查看数据，而且select权限在执行update  /  delete   语句中含有where条件的情况下也是需要的|READ ANY TABLE|保持差异,delete/update的where条件里的表也不检查read权限，已落需求。待yashan支持|1、不加锁的查询,2、加锁查询报错|
|**INSERT**|该权限代表是否允许在表里插入数据，同时在执行analyze table,optimize table,repair table语句的时候也需要insert权限|INSERT ANY TABLE|  
|analyze table --后面适配,optimize table,repair table语句的时候也需要insert权限。做的时候再对齐|
|**UPDATE**|允许用户更新表中的数据|UPDATE ANY TABLE|对齐|  
|
|**DELETE**|允许用户删除表中的数据|DELETE ANY TABLE|对齐|  
|
|**CREATE**|该权限代表允许创建新的数据库和表的权限|1、CREATE ANY TABLE,2、YASHAN不支持create database的权限管理|一对多，,但yashan不支持部分|1、create table,2、create schema|
|**DROP**|该权限代表允许删除数据库、表、视图的权限，包括truncate table命令|1、DROP ANY TABLE,2、DROP ANY VIEW,3、yashan没有 DATABASE的权限|对齐|1、drop 表,2、drop 视图,3、truncate 表,4、drop schema |
|**ALTER**|该权限代表允许修改表结构的权限， 如果是rename表名，则要求有alter和drop原表，create和insert新表的权限|ALTER ANY TABLE|对齐|alter table drop index --需要alter 权限不需要drop index权限,  
,rename 表需要有rename表名，则要求有alter和drop原表，create和insert新表的权限。做rename需求的时候对齐|
|**INDEX**|允许创建或删除索引|create ANY index ,drop ANY index|对齐|1、删除索引,2、创建索引|
|**CREATE VIEW**|允许创建视图|CREATE ANY   VIEW|对齐|1、create view       需要select + create view 权限,2、create or replace   需要select + create view + drop权限|
|**SHOW VIEW**|允许使用show create view语句|不支持|\|报错|
|**SHOW DATABASES**|允许用户查看所有数据库|不支持，默认设置为Y|\|报错|
|**LOCK TABLES**|该权限代表允许对拥有select权限的表进行锁定，以防止其他链接对此表的读或写|不支持|\|报错|
|**REFERENCES**|允许用户在表上创建外键约束|不支持|\|报错|
|**CREATE TEMPORARY TABLES**|允许创建临时表|不支持|\|报错|
|**EXECUTE**|该权限代表允许执行存储过程和  函数  的权限|EXECUTE ANY PROCEDURE|对齐|1、执行存储过程,2、执行函数|
|**REPLICATION SLAVE**|用于建立复制时所需要用到的用户权限|不支持|\|报错|
|**REPLICATION CLIENT**|该权限代表允许执行show master status  ,  show slave status  ,  show binary logs命令|不支持|\|不支持|
|**CREATE ROUTINE**|该权限代表允许创建存储过程、  函数  的权限|CREATE ANY PROCEDURE|对齐|1、创建存储过程,2、创建函数|
|**ALTER ROUTINE**,  
|允许修改存储过程，  函数|ALTER ANY PROCEDURE|对齐|1、修改存储过程,2、修改函数|
|**EVENT**|允许使用事件|不支持|\|报错|
|**TRIGGER**|该权限代表允许创建，删除，执行，显示触发器的权限|CREATE ANY TRIGGER,ALTER ANY TRIGGER,DROP ANY TRIGGER|一对多|1、创建,2、删除,3、执行触发器|
|**CREATE_TABLESPACE**|该权限代表允许创建、修改、删除表空间和  日志组  的权限|CREATE TABLESPACE,ALTER TABLESPACE,DROP TABLESPACE|一对多|CREATE TABLESPACE|


  


schema级别，  mysql.db，information_schema.schema_privileges视图中显示正常，名称跟mysql对齐。覆盖  *  和  schema.* 两种。

|**privilege_type**|含义|映射|备注|测试sql(  sys schema除外  )|
|---|---|---|---|---|
|**ALTER ROUTINE**|允许修改存储过程，  函数|ALTER ANY PROCEDURE|对齐|1、修改存储过程,2、修改函数|
|**TRIGGER**|该权限代表允许创建，删除，执行，显示触发器的权限|CREATE ANY TRIGGER|一对多|1、创建,2、删除,3、执行触发器|
|**DROP**|该权限代表允许删除数据库、表、视图的权限，包括truncate table命令|DROP ANY TABLE,DROP ANY VIEW,yashan没有 DATABASE的权限|对齐|1、drop 表,2、drop 视图,3、truncate 表|
|**CREATE VIEW**|允许创建视图|CREATE ANY   VIEW|对齐|  
|
|**INDEX**|允许创建或删除索引|create index ,drop index|对齐|1、删除索引,2、创建索引|


  


公共场景

|序号|测试点|预期|
|---|---|---|
|**1**|重复授权/重复撤销不报错,- 系统级/schema级别语句分别重复授权/撤销 
- 授予/撤销统级别权限，再授予/撤销schema权限(  *  和  schema.* ）
- 授予/撤销schema授权，再授予/撤销系统级别权限，对象级权限
|对象级权限  报错，其余不报错,  
|
|**2**|语法：授予系统权限时,1、指定列权限 + * . *  或  * 或 schema . * 报错,  
,2、指定系统权限 + 对象类型关键字(table/function/procedure) 报错,如 grant  xxx on   function   *.* to admin,  
,3、*.* 中间有空格或多个空格，mysql不报错|  
,1、报错,  
,2、grant  on   table   *.* to admin    --不报错,其余两种报错,  
,3、保持差异,  
,  
,  
|
|  
|yashan不支持的权限，不对齐。即不做权限控制。,赋权时报错，执行对应sql行为时，不报权限错误。,1、  **SHOW VIEW**,2、  **SHOW DATABASES**,3、  **SHUTDOWN**,4、  **REFERENCES**,5、  **LOCK**,6、  **临时表  --sql行为不支持报错**,  
|  
|
|**3**|1、create role 成功，但是授权给role报错，把role授权 给user不报错。|  
|
|**4**|testkill：,并发授系统级 +  SCHEMA级 + sql行为  |  
|
|**5**|HA:,授权/撤销后在备机验证正常，视图同步正常,同样的sql，grant完成功，revoke 完失败。在备机验证。--查询|1、系统级别,2、schema级别|
|**6**|shutdown的判断是否是dba，sys, 或oper用户，跟mysql行为不一致,1、新用户无shutdown权限|保持差异|
|**7**|授权系统级权限，mysql兼容下，sys用户是否受影响|  
|


  


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|是|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

  [mysql兼容支持系统级权限.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZWZlNDVhMWFkOWEzMzExZGUzNTY0IiwicmVmX2lkIjoiNjczOTZmMDM3MjgyMDZlZmI5MmYyZjk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4OTQzLCJleHAiOjE3ODI1NDUzNDN9.u0Zc2suinkNucbtf3q2QSpm84JNyTLp2j_Wsx-B-9Ho)    [冒烟.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZWZlNDg4OTcwYzJhZjRmNTNiNzA3IiwicmVmX2lkIjoiNjczOTZmMDM3MjgyMDZlZmI5MmYyZjk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4OTQzLCJleHAiOjE3ODI1NDUzNDN9.pUmab57mH605ejlnd6dIT1Z_N30ubSpMJDwtt3kWXZo)  

# 5. 测试框架设计

- yasft


# 6. 测试环境说明

# 7. 工作量评估

工作量：10  *人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Comments:

|  [](null)  ,与会人：史鑫，张鹏飞，郑荃，李子怡，陈瑞，冯皓博,会议主题：基于脏页数量的数据库流控机制 测试评审    
  会议时间：2024/11/4 17:00-18:43 (GMT+08:00) 中国标准时间 - 北京    
  评审纪要信息：,测试设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=177832879](https://conf.yasdb.com/pages/viewpage.action?pageId=177832879)  ,差异点对齐：    
  1、如果是 create or replace view 行为需要CREATE VIEW + SELECT + drop view权限. --chenrui    
  2、mysql是会把所有之前赋过的权限都 回收，yashan ALL [PRIVILEGES]。 --chenrui    
  3、GRANT OPTION 崖山不支持 --陈瑞    
  4、create/drop database/schema 崖山没有    
  5、grant on table *.* to admin --可以带table     
  6、把role授权 给user报错不合理 --张鹏飞    
  7、测试点补充，同样的sql，grant完成功，revoke 完失败，在备机验证。--主要是查询 --史鑫,  
  结论：    
  1、对齐    
  2、revoke ALL 在后面sr支持后再支持    
  3、grant GRANT OPTION xxxx --支持 with GRANT OPTION --后面sr支持，具体表现在测试时候对齐，如果不好做不做    
  4、对齐要做    
  5、这个点不重要，可能是mysql的bug    
  6、把role授权 给user不拦截    
  7、加上测试点,评审通过与否：通过,Posted by chenrui at 十一月 04, 2024 19:35|
|---|
|  [](null)  ,发现mysql 8 给了drop 权限也不能drop 自己创建的view[图片],Posted by chenrui at 十一月 12, 2024 20:22|


