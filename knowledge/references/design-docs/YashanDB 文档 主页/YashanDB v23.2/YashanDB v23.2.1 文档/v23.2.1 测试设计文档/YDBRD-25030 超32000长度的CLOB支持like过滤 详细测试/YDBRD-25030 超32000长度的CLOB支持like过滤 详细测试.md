Created by 钟溱, last modified on 十月 12, 2024

#   [SR链接：](https://jira.yasdb.com/browse/YDBRD-24796)  

  [YDBRD-24796](https://jira.yasdb.com/browse/YDBRD-24796?src=confmacro)    -  超32000长度的CLOB支持like过滤  完成

  [YDBRD-25030](https://jira.yasdb.com/browse/YDBRD-25030?src=confmacro)    -  超32000长度的CLOB支持like过滤  完成

# 1. 概述

本文档描述超32000长度的CLOB支持like过滤的测试设计

# 2. 需求分析

## 2.1 功能点分析

- LIKE条件指定搜索值包含的匹配模式。
- 基本语法为：
- ![](https://pingcode.yasdb.com/atlas/files/public/67396bbba1ad9a3311dc8512/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQWdBQUNBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFFQUFBQUFBQVFBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFRQUFBQUFBQUFBQUFFQUFBRUlBUUFBQUFBUUFBQUFBQUFBQUFBQUFBQWdBQVFBQUFBQUFBQUFBQUFBQUFBQUFvQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY1NzMsImV4cCI6MTc4MjMwNzM3M30.Xmrw2FH4-WmZOmm6WTaY0XkbzUNnI7dg6DbH4EPCLmQ)
- char1是一个字符表达式，例如一个字符列，叫做搜索值。
- char2是一个字符表达式，通常是一个字面量，叫做模型。
- esc_char是一个字符表达式，通常是一个字面量，叫做转义字符。
- 1）如果不指定esc_char,则没有默认转义字符。如果char1,char2或esc_char任何一个为空，则结果是未知的。如果搜索值即char1中包含_或%，则需要使用escape子句
- 2）所有的表达式可以是数据类型中的任何一种。如果他们的数据类型不一样，都将转为VARCHAR类型进行判断。
- 3）模型可以包含特殊字符匹配模式：
- 下划线（_）：严格匹配一个字符。
- 百分号（%）：可以匹配零个或多个字符。
- 2）char1支持超32000B长度


## 2.2 应用场景

- 需求本身的主要应用场景：


超过32000B长度时的like/not like数据类型覆盖、like/not like通配符使用、like/not like应用位置

- 需求与其他特性的关联场景：


DDL、DML、PLSQL中涉及超过32000B长度时的like/not like条件过滤

## 2.3 规格约束

- 此SR只支持clob类型超32000；
- 绑定参数（plsql\jdbc都支持);
- like左右两边是否都支持超32000长度，比如两个表的超长列和列做 like;
- pattern expr在内部处理会隐式转换成字符型，长度不能超过32000字节;
- 服务端字符集不是GBK字符集、当前like不带escape表达式、pattern表达式不超过255B，同时满足这3者时走kmp算法like匹配，其他时都走通用like匹配逻辑;


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

not like 复用like测试点

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


|条件1|条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|数据类型|clob列数据|中文、英文（大小写）、数字、特殊字符、为空、外文、表情包|  
|  
|  
|
||clob的长度|0 ~ 32K、32000B、32001B、65536、65537、2097152、33554432、>32MB|均能正常执行|  
|  
|
|pattern条件|边界条件|大小写敏感性|确保LIKE过滤区分大小写，eg：    `%Lorem%和`      `%lorem%`  ,  
|  
|  
|
|||特殊字符开头|使用特殊字符进行LIKE过滤，eg：%!@#$%^&*()_+-%]%|  
|  
|
|||数字开头|eg：%1234%|  
|  
|
||无效的LIKE过滤|  
|  
|  
|  
|
||pattern的长度|空字符，1 ~ 255字节，255字节 ~ 32000字节，32000字节以上（报错）|  
|  
|  
|
||pattern的内容|不含通配符,含 百分号 通配符（百分号表示匹配任意个字符）,含 下划线 分配符（下划线表示匹配一个字符）,混合情况（通配符可在任意位置，包括但不限于首部、尾部）,eg:,```
<span class="token">%A%b%c%d%e%f%g%h%i%j%k%l%m%n%o%p%q%r%s%t%u%v%w%x%y%z%
</span>
```,```
<span class="token">%lorem%ipsum%、</span>
```,一个长度为32000的CLOB进行LIKE过滤    
  两个长度为16000的CLOB拼接进行LIKE过滤（及32000以上）|  
|  
|  
|
||两个clob列|  
|  
|  
|  
|
|  
|escape|  
|- escape用于转义特殊的模式匹配字符，即将%或_转变为本身的字面意思。如指定了escape，则char2中的esc_char后字符必须为%或_或esc_char自身，否则返回YAS-04428或YAS-04429错误。
- esc_char后字符为esc_char自身，表示将其转变为本身的字面意思，如当esc_char为    `/`    时，模式    `//`    匹配的就是    `/`    这个字符，但    `///`    中的第三个    `/`    将作为转义符。
- esc_char必须是长度1的字符，也可以是运算后变成长度为1的字符
|  
|  
|
|  
|函数嵌套|使用LOWER()、UPPER()和LIKE操作符的查询,eg：    `WHERE LOWER(clob_data) LIKE '%lorem%'`  |  
|  
|  
|
|||CONCAT、EMPTY_CLOB、LTRIM、RTRIM、SUBSTRING、STRING_AGG（这些函数的返回类型为clob类型）|  
|  
|  
|
|  
|数据类型转换|![](https://pingcode.yasdb.com/atlas/files/public/67396bbb8970c2af4f52069b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQWdBQUNBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFFQUFBQUFBQVFBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFRQUFBQUFBQUFBQUFFQUFBRUlBUUFBQUFBUUFBQUFBQUFBQUFBQUFBQWdBQVFBQUFBQUFBQUFBQUFBQUFBQUFvQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY1NzMsImV4cCI6MTc4MjMwNzM3M30.Xmrw2FH4-WmZOmm6WTaY0XkbzUNnI7dg6DbH4EPCLmQ),![](https://pingcode.yasdb.com/atlas/files/public/67396bbba1ad9a3311dc8513/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQWdBQUNBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFFQUFBQUFBQVFBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFRQUFBQUFBQUFBQUFFQUFBRUlBUUFBQUFBUUFBQUFBQUFBQUFBQUFBQWdBQVFBQUFBQUFBQUFBQUFBQUFBQUFvQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY1NzMsImV4cCI6MTc4MjMwNzM3M30.Xmrw2FH4-WmZOmm6WTaY0XkbzUNnI7dg6DbH4EPCLmQ),cast （xx as clob）|  
|  
|  
|
|DDL    
    
|建表\视图|create table as select,create view as select|超长列做filter条件like过滤|  
|  
|
||modify column|  
|超长列做filter条件like过滤|  
|  
|
||索引|create index|超长列做filter条件like过滤,cannot create index on expression with datatype CLOB|  
|  
|
|DML|  
|select、update、delete、MERGE INTO、insert into select、select into、group by having条件、join on条件|  
|  
|  
|
|DQL|作为select投影列返回|  
|  
|  
|  
|
||作为where条件|1. where func(col1) = xx
1. where col1 = func(xx)
|  
|  
|  
|
||结合join|1. 作为join投影列
1. 作为join条件（on,where）
|  
|  
|  
|
||结合in/not in/exists/not exist/between and/like/not like/,any/all/some/is null/is not null等子查询|![](https://pingcode.yasdb.com/atlas/files/public/67396bbb8970c2af4f52069c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQWdBQUNBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFFQUFBQUFBQVFBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFRQUFBQUFBQUFBQUFFQUFBRUlBUUFBQUFBUUFBQUFBQUFBQUFBQUFBQWdBQVFBQUFBQUFBQUFBQUFBQUFBQUFvQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY1NzMsImV4cCI6MTc4MjMwNzM3M30.Xmrw2FH4-WmZOmm6WTaY0XkbzUNnI7dg6DbH4EPCLmQ)|  
|  
|  
|
||结合group by分组(聚合函数和窗口函数)|  
|  
|  
|  
|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|  
|  
|  
|
|PLSQL|  
|  
|dbms_output.put_line不能输出大于32000的字符|  
|  
|
|绑定参数|  
|  
|  
|  
|  
|
|异常场景|  
|语法错误、匹配数字/布尔/时间类型、空表查询、查询不存在的列（看下原有用例）|  
|  
|  
|
|大的clob|  
|4G*8k    2M|手动|  
|  
|
|场景|  
|GBK|  
|  
|  
|


  


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|否|  
|
|KT|否|  
|
|长稳|否|  
|
|一致性|否|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|否|  
|
|DFR|否|  
|
|HA|否|  
|
|压力|否|  
|
|性能|否|  
|
|可维护性|否|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 使用guider框架，执行sql文件 对比预期与实际输出结果


# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *7人天*

计划测试完成时间：2024-01-12

  [详细测试设计文档模板.doc](#)  

  


## Attachments:

[image2023-11-6_17-38-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmFhMWFkOWEzMzExZGM4NTBmIiwicmVmX2lkIjoiNjczOTZiYmE1OTNmOTljOWZmMjM2NjYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTczLCJleHAiOjE3ODIzODI5NzN9.mb7kFw6uu2qhwvs8XRPucxNpS4HvZgBoa6B4707L2Zc)

 (image/png)    


[YDBRD-24796超32000长度的CLOB支持like过滤冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmJhMWFkOWEzMzExZGM4NTExIiwicmVmX2lkIjoiNjczOTZiYmE1OTNmOTljOWZmMjM2NjYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTczLCJleHAiOjE3ODIzODI5NzN9.9xEWtHepHhfDkhFOu0Z0VVQrHhE3MZLtF73eNk92vXw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
