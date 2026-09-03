Created by 张江, last modified on 八月 26, 2024

# 1.概述

SR链接：    [https://pingcode.yasdb.com/pjm/items/66a1b97866228b947076ec40](https://pingcode.yasdb.com/pjm/items/66a1b97866228b947076ec40)    ?#YDBRD-30719 instr函数支持clob类型

本次需求增加支持clob/nclob/blob/json类型

参考历史测试设计文档如下：

  [*coalesce/replace/instr函数测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=76928971)  

  [DBMS_LOB处理函数测试设计](135613114.html)  

# 2.需求分析

## 2.1功能点分析

instr：  根据子字符串(sub_character)、起始位置(position)、出现次数(occurrence)在    [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)    表示的字符串中查找，并返回第occurrence次出现的BIGINT类型的位置值，未查找到则返回0。

语法结构如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396dd78970c2af4f521577/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUVBQUFBQUVBQUVBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIxNzgsImV4cCI6MTc4MjMyMjk3OH0._7uZd9fiz7rsDcdeo3ReIE9zbmp0QkLn8buz0JXtaD8)

1)expr、sub_character：分别表示完整字符串和要查找的子串，为通用表达式，两个参数的值须为字符型或clob/nclob/blob/json类型，不支持xmltype类型或不可向字符型转换的其他类型；

2)position：开始查找的起始位置，为通用表达式，参数值为数值型数据，或可转换为NUMBER类型的其他类型数据，起始位置必须为整数，或可被转换为整数，取值范围[-9223372036854775808, 9223372036854775807]。正整数表示从前往后自起始位置开始查找，负整数表示从后向前自起始位置开始查找。

3)occurrence：指定按子字符串出现的第几次进行查找，是与expr相同的通用表达式，该值须为数值型数据，或可转换为NUMBER类型的其他类型数据。occurence的值必须为正整数，或可被转换为正整数，取值范围[1,9223372036854775807]。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机和集群，表类型为行存表；

列存表不支持lob(需拦截)

# 3.详细测试设计

## 3.1测试设计方法

主要采用等价类划分、场景法组合进行设计。

## 3.2详细测试设计

### 3.2.1等价类划分

本次等价类测试方法主要针对expr、sub_character参数支持clob/nclob/blob/json类型和非等价类的新增类型展开设计，具体如下:

|输入条件1|输入条件2|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,参数校验    
    
    
    
    
,  
,  
,  
,  
,  
    
|~~参数个数~~|可以是2、3或者4个|小于2或大于4|  
|
||参数类型|expr&  sub_character  ：clob、nclob,1)当expr或  sub_character  为clob/nclob类型时，可以匹配的类型有  ：,RAW/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR、数值型和日期时间型；,2)当expr或sub_character为为blob类型时，可以匹配的类型有：,RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR,3)当expr或sub_character为为json类型时，可以匹配的类型有：,CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR|expr&  sub_character  ：,udt、gis、  dbms_sql内置嵌套表类型|declare     
  v1 clob := '32e23d42024-12-01fef3e232';    
  v2 date := '2024-12-01';    
  res number;    
  begin     
  select instr(v1,v2) into res from dual;    
  dbms_output.put_line('res='||res);    
  end;    
  /,res=0|
||  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,参数值    
    
    
|expr有效数据如下;,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，\n、\r转义字符
- 日期、中文、英文、其他语言、表情包
- null值、空串''、空格
|/|1.大小写敏感,2.处理跨页：分段读取，每段32000字符，  sub_character len>1，跨段匹配；|
|||sub_character有效数据如下：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，\n、\r转义字符
- 日期、中文、英文、其他语言、表情包
- null值、空串''、空格
|/||
|||position：,- 当position的值为NULL时，函数返回NULL。
- 当position的值为0时，函数不执行查找并返回0。
- 不指定position时，默认起始位置为1。
- 当position的值为带有小数的NUMBER类型时，函数截断其小数位保留整数位。
- 若position的值为浮点类型时，函数将其奇进偶舍至整数。
|position&occurence：,udt、gis、  dbms_sql内置嵌套表类型|字符类型小数，函数截断其小数位保留整数位,边界值nan,inf,-inf,使用表达式,  
,  
|
|||occurence：,- 当occurence的值为NULL时，函数返回NULL。
- 不指定occurence时，默认为1。
- 当occurence的值为带有小数的NUMBER类型时，函数截断其小数位保留整数位。
- 若occurence的值为浮点类型时，函数将其奇进偶舍至整数
|||
||  
,  
,  
,  
,参数值组合|sub_character与expr匹配0次,sub_character与expr匹配1次：,- occurence=1，position=1
- occurence=1，position>1
,sub_character与expr匹配多次：,- occurence>1，position=1
- occurence>1，position>1
- occurence=最后一次匹配次数，position=1
- occurence=最后一次匹配次数，position>1
|/|  
|
|||- position<length(  expr)
- position>length(expr)
- position=length(expr)
- position为正数-正向匹配
- position为负数-逆向匹配
|/|重点：逆向匹配，需关注lob数据内容，包含中英文、特殊字符(空格、回车等)、表情符号等；,多字符跨段匹配|
|返回值校验|/|- 试用typeof查询返回值类型为bigint
- 返回值结果正确
|/|  
|
|lob来源|/|- 永久lob
- 临时lob
- memory lob
|/|  
|
|  
,  
,  
,  
,数据量|临时lob|in row：<=32000字节,out row：>32000字节|/|  
|
||  
,  
,  
,永久lob|out row  ：,- 行表：>=4000字节
- 列表：>=32000字节(补充拦截)
,in row  ：,- 行表：<4000字节
- 列表：<32000字节
- 行表：out row->dbms_lob.trim 小于4000字节
- ~~列表：out row->dbms_lob.trim 小于32000字节(列存表不支持更新lob)~~
|/|  
|
|字符集|/|覆盖不同字符集UTF-8(默认)、GBK|/|比较两种字符集之间的差异|


