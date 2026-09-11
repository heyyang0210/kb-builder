Created by 周彬鑫, last modified on 七月 04, 2024

# 1. 概述

*SR:*    [https://pingcode.yasdb.com/pjm/items/6674d432288e197820aa785d](https://pingcode.yasdb.com/pjm/items/6674d432288e197820aa785d)    *?*    
  *#YDBRD-29534 支持Last_Insert_ID()函数*

支持last_insert_id()函数，返回上一个有表达式的函数或自增的结果值。

在yashan中，当一列的default为seq，且为primary key时，视为自增。

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


## 2.2 应用场景

- mysql中为auto_increment。yashan中为default为seq，且为primary key时，视为自增。向该列非显式插入值时，更新LAST_INSERT_ID的值。


## 2.3 规格约束

- mysql中该函数的返回值为uint64，yashan为int64。
- 暂未支持auto_increment关键字，客户场景使用default sequence作为主键默认值，且不显示插入主键值
- 当参数为小数时，四舍五入进行输出（Mysql中如果是字符串小数，去尾法）。
- 单条语句插入多行时，该函数的返回值以第一行的对应自增值一致。
- 不约束非空时，yashan插入null为null，mysql插入null为自增序列的值，保持差异


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

**函数测试点：**

|一级测试点|二级测试点|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|参数|参数个数|0个、1个|2个|  
|
|  
|参数为特殊值|空串、null|  
|  
|
|  
|参数覆盖数据类型|smallint、tinyint、int、bigint、float、double、number、char、varchar、nchar、nvarchar、raw、json、xmltype、blob、clob、nclob、date、time、timestamp、interval 、bit|UDT|  
|
|  
|参数为数值型|浮点数、numbe、整型(取整规则：yashan四舍五入)|  
|  
|
|  
|  
|数值型常量、字符串数值|  
|  
|
|  
|参数为字面量|date/bit/interval/|  
|  
|
|  
|参数为伪列|rowid/unrowid/rownum/rowscn/sql.nextval|  
|  
|
|  
|参数为表列|覆盖所有类型表列|  
|  
|
|  
|参数为表达式|布尔表达式、运算表达式、null表达式、连接符运算|  
|  
|
|  
|参数为内置函数|数值函数、字符函数、日期函数、转换函数、其他函数、窗口函数、聚集函数|  
|  
|
|  
|函数自嵌套|127层、128层|  
|  
|
|  
|参数为子查询|  
|  
|  
|
|函数名称|关键字校验|函数名称大小写、拼写错误、名称缺失，带单/双引号；|  
|  
|
|  
|  
|与表、视图同名；|  
|  
|
|  
|  
|v$function新增函数名|  
|  
|
|函数返回值|返回值类型|typeof|  
|  
|


**函数语法位置：**

|测试点|有效等价类|备注|
|---|---|---|
|DQL|group by/having /order by/connect by/join on |  
|
|  
|子查询|  
|
|  
|操作符：in/not in、exists/not exists 、between and、like/not like|  
|
|  
|filter 比较运算|  
|
|  
|CTE|  
|
|DDL|create table as select|  
|
|  
|create view/materialized view as select|  
|
|DML|insert into values/insert into select|列表insert 不带自增列，补NULL?|
|  
|update|  
|
|  
|delete|  
|
|绑定参数执行|plsql|  
|
|  
|jdbc|  
|
|PLSQL中使用|存储过程、触发器相关？|MYSQL的表现？,![](https://pingcode.yasdb.com/atlas/files/public/67396daf8970c2af4f521491/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA2NTQsImV4cCI6MTc4MjMyMTQ1NH0.Yhro59Osf2GlaZUvs2SMQi4kbgK8ezUt8DD2K-tuZaU)|


**函数功能：**

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|存在自增序列、主键的表,插入数据，含主键，查询|参数为0个、空串、null、字段|  
|  
|
|插入数据，不含主键，查询|参数为0个、空串、null、字段|  
|  
|
|from table|from table为空表|  
|预期last_insert_id的结果与表无关|
|  
|from table为其他表|  
|  
|
|  
|from table为插入表|  
|  
|
|多行insert后查询|insert into test1(name ) values('aaa'),('aaa'),('aaa');,LAST_INSERT_ID为第一行的值|  
|  
|
|删除后重建同名表 查询|  
|  
|预期last_insert_id不变|
|删除序列后建同名序列|重建序列后查询,插入后再查询|  
|  
|
|插入嵌套LAST_INSERT_ID|insert into values()、insert into select|  
|  
|
|显示主键插入|插入后查询|  
|  
|
|  
|插入自增值/非自增值查询|  
|  
|
|不显示主键插入|插入后查询|  
|  
|
|结合DDL,ALTER TABLE MODIFIED|原primiry key+default seq,改为非default seq/非primiry key|  
|除primary key，还有其他索引：create index、unique,LSC表不支持ALTER TABLE修改表列|
|  
|原非default seq/非primiry key，改为primiry key+default seq|  
|除primary key，还有其他索引：create index、unique|
|不同session查询|原session查询->新session查询|  
|  
|
|  
|多session同时插入|  
|  
|
|插入时主键冲突|insert 指定数值插入，seq自增重复值插入|  
|预期:报错，last_insert_id正常更新|
|  
|有唯一约束/没有唯一约束|  
|  
|
|default sequence|seq为自减序列|  
|  
|
|  
|seq值为负数|  
|  
|
|  
|seq值到达边界/超出边界 -2  63  , 2  63     - 1|-2  63  -1， 2  63   |  
|
|  
|同一个sequence在多个表中|  
|  
|
|  
|seq为循环|  
|  
|
|  
|seq到达边界值|  
|  
|
|  
|插入多行，部分成功部分失败|  
|mysql查出来last_insert_id不变、yashan插入失败但last_insert_id更新|
|同一个表有多个default_seq|多个不同sequence|  
|结合联合主键|
|  
|多个相同sequence|  
|  
|
|表类型|普通表|  
|  
|
|  
|分区表|  
|简单覆盖|
|  
|临时表|  
|简单覆盖|


## 测试范围

|部署形态|存储|  
|
|---|---|---|
|单机|行、列|  
|
|分布式|  
|  
|
|集群|  
|  
|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
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


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

## Comments:

|  [](null)  ,1、列表insert不带自增列，补null？,2、自增值超int64，函数返回值为0。（补充文档规格限制）,3、insert多行时，部分失败、插入失败但last_insert_id更新？与mysql不一致,Posted by zhoubinxin at 七月 04, 2024 16:30|
|---|
