Created by 赵忠源, last modified on 十一月 02, 2023

IR链接：    [YDBRD-22185](https://jira.yasdb.com/browse/YDBRD-22185?src=confmacro)    -  支持sys_extract_utc函数  验收中

SR链接：    [YDBRD-22347](https://jira.yasdb.com/browse/YDBRD-22347?src=confmacro)    -  支持sys_extract_utc函数  完成

#   [YDBRD-22185 : SYS_EXTRACT_UTC Design（SYS_EXTRACT_UTC函数方案设计）](#ydbrd-22185--sys-extract-utc-designsys-extract-utc函数方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-22185](https://jira.yasdb.com/browse/YDBRD-22185)  

##   [1. Overview（概述）](#1-overview概述)  

SYS_EXTRACT_UTC函数主要用于将输入的timestamp转换成UTC（原格林尼治标准时间）对应的时间返回

Oracle文档：    [https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/SYS_EXTRACT_UTC.html#GUID-C540A8C8-72B1-46AF-A9AA-18D011763AD8](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/SYS_EXTRACT_UTC.html#GUID-C540A8C8-72B1-46AF-A9AA-18D011763AD8)  

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 基础语法](#21-基础语法)  

语法图

![](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/img/sys_extract_utc.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkzOTAsImV4cCI6MTc4MjMxMDE5MH0.jp6hJXteRLjEjdzvsVbxxE-SrJ0JyJ-2EA9HZsZ9gDk)

SYS_EXTRACT_UTC(datetime);

###   [2.2 功能特性](#22-功能特性)  

SYS_EXTRACT_UTC从带有时区偏移或时区区域名称的日期时间值中提取 UTC（原格林尼治标准时间）    
  如果未指定时区，则日期时间与会话时区关联。

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult bifVerifySysExtractUTC(AnlVerifier* vrfr, ExprNode* node);  

CodResult bifExecSysExtractUTC(AnlStmt* stmt, ExprNode* func, Variant* retValue);  

CodResult bifConcludeSysExtractUTC(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);  

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

本函数仅支持Timestamp类型，入参和出参都为Timestamp类型

崖山Timestamp类型目前只支持基础功能，对于TIMESTAMP WITH TIME ZONE，TIMESTAMP WITH LOCAL TIME ZONE 暂不支持，目前为转换时拦截

22.2版本下绑定参数框架限制，允许其他类型输入转换成Timestamp（如varchar的string），无法拦截    
  23.2下框架修改已经支持拦截

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

目前Timestamp类型暂不支持时区，根据需求使用场景，暂只实现对UTC+8时区的函数支持。

对于输入的datetime，调用codDateTZ2UTC函数，将源Timestamp加上/减去时区偏移

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
CREATE TABLE TEST_EXTRACT(C1 TIMESTAMP);

INSERT INTO TEST_EXTRACT VALUES('2000-01-12 8:00:00');
INSERT INTO TEST_EXTRACT VALUES('2000-01-12 0:00:00');
INSERT INTO TEST_EXTRACT VALUES('2000-01-12 16:00:00');

SELECT SYS_EXTRACT_UTC(C1) FROM TEST_EXTRACT;

SELECT SYS_EXTRACT_UTC(timestamp'2000-01-01 0:00:00') FROM dual;
SELECT SYS_EXTRACT_UTC(timestamp'2000-02-01 0:00:00') FROM dual;
SELECT SYS_EXTRACT_UTC(timestamp'2000-01-12 0:00:00') FROM dual;
SELECT SYS_EXTRACT_UTC(timestamp'2000-01-12 4:00:00') FROM dual;
SELECT SYS_EXTRACT_UTC(timestamp'2000-01-01 4:00:00') FROM dual;
SELECT SYS_EXTRACT_UTC(timestamp'2000-02-01 4:00:00') FROM dual;

```

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*