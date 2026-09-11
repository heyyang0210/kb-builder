Created by 钟溱, last modified on 十月 12, 2024

# 1. 概述

本文描述MD5函数测试设计

# 2. 需求分析

- 支持MD5函数，用于校验数据，输入VARCHAR/NVARCHAR/BLOB/CLOB/NCLOB/NCHAR/CHAR，输出VARHCAR,md5值
- 22.2SR:    [YDBRD-22287](https://jira.yasdb.com/browse/YDBRD-22287?src=confmacro)    -  支持MD5函数  完成
- 23.2SR：    [YDBRD-23038](https://jira.yasdb.com/browse/YDBRD-23038?src=confmacro)    -  支持MD5函数，用于校验数据  完成
- 开发设计：    [MD5设计文档](133582841.html)  


## 2.1 功能点分析

- ### q语法图


![](https://conf.yasdb.com/download/attachments/133582841/image2023-10-31_16-31-28.png?version=1&modificationDate=1698740889000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUlBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFRQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0MzEsImV4cCI6MTc4MjMwNzIzMX0.22S7RuW9_soN_Bdxm_g1lpTM4keUdXn6ruldmTOtLlI)

- ### 功能特性


1、支持MD5函数，用于校验数据，输出的md5值对比mysql的一致。

2、为字符串算出一个固定长度的32位的16进制md5值（底层存的是128位二进制值）。

  


## 2.2 应用场景

- 函数作为整体拼接其他不同数据类型，不同单位拼接，需要关注长度（length\lengthb）和返回类型（typeof）是否正确，规格和限制与varchar对齐
- 支持数据库的DDL、DML、DQL、plsql等操作


## 2.3 规格约束

- 参数支持的数据类型：
- 参数为null或空串时返回值为null。
- 当表中插入纯空格字符串时，对不同长度的空格均返回d41d8cd98f00b204e9800998ecf8427e。（做变量）
- 函数会对字符串末尾的空格进行消除。
- 当直接求空格的md5值时，每多一个空格md5值不同。（做常量）
- ![](https://pingcode.yasdb.com/atlas/files/public/67396bb38970c2af4f520662/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUlBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFRQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0MzEsImV4cCI6MTc4MjMwNzIzMX0.22S7RuW9_soN_Bdxm_g1lpTM4keUdXn6ruldmTOtLlI)
- 返回值均为varchar(32)类型。
- bool类型返回值固定为：
- true/1:c4ca4238a0b923820dcc509a6f75849b
- false/0:cfcd208495d565ef66e7dff9f98764da


|char|nchar|varchar|nvarchar|int|integer|smallint|bigint|tinyint|float|double,  
|date|timestamp|BLOB|CLOB|NCLOB|BOOL|JSON|BIT|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|---|---|:---|:---|:---|
|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

## 3.2 详细测试设计

|条件1|条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|函数名    
    
|函数关键字    
    
|函数名全大写\函数名全小写|  
|  
|  
|
|||函数名大小写混合|  
|关键字缺失、单词写错|报错合理|
|||入参1个|  
|入参0个，大于1个|报错合理|
|||创建同名对象|列名、表名、视图名|  
|  
|
|expr1参数    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
,  
,  
,  
,  
|空    
    
    
    
    
    
    
|常量null,  
|大小写、加 ‘ ’ 号|  
|  
|
|||'' 、'  '、'   ',char做常量时每多一个空格md5值不同,做变量时不同长度的空格均返回d41d8cd98f00b204e9800998ecf8427e,cast强制转换空值为字符型、日期型|mysql可以用cast转空值为date和time，返回null,![](https://pingcode.yasdb.com/atlas/files/public/67396bb48970c2af4f520663/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUlBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFRQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0MzEsImV4cCI6MTc4MjMwNzIzMX0.22S7RuW9_soN_Bdxm_g1lpTM4keUdXn6ruldmTOtLlI)|强制转换空值为数值型、timstamp、大对象、bit、布尔型|报错合理|
|||数据+空格|对字符串末尾的空格都进行消除（做变量时消除，做常量不消除）,(对开头和中间的空格不做消除处理)|  
|  
|
||常量/变量    
    
    
    
    
    
    
    
    
    
    
    
|数据类型：,- 数值型：smallint、tinyint、int、bigint、float、
,double  (转字符型会以科学计数法的形式出现，md5计算的时候科学计数法的值，而不是double数值的值)  、,number，  inf、-inf、nan  ，科学计数法,- 字符型：char、varchar、nchar、nvarchar，覆盖普通字符串、特殊字符、中文
- json：array、  object
- raw（mysql会报错，oracle可以（自定义md5函数））
- boolean：‘true’、‘TRUE’、‘1’、‘t'、'yes'、 'y'、 'on'、'false'、'FALSE'、'0'、'f'、 'no'、 'n'、 'off'
- 时间类型
- 大对象
- bool
- bit
|string:,- 特殊字符：  中文、符号(\",\/,\\），表情包，外语、转义字符等
- 空格、空字符串、"null"--占1字符
- 不可见字符：\b、\f、\n、\r、\t等
- 基本常用字符串：英文、标点符号等
, number：（边界值）,- 整数、浮点数、0、科学计数法（E，e）、特殊值：inf、-inf、nan
- 有无符号 、前面是否有0、小数点前是否有0
,boolean：,'true'、't'、 'yes'、 'y'、 'on'、 '1','false'、'f'、 'no'、 'n'、 'off'、 '0',（之后合23.2和23.1时候加xmltype数据类型）|超过边界值|  
|
|函数功能|与其它函数互相嵌套|字符函数：cast、trim、replace、position、ltrim/rtrim、left、right、trunc、concat、substr、split、coalesce、strpos、group_concat,数值类型函数：rankover、max/min/sum/avg,其它函数：length、lengthb、typeof|  
|  
|  
|
|||自嵌套|127层|超过127层|  
|
|  
|plsql|case、if、for,存储过程、  匿名块、  自定义函数、  自定义高级包|  
|  
|  
|
|  
|jdbc|绑定参数|  
|  
|  
|
|  
|v$function 中新增函数名|有MD5函数|  
|  
|  
|
|  
|其他表类型|临时表,lsc/tac不支持：拦截该函数|  
|  
|  
|
|参与运算|/|覆盖MD5函数参与运算符运算|+，-，*，/、> <..|  
|  
|
|大规格|/|入参边界值覆盖|数据类型的最大值|  
|  
|
||/|运算过程最大值|32K，lpad函数或者concat函数拼接|  
|  
|


## 3.3   场景测试，简单覆盖，不做重点进行测试

|输入条件|等价类|  
|
|:---|:---|:---|
|DDL,  
|create时作为列的默认值|报错，提示正确|
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
||结合join|1. 作为join投影列
1. 作为join条件（on,where）
|
||结合in/not in/exists/not exist/between and/like/not like/,any/all/some/is null/is not null等子查询|  
|
||结合group by分组(聚合函数和窗口函数)|  
|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|
||结合distinct|报错，提示正确|


1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


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

工作量：6  *人天*

计划测试完成时间：

## Attachments:

[YDBRD-22287 MD5函数冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjNhMWFkOWEzMzExZGM4NGQ1IiwicmVmX2lkIjoiNjczOTZiYjM3MjgyMDZlZmI5MmYwOTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDMxLCJleHAiOjE3ODIzODI4MzF9.BvLIln4gvyILJVc1BmBzQEEWcwKMDqymwX-DsoTCBxM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
