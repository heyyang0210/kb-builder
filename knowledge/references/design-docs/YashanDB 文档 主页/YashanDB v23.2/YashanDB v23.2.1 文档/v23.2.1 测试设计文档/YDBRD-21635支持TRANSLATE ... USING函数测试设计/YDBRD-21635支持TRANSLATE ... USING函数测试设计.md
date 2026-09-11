Created by 徐瑶, last modified by  周彬鑫 on 三月 01, 2024

# 1.   **概述**

本文描述TRANSLATE...USING函数的测试设计

# 2.   **需求分析**

SR：     [YDBRD-21635](https://jira.yasdb.com/browse/YDBRD-21635?src=confmacro)    -  支持TRANSLATE ... USING函数  完成

开发设计文档：    [TRANSLATE...USING Design](TRANSLATE...USING-Design_130141395.html)  

### 2.1 语法图

![](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/img/translate_using.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU5ODIsImV4cCI6MTc4MjMwNjc4Mn0.w1V8Kjf8LxBUYxxIPPyeFcNIwj-LIi7YCbGF10v1c4M)

### **2.2 功能描述**

将输入的字符串转换成用数据库字符集或国家字符集编码的字符串

USING CHAR_CS表示用数据库字符集编码，输出VARCHAR

USING NCHAR_CS表示用国家字符集编码，输出NVARCHAR

1. 支持yanshanDB全部数据类型的字符串转换成VARCHAR或NVARCHAR
1. 输入参数有误时，错误码、报错信息改变，  看是否合理，需刷预期
1. 支持数据的隐式转换（varchar/nvarchar支持的场景，都支持）；
1. 函数作为整体拼接其他不同数据类型，不同单位拼接，需要关注长度（length\lengthb）和返回类型（typeof）是否正确，规格和限制与varchar/nvarchar对齐；
1. 转换后的输出超过返回值规格时，截断显示
1. 不涉及视图和驱动影响（本次不涉及，还是原来的translate函数）
1. 支持数据库的ddl、dml、dql、plsql操作
1. 支持绑定参数（jdbc、plsql都支持）
1. 主要应用场景：CHARACTER_SET=UTF8，NATIONAL_CHARACTER_SET=UTF16  时（  YashanDB支持国家字符集（NATIONAL_CHARACTER_SET）为UTF-16，建库时指定，后续无法更改；  ）  ：


- （1）当字符串的字符集（sql文件）是utf8时，    
  a.char\varchar数据类型using char_cs，不转换原样输出，但typeof查看数据类型是varchar    
  b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出，但typeof查看数据类型是nvarchar    
  c.非char\varchar数据类型using char_cs，转换成功，typeof查看数据类型是varchar    
  d.非nchar\nvarchar数据类型using nchar_cs，转换成功，typeof查看数据类型是nvarchar    
  （2）当字符串的字符集（sql文件）是utf16时：同上    
  （3）当字符串的字符集（sql文件）是其他时（ASCII、GBK、ISO-8859-1）：    
  a.char\varchar数据类型using char_cs，不转换原样输出，但typeof查看数据类型是varchar    
  b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出，但typeof查看数据类型是nvarchar    
  c.非char\varchar数据类型using char_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃    
  d.非nchar\nvarchar数据类型using nchar_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃


需求范围：    
  1、单机和集群    
  2、行表

# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件|有效等价类|编号|无效等价类|编号|
|---|---|---|---|---|
|函数关键字|合法关键字|  
|关键字缺失|  
|
|  
|大写(TRANSLATE)|  
|关键字不全(translat,tranlate)|  
|
|  
|小写|  
|关键字拼写错误(translete,translates)|  
|
|  
|大小写组合(Translate,TransLATE)|  
|带单双引号('translate'('1234' using char_cs)、translate('1234' using 'char_cs'))|  
|
|  
|与表、视图同名(create table translate(c1 int))|  
|  
|  
|
|参数个数|2个|  
|参数个数不匹配（0个/1个/4个）|  
|
|  
|3个(以前translate的用法）|  
|translate（'1234','12' using char_cs）|  
|
|参数类型|常量（'1234' using char_cs）|  
|  
|  
|
|  
|变量,- 列（c1 using char_cs）
- 表达式（c1+c4*2 using char_cs）
|  
|  
|  
|
|  
|子查询|  
|  
|  
|
|  
|函数|  
|  
|  
|
|  
|伪列  rownum|  
|  
|  
|
|数据类型|- 数值型：smallint、tinyint、int、bigint、float、double、number，科学计数法，覆盖  正负边界值、【NaN、-INF、INF】
|  
|超过数值边界范围|  
|
|  
|- 字符型：char、varchar、nchar、nvarchar，覆盖普通字符串、字符串长度边界  、  特殊字符、中文、转义字符、混合字符串、  韩文日文俄文表情包、  空：null、’‘，’   ‘  等
|  
|超过字符串限制规格|  
|
|  
|- 布尔型：  boolean
|  
|  
|  
|
|  
|- 日期型：date、time、timestamp、  INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND
|  
|  
|  
|
|  
|- 大对象：clob、blob、nclob（  outline lob不支持  ）
|  
|outline lob|  
|
|  
|- raw、json、bit类型
|  
|  
|  
|
|函数嵌套|自嵌套127|  
|大于127|  
|
|  
|与其他函数嵌套(cast、to_char、replace等)|  
|  
|  
|
|返回值|- typeof()
,（  USING CHAR_CS输出VARCHAR,USING NCHAR_CS输出NVARCHAR  ）,- 长度  length\lengthb  （  TRANSLATE函数输出字符串的默认长度设置为32000  ）
|  
|  
|  
|
|字符集|sql文件字符集编码与数据库字符集编码&nchar字符集编码相同,- **字符串的字符集（sql文件）是utf8,**  **CHARACTER_SET=UTF8，NATIONAL_CHARACTER_SET=UTF16   ----主要场景**
- 字符串的字符集（sql文件）是utf16,  CHARACTER_SET=UTF8，NATIONAL_CHARACTER_SET=UTF16
|  
|  
|  
|
|  
|sql文件字符集编码与数据库字符集编码和nchar字符集编码不同,- **字符串的字符集（sql文件）是其他时（ASCII、GBK、ISO-8859-1）,**  **CHARACTER_SET=UTF8，NATIONAL_CHARACTER_SET=UTF16   **
|  
|  
|  
|
|dql|投影列|  
|  
|  
|
|  
|filter：in/not in、exists/not exists、between and 、like/not like等|  
|  
|  
|
|  
|分组、排序：group by、having、join on、order by、connect by等|  
|  
|  
|
|  
|在子查询的filter、投影|  
|  
|  
|
|dml|update作为set值以及where条件|  
|  
|  
|
|  
|insert作为value值|  
|  
|  
|
|  
|insert select|  
|  
|  
|
|  
|delete 作为where条件|  
|  
|  
|
|ddl|create table/view时作为列的default值|  
|  
|  
|
|  
|alter时作为列的default值 【alter...add column...】|  
|  
|  
|
|plsql|case、if、for,字符串参数支持绑定参数,jdbc绑定参数|  
|  
|  
|
|其他表类型|临时表,lsc/tac不支持：拦截该函数,分布式拦截|  
|  
|  
|


### 不同字符集交叉测试

- 当字符串的字符集与数据库字符集或nchar字符集相同时
- 当字符串的字符集与数据库字符集和nchar字符集都不同时
-   



> 因为使用execVarConvertSafe函数进行字符集转换，原生支持了各个字符集的转换

> 当字符串编码集与目标编码集相同时（char和char_cs、nchar和nchar_cs），不转换原样输出  当字符串编码集与目标编码集不同时（nchar和char_cs、char和nchar_cs），转换报错

**字符集覆盖：ISO88591覆盖全部字符**

**gbk：**  **8140-FEFE每个范围都覆盖一行**

**utf8：1.全部单字节字符0000-007F（即ascii码） 2.双字节字符每一行覆盖部分字符 0080-07FF  3.三字节字符每一行覆盖一部分字符0800-FFFF  4.四字节字符每行覆盖部分字符**

1.字符串字符集编码与数据库字符集编码&nchar字符集编码相同

|字符串字符集|类型|数据库字符集|nchar字符集|using char_cs|using nchar_cs|
|---|---|---|---|---|---|
|utf8|char\varchar|utf8|utf16|不转换原样输出，typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出，typeof为nvarchar|
||非  char\varchar|||转换成功，typeof为varchar|  
|
||非n  char\nvarchar|||  
|转换成功，typeof为nvarchar|
|utf16|char\varchar|utf8|utf16|不转换原样输出，typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出，typeof为nvarchar|
||非  char\varchar|||转换成功，typeof为varchar|  
|
||非n  char\nvarchar|||  
|转换成功，typeof为nvarchar|
|gbk|char\varchar|gbk|utf16|不转换原样输出，typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出，typeof为nvarchar|
||非  char\varchar|||转换成功，typeof为varchar|  
|
||非n  char\nvarchar|||  
|转换成功，typeof为nvarchar|
|ASCII|char\varchar|ASCII|utf16|不转换原样输出，typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出，typeof为nvarchar|
||非  char\varchar|||转换成功，typeof为varchar|  
|
||非n  char\nvarchar|||  
|转换成功，typeof为nvarchar|
|ISO-8859-1|char\varchar|ISO-8859-1|utf16|不转换原样输出，typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出，typeof为nvarchar|
||非  char\varchar|||转换成功，typeof为varchar|  
|
||非n  char\nvarchar|||  
|转换成功，typeof为nvarchar|


2.字符串字符集编码与数据库字符集编码和nchar字符集编码不同

|字符串字符集|类型|数据库字符集|nchar字符集|using char_cs|using nchar_cs|
|---|---|---|---|---|---|
|ASCII/GBK/ISO-8859-1|char\varchar|utf8|utf16|不转换原样输出（部分显示乱码，覆盖乱码和不乱码的字符），typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出（部分显示乱码，覆盖乱码和不乱码的字符），typeof为nvarchar|
||非  char\varchar|||转换报错，  数据库  不能core|  
|
||非n  char\nvarchar|||  
|转换报错，  不能core|
|utf8|char\varchar|gbk|utf16|不转换原样输出（部分显示乱码，覆盖乱码和不乱码的字符），typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出（部分显示乱码，覆盖乱码和不乱码的字符），typeof为nvarchar|
||非  char\varchar|||转换报错，不能core|  
|
||非n  char\nvarchar|||  
|转换报错，不能core|
|utf8|char\varchar|ASCII|utf16|不转换原样输出，typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出，typeof为nvarchar|
||非  char\varchar|||转换报错，不能core|  
|
||非n  char\nvarchar|||  
|转换报错，不能core|
|utf8|char\varchar|ISO-8859-1|utf16|不转换原样输出，typeof为varchar|  
|
||nchar\nvarchar|||  
|不转换原样输出，typeof为nvarchar|
||非  char\varchar|||转换报错，不能core|  
|
||非n  char\nvarchar|||  
|转换报错，不能core|


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


  


# 5.   **测试用例**

1.测试设计细化后的文本用例

详见附件

[translate..using文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTE4OTcwYzJhZjRmNTIwNWViIiwicmVmX2lkIjoiNjczOTZiYTE3MjgyMDZlZmI5MmYwODVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1OTgyLCJleHAiOjE3ODIzODIzODJ9.R7tIUcL6-qKdifdH2l4OUN0ieCiZoIsQXyIckf1CycU)

**2.加固测试点**

|测试点|等价类|备注|
|---|---|---|
|参数|参数为表达式|  
|
|  
|参数为子查询|  
|
|DML|insert into select|优先级低|
|  
|不带using:insert values/delete/update|优先级低|
|DDL|create materialized view as select|优先级低|
|  
|不带using:create view/table as select|优先级低|
|DQL|不带using:in/not in、exists/not exists、between and 、like/not like、group by、having、join on、order by、connect by、limit、offset|优先级中  |
|  
|CET|优先级中  |
|视图 |视图/物化视图种使用函数 |优先级中  |
|数据类型补充|不带using:nchar/nvarchar/xmltype/json|脚本实现|
|绑定参数|jdbc\plsql|脚本实现|


# 6.   **测试框架设计**

1. 使用guider框架，执行sql文件 对比预期与实际输出结果


# 7.   **测试环境说明**

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机、集群|


## Attachments:

[translate..using文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTE4OTcwYzJhZjRmNTIwNWVjIiwicmVmX2lkIjoiNjczOTZiYTE3MjgyMDZlZmI5MmYwODVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1OTgyLCJleHAiOjE3ODIzODIzODJ9.xdohdzulEBSD3vK8NPxtTgLb7aI-q3UxkmaxLqDZuJs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[translate..using文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTE4OTcwYzJhZjRmNTIwNWViIiwicmVmX2lkIjoiNjczOTZiYTE3MjgyMDZlZmI5MmYwODVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1OTgyLCJleHAiOjE3ODIzODIzODJ9.R7tIUcL6-qKdifdH2l4OUN0ieCiZoIsQXyIckf1CycU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
