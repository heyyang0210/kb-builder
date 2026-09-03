Created by 李美娥, last modified on 四月 18, 2024

# 1. 概述

      需求：   YDBRD-26076：    [https://pingcode.yasdb.com/pjm/items/66175572fd997db58ad736d6](https://pingcode.yasdb.com/pjm/items/66175572fd997db58ad736d6)    ?

      开发设计：    [Box2D Output 特性设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150603964)  

      对外提供的函数：  ST_AsText、ST_AsBinary、ST_AsEwkb、ST_AsHexEwkb支持Box2D参数。

# 2. 需求分析

## 2.1 功能点分析

（1）  Clob ST_AsText(box box2d, precision int default 15)

Blob ST_AsBinary(box box2d, byteOrder string default 'None')

         Blob ST_AsEwkb(box box2d, byteOrder string default 'None')

         Clob ST_AsHexEwkb(box box2d, byteOrder string default 'None')

除了入参将geometry换成了box2D之外，其他规格都不变。

## 2.2 应用场景

场景一：

select  ST_XXX(ST_extent(col_geom) )from 表名; 

场景二：    
  select ST_XXX(col_box2d) from 表名 ; 

## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


# 3. 详细测试设计

## 3.1 测试设计方法

等价类，边界值，场景分析。

函数的测试点本质同内置函数，参考    [*内置函数测试设计checklist - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929071)    的测试点，进行设计，同时增加本特性相关的测试点。

测试的重点是测试对box2d类型支持的逻辑，主要是与st_extent结合的场景，函数历史逻辑代码同geom入参，风险低，不再重复测。

|一级分类|二级分类|测试点|
|---|---|---|
|函数入参|入参类型|1. 常量
1. 列（索引列：rtree st_geomfromtext(st_astext(col_box))，非索引列）
1. 函数表达式:st_extent函数的结果作为入参    
|
||数据|1.float边界，box2d的数据含特殊值inf、 nan 、double边界、科学计数法数据,2.''、 null 、纯empty,3.box2d的坐标构成的是：点、水平线、垂直线、其他,4.数据含16位小数,st_geomfromtext('LINESTRING(-1 10.123456789012345, -1 10.123456789012346)', 4326) 第15位不一样，作为box2d入参后，再st_astext(col_box,17)显示的是线,st_geomfromtext('LINESTRING(-1 10.1234567890123456, -1 10.1234567890123457)', 4326) 第16位不一样，作为box2d入参后，再st_astext(col_box,17)显示的是点|
|函数嵌套|函数结果作为其他函数入参|函数处理box2d后，作为入参是clob blob类型的gis函数,st_srid查询其srid是0。（  ST_AsEwkb  ）,容错：st_extent的结果结合st_astext等转成geom后，再传给st_extent、st_collect、count报错|
|查询场景中使用函数（st_extent出现的，但是使用的是proc的转换，替换成st_astext; 表列是box2d，下面的场景代码逻辑同geom，不再全部覆盖，抽几个例子简单覆盖。）    
    
    
    
    
    
    
|作为select投影列返回|1. 返回多列：一列入参是box2d，一列入参是geom；多列的入参是box2d
|
||作为where条件|1. where func(col1) = xx
1. where col1 = func(xx)
|
||结合join|1. 作为join投影列
1. 作为join条件（on,where）
|
||结合in/exists/any/all/some等子查询|1. 作为表达式左值
1. 作为表达式右值（expr,子查询）
|
||结合group by分组|1. 作为分组列
1. 在having条件中使用
|
||在子查询中使用|在外层查询，内层查询中|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|
||结合distinct|  
|
|DML场景中使用函数|update delete insert merge|  
|
|其他大数据量|在匿名块/存储过程/自定义函数中使用|  
|
||函数处理大量的数据：大数据量|1、st_xxx(st_extent(col_geom)),2、  st_xxx(col_box2d)|


## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|是|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|否（表列直接是box2d的场景少）|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[BOX2D_last.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmZhMWFkOWEzMzExZGM4YzlhIiwicmVmX2lkIjoiNjczOTZjYmY1OTNmOTljOWZmMjM3MjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMTYwLCJleHAiOjE3ODIzODk1NjB9.HwWLEgSWeJhraFWUkm245nUL-IHoXkq5PmOQSmDU8Jc)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[image2024-3-14_19-32-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmY4OTcwYzJhZjRmNTIwZTJhIiwicmVmX2lkIjoiNjczOTZjYmY1OTNmOTljOWZmMjM3MjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMTYwLCJleHAiOjE3ODIzODk1NjB9.3gMCYbXjTLExP2g-dvEc60iRer0YRR7fGhBmG6ouSjM)

 (image/png)    


[image2024-3-14_20-0-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzA4OTcwYzJhZjRmNTIwZTJiIiwicmVmX2lkIjoiNjczOTZjYmY1OTNmOTljOWZmMjM3MjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMTYwLCJleHAiOjE3ODIzODk1NjB9.LGNXAkzoFYxO4C3Wv_F-eRMfYzDuGIz4PFWzVU6DZUQ)

 (image/png)    


[image2024-3-14_19-33-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzBhMWFkOWEzMzExZGM4YzliIiwicmVmX2lkIjoiNjczOTZjYmY1OTNmOTljOWZmMjM3MjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMTYwLCJleHAiOjE3ODIzODk1NjB9.oS91oLsDLY4wLQVW0fUp64FDOyMfNxGMU91QyPJD47k)

 (image/png)    


[BOX2D_last.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmZhMWFkOWEzMzExZGM4YzlhIiwicmVmX2lkIjoiNjczOTZjYmY1OTNmOTljOWZmMjM3MjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMTYwLCJleHAiOjE3ODIzODk1NjB9.HwWLEgSWeJhraFWUkm245nUL-IHoXkq5PmOQSmDU8Jc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
