Created by 周宇昕 on 六月 30, 2023

#   [AC Discovery Design](#ac-discovery-design)  

IR链接：    [YDBRD-11422](https://jira.yasdb.com/browse/YDBRD-11422)       SR链接：    [YDBRD-13313](https://jira.yasdb.com/browse/YDBRD-13313)  

##   [1. Overview（概述）](#1-overview概述)  

本方案针对已确定的业务查询语句，通过算法自动生成供用户选择的备选AC来实现查询加速。

用户通过    `yasboot`    执行指定的命令，可以使用  **预定义的SQL集合或者使用**  **v$sqlarea**  **中的SQL语句**  作为输入，OM执行AC发现的逻辑并输出  **推荐基于代价排序的AC列表**  。

##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|获取查询SQL的列表|获取用户输入的SQL或从Cache中获取SQL|作为AC发现的输入|
|提取查询语句要素|解析SQL并输出查询中特定表的相关投影列和谓词列|提取输入SQL中的要素|
|基于多个语句要素给出可覆盖的AC集合|输出可覆盖原始语句的多个AC DDL语句|基于规则生成AC的集合|
|基于列统计信息的AC代价估算|输出各AC的统计代价|基于代价选择AC的必要输入|
|AC及其代价的排序展现|输出基于代价排序的AC列表|作为推荐AC算法的输出|


##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 yasboot命令](#31-yasboot命令)  

####   [3.1.1 ac discovery](#311-ac-discovery)  

该命令用于AC发现以获取基于代价排序的AC列表

|参数|选项|说明|
|---|---|---|
|-c, --cluster|必传|YashanDB的集群名|
|--file|可选|指定SQL文件，与history二选一|
|--history|可选|使用记录的历史SQL，与file二选一|
|--explain|可选|指定SQL文件检查SQL正确性|
|-s, --schema|可选|指定SQL文件的schema|
|-p, --password|可选|指定schema的密码，SYS用户不需要输入密码|
|-f, --force|可选|跳过explain参数的确认提示|
|-o, --output|可选|指定输出路径，生成AC列表文件|
|--parallelism|可选|explain和解析SQL的并行度，范围为1-16，默认为1|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 规格](#41-规格)  

1. 谓词列作为X，投影列作为Y
1. 没有谓词列使用    `on only`    只添加Y列
1. 新建AC的XY列不能和已有AC的XY列重复
1. 投影列和谓词列有列重复时，去重，投影列优先
1. 自动生成不存在且不重复的AC名称


###   [4.2 限制](#42-限制)  

1. 暂不支持推荐跨表AC
1. 历史SQL仅限于PlanCache(v$sqlarea)中保存的
1.   `v$sqlarea`    暂不支持    `sql_fulltext`    ，使用    `sql_text`    只能解析小于1000字符的SQL，超过则忽略，等支持    `sql_fulltext`    字段后支持解析超过1000字符的完整SQL
1. 目前只支持针对LSC表AC，其他类型的表暂时忽略
1. 发现的AC暂时只针对X, Y列，    `bound`    ，    `include`    ，    `filter`    等暂不涉及
1. SQL文件中默认schema为SYS，若使用SQL文件作为输入，则除SYS用户外需指明表的schema
1. 忽略    `select *`    ，    `select count(*)`    等无投影列的SQL语句
1. 投影列 + 谓词列 <= 31
1. 指定的SQL文件限制默认大小为200M，SQL条数为100万条，yasdb.env中可配置


###   [4.3 待设计](#43-待设计)  

- AC代价估算
- 并集选择，同一张表多个SQL语句，多个AC合并AC的设计


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

####   [5.1.1 交互关系](#511-交互关系)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a0e8970c2af4f51fbb3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFJQUFRQUFBUUVBQ2dBSUFBRUFBQUFBUUFBQUFBQkFBQ0FBQUFCQUFBQUlBQUFBQUFBRkFBQUFBQWdBQUFBQUFBRUFBQUFBQUFBSUFBQUFDQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTEzMDAsImV4cCI6MTc4MjIyMjEwMH0.5aACmy_GKt_jm6mLIYc06gtxPSDpEmj6eYLAcoqJq6M)

####   [5.1.2 OM架构](#512-om架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a0e8970c2af4f51fbb4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFJQUFRQUFBUUVBQ2dBSUFBRUFBQUFBUUFBQUFBQkFBQ0FBQUFCQUFBQUlBQUFBQUFBRkFBQUFBQWdBQUFBQUFBRUFBQUFBQUFBSUFBQUFDQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTEzMDAsImV4cCI6MTc4MjIyMjEwMH0.5aACmy_GKt_jm6mLIYc06gtxPSDpEmj6eYLAcoqJq6M)

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 整体流程](#521-整体流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a0ea1ad9a3311dc7a29/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFJQUFRQUFBUUVBQ2dBSUFBRUFBQUFBUUFBQUFBQkFBQ0FBQUFCQUFBQUlBQUFBQUFBRkFBQUFBQWdBQUFBQUFBRUFBQUFBQUFBSUFBQUFDQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTEzMDAsImV4cCI6MTc4MjIyMjEwMH0.5aACmy_GKt_jm6mLIYc06gtxPSDpEmj6eYLAcoqJq6M)

1. 从v$sqlarea或文件中获取SQL
1. 解析SQL
1. 获取数据库统计信息
1. 过滤不符合条件的SQL
1. 代价计算，对AC进行评估（暂未设计）
1. 并集选择，是否合并同一个表的多条AC的评估（暂未设计）
1. 生成AC列表
1. 根据代价信息进行推荐排序
1. 返回并输出在客户端


####   [5.2.2 获取SQL并解析](#522-获取sql并解析)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a0ea1ad9a3311dc7a2a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFJQUFRQUFBUUVBQ2dBSUFBRUFBQUFBUUFBQUFBQkFBQ0FBQUFCQUFBQUlBQUFBQUFBRkFBQUFBQWdBQUFBQUFBRUFBQUFBQUFBSUFBQUFDQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTEzMDAsImV4cCI6MTc4MjIyMjEwMH0.5aACmy_GKt_jm6mLIYc06gtxPSDpEmj6eYLAcoqJq6M)

1. 若提供SQL文件，则读取文件获得SQL语句集，过滤非查询语句
1. 若为提供SQL文件，从    `v$sqlarea`    中获取历史SQL，由于    `v$sqlarea`    暂未支持    `sql_fulltext`    ，    `sql_text`    最大只存1000个字符
1. 使用yasparse解析SQL，生成SQL信息的集合


####   [5.2.3 过滤SQL信息集合](#523-过滤sql信息集合)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a0e8970c2af4f51fbb5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFJQUFRQUFBUUVBQ2dBSUFBRUFBQUFBUUFBQUFBQkFBQ0FBQUFCQUFBQUlBQUFBQUFBRkFBQUFBQWdBQUFBQUFBRUFBQUFBQUFBSUFBQUFDQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTEzMDAsImV4cCI6MTc4MjIyMjEwMH0.5aACmy_GKt_jm6mLIYc06gtxPSDpEmj6eYLAcoqJq6M)

1. 上一步SQL解析已获取SQL信息集合
1. 获取已存在表和已存在AC信息
1. 合并相等或包含关系的列组合
1. 过滤非LSC表的SQL
1. 已存在AC对新AC为相等或包含关系，则过滤


####   [5.2.4 AC代价估算](#524-ac代价估算)  

待设计

####   [5.2.5 AC并集选择](#525-ac并集选择)  

待设计

###   [5.3 DFX设计](#53-dfx设计)  

- AC推荐中间过程展现，用于内部调试，可在日志中查看（代价估算和并集选择暂未设计，目前没有额外设计中间过程展现）
- 代价计算公式作为接口，要考虑做到容易升级替换


###   [5.4 信息查询](#54-信息查询)  

1. 查询表类型


```
select table_type from sys.dba_tables where owner='SYS' and table_name='TEST01';

```

1. 查询Cache中的历史查询SQL


```
select sql_text, parsing_schema_name from v$sqlarea where upper(sql_text) like 'SELECT%' and length(sql_text)&lt;1000 and executions&gt;0;

```

1. 查询用户object id


```
select user# from sys.user$ where name='SYS' and type#=1;

```

1. 查询表object id


```
select obj# from sys.obj$ where owner#=3 and name='TEST01' and type#=1;

```

1. 查询ACID


```
select id# from sys.ac$ where table#=1819;

```

1. 查询AC的列名


```
select exprtext from sys.accol$ where acid#=1821;

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 创建用户及相关表


```
create user yasom identified by yasom;
create user "yasom" identified by yasom;
create user "YasOM" identified by yasom;
create table yasom.test01(a int, b int, c int, d int) organization lsc;
create table "yasom".test01(a int, b int, c int, d int) organization lsc;
create table "yasom"."test01"(a int, b int, c int, d int) organization lsc;
create table "YasOM".test02(a int, b int, c int, d int) organization lsc;
create table "YasOM"."TesT02"(a int, b int, c int, d int) organization lsc;
create table yasom.test03(a int, b int, c int, d int) organization lsc;
create table yasom.test04(a int, b int, c int, d int) organization lsc;

```

- SQL文件查询语句


```
select a, b from yasom.test01 where c=2 and d=3;
select a from "yasom".test01 where b=3 and d=7;
select b from "yasom"."test01" where c=1;
select c from "YasOM".test02 where b=2 and c=1;
select d from "YasOM"."TesT02";
select a+1, 1 from yasom.test03 where d=3;
select c, b from yasom.test03;
select c, d from yasom.test04 where a=(select max(b) from yasom.test04);

```

- 执行命令


```
$ ./yasboot ac discovery -c minidb -f ac.sql

```

结果：

```
 Schema | Table  | Statement
------------------------------------------------------------------------------------------------------------------------
 YASOM  | TEST01 | CREATE ACCESS CONSTRAINT YASOM.YASOM_TEST01_AC1 FROM YASOM.TEST01 ON C,D TO A,B;
--------+--------+------------------------------------------------------------------------------------------------------
 YASOM  | TEST03 | CREATE ACCESS CONSTRAINT YASOM.YASOM_TEST03_AC1 FROM YASOM.TEST03 ON D TO A;
--------+--------+------------------------------------------------------------------------------------------------------
 YASOM  | TEST03 | CREATE ACCESS CONSTRAINT YASOM.YASOM_TEST03_AC2 FROM YASOM.TEST03 ON ONLY C,B;
--------+--------+------------------------------------------------------------------------------------------------------
 YASOM  | TEST04 | CREATE ACCESS CONSTRAINT YASOM.YASOM_TEST04_AC1 FROM YASOM.TEST04 ON A TO C,D,B;
--------+--------+------------------------------------------------------------------------------------------------------
 YasOM  | TEST02 | CREATE ACCESS CONSTRAINT "YasOM".YASOM_TEST02_AC1 FROM "YasOM".TEST02 ON B TO C;
--------+--------+------------------------------------------------------------------------------------------------------
 YasOM  | TesT02 | CREATE ACCESS CONSTRAINT "YasOM".YASOM_TEST02_AC2 FROM "YasOM"."TesT02" ON ONLY D;
--------+--------+------------------------------------------------------------------------------------------------------
 yasom  | TEST01 | CREATE ACCESS CONSTRAINT "yasom".YASOM_TEST01_AC2 FROM "yasom".TEST01 ON B,D TO A;
--------+--------+------------------------------------------------------------------------------------------------------
 yasom  | test01 | CREATE ACCESS CONSTRAINT "yasom".YASOM_TEST01_AC3 FROM "yasom"."test01" ON C TO B;
--------+--------+------------------------------------------------------------------------------------------------------


```

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7. TODO（遗留问题）](#7-todo遗留问题)  

## Attachments:

[flow-chart02.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMGRhMWFkOWEzMzExZGM3YTI2IiwicmVmX2lkIjoiNjczOTZhMGQ3MjgyMDZlZmI5MmVmYTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExMzAwLCJleHAiOjE3ODIyOTc3MDB9.yGPhZ3f73knNDF0l1ozB3GKgK9gfPMyp_4kW1Ii6EkE)

 (image/png)    


[flow-chart01.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMGQ4OTcwYzJhZjRmNTFmYmIxIiwicmVmX2lkIjoiNjczOTZhMGQ3MjgyMDZlZmI5MmVmYTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExMzAwLCJleHAiOjE3ODIyOTc3MDB9.ASQAmNZjmCtGJAjSCs41hvERkLEWjw4Y6wfJWV2auXY)

 (image/png)    


[architecture.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMGRhMWFkOWEzMzExZGM3YTI3IiwicmVmX2lkIjoiNjczOTZhMGQ3MjgyMDZlZmI5MmVmYTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExMzAwLCJleHAiOjE3ODIyOTc3MDB9.nM7fRcrs9_Phj53SfK2JYtYKqy7UzTKntkcBGJwe8U4)

 (image/png)    


[sequence01.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMGQ4OTcwYzJhZjRmNTFmYmIyIiwicmVmX2lkIjoiNjczOTZhMGQ3MjgyMDZlZmI5MmVmYTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExMzAwLCJleHAiOjE3ODIyOTc3MDB9.lAgTfcVaoYFKbak_MN-fhxDu4olWBD78lz5ewdTGvtE)

 (image/png)    


[relation.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMGVhMWFkOWEzMzExZGM3YTI4IiwicmVmX2lkIjoiNjczOTZhMGQ3MjgyMDZlZmI5MmVmYTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExMzAwLCJleHAiOjE3ODIyOTc3MDB9.d5_Qivs9Hm2KQ4mCeqMy58u_KRfZuflKWsaYBVsMf10)

 (image/png)    
