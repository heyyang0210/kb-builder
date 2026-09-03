Created by 李伟超, last modified by  余睿杰 on 九月 20, 2023

##   [1. Overview（概述）](#1-overview概述)  

目前YashanDB的JSON只支持6种标准JSON类型：Object、Array、Number、String、Boolean和Null，不支持数据库支持的其它数据类型，包括整数类型、浮点数类型、时间日期类型、二进制数据等。

本方案为YashanDB的JSON扩展支持的数据类型，包括Yason格式上的支持和JSON字符串的支持。

参考资料：

-   [Oracle Objects That Extended JSON Scalars](https://docs.oracle.com/en/database/oracle/oracle-database/21/adjsn/json-in-oracle-database.html#GUID-911D302C-CFAF-406B-B6A5-4E99DD38ABAD)  
-   [MongoDB Extended JSON(v2)](https://www.mongodb.com/docs/manual/reference/mongodb-extended-json/)  


##   [2. Features（功能特性）](#2-features功能特性)  

###   [YASON支持扩展类型](#yason支持扩展类型)  

|类型|编码|长度|说明|
|---|---|---|---|
|tinyint|07|1字节|8位有符号整数|
|smallint|08|2字节|16位有符号整数|
|integer|09|4字节|32位有符号整数|
|bigint|10|8字节|64位有符号整数|
|float|11|4字节|32位浮点数|
|double|12|8字节|64位浮点数|
|binary|13|变长|二进制数据|
|timestamp|14|8字节|时间戳|
|date|15|8字节|日期类型，可包含时分秒|
|time|16|8字节|时间，只有时分秒|


###   [JSON字符串支持扩展类型](#json字符串支持扩展类型)  

|扩展类型|JSON Scalar类型|SQL类型|格式|示例|说明|
|---|---|---|---|---|---|
|$numberByte|tinyint|tinyint|{ "$numberByte": "<number>" } 或 { "$numberByte": <number> }|{ "$numberByte": "10" } 或 { "$numberByte": 10 }||
|$numberShort|smallint|smallint|{ "$numberShort": "<number>" } 或 { "$numberShort": <number> }|{ "$numberShort": "1000" } 或 { "$numberShort": 1000 }||
|$numberInt|integer|integer|{ "$numberInt": "<number>" } 或 { "$numberInt": <number> }|{ "$numberInt": "100000" } 或 { "$numberInt": 100000 }||
|$numberLong|bigint|bigint|{ "$numberLong": "<number>" } 或 { "$numberLong": <number> }|{ "$numberLong": "10000000000" } 或 { "$numberLong": 10000000000 }||
|$numberDecimal|number|number|{ "$numberDecimal": "<number>" } 或 { "$numberDecimal": <number> }|{ "$numberDecimal": "123.456789" } 或 { "$numberDecimal": 123.456789 }||
|$numberFloat|float|float|{ "$numberFloat": "<number>" } 或 { "$numberFloat": <number> }|{ "$numberFloat": "123.456" } 或 { "$numberFloat": 123.456 }|支持以下字符串："Infinity", "-Infinity", "Inf", "-Inf", "Nan"|
|$numberDouble|double|double|{ "$numberDouble": "<number>" } 或 { "$numberDouble": <number> }|{ "$numberDouble": "123.456789" } 或 { "$numberDouble": 123.456789 }|支持以下字符串："Infinity", "-Infinity", "Inf", "-Inf", "Nan"|
|$binary|binary|raw or blob|{ "$binary": "<payload>" }，输入支持{ "$binary": { "base64": "<payload>", "subType": "<t>" } }|{ "$binary": "eWFzaGFuZGI=" }|payload是base64编码的字符串|
|$yashanTimestamp|timestamp|timestamp|{ "$yashanTimestamp": "<ISO-8601 Timestamp String>" }|{ "$yashanTimestamp": "2023-05-16T16:42:52.12679" }|格式化字符串“YYYY-MM-DDTHH24:MI:SS.FF”，输入支持别名“$oracleTimestamp”|
|$yashanDate|date|date|{ "$yashanDate": "<ISO-8601 Date String>" }|{ "$yashanDate": "2023-05-16T16:42:52" }|格式化字符串 “YYYY-MM-DDTHH24:MI:SS.FF”，输入支持别名“$oracleDate”|
|$yashanTime|time|time|{ "$yashanTime": "<ISO-8601 Time String>" }|{ "$yashanTime": "23:59:59.999999" }|格式化字符串“THH24:MI:SS.FF”|


##   [3. Interfaces（接口）](#3-interfaces接口)  

涉及的修改：

-   `JSON('<json string>')`     =>     `JSON('<json string>' [EXTENDED])`  
    - JSON函数默认按标准格式解析，只识别六种基本类型。设置    `EXTENDED`    后，按扩展类型解析。
-   `JSON_SERIALIZE(<json value> [returning_clause] [PRETTY])`     =>     `JSON_SERIALIZE(<json value> [returning_clause] [PRETTY] [EXTENDED])`  
    - JSON_SERIALIZE默认按标准格式输出，对于不属于六种基本类型的数据按字符串输出。设置    `EXTENDED`    后，按扩展类型输出。
-   `insert into <table> values(json('<json string>'))`     =>     `insert into <table> values(json('<json string>' [EXTENDED]))`  


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

在扩展模式下解析JSON字符串时，对于未显式使用扩展类型的数值的处理：

- 对于整数，识别为满足数值范围的最小类型。类型从小到大为    `tinyint < smallint < integer < bigint < number`    。例如：127识别为tinyint，128识别为smallint。
- 对于小数，识别为double类型。


在扩展模式下输出JSON字符串时，对于数值类型的处理：

- 对于number，如果为整数，且未超过    `±(2^53-1)`    ，则直接输出数值。超过但在bigint范围内，则输出$numberLong；超过bigint范围则输出$numberDecimal。
- 对于bigint，未超过    `±(2^53-1)`    直接输出数值，超过则输出$numberLong。
- 对于tinyint、smallint、integer和double，直接输出数值。
- 对于float，输出$numberFloat。


在扩展模式解析JSON字符串时，扩展类型的值如果不能转换为指定类型的值，则回退并保存为对象，而不会报错。

标准模式解析得到的数值    `JSON('1.2')`    与扩展模式解析得到的Decimal数值    `JSON('{"$numberDecimal": "1.2"}' EXTENDED)`    在二进制数据层面是完全一样的。因此在使用扩展模式输出JSON数据时，上述的两个JSON值都会输出同样的结果，即使用扩展模式表示非整数Number类型，    `{"$numberDecimal:"1.2"}`    。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

本方案仅在YashanDB的JSON类型实现基础上增加扩展类型，不涉及架构调整。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

不涉及。

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

通过EXTENDED控制对扩展类型的支持，在相关函数未设置EXTENDED时，行为未发生变化，保持兼容。

增加的扩展类型保持对Oracle和MongoDB的兼容性，以下例外：

- Oracle和MongoDB不支持$numberByte、$numberShort。
- YashanDB因为不支持timestamptz，因此暂时不支持$oracleTimestampTZ、$timestamp、$date。
- YashanDB的标准模式数值与扩展模式    `$numberDecimal`    类型数值完全等价，因此标准输入小数、扩展输出时的结果与Oracle有差异。
    - 由此引申，YashanDB的    `$numberDecimal`    不支持    `Nan`    与    `Inf`    ，此处与Oracle有差异。
- Oracle的float与double类型存储不符合IEEE 754标准，因此输出精度与具体数字有时有差异。
- 对于字符串，YashanDB严格遵守JSON规格，即只支持双引号""作为字符串开头结尾字符，而Oracle对单引号''作了容错处理，这里有差异。


###   [5.4 DFX设计](#54-dfx设计)  

不涉及。

###   [5.5 其它](#55-其它)  

导入导出工具需要支持JSON扩展类型：

- 导出时可以指定按扩展类型输出JSON字符串；
- 导入时可以指定按扩展类型解析JSON字符串。


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 从json字符串解析扩展类型；
- 扩展类型序列化为json字符串；
- 扩展类型的json type是否符合预期。


##   [7.资料设计章节](#7资料设计章节)  

需要在文档中增加对JSON扩展类型和规格的说明。

##   [8. 工作量](#8-工作量)  

|任务|工作量|备注|
|---|---|---|
|行存支持扩展类型|3人周||
|列存支持扩展类型|2人周||
|导入工具支持扩展类型|1人周|依赖C驱动支持|
|导出工具支持扩展类型|1人周|依赖C驱动支持|


##   [9. TODO（遗留问题）](#9-todo遗留问题)  

未来YashanDB支持timestamptz类型后，需要增加支持$date（兼容Oracle和MongoDB）和$yashanTimestampTZ（$oracleTimestampTZ，兼容Oracle）。