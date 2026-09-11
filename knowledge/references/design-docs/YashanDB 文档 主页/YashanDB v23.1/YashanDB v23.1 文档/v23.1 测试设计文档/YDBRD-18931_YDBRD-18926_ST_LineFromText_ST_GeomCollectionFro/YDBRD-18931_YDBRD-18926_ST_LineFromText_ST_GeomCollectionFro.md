Created by 张江, last modified on 十月 15, 2024

# 1.参考资料

        需求：    [YDBRD-18931](https://jira.yasdb.com/browse/YDBRD-18931?src=confmacro)    -  支持ST_LineFromText、ST_GeomCollectionFromText  完成  、    [YDBRD-18926](https://jira.yasdb.com/browse/YDBRD-18926?src=confmacro)    -  支持ST_X、ST_Y  完成

        开发设计：    [ST_X/ST_Y Design](124259345.html)  

  [ST_LineFromText Design](ST_LineFromText-Design_127636695.html)  

  [ST_GeomFromText Design](ST_GeomFromText-Design_104234418.html)  

        对外提供的函数：ST_LineFromText、ST_GeomCollectionFromText、ST_X、ST_Y

        函数目前支持的类型：ST_LineFromText→LineString、  LinearRing类型

                                             ST_GeomCollectionFromText→  GeometryCollection类型

                                             ST_X/ST_Y→POINT类型

## 2.需求分析

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

2.1函数功能

(1)ST_LineFromText：使用给定的SRID从WKT表示生成几何图形。如果没有给出SRID，则默认为0，如果传入的WKT不是LINESTRING，则返回null。

(2)ST_GeomCollFromText：使用给定的SRID从WKT表示生成几何图形。如果没有给出SRID，则默认为0，如果传入的WKT不是GEOMETRYCOLLECTION，则返回null。

(3)ST_X/ST_Y：返回点的X/Y坐标；与pg差异点，对于POINT(nan nan)，我们会解析成POINT EMPTY，因此返回值为空；pg返回的是的NaN。

# 3.测试设计方法

等价类、边界值、场景分析法。

# 4.详细测试设计

1)使用章节3的测试方法设计详细的测试点，具体测试点如下：

|函数|测试点|无效值|
|---|---|---|
|ST_LineFromText|1、覆盖LineString、LineRing基础类型值，数据内容包含带坐标轴(Z、ZM等)、SRID属性值,2、特殊值：EMPTY、NULL、空串'',3、和其他gis函数一起混合使用，包含：ST_GeomFromText、ST_Srid、GeometryType、ST_AsBinary、,ST_AsEWKB、ST_AsGeoJson、ST_GeomFromWKB、ST_GeomFromEWKB、ST_GeomFromGeoJSON|1、非LineString类型，包含Point、MultiPoint、MultiLineString、Polygon、MultiPolygon、GeometryCollection类型值，返回结果为空,2、非法值：不存在的类型，错误的数据内容(如表示LineRing的数据：linearring(0 0 0, 4 0 0, 4 4 0, 0 4 0, 1 0 0))等|
|ST_GeomCollFromText|1、覆盖GEOMETRYCOLLECTION基础类型值，数据内容包含带坐标轴(Z、ZM等)、SRID属性值,2、特殊值：EMPTY、NULL、空串'',3、和其他gis函数一起混合使用，包含：,ST_GeomFromText、ST_Srid、GeometryType、ST_AsBinary、,ST_AsEWKB、ST_AsGeoJson、ST_GeomFromWKB、ST_GeomFromEWKB、ST_GeomFromGeoJSON|1、非GEOMETRYCOLLECTION类型，包含Point、MultiPoint、LineString、MultiLineString、Polygon、MultiPolygon，返回结果为空,2、非法值：错误的数据内容，如：GEOMETRYCOLLECTION (0 0)等|
|ST_X/SY|1、覆盖POINT基础类型值，数据内容包含带坐标轴(Z、ZM等)、SRID属性值,2、特殊值：EMPTY、NULL、空串'',3、边界值：nan、inf、-inf、(nan inf)、(num nan)、(num inf)组合形式，double边界值：-1.79769313486232E308、4.94065645841247E-324(返回值为-inf、inf),4、获取大地坐标、投影坐标、地心坐标数据及坐标边界值对应X/Y值(简单覆盖下),5、和其他GIS函数一起混合使用，包含ST_Transform、ST_Point等|1、非Point类型数据，包含MultiPoint、LineString、LineRing、MultiLineString、Polygon、MultiPolygon、GeometryCollection类型值，查询报错,2、非法值：错误的数据内容，如POINT ()、POINT (EMPTY)等|


2)  梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

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


# 5.测试用例

待补充。

# 6.  **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


  
