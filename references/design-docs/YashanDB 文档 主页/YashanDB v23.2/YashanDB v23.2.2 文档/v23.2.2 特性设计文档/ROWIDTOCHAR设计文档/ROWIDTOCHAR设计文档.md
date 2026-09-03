Created by 赵忠源 on 四月 08, 2024

*X详细设计-YDBRD-29579 : ROWIDTOCHAR Design*

* IR链接：*    [YDBRD-28586](https://jira.yasdb.com/browse/YDBRD-28586?src=confmacro)    *-*  *支持ROWIDTOCHAR函数*  *设计中*

*SR链接：*    [YDBRD-29579](https://jira.yasdb.com/browse/YDBRD-29579?src=confmacro)    *-*  *支持ROWIDTOCHAR函数*  *设计中*

![](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/img/rowidtochar.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMzgsImV4cCI6MTc4MjMxNDEzOH0.IqGfUZWqmOPctRpxqCvc9Vpg0NjiLiT83bmQ6dfQIiY)

##   [1. 总述](#1-总述)  

实现ROWIDTOCHAR函数

需求范围：    
  1、单机、集群和分布式    
  2、行表

###   [1.2 调研文档](#12-调研文档)  

ROWIDTOCHAR调研文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=147772336](https://conf.yasdb.com/pages/viewpage.action?pageId=147772336)  

###   [1.3 需求分析](#13-需求分析)  

实现适用于Yasdb的转换函数ROWIDTOCHAR，将输入的ROWID类型参数转换为VARCHAR类型返回

##   [2. 接口](#2-接口)  

```
CodResult bifVerifyRowidToChar(AnlVerifier* vrfr, ExprNode* node);
CodResult bifConcludeRowidToChar(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);
CodResult bifExecRowidToChar(AnlStmt* stmt, ExprNode* node, Variant* retValue);

```

##   [3. 规格与约束](#3-规格与约束)  

###   [3.1 函数规格](#31-函数规格)  

入参仅支持字符串类型及rowid类型，不支持其他类型

返回类型为VARCHAR

###   [3.2 约束](#32-约束)  

YasDB的ROWID整体与Oracle存在差异,本函数仅基于YasDB规则做对应转换。

##   [4. 特性](#4-特性)  

1. ROWIDTOCHAR函数将入参rowid转换为VARCHAR类型返回
1. 根据yasdb的ROWID设计，各模块范围为dataoid[0，18446744073709551616)，spaceid[0，2048), fileid[0,64), blockid[0,67108864), dir[0,4096)
1. 返回长度最少为9位(0:0:0:0:0)，最多为42位(18446744073709551615:2047:63:67108863:4095)。
1. 当rowid为NULL时返回NULL
1. 转换失败时报错


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```
select rowidtochar(NULL) from sys.dual;
select rowidtochar() from sys.dual;
select rowidtochar('') from sys.dual;
select rowidtochar('1234:0:0:0:0') from sys.dual;
select rowidtochar('18446744073709551616:0:0:0:0') from sys.dual;
select rowidtochar('0:2048:0:0:0') from sys.dual;
select rowidtochar('0:0:64:0:0') from sys.dual;
select rowidtochar('0:0:0:67108864:0') from sys.dual;
select rowidtochar('0:0:0:0:4096') from sys.dual;
select rowidtochar('18446744073709551615:2047:63:67108863:4095')) from sys.dual;
select rowidtochar('2368:0:0:3164:0')) from sys.dual;
select rowidtochar('::::') from sys.dual;
select rowidtochar('0::::') from sys.dual;

select rowidtochar('','') from sys.dual;
select rowidtochar('1234:0:0:0:0','') from sys.dual;

select rowidtochar(cast('yashan1234' as nvarchar2(20))) from sys.dual;
select rowidtochar(cast('18446744073709551615:2047:63:67108863:4095' as nvarchar2(20))) from sys.dual;
select rowidtochar(cast('18446744073709551616:2047:63:67108863:4095' as nvarchar2(20))) from sys.dual;
select rowidtochar(cast('0:0:0:0:0' as nvarchar2(20))) from sys.dual;

select length(rowidtochar('1234:0:0:0:0')) from sys.dual;
select length(rowidtochar('0:0:0:0:0')) from sys.dual;
select length(rowidtochar('yashan1234')) from sys.dual;


drop table if exists test_func_rowidtochar_tb;
create table test_func_rowidtochar_tb(c0 int,c1 char(60),c2 varchar2(60),c3 nchar(60),c4 nvarchar2(60),c5 double,c6 float,c7 rowid,c8 clob,c9 nclob,c10 blob);
insert into test_func_rowidtochar_tb values(10, '崖山1234', '崖山1234', '崖山1234', '崖山1234', 123.23e2, 123.23e1, '2368:0:0:3164:0','2368:0:0:3164:0','2368:0:0:3164:0','1011110');
commit;

select rowidtochar(rowid),length(rowidtochar(rowid)) from test_func_rowidtochar_tb;
drop table if exists test_func_rowidtochar_tb;

```

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,会议纪要：,1.修改IR/SR需求描述,2.ROWID部分与yasdb设计对齐，与Oracle存在差异,Posted by zhaozhongyuan at 四月 08, 2024 11:01|
|---|
