Created by 贺天欢, last modified on 十月 13, 2023

# **1. 概述**

主要目的是json支持大内存数据，json_parse 将CLOB数据拷贝到连续大内存然后解析，解析出来的json（最大32MB，超过报错）也用连续内存存储。

 将部分相关的函数接口换位新增的yason函数接口，支持全部json函数JsonArrayGet/JsonArrayLength/JsonExists/JsonQuery/JsonSerialize首次访问大内存时，将大json数据（最大32MB）读到连续内存，再参与运算。

 部署形态为单机行存（SR：    [YDBRD-13169](https://jira.yasdb.com/browse/YDBRD-13169?src=confmacro)    -  【行表支持】json_parse支持clob  完成  、    [YDBRD-13170](https://jira.yasdb.com/browse/YDBRD-13170?src=confmacro)    -  [行存支持]所有的json函数支持32MB json  完成  ），列存也会支持，在另一个SR    [YDBRD-13171](https://jira.yasdb.com/browse/YDBRD-13171?src=confmacro)    -  [列存计算] 单机json_parse支持clob  完成  、    [YDBRD-13172](https://jira.yasdb.com/browse/YDBRD-13172?src=confmacro)    -  [列存计算]所有的json函数支持32MB json  完成  。

# **2. 需求分析**

## 2.1语法

主要通过拼接构造大的CLOB数据插入json列中，以下示例

--构造Clob数据(编码后=32MB)    
  drop table if exists test_sdv_SR13169_heap_001_01;    
  create table test_sdv_SR13169_heap_001_01(id int,c1 clob,c2 clob);    
  insert into test_sdv_SR13169_heap_001_01 values(1,'',rpad('"red',16000,'cute')||lpad('red"',16000,'cute'));    
  update test_sdv_SR13169_heap_001_01 set c1 = c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2||','||c2;    
  update test_sdv_SR13169_heap_001_01 set c1 = c1||','||c1||','||c1||','||c1;    
  update test_sdv_SR13169_heap_001_01 set c1 = c1||','||c1;    
  update test_sdv_SR13169_heap_001_01 set c1 = '['||c1||','||rpad('"red',11000,'cute')||lpad('red"',83,'cute')||']';

--3种写法插入json列    
  drop table if exists test_sdv_SR13169_heap_001;    
  create table test_sdv_SR13169_heap_001(id int,c1 json);    
  insert into test_sdv_SR13169_heap_001(id,c1) (select id,c1 from test_sdv_SR13169_heap_001_01);    
  insert into test_sdv_SR13169_heap_001(id,c1) (select id,json(c1) from test_sdv_SR13169_heap_001_01);    
  insert into test_sdv_SR13169_heap_001(id,c1) (select id,json_parse(c1) from test_sdv_SR13169_heap_001_01);

--set直接赋值json列=clob列值

alter table test_sdv_SR13169_heap_001_01 add c3 json;    
  update test_sdv_SR13171_lsc_001_01 set c3=c1;    
  commit;

## 2.2 功能描述

json_parse是一个函数，它的主要功能是解析字符串，生成Json数据并返回  ，底层采用Yason格式编码。Yason二进制编码格式详见：    [YASON: YashanDB Object Notation](/pages/createpage.action?spaceKey=YAS&title=YASON%3A+YashanDB+Object+Notation)    。

JSON字符串为考虑兼容性和扩展性，以CLOB形式进行存储，当前将规格扩大支持到编码后Max：32MB。

*（注：解析字符串生成JSON数据的功能对外呈现有Json()/Json_parse()两个表达式，互为别名）*

- json_parse支持clob大字段类型
- 能够插入json_parse出来的大json到存储
- 能够读连续内存存储的大json
- 全部  json函数支持大json数据（最大32MB）的读取、运算


## 2.3 规格

- 输出的json最大不能超过  32MB（  **编码后**  ）
- expr为clob变量规格是  32MB（编码前）  ；
- 元素个数最多为  65535个；
- 对象或数组的嵌套深度最大为100；


## 2.4 功能限制

- JSON类型支持与字符串的相互转换，但是不支持加减乘除、比较、拼接等运算。JSON的运算能力主要由具体的JSON相关的内置函数提供。


**遗留问题：**

1、    [YDBRD-19131](https://jira.yasdb.com/browse/YDBRD-19131?src=confmacro)    -  【json支持32M】需要放开自定义高级包对定义json全局变量的支持，并且适配32M的规格  解决关闭

# **3. 测试设计方法**

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

### 3.1、基本功能测试：

|输入条件1|输入条件2|输入条件3|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|数据规格|clob|  
|编码前<32MB，编码后=32MB|存储规格|编码前<32MB，编码后>32MB|  
|
|  
|  
|  
|  
|  
|编码前=32MB，编码后>32MB|  
|
|  
|  
|  
|  
|  
|编码前>32MB，编码后>32MB|  
|
|函数别名|  
|  
|json/json_parse|  
|  
|  
|
|入参类型(clob)|元素类型|json标量类型|number：,- 整数、浮点数、0、科学计数法（E，e）、特殊值：inf、-inf、nan
- 有无符号 、前面是否有0、小数点前是否有0
|  
|  
|  
|
|  
|  
|  
|string:,- 特殊字符：  中文、符号(\",\/,\\），表情包，外语、转义字符等
- 空格、空字符串、"null"--占1字符
- 不可见字符：\b、\f、\n、\r、\t等
- 基本常用字符串：英文、标点符号等
|  
|  
|  
|
|  
|  
|  
|boolean:,- ‘true’、‘TRUE’、‘1’、‘t'、'yes'、 'y'、 'on'
- 'false'、'FALSE'、'0'、'f'、 'no'、 'n'、 'off'
|  
|  
|  
|
|  
|  
|  
|null|可以插入，直接为空|  
|  
|
|  
|  
|json非标量类型|array:,- [null]、[]、[NULL]、[,]、[''],[' ']
- 嵌套数组[1,[1,2]]
- 数组包含键值对、长字符串（16K）
- 数组包含数字：  int\smallint\bigint\float\double数据类型的整负边界
- 长度：0、中间值、16k/2
- 元素类型：有重复元素、无重复元素
- 单个元素长度：0、中间、16k-2
|  
|  
|  
|
|  
|  
|  
|object:,- {null}、{}、{"":""}、{"null":"null"}、[null:null]等组合
- 嵌套对象{“KEY”:{"key":"test"}}
- 对象包含数组、长字符串（16K）
- 对象包含数字：  int\smallint\bigint\float\double数据类型的整负边界
- 长度：0、中间值、16k/2
- 元素类型：有重复元素、无重复元素
- 单个元素长度：0、中间、16k-2
,  
|  
|  
|  
|
|  
|  
|扩展类型|  
|  
|  
|  
|
|  
|嵌套层数|array|100层|  
|>100层|  
|
|  
|  
|object|100层|  
|>100层|  
|
|错误码|  
|  
|  
|  
|  
|  
|
|其他json函数|直接使用（参数json）|json_serialize（别名json_format）|  
|  
|  
|  
|
|  
|  
|json_array_get()|  
|  
|  
|  
|
|  
|  
|json_array_length()|  
|  
|  
|  
|
|  
|  
|json_exists()|array|  
|  
|  
|
|  
|  
|  
|object|  
|  
|  
|
|  
|  
|json_query()|array，取=32000的value|  
|array，取>32000的value|  
|
|  
|  
|  
|object，取=32000的value|  
|object，取>32000的value|  
|
|  
|  
|  
|count()|  
|  
|  
|
|  
|  
|  
|size()|  
|  
|  
|
|  
|  
|  
|type()|  
|  
|  
|
|  
|json（clob参数）嵌套使用|json_serialize（别名json_format）|  
|  
|  
|  
|
|  
|  
|json_array_get()|  
|  
|  
|  
|
|  
|  
|json_array_length()|  
|  
|  
|  
|
|  
|  
|json_exists()|array|  
|  
|  
|
|  
|  
|  
|object|  
|  
|  
|
|  
|  
|json_query()|array，取=32000的value|  
|array，取>32000的value|  
|
|  
|  
|  
|object，取=32000的value|  
|object，取>32000的value|  
|
|  
|  
|  
|count()|  
|  
|  
|
|  
|  
|  
|size()|  
|  
|  
|
|  
|  
|  
|type()|  
|  
|  
|
|列规格|/|/|create table :4096列json数据类型|大部分列插入满规格变量数值|4097|报错提示正确|
|  
|  
|  
|update table：跟新第1、2048、4096列的存储值、数据类型等|分别更新为>1M、>5M、=32MB|/|/|
|  
|  
|  
|select：不报错截断显示|  
|  
|  
|
|  
|  
|  
|alter table xx drop c1\c2048\4096：删除部分列|  
|  
|  
|
|  
|  
|  
|delete：删除部分行|  
|  
|  
|
|  
|  
|  
|drop table：drop 4096列json数据table可正常drop掉|  
|  
|  
|


  


### 3.2、场景测试

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|DDL|  
|create时作为列的默认值|怎么构造直接默认32MB的json？貌似只能直接用json（字符串）32000，大clob直接构造不了|  
|  
|
|  
|  
|alter时作为列的default默认值|  
|  
|  
|
|  
|  
|create table ... as select ...json;|  
|  
|  
|
|  
|  
|create view ... as select ...json;|  
|  
|  
|
|DML|insert|insert into ... select ... json|  
|  
|  
|
|  
|  
|insert into all table|  
|  
|  
|
|  
|update|set|  
|  
|  
|
|  
|delete|  
|  
|  
|  
|
|DQL投影列|select|1MB\5MB\32MB|  
|  
|  
|
|  
|plsql|存储过程：过程体|  
|  
|  
|
|  
|  
|存储过程：入参|  
|  
|  
|
|  
|  
|udf|  
|  
|  
|
|  
|  
|udp|  
|  
|  
|
|  
|  
|udt|  
|  
|  
|
|  
|  
|匿名块|  
|  
|  
|
|函数影响|cast|cast([clob] as json)：32MB的clob，编码后<32M|  
|cast([clob] as json)：32MB的clob，编码后>32M|  
|
|  
|  
|  
|  
|cast([clob] as json)：>32MB的clob|  
|
|  
|  
|cast([json] as clob)：32MB json|  
|  
|  
|
|  
|  
|cast([json] as varchar/char)：编码前8000B的json|因为,cast ( xx as varchar(n char)) n > 8000 不支持,cast ( xx as varchar(n)) n > 8000 不支持|cast([json] as varchar/char)：32MB json|  
|
|  
|其它函数|length、lengthb、typeof用例过程中已覆盖|其他函数不需要单独测试，入参和返回都没改|  
|  
|
|多并发多session|  
|查询和增删改不同session并发操作|  
|  
|  
|
|运行模式|  
|yasql支持|  
|jdbc未支持|  
|
|  
|  
|  
|  
|c驱动未支持|  
|
|全中文json|  
|32MB数据增删改查|  
|  
|  
|
|  
|  
|32MBjson相关函数查看获取|  
|  
|  
|
|低版本升级|  
|老json数据（32000B\64KB）|增删改查、json函数运算功能都正常|  
|  
|
|  
|  
|老json数据||新数据（编码后=32MB）|增删改查、json函数运算功能都正常|  
|  
|
|异常场景|  
|kill session|插大内存数据过程中，终止当前操作，释放内存，不会core,不会内存泄漏（开发日志，上车前去掉），不会卡死|  
|  
|
|  
|  
|kill 进程|  
|  
|  
|
|  
|  
|ctrl+c|  
|  
|  
|
|列存适配|  
|heap|  
|  
|  
|
|  
|  
|lsc|  
|  
|  
|
|  
|  
|tac|  
|  
|  
|


# **4. 详细设计**

#   
  5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|---|---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[文本用例-json支持32MB.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWZhMWFkOWEzMzExZGM3NjI3IiwicmVmX2lkIjoiNjczOTY5NWY1OTNmOTljOWZmMjM0ZGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTIwLCJleHAiOjE3ODIyMTMzMjB9.ybpklfCh00OjGFbH5FgetLwgVOifq_dM66-9LLv-ufE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[json支持32MB大内存.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWZhMWFkOWEzMzExZGM3NjI4IiwicmVmX2lkIjoiNjczOTY5NWY1OTNmOTljOWZmMjM0ZGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTIwLCJleHAiOjE3ODIyMTMzMjB9.HsYuiwotNktddrKvVJ3aVjhBInR253gbSVoZDgDhTOw)

 (application/x-xmind)    


[文本用例-json支持32MB.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWY4OTcwYzJhZjRmNTFmN2IxIiwicmVmX2lkIjoiNjczOTY5NWY1OTNmOTljOWZmMjM0ZGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTIwLCJleHAiOjE3ODIyMTMzMjB9.AbueaAzctwKM_L1TLdLoae_U-UG4TuHfZMLhV5i8-9U)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[json支持32MB大内存.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWZhMWFkOWEzMzExZGM3NjI5IiwicmVmX2lkIjoiNjczOTY5NWY1OTNmOTljOWZmMjM0ZGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTIwLCJleHAiOjE3ODIyMTMzMjB9.JF38Cp3nBpbnJd6ofuE_1nNXmnKRleeCPSOTnV38r24)

 (application/x-xmind)    
