Created by 曾思尹, last modified on 五月 27, 2024

  


  [https://pingcode.yasdb.com/pjm/items/662213a8fd997db58add8d4d](https://pingcode.yasdb.com/pjm/items/662213a8fd997db58add8d4d)    ?    
  #YDBRD-26523 支持DBMS_DESCRIBE内置系统包

##   [1. 总述](#1-总述)  

为了方便用户获取存储过程的参数信息，需要支持DBMS_DESCRIBE高级包的相关功能。

###   [1.1 需求来源](#11-需求来源)  

源于国信融选市场需求。

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=153007231](https://conf.yasdb.com/pages/viewpage.action?pageId=153007231)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|支持DBMS_DESCRIBE高级包及其子过程DESCRIBE_PROCEDURE|通过PL/SQL实现DBMS_DESCRIBE高级包，返回的参数通过查ALL_ARGUMENTS视图获取。|是|是|
|性能|性能场景1||否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|---|---|||


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|高级包|子过程DBMS_DESCRIBE.DESCRIBE_PROCEDURE及其出参使用的类型DBMS_DESCRIBE.VARCHAR2_TABLE、DBMS_DESCRIBE.NUMBER_TABLE|输入存储过程的名称，返回有关该过程的参数信息。|是|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

1. OBJECT_NAME的语法遵循SQL中用于标识符的规则。该名称可以是同义词。此参数是必需的，不能为null。
1. 暂不支持存储过程重载，OVERLOAD返回0。
1. 暂不支持查询复合类型参数的嵌套深度， LEVEL返回0。
1. 不支持描述内置高级包的子过程（PL/SQL实现的内置高级包在执行过一次后可描述其包中的子过程）。


##   [4. 特性](#4-特性)  

###   [4.1 DBMS_DESCRIBE高级包类型和子过程定义](#41-dbms-describe高级包类型和子过程定义)  

```
TYPE VARCHAR2_TABLE IS TABLE OF VARCHAR2(64)
    INDEX BY BINARY_INTEGER;

TYPE NUMBER_TABLE IS TABLE OF NUMBER
    INDEX BY BINARY_INTEGER;

DBMS_DESCRIBE.DESCRIBE_PROCEDURE(
   object_name                   IN  VARCHAR2,
   reserved1                     IN  VARCHAR2,
   reserved2                     IN  VARCHAR2,
   overload                      OUT NUMBER_TABLE,
   position                      OUT NUMBER_TABLE,
   data_level                    OUT NUMBER_TABLE,
   argument_name                 OUT VARCHAR2_TABLE,
   datatype                      OUT NUMBER_TABLE,
   default_value                 OUT NUMBER_TABLE,
   in_out                        OUT NUMBER_TABLE,
   length                        OUT NUMBER_TABLE,
   precision                     OUT NUMBER_TABLE,
   scale                         OUT NUMBER_TABLE,
   radix                         OUT NUMBER_TABLE,
   spare                         OUT NUMBER_TABLE,
   include_string_constraints    IN  BOOLEAN DEFAULT FALSE); 

```

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|object_name|IN|VARCHAR2|是|-|过程名|
|reserved1|IN|VARCHAR2|是|-|保留字段|
|reserved2|IN|VARCHAR2|是|-|保留字段|
|overload|OUT|NUMBER_TABLE|是|-|可重载的版本号，返回0|
|position|OUT|NUMBER_TABLE|是|-|参数在参数列表中的位置，返回值位置为0|
|data_level|OUT|NUMBER_TABLE|是|-|参数数据类型（复合类型）的嵌套深度，返回0|
|argument_name|OUT|VARCHAR2_TABLE|是|-|参数名，最长64字节|
|datatype|OUT|NUMBER_TABLE|是|-|参数的数据类型id|
|default_value|OUT|NUMBER_TABLE|是|-|参数是否具有默认值（1/0）|
|in_out|OUT|NUMBER_TABLE|是|-|参数方向（0-IN, 1-OUT, 2-IN OUT）|
|length|OUT|NUMBER_TABLE|是|-|参数长度（字符类型返回宽度，如果有的话，否则返回0）|
|precision|OUT|NUMBER_TABLE|是|-|NUMBER类型精度，非NUMBER类型返回0|
|scale|OUT|NUMBER_TABLE|是|-|NUMBER类型刻度，非NUMBER类型返回0|
|radix|OUT|NUMBER_TABLE|是|-|TINYINT/SMALLINT/INTEGER/BIGINT/FLOAT/DOUBLE/NUMBER/BIT类型基数（进制，BIT类型返回2，其他数值型返回10），其他类型返回0|
|spare|OUT|NUMBER_TABLE|是|-|保留字段，返回0|
|include_string_constraints|IN|BOOLEAN|否|FALSE|对于CHAR/VARCHAR/NCHAR/NVARCHAR/RAW类型的过程体参数，置为true时length参数返回字符类型宽度（字节），置为false时length参数返回0|


|异常|说明|
|---|---|
|DBMS_DESCRIBE.PROCEDURE_NOT_EXIST|不存在指定过程名的过程，无法描述|
|DBMS_DESCRIBE.PROCEDURE_INVALID|指定的过程失效，无法描述|


给定object_name，通过'.'分隔获取user.package.procedure，查询ALL_SYNONYMS（同义词翻译）、ALL_OBJECTS（判断是否失效，失效的先尝试重编译再判断是否失效）、ALL_ARGUMENTS(获取描述）视图。如果是失效的过程抛出异常DBMS_DESCRIBE.PROCEDURE_INVALID，如果未查询到结果则抛出异常DBMS_DESCRIBE.PROCEDURE_NOT_EXIST。

datatype的id通过查V$DATATYPE获取。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. DBMS_DESCRIBE高级包的正常使用，包括存储过程、包的子过程，存储过程参数的参数方向（IN/OUT/INOUT）、数据类型(VARCHAR/NUMBER等类型和%type/%rowtype继承类型) 、是否有默认值。


##   [6.资料设计章节](#6资料设计章节)  

新增DBMS_DESCRIBE高级包章节。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,1.高级包执行的权限自测时看一下,2.能否查询 创建时编译错误的、创建成功但失效的（比如创建后drop依赖的table）、失效但重编译成功的,3.高级包抛出的异常和dbms_output调研一起使用同一编码是什么表现,Posted by zengsiyin at 五月 16, 2024 10:19|
|---|
