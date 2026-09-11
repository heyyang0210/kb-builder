Created by 陈钦卿, last modified on 七月 02, 2024

# 1. 概述

SR：  [https://pingcode.yasdb.com/pjm/items/67c912b07ce85d5a07574c4c?](https://pingcode.yasdb.com/pjm/items/67c912b07ce85d5a07574c4c?)  #YDBRD-38762 支持to_single_byte函数

开发设计：  [YDBRD-38762 支持to_single_byte函数设计文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67e7ad53529b5c0231d04e3b)  

交付形态：单机、集群

版本：23.2.11

# 2. 需求分析

## 2.1 功能点分析

将字符串中的多字节字符（例如全角字符）转换为等价的单字节字符（例如半角字符）。

**U+FF01..U+FF5E**   编码了 ASCII 内 21 至 7E 的全角版本。  **U+FFE0..U+FFEE**   编码了全角及半角符号。

![image.png](https://pingcode.yasdb.com/atlas/files/public/67eba36239823f2ac1f27382/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQVFBQUFBQUFBQUFJQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjM0ODMsImV4cCI6MTc4MjM3NDI4M30.vanYJIU-1YoNK5p1P9lZUOxn6ssWaEcfnuwuL3jTnk0)

## 2.2 应用场景

处理包含中日韩等字符集的数据  


## 2.3 规格约束

1. 支持xmltype。支持json。
1. 支持heap表，  不支持lsc表，tac表。    



# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|测试场景|测试项一|测试项二|有效等价类|无效等价类|备注|
|---|---|---|---|---|---|
|函数校验|参数校验|参数个数|1|0、2||
|||参数内容|- 包含全角字符、不包含全角字符
- 字面量：字符串字面量、数值字面量（科学计数法数值字面量）、日期字面量、时间戳字面量、二进制字面量等
- 空格、空串
- EMPTY_BLOB()、EMPTY_CLOB()
- null——返回null
- 特殊字符2字节(拉丁文，希腊文等)、3字节(中文，日文，韩文等)、4字节(表情))
- null表达式、拼接表达式、布尔表达式
- 函数：转换函数（cast）、字符函数（replace、initcap、substr等）、控制函数（case、if）、拼接函数（CONCAT、CONCAT_WS）、窗口函数等
- 表列，遍历所有类型
    - char、varchar、  CLOB、nchar、nvarchar、nclob
    - tinyint、smallint、int、bigint、float、double、decimal、bit、boolean、raw、  date、time、timestamp、timestamp with time zone、timestamp with local time zone、YM_INTERVAL、DS_INTERVAL、rowid、urowid、  BLOB
    - json、xmltype
    - ST_GEOMETRY——不支持
|- 无对应半角字符的全角字符原样输出，例：”。“
|sysdate+interval 做入参，走列执行，打印执行计划验证——不支持列表,mysql模式下拦截否？|
||函数名|拼写|- 大写、小写、大小写混合
- 带单双引号
- 与表/视图同名
- v$function视图新增函数名
|拼写错误||
||返回值类型|VARCHAR|nchar-》nchar,返回值长度|||
||自嵌套|127/128层||||
|功能校验|字符集|- GBK/GB18030
- ASCII
- UTF8
- ISO88591
||||
||字符数据类型边界||- CHAR(8000)，8000个全角字符
- lpad('？',32000,'。')、LPAD('？',32000,'！')
|||
||结合函数|函数返回值作为其他函数入参|- 数学函数
- 转换函数（cast）
- 字符函数（replace、initcap、substr）
- 时间函数（day、dayofweek）
- 控制函数（case、if）
- 拼接函数（CONCAT、CONCAT_WS）
|||
||表类型|非分区表、分区表、临时表|作为分区条件|||
|函数语法位置|DQL|投影列+函数嵌套|select多个to_single_byte函数|||
|||filter列+  操作符：in/not in、exists/not exists 、like/not like||||
|||- group by
- having 
- order by
- connect by
- join on
||||
|||子查询||||
|||CTE||||
||DDL|- create table/view as select
- create materialized view as select
- default列
||||
||DML|- insert into values
- insert into select
- INSERT ... ON DUPLICATE KEY UPDATE
||||
|||update||||
|||delete||||
||plsql|绑定参数||||
||jdbc|绑定参数||||
||dblink|||||




|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|是||
|KT|是||
|长稳|||
|一致性|||
|三方测试工具(sqltest，sqlancer)|||
|安全|||
|DFR|||
|HA|||
|压力|||
|性能|否||
|可维护性|||


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  [ YTP (yasdb.com) ](https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_LfzlymyG&theme=to_single_byte%E8%87%AA%E5%8A%A8%E5%8C%96%E7%94%A8%E4%BE%8B%E5%92%8C%E5%BD%B1%E5%93%8D%E7%94%A8%E4%BE%8B%E4%B8%8A%E5%BA%93)  

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdlZTU5ZDkyZDJlZmZlOGZiMjVkMGJkIiwicmVmX2lkIjoiNjdlZTU5ZDkyZDJlZmZlOGZiMjVkMGM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzYzNDgzLCJleHAiOjE3ODI0NDk4ODN9.fO6o-jXnQhGUcve1OB1VKKN7cf_mZfAdGHB145MR13g)

  
