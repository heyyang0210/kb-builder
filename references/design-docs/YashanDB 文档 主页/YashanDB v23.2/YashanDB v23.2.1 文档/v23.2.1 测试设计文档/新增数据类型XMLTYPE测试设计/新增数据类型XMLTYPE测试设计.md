Created by 李攀, last modified on 十二月 13, 2023

  


SR：    [[YDBRD-18921] 增加XMLTYPE数据类型，允许建表和存取使用 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-18921)  

设计文档：    [XMLTYPE详细设计文档](/pages/createpage.action?spaceKey=~yuanhaokun&title=XMLTYPE%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3)  

  


# **1. 概述**

本文描述新增数据类型-XMLTYPE 的测试设计方案

  


# **2. 需求分析**

1. XMLTYPE支持字段定义
1. 场景：create table t(id int,c2 xmltype);  
1. 需求范围：单机行表


       需求分析：

1. 可以使用XMLTYPE关键字显式声明XMLTYPE类型的列。可以对XMLTYPE类型进行插入和查询
1. 底层使用clob存储，应用场景参考clob ，但是会对个别场景做限制，比如在类型转换只支持char/varchar之间转换
1. 内置函数对xmltype的支持有限制，参考文档上所列    [函数对XMLTpye的支持情况 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127633160)  


功能限制：

- 只支持全部查询，不支持结构化查询，输出没有格式。或依靠其他列进行where过滤查询
- 目前只支持对XMLTYPE数据的直接简单插入，不对XMLTYPE数据的合法性做校验。（所以插入任意格式的字符串目前都可以）
- XMLTYPE数据中不支持单引号，如有单引号则报错，Oracle也不支持插入含有单引号的XMLTYPE数据。
- 不支持四则运算与大小比较。


隐式与强制类型转换：

|  
|tinyint,smallint,integer,bigint|double,float|number|char,varchar|nchar,nvarchar|raw|bit|clob,blob,  
|json|nclob|boolean|time|date,timestamp|interval year to month    
,interval day to second|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
|cast(XMLTYPE as xxx )支持的类型  （oracle）|N|N|N|Y|N|N|N|N|N|N|N|N|N|N|
|cast(XMLTYPE as xxx) 支持的类型(yasdb)（与oracle对齐）|N|N|N|Y|N|N|N|N|N|N|N|N|N|N|


# **3. 测试**  **设计方法**   

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|---|:---|:---|:---|:---|
|关键字校验|关键字校验|建表时，数据类型名称覆盖小写、大写；|建表成功，desc table信息显示正确|  
|  
|
|  
|同名|1、建表时，列名称 与列数据类型名称相同,  
|建表成功，desc table信息显示正确|  
|  
|
|  
|拼写错误|  
|  
|建表时，xmltype拼写错误|报错信息明确|
|  
|其他|1、创建视图，与xmltype同名,2、建表，与xmltype同名|成功|  
|  
|
|表类型|普通表|  
|  
|  
|  
|
|  
|分区表|分区覆盖：range\list\hash\interval|报错，提示列不能创建分区|  
|  
|
|  
|全局临时表|1. 创建全局临时表，带xmltype列；
1. 创建私有临时表，带xmltype列；
|  
|  
|  
|
|列约束|列内约束|not null ,check|  
|其他列约束报错：unique\primary key\foreign key|报错，提示xmltype列不能创建unique/primary key等|
|  
|列外约束|not null ,check|  
|其他列约束报错：同上|  
|
|index|/|/|/|创建索引：普通索引、唯一索引、分区索引|报错，提示xmltype列不能创建索引|
|类型转换|cast类型强转|只支持cahr/varchar|ncahr/nvarchar/nclob?,测试时覆盖所有数据类型|  
|  
|
|  
|隐式转换|  
|只测与字符型，clob/nclob比较时隐式转换|  
||
|xmltype规格覆盖：|  
|  
,1、单列插入数据超过4G；查询、删除；  ---最后测试，性能差需要时间比较久,2、插入常量32K字符串到xmltype；,3、update xmltype列数据超过32K（常量）；,4、xmltype列默认值为32K字符串?|数据能正常插入，查询，删除|单列插入数据超过4G+1||
|使用场景|投影列|  
|  
|  
||
|  
|filter中|配合隐士转换一起测试,in/not in,exists/not exists,between and,like/not like,is null/is not null ,dstinct|不支持？|  
|  
|
|  
|各种查询语句中涉及xmltype类型|  
|  
|  
|  
|
|  
|统计信息|  
|  
|  
|  
|
|  
|update|set、where覆盖左值和右值|  
|  
|  
|
|  
|delete|where覆盖左值和右值|  
|  
|  
|
|  
|聚合列|  
|  
|  
|  
|
|  
|作为order key|  
|报错提示不支持|  
|  
|
|  
|做为group by 的列|  
|报错提示不支持|  
|  
|
|  
|case when|  
|  
|  
|  
|
|  
|cte|  
|  
|  
|  
|
|  
|join on.|  
|报错提示不支持|  
|  
|
|  
|connect...by|  
|  
|  
|  
|
|  
|绑定参数？|  
|  
|  
|  
|
|  
|plsql里面|cusor,udt,%type,udf参数,record,pkg|  
|  
|  
|
|  
|xmltype列作为入参|xmltype列作为函数入参|重点测试函数：cast、lengthb/length、substr、replace、concat、upper|  
|  
|
|  
|  
|xmltype列作为存储过程自定义函数入参|观察点：1、查询长度函数，需要关注长度；,               2、拼接函数，需要覆盖xmltype与其他数据类型的拼接，并且查看返回值的数据类型？拼接后的长度？,               3、查找位置函数（字符，字节）查找，能正常查找；,               4、需要覆盖传入参数的最大值，最小值；|  
|  
|
|  
|子查询|from 子查询,having子查询,select子查询,filter子查询：,exists子查询,not/in子查询,any子查询,some子查询,all子查询|  
|  
|  
|
|  
|运算|*、/、mod、%、+、-、|  
|  
|  
|
|  
|变量窥视|  
|  
|  
|  
|
|  
|union/union all|  
|  
|  
|  
|
|  
|导入导出工具适配测试|exp,sqlloader|  
|  
|  
|
|  
|统计信息|  
|  
|  
|  
|
|  
|jdbc适配|  
|  
|  
|  
|


# 4.   **详细测试设计**

  


# 5.   **测试用例**

[表间并行.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmI4OTcwYzJhZjRmNTIwODZkIiwicmVmX2lkIjoiNjczOTZiZmI1OTNmOTljOWZmMjM2OTAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzQ3LCJleHAiOjE3ODIzODQ3NDd9.WIX-BW1RpufiFG6IfuhppjlrBvMLNimeIxLHohxHYCc)

# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[表间并行.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmI4OTcwYzJhZjRmNTIwODZkIiwicmVmX2lkIjoiNjczOTZiZmI1OTNmOTljOWZmMjM2OTAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzQ3LCJleHAiOjE3ODIzODQ3NDd9.WIX-BW1RpufiFG6IfuhppjlrBvMLNimeIxLHohxHYCc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
