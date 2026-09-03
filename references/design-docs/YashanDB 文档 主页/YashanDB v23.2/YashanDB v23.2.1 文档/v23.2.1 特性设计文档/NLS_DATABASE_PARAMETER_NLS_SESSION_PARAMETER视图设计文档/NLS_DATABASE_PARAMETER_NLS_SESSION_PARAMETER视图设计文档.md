Created by 赵忠源, last modified on 十二月 25, 2023

*IR链接：*    [YDBRD-21261](https://jira.yasdb.com/browse/YDBRD-21261?src=confmacro)    *-*  *支持 nls_numeric_characters功能和NLS_DATABASE_PARAMETERS视图*  *完成*

*SR链接：*    [YDBRD-23040](https://jira.yasdb.com/browse/YDBRD-23040?src=confmacro)    *-*  *支持NLS_DATABASE_PARAMETERS视图*  *完成*

#   [YDBRD-23040: NLS_DATABASE_PARAMETER/NLS_SESSION_PARAMETER Design（NLS_DATABASE_PARAMETER/NLS_SESSION_PARAMETER视图方案设计）](#ydbrd-23040-nls-database-parameternls-session-parameter-designnls-database-parameternls-session-parameter视图方案设计)  

##   [1. Overview（概述）](#1-overview概述)  

创建NLS_DATABASE_PARAMETERS视图：主要显示system级的NLS相关配置参数

**引申:**  NLS_SESSION_PARAMETERS视图：主要显示session级的NLS相关配置参数

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 NLS_DATABASE_PARAMETERS视图](#21-nls-database-parameters视图)  

显示system级的NLS相关配置参数

###   [2.2 NLS_SESSION_PARAMETERS视图](#22-nls-session-parameters视图)  

显示session级的NLS相关配置参数

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
select * from NLS_DATABASE_PARAMETERS;
select * from NLS_SESSION_PARAMETERS;

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 NLS_DATABASE_PARAMETERS视图](#521-nls-database-parameters视图)  

1.视图字段：

|字段|类型|描述|
|---|---|---|
|parameter|varchar2(128)|参数名|
|value|varchar2(64)|参数值|


参数总共有3项

|参数项|
|---|
|NLS_NUMERIC_CHARACTERS|
|NLS_NCHAR_CHARACTERSET|
|NLS_CHARACTERSET|


####   [5.2.1 NLS_SESSION_PARAMETERS视图](#521-nls-session-parameters视图)  

1.视图字段：

|字段|类型|描述|
|---|---|---|
|parameter|varchar2(30)|参数名|
|value|varchar2(64)|参数值|


|参数项|
|---|
|NLS_NUMERIC_CHARACTERS|


####   [5.2.3 NLS_NUMERIC_CHARACTERS参数](#523-nls-numeric-characters参数)  

NLS_NUMERIC_CHARACTERS参数是控制数值显示字符，用于指定数值显示格式，即指明使用空格，逗号，句号等字符作为分隔符。NLS_NUMERIC_CHARACTERS参数的正确设置主要依赖于数据库语言和字符集的不同，因此可以依据自己数据库的实际状况选择不同的参数设置，一般情况下，使用ALTER SESSION来设置NLS_NUMERIC_CHARACTERS：

```
ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,';

```

- 1.设置的时候包含两个字符，第一个字符表示小数点分隔符，第二个字符表示千分位分隔符，如'1,000'
- 2.前两个字符不能相同，且前两个字符不能包含‘>’、‘<’、‘+’、‘-’、数值
- 3.当设置超过2个分隔符时不报错，并且从第3个字符开始不受符号限制，因为实际不起作用；最大输入字符串长度255


Oracle 视图查询条件

![](https://pingcode.yasdb.com/atlas/files/public/67396c1da1ad9a3311dc87cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFFZ0FCQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNzEsImV4cCI6MTc4MjMwOTg3MX0.zfo_IgkWPOtz_C7-lgHLxp_QCbhce9rd5FyuC_8squc)

![](https://pingcode.yasdb.com/atlas/files/public/67396c1d8970c2af4f52095f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFFZ0FCQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNzEsImV4cCI6MTc4MjMwOTg3MX0.zfo_IgkWPOtz_C7-lgHLxp_QCbhce9rd5FyuC_8squc)

在gParamItems中添加对应NLS_NUMERIC_CHARACTERS，其默认值为'.,'

####   [5.2.4 NLS_CHARACTERSET和NLS_NCHAR_CHARACTERSET参数](#524-nls-characterset和nls-nchar-characterset参数)  

NLS_CHARACTERSET和NLS_NCHAR_CHARACTERSET分别为数据库的字符集和国家字符集类型，目前仅支持查询暂不支持修改

NLS_CHARACTERSET的类型可以为GBK，UTF-8，ASCII，ISO-8859-1

NLS_NCHAR_CHARACTERSE仅能为UTF16

###   [5.3 详细设计](#53-详细设计)  

1. 适配fixed_table + fixed_views 动态视图框架，添加x$nls_parameters
1. 增加is_NLS字段标识是否为NLS参数，fetch时进行过滤
1. NLS_DATABASE_PARAMETERS和NLS_SESSION_PARAMETERS统一查询x$nls_parameters获取对应参数


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
select * from NLS_DATABASE_PARAMETERS;
select * from NLS_SESSION_PARAMETERS;
alter session set nls_numeric_characters = '.,';
alter system set nls_numeric_characters = '. ' scope = spfile;

select * from NLS_DATABASE_PARAMETERS;
select * from NLS_SESSION_PARAMETERS;

alter session set nls_numeric_characters = ' ,';
alter system set nls_numeric_characters = '  ' scope = spfile;

alter session set nls_numeric_characters = 'p,';
alter system set nls_numeric_characters = 'p ' scope = spfile;

```

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## Attachments: