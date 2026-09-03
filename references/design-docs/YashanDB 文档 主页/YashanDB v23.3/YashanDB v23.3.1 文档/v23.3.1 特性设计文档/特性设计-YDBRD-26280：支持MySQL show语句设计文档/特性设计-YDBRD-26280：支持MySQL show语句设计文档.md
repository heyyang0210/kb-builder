Created by 马士杰, last modified on 八月 27, 2024

详细设计-YDBRD26280

SR链接：    [https://pingcode.yasdb.com/pjm/items/66191587fd997db58ad89342](https://pingcode.yasdb.com/pjm/items/66191587fd997db58ad89342)    ?    
  #YDBRD-26280 支持MySQL Show语句

  


# 1.总述

支持MySQL兼容的  特定的运维&管理语法 （做语法兼容，暂不支持功能）

## 1.1 需求来源

MySQL兼容性支持

支持形态：单机

## 1.2 调研文档

调研文档见：    [支持MySQL show语句调研文档 - 马士杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159428292)  

  


## 1.3 需求分析

MySQL通过show语句展示各种信息，本需求对目前可以实现兼容的show语句实现功能兼容，对暂时不支持的仅实现语法兼容

本需求中支持的show语句列表如下：

  点击此处展开...

SHOW CHARSET;    
  SHOW CHARACTER SET;    
  SHOW COLUMNS FROM `test`.`test_view`;    
  SHOW COLLATION;    
  SHOW CREATE PROCEDURE `test`.`TEST_PRO`;    
  SHOW CREATE VIEW `test_view`;    
  SHOW CREATE TABLE `test`.`test`;    
  SHOW CREATE DATABASE test;    
  SHOW CREATE DATABASE IF NOT EXISTS `mysql`;    
  SHOW CREATE TRIGGER test1.TEST;    
  SHOW DATABASES; v$database    
  SHOW ENGINES;    
  show fields from `columns_priv`;    
  SHOW FULL COLUMNS FROM `newtable`;    
  SHOW FULL PROCESSLIST;    
  SHOW FULL TABLES FROM TEST1;    
  SHOW FULL TABLES WHERE Table_type = 'VIEW';    
  SHOW FULL TABLES FROM test1 WHERE Tables_in_test1 = 'newtable';    
  SHOW FUNCTION STATUS WHERE Db = 'test';    
  SHOW PROCEDURE STATUS WHERE Db = 'test';    
  SHOW PROCESSLIST;    
  SHOW INDEX FROM `newtable`;    
  SHOW GLOBAL STATUS;    
  SHOW SESSION STATUS;    
  SHOW GLOBAL VARIABLES;    
  SHOW SESSION VARIABLES;    
  SHOW GRANTS FOR 'yasdb'@'192.168.132.53';    
  SHOW MASTER STATUS;    
  SHOW PLUGINS;    
  SHOW TRIGGERS LIKE 'user';    
  SHOW TABLE STATUS;    
  SHOW STATUS;    
  SHOW SLAVE STATUS;    
  SHOW TABLES;    
  SHOW TABLE STATUS LIKE;    
  SHOW TABLE STATUS FROM test;    
  SHOW TABLE STATUS FROM test1 LIKE 'newtable';    
  SHOW VARIABLES;    
  SHOW VARIABLES LIKE 'lower_case_table_names';    
  SELECT CURRENT_USER();    
  SELECT DATABASE();

  


# 2.接口

本需求新增的接口主要用于将show语句重新解析成yashan能识别的select语句

1.myParseShow

从myParseSqlCmd进入，读取到show这个关键字后进入，所有的show语句的解析都从这里进入

2.根据读到的后一个词选择对应的parse函数，具体函数见规格

3.新增视图 v_$mysql_variables 记录MySQL模式下的session变量

v_$mysql_global_variables记录MySQL模式下的global变量

  


# 3.规格与约束

由于部分视图和功能未支持，所以规格和MySQL会存在很多不同

|show 语句|MySQL语法|yashan支持情况|改写方法|改写函数|备注|权限|
|---|---|---|---|---|---|---|
|SHOW CHARSET|显示字符集,SHOW     {  CHARACTER     SET     |     CHARSET  }     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|select CHARSET `Charset`, DESCRIPTION `Description`, `DEFAULT COLLATION` `Default collation`, MAXLEN `Maxlen` from V$CHARSET|myShowCharset|  
|无|
|SHOW CHARACTER SET|同上|功能支持|  
|  
|  
|无|
|SHOW COLUMNS FROM `test`.`test_view`|显示表的列定义信息,SHOW     [  FULL  ]     {  COLUMNS     |     FIELDS  }     {  FROM     |     IN  }     *tbl_name*     [  {  FROM     |     IN  }     *db_name*  ]     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|select COLUMN_NAME Field, COLUMN_TYPE Type,[, COLLATION_NAME Collation],, IS_NULLABLE, COLUMN_KEY , COLUMN_DEFAULT, EXTRA[, PRIVILEGES, COLUMN_COMMENT] from INFORMATION_SCHEMA.COLUMNS|myShowColumns,myMakeShowTabObjectSql| INFORMATION_SCHEMA.COLUMNS中  **Collation和Privileges全部为null**|无,yashan没有列权限|
|SHOW COLLATION|显示全部字符序,SHOW     COLLATION     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|select COLLATION `Collation`, CHARSET `Charset`, ID `Id`, `DEFAULT` `Default`, `COMPILED` `Compiled`, SORTLEN `Sortlen` from V$COLLATION|myShowCollation,myMakeShowObjectViewSql|  
|无|
|SHOW CREATE PROCEDURE|显示存储过程的定义,SHOW     CREATE     PROCEDURE     *proc_name*|功能支持|select S.NAME AS `PROCEDURE`, 'NULL' AS SQL_MODE, S.TEXT AS CREATE_PROCEDURE, 'no_corresponding_col' AS    
  CHARACTER_CLIENT, 'no_corresponding_col' AS COLLATION_CONNECTION, 'no_corresponding_col' AS DATABASE_COLLATION    
  FROM dba_source S WHERE S.NAME = 'TEST_PRO' AND S.TYPE = 'PROCEDURE';|myParseShowCreateProcedure,myParseProcedureGetDDL|SQL_MODE,CHARACTER_CLIENT,COLLATION_CONNECTION,DATABASE_COLLATION,只做语法支持，值为创建视图时的默认值|all_source,只查当前用户可访问的资源信息|
|SHOW CREATE VIEW|显示视图的定义,SHOW     CREATE     VIEW     *view_name*|功能支持|SELECT TABLE_NAME VIEW, VIEW_DEFINITION CREATE_VIEW, CHARACTER_SET_CLIENT, COLLATION_CONNECTION FROM    
  information_schema.views where TABLE_SCHEMA ='db' and TABLE_NAME='v1';|  
|CHARACTER_SET_CLIENT,COLLATION_CONNECTION,只做语法支持|没有show view权限|
|SHOW CREATE TABLE|显示表定义,SHOW     CREATE     TABLE     *tbl_name*|功能支持|select '%s' as `Table`, to_char(dbms_metadata.get_ddl('table', '%s')) from dual|myParseTableGetDDL|  
|只查当前用户的表,调用dbms_metadata.get_ddl，如果要查的表不存在，则返回报错,tac表无法获得建表语句|
|SHOW CREATE DATABASE,SHOW CREATE DATABASE     **IF NOT EXISTS**|显示database定义，database同义词schema,SHOW     CREATE     {  DATABASE     |     SCHEMA  }     [  IF     NOT     EXISTS  ]     *db_name*|语法支持|CREATE DATABASE + 'db_name'|  
|  
|没有db select权限,v$database里查数据，需要对应的权限,只要当前实例有这个数据库就能查出来,查出来的是yashan概念的database，不是MySQL概念的database|
|SHOW CREATE TRIGGER|显示触发器定义,SHOW     CREATE     TRIGGER     *trigger_name*|功能支持|SELECT TRIGGER_NAME,SQL_MODE,ACTION_STATEMENT    
  SQL_ORIGINAL_STATEMENT,CHARACTER_SET_CLIENT,COLLATION_CONNECTION,DATABASE_COLLATION,CREATED FROM    
  information_schema.triggers WHERE TRIGGER_NAME='product_insert_trigger' and TRIGGER_SCHEMA='db';|myParseShowCreateTrigger|SQL_MODE,CHARACTER_CLIENT,COLLATION_CONNECTION,DATABASE_COLLATION,...,只做语法支持|创建语句从SYS.DBA_TRIGGERS取,要求有dba权限|
|SHOW DATABASES|显示所有database,SHOW     {  DATABASES     |     SCHEMAS  }     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|语法支持|显示当前的database|  
|  
|需要V$DATABASE权限|
|SHOW ENGINES|显示存储引擎,SHOW     ENGINE     *engine_name*     {  STATUS     |     MUTEX  },status：状态信息,mutex：互斥、读写锁统计信息|语法支持|计划：SELECT ENGINE, SUPPORT, COMMENT, TRANSACTIONS, XA, SAVEPOINTS FROM information_schema.ENGINES;,实际：硬编码|  
|  
|没有权限限制|
|show fields from `columns_priv`|等价show columns|功能支持|  
|  
|  
|  
|
|SHOW FUNCTION STATUS WHERE Db = 'test'|显示数据库上的function信息,SHOW     FUNCTION     STATUS     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|select O.owner `Db`, O.object_name `Name`, O.object_type `Type`, O.owner `Definer`, LAST_DDL_TIME `Modified`,    
  CREATED `Created`, AUTHID `Security_type`, 'NULL' `Comment`, 'no_corresponding_col' AS `character_set_client`,    
  'no_corresponding_col' AS `collation_connection`, 'no_corresponding_col' AS `Database Collation` from DBA_OBJECTS O left    
  join DBA_PROCEDURES P on O.OBJECT_NAME = P.OBJECT_NAME where O.object_name = '' and OBJECT_TYPE = 'FUNCTION'|myShowFunctionStatus|Comment,character_set_client,collation_connection,Database Collation,只做语法支持|ALL_OBJECTS,ALL_PROCEDURES,只查当前用户可访问的函数和过程体|
|SHOW PROCEDURE STATUS WHERE Db = 'test'|显示数据库上的存储过程信息,SHOW     PROCEDURE     STATUS     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|select O.owner `Db`, O.object_name `Name`, O.object_type `Type`, O.owner `Definer`, LAST_DDL_TIME `Modified`,    
  CREATED `Created`, AUTHID `Security_type`, 'NULL' `Comment`, 'no_corresponding_col' AS `character_set_client`,    
  'no_corresponding_col' AS `collation_connection`, 'no_corresponding_col' AS `Database Collation` from DBA_OBJECTS O left    
  join DBA_PROCEDURES P on O.OBJECT_NAME = P.OBJECT_NAME where O.object_name = '' and OBJECT_TYPE = 'PROCEDURE'|myShowProducerStatus|Comment,character_set_client,collation_connection,Database Collation,只做语法支持|ALL_OBJECTS,ALL_PROCEDURES,只查当前用户可访问的函数和过程体|
|SHOW PROCESSLIST|显示会话进程信息,SHOW     [  FULL  ]     PROCESSLIST|功能支持|SELECT * FROM INFORMATION_SCHEMA.PROCESSLIST,不带full limit 100|myShowProcesslist|  
|INFORMATION_SCHEMA.PROCESSLIST|
|SHOW INDEX|显示表上的索引信息,SHOW     {  INDEX     |     INDEXES     |     KEYS  }     {  FROM     |     IN  }     *tbl_name*     [  {  FROM     |     IN  }     *db_name*  ]     [  WHERE     *expr*  ]|功能支持|select TABLE_NAME,non_unique,index_name    
  key_name,seq_in_index,column_name,collation,CARDINALITY,SUB_PART,PACKED,nullable,INDEX_TYPE,COMMENT,INDEX_COMMENT    
  from information_schema.STATISTICS WHERE TABLE_NAME = 't1';|myShowStatistics|null列的值为固定的null|INFORMATION_SCHEMA.STATISTICS|
|SHOW GLOBAL STATUS|显示全局状态信息    
  SHOW     [  GLOBAL     |     SESSION  ]     STATUS     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|语法支持|select v$    [sysstat.name](http://sysstat.name)     `Variable_name`, v$sysstat.value `Value` from v$sysstat|myShowStatus|  
|v$sysstat|
|SHOW GLOBAL VARIABLES|显示全局系统变量,SHOW     [  GLOBAL     |     SESSION  ]     VARIABLES     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|select NAME `Variable_name`, DEFAULT_VALUE `Value` from v$parameter|myShowVariables|  
|v$system_parameter,v$parameter|
|SHOW GRANTS FOR 'yasdb'@'192.168.132.53'|显示用户权限,SHOW     GRANTS     [  FOR     *user*  ]|语法支持|SELECT FROM MYSQL.DB, mysql.tables_priv, mysql.procs_priv, dba_role_privs,通过concat函数拼出grant语句|myParseShowGrants|结果与mysql不一致，不是拼接授权语句，而是分行打印用户的所有权限|需要dba_role_privs和MYSQL.DB的权限（MYSQL.DB的权限是public）,具体的权限显示跟MySQL有差异，MySQL的权限打印分为,  make_dynamic_privilege_statement    
    make_database_privilege_statement    
    make_table_privilege_statement    
    make_sp_privilege_statement    
    make_sp_privilege_statement    
    make_proxy_privilege_statement    
    make_roles_privilege_statement    
    make_with_admin_privilege_statement,我们的权限打印实际为,database_privilege,table_privilege,sp_privilege（PROCEDURE）,sp_privilege（function）,roles_privilege,  
,show grants for ``;    
  show grants for null;,处理与MySQL不一致，``视为标识符报错，null视为用户名可以查询|
|SHOW MASTER STATUS|显示主服务器的复制状态,SHOW     MASTER     STATUS|语法支持|返回空集|  
|返回一列null|没有权限|
|SHOW PLUGINS|显示所有插件信息,SHOW     PLUGINS|语法支持|返回空集|  
|返回一列null|没有权限|
|SHOW TRIGGERS|显示触发器，带过滤条件,SHOW     TRIGGERS     [  {  FROM     |     IN  }     *db_name*  ]     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|SELECT TRIGGER_NAME, EVENT_MANIPULATION EVENT, EVENT_OBJECT_TABLE TABLE_NAME, ACTION_STATEMENT STATEMENT,    
  ACTION_TIMING TIMING, CREATED, SQL_MODE, DEFINER, CHARACTER_SET_CLIENT, COLLATION_CONNECTION,    
  DATABASE_COLLATION FROM information_schema.TRIGGERS where TRIGGER_SCHEMA='db'|myShowTrigger|SQL_MODE,CHARACTER_CLIENT,COLLATION_CONNECTION,DATABASE_COLLATION,...,只做语法支持|information_schema.TRIGGERS|
|SHOW TABLE STATUS|显示所有表详细信息  **（包含视图）**,SHOW     TABLE     STATUS     [  {  FROM     |     IN  }     *db_name*  ]     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|select T.TABLE_NAME `Name`, ENGINE `Engine`, VERSION `Version`, ROW_FORMAT `Row_format`, TABLE_ROWS `Rows`, AVG_ROW_LENGTH `Avg_row_length`, DATA_LENGTH `Data_length`,    
  MAX_DATA_LENGTH `Max_data_length`, INDEX_LENGTH `Index_length`, DATA_FREE `Data_free`, AUTO_INCREMENT `Auto_increment`, CREATE_TIME `Create_time`,     
  UPDATE_TIME `Update_time`, CHECK_TIME `Check_time`, TABLE_COLLATION `Collation`, CHECKSUM `Checksum`, CREATE_OPTIONS `Create_options`, TABLE_COMMENT `Comment`     
  from INFORMATION_SCHEMA.TABLES T left join ALL_TABLES DT ON T.TABLE_NAME = DT.TABLE_NAME where OWNER =|myShowTable|  
|INFORMATION_SCHEMA.TABLES,ALL_TABLES|
|SHOW STATUS|显示服务端状态信息（会话）,SHOW     [  GLOBAL     |     SESSION  ]     STATUS     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|语法支持|global ：select v$    [sysstat.name](http://sysstat.name)     `Variable_name`, v$sysstat.value `Value` from v$sysstat,session：select v$    [sysstat.name](http://sysstat.name)     `Variable_name`, v$sysstat.value `Value` from v$sysstat where SID = ,  
|myShowStatus|  
|v$    [sysstat](http://sysstat.name)    权限|
|SHOW SLAVE STATUS|显示副本(备机)状态,SHOW     SLAVE     STATUS     [  FOR     CHANNEL     *channel*  ]|语法支持|返回空集|  
|  
|  
|
|SHOW TABLES|显示所有表名,SHOW     [  FULL  ]     TABLES     [  {  FROM     |     IN  }     *db_name*  ]     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|select TABLE_NAME AS TABLES_IN_ , Table_type from INFORMATION_SCHEMA.TABLES|myShowTables|  
|INFORMATION_SCHEMA.TABLES|
|SHOW VARIABLES|显示全部系统变量,SHOW     [  GLOBAL     |     SESSION  ]     VARIABLES     [  LIKE     '  *pattern*  '     |     WHERE     *expr*  ]|功能支持|global：v_$mysql_global_variables,session：v_$mysql_variables|myShowVariables,myMakeShowObjectViewSql|  
|global：v_$mysql_global_variables,session：v_$mysql_variables|
|SELECT CURRENT_USER();|当前用户，  **内置函数**|功能支持|返回当前用户|  
|  
|  
|
|SELECT DATABASE()；|当前用户，  **内置函数**|功能支持|返回当前用户|  
|  
|  
|


  


# 4.特性

## 4.1 特性设计

1.解析到show关键字后进入myParseShow，根据下一个词选择对应的show函数

2.将show xxx语句改写为对应的select from yashan语句

3.通过myParseYasSql解析改写后的yasSql语句，后继执行该语句，并返回对应结果

  


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

1.    [支持information_schema权限相关系统视图](https://conf.yasdb.com/pages/viewpage.action?pageId=156122470)     支持后，权限相关的show语句需要调整

  


## Comments:

|  [](null)  ,1.show语句的权限管理,Posted by mashijie at 七月 12, 2024 14:44|
|---|
