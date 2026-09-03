Created by 刘晓芳 on 十一月 14, 2023

# **1. 概述**

本文描述YashanDB的JSON扩展支持的数据类型测试设计；

Oracle文档：

-   [Oracle Objects That Extended JSON Scalars](https://docs.oracle.com/en/database/oracle/oracle-database/21/adjsn/json-in-oracle-database.html#GUID-911D302C-CFAF-406B-B6A5-4E99DD38ABAD)  


开发设计：    [JSON扩展类型](109596514.html)  

SR：       [YDBRD-15322](https://jira.yasdb.com/browse/YDBRD-15322?src=confmacro)    -  行存表支持json扩展类型  完成

             [YDBRD-15323](https://jira.yasdb.com/browse/YDBRD-15323?src=confmacro)    -  列存表支持json扩展类型  完成

# **2. 需求分析**

## 2.1语法

|扩展类型|JSON Scalar类型|SQL类型|格式|示例|说明|
|:---|:---|:---|:---|:---|:---|
|$numberByte|tinyint|tinyint|{ "$numberByte": "<number>" } 或 { "$numberByte": <number> }|{ "$numberByte": "10" } 或 { "$numberByte": 10 }|  
|
|$numberShort|smallint|smallint|{ "$numberShort": "<number>" } 或 { "$numberShort": <number> }|{ "$numberShort": "1000" } 或 { "$numberShort": 1000 }|  
|
|$numberInt|integer|integer|{ "$numberInt": "<number>" } 或 { "$numberInt": <number> }|{ "$numberInt": "100000" } 或 { "$numberInt": 100000 }|  
|
|$numberLong|bigint|bigint|{ "$numberLong": "<number>" } 或 { "$numberLong": <number> }|{ "$numberLong": "10000000000" } 或 { "$numberLong": 10000000000 }|  
|
|$numberDecimal|number|number|{ "$numberDecimal": "<number>" } 或 { "$numberDecimal": <number> }|{ "$numberDecimal": "123.456789" } 或 { "$numberDecimal": 123.456789 }|  
|
|$numberFloat|float|float|{ "$numberFloat": "<number>" } 或 { "$numberFloat": <number> }|{ "$numberFloat": "123.456" } 或 { "$numberFloat": 123.456 }|支持以下字符串："Infinity", "-Infinity", "Inf", "-Inf", "Nan"|
|$numberDouble|double|double|{ "$numberDouble": "<number>" } 或 { "$numberDouble": <number> }|{ "$numberDouble": "123.456789" } 或 { "$numberDouble": 123.456789 }|支持以下字符串："Infinity", "-Infinity", "Inf", "-Inf", "Nan"|
|$binary|binary|raw or blob|{ "$binary": "<payload>" }，输入支持{ "$binary": { "base64": "<payload>", "subType": "<t>" } }|{ "$binary": "eWFzaGFuZGI=" }|payload是base64编码的字符串|
|$yashanTimestamp|timestamp|timestamp|{ "$yashanTimestamp": "<ISO-8601 Timestamp String>" }|{ "$yashanTimestamp": "2023–05–16T16:42:52.12679" }|格式化字符串“YYYY-MM-DDTHH24:MI:SS.FF”，输入支持别名“$oracleTimestamp”|
|$yashanDate|date|date|{ "$yashanDate": "<ISO-8601 Date String>" }|{ "$yashanDate": "2023–05–16T16:42:52" }|格式化字符串 “YYYY-MM-DDTHH24:MI:SS.FF”，输入支持别名“$oracleDate”|
|$yashanTime|time|time|{ "$yashanTime": "<ISO-8601 Time String>" }|{ "$yashanTime": "23:59:59.999999" }|格式化字符串“THH24:MI:SS.FF”|


## 2.2 功能描述

  对于json数据需要支持扩展数据类型的处理，需要通过EXTENDED的字符来打开：

（1）涉及json数据处理函数：json/json_parse，JSON_FORMAT()/JSON_SERIALIZE()；

（2）第（1）中函数可以使用的场景，比如insert into table、update table、

  


## 2.3 规格限制

（1）对于  JSON_FORMAT()/JSON_SERIALIZE()函数，EXTENDED必须跟在pretty函数后面；

在扩展模式下解析JSON字符串时，对于未显式使用扩展类型的数值的处理：

- 对于整数，识别为满足数值范围的最小类型。类型从小到大为    `tinyint < smallint < integer < bigint < number`    。例如：127识别为tinyint，128识别为smallint。
- 对于小数，识别为double类型。


在扩展模式下输出JSON字符串时，对于数值类型的处理：

- 对于number，如果为整数，且未超过    `±(2^53-1)`    ，则直接输出数值。超过但在bigint范围内，则输出$numberLong；超过bigint范围则输出$numberDecimal。
- 对于bigint，未超过    `±(2^53-1)`    直接输出数值，超过则输出$numberLong。
- 对于tinyint、smallint、integer和double，直接输出数值。
- 对于float，输出$numberFloat。


在扩展模式解析JSON字符串时，扩展类型的值如果不能转换为指定类型的值，则回退并保存为对象，而不会报错。

  


**3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

1、存量的json函数用例（包括调用了json/json_format函数的其他函数），加上EXTENDED执行一遍；

2、新增功能用例；

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|extended关键字校验|/|关键字覆盖大小写|  
|拼写错误：extend等|  
|
|  
|  
|  
|  
|  
|  
|
|扩展类型|$numberByte|数值覆盖：,- 0、-0、1、-1、“0”、“-0”
- 127、-128、64、-64、“127”、“-128”
- 1e0、1.27e2、-1.28e2、“1.27e2”、“-1.28e2”
|/|- 128、-129、“128”、“-129”
- 1e100
- 空值：null、"","  "
- 字符串
- 小数？？
|/|
|  
|$numberShort|数值覆盖：,- 0、-0、“0”、“-0”
- 127、-128、-256、255
- "127"、"-128"、"-256"、"255"
- 2.55e2、-2.56e2、"2.55e2"、"-2.56e2"
|  
|- 256、-257、”256“、"-257"
- 256.0
- 字符串
|  
|
|  
|$numberInt|数值覆盖：,- 0、-0、“0”、“-0”
-256、255、2147483647、-2147483648- "127"、"-128"、"-2147483648"、"2147483647"
- 2.147483647e9、-2.56e2、"2.147483647e9"、"-2.147483648e9"
|  
|- 2147483648、-214748364889
- "-2147483649"、"2147483648"
- 字符串
|  
|
|  
|$numberLong|数值覆盖：,- 0、-0、“0”、“-0”
- 2147483647、-2147483648、"-2147483648"、"2147483647"
-9223372036854775808，"9223372036854775807"-9.223372036854775808e18、9.223372036854775807e18- "-9.223372036854775808e18"、"9.223372036854775807e18"
|  
|-9223372036854775809，"9223372036854775808"- 字符串
|  
|
|  
|$numberDecimal|数值覆盖：,-1.401298E-45、1.401298E-45、3.402823E38- 0、127、-128、255、-256、2147483647、  -2147483648
- 10.567895678956789等小数
-1.401298E-127、1.401298E-127、3.402823E127|  
|- 1E-128、1.401298E-128、3.402823E128
- 字符串
|  
|
|  
|$numberFloat|数值覆盖：,-1.401298E-45、1.401298E-45、3.402823E38- 0、127、-128、255、-256、2147483647、  -2147483648
- 10.567895678956789等小数
|  
|- 3.402823E39、-1.401298E-46
- 字符串
|  
|
|  
|$numberDouble|数值覆盖：,- 整数值，覆盖tinyint\samllint\int\bigint\number的边界值、0
- 小数数据
-4.94065645841247E-324、1.79769313486232E308、4.94065645841247E-324- "Infinity", "-Infinity", "Inf", "-Inf", "Nan"
|  
|- 字符串
|  
|
|  
|$binary|数值覆盖：,- 字符串长度1、4000、8000、16000、32000？
|  
|- 字符串长度32001
|  
|
|  
|$yashanTimestamp|数值覆盖：,- 1-1-1 00:00:00.000000、9999-12-31 23:59:59.999999
- 2023-1-1 12:00:15.00001
- 2023/1/1 23:59:59.6666
|  
|- 无法转换成日期的字符串
- 不存在的日期
- 只有年月日
|  
|
|  
|$yashanDate|数值覆盖：,- 1-1-1 00:00:00、9999-12-31 23:59:59
- 2024-1-1 12:00:15
- 2023/1/1 23:59:59.6666
- 1949_12_31 23:59:59.6666
|  
|- 无法转换成日期的字符串
- 不存在的日期
- hh:mm:ss,hh:mm:ss.999
- timestamp格式的日期
|  
|
|  
|$yashanTime|数值覆盖：,- 00:00:00.000000、 23:59:59.999999
- 12:00:15、  23:59:59.6666
|  
|- 无法转换成时间的字符串
- 不存在的时间，比如24:00:01,   15:01:01.99999999999
|  
|
|  
|数据类型嵌套|- 数据类型组合嵌套
- 最大嵌套100层
|  
|- 嵌套超过100层
|报错提示正确？|
|函数覆盖场景|  
|json/json_parse函数：,- 函数加/不加关键字extended；
- 传参覆盖常量/变量列（varchar/clob）
- 结合json_query函数覆盖：
    - 路径匹配$.$numberXXX
    - 路径匹配$.$binary
    - 路径匹配$.$yashanTimestamp
    - 路径匹配$.$yashanDate
    - 路径匹配$.$yashanTime
    - 路径匹配$[0]、$[last]、$.*,$[0 to 0]
- 覆盖json_query递归匹配场景
- 结合json_exist函数
|  
|覆盖函数场景同有效等价类（数据值使用无效等价类数据）|1、不报错，按照对象正常返回,2、使用json_query函数查询数据type为object,3、路径匹配返回值按照object反回|
|  
|  
|json_format/json_serialize函数：,- 函数加/不加关键字extended；
- 传参覆盖常量/变量列（json列）
- 函数作为参数值传参到json函数
|  
|同上|同上|
|  
|  
|函数嵌套：,- 构造扩展数据类型嵌套127层
- 结合json、json_format函数反复嵌套
|  
|/|/|
|insert场景|insert into json/json_parse|- 插入表json列，json列作为参数传入json_query、json_serialize等函数
- select 查询数据
|- json_query查询type正确
- 数据显示正确
|/|/|
|  
|insert into json_serialize|- 插入表的varchar/clob列，列作为参数传入json等函数，结合json_query函数
- select 查询数据正确
|- json_query查询type正确
- 数据显示正确
|/|/|
|其他函数拦截|/|/|  
|json_exist/json_query/json_array_get/json_array_length函数加关键字EXTENDED|报错，提示信息正确|


  


场景测试用例：

|输入条件|等价类|  
|
|:---|:---|:---|
|DDL,  
|create时作为列的默认值|  
|
||alter时作为列的default默认值|  
|
|DML,  
|update|set值|
||delete|  
|
||insert|作为insert的值|
|DQL|作为select投影列返回|Json_serialize()配合|
||作为where条件|1. where func(col1) = xx
1. where col1 = func(xx)
|
||结合in/not in/exists/not exist/between and/like/not like/,any/all/some/is null/is not null等子查询|  
|
||结合group by分组(聚合函数和窗口函数)|  
|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|
||结合distinct|  
|
||参与运算|+ - * /  > < >= <=  and or|
||connect by|  
|
||plsql|自定义函数、匿名块、type、package中调用|


  


# **4. 详细设计**

见第3章节

#   
  5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|
