Created by 赵忠源, last modified on 十二月 12, 2023

IR链接：    [YDBRD-8158](https://jira.yasdb.com/browse/YDBRD-8158?src=confmacro)    -  支持UNISTR函数  完成

SR链接：    [YDBRD-21729](https://jira.yasdb.com/browse/YDBRD-21729?src=confmacro)    -  支持UNISTR函数  完成

#   [YDBRD-21729 : UNISTR Design（UNISTR方案设计）](#ydbrd-21729--unistr-designunistr方案设计)  

##   [1. Overview（概述）](#1-overview概述)  

实现Unistr函数，支持将源字符串中Unicode部分转换为对应字符并返回nvarchar类型字符串

Unistr调研文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=130142981](https://conf.yasdb.com/pages/viewpage.action?pageId=130142981)  

需要场景为：

1、单机和集群

2、行表

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 基础语法](#21-基础语法)  

![](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/img/unistr.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NjMsImV4cCI6MTc4MjMxMDI2M30.PEzxVuIoK3Ql78DpnjeB_FgB6NIADLTBiyPd-6M28h4)

UNISTR(string);

###   [2.2 功能概述](#22-功能概述)  

UNISTR将文本文字或解析为字符数据的表达式转换成对应的文本形式并以NVARCHAR的形式返回

非Unicode编码部分的字符保留原型

数据库的国家字符集可以是 AL16UTF16 或 UTF8

Unicode 编码值的格式为“\xxxx”，其中“xxxx”是 UCS-2 编码格式的字符的十六进制值。增补字符被编码为两个代码单元，第一个来自高代理范围（U+D800 到 U+DBFF），第二个来自低代理范围（U+DC00 到 U+DFFF）

如若要将反斜杠包含在字符串本身中，需在其前面加上另一个反斜杠

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult bifVerifyUnistr(AnlVerifier* vrfr, ExprNode* node);  

CodResult bifExecUnistr(AnlStmt* stmt, ExprNode* func, Variant* retValue);  

CodResult bifConcludeUnistr(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);  

CodResult codGetUnistr(CodText* currText, CodText* resText, CodUint16 envCharset);

CodResult codUcs2Hex2Uni(CodText *currText, CodUint32 scanPos);


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 规格](#41-规格)  

**String**

支持INT,FLOAT,NUMBER，SMALLINT，BIGINT等数值类型，实质为转换为数字对应的字符串做转化

支持char/varchar2/date/timestamp,NCHAR,NVARCHAR2等字符串或能转换成字符串类型，支持CLOB,NCLOB.但不支持LOB的outline部分

|  
|INT|FLOAT|DOUBLE|NUMBER|SMALLINT|BIGINT|CHAR|VARCHAR|NCHAR|NVARCHAR|CLOB|NCLOB|BLOB|date|time|timestamp|bit|raw|boolean|json|
|:---:|:---:|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|**String**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|**√**,**（不支持LOB类型outline部分）**|**√**,**（不支持LOB类型outline部分）**|**√**,**（不支持LOB类型outline部分）**|**√**|**√**|**√**|**√**|**√**|**√**|**√**|


###   [4.2 约束差异](#42-约束差异)  

1. YashanDB对national char的处理上与Oracle不一致


YashanDB存储UTF16使用小端存储，Oracle使用大端存储，由于unistr对national char的处理是将string逐字节转换为UTF16编码，在此处大小端主要影响字符内字节顺序，

而影响national char类型通过unistr函数转换的结果。

1. 对于四字节字符的处理，Oracle表现为正常转换，但字符长度按原字符长度x2计算，可能导致部分截断


YashanDB下对结果字符串长度正确计算，表现与Oracle不保持一致

1. 常量多层嵌套场景下，YanshanDB与Oracle不同
1. Oracle下，Unistr对常量多层嵌套规则如下：
    1. 第一层先做Unistr，得到返回字符串str和长度len；
    1. 之后每次嵌套都对str做Unisr，但只保留前len位（len固定为第一次Unistr函数结果）
1. 函数嵌套最后返回对应结果的前len位
1. 对于常量的处理，YashanDB的规则如下：
    1. 第一次Unistr后返回的类型应为nvarchar，
    1. 后续Unistr实际为持续对nvarchar做Unistr，长度应随嵌套层数每次x2，上限为原常量长度x2（常量）或列的最大长度x2（列），超出长度部分截断


  


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

函数主要检测关键字'\'，并对'\'后合法的'\'或4个合法的16进制数做转换，调用codGetunistrHex2Uni得到unicode编码对应的字符值

其他对于其他部分进行以下处理：

1. 普通字符直接转为unicode编码存储；
1. 对NCHAR/NVARCHAR字符以单字节为单位逐个处理，表现结果部分与Oracle不同
1. 对于NCLOB的处理与CHAR/VARCHAR相同，此处与Oracle对齐
1. 对于非UTF16编码下的字符，与Oracle对齐，对于超出有效范围的部分返回非法字符（255，253）


最后返回nvarchar类型的结果字符串

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```

SELECT UNISTR('aaaa1524132213221321123aaa\5d16\\\\\11111') FROM dual;
SELECT UNISTR('aaaa1524132213123221321123aaa\5d16\\\\\11111') FROM dual;
SELECT UNISTR('aaaa1524132\\\\21\\\3123221321123aaa\5d16\\\\\11111') FROM dual;

SELECT UNISTR('\5d16\5c71') FROM sys.DUAL;
SELECT UNISTR('\\5d16\5c71') FROM sys.DUAL;
SELECT UNISTR('\\\5d16\5c71') FROM sys.DUAL;
SELECT UNISTR('\\\\5d16\5c71') FROM sys.DUAL;
SELECT UNISTR('5d16\5c71') FROM sys.DUAL;
SELECT UNISTR('\5g16\5c71') FROM sys.DUAL;
SELECT UNISTR('\6116\5c71') FROM sys.DUAL;
SELECT UNISTR(NULL) FROM sys.DUAL;
SELECT UNISTR(NULL+1) FROM sys.DUAL;
SELECT UNISTR('NULL') FROM sys.DUAL;
SELECT UNISTR(',.;""') FROM sys.DUAL;

drop table if exists buildin2_Unistr_test;
CREATE TABLE buildin2_Unistr_test
(
    c1 INT,
    c2 CHAR(50),
    c3 VARCHAR2(50),
    c4 NCHAR(50),
    c5 NVARCHAR2(50),
    c6 NUMBER,
    c7 FLOAT,
    C8 CLOB,
    C9 NCLOB,
    c10 BLOB,
    c11 raw(256),
    c12 timestamp,
    c13 json
);

insert into buildin2_Unistr_test values (1,'\5d16\5c71','\5d16\5c71','\5d16\5c71','\5d16\5c71',1234.321,1254.4521,'\5d16\5c71','\5d16\5c71','100001','100001','1949-10-1','{"name":"John", "age":30, "city":"New York"}');

SELECT UNISTR(C1),LENGTHB(C1),TYPEOF(UNISTR(C1)) FROM buildin2_Unistr_test;
SELECT UNISTR(C2),LENGTHB(C2),TYPEOF(UNISTR(C2)) FROM buildin2_Unistr_test;
SELECT UNISTR(C3),LENGTHB(C3),TYPEOF(UNISTR(C3)) FROM buildin2_Unistr_test;
SELECT UNISTR(C4),LENGTHB(C4),TYPEOF(UNISTR(C4)) FROM buildin2_Unistr_test;
SELECT UNISTR(C5),LENGTHB(C5),TYPEOF(UNISTR(C5)) FROM buildin2_Unistr_test;
SELECT UNISTR(C6),LENGTHB(C6),TYPEOF(UNISTR(C6)) FROM buildin2_Unistr_test;
SELECT UNISTR(C7),LENGTHB(C7),TYPEOF(UNISTR(C7)) FROM buildin2_Unistr_test;
SELECT UNISTR(C8),LENGTHB(C8),TYPEOF(UNISTR(C8)) FROM buildin2_Unistr_test;
SELECT UNISTR(C9),LENGTHB(C9),TYPEOF(UNISTR(C9)) FROM buildin2_Unistr_test;
SELECT UNISTR(C10),LENGTHB(C10),TYPEOF(UNISTR(C10)) FROM buildin2_Unistr_test;
SELECT UNISTR(C11),LENGTHB(C11),TYPEOF(UNISTR(C11)) FROM buildin2_Unistr_test;
SELECT UNISTR(C12),LENGTHB(C12),TYPEOF(UNISTR(C12)) FROM buildin2_Unistr_test;
SELECT UNISTR(C13),LENGTHB(C13),TYPEOF(UNISTR(C13)) FROM buildin2_Unistr_test;

drop table if exists buildin2_Unistr_test;

SELECT UNISTR(CAST('12345678901' AS NCHAR(20))) FROM sys.DUAL;
SELECT UNISTR(CAST('崖山12345' AS NVARCHAR2(20))) FROM sys.DUAL;


SELECT CAST('崖山12345' AS NVARCHAR2(20)) FROM sys.DUAL;

drop table if exists buildin2_Unistr_test;
CREATE TABLE buildin2_Unistr_test
(
    c1 NCHAR(50),
    c2 NVARCHAR2(50)
);

insert into buildin2_Unistr_test values ('崖山12345','崖山12345');

SELECT lengthb(c1),lengthb(UNISTR(c1)) FROM buildin2_Unistr_test;
SELECT lengthb(c2),lengthb(UNISTR(c2)) FROM buildin2_Unistr_test;


SELECT UNISTR('aaaa1524132213221321123aaa\5d16\\\\\11111') FROM sys.dual;
SELECT UNISTR('aaaa1524132213123221321123aaa\5d16\\\\\11111') FROM sys.dual;
SELECT UNISTR('aaaa1524132\\\\21\\\3123221321123aaa\5d16\\\\\11111') FROM sys.dual;
SELECT UNISTR('实现Unistr函数，支持将\6e90\5B57\7B26\4E32中Unicode部分转换为对应字符并返回nvarchar类型字符串') FROM sys.dual;
SELECT UNISTR('\5d16\5c71\6570\636E\5e93') FROM sys.dual;


select unistr(cast('7f' as blob)) from  dual;
select unistr(cast('8f' as blob)) from  dual;
select unistr(cast('9f' as blob)) from  dual;
select unistr(cast('af' as blob)) from  dual;
select unistr(cast('bf' as blob)) from  dual;
select unistr(cast('cf' as blob)) from  dual;
select unistr(cast('df' as blob)) from  dual;
select unistr(cast('ef' as blob)) from  dual;
select unistr(cast('ff' as blob)) from  dual;


```

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-11-14_9-52-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmJhMWFkOWEzMzExZGM4ODFmIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9._FEL4af2e5DJAlZFh9fJfd1rv4Z_9XC-TToKODpcSsQ)

 (image/png)    


[image2023-11-14_9-53-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmJhMWFkOWEzMzExZGM4ODIwIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.NYk_X6UoMuhVqHJDWPx79zJdQji_tWAnO9TP5al9d4I)

 (image/png)    


[image2023-11-14_9-53-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmJhMWFkOWEzMzExZGM4ODIxIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.DTk2grlYlyz_532B5lxUNHBvS9KtarYKutQdXeQcnAU)

 (image/png)    


[image2023-11-14_9-59-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmI4OTcwYzJhZjRmNTIwOWIxIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.kGDI2H7gzW7abPHntXzdiMpMkf9X8Jy7hrFnNggba6g)

 (image/png)    


[image2023-11-14_10-5-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmJhMWFkOWEzMzExZGM4ODIyIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.L2ZqbjWB5HJZG9NY1lQcM17rlREZhUusvndJM8t0fa8)

 (image/png)    


[image2023-11-14_10-5-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmJhMWFkOWEzMzExZGM4ODIzIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.-gDX60x9k19qufdVo5eMtYNTQOI7cT-HNF2kXyx581E)

 (image/png)    


[image2023-11-14_10-15-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmI4OTcwYzJhZjRmNTIwOWI1IiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.JfluToLMpc-f5f0Pld22Jq_Of_Poq1PrYHiX0F3af-g)

 (image/png)    


[image2023-11-14_10-15-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmJhMWFkOWEzMzExZGM4ODI1IiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.Hv59VTkjc71W9zY3NmnRv-jVMCdjpfxubwfIytrJndY)

 (image/png)    


[image2023-11-14_10-16-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmI4OTcwYzJhZjRmNTIwOWI3IiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.OSndMahdcUQZZPO3tIWKM5d7cKx4ZAdHK0xeH5sYYpw)

 (image/png)    


[image2023-11-20_10-54-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmJhMWFkOWEzMzExZGM4ODI2IiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.y1asZMGELNgRcb_QQFpBtytqNXzuNHhIIDg7IFsAWQE)

 (image/png)    


[image2023-11-16_19-46-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmM4OTcwYzJhZjRmNTIwOWI5IiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.F8sjl2_FZrMY2bEYKalcX8HKyDOabtK5Jh0IHRZfOfM)

 (image/png)    


[image2023-11-16_19-30-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmNhMWFkOWEzMzExZGM4ODI4IiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.1FbLgxW_i5DfFuENRpJkSPSEvzQr8uXDalBv-MnCtPY)

 (image/png)    


[image2023-11-16_19-48-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmNhMWFkOWEzMzExZGM4ODI5IiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.-3GyGaCkPkKx_FEONstVc76ZcA8aKY-_MVNPn-2w_zg)

 (image/png)    


[image2023-11-20_16-59-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmNhMWFkOWEzMzExZGM4ODJhIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.4Woea3-dhlQ4657m75BjzX3CH89UY69TEnqXQ9yDd7Q)

 (image/png)    


[image2023-11-20_11-35-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmNhMWFkOWEzMzExZGM4ODJiIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.7q4WNfi1Rygejn_vpVFJozd0ulMxoN276HG58kSKGXc)

 (image/png)    


[image2023-11-20_11-35-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmM4OTcwYzJhZjRmNTIwOWJlIiwicmVmX2lkIjoiNjczOTZjMmI1OTNmOTljOWZmMjM2YjI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDYzLCJleHAiOjE3ODIzODU4NjN9.RU9vdkM0dzjVMYnYhePu0vfsvI1BLuGcByh8eJzSyKk)

 (image/png)    


## Comments:

|  [](null)  ,1. 崖山db现ncharset不支持设置UTF-8，默认不支持UTF-8下部分
1. unistr入参部分的类型统一向数据库charset对齐，基本与Oracle相同
1. 长度部分按实际字符长度计算（与Oracle不同）
,Posted by zhaozhongyuan at 十月 24, 2023 18:27|
|---|
