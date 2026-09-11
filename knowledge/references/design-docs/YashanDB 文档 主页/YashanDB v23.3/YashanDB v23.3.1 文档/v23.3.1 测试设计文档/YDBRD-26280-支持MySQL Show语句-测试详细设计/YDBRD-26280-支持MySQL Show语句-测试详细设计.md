Created by 孟麟, last modified on 九月 25, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/66191587fd997db58ad89342](https://pingcode.yasdb.com/pjm/items/66191587fd997db58ad89342)    ?    
  #YDBRD-26280 支持MySQL Show语句

范围：

SHOW CHARSET    
  SHOW CHARACTER SET    
  SHOW COLUMNS FROM `test`.`test_view`    
  SHOW COLLATION    
  SHOW CREATE PROCEDURE `test`.`TEST_PRO`    
  SHOW CREATE VIEW `test_view`    
  SHOW CREATE TABLE `test`.`test`    
  SHOW CREATE DATABASE test    
  SHOW CREATE DATABASE IF NOT EXISTS `mysql`    
  SHOW CREATE TRIGGER test1.TEST    
  SHOW DATABASES    
  SHOW ENGINES    
  show fields from `columns_priv`    
  SHOW FULL COLUMNS FROM `newtable`    
  SHOW FULL PROCESSLIST    
  SHOW FULL TABLES FROM TEST1    
  SHOW FULL TABLES WHERE Table_type = 'VIEW'    
  SHOW FULL TABLES FROM test1 WHERE Tables_in_test1 = 'newtable'    
  SHOW FUNCTION STATUS WHERE Db = 'test'    
  SHOW PROCEDURE STATUS WHERE Db = 'test'    
  SHOW PROCESSLIST    
  SHOW INDEX FROM `newtable`    
  SHOW GLOBAL STATUS    
  SHOW GLOBAL VARIABLES    
  SHOW GRANTS FOR 'yasdb'@'192.168.132.53'    
  SHOW MASTER STATUS    
  SHOW PLUGINS    
  SHOW TRIGGERS LIKE 'user'    
  SHOW TABLE STATUS    
  SHOW STATUS    
  SHOW SLAVE STATUS    
  SHOW TABLES    
  SHOW TABLE STATUS LIKE    
  SHOW TABLE STATUS FROM test    
  SHOW TABLE STATUS FROM test1 LIKE 'newtable'    
  SHOW VARIABLES    
  SHOW VARIABLES LIKE 'lower_case_table_names'    
  SELECT CURRENT_USER();    
  SELECT DATABASE()

## 1.1相关文档

开发文档：    [特性设计-YDBRD-26280：支持MySQL show语句设计文档](159428547.html)  

测试调研：    [YDBRD-26280-支持MySQL Show语句-调研](https://conf.yasdb.com/pages/viewpage.action?pageId=156138261)  

# 2. 需求分析

## 2.1 功能点分析

1、功能支持：支持的语法与mysql完全一致，结果为真实结果，列和列值与mysql一致(记录数量可能不一致)，部分列值只语法兼容（见下表'列说明'），列值为固定值

2、语法支持：支持的语法与mysql完全一致，结果为真实结果，列和列值与mysql差异较大

|  
|show 语句|yashan支持情况|实现（改写）方式|列说明|
|---|---|---|---|---|
|1|SHOW CHARSET|功能支持|select CHARSET `Charset`, DESCRIPTION `Description`, `DEFAULT COLLATION` `Default collation`, MAXLEN `Maxlen` from V$CHARSET|  
|
|2|SHOW CHARACTER SET|功能支持|同上|  
|
|3|SHOW COLUMNS FROM `test`.`test_view`|功能支持|select COLUMN_NAME Field, COLUMN_TYPE Type,[, COLLATION_NAME Collation],, IS_NULLABLE, COLUMN_KEY , COLUMN_DEFAULT, EXTRA[, PRIVILEGES, COLUMN_COMMENT] from INFORMATION_SCHEMA.COLUMNS|  
|
|4|SHOW COLLATION|功能支持|select COLLATION `Collation`, CHARSET `Charset`, ID `Id`, `DEFAULT` `Default`, `COMPILED` `Compiled`, SORTLEN `Sortlen` from V$COLLATION|  
|
|5|SHOW CREATE PROCEDURE|功能支持|select S.NAME AS `PROCEDURE`, 'NULL' AS SQL_MODE, S.TEXT AS CREATE_PROCEDURE, 'no_corresponding_col' AS    
  CHARACTER_CLIENT, 'no_corresponding_col' AS COLLATION_CONNECTION, 'no_corresponding_col' AS DATABASE_COLLATION    
  FROM dba_source S WHERE S.NAME = 'TEST_PRO' AND S.TYPE = 'PROCEDURE';|语法支持：SQL_MODE,CHARACTER_CLIENT,COLLATION_CONNECTION,DATABASE_COLLATION|
|6|SHOW CREATE VIEW|功能支持|SELECT TABLE_NAME VIEW, VIEW_DEFINITION CREATE_VIEW, CHARACTER_SET_CLIENT, COLLATION_CONNECTION FROM    
  information_schema.views where TABLE_SCHEMA ='db' and TABLE_NAME='v1';|语法支持：,CHARACTER_SET_CLIENT,COLLATION_CONNECTION|
|7|SHOW CREATE TABLE|功能支持|select '%s' as `Table`, to_char(dbms_metadata.get_ddl('table', '%s')) from dual|  
|
|8|SHOW CREATE DATABASE,SHOW CREATE DATABASE     **IF NOT EXISTS**|**语法支持**|CREATE DATABASE + 'db_name'|  
|
|9|SHOW CREATE TRIGGER|功能支持|SELECT TRIGGER_NAME,SQL_MODE,ACTION_STATEMENT    
  SQL_ORIGINAL_STATEMENT,CHARACTER_SET_CLIENT,COLLATION_CONNECTION,DATABASE_COLLATION,CREATED FROM    
  information_schema.triggers WHERE TRIGGER_NAME='product_insert_trigger' and TRIGGER_SCHEMA='db';|语法支持：SQL_MODE,CHARACTER_CLIENT,COLLATION_CONNECTION,DATABASE_COLLATION|
|10|SHOW DATABASES|**语法支持**|显示当前的database|  
|
|11|SHOW ENGINES|**语法支持**|计划：SELECT ENGINE, SUPPORT, COMMENT, TRANSACTIONS, XA, SAVEPOINTS FROM information_schema.ENGINES;,实际：heap、lsc、tac|  
|
|12|show fields from `columns_priv`|功能支持|同#3|  
|
|13|SHOW FUNCTION STATUS WHERE Db = 'test'|功能支持|select O.owner `Db`, O.object_name `Name`, O.object_type `Type`, O.owner `Definer`, LAST_DDL_TIME `Modified`,    
  CREATED `Created`, AUTHID `Security_type`, 'NULL' `Comment`, 'no_corresponding_col' AS `character_set_client`,    
  'no_corresponding_col' AS `collation_connection`, 'no_corresponding_col' AS `Database Collation` from DBA_OBJECTS O left    
  join DBA_PROCEDURES P on O.OBJECT_NAME = P.OBJECT_NAME where O.object_name = '' and OBJECT_TYPE = 'FUNCTION'|语法支持：Comment,character_set_client,collation_connection,Database Collation|
|14|SHOW PROCEDURE STATUS WHERE Db = 'test'|功能支持|select O.owner `Db`, O.object_name `Name`, O.object_type `Type`, O.owner `Definer`, LAST_DDL_TIME `Modified`,    
  CREATED `Created`, AUTHID `Security_type`, 'NULL' `Comment`, 'no_corresponding_col' AS `character_set_client`,    
  'no_corresponding_col' AS `collation_connection`, 'no_corresponding_col' AS `Database Collation` from DBA_OBJECTS O left    
  join DBA_PROCEDURES P on O.OBJECT_NAME = P.OBJECT_NAME where O.object_name = '' and OBJECT_TYPE = 'PROCEDURE'|语法支持：Comment,character_set_client,collation_connection,Database Collation|
|15|SHOW PROCESSLIST|功能支持|SELECT * FROM INFORMATION_SCHEMA.PROCESSLIST|  
|
|16|SHOW INDEX|功能支持|select TABLE_NAME,non_unique,index_name    
  key_name,seq_in_index,column_name,collation,CARDINALITY,SUB_PART,PACKED,nullable,INDEX_TYPE,COMMENT,INDEX_COMMENT    
  from information_schema.STATISTICS WHERE TABLE_NAME = 't1';|  
|
|17|SHOW GLOBAL STATUS|**语法支持**|select v$    [sysstat.name](http://sysstat.name)     `Variable_name`, v$sysstat.value `Value` from v$sysstat|  
|
|18|SHOW GLOBAL VARIABLES|功能支持|select NAME `Variable_name`, DEFAULT_VALUE `Value` from v$parameter|  
|
|19|SHOW GRANTS FOR 'yasdb'@'192.168.132.53'|**语法支持**|SELECT OWNER, PRIVILEGE FROM DBA_TAB_PRIVS WHERE OWNER =|结果与mysql不一致，不是拼接授权语句，而是分行打印用户的所有权限|
|20|SHOW MASTER STATUS|**语法支持**|  
|  
|
|21|SHOW PLUGINS|**语法支持**|  
|  
|
|22|SHOW TRIGGERS|功能支持|SELECT TRIGGER_NAME, EVENT_MANIPULATION EVENT, EVENT_OBJECT_TABLE TABLE_NAME, ACTION_STATEMENT STATEMENT,    
  ACTION_TIMING TIMING, CREATED, SQL_MODE, DEFINER, CHARACTER_SET_CLIENT, COLLATION_CONNECTION,    
  DATABASE_COLLATION FROM information_schema.TRIGGERS where TRIGGER_SCHEMA='db'|语法支持：SQL_MODE,CHARACTER_CLIENT,COLLATION_CONNECTION,DATABASE_COLLATION|
|23|SHOW TABLE STATUS|功能支持|select T.TABLE_NAME `Name`, ENGINE `Engine`, VERSION `Version`, ROW_FORMAT `Row_format`, TABLE_ROWS `Rows`, AVG_ROW_LENGTH `Avg_row_length`, DATA_LENGTH `Data_length`,    
  MAX_DATA_LENGTH `Max_data_length`, INDEX_LENGTH `Index_length`, DATA_FREE `Data_free`, AUTO_INCREMENT `Auto_increment`, CREATE_TIME `Create_time`,     
  UPDATE_TIME `Update_time`, CHECK_TIME `Check_time`, TABLE_COLLATION `Collation`, CHECKSUM `Checksum`, CREATE_OPTIONS `Create_options`, TABLE_COMMENT `Comment`     
  from INFORMATION_SCHEMA.TABLES T left join DBA_TABLES DT ON T.TABLE_NAME = DT.TABLE_NAME where OWNER =|  
|
|24|SHOW STATUS|**语法支持**|global ：select v$    [sysstat.name](http://sysstat.name)     `Variable_name`, v$sysstat.value `Value` from v$sysstat,session：select v$    [sysstat.name](http://sysstat.name)     `Variable_name`, v$sysstat.value `Value` from v$sysstat where SID = |  
|
|25|SHOW SLAVE STATUS|**语法支持**|  
|  
|
|26|SHOW TABLES|功能支持|select TABLE_NAME AS TABLES_IN_ , Table_type from INFORMATION_SCHEMA.TABLES|  
|
|27|SHOW VARIABLES|功能支持|global： select NAME `Variable_name`, DEFAULT_VALUE `Value` from v$parameter,session：select NAME `Variable_name`, VALUE `Value` from v$parameter|  
|
|28|SELECT CURRENT_USER();|功能支持|SELECT SYS_CONTEXT('USERENV', 'SESSION_USER') `  CURRENT_USER()  ` FROM DUAL;|  
|
|29|SELECT DATABASE()；|功能支持|SELECT SYS_CONTEXT('USERENV', 'DB_NAME') `  DATABASE()  ` FROM DUAL;|  
|


## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

见功能表说明

# 3. 详细测试设计

## 3.1 测试设计方法

测试点分析采用边界值、等价类和场景分析等测试设计工程方法

## 3.2 详细测试设计

1、公共

|测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|show命令|语句语法|  
|按语法图覆盖|1、功能支持：执行结果正确，列和列值与mysql一致,2、功能支持，部分列语法支持：执行结果正确，列和列值与mysql一致，语法支持的列为固定值,3、语法支持：语句不报错,4、带过滤条件,like 'pattern'中使用%和_,where expr：覆盖常用表达式类型|1、错误语法：,- 关键字缺失/错误
- db、tbl不存在
- like和where同时出现
- 结束时无';'
- 不支持带过滤的，带过滤报错
,2、非mysql模式下执行,3、mysql模式下未适配场景：plsql|1/2、执行报错，报错信息明确,3、无core、卡住等严重问题|
|  
|语句权限|  
|1、sys用户(DBA用户),2、普通用户，grant权限,3、对于无权限要求的，新建用户有创建session权限，无其他权限|1、执行成功，结果正确,2、执行成功，结果正确,3、无权限要求的：执行成功，结果正确|没有权限|执行报错，错误信息明确|


2、具体分析每个命令（除公共外需要关注的点）

|  
|show命令|功能|【mysql】权限要求|【yashan兼容】支持情况，权限|测试点分析（除公共外的）|
|---|---|---|---|---|---|
|1|SHOW CHARSET,SHOW CHARACTER SET|显示字符集,SHOW   {  CHARACTER     SET     |     CHARSET  }   [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|无|功能支持，无|无|
|2|SHOW COLLATION|显示全部字符序,SHOW     COLLATION     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ],过滤：SHOW COLLATION like 'latin1%';,SHOW COLLATION WHERE Charset = 'latin1';|无|功能支持，无|无|
|3|SHOW COLUMNS FROM `test`.`test_view`,show fields from `columns_priv`,SHOW FULL COLUMNS FROM `newtable`|显示表的列定义信息,SHOW     [  FULL  ]   {  COLUMNS     |     FIELDS  }   {  FROM     |     IN  }   *tbl_name*     [  {  FROM     |     IN  }   *db_name*  ]     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ],full 显示表列的更多信息,mysql column def：,|拥有该列权限（查询）,grant   **select**   on test_db01.* to regress;|功能支持，  无（崖山没有列权限）--得有表的权限？|1、列类型：典型类型，与yashan有差异类型（全部类型）,2、列限制：default、not null、primary key，unique，及组合，列注释,3、表：yashan模式创建的表和mysql模式创建的表，结合database(schema)、系统表、系统视图,4、非常多的列（上千）|
|4|SHOW CREATE PROCEDURE `test`.`TEST_PRO`|显示存储过程的定义,SHOW     CREATE     PROCEDURE     *proc_name*|指定的用户    `DEFINER`    或有mysql.proc表的SELECT权限|功能支持  **+部分列语法支持**,权限：all_source，只查当前用户可访问的资源信息|1、覆盖部分典型建存储过程语句|
|5|SHOW CREATE VIEW `test_view`|显示视图的定义,SHOW     CREATE     VIEW     *view_name*|show view权限，以及select相关视图权限|功能支持  **+部分列语法支持**,权限：INFORMATION_SCHEMA.VIEWS的select权限是  public|1、覆盖部分典型建视图语句|
|6|SHOW CREATE TABLE `test`.`test`|显示表定义,SHOW     CREATE     TABLE     *tbl_name*|具有表的select权限|功能支持  （暂时与mysql结果没对齐：生成的语句还不能在mysql创建成功）  --9.25，已对齐,权限：只查当前用户权限|1、覆盖部分典型建表语句,——覆盖：各类key、注释、check、lsc/tac/临时表、复杂表（所有数据类型及各种定义方式）、1000+列的表、分区表（一级覆盖全部，二级覆盖1种）|
|7|SHOW CREATE DATABASE test,SHOW CREATE DATABASE   **IF NOT EXISTS**   `mysql`|显示database定义，database同义词schema,SHOW     CREATE   {  DATABASE     |     SCHEMA  }   [  IF     NOT     EXISTS  ]     *db_name*,显示database定义，包含if not exists|具有db的select权限|**语法支持，无**|1、覆盖部分典型建db语句|
|8|SHOW CREATE TRIGGER test1.TEST|显示触发器定义,SHOW     CREATE     TRIGGER     *trigger_name*|需要触发器及关联表的权限|功能支持  **+部分列语法支持**,权限：创建语句从SYS.DBA_TRIGGERS取，  要求有dba权限|1、覆盖部分典型建触发器语句|
|9|SHOW DATABASES|显示所有database,SHOW   {  DATABASES     |     SCHEMAS  }   [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|无|**语法支持，无**|1、覆盖典型的create database和schema语句|
|10|SHOW ENGINES|显示存储引擎,SHOW     [  STORAGE  ]     ENGINES|无|**语法支持，无**|无|
|11|SHOW PROCESSLIST,SHOW FULL PROCESSLIST|显示会话列表信息,SHOW     [  FULL  ]     PROCESSLIST,不使用FULL关键字， SHOW PROCESSLIST则仅显示字段中每个语句的前 100 个字符|- PROCESS权限可以查询所有
- 非匿名用户可以访问用户相关线程信息
- 匿名用户无权限
|功能支持，  INFORMATION_SCHEMA.PROCESSLIST，  public|1、多个用户连接,2、执行sql超长(>100)|
|12|SHOW TABLES,SHOW FULL TABLES FROM TEST1,SHOW FULL TABLES WHERE Table_type = 'VIEW',SHOW FULL TABLES FROM test1 WHERE Tables_in_test1 = 'newtable'|显示数据库中完整表信息，带full的多了类型,SHOW     [  FULL  ]     TABLES     [  {  FROM     |     IN  }   *db_name*  ]     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|只显示有权限的表信息|功能支持，INFORMATION_SCHEMA.TABLES   public|公共|
|13|SHOW FUNCTION STATUS WHERE Db = 'test'|显示数据库上的function信息,SHOW     FUNCTION     STATUS     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|所有者或select     `mysql.proc`    表权限|功能支持  **+部分列语法支持**,**权限：**  ALL_OBJECTS、ALL_PROCEDURES只查当前用户可访问的函数和过程体|1、覆盖典型function|
|14|SHOW PROCEDURE STATUS WHERE Db = 'test'|显示数据库上的存储过程信息,SHOW     PROCEDURE     STATUS     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|所有者或select     `mysql.proc`    表权限|功能支持  **+部分列语法支持**,**权限：同上**|1、覆盖典型procedure|
|15|SHOW INDEX FROM `newtable`|显示表上的索引信息,SHOW   {  INDEX     |     INDEXES     |     KEYS  }   {  FROM     |     IN  }   *tbl_name*     [  {  FROM     |     IN  }   *db_name*  ]     [  WHERE     *expr*  ]|表的select权限|功能支持，  INFORMATION_SCHEMA.STATISTICS，  public|1、创建不同类型的索引|
|16|SHOW GLOBAL STATUS,SHOW STATUS|显示全局|会话状态信息    
  SHOW     [  GLOBAL     |     SESSION  ]     STATUS     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|无，能连接服务器|**语法支持，**  v$sysstat|无|
|17|SHOW GLOBAL VARIABLES,SHOW VARIABLES,SHOW VARIABLES LIKE 'lower_case_table_names'|显示全局系统变量,SHOW     [  GLOBAL     |     SESSION  ]     VARIABLES     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|无，能连接服务器|功能支持，  v$system_parameter和v$parameter|无|
|18|SHOW GRANTS FOR 'yasdb'@'192.168.132.53'|显示用户权限,SHOW     GRANTS     [  FOR     *user*  ]|具有select mysql系统数据库的|**语法支持（显示内容与mysql较大差别，如下），权限呢？**,|1、不同权限的用户：dba、普通用户只连接权限、普通用户有其他权限|
|19|SHOW MASTER STATUS|显示主服务器的复制状态,SHOW     MASTER     STATUS|SUPER或 REPLICATION CLIENT特权|**语法支持（返回空集），无**|无|
|20|SHOW PLUGINS|显示所有插件信息,SHOW     PLUGINS|无|**语法支持（返回空集），无**|无|
|21|SHOW TRIGGERS LIKE 'user'|显示触发器,SHOW     TRIGGERS     [  {  FROM     |     IN  }   *db_name*  ]     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|有数据库及表的权限|功能支持  **+部分列语法支持**,information_schema.TRIGGERS   public|结合#8测试|
|22|SHOW TABLE STATUS,SHOW TABLE STATUS FROM test1 LIKE 'newtable',SHOW TABLE STATUS FROM test,SHOW TABLE STATUS LIKE|显示所有表详细信息  **（包含视图）**,SHOW     TABLE     STATUS     [  {  FROM     |     IN  }   *db_name*  ]     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|有数据库及表的权限|功能支持，  INFORMATION_SCHEMA.TABLES、  **ALL_TABLES**|结果中除了表外，还包含视图；结合#12测试|
|23|SHOW SLAVE STATUS|显示副本(备机)状态,SHOW     SLAVE     STATUS     [  FOR     CHANNEL     *channel*  ]|SUPER或 REPLICATION CLIENT特权|**语法支持（返回空集），无**|无|
|24|SELECT CURRENT_USER();|当前用户，  **内置函数**|NA|功能支持（返回当前用户），无|无|
|25|SELECT DATABASE()|当前database，  **内置函数**|NA|功能支持（返回当前用户），无|无|


  


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

工作量：3  *人天*

计划测试完成时间：

## Attachments:

[image2024-7-18_10-48-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjRhMWFkOWEzMzExZGM5NmZjIiwicmVmX2lkIjoiNjczOTZlNjQ1OTNmOTljOWZmMjM4NDMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNzg0LCJleHAiOjE3ODI0NTgxODR9.PpERGYuFhEtv3B5dki-QvWcVI6sY7nSx1e9zV0fSIz0)

 (image/png)    


[image2024-7-26_18-4-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjRhMWFkOWEzMzExZGM5NmZkIiwicmVmX2lkIjoiNjczOTZlNjQ1OTNmOTljOWZmMjM4NDMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNzg0LCJleHAiOjE3ODI0NTgxODR9.HS0Ft5caYF8R_ogiUtWcu8MC6yrsY1gBuZdO2fS9Ayc)

 (image/png)    


## Comments:

|  [](null)  ,测试设计评审,会议时间：2024/07/16 10:30~11:00,与会人：张鹏飞、林永豪、马士杰、孟麟,会议纪要：,1、show create table，当前设计方案中标注的‘功能支持’，实际与mysql不一致，后续dump支持后刷新预期,2、show create 类，与本身表、视图、触发器等复杂度关系不大，覆盖典型语句即可,Posted by menglin at 七月 16, 2024 17:44|
|---|
