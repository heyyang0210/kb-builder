Created by 韩晓盼, last modified on 五月 18, 2023

SR：    [YDBRD-13297](https://jira.yasdb.com/browse/YDBRD-13297?src=confmacro)    -  支持ST_SRID函数  完成

# 1.   **概述**

简要说明需求背景，本文范围如下：

（1）  支持ST_SRID函数查询几何对象的空间参考ID

（2）支持的Geometry类型  ：Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection

# 2.   **需求分析**

##### 2.0 预备知识

**1、空间参考系（SRS）**

     SRS  也称为坐标参考系 （CRS）， 定义几何图形如何参照地球表面上的位置。

**2、空间参考系id（SRID）**

     SRS的id，  通常1-999999是标准编号，1000000以上是自定义编码。

##### 2.1 函数基本特征

**     ST_SRID函数**

- 功能     


      根据输入Geometry返回一个integer类型的ID。

![](https://pingcode.yasdb.com/atlas/files/public/67396951a1ad9a3311dc75b3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFFQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MTYsImV4cCI6MTc4MjEzNzUxNn0.QsZGEbbLWS4IgssVFtLcbO_jPhyiEAmT1P0lkrxQTVs)

- 语法


```
integer ST_SRID(geometry g1)

```

      参数类型：geometry

      返回类型：integer

      Null值：g1为null则返回null

- 限制


      1、  如果输入的Geometry是一个不合法的Geometry，则会报解析失败的错误。

参考：    [ST_SRID Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/ST_SRID+Design)  

# 3.   **测试设计方法**

边界值，等价类，场景分析等。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

4.1 函数入参

|测试点|  
|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|函数入参个数|ST_SRID|1|0，2|  
|
|入参|ST_SRID.g1|支持的Geometry子类型，可以是输出函数表达式；  表中的Geometry列,特殊值：null，空串，EMPTY，表达式（函数）|1、当前还不支持的Geometry子类型（2D、3D、4D），如Polyhedral surfaces、Tin、Circularstring、Compoundcurve、Curpolyogn、Multicurve、Multisurface；,2、非法字符串，内容格式无法转换。如符合格式，但特定字符大小写书写有误；格式不符合；,3、除blob、char/varchar外的其他数据类型。如int，double，number，bit，date，boolean，raw等|srid可以是能转换成int类型的  字符串（char、varchar、bit），其余blob、clob、raw、json均不支持转int|
|其他|函数名称|正确拼写：ST_SRID|拼错或少写字母：SST_SRID、ST_RID  等等|  
|


4.2 函数使用场景

|测试场景|  
|示例|备注|
|---|---|---|---|
|函数嵌套|自嵌套|不支持|  
|
|  
|其他函数表达式作为函数入参|ST_SRID(ST  _geomFromGeoJson),,ST_SRID(  ST_geomFromText),,ST_SRID(ST_geomFromWKB),,ST_SRID(ST_geomFromEWKB  )|ST  _geomFromGeoJson函数、  ST_geomFromEWKB函数的参数不包含SRID,![](https://pingcode.yasdb.com/atlas/files/public/673969518970c2af4f51f73d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFFQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MTYsImV4cCI6MTc4MjEzNzUxNn0.QsZGEbbLWS4IgssVFtLcbO_jPhyiEAmT1P0lkrxQTVs)|
|  
|多层嵌套|ST_SRID(ST  _geomFromGeoJson(ST_AsGeoJson(  ST_geomFromText  )))等|  
|
|查询场景中使用函数|作为select投影列返回|select ST_SRID  ()   from table；|  
|
|  
|作为where条件表达式|1. where ST_SRID(col1) = xx，> <, like, between等
1. where col1 = ST_SRID(xx)
|  
|
|  
|结合join|1. 作为join投影列
1. 作为join条件（on,where）
|  
|
|  
|结合in/exists/any/all/some等子查询|1. 作为表达式左值
1. 作为表达式右值（expr,子查询）
|  
|
|  
|结合group by分组(聚合函数和窗口函数)|1. 作为分组列
1. 在having条件中使用
|  
|
|  
|在嵌套查询中使用|在外层查询，内层查询中|  
|
|  
|结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|  
|
|  
|结合distinct|  
|  
|
|DML场景中使用函数|update|set值|  
|
|  
|delete|作为where条件|  
|
|  
|insert|作为insert的值|  
|
|  
|merge|  
|  
|
|DDL场景中使用函数|  
|create/alter table时作为列的default值|  
|
|pl/sql场景中使用函数|在pl/sql中使用|变量赋值，游标投影列|  
|


注：

1. 测试重点：验证输入合法的  Geometry  （Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection），再使用ST_SRID函数能够获得其ID，且结果正常
1. 结果对比postGIS


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例

详见：

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

## Comments:

|  [](null)  ,SRID如果是double类型，小数部分是四舍五入,Posted by hanxiaopan at 五月 18, 2023 15:59|
|---|
