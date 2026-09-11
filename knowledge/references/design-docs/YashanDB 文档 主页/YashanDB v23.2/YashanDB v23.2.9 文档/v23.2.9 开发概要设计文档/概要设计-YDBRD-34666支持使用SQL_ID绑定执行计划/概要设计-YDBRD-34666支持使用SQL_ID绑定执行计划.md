   [https://pingcode.yasdb.com/pjm/items/6718e6fae489dd0868fd8135?](https://pingcode.yasdb.com/pjm/items/6718e6fae489dd0868fd8135?)  

#YDBRD-34666 支持使用SQL_ID绑定执行计划



OUTLINE的设计文档：

  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67396fd2728206efb92f369f](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67396fd2728206efb92f369f)  



## 1. 总述

![image.png](https://pingcode.yasdb.com/atlas/files/public/674440948970c2af4f53b825/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjA2NzUsImV4cCI6MTc4MjMzMTQ3NX0.szBIR8vZdeXOM9rlhWRqRJMoKddpJCPGklto6U7gnuE)

功能语法：CREATE OUTLINE outline_name ON sql_id USING HINT hint;

创建一个存储纲要，保存指定的hint，当sql_id对应的语句执行时，为该语句使用该hint。（USE_STORED_OUTLINES 参数为TRUE）

sql_id是数据库内部【唯一标识一条SQL语句的ID值，具体算法通过SQL文本的哈希/加密运算获得】。可以先执行一个sql语句，然后通过v$sql视图查找。select sql_id,SQL_TEXT  from v$sql where SQL_TEXT like 'SELECT%  *area*  %';

outline查看：

DBA_OUTLINES 查看outline信息。DBA_OUTLINE_HINTS查看hint信息。

通过explain语句可以看到是否用到outline。但hint信息是否使用遵循本身的规则（hint有专门文档，一个规则：有别名时hint里得用别名）。

DBA_OUTLINES.USED可以看到outline是否被有使用。

![image.png](https://pingcode.yasdb.com/atlas/files/public/673ed9fc8970c2af4f53b6d0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjA2NzUsImV4cCI6MTc4MjMzMTQ3NX0.szBIR8vZdeXOM9rlhWRqRJMoKddpJCPGklto6U7gnuE)











### 1.1 需求来源

产品化需求。

友商oceanbase的功能，在当前语法上兼容。



### 1.2 调研文档

ob上通过SQL_ID创建的OUTLINE，在对应语句执行时，可以在V$OB_PLAN_CACHE_PLAN_STAT视图（计划缓存中每一个缓存对象的状态）上看到该SQL使用了对应的OUTLINE。

但用explain看到的还是当前环境的计划，不算outline对应的hint。



```
CREATE TABLE aret1 (c1 INT PRIMARY KEY, c2 INT, c3 INT);
INSERT INTO aret1 VALUES(1, 1, 1), (2, 2, 2), (3, 3, 3);

SELECT * FROM aret1 WHERE c2 = 1;

--查看full的计划。DBA_OB_OUTLINES.OUTLINE_CONTENT记录的是当前计划的HINT
CREATE OUTLINE otl ON SELECT * FROM aret1 WHERE c2 = 1;
select * from DBA_OB_OUTLINES;
DROP OUTLINE otl;

--查看SQL_ID字段。多执行几次查询。
SELECT SQL_ID,QUERY_SQL FROM V$OB_PLAN_CACHE_PLAN_STAT WHERE QUERY_SQL LIKE '%aret1%';
| 28E8DD4BD0DD8AA5CAC8C336B6B7A5FF | SELECT * FROM aret1 WHERE c2 = 1   

--用SQLID创建outline，hint里是FULL。
CREATE OUTLINE otl_idx ON '28E8DD4BD0DD8AA5CAC8C336B6B7A5FF' USING HINT /*+BEGIN_OUTLINE_DATA FULL(@"SEL$1" "oceanbase"."aret1"@"SEL$1") OPTIMIZER_FEATURES_ENABLE('4.2.1.0') END_OUTLINE_DATA*/;

--增加索引，正常情况下，之后c2 = 1应该走index查询。
alter table aret1 add INDEX idx_c2(c2);

--查询实际执行的计划。V$OB_PLAN_CACHE_PLAN_STAT.OUTLINE_ID和V$OB_PLAN_CACHE_PLAN_STAT.OUTLINE_DATA字段记录了使用的outline信息，可以看到和创建的otl_idx对应
SELECT * FROM aret1 WHERE c2 = 1;
SELECT * FROM V$OB_PLAN_CACHE_PLAN_STAT WHERE QUERY_SQL LIKE '%aret1%';
select * from DBA_OB_OUTLINES;


```



| TENANT_ID | SVR_IP         | SVR_PORT | PLAN_ID | SQL_ID                           | QUERY_SQL                         | OUTLINE_VERSION  | OUTLINE_ID | OUTLINE_DATA                                                                                                                                                                                                                                                               | ACS_SEL_INFO | TABLE_SCAN | EVOLUTION | EVO_EXECUTIONS | EVO_CPU_TIME | TIMEOUT_COUNT | PS_STMT_ID | SESSID | TEMP_TABLES | IS_USE_JIT | OBJECT_TYPE | HINTS_INFO                                                                               | HINTS_ALL_WORKED | PL_SCHEMA_ID | IS_BATCHED_MULTI_STMT | RULE_NAME |

+-----------+----------------+----------+---------+----------------------------------+-----------------------------------+------------------+------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------+------------+-----------+----------------+--------------+---------------+------------+--------+-------------+------------+-------------+------------------------------------------------------------------------------------------+------------------+--------------+-----------------------+-----------+

|         1 | 192.168.18.175 |     2882 | 5665370 | 28E8DD4BD0DD8AA5CAC8C336B6B7A5FF | SELECT * FROM aret1 WHERE c2 = 1  | 1732001414829040 |       500088   |   /*+BEGIN_OUTLINE_DATA FULL(@"SEL$1" "oceanbase"."aret1"@"SEL$1") OPTIMIZER_FEATURES_ENABLE('4.2.1.0') END_OUTLINE_DATA*/   





+----------------------------+----------------------------+-----------+-------------+------------+---------------+--------------+-------------------+----------+----------------+-------------+----------------------------------+--------------------------------------------------------------------------------------------------------------------------+

| CREATE_TIME                | MODIFY_TIME                | TENANT_ID | DATABASE_ID | OUTLINE_ID | DATABASE_NAME | OUTLINE_NAME | VISIBLE_SIGNATURE | SQL_TEXT | OUTLINE_TARGET | OUTLINE_SQL | SQL_ID                           | OUTLINE_CONTENT                                                                                                          |

+----------------------------+----------------------------+-----------+-------------+------------+---------------+--------------+-------------------+----------+----------------+-------------+----------------------------------+--------------------------------------------------------------------------------------------------------------------------+

| 2024-11-19 15:30:14.829630 | 2024-11-19 15:30:14.829630 |         1 |      201001 |       500088   | oceanbase     | otl_idx      |                   |          |                |             | 28E8DD4BD0DD8AA5CAC8C336B6B7A5FF | /*+BEGIN_OUTLINE_DATA FULL(@"SEL$1" "oceanbase"."aret1"@"SEL$1") OPTIMIZER_FEATURES_ENABLE('4.2.1.0') END_OUTLINE_DATA*/ |





### 1.3 需求分析



|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|创建outline|增加sql_id语法创建的outline流程。|是|是|----|
||sql编译时使用SQL_ID的hint|statement语法匹配不到后，按sql_id匹配。读取sql_id语法对应的hint。|是|是|----|
||context复用判断|CREATE、REPLACE时对相关context失效。之后用category判断。|是|是||
||主备适配|备机上失效sql_id对应context。|否|是||
||集群适配|备机上失效sql_id对应context。|否  |是||
||分布式适配|执行流程适配。,扩缩容适配。|否  |是||
||ALTER OUTLINE语法适配|不支持REBUILD、CHANGE语法|否|是||
|性能|无|||||
|可用性|恢复场景|----|是/否|是/否|----|
|可靠性|故障场景|----|是/否|否|----|
|可维可测|----|----||||
|安全|----|----|否|否|----|
|易用性|视图查看OULINE|dba_outlines视图增加sql_id字段。,dba_outline_hints视图查询sql_id对应的hint。|否|是|----|
||explain查看用到的outline信息||否|否||
|可修改性|----|----|是/否|否|----|
|兼容性|ol$表增加列，增加索引。|升级脚本中适配|是|是|----|
|周边配合|权限|----|----|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导出sql_id语法创建的outline。|查询sql_id字段，有值后再查询all_outlines|是|是||




### 1.4 数据字典

无



### 1.5 开源依赖

无





## 2. 接口



|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|CREATE OUTLINE ON sql_id USING HINT hint;|通过sql_id语法创建outline|是|
|系统视图|DBA_OUTLINES|增加SQL_ID字段|是|
|错误码|ERR_ANS_PARSER_ERROR_SQLID_OL|sql_id语法错误|是|
|错误码|ERR_ANS_PARSER_UNSUPPORT_SQLID_OL|sql_id的outline不支持相关功能|是|




## 3. 规格与约束

- ON stmt语法创建的outline优先级更高。即先匹配stmt的OUTLINE，匹配不上才会按sql_id匹配。
- 如果sql_id对应的语句中有hint，匹配到OUTLINE后会忽略原语句的hint。
- sql_id的长度固定为13位。
- hint长度上限为DB_BLOCK_SIZE。（默认8k，yasdb内存机制的限制）
- sql_id语法不支持CATEGORY。行为上表现为：创建时非DEFAULT报错，DBA_OUTLINES.CATEGORY 字段为NULL，






## 4. 特性



### 4.1 CREATE语法

4.1.1   **parse**  ：

- 和已有的OUTLINE语法结合，支持REPLACE。
- ON后面是字符串表示是sql_id语法。
- 读USING，HINT关键字，读hint字符串。hint字符串去掉格式。lexRemoveHintWrapper，和ON stmt语法对齐。
- 用conetxt内存复制sql_id字符串、hint字符串到OutlineCreateDef。






4.1.2   **exec**  ：

- OL$系统表增加SQL_ID VARCHAR(13)字段，在SQL_ID模式的OUTLINE下记录，同时TEXTLEN字段改为记hint长度。
- OL$系统表增加SQL_ID字段的唯一索引。 
- 新增createOutlineOnSqlId流程，ON sql_id语法exec阶段的函数。
- 系统表操作中适配sql_id语法，主要记OL$.SQL_ID字段，OL$HINTS.HINT_TEXT，OL$HINTS.HINT_STRING






**4.1.3 失效缓存**  :

outlineInvalidSql 函数适配，功能是通过outline名称失效相关缓存context。

- 先取SQL_ID字段，非NULL时只读SQL_ID字段即可。
- 调按SQL_ID字段失效context的函数anlInvalidateBySqlId（通过回调指针cleanMapSqlPlan），失效所有context->attr.sqlId.data相同的缓存。




**主备**  ：失效备机上SHARED_POOL中和sql_id相同的context缓存。

**集群**  ：失效其它实例上 SHARED_POOL中和sql_id相同的context缓存。

**分布式**  ：执行函数createOutline中适配sqlId语法。  **扩缩容适配**  。



### 4.2 SQL_ID的OUTLINE使用

- 通过hash值（ON statement方式）没有匹配到OUTLINE后，再通过sql_id匹配OUTLINE。
- sql_id匹配到后取OUTLINE名，按hint长度。
- 按OUTLINE名取hint字符串。






### 4.3 ALTER语法

支持RENAME。

支持ENABLE | DISABLE。

不支持REBUILD分支。

不支持CHANGE分支。



### 4.4 周边适配

支持exp/imp中sql_id语法OUTLINE的正常使用。





## 5.未来规划

