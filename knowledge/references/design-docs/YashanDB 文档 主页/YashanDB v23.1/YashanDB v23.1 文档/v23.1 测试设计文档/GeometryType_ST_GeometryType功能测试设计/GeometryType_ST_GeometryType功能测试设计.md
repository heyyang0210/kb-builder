Created by 董灵林, last modified on 六月 01, 2023

# 1.   **概述**

简要说明本功能/需求的背景，本文档的适用范围

# 2.   **需求分析**

### **2.1 GeometryType函数**

text GeometryType(geometry geomA)

**函数作用**  ：  **根据输入的geometry对象返回**  **geometry对象的类型type的全大写字符串，比如'LINESTRING', 'POLYGON', 'MULTIPOINT', 等等**  **。**

支持输入的geometry子类型：

- 输入null，输出也为null
- 输入geometry数据为  POINT、MULTIPOINT、LINESTRING、MULTILINESTRING、POLYGON、MULTIPOLYGON、GEOMETRYCOLLECTION 类型，输出为对应的类型字符串的全大写
- 输入geometry数据为  LINEARRING、输出为LINESTRING
- 其余geometry数据暂时不支持
- 输入非  geometry数据会报错


  


|输入|输出|特殊值|和postgis差异|
|:---|:---|:---|:---|
|null|null|  
|postgis传入null报错|
|POINT|POINT|POINT EMPTY|postgis传入只有M没有Z的三维坐标返回POINTM|
|MULTIPOINT|MULTIPOINT|MultiPoint Empty,重合的多点，重合完是一个点|postgis传入只有M没有Z的三维坐标返回  MULTIPOINT  M|
|LINESTRING,LINEARRING|LINESTRING|水平线，垂直线,LINEARRING,首尾闭合的LINESTRING|postgis传入只有M没有Z的三维坐标返回  LINESTRING  M,postgis不支持直接传入LinearRing类型|
|MULTILINESTRING|MULTILINESTRING|MultiLineString Empty,包含一个LineString,包含多个重复LineString,包含多个不重复LineString,包含LineString Empty|postgis传入只有M没有Z的三维坐标返回MULTILINESTRINGM|
|POLYGON|POLYGON|矩形,没有‘洞’，有一个或多个‘洞’,不合法  的多边形 |postgis传入只有M没有Z的三维坐标返回  POLYGONM|
|MULTIPOLYGON|MULTIPOLYGON|  
|postgis传入只有M没有Z的三维坐标返回  MULTIPOLYGONM|
|GEOMETRYCOLLECTION |GEOMETRYCOLLECTION |点 点/多点：不重合，部分重合，重合,点 线/多线：在线上，在线外,点 线 面：contain，cover，cross等|postgis传入只有M没有Z的三维坐标返回  GEOMETRYCOLLECTIONM|


  


### **2.2 ST_GeometryType函数**

text ST_GeometryType(geometry geomA)

**函数作用**  ：  **根据输入的geometry对象返回**  **geometry对象的类型type的驼峰式字符串，并加上前缀'ST_'，比如'ST_Point', 'ST_MultiPoint', 'ST_LineString', 等等**  **。**

支持输入的geometry子类型：

- 输入null，输出也为null
- 输入geometry数据为  POINT、MULTIPOINT、LINESTRING、MULTILINESTRING、POLYGON、MULTIPOLYGON、GEOMETRYCOLLECTION 类型，输出为对应的类型字符串的驼峰形式，并加上前缀'ST_'
- 输入geometry数据为  LINEARRING、输出为ST_LineString
- 其余geometry数据暂时不支持
- 输入非geometry数据会报错


  


|输入|输出|特殊值|和postgis差异|
|:---|:---|:---|:---|
|null|null|  
|  
|
|POINT|ST_Point|POINT EMPTY|  
|
|MULTIPOINT|ST_MultiPoint|MultiPoint Empty,重合的多点，重合完是一个点|  
|
|LINESTRING,LINEARRING|ST_LineString|水平线，垂直线,LINEARRING,首尾闭合的LINESTRING|  
|
|MULTILINESTRING|ST_MultiLineString|MultiLineString Empty,包含一个LineString,包含多个重复LineString,包含多个不重复LineString,包含LineString Empty|  
|
|POLYGON|ST_Polygon|矩形,没有‘洞’，有一个或多个‘洞’,不合法  的多边形 |  
|
|MULTIPOLYGON|ST_MultiPolygon|  
|  
|
|GEOMETRYCOLLECTION |ST_GeometryCollection|点 点/多点：不重合，部分重合，重合,点 线/多线：在线上，在线外,点 线 面：contain，cover，cross等|  
|


**注：**

**    PostGIS中，GeometryType(null)会报错，但是ST_GeometryType(null)不会报错；GeometryType传入只有M没有Z的三维坐标会在类名后加后缀'M'，但ST_GeometryType不会。**

**    YashanDB中，GeometryType(null)和ST_GeometryType(null)都不会报错。GeometryType和ST_GeometryType传入只有M没有Z的三维坐标都不会加后缀'M'。**

  


# 3.   **测试设计方法**

对本测试设计使用的工程方法做说明，如常用的边界值，等价类，流程图及相关的组合策略

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

