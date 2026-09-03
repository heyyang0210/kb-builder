Created by 王林, last modified on 十一月 08, 2024

SR:     [https://pingcode.yasdb.com/pjm/items/670a5949e489dd0868f667cf](https://pingcode.yasdb.com/pjm/items/670a5949e489dd0868f667cf)    ? #YDBRD-33992 【mysql兼容】兼容schema\version相关函数

IR:     [https://pingcode.yasdb.com/ship/ideas/66cc25514283cf23d4f3b3a2](https://pingcode.yasdb.com/ship/ideas/66cc25514283cf23d4f3b3a2)    ?   #YASHAN-3168 【mysql兼容】支持信息函数，用于返回一些数据库系统信息

#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-%E6%80%BB%E8%BF%B0)  

在原有的mysql框架之上，适配schema函数、version函数。

#   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

  


##   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

### 1.2.1 schema函数

schema函数用来获取默认数据库名称。是 database函数的同义词，在语法解析时   将"SCHEMA"解析为"DATABASE", 即 

static     const     SYMBOL     symbols  [] 中”  {   SYM  (  "SCHEMA"  ,                     DATABASE  )}  “ 。

  


**函数定义**

```
DATABASE()

返回结果：
返回默认（当前）数据库名称，名称是utf8字符集的字符串。如果没设置默认数据库，则返回NULL。最大长度34字节，超过会舍弃多余的内容。
```

  


**查看当前已有的模式，可以通过 information_schema.schemata 查看。**

```
mysql> select * from information_schema.schemata;
+--------------+--------------------+----------------------------+------------------------+----------+
| CATALOG_NAME | SCHEMA_NAME        | DEFAULT_CHARACTER_SET_NAME | DEFAULT_COLLATION_NAME | SQL_PATH |
+--------------+--------------------+----------------------------+------------------------+----------+
| def          | information_schema | utf8                       | utf8_general_ci        | NULL     |
| def          | db1                | utf8mb4                    | utf8mb4_general_ci     | NULL     |
| def          | db2                | utf8mb4                    | utf8mb4_general_ci     | NULL     |
| def          | mysql              | utf8mb4                    | utf8mb4_general_ci     | NULL     |
| def          | performance_schema | utf8                       | utf8_general_ci        | NULL     |
| def          | sys                | utf8                       | utf8_general_ci        | NULL     |
+--------------+--------------------+----------------------------+------------------------+----------+
6 rows in set (0.01 sec)
```

  


  


**不同场景下测试现象**

|操作描述|操作内容|结果说明|  
|  
|
|---|---|---|---|---|
|用户登录数据库没指定-D 时,执行schema()查询|[wln@vm181 ~]$   **mysql -u root -padmin**,mysql>   **select schema();**    
  +----------+    
  | schema() |    
  +----------+    
  | NULL |    
  +----------+    
  1 row in set (0.00 sec)|当前没指定schema, 则默认的schema为NULL， schema()函数返回结果为NULL。|  
|  
|
|用户登录数据库指定-D 时,执行schema()查询|[wln@vm181 ~]$  ** mysql -u root -padmin -D db1**,mysql>   **select schema();**    
  +----------+    
  | schema() |    
  +----------+    
  | db1 |    
  +----------+    
  1 row in set (0.01 sec)|登录时指定schema 为db1,则登录后默认schema 为db1，执行schema(） 返回默认的schema名。,  
|  
|  
|
|use 切换schema 后，同一个session下操作，删除这个schema|mysql>   **create schema sch1;**    
  Query OK, 1 row affected (0.01 sec),mysql>   **use sch1;**    
  Database changed    
  mysql> select schema();    
  +----------+    
  | schema() |    
  +----------+    
  | sch1 |    
  +----------+    
  1 row in set (0.00 sec),mysql>   **drop schema sch1;**    
  Query OK, 0 rows affected (0.00 sec),mysql>   **select schema();**    
  +----------+    
  | schema() |    
  +----------+    
  | NULL |    
  +----------+    
  1 row in set (0.00 sec)|在相同session下删除schema,则此session对应的schema为NULL， 则函数schema() 返回NULL。|  
|  
|
|use 切换schema 后，不同session下操作，删除这个schema|**session1 :**,mysql>   **create schema sch1;**    
  Query OK, 1 row affected (0.00 sec),mysql> use sch1;    
  Database changed    
  mysql>  ** select schema();**    
  +----------+    
  | schema() |    
  +----------+    
  | sch1 |    
  +----------+    
  1 row in set (0.01 sec),  
,**session 2:**,mysql> drop schema sch1;    
  Query OK, 0 rows affected (0.00 sec),  
,然后  **session 1**   继续查看,mysql>   **select schema();**    
  +----------+    
  | schema() |    
  +----------+    
  | sch1 |    
  +----------+    
  1 row in set (0.00 sec),  
|若非本session 下删除，执行schema() 返回之前默认的模式名。|  
|  
|


  


### 1.2.2 version函数

version 函数用来返回版本信息。

  


**version 函数定义**

```
VERSION()

返回结果：
返回服务端版本信息，名称是utf8字符集的字符串。

mysql> select version();
+------------------+
| version()        |
+------------------+
| 5.7.44-debug-log |
+------------------+
```

  


**测试现象**

|操作内容|结果说明|  
|
|---|---|---|
|version() 函数,mysql> select version();    
  +------------------+    
  | version() |    
  +------------------+    
  | 5.7.44-debug-log |    
  +------------------+    
  1 row in set (0.01 sec)|version() 返回服务端版本信息|  
|
|全局变量 @@version， @@global.version,  
,mysql> select @@version, @@global.version ;    
  +------------------+------------------+    
  | @@version | @@global.version |    
  +------------------+------------------+    
  | 5.7.44-debug-log | 5.7.44-debug-log |    
  +------------------+------------------+    
  1 row in set (0.00 sec)|全局变量 @@version， @@global.version,返回服务端版本信息|  
|
|查看变量version 信息,  
,mysql> show variables like 'version';    
  +---------------+------------------+    
  | Variable_name | Value |    
  +---------------+------------------+    
  | version | 5.7.44-debug-log |    
  +---------------+------------------+    
  1 row in set (0.02 sec)|show variables like 'version'; 返回服务端版本信息|  
|
|status 命令,  
,mysql> status;    
  --------------    
  mysql Ver 14.14 Distrib 5.7.44, for Linux (x86_64) using EditLine wrapper,Connection id: 22    
  Current database:     
  Current user: root@localhost    
  SSL: Not in use    
  Current pager: stdout    
  Using outfile: ''    
  Using delimiter: ;    
  **Server version: 5.7.44-debug-log Source distribution**    
  Protocol version: 10    
  Connection: Localhost via UNIX socket    
  Server characterset: utf8mb4    
  Db characterset: utf8mb4    
  Client characterset: utf8mb4    
  Conn. characterset: utf8mb4    
  UNIX socket: /tmp/wln57/mysql.sock    
  Uptime: 2 hours 44 min 31 sec,Threads: 3 Questions: 312 Slow queries: 4 Opens: 229 Flush tables: 1 Open tables: 65 Queries per second avg: 0.031|status 命令输出结果含有服务端版本信息|  
|
|mysql -V ,[wln@vm181 anchorbase]$ mysql -V    
  mysql Ver 14.14 Distrib   **5.7.44**  , for Linux (x86_64) using EditLine wrapper|mysql -V 输出信息中含有服务端版本信息|  
|


  


##   [1.3 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|无|  
|  
|  
|


##   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

#   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-%E6%8E%A5%E5%8F%A3)  

  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无

##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

  


##   [5. 参考](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

mysql 文档有关 schema, version 函数介绍：

  [https://dev.mysql.com/doc/refman/5.7/en/information-functions.html#function_schema](https://dev.mysql.com/doc/refman/5.7/en/information-functions.html#function_schema)  

  [https://dev.mysql.com/doc/refman/5.7/en/information-functions.html#function_version](https://dev.mysql.com/doc/refman/5.7/en/information-functions.html#function_version)  

  


  


  


  
