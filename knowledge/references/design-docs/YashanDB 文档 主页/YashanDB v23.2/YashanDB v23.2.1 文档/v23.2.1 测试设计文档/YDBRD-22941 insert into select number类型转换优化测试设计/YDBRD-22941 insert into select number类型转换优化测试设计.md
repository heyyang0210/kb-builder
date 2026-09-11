Created by 徐瑶, last modified on 十二月 13, 2023

# 1. 概述

本文描述insert into select number类型转换优化测试设计

## 1.1 相关文档

SR:        [YDBRD-22941](https://jira.yasdb.com/browse/YDBRD-22941?src=confmacro)    -  insert into select number类型转换优化  完成  --22.2

  [YDBRD-22983](https://jira.yasdb.com/browse/YDBRD-22983?src=confmacro)    -  insert into select number类型转换优化  完成  --23.2

开发设计文档：    [insert into select number类型转换优化](135615918.html)  

调研文档：    [01-insert into select number类型转换优化测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=135615903)  

概要设计文档：    [02-insert into select number类型转换优化测试概设](135615906.html)  

# 2. 需求分析

## 2.1 功能点分析

1）优化column expr

限制表格

|  
|单表查询|function（fun（id）这一列不能优化）|group by|order by|多表|
|:---|:---|:---|:---|:---|:---|
|优化条件|单表查询时可优化|不含function时可优化|不含group by时可优化|不含order by时可优化|多表查询时不  优化|


2）number转换优化

当源表对应列的number类型是可以在目标表内兼容时（即目标表的number(p,s)值域范围>=源表的number(p,s)值域范围），不经过CodNumber的中转直接按字节处理，借此来减少无需额外消耗的执行时间。

## 2.2 应用场景

- 该需求主要应用场景：


1）可优化项的大批量数据

2）number转换优化的大批量数据

覆盖同样的环境不同量级时性能优劣，与oracle性能相比  --  number比较多优化效果比较好，与老版本对比

- 需求与其他特性的关联场景：


不影响不可优化项查询的正确性，不影响Number数据类型数值是否可存储的的正常判断

## 2.3 规格约束

1）部署形态，优先  **22.2单机行表**  ，23.2支持  **行表到行表，**  **列表到列表（不涉及优化）**  ，两个版本均不支持行表到列表或列表到行表的混合场景

2）  **只支持单表的select查询优化，**  多表查询不支持优化

3）只优化列表达式，不支持嵌套函数

4）  **用于优化的内存申请不出来，不优化（比如4096列的表，app memory申请不出来空间，large pool）**  **--4096列串行**

5）number优化转换：目标表的精度范围大于等于源表，例如  源表的列是number(5, 3)，目标表为number(5, 2), (6, 3)支持优化，目标表为number(5, 2), (4, 3)则不优化

# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略

如：内置函数入参–边界值；等价类 ；语法图–路径覆盖

1）使用等价类划分、边界值覆盖

## 3.2 详细测试设计

1.使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|源表类型|table,- heap  →  heap  (22.2和23.2都只支持行表到行表的优化)
|分区表往普通表里插入,普通表往分区表里插入,列表到列表不支持优化|heap  →lsc、tac,lsc→heap,tac→heap,tac  →tac,lsc→lsc|不支持行表到列表或列表到行表|
|  
|分区表,- interval
- hash
- range
- list
||  
|  
|
|  
|view|  
|  
|  
|
|数据类型|char，varchar,nchar,nvarchar|各数据类型的边界值|同种数据类型的精度不同：char(20)往char(1)插入,预期报错|  
|
|  
|tinyint，smallint，int，bigint|  
|  
|  
|
|  
|float，double|  
|  
|  
|
|  
|time，timestamp，date|  
|  
|  
|
|  
|clob，blob，nclob（包含inline lob不和outline lob）|不能优化|  
|  
|
|  
|json|  
|  
|  
|
|  
|boolean|  
|  
|  
|
|  
|bit|  
|  
|  
|
|  
|udt|不能优化|  
|  
|
|  
|number,1）number类型兼容：目标表的值域范围大于等于源表值域范围,- number→number
- number(*)→number(*)
- number(9)/number(10)/number(11)...number(37)/number(38)→number(9)
- number(*, 0)→number(38,0),(37,0),...(5, 0),(4,0)...(1,0)
- number(9,4)/number(9,3)/number(9,2)/number(9,1)/number(9,0)→number(9, 4)
- number(10,4)/number(11,4)/number(12,4)...number(37,4)/number(38,4)→number(9, 4)
- number(10,5)/number(11,6)/number(12,7)/number(13,8)/number(14,9)...number(38,33)→number(9, 4)
,2）number类型不兼容：  目标表 → 源表(目标表值域小于源表值域)（插值不超过目标表）,- number(8)/number(7)/number(6)...number(2)/number(1)→number(9)
- number(9,1)/number(9,2)/number(9,3)...number(9,126)/number(9,127)→number(9)
- number(9,5)/number(9,6)/number(9,7)/number(9,8)/number(9,9)...number(9,127)→number(9, 4)
- number(8,4)/number(7,4)/number(6,4)...number(2,4)/number(1,4)  →number(9, 4)
- number(10,6)/number(11,7)/number(12,8)/number(13,9)/number(14,10)...number(38,34)→number(9, 4)
,3）number类型不兼容，  目标表 → 源表(插值不超过目标表）,- number(8)/number(7，3)/number(*,0)→number
- number(8)/number(7，3)/number(*,0)→number(*)
- number(9,3)/number(*,10)/number→number(9)
- number/number(9)/number(*)→number(9, 4)
- number/number(9)/number(*)→number(*, 4)
- number(9,3)/number(*,10)/number→number(*,0)
|类型不兼容不优化,存储格式一样才兼容（兼容是指最高有效位数和最低有效位数都得大于源表的值域）,只看number的定义|目标表 → 源表(目标表值域小于源表值域)（插值超过目标表）,- number(8)/number(7)/number(6)...number(2)/number(1)→number(9)
- number(9,1)/number(9,2)/number(9,3)...number(9,126)/number(9,127)→number(9)
- number(9,5)/number(9,6)/number(9,7)/number(9,8)/number(9,9)...number(9,127)→number(9, 4)
- number(8,4)/number(7,4)/number(6,4)...number(2,4)/number(1,4)  →number(9, 4)
- number(10,6)/number(11,7)/number(12,8)/number(13,9)/number(14,10)...number(38,34)→number(9, 4)
|  
|
|数据类型转换|隐式类型转换|  
|  
|  
|
|  
|强制类型转换|select cast( c1 as date) |  
|  
|
|投影列类型及数量|单列，多列|  
|  
|  
|
|  
|表达式列|  
|函数列（普通函数，聚集函数，窗口函数）,参考    [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)  ,  [%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)      [%8F%82%E8%80%](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)  ,  [83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)  ,  [BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)  |  
|
|  
|待插入表含有默认值|  
|  
|  
|
|  
|sysdate，systimestamp|  
|  
|  
|
|  
|不指定列|  
|  
|  
|
|  
|insert时不指定列|  
|  
|  
|
|  
|待插入的列等于投影列个数|  
|待插入表的列小于、大于投影列个数|  
|
|select语句|distinct|不可优化，对select后投影列操作的不能优化|  
|  
|
|  
|limit offset|where条件中不影响优化|  
|  
|
|  
|in|  
|  
|  
|
|  
|exists，not exists|  
|  
|  
|
|  
|like，rlike，not like，not rlike|判断是否能优化：看执行计划|  
|  
|
|  
|between and|  
|  
|  
|
|  
|any，all，some|  
|  
|  
|
|  
|- join
- union
- group by
- order by
- connect by
- 组合
|不优化|  
|  
|
|性能测试,*--优先测试客户场景量级（源表行数9W，目标表列数88条）*|1）大批量可优化的数据（  非number数据  ）insert into select时,- 全部可优化  --  select xx from table；
- 部分优化--  select xx, func(xx) from table；
- 全部不优化  --  select id from table group by xx;、select id from table1 union select id from table2;
|与oracle的执行时间对比，相差不超过5s|  
|  
|
|  
|2）大批量互相兼容的number类型数据,insert into select时,- 单一number数据类型可兼容场景           
- 单一number数据类型不可兼容场景         
- 可兼容和不可兼容number类型混合场景    
|与oracle的执行时间对比，相差不超过5s|  
|  
|
|  
|3)  覆盖不同行列的不同量级的组合场景,- 源表行数9W
,--目标表列数88条,--目标表列数100条,--目标表列数1000条,--目标表列数2000条,--目标表列数3000条,--目标表列数4000条,--目标表列数4095条,- 目标表列数88条
,--源表行数9W,--源表行数10W,--源表行数50W,--源表行数100W,--源表行数200W|  
|- 源表行数9W,  目标表列数4096条
|  
|


  


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
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
|性能|是|
|可维护性|否|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


*1） 自动化用例：Guider框架执行用例，生成预期，使用jdbc*  *模式执行。*

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：7  *天*

计划测试完成时间：2023.12.05

## Attachments:

[insert_into_select文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjJhMWFkOWEzMzExZGM4NGQxIiwicmVmX2lkIjoiNjczOTZiYjI3MjgyMDZlZmI5MmYwOTJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2Mzg0LCJleHAiOjE3ODIzODI3ODR9.ByTDaXhvoSHySNoMoXcHfszGKjhgYXEdhJrvKWeIp80)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,与会人：李燕琼、贺天欢、徐瑶    
  评审时间：2023-11-28 14:30-15:30    
  评审地点：线上,会议主题：insert into select number类型转换优化测试设计评审    
  评审纪要信息：,1.重点需  测试新包性能，与老包对比,2.需重点测试可优化场景是否出错,评审通过与否：通过,Posted by xuyao at 十月 18, 2024 09:57|
|---|
