Created by 赵忠源 on 十一月 28, 2023

*详细设计-YDBRD-23321*

*支持字母d表示数据类型为binary_double Design*

* IR链接：*    [YDBRD-23244](https://jira.yasdb.com/browse/YDBRD-23244?src=confmacro)    *-*  *执行SQL语句设置binary_double列的值后会加个d，如set col1=12.123d*  *验收中*

*SR链接：*    [YDBRD-23321](https://jira.yasdb.com/browse/YDBRD-23321?src=confmacro)    *-*  *支持数据类型为binary_double列的常量值形式*  *完成*

##   [1. 总述](#1-总述)  

数值类型后附字母d，表示将数据类型设置为binary_double主要用于数值类型兼容

###   [1.1 需求来源](#11-需求来源)  

外场需求

###   [1.2 调研文档](#12-调研文档)  

调研文档见    [https://conf.yasdb.com/pages/viewpage.action?pageId=135612163](https://conf.yasdb.com/pages/viewpage.action?pageId=135612163)  

###   [1.3 需求分析](#13-需求分析)  

数值类型后带字母d的时候，表示数据类型应设置为binary_double    
  在多种应用场景（如filter、column），都统一表示数值类型为binary_double

##   [2. 接口](#2-接口)  

```
typedef enum EnLexNumberType {
    LNUM_INTEGER = 1,
    LNUM_BIGINT,
    LNUM_NUMBER,
    LNUM_HEX,
    LNUM_DOUBLE,
} LexNumberType;

```

##   [3. 规格与约束](#3-规格与约束)  

1. Oracle将'd'/'D'后的部分作为别名处理，Yasdb目前作拦截报错
1. Oracle中带d数值位于orderby不起作用，Yasdb仍作为binary_double处理
1. Oracle的create table列中带d报错，Yasdb正常create


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

lexer解析中对于字符'd'/'D'做特殊处理，增加LNUM_DOUBLE作为lexer新数据类型标志    
  当number解析中出现'd'/'D'，将数据类型标志置为LNUM_DOUBLE，后续将把数据类型转换为binary_double处理

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```
create table test (col int);
insert into test values(101d);
create table test (col number(10));
insert into test values(101d);
create table test (col clob);
insert into test values(101d);
select * from test where 101d = col;
delete from test where col = 39d;
update test set col = 2 where col = 1d;
update test set col = 2d where col = 1;
update test set col = 301d where col = 1d;
select 89d from dual;
alter session set time_zone = '13:00d';
create table test(name varchar(30d));
create table test(name number(30d));
create indexselect cast(101d as number(10)) from dual;
select cast('101d' as number(10)) from dual;
select cast(093d as float) from dual;
select cast(093d as int) from dual;
select 1 from test where col in (select 039d from test);
select 1 from test where col in (select 39 from test where col = 039d);
select * from test order by 1d;
select count(b) ,count(a) from ttl group by 1d;
select 1+3d from dual;
select 1*3d-2D from dual;
select avg(11d),round(33.53d) from dual;&nbsp;

```

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2023-11-22_10-47-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODhhMWFkOWEzMzExZGM4YjBlIiwicmVmX2lkIjoiNjczOTZjODg3MjgyMDZlZmI5MmYxM2I3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNTA4LCJleHAiOjE3ODIzODc5MDh9.wppuK-vQCM_ZqLD7shX5eUL63eijyR5FJYtgxSlju7Y)

 (image/png)    