|序号|文件名|测试点|
|---|---|---|
|1|test_YDBRD13284_gis_attribute_functions_01_pre.sql|预置数据|
|2|test_YDBRD13284_gis_attribute_functions_02_geometrytype_parameter01.sql|GeometryType函数入参为geometry类型数据|
|3|test_YDBRD13284_gis_attribute_functions_03_geometrytype_parameter02.sql|GeometryType函数入参为表列|
|4|test_YDBRD13284_gis_attribute_functions_04_geometrytype_parameter03.sql|1.GeometryType函数入参为其他类型    
  2.GeometryType函数入参数量错误|
|5|test_YDBRD13284_gis_attribute_functions_05_geometrytype_dql.sql|GeometryType函数在查询语句中的使用场景|
|6|test_YDBRD13284_gis_attribute_functions_06_geometrytype_dml_ddl.sql|GeometryType函数在dml和ddl中的使用场景|
|7|test_YDBRD13284_gis_attribute_functions_07_st_geometrytype_parameter01.sql|ST_GeometryType函数入参为geometry类型数据|
|8|test_YDBRD13284_gis_attribute_functions_08_st_geometrytype_parameter02.sql|ST_GeometryType函数入参为表列|
|9|test_YDBRD13284_gis_attribute_functions_09_st_geometrytype_parameter03.sql|1.ST_GeometryType函数入参为其他类型    
  2.ST_GeometryType函数入参数量错误|
|10|test_YDBRD13284_gis_attribute_functions_10_st_geometrytype_dql.sql|ST_GeometryType函数在查询语句中的使用场景|
|11|test_YDBRD13284_gis_attribute_functions_11_st_geometrytype_dml_ddl.sql|ST_GeometryType函数在dml和ddl中的使用场景|
|12|test_YDBRD13284_gis_attribute_functions_12_st_boundary_parameter01.sql|ST_Boundary函数入参为geometry类型数据|
|13|test_YDBRD13284_gis_attribute_functions_13_st_boundary_parameter02.sql|ST_Boundary函数入参为表列|
|14|test_YDBRD13284_gis_attribute_functions_14_st_boundary_parameter03.sql|1.ST_Boundary函数入参为其他类型    
  2.ST_Boundary函数入参数量错误|
|15|test_YDBRD13284_gis_attribute_functions_15_st_boundary_dql.sql|ST_Boundary函数在查询语句中的使用场景|
|16|test_YDBRD13284_gis_attribute_functions_16_st_boundary_dml_ddl.sql|ST_Boundary函数在dml和ddl中的使用场景|
|17|test_YDBRD13284_gis_attribute_functions_17_st_boundary_nested.sql|ST_Boundary函数自嵌套|
|18|test_YDBRD13284_gis_attribute_functions_18_st_envelope_parameter01.sql|ST_Envelope函数入参为geometry类型数据|
|19|test_YDBRD13284_gis_attribute_functions_19_st_envelope_parameter02.sql|ST_Envelope函数入参为表列|
|20|test_YDBRD13284_gis_attribute_functions_20_st_envelope_parameter03.sql|1.ST_Envelope函数入参为其他类型    
  2.ST_Envelope函数入参数量错误|
|21|test_YDBRD13284_gis_attribute_functions_21_st_envelope_dql.sql|ST_Envelope函数在查询语句中的使用场景|
|22|test_YDBRD13284_gis_attribute_functions_22_st_envelope_dml_ddl.sql|ST_Envelope函数在dml和ddl中的使用场景|
|23|test_YDBRD13284_gis_attribute_functions_23_st_envelope_nested.sql|ST_Envelope函数自嵌套|
|24|test_YDBRD13284_gis_attribute_functions_24_vfunction.sql|属性访问函数在v$function视图中查不到|
|25|test_YDBRD13284_gis_attribute_functions_25_gis_functions.sql|GIS相关函数互相调用（迭代一函数+当前SR函数）|
|26|test_YDBRD13284_gis_attribute_functions_26_post.sql|清理数据|
|27|test_YDBRD13284_gis_attribute_functions_27.sql|GeometryType数据精度测试|
|28|test_YDBRD13284_gis_attribute_functions_28.sql|ST_GeometryType数据精度测试|
|29|test_YDBRD13284_gis_attribute_functions_29.sql|ST_Boundary数据精度测试|
|30|test_YDBRD13284_gis_attribute_functions_30.sql|ST_Envelope数据精度测试|
|31|test_YDBRD13284_gis_attribute_functions_31.sql|复杂数据测试|
|32|test_YDBRD13284_gis_attribute_functions_32.sql|属性访问函数与构造函数互相调用|
|33|test_YDBRD13284_gis_attribute_functions_33.sql|属性访问函数与空间关系函数互相调用|
|34|test_YDBRD13284_gis_attribute_functions_34.sql|属性访问函数与几何对象处理函数互相调用|


# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[GeometryType与ST_GeometryType函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDdhMWFkOWEzMzExZGM3NTc4IiwicmVmX2lkIjoiNjczOTY5NDc3MjgyMDZlZmI5MmVmMTcwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTE0LCJleHAiOjE3ODIyMTI5MTR9.rTdR1ETSTD7jm9kTw_fdm3HFhGE8ov489LeyAGyi3VI)

 (application/x-xmind)    


[image2023-6-1_20-58-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDc4OTcwYzJhZjRmNTFmNzAxIiwicmVmX2lkIjoiNjczOTY5NDc3MjgyMDZlZmI5MmVmMTcwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTE0LCJleHAiOjE3ODIyMTI5MTR9.HCoBX1psDtNQbtrRUVFHKr2I0UEKL6_JZ9Pu9zlY55I)

 (image/png)    
