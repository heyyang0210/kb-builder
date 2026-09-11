Created by 冯皓博, last modified on 六月 12, 2023

ORACLE异构文档：

  [Introduction to Heterogeneous Connectivity (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/heter/introduction.html#GUID-EC402025-0CC0-401F-AF93-888B8A3089FE)  

  [Oracle Database Gateway for ODBC Features and Restrictions](https://docs.oracle.com/en/database/oracle/oracle-database/18/odbcu/database-gateway-odbc-features.html#GUID-FD717A9F-05D9-42DD-BE65-18EDEF38789C)  

配置方法：    [https://conf.yasdb.com/x/uhGIBg](https://conf.yasdb.com/x/uhGIBg)  

# 1、DBLINK支持语句：

### 1、oracle支持的语法和函数：

以下主题描述了 Oracle Database Gateway for ODBC 支持的 SQL 语法和函数。

-   [支持的 SQL 语句](https://docs.oracle.com/en/database/oracle/oracle-database/18/odbcu/database-gateway-odbc-supported-syntax-function.html#GUID-8C7FE3F8-F652-4846-917E-78A4C7B8C948)      
  Oracle Database Gateway for ODBC 支持    `DELETE`    、    `INSERT`    、    `SELECT`    和    `UPDATE`    语句，但前提是 ODBC 驱动程序和非 Oracle 系统可以执行它们  并且  语句包含受支持的 Oracle SQL 函数。
-   [Oracle 函数](https://docs.oracle.com/en/database/oracle/oracle-database/18/odbcu/database-gateway-odbc-supported-syntax-function.html#GUID-FA9EEBCD-5503-4622-B806-E3BFBB2AF6BA)      
  所有函数在网关将它们转换为本机 SQL 后由非 Oracle 系统评估。假定非 Oracle 系统仅支持一组有限的功能。大多数 Oracle 函数在此有限集合中没有等效函数。因此，尽管后处理由 Oracle 数据库执行，但 Oracle Database Gateway for ODBC 不支持许多 Oracle 功能，可能会影响性能。


  


### 2、支持的 SQL 语句

Oracle Database Gateway for ODBC 支持    `DELETE`    、    `INSERT`    、    `SELECT`    和    `UPDATE`    语句，但前提是 ODBC 驱动程序和非 Oracle 系统可以执行它们  并且  语句包含受支持的 Oracle SQL 函数。

除了少数例外，网关提供对 Oracle       `DELETE`    、    `INSERT`    、    `SELECT`    和    `UPDATE`    语句的全面支持。

网关不支持Oracle数据定义语言 (DDL) 语句。但对于    `ALTER`    、    `CREATE`    、    `DROP`    和    `GRANT`    语句，如果您需要对非 Oracle 系统数据库使用 DDL 语句，请使用网关的传递功能。

**具体说明：**

#### DELETE

该    `DELETE`    声明得到完全支持  。  但是，只能使用非 Oracle 系统支持的 Oracle 函数。

  


#### INSERT

该    `INSERT`    声明得到完全支持。但是，只能使用非 Oracle 系统支持的 Oracle 函数。

  


#### SELECT

该    `SELECT`    声明得到完全支持，但以下情况除外：

-   `CONNECT BY`       condition
-   `NOWAIT`  
-   `START WITH`       condition
-   `WHERE CURRENT`         `OF`  
-   `FOR UPDATE`  


  


#### UPDATE

该    `UPDATE`    声明得到完全支持。但是，只能使用非 Oracle 系统支持的 Oracle 函数。此外，子查询中不能有引用外部查询中相同表名的 SQL 语句。SET 子句不支持子查询。

### 3、支持的函数

Oracle Database Gateway for ODBC 假定正在使用的 ODBC 驱动程序提供程序支持以下最小 SQL 函数集：这些函数我们目前都支持

-   `AVG(`    exp    `)`  
-   `LIKE(`    exp    `)`  
-   `COUNT(*)`  
-   `MAX(`    exp    `)`  
-   `MIN(`    exp    `)`  
-   `NOT`  


### 4、oracle已知限制：

以下是已知限制：

- 传递查询无法读取    `BLOB`    和    `CLOB`    数据（统一一下数据类型支持情况，规格需要明确，规格可以先同步Y->O）
- 不允许在    `WHERE`    子句中包含不受支持的函数的更新或删除
- Oracle Database Gateway for ODBC 不支持存储过程
- 不能参与分布式事务;仅支持单站点事务
- 不支持多线程代理
- 不支持使用    `LONG`    绑定变量更新列
- 不支持 rowids


PL/SQL 游标循环中的 COMMIT 或回滚会关闭打开的游标 PL/SQL 游标循环中的任何或发出的游标都会    [关闭所有打开的游标](https://docs.oracle.com/en/database/oracle/oracle-database/18/odbcu/database-gateway-odbc-features.html#GUID-2580E06F-FE95-4C3E-9C83-550AFA914421)      
  ，这可能会导致错误。    `COMMIT`      `ROLLBACK`  

SQL 语法限制 Oracle Database Gateway for ODBC 对       [SQL 语法](https://docs.oracle.com/en/database/oracle/oracle-database/18/odbcu/database-gateway-odbc-features.html#GUID-F7CE5725-8B35-420A-8043-C94CBBFF5B22)    有以下限制

  [回调链接支持](https://docs.oracle.com/en/database/oracle/oracle-database/18/odbcu/database-gateway-odbc-features.html#GUID-8F4FE79D-2935-41BC-9605-690925CAC252)      
  Oracle Database Gateway for ODBC 不支持链接。    `CALLBACK`  

### 5、数据字典支持：

  [https://docs.oracle.com/en/database/oracle/oracle-database/18/odbcu/database-gateway-odbc-data-dictionary.html#GUID-62D5EEFD-886F-44FD-9F38-37183035A5DF](https://docs.oracle.com/en/database/oracle/oracle-database/18/odbcu/database-gateway-odbc-data-dictionary.html#GUID-62D5EEFD-886F-44FD-9F38-37183035A5DF)  

本质是远程查询系统视图支持，oracle会将访问远程数据库的  DBA_*等操作转换为ODBC CATALOG函数调用：

比如对远程数据库的  ALL_CONS_COLUMNS查询，会被转换为ODBC API :  SQLPrimaryKeys, SQLForeignKeys的调用

但是目前ODBC CATALOG函数仅支持SQLTables，不支持完整的ODBC CATALOG，故不提供完全的数据字典支持

元数据对接还不完善

  


# 2、支持的数据类型

  [https://conf.yasdb.com/x/ML0SBQ](https://conf.yasdb.com/x/ML0SBQ)  

类型支持上和oracle同步，支持oracle原生类型

目前规格等同Y->O：    [https://conf.yasdb.com/x/dkKIBg](https://conf.yasdb.com/x/dkKIBg)  

|支持的yashanDB类型|对应的SQL类型|对应的oracle 类型|
|---|---|---|
|smallint|SQL_SMALLINT|smallint|
|int|SQL_LONG|int|
|float|SQL_REAL|float (binary float ??? )|
|double|SQL_DOUBLE|double (binary double ??? )|
|number|SQL_NUMBER|number|
|date|SQL_DATE|date|
|timestamp|SQL_TIMESTAMP|timestamp|
|interval year to month|SQL_INTERVAL_YEAR_TO_MONTH|interval year to month|
|interval day to second|SQL_INTERVAL_DAY_TO_SECOND|interval day to second|
|char|SQL_CHAR|char|
|varchar|SQL_VARCHAR|varchar|
|varchar2|SQL_VARCHAR|varchar2|
|raw|SQL_BINARY|raw|
|clob（不支持）|  
|  
|
|blob（不支持）|  
|  
|


# 3、支持的具体用法

### 1、通过oracle高级包传递命令：

```
DECLARE
    num_rows INTEGER;
BEGIN
    num_rows := DBMS_HS_PASSTHROUGH.EXECUTE_IMMEDIATE@YASDBODBC('commit');
END;
/
//报错

DECLARE
    num_rows INTEGER;
BEGIN
    num_rows := DBMS_HS_PASSTHROUGH.EXECUTE_IMMEDIATE@YASDBODBC('insert into t1 values (1),(2)');
END;
/
//成功
```

  `DBMS_HS_PASSTHROUGH`      `SELECT支持传递传递绑定值和执行语句`  

  `高级包支持传递ALTER`    、    `CREATE`    、    `DROP`    和    `GRANT`    语句，其他语句也支持（一些数据库特有语句，例如insert多组values），目前没有得到支持的语法规格，仅拿到了不支持的语法规格

  


注：命令  不能是以下之一：会报错

-   `BEGIN TRANSACTION`  
-   `COMMIT`  
-   `ROLLBACK`  
-   `SAVE`  
-   `SHUTDOWN`  


### 2、支持网关专有insert into select 语句

语法：

```
COPY {FROM database | TO database | FROM database TO database}            {APPEND|CREATE|INSERT|REPLACE} destination_table [(column, column, column, ...)]  USING query
```

支持的数据类型（据oracle文档）：

- CHAR
- DATE
- LONG
- NUMBER
- VARCHAR2


支持APPEND|CREATE|INSERT|REPLACE四种用法：

前置

```
YashanDB:
create table t1 (col1 int);
Oracle:
create table t1 (col1 int);
```

1、copy:   将查询中的行插入  到destination_table  中。如果  destination_table  不存在，COPY 将返回错误。使用 INSERT 时，USING     查询  必须为  destination_table  中的每一列选择一列。

```
copy from fenghaobo/woaini123@ORCL insert t1@YASDBODBC using select * from t1;
// 支持
copy to fenghaobo/woaini123@ORCL insert t1 using select * from t1@YASDBODBC;
// 支持
```

2、create:   在首次创建表后将查询中的行插入  到destination_table  中。如果  destination_table  已存在，则 COPY 返回错误。

```
copy from fenghaobo/woaini123@ORCL create t1_new@YASDBODBC using select * from t1;
// 不支持 ORA-02021: DDL operations are not allowed on a remote database
copy to fenghaobo/woaini123@ORCL create t1_new using select * from t1@YASDBODBC;
// 支持
```

3、append   将查询中的行插入  到destination_table  （如果表存在）。如果  destination_table  不存在，COPY 会创建它。

```
copy from fenghaobo/woaini123@ORCL append t1@YASDBODBC using select * from t1;
// 支持
copy to fenghaobo/woaini123@ORCL append t1 using select * from t1@YASDBODBC;
// 支持
```

4、replace   将  destination_table  及其内容替换为查询中的行。如果  destination_table  不存在，COPY 会创建它。否则，COPY 将删除现有表，并将其替换为包含复制数据的表。

```
copy from fenghaobo/woaini123@ORCL replace t1@YASDBODBC using select * from t1;
// 不支持 ORA-02021: DDL operations are not allowed on a remote database
copy to fenghaobo/woaini123@ORCL replace t1 using select * from t1@YASDBODBC;
// 支持
```

看下对应执行计划，同时调研下update+delete的支持情况

此特性为SQLPlus特性：

  [Copying Data from the Oracle Database Server to the Non-Oracle Database System](https://docs.oracle.com/en/database/oracle/oracle-database/21/heter/copy-server-data-non-oracle-database-system.html)  

  [SQL*Plus COPY Command (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqpug/SQL-Plus-COPY-command.html#GUID-3565689A-6B8C-42FB-95F3-0412C707377E)  

### 3、增删改查

  `DELETE`    、    `INSERT`    、    `SELECT`    和    `UPDATE`    语句，但具体限制见ORACLE文档

  


  `DELETE: delete xxx from xxx@YASDBODBC where filter`  

  `INSERT: insert into xxx@YASDBODBC values (xxx) (不支持多values)`  

  `SELECT: select xxx from xxx@YASDBODBC where filter`  

  `UPDATE: update set xxx = xxx where filter`  

### 4、绑定参数支持

支持oracle驱动通过insert into xxx@YASDBODBC values(?,?,?)的方式向远程数据库以绑定参数方式insert

同样支持delete+update的绑定参数

### 5、不支持数据字典

### 6、不支持中文

  


  


  


## Comments:

|  [](null)  ,看下double和insert多个值的表现吧,Posted by fenghaobo at 六月 07, 2023 17:53|
|---|
