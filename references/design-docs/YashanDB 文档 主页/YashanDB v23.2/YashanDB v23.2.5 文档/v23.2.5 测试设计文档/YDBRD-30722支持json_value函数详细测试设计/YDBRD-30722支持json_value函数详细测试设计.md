Created by 周彬鑫, last modified on 八月 13, 2024

# 1. 概述

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66a1b9e08f5ee1917345bc24](https://pingcode.yasdb.com/pjm/items/66a1b9e08f5ee1917345bc24)    *?*    
  *#YDBRD-30722 支持json_value函数*

# 2. 需求分析

## 2.1 功能点分析

- json_value返回json expr中对应的路径表达式的标量值，非标量返回null。
- 语法图 


![](https://conf.yasdb.com/download/attachments/162992667/image2024-8-12_17-52-20.png?version=1&modificationDate=1723456340063&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIyOTgsImV4cCI6MTc4MjMyMzA5OH0.F0avt5SalFPnIexbZbdUDGcp0BzYQeEeI-MaG4ozOS8)

## 2.2 应用场景

- 来源博时基金需求,需要满足的客户场景为：
- SELECT JSON_VALUE('{"key4":-0.123,"key5":"test"}','$.key4') res FROM DUAL;
- SELECT JSON_VALUE('{"key4":-0.123,"key5":"test"}','$.key5') res FROM DUAL;


## 2.3 规格约束

- expr为null时返回null
- expr先转成json类型再做运算，转换规则按之前实现，未额外增加适配；如果转换失败则返回null。（与oracle差异，'12a' oracle与yashan都不能转json，但是oracle json_value返回12）
- FORMAT JSON仅语法支持
- json路径表达式只支持  **常量字符串，不支持绑定参数**  ，匹配时大小写敏感，对空格也要求匹配，具体规则同：    [Confluence —— Path Expression](https://conf.yasdb.com/display/YAS/Path+Expression+Design)  
- json_value函数参数不能静态优化，因此路径表达式不支持类似于concat('$','.key')拼接成的常量字符串
- 由于只返回标量，当路径表达式对应的value为object，array时返回为NULL; 返回为字符串时，json_value不带双引号，json_query带（与json_query差异）
- 不显示指定return clause时（当前不支持该语法），函数默认返回类型为varchar(32000),
- 标准json可以允许object的key重复，yashan按标准json实现，  存在重复key时，value会使用最新的进行替换；oracle不允许重复  。  oracle在json_value中表现为取第一个value？


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


**函数入参**

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|参数个数|2（带/不带 format json）|0，1，3|  
|
|参数类型|expr、path_expression为字面量、常量,char|为  date/timestamp/bit/interval/bool 字面量|  
|
|  
|expr为表达式：,+- * / % &^| ||、布尔表达式、null表达式|path_expression为表达式|  
|
|  
|expr为子查询|path_expression为子查询|  
|
|  
|expr为伪列|path_expression为伪列|  
|
|  
|expr为函数|path_expression为函数|  
|
|  
|覆盖全部数据类型（expr为表列）,char、varchar、nchar、nvarchar、json、raw、blob、clob、nclob|path_expression为表列,expr为：  smallint、tinyint、int、bigint、float、double、number、bit、  time、timestamp、date、interval day to second、interval year to month、xmltype、bool、udt|不支持的类型为null也应该拦截报错|
|  
|覆盖特殊取值,空串、null、科学计数法、  特殊字符、中文、转义字符|  
|  
|
|  
|入参长度限制  同json_query 一致|超过长度限制|  
|
|绑定参数执行|plsql|path_expression绑定参数执行|  
|
|  
|jdbc|  
|  
|
|特殊入参|expr为不能转为json的字符串：12a|  
|与oracle保持差异：yashan转换失败返回null、  oracle返回12|
|  
|expr的key重复|  
|与oracle保持差异：yashan按标准json实现，存在重复key时，value会使用最新的进行替换；  oracle为出现的第一个key对应的value|
|函数功能|expr中包含多层嵌套（嵌套层数限制）：,覆盖不同层含相同的key、不同的key,覆盖  array、object嵌套|  
|  
|
|  
|path_expression包含 *、last、to、[]|  
|1、单条结果时 path_expression 为 *:  ,JSON_VALUE('{"key":"val"}', '$.*' ) ,JSON_VALUE('[1]', '$[*]' ),2、多条结果时 path_expression 为 *： 返回null,3、last/last-integer/last-integer:,json_value('10e10','$[last]') 、 json_value('[1,2,3]','$[last]')、json_value('[1,2,3]','$[last-1]'),4、to：n to n /n to n+1/n to n-1,json_value('[1,2,3]','$[1 to 1]')/ json_value('[1,2,3]','$[1 to 2]'),5、多层嵌套：,select json_value('{"data": {"items": [{ "id": 1, "value": "A" },{ "id": 2, "value": "B" }]}}','$.data.items[0 to 0].id') from dual;|
|  
|expr中包含array|  
|select json_value('[1, "string", {"key": "value"}]','$[0]') from dual;|
|  
|path_expression包含函数  count、size、type|  
|json_value函数返回的是标量，因此对于type与size如果有多条结果匹配成功，则返回为null|
|  
|path_expression为错误的key|  
|返回null|
|  
|path_expression匹配到多个结果|  
|返回null|
|  
|path_expression匹配到的结果为object/array|  
|返回null|
|函数返回值|typeof|  
|函数默认返回类型为varchar(32000)|
|  
|create view  v1 as select json_value;,desc v1|  
|函数默认返回类型为varchar(32000)|


**函数嵌套**

|测试点|等价类|备注|
|:---|:---|:---|
|函数嵌套|自嵌套（127层限制|  
|
|  
|聚集函数|简单覆盖|
|  
|窗口函数|简单覆盖|
|  
|日期函数|简单覆盖|
|  
|字符函数|简单覆盖|
|  
|转换函数|简单覆盖|
|  
|其他函数|简单覆盖|


***函数关键字***

|测试点|等价类|备注|
|:---|:---|:---|
|函数关键字|函数名称大小写|  
|
|  
|拼写错误|  
|
|  
|名称缺失|  
|
|  
|带单、双引号|  
|
|  
|与对象同名（表、对象、视图）|  
|
|  
|v$function视图有对应记录|  
|


**其他场景**

|测试点|等价类|备注|
|:---|:---|---|
|DML|delete：函数作为where条件|  
|
|  
|update：函数作为set值，where条件|  
|
|  
|insert：函数作为value值进行insert操作|  
|
|DDL|alter：列默认值、where条件|  
|
|  
|create：create table/view as ，列默认值|  
|
|DQL|布尔表达式：== 、 != 、 >= 、 > 、 < 和 <=|  
|
|  
|操作符：in/not in、exists/not exists 、between and、like/not like、limit等|  
|
|  
|DQL算子：distinct、case when、group by 、group by...having、join on、connect...by、集合操作、order by|  
|
|  
|子查询|  
|
|  
|CTE|  
|
|视图|创建物化视图语句中使用函数|  
|
|  
|创建普通视图语句中使用函数|  
|
|空格|select json_value ( expr, expr2) from dual|  
|
|列别名|select json_value()  json_value from dual    
  select json_value() as json_value  from dual|  
|
|异常语法|json_value()()    
  json_value().a|  
|
|udf|udf内包含json_value|  
|


**性能对比**

|场景|对比对象|
|---|---|
|expr为32kjson|oracle|


**测试范围**

|部署形态|存储|
|:---|:---|
|单机|行存|
|集群|行存|


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是 |
|KT|是 |
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[JSON_VALUE函数冒烟用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDk4OTcwYzJhZjRmNTIxNTdhIiwicmVmX2lkIjoiNjczOTZkZDk3MjgyMDZlZmI5MmYyM2RlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMjk4LCJleHAiOjE3ODIzOTg2OTh9.A8LTIAf-QxuefFqtlCxVxZ5uZFx4stHqA5KMIRO9NJY)

详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[JSON_VALUE函数冒烟用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDk4OTcwYzJhZjRmNTIxNTdhIiwicmVmX2lkIjoiNjczOTZkZDk3MjgyMDZlZmI5MmYyM2RlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyMjk4LCJleHAiOjE3ODIzOTg2OTh9.A8LTIAf-QxuefFqtlCxVxZ5uZFx4stHqA5KMIRO9NJY)

 (application/vnd.ms-excel)    