### 3.2.2场景测试点

|场景分类|场景描述|备注|
|---|---|---|
|  
,  
,  
,  
,  
,lob数据来源    
    
    
    
    
    
    
    
|定义clob/nclob类型的表列|  
|
||定义clob/nclob类型的普通变量、常量|  
|
||成员类型为clob/nclob的udt(object、varray、table)变量|  
|
||成员类型为clob/nclob的record变量|  
|
||返回值类型为clob/nclob的自定义函数|  
|
||访问package全局clob/nclob类型变量(普通变量、常量、udt、record)|  
|
||访问package.子函数|  
|
||通过内置函数如cast、substr/substring、concat、trim等转换并处理生成clob/nclob类型的数据|  
|
||使用lob生成函数empty_clob()、empty_blob()、dbms_lob.createtemporary()|  
|
||来源于memory lob(系统视图返回lob类型)|  
|
|  
,  
,  
,  
,和过程体对象交互,  
|用过存储过程、自定义函数、package.子过程/子函数、嵌套子过程/子函数出入参|  
|
||用作变量赋值，覆盖普通变量、游标、record、udt变量|  
|
||和内置高级包交互：,DBMS_LOB：涉及到的子函数/子过程有compare、substr、read/write、writeappend、copy、erase/trim/instr等,- 使用instr函数作为dbms_lob子过程/子函数入参；
- dbms_lob子过程/子函数出参用作instr函数的入参expr、sub_character；
,DBMS_SQL：子过程/子函数中覆盖验证：,- 普通sql中使用instr函数作为dbms_sql解析语句；
- 作为bind_variable/bind_variable_char绑定参数变量值；
- 作为define_column/define_column_raw/define_column_char入参值；
- 作为column_value/column_value_raw/column_value_char入参值；
|  
|
||参数通过绑定变量形式传递，覆盖过程体形参、游标形参(in out，var_out := var_in，绑定变量),instr函数参数通过绑定参数传递(instr(:a1,:a2,:a3,a4))|  
|
|  
,  
,DDL(挑选覆盖)    
    
    
|create table作为列的默认值|  
|
||alter table作为列的默认值|  
|
||create table as select instr()函数|  
|
||create view as select instr()函数|  
|
|  
,  
,DML(挑选覆盖)    
    
    
|update table set col = instr()|  
|
||delete from table where col = instr()|  
|
||insert into values (instr())|  
|
||insert into select instr()函数|  
|
|  
,  
,  
,  
,DQL(挑选覆盖)    
    
    
    
    
    
    
|作为select投影列|  
|
||作为where条件|1. where instr(col) = xx
1. where col = instr(xx)
|
||结合join子句，作为join条件|  
|
||结合in/not in/exists/not exist/between and/like/not like/  any/all/some/is null/is not null等子查询|  
|
||结合group by、order by子句|  
|
||结合distinct|  
|
||在cte、connect by子句中使用|  
|
||参与运算：  + - * /  > < >= <=  and or运算符|  
|


### 3.2.3instr函数查询性能

在功能测试基础之上需关注下在lob大数据量下测试inster处理性能，统计和oracle性能对比，简单设计如下几个场景：

lob数据范围大小：32k-，跟外场沟通

temp lob

|数据量|clob|nclob|blob|
|---|---|---|---|
|**32k**||  
||
|1M|  
||  
    
    
  不涉及    
    
    
|
|10M||  
||
|512M|  
|||
|1G||  
||
|4G|  
|||
|8G||  
||


knl lob

|数据量|heap-clob|heap-nclob|heap-blob|
|---|---|---|---|
|32k||  
||
|1M|  
||  
    
    
    
  不涉及|
|10M||  
||
|512M|  
|||
|1G||  
||
|4G|  
|||
|8G||  
||


### 3.2.4  梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|是|  
|
|KT|/|  
|
|长稳|/|  
|
|一致性|/|  
|
|三方测试工具    
  (DBeaver)|/|  
|
|安全|/|  
|
|DFR|/|  
|
|HA|/|  
|
|压力|/|  
|
|性能|是|  
|
|可维护性|/|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- 主要使用guider框架实现功能用例自动化；
- testkill框架实现CT,KT用例自动化；
- 需要增加部分JDBC用例，使用JDBC框架自动化。


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：1人  *周*

计划测试完成时间：

## Attachments: