Created by 方少奎, last modified on 三月 15, 2024

  


* IR链接：*    [YDBRD-28096](https://jira.yasdb.com/browse/YDBRD-28096)  

  


##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

GeoServer是一款采用Java编写的，允许用户分享与编辑地理空间数据的开源软件。其支持使用开放标准对多数主要空间数据源进行发布。

org.geotools是一个开源的 Java GIS 工具包,可利用它来开发符合标准的地理信息系统。GeoTools 提供了 OGC(Open Geospatial Consortium)规范的一个实现来作为他们的开发。

gt-jdbc-yashandb实现了org.geotools.jdbc相关接口，适配YashanDB数据库的语法。

###   [1.2 调研文档](#12-调研文档)  

pgsql实现情况：    [https://conf.yasdb.com/pages/viewpage.action?pageId=147752299&src=contextnavpagetreemode](https://conf.yasdb.com/pages/viewpage.action?pageId=147752299&src=contextnavpagetreemode)  

oracle实现情况：    [https://conf.yasdb.com/pages/viewpage.action?pageId=144137471&src=contextnavpagetreemode](https://conf.yasdb.com/pages/viewpage.action?pageId=144137471&src=contextnavpagetreemode)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|YshanDB数据源信息配置|配置YashanDB数据源信息|是|是|
||发布图层|适配YashanDB语法，展示数据源中的数据表，供GeoServer选择数据|是|是|
||openLayer展示切片，生成矢量切片|拼接SQL，调用YashanDB Geometry相关方法查询WKB数据|是|是|


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

org.geotools:gt-main

org.geotools:gt-referencing

org.geotools:gt-opengis

org.geotools:gt-jdbc

org.geotools:gt-metadata

org.locationtech.jts:jts-core

org.apache.commons:commons-lang3。

##   [2. 接口](#2-接口)  

|JDBCDataStoreFactory接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|createSQLDialect(JDBCDataStore dataStore, Map<String, ?> params)|创建SQL方言对象SQLDialect|返回值：SQLDialect|是|
|createSQLDialect(JDBCDataStore jdbcDataStore)|创建SQLDialect|返回值：SQLDialect|是|
|getDatabaseID()|返回配置的BD_ID|返回值：String|是|
|getDisplayName()|返回展示的数据源名称|返回值：String|是|
|getDescription()|返回展示的数据源描述|返回值：String|是|
|getDriverClassName()|返回数据源驱动ClassName|返回值：String|是|
|checkDBType(Map<String, ?> params)|检查当前数据源是否匹配|返回值：boolean|是|
|createDataStoreInternal(JDBCDataStore dataStore, Map<String, ?> params)|创建矢量数据源|返回值：JDBCDataStore|是|
|setupParameters(Map<String, Object> parameters)|设置geometry参数Params|返回值：void|是|
|getJDBCUrl(Map<String, ?> params)|拼接数据连接URL|返回值：String|是|
|getValidationQuery()|数据连接健康检查SQL|返回值：String|是|


|BasicSQLDialect接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|includeTable(String schemaName, String tableName, Connection cx)|匹配数据表名，筛选出非系统表|返回值：boolean|是|
|getNameEscape()|SQL中名称间隔字符，YashanDB不需要字符，需要覆盖原方法|返回值：String|是|
|decodeGeometryValue(GeometryDescriptor descriptor, ResultSet rs, String column, GeometryFactory factory, Connection cx, Hints hints)|读取WKB，解析成Geometry对象|返回值：Geometry|是|
|decodeGeometryValue(GeometryDescriptor descriptor, ResultSet rs, int column, GeometryFactory factory, Connection cx, Hints hints)|读取WKB，解析成Geometry对象|返回值：Geometry|是|
|encodeGeometryColumn(GeometryDescriptor gatt, String prefix, int srid, Hints hints, StringBuffer sql)|拼接查询WKB数据的select参数|返回值：void|是|
|encodeGeometryColumnSimplified(GeometryDescriptor gatt, String prefix, int srid, StringBuffer sql, Double distance)|拼接查询WKB数据的select参数|返回值：void|是|
|encodeGeometryEnvelope(String tableName, String geometryColumn, StringBuffer sql)|拼接SQL，查询数据边界时，select的参数|返回值：void|是|
|getOptimizedBounds(String schema, SimpleFeatureType featureType, Connection cx)|查询数据边界，返回最小外包边界|返回值：List<ReferencedEnvelope>|是|
|decodeGeometryEnvelope(ResultSet rs, int column, Connection cx)|对于查到的行数据WKB，返回其边界对象|返回值：Envelope|是|
|getMapping(ResultSet columnMetaData, Connection cx)|SQLType与Java对象的映射|返回值：Class<?>|是|
|getGeometrySRID(String schemaName, String tableName, String columnName, Connection cx)|查询SRID|返回值：Integer|是|
|getGeometryDimension(String schemaName, String tableName, String columnName, Connection cx)|查询Dimension|返回值：int|是|
|registerClassToSqlMappings(Map<Class<?>, Integer> mappings)|新建图层新属性时，Java对象到SQLType的映射|返回值：void|是|
|registerSqlTypeNameToClassMappings(Map<String, Class<?>> mappings)|新建图层视图时，SQLType到Java对象的映射|返回值：void|是|
|getGeometryTypeName(Integer type)|返回Geometry对于的数据库UDT名称|返回值：String|是|
|encodeGeometryValue(Geometry value, int dimension, int srid, StringBuffer sql)|将Geometry对象解析成WKT数据，并拼接到select参数中|返回值：void|是|
|createFilterToSQL()|创建SQL过滤器|返回值：FilterToSQL|是|
|isLimitOffsetSupported()|支持使用limit和offset|返回值：boolean|是|
|addSupportedHints(Set<Hints.Key> hints)|支持hint simplify|返回值：void|是|
|splitFilter(Filter filter, SimpleFeatureType schema)|Filter过滤器执行解析过滤条件方法|返回值：Filter[]|是|
|getDesiredTablesType()|查询元数据，匹配Tables|返回值：String[]|是|


|FilterToSQL接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|visitLiteralGeometry(Literal expression)|拼接Filter的过滤条件|返回值：void|是|
|createFilterCapabilities()|创建FilterCapabilities|返回值：FilterCapabilities|否|
|visitBinarySpatialOperator(BinarySpatialOperator filter, PropertyName property, Literal geometry, boolean swapped, Object extraData)|openLayer时拼接Filter条件|返回值：Object|是|
|visitBinarySpatialOperator(BinarySpatialOperator filter, Expression e1, Expression e2, Object extraData)|openLayer时拼接Filter条件|返回值：Object|是|
|visit(Literal literal, Object extraData)|openLayer时拼接Filter条件|返回值：Object|否|
|visitBinaryComparisonOperator(BinaryComparisonOperator filter, Object extraData)|filter筛选切片时，解析filter条件|返回值：Object|是|
|visit(PropertyIsBetween filter, Object extraData)|解析filter条件|返回值：Object|是|
|visit(PropertyIsEqualTo filter, Object extraData)|解析filter条件|返回值：Object|是|


##   [3. 规格与约束](#3-规格与约束)  

GeoServer插件适配YashanDB数据库单机，支持YashanDB作为数据源，进行查表，建表。

为下列操作提供数据支持。

（1）支持创建YashanDB矢量数据源。

![](https://pingcode.yasdb.com/atlas/files/public/67396cd0a1ad9a3311dc8cf0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFJQVFBRUFBQUVBQUVRRUFJQUNBQUFBQUFBQUlBQUFBQUFBQUlBQUFBQUFFQUFBQUFBQUFJQUFBQUFBQUFBSUFCQUFBQUFBQUFBUUVBQUNBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBUUFCQUFBQUFFQUVBQUFBQUJBQUJBQWdBQUFBQUFBQUFBQUNBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1OTYsImV4cCI6MTc4MjMxNDM5Nn0.r0lEVe-R39l0PHyQazCd9GF2F4IKuP6eoPz_OPt8RyQ)

（2）支持从YashanDB读取数据生成图层。

![](https://pingcode.yasdb.com/atlas/files/public/67396cd0a1ad9a3311dc8cf1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFJQVFBRUFBQUVBQUVRRUFJQUNBQUFBQUFBQUlBQUFBQUFBQUlBQUFBQUFFQUFBQUFBQUFJQUFBQUFBQUFBSUFCQUFBQUFBQUFBUUVBQUNBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBUUFCQUFBQUFFQUVBQUFBQUJBQUJBQWdBQUFBQUFBQUFBQUNBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1OTYsImV4cCI6MTc4MjMxNDM5Nn0.r0lEVe-R39l0PHyQazCd9GF2F4IKuP6eoPz_OPt8RyQ)

（3）支持查看矢量切片，查看WMS和WFS文件。

![](https://pingcode.yasdb.com/atlas/files/public/67396cd0a1ad9a3311dc8cf2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFJQVFBRUFBQUVBQUVRRUFJQUNBQUFBQUFBQUlBQUFBQUFBQUlBQUFBQUFFQUFBQUFBQUFJQUFBQUFBQUFBSUFCQUFBQUFBQUFBUUVBQUNBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBUUFCQUFBQUFFQUVBQUFBQUJBQUJBQWdBQUFBQUFBQUFBQUNBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1OTYsImV4cCI6MTc4MjMxNDM5Nn0.r0lEVe-R39l0PHyQazCd9GF2F4IKuP6eoPz_OPt8RyQ)

支持Filter过滤矢量数据，如TEquals，BBOX。

![](https://pingcode.yasdb.com/atlas/files/public/67396cd08970c2af4f520e80/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFJQVFBRUFBQUVBQUVRRUFJQUNBQUFBQUFBQUlBQUFBQUFBQUlBQUFBQUFFQUFBQUFBQUFJQUFBQUFBQUFBSUFCQUFBQUFBQUFBUUVBQUNBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBUUFCQUFBQUFFQUVBQUFBQUJBQUJBQWdBQUFBQUFBQUFBQUNBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1OTYsImV4cCI6MTc4MjMxNDM5Nn0.r0lEVe-R39l0PHyQazCd9GF2F4IKuP6eoPz_OPt8RyQ)

（4）支持查看矢量切片图层缓存。

![](https://pingcode.yasdb.com/atlas/files/public/67396cd08970c2af4f520e81/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFJQVFBRUFBQUVBQUVRRUFJQUNBQUFBQUFBQUlBQUFBQUFBQUlBQUFBQUFFQUFBQUFBQUFJQUFBQUFBQUFBSUFCQUFBQUFBQUFBUUVBQUNBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBUUFCQUFBQUFFQUVBQUFBQUJBQUJBQWdBQUFBQUFBQUFBQUNBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1OTYsImV4cCI6MTc4MjMxNDM5Nn0.r0lEVe-R39l0PHyQazCd9GF2F4IKuP6eoPz_OPt8RyQ)

![](https://pingcode.yasdb.com/atlas/files/public/67396cd08970c2af4f520e82/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFJQVFBRUFBQUVBQUVRRUFJQUNBQUFBQUFBQUlBQUFBQUFBQUlBQUFBQUFFQUFBQUFBQUFJQUFBQUFBQUFBSUFCQUFBQUFBQUFBUUVBQUNBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBUUFCQUFBQUFFQUVBQUFBQUJBQUJBQWdBQUFBQUFBQUFBQUNBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1OTYsImV4cCI6MTc4MjMxNDM5Nn0.r0lEVe-R39l0PHyQazCd9GF2F4IKuP6eoPz_OPt8RyQ)

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

计算数据边界Bounds，拼接出执行SQL。

```
SELECT ST_AsText(ST_Envelope(GEOM)) FROM (test_geom_data) as vtable

```

获得所有WKB数据，拼接出执行SQL。

```
SELECT ST_AsBinary(ST_Simplify("GEOM", 0.07018504531721988)) as "GEOM" 
FROM 
"REGRESS"."TEST_GEOM_DATA" 
WHERE 
ST_INTERSECTS(
    ST_GeomFromText(
        ST_ASTEXT(
            ST_GeomFromText('POLYGON ((-130.00753819895968 22.307277898413897, -130.00753819895968 52.0481908515861, -61.76980555104031 52.0481908515861, -61.76980555104031 22.307277898413897, -130.00753819895968 22.307277898413897))')
        ), 
        ST_SRID("GEOM")
    ), 
    "GEOM"
)

```

FIlter获得部分WKB数据，拼接出执行SQL。以BBOX(geom, -180.3515625, -0.3515625, -89.6484375, 67.8515625)为例。

```
SELECT ST_AsBinary(ST_Simplify("GEOM", 0.07018504531721988)) as "GEOM" 
FROM 
"REGRESS"."TEST_GEOM_DATA" 
WHERE 
(
ST_INTERSECTS(
    ST_GeomFromText(
        ST_ASTEXT(
            ST_GeomFromText('POLYGON ((-180.3515625 -0.3515625, -180.3515625 67.8515625, -89.6484375 67.8515625, -89.6484375 -0.3515625, -180.3515625 -0.3515625))')
        ), 
        ST_SRID("GEOM")
    ), 
    "GEOM"
) 
AND 
ST_INTERSECTS(
    ST_GeomFromText(
        ST_ASTEXT(
            ST_GeomFromText('POLYGON ((-130.00753819895968 22.307277898413897, -130.00753819895968 52.0481908515861, -61.76980555104031 52.0481908515861, -61.76980555104031 22.307277898413897, -130.00753819895968 22.307277898413897))')
        ), 
        ST_SRID("GEOM")
    ), 
    "GEOM"
)
)

```

###   [4.2 特性功能点1](#42-特性功能点1)  

###   [4.3 特性性能点2](#43-特性性能点2)  

###   [4.4 特性性能点3](#44-特性性能点3)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

根据用户需求完善Filter。

## Attachments:

[image2024-3-15_19-19-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2U4OTcwYzJhZjRmNTIwZTZmIiwicmVmX2lkIjoiNjczOTZjY2U3MjgyMDZlZmI5MmYxNmNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTk2LCJleHAiOjE3ODIzODk5OTZ9.HnqTtVXl_8ju3JAXc-rCS4at4DVaABATNIe_QFcFjpk)

 (image/png)    


[image2024-3-15_19-20-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2VhMWFkOWEzMzExZGM4Y2UxIiwicmVmX2lkIjoiNjczOTZjY2U3MjgyMDZlZmI5MmYxNmNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTk2LCJleHAiOjE3ODIzODk5OTZ9.5NRirBT7BoKA-eeXu6U3I0qtwG5U3-m_N6sgZzk8gIY)

 (image/png)    


[image2024-3-15_19-20-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2VhMWFkOWEzMzExZGM4Y2UyIiwicmVmX2lkIjoiNjczOTZjY2U3MjgyMDZlZmI5MmYxNmNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTk2LCJleHAiOjE3ODIzODk5OTZ9.1v6OYMQCW03NrXNVAA4rZ2B5kjFcgJkoZZejWQqjIiE)

 (image/png)    


[image2024-3-15_19-21-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2U4OTcwYzJhZjRmNTIwZTcwIiwicmVmX2lkIjoiNjczOTZjY2U3MjgyMDZlZmI5MmYxNmNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTk2LCJleHAiOjE3ODIzODk5OTZ9.Uawepc2TXKbWmFy2PUldzzmyF8TT7FVV9lAJpUCLjF4)

 (image/png)    


[image2024-3-15_19-21-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2U4OTcwYzJhZjRmNTIwZTcxIiwicmVmX2lkIjoiNjczOTZjY2U3MjgyMDZlZmI5MmYxNmNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTk2LCJleHAiOjE3ODIzODk5OTZ9._G8oJHgdtCtzSHCQCyBLV9iBFXfhA2jdVbIVnWX9-mM)

 (image/png)    


[image2024-3-15_19-24-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2VhMWFkOWEzMzExZGM4Y2U0IiwicmVmX2lkIjoiNjczOTZjY2U3MjgyMDZlZmI5MmYxNmNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTk2LCJleHAiOjE3ODIzODk5OTZ9.OS3kQeoQEFDYg4mad_mKjkr_1JVuoSR0qqdIgE8_Qeo)

 (image/png)    


[image2024-3-15_19-25-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2VhMWFkOWEzMzExZGM4Y2U4IiwicmVmX2lkIjoiNjczOTZjY2U3MjgyMDZlZmI5MmYxNmNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTk2LCJleHAiOjE3ODIzODk5OTZ9.DEmjdfDDHkhGNSLhwF7Nh_b2iT1VcXWY_b6_sldZD7o)

 (image/png)    
