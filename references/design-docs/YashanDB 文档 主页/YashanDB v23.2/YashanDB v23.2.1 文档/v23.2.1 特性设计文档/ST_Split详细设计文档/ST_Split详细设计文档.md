Created by 张鹏飞, last modified on 十二月 06, 2023

IR链接：    [YDBRD-21117](https://jira.yasdb.com/browse/YDBRD-21117?src=confmacro)    -  补充9个GIS函数  完成

SR链接：    [YDBRD-23101](https://jira.yasdb.com/browse/YDBRD-23101?src=confmacro)    -  支持ST_Split等9个函数  完成

##   [1. 总述](#1-总述)  

成熟模块的特性，概要设计和详细设计合一，必须说明本设计方案的需求来源，需求分析，功能概要描述。此类型设计文档要给出IR到SR拆分的依据。

关键特性的SR设计，总述可以链接IR的概要设计文档，此处开始主要讲对应SR特性的需求范围。

###   [1.1 需求来源](#11-需求来源)  

对标PostGIS，实现将一个Geometry对象(input)按另一个Geometry对象(blade)切割的功能。

###   [1.2 调研文档](#12-调研文档)  

概述ST_Split Analyze

###   [1.3 需求分析](#13-需求分析)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

ST_Split是用blade对input做切割，因此该操作是否支持，取决于input的类型和blade的类型，具体支持情况见下表。ST_Split返回的结果是GeometryCollection类型。

|input\blade|Point|LineString|Polygon|MultiPoint|MultiLineString|MultiPolygon|GeometryCollection|
|---|---|---|---|---|---|---|---|
|Point|×|×|×|×|×|×|×|
|LineString|√|√|√|√|√|√|×|
|Polygon|×|√|×|×|√|×|×|
|MultiPoint|×|×|×|×|×|×|×|
|MultiLineString|√|√|√|√|√|√|√|
|MultiPolygon|√|√|√|√|√|√|√|
|GeometryCollection|√|√|√|√|√|√|√|


- input和blade任意一个为NULL是，返回NULL
- input和blade的srid不相同时，报错
- ST_Split的返回结果永远是集合类型
- input或blade为empty时，返回geometrycollection empty
- input为LineString blade为LineString时，如果坐标中有nan/inf里，yasdb报错
- input为polygon, blade为LineString或MultiLineString时，如果坐标中有nan/inf里，yasdb报错
- split只考虑二维平面上的空间关系，输出结果会对三维坐标做插值。


非功能属性

（1）性能 取决于input和blade的形状（点数越多，性能越差），原则上与PostGIS持平

（2）可用性 不涉及

（3）可靠性 不涉及

（4）可测试性 对于所有可能的input/blade类型及不同的维度组合，应按功能描述返回正常的响应。

（5）安全性 不涉及

（6）易用性 对于不支持的场景，应返回不支持的原因

（7）可修改性 暂不涉及

（8）兼容性 不涉及

###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|input|被切割的几何对象|是|PostGIS|
|blade|用来切割的input的几何对象|是|PostGIS|


###   [1.5 开源依赖](#15-开源依赖)  

ST_Split需要自研+Geos库实现，依赖Geos库。

##   [2. 接口](#2-接口)  

geometry ST_Split(geometry input, geometry blade)

##   [3. 规格与约束](#3-规格与约束)  

YashanDB在ST_Split的input和blade坐标中包含nan/inf时，统一返回错误。与PostGIS不同的原因为：

- input为线，blade为点或多点时，如果坐标中包含nan, postgis不报错
- input为线或多边形，blade为多边形或线时，如果坐标中包含nan, postgis会core。
- 坐标中存在nan或inf时，postgis结果不具有可解释性


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

###   [4.2 input = LineString, blade = Point](#42-input--linestring-blade--point)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c268970c2af4f520988/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBRUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFFQUFBQUJBQUFBQUFBQkFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFQkFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkzODYsImV4cCI6MTc4MjMxMDE4Nn0.eHJ50S2Tqg3tULSF6alJdwBZdwTBZEc6qQr8otNJV5g)

###   [4.3 input = LineString, blade = MultiPoint](#43-input--linestring-blade--multipoint)  

与input = LineString, blade = Point算法类似，用第一个点切割原始input，再用其他点对切割的结果再次切割。

###   [4.4 input = LineString, blade = LineString、MultiLineString、Polygon、MultiPolygon](#44-input--linestring-blade--linestringmultilinestringpolygonmultipolygon)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c27a1ad9a3311dc87f6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBRUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFFQUFBQUJBQUFBQUFBQkFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFQkFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkzODYsImV4cCI6MTc4MjMxMDE4Nn0.eHJ50S2Tqg3tULSF6alJdwBZdwTBZEc6qQr8otNJV5g)

###   [4.5 input = Polygon, blade = LineString、MultiLineString](#45-input--polygon-blade--linestringmultilinestring)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c27a1ad9a3311dc87f7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBRUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFFQUFBQUJBQUFBQUFBQkFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFQkFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkzODYsImV4cCI6MTc4MjMxMDE4Nn0.eHJ50S2Tqg3tULSF6alJdwBZdwTBZEc6qQr8otNJV5g)

###   [4.6 input = MultiLineString/MultiPolygon/GeometryCollection](#46-input--multilinestringmultipolygongeometrycollection)  

依次split input中的每个成员

###   [4.7 特性可维可测设计](#47-特性可维可测设计)  

通过ST_AsText(ST_Split(input, blade))可将ST_Split结果以WKT格式显示

###   [4.8 特性安全设计](#48-特性安全设计)  

不涉及

###   [4.9 特性周边配合](#49-特性周边配合)  

不涉及

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：--input和blade无交点，输出原始input

SQL> select st_astext(st_split(st_geomfromtext('linestring(1 0, 3 0)'), st_geomfromtext('point(0 0)')), 2) from dual;

##   [ST_ASTEXT(ST_SPLIT(S](#st-astextst-splits)  

GEOMETRYCOLLECTION (LINESTRING (1.00 0.00, 3.00 0.00))

1 row fetched.

--input和blade有交点

SQL> select st_astext(st_split(st_geomfromtext('linestring(1 0, 3 0)'), st_geomfromtext('point(2 0)')), 2) from dual;

##   [ST_ASTEXT(ST_SPLIT(S](#st-astextst-splits-1)  

GEOMETRYCOLLECTION (LINESTRING (1.00 0.00, 2.00 0.00), LINESTRING (2.00 0.00, 3.00 0.00))

1 row fetched.

--三维坐标，会对结果的z做插值 

SQL> select st_astext(st_split(st_geomfromtext('linestring(1 0 0, 3 0 2)'), st_geomfromtext('point(2 0)')), 2) from dual;

##   [ST_ASTEXT(ST_SPLIT(S](#st-astextst-splits-2)  

GEOMETRYCOLLECTION Z (LINESTRING Z (1.00 0.00 0.00, 2.00 0.00 1.00), LINESTRING Z (2.00 0.00 1.00, 3.00 0.00 2.00))

1 row fetched.

--线与线相交，从交点处切割

SQL> select st_astext(st_split(st_geomfromtext('linestring(1 0, 3 0)'), st_geomfromtext('linestring(2 0, 2 1)')), 2) from dual;

##   [ST_ASTEXT(ST_SPLIT(S](#st-astextst-splits-3)  

GEOMETRYCOLLECTION (LINESTRING (1.00 0.00, 2.00 0.00), LINESTRING (2.00 0.00, 3.00 0.00))

1 row fetched.

 --线与线不相交，返回input

SQL> select st_astext(st_split(st_geomfromtext('linestring(1 0, 3 0)'), st_geomfromtext('linestring(0 0, 0 1)')), 2) from dual;

##   [ST_ASTEXT(ST_SPLIT(S](#st-astextst-splits-4)  

GEOMETRYCOLLECTION (LINESTRING (1.00 0.00, 3.00 0.00))

1 row fetched.

--blade为polygon时，用它的边界对input做切割

SQL> select st_astext(st_split(st_geomfromtext('linestring(1 0, 3 0)'), st_geomfromtext('linestring(2 0, 2 1, 4 1, 2 0)')), 2) from dual;

##   [ST_ASTEXT(ST_SPLIT(S](#st-astextst-splits-5)  

GEOMETRYCOLLECTION (LINESTRING (1.00 0.00, 2.00 0.00), LINESTRING (2.00 0.00, 3.00 0.00))

1 row fetched.覆盖全面避免重复测试测试用例的可维护性自测用例设计方法：

边界值等价类正交

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


## Attachments:

[image2023-5-18_14-58-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjZhMWFkOWEzMzExZGM4N2YxIiwicmVmX2lkIjoiNjczOTZjMjY1OTNmOTljOWZmMjM2YWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5Mzg2LCJleHAiOjE3ODIzODU3ODZ9.PzppLIVcxTI7FcJrY1wYjQXReglJHCeCQ4SYqX6ssvE)

 (image/png)    


[image2023-11-20_14-26-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjY4OTcwYzJhZjRmNTIwOTgyIiwicmVmX2lkIjoiNjczOTZjMjY1OTNmOTljOWZmMjM2YWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5Mzg2LCJleHAiOjE3ODIzODU3ODZ9.3cbl2nJtVRjhlbEBjB7kN2PeiYuEB_dfyTmraGm4PTE)

 (image/png)    


[image2023-11-20_15-42-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjY4OTcwYzJhZjRmNTIwOTgzIiwicmVmX2lkIjoiNjczOTZjMjY1OTNmOTljOWZmMjM2YWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5Mzg2LCJleHAiOjE3ODIzODU3ODZ9.7Dl87hJCiMQJ6uCgrY8x4nFTAsc8MKCfyWx3_gP_Wdk)

 (image/png)    


[image2023-11-20_16-10-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjY4OTcwYzJhZjRmNTIwOTg0IiwicmVmX2lkIjoiNjczOTZjMjY1OTNmOTljOWZmMjM2YWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5Mzg2LCJleHAiOjE3ODIzODU3ODZ9.Yd9lpr4JuTwU7yQ8vg8m2mWVlk73yM0AiCmUAvkpJnY)

 (image/png)    


[split_line_point.eddx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjZhMWFkOWEzMzExZGM4N2YyIiwicmVmX2lkIjoiNjczOTZjMjY1OTNmOTljOWZmMjM2YWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5Mzg2LCJleHAiOjE3ODIzODU3ODZ9.nAWKUaoQCpHSuAnNoc1TkWVmPt9tgxzDSSvO2XuavQU)

 (application/octet-stream)    


[split_line_point.drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjZhMWFkOWEzMzExZGM4N2YzIiwicmVmX2lkIjoiNjczOTZjMjY1OTNmOTljOWZmMjM2YWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5Mzg2LCJleHAiOjE3ODIzODU3ODZ9.4jRYx_WOeiFlesKwfgggGkirvHTuJiFKvQyTVuDByiQ)

 (application/octet-stream)    


[split_line_point.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjZhMWFkOWEzMzExZGM4N2Y0IiwicmVmX2lkIjoiNjczOTZjMjY1OTNmOTljOWZmMjM2YWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5Mzg2LCJleHAiOjE3ODIzODU3ODZ9.cmz46GQatmIyc_rDuPCWxGTw19F1o1UgMlwIuxUuYxI)

 (image/png)    


[split_line.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjY4OTcwYzJhZjRmNTIwOTg1IiwicmVmX2lkIjoiNjczOTZjMjY1OTNmOTljOWZmMjM2YWU0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5Mzg2LCJleHAiOjE3ODIzODU3ODZ9.y48aIMwr6PqWqMGYelj-KVAFbOztDPnkoUiuFh2FiFg)

 (image/png)    
