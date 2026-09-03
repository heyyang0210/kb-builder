Created by 张欣, last modified on 十一月 07, 2023

# 1.   **概述**

简要说明本功能/需求的背景，本文档的适用范围

  [YDBRD-13234](https://jira.yasdb.com/browse/YDBRD-13234?src=confmacro)    -  支持以WKT格式输入Geometry对象  完成

1 支持st_geometryFromText、st_geomFromText函数    
  2 支持Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型WKT输入

  [YDBRD-13235](https://jira.yasdb.com/browse/YDBRD-13235?src=confmacro)    -  支持将Geometry对象以WKT格式输出  完成

1 支持st_AsText函数    
  2 支持Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型以WKT格式输出    
  3 支持二维、三维、四维坐标的输出

数据类型支持st_geometry     [YDBRD-13233](https://jira.yasdb.com/browse/YDBRD-13233?src=confmacro)    -  数据类型支持st_geometry  完成

ST_Geometry类型支持常用几何对象类型     [YDBRD-13407](https://jira.yasdb.com/browse/YDBRD-13407?src=confmacro)    -  ST_Geometry类型支持常用几何对象类型  完成

主要涉及两个函数：  **st_AsText，st_geomFromText**  （st_geometryFromText 是同义词）

# 2.   **需求分析**

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

2.1 函数功能

![](https://pingcode.yasdb.com/atlas/files/public/673969568970c2af4f51f75a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFJQUFBQUFBQUFBQUFBQUlCQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFnQUFBQUFBQUFnQUFBQUFDQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFEQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3NTEsImV4cCI6MTc4MjEzNzU1MX0.o1vB8CKpq8yWjRrmJDuQsVltxDmKfGhQNAxrduD8RNc)

  


![](https://pingcode.yasdb.com/atlas/files/public/673969568970c2af4f51f75b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFJQUFBQUFBQUFBQUFBQUlCQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFnQUFBQUFBQUFnQUFBQUFDQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFEQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3NTEsImV4cCI6MTc4MjEzNzU1MX0.o1vB8CKpq8yWjRrmJDuQsVltxDmKfGhQNAxrduD8RNc)

**WKT**  ：空间数据的标准文本表示。子类型名称+坐标的形式，比如：表示点：'POINT(0 0)'; 多点：'MULTIPOINT((0 0), (2 0))'；线：'LINESTRING(0 0, 1 1)' 等等。 这种格式对用户来说比较直观。

**Geometry**  : GIS要测试的空间数据类型，支持   Point、LineString、LineRing、Polygon、MultiPoint、MultiLineString、MultiPolygon、Geometry Collection 子类型。

**ST_GeomFromText**  函数的功能是根据输入的WKT返回一个Geometry。  使用场景通常是导入Geometry数据给数据库，   需要验证转换的能力和正确性。

**ST_AsText**  函数的功能是返回输入的Geometry类型的WKT格式，也就是文本格式。 使用场景通常是将数据库的Geometry数据导出，或者以WKT格式查看Geometry数据。 同样需要验证转换后的WKT的正确性。

2.2 语法

**ST_GeomFromText(WKT clob, [srid integer]);**

第1个入参为文本类型，格式clob。   如果输入的WKT不合法，不能转成Geometry类型 要能够识别报错。

- 支持2 （X  Y），3 (X Y Z)，4 (X Y Z M)维坐标的输入。


第2个入参可选，表示传入SRID。

- 不传入默认为  SRID=  0；
- 取值范围同int （  -2^31 (-2,147,483,648)   ~  2^31 - 1 (2,147,483,647)）  ；有效的SRID范围 可以查询PostGIS中的spatial_ref_sys表内的srid字段获取，一共8500个；  目前空间参考系功能还未实现 不会校验SRID是否在有效范围，但是测试要验证传入的SRID被正确记录 不出错，不丢失。
- 传入浮点类型 小数位做四舍五入处理。


**ST_AsText(geom geometry, [maxdecimaldigits integer default 15]);**

第1个入参为geometry类型。可以通过输入函数（st_geomFromText、st_geomFromWKB、st_geomFromEWKB、  ST_GeomFromGeoJson  ）传入,也可以是表中geometry类型的列。

- 支持2 （X  Y），3 (X Y Z)，4 (X Y Z M)维坐标的输入。当前版本不支持4维，输出3维坐标，不会输出第4维坐标M。


第2个入参  maxdecimaldigits  可选，  表示输出的坐标中小数点后的位数。

- 不传入默认值为15；
- 取值范围同int，有效取值范围0-15，不足15位会补0。输出坐标采用double类型，所以精度超过15没有实际意义。 设计用例时要考虑输出结果的稳定。
- 传入浮点类型 小数位做四舍五入处理。


  


2.3 支持的  geometry的子类型

Point、LineString、LineRing、Polygon、MultiPoint、MultiLineString、MultiPolygon、Geometry Collection

|子类型|说明|有效示例|无效示例|
|---|---|---|---|
|**Point**|点，  表示坐标空间中单个位置的 0 维几何图形。,支持2-4维 |'POINT EMPTY'，'POINT(EMPTY)'    
  'POINT (1 2)''POINT Z (1 2 3)'，'POINT (1 2 3)'    
  'POINT M (0 0 0)''POINT ZM (1 2 3 4)'，'POINT (1 2 3 4)'|'POINT ( )','POINT (1 )','POINT (1, 2)'|
|**LineString**|线串 由连续的线段序列形成的一维线。 ,每条线段由两个点定义，终点为一个线段 形成下一段的起点。 OGC 有效的线字符串具有零个或两个或多个点， 但PostGIS也允许单点线串?。 线串可以交叉自身（自相交）。|'LINESTRING EMPTY','LINESTRING(EMPTY)','LINESTRING(0 0, 1 1)','LINESTRING Z (0 0 0, 1 1 0)',自相交：|'LINESTRING((0 0, 1 1))','LINESTRING((0 0), (1 1))'|
|**LineRing**|线性环 一个封闭的LineString。 第一个点和最后一个点必须相等，并且线不得自相交。,LineRing可以作为子类型输入，但是输出还是LineString |'LINEARRING(0 0 0, 4 0 0, 4 4 0, 0 4 0, 0 0 0)'|'LINESTRING Z (0 0 0, 1 1 0)',自相交：|
|**Polygon**|多边形    由外部边界分隔 以及零个或多个内部边界（洞）。边界是  LineRing。,第一组LineRing必须是外部边界。|'POLYGON((0 0,1 0,1 1,0 1,0 0))','POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'|'POLYGON(0 0,1 0,1 1,0 1,0 0)'|
|**MultiPoint**|多点是点的集合。|'MULTIPOINT(0 0, 2 0)','MULTIPOINT Z ((0 0 0), (2 0 0))','MULTIPOINT ZM ((0 0 0 0), (2 0 0 0))'|  
|
|**MultiLineString**|LineString 的集合。|'MULTILINESTRING((0 0, 2 0), (1 1, 2 2))'|  
|
|**MultiPolygon**|多多边形是  非重叠、不相邻  多边形的集合。|MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2)))|MULTIPOLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))|
|**Geometry Collection**|几何集合是前面几种子类型的混合集合。  支持成员还是集合吗？--不拦截，会丢弃这部分|'GEOMETRYCOLLECTION ( POINT(2 3), LINESTRING(2 3, 3 4))','GEOMETRYCOLLECTION(MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))),POINT(0 0),MULTILINESTRING((0 0, 2 0),(1 1, 2 2)))'|  
|


函数测试的重点是需要验证上述这些子类型都能够正常输入输出，且结果正确。

测试策略： 先覆盖2，3，4维的简单数据，每一种格式；然后测试复杂数据（比如长线段，多边形很多个边，集合元素很多等）。结果对比postGIS

由于协议还不支持UDT，目前输入函数st_geomFromTex（st_geomFromGeojson、  ST_GeomFromEWKB 类似的  ）的结果不能直接在客户端以十六进制二进制显式，要通过输出函数  st_AsText等转换后输出。

后续支持的Geometry子类型增加，函数需要补充测试。

# 3.   **测试设计方法**

对本测试设计使用的工程方法做说明，如常用的边界值，等价类，流程图及相关的组合策略

等价类，边界值，场景分析。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

4.1 函数入参

|  
|  
|有效等价类|无效等价类|
|---|---|---|---|
|函数入参个数|st_geomFromTex|1，2|0，3|
||st_AsText|1，2|0，3|
|入参|st_geomFromTex.WKT|可以转成Geometry的字符串,特殊值：null,空串，EMPTY，表达式（常量，函数，udf）|1.不合法的字符串，内容或格式不能转,2.其他数据类型|
||st_geomFromTex.SRID|有效的SRID,[0-   2,147,483,647  ] ,特殊值：null,空串，表达式|负数,2,147,483,648,非数值类型|
||st_AsText.Geom|Geometry类型，可以是输出函数表达式；,表中的Geometry列,特殊值：null,空串|非Geometry类型，当前还不支持的Geometry子类型|
||st_AsText.  maxdecimaldigits|[0-15 ],[15-   2,147,483,647  ] ：实际生效15,特殊值：null,空串，表达式|负数,2,147,483,648,非数值类型|


4.2 函数使用场景

|函数嵌套    
    
|自嵌套|不支持|
|:---|:---|:---|
||函数结果作为其他函数入参|ST_AsBinary(st_geomFromTex),  ST_AsEWKB(st_geomFromTex),ST_AsGeoJson(st_geomFromTex)|
||其他函数表达式作为函数入参|st_geomFromTex (  st_AsText  ),st_AsText(  st_geomFromText、st_geomFromWKB、st_geomFromEWKB、  ST_GeomFromGeoJson),字符串处理函数+st_AsText|
||多层嵌套|  
|
|查询场景中使用函数|作为select投影列返回|  
|
||作为where条件表达式|1. where func(col1) = xx，> <, like, between等
1. where col1 = func(xx)
|
||结合join|1. 作为join投影列
1. 作为join条件（on,where）
|
||结合in/exists/any/all/some等子查询|1. 作为表达式左值
1. 作为表达式右值（expr,子查询）
|
||结合group by分组(聚合函数和窗口函数)|1. 作为分组列
1. 在having条件中使用
|
||在嵌套查询中使用|在外层查询，内层查询中|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|
||结合distinct|  
|
|DML场景中使用函数|update|set值|
||delete|作为where条件|
||insert|作为insert的值|
||merge|  
|
|DDL场景中使用函数|  
|create/alter table时作为列的default值|
||同义词|使用同义词  st_geometryFromText|
|||创建函数的同义词（  st_geometryFromText 本身已经是同义词  ） 并使用|
|pl/sql场景|在pl/sql中使用|变量赋值，游标投影列|
||创建同名的自定义函数，存储过程|  
|


4.3 数据类型支持  Geometry

因为Geometry本质上是UDT,所以UDT OBJECT测过的场景原则上不用重复测试。

测试关注点：

1.新增视图   Geometry_Columns 的字段合理性，结果正确性；

2.历史视图 和表，数据类型相关的，比如 dba_tab_cols,dba_arguments等；

3.Geometry 是   ST_Geometry 的public同义词

4.  ST_Geometry 包含成员 head和geom

  


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

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[image2023-4-15_11-16-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTZhMWFkOWEzMzExZGM3NWQxIiwicmVmX2lkIjoiNjczOTY5NTY3MjgyMDZlZmI5MmVmMjAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzUxLCJleHAiOjE3ODIyMTMxNTF9.0V66iSMg5L4JHC8VVT7Dbt29Mzu6cjk8Hb4ulzJcOM8)

 (image/png)    


## Comments:

|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396956a1ad9a3311dc75d4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFJQUFBQUFBQUFBQUFBQUlCQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFnQUFBQUFBQUFnQUFBQUFDQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFEQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3NTEsImV4cCI6MTc4MjEzNzU1MX0.o1vB8CKpq8yWjRrmJDuQsVltxDmKfGhQNAxrduD8RNc),gis函数本身是MDSYS schema下的自定义函数；外在体现，比如ST_AsText 是一个public同义词,  
,Posted by zhangxin at 四月 23, 2023 14:31|
|---|
