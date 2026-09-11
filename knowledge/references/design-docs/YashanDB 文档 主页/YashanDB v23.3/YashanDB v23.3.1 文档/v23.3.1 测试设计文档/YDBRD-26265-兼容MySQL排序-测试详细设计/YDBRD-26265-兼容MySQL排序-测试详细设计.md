Created by 孟麟, last modified on 七月 12, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/6619125afd997db58ad89093](https://pingcode.yasdb.com/pjm/items/6619125afd997db58ad89093)    ?    
  #YDBRD-26265 兼容MySQL排序

兼容以下MySQL排序：

 latin1_bin

~~utf8mb4_0900_ai_ci~~

utf8mb4_bin

utf8mb4_general_ci

  


## 1.1相关文档

开发文档：    [详细设计-YDBRD-26265 兼容MySQL排序方案设计](156128230.html)  

测试调研：    [YASHAN-927_测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=153020791)  

# 2. 需求分析

## 2.1 功能点分析

**1、字符集和字符序兼容**

（1）兼容

yashan只支持在建库时指定字符集，其他场景或语句均不支持指定字符集和字符序，mysql在create database/schaema/table、dml等场景和语句均支持指定字符集和字符序，这里的兼容就是指在mysql模式下实现前述mysql语句语法兼容（语句能执行成功，功能不生效）

（2）字符集和字符序范围和对应关系

- mysql支持的字符集和字符序非常多，比yashan当前支持的范围更大，上述兼容虽然是语法兼容，也需要在yashan真实支持的范围内，范围和关系如下：


![](https://pingcode.yasdb.com/atlas/files/public/67396e60a1ad9a3311dc96f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFRQUFBRUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE2NTEsImV4cCI6MTc4MjM4MjQ1MX0.87iVaEdDzXQK9qKwQgzAQJFtC0UWSrR62cx9jyqwls4)

其中   **1）字符集和字符序的名称与mysql一致，与yashan映射关系（内部）**

![](https://pingcode.yasdb.com/atlas/files/public/67396e608970c2af4f52187c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFRQUFBRUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE2NTEsImV4cCI6MTc4MjM4MjQ1MX0.87iVaEdDzXQK9qKwQgzAQJFtC0UWSrR62cx9jyqwls4)

**2）没有显示**  **utf8/utf8mb3，实际**  **支持**  **utf8/utf8mb3，映射为utf8mb4处理，即语句中支持输入utf8、utf8mb3，等效于utf8mb4；包括字符集和字符序，如下：**

**utf8mb3_bin                 utf8mb3**  **  
**  **utf8mb3_general_ci     utf8mb3**

**utf8_bin                        utf8**  **  
**  **utf8_general_ci            utf8**

**3）对于latin1_swedish_ci，yashan本身不支持该字符序，但其作为mysql latin1字符集的默认字符序，需要做语法兼容**

**4）对于utf16，ddl和dml中使用会失败，评审时提出不建议保留，开发决定保留，需在资料中说明**

（3）兼容的语句范围：create schema/database,alter schema/database、create table/alter table

  


**2、功能场景   **  **评审结论：语法及功能均不支持**

除上述语法兼容外，在dml中，如果指定字符序，将实际生效，即按照指定的字符序对结果进行排序，  **支持：**  **order by、group by和where，不支持：字符串字面量**

create table test_collation(c1 char(20));

insert into test_collation values('a');

insert into test_collation values('A');

insert into test_collation values('d');

insert into test_collation values('D');

insert into test_collation values('中');

insert into test_collation values('&');

select * from test_collation order by c1;  --默认utf8mb4_general_ci，不区分大小写

select c1 from test_collation   **order**   by c1 collate utf8mb4_bin; --区分大小写

select c1 from test_collation order by c1 collate utf8mb4_general_ci;

select c1 from test_collation   **group**   by c1 collate utf8mb4_bin;

select c1 from test_collation group by c1 collate utf8mb4_general_ci;

select c1 from test_collation   **where**   c1 collate utf8mb4_general_ci = 'a';

select c1 from test_collation where c1 collate utf8mb4_bin = 'a';

--不支持

SELECT _utf8mb4'这是一段文本';

## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

- 崖山支持的PINYIN字符序暂未在mysql模式下支持
- 评审开发决定保留utf16，但是出现在语句中执行失败，开发需在资料中说明清楚


# 3. 详细测试设计

## 3.1 测试设计方法

测试点分析采用等价类、边界值、场景分析等测试设计工程方法

## 3.2 详细测试设计

1、功能测试分析

|测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|mysql字符序兼容|出现字符集/字符序的语句,ddl|create database|支持的字符集和字符序匹配组合|已有需求测试过，覆盖差异项|- 不支持的字符集
- 不支持的字符序
- 支持的字符集，不支持的字符序
- 支持的字符集、字符序，但不匹配
|报错，报错信息明确|
|  
|  
|alter database|支持的字符集和字符序匹配组合|已有需求测试过，覆盖差异项|同上|  
|
|  
|  
|create schema|支持的字符集和字符序匹配组合|已有需求测试过，覆盖差异项|同上|  
|
|  
|  
|alter schema|支持的字符集和字符序匹配组合|已有需求测试过，覆盖差异项|同上|  
|
|  
|  
|create table|表、列和表+列,支持的字符集和字符序匹配组合|已有需求测试过，覆盖差异项|同上|  
|
|  
|  
|alter table|表、列和表+列,支持的字符集和字符序匹配组合|已有需求测试过，覆盖差异项|同上|  
|
|  
|dml|select|/|/|1、order by + 支持的字符序,group by + 支持的字符序,where + 支持的字符序,2、字符序与当前字符集不匹配,3、  [  _  *charset_name*  ]  '  *string*  '     [  COLLATE     *collation_name*  ]|报错，报错信息明确|


  


2、经分析不涉及专项测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|N|
|KT|N|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


# 4. 测试用例

1. 冒烟：
1. 1、支持的字符集和字符序，可以执行成功    
  CREATE DATABASE mydatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;    
  2、不支持的报错    
  CREATE DATABASE mydatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
1. 文本用例：待补充


# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：2  *人天*

计划测试完成时间：

## Attachments:

[image2024-7-3_9-12-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjBhMWFkOWEzMzExZGM5NmVkIiwicmVmX2lkIjoiNjczOTZlNjA3MjgyMDZlZmI5MmYyN2E4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjUxLCJleHAiOjE3ODI0NTgwNTF9.8j4YZe6iFX_yFEeRQNELL4mcBqY_M7u5HFd2ZAAebz8)

 (image/png)    


[image2024-7-2_16-35-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjBhMWFkOWEzMzExZGM5NmVlIiwicmVmX2lkIjoiNjczOTZlNjA3MjgyMDZlZmI5MmYyN2E4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjUxLCJleHAiOjE3ODI0NTgwNTF9.LtAyBrk3sCl3wOt9ywh-QgIw1so6Nto0Mt1XtHr1nT0)

 (image/png)    


[image2024-6-17_15-31-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjBhMWFkOWEzMzExZGM5NmVmIiwicmVmX2lkIjoiNjczOTZlNjA3MjgyMDZlZmI5MmYyN2E4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjUxLCJleHAiOjE3ODI0NTgwNTF9.1dw4YPe6rtgE3L2XZ6TjRUqFACY5dIx4jmARQSFQrqA)

 (image/png)    
