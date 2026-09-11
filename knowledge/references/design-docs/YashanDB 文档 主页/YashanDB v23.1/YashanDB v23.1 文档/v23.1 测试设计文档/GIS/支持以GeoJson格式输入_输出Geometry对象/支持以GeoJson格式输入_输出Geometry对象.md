Created by 韩晓盼, last modified on 十一月 08, 2023

**SR：**    [YDBRD-13386](https://jira.yasdb.com/browse/YDBRD-13386?src=confmacro)    **-**  **支持以GeoJson格式输入Geometry对象**  **完成**

  [YDBRD-13387](https://jira.yasdb.com/browse/YDBRD-13387?src=confmacro)    **-**  **支持以GeoJson格式输出Geometry对象**  **完成**

# 1.   **概述**

简要说明需求背景，本文范围如下：

（1）支持函数：  ST_GeomFromGeoJSON函数、  ST_AsGeoJSON函数

（2）支持  几何对象类型：Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection

（3）只支持2D几何图形

# 2.   **需求分析**

##### 2.0 预备知识

**1、GeoJSON**

     GeoJSON是一种使用JavaScript对象符号(JSON)编码各种地理数据结构的格式。GeoJSON对象可以表示空间区域(几何对象Geometry)、空间边界实体(特征Feature)或一组特征(特征集合FeatureCollection)。

- 几何对象
    - 点(Point)
    - 线串(LineString)
    - 多边形(Polygon)
    - 多点(MultiPoint)
    - 多线串(MultiLineString)
    - 多多边形(MultiPolygon)
    - 几何集合(GeometryCollection)（以上本次迭代支持）
    - 多面体表面（Polyhedral surfaces）（以下本次迭代不支持）
    - 不规则三角网（Tin）
    - 曲线（  CIRCULARSTRING  ）
    - 复合曲线（  COMPOUNDCURVE  ）
    - 曲线多边形（  CURVEPOLYGON  ）
    - 多曲线（  MULTICURVE  ）
    - 多表面（  MULTISURFACE  ）
- 特征
    - 几何对象
    - 其他属性
- 特征集合
    - 特征列表


**2、Geometry中的2D、3D、4D**

     以Geometry的子类型Ponit举例：

|  
|描述|举例|备注|
|---|---|---|---|
|POINT|二维平面的点|POINT (1.0, 2.0)|  
|
|POINTZ|三维空间的点，其中Z表示z轴|POINT Z (1.0, 2.0)|本文函数不支持|
|POINTM|三维空间的点，其中M表示测量量|POINT M (1.0, 2.0)|本文函数不支持|
|POINTZM|四维空间的点，其中Z表示z轴、M表示测量量|POINT ZM (1.0, 2.0)|本文函数不支持|


**3、Bbox**

一个GeoJSON对象可以用边界框（Bounding box，Bbox）  来包含它的Geometries、Features或FeatureCollections的坐标范围的信息，即Bbox值定义了具有边缘的形状。

    其作用是存储几何对象的外包框，为了加速索引创建。

**4、CRS**

所有GeoJSON坐标的坐标参考系（Coordinate Reference System，CRS）是一个地理坐标参考系，使用世界大地测量系统1984(WGS 84)[WGS84]基准，经度和纬度单位为十进制。

**5、其他**

    WKT（文本格式：在代码中的格式）

    WKB（二进制格式：存储在Geometry类型的表字段中）

##### 2.1 函数基本特征

  


**      st_geomFromGeoJson函数**  ：

- 功能：


          从输入的GeoJSON表示形式构造几何对象。换句话说，  **用文本或二进制（交换格式）构建一个Geometry对象**  。

![](https://pingcode.yasdb.com/atlas/files/public/673969548970c2af4f51f751/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)

- 语法


```
ST_GeomFromGeoJson(json clob) return blob

```

         入参类型：clob，varchar/char（可隐式转换成clob）

          返回类型：geometry

          Null值：如果geojson为null，则返回null

- 限制：


1. 只支持GeoJSON的Geometry类型，不支持Feature？？？（实际测试发现是支持的）
1. 只支持2D几何图形。3D几何图形会报错，与PostGIS不同（GEOS库不支持）
1. 如果输入GeoJSON无效，则报错
1. GeoJSON字符串中可以包含bbox、crs，不检查crs的正确性
1. 严格区分GeoJSON字符串的大小写（GEOS库），与PostGIS不同
1. 空坐标与非空坐标混合，GEOS库与PostGIS规格不同，报错


参考：    [ST_GeomFromGeoJSON Design - 文博浩 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~wenbohao/ST_GeomFromGeoJSON+Design)  

  


**    st_AsGeoJson函数**  ：

- 功能：


          返回输入几何体或地理的GeoJSON表示形式。换句话说，  **将Geometry对象输出为一个文本或二进制（交换格式）**  。

![](https://pingcode.yasdb.com/atlas/files/public/67396954a1ad9a3311dc75c7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)

- 语法


```
ST_AsGeoJson(geom blob [,precision int [,options int]]) return clob

```

          参数类型：

             参数1：geometry

             参数2：整数，浮点数、number四舍五入转成整数，与PostGIS不同

             参数3：整数，浮点数、number四舍五入转成整数，与PostGIS不同

          返回类型：clob

          Null值：

             geom为null返回null

             precision为null返回null

             options为null返回null

- 限制：


1. 将geometry作为GeoJSON“Geometry几何”返回。不可以作为GeoJSON“Feature特征”返回一行，与PostGIS不同（GEOS库不支持）
1. 只支持2D几何图形。3D几何图形会丢弃z-index，与PostGIS不同（GEOS库不支持）
1. 若输入非法几何，则报错
1. **precision、options参数无效，输入null值除外**  ，GEOS库无法满足需求，需要在实现geometry的基础上自研geojson格式化。


参考：    [ST_AsGeoJSON Design - 文博浩 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~wenbohao/ST_AsGeoJSON+Design)  

  


##### 2.1 函数使用详细说明

**st_geomFromGeoJson函数**

|  
|参数|分类|示例|图|返回类型|备注|
|---|---|---|---|---|---|---|
|**ST_GeomFromGeoJson(json clob)**,  
|支持的  geometry子类型    
    
|Point（点）,  
|{   "type"  :   "Point"  ,   "coordinates"  : [  100.0  ,   0.0  ] }|![](https://pingcode.yasdb.com/atlas/files/public/673969548970c2af4f51f752/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|geometry|  
|
|  
|  
|LineString（线串）,  
|{   "type"  :   "LineString"  ,   "coordinates"  : [ [  100.0  ,   0.0  ], [  101.0  ,   1.0  ] ] }|![](https://pingcode.yasdb.com/atlas/files/public/67396954a1ad9a3311dc75c8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|  
|Polygon（多边形）,  
,其中，LineRing（线环）不是个独立的几何类型，属于Polygon| {   "type"  :   "Polygon"  ,   "coordinates"  : [ [ [  100.0  ,   0.0  ], [  101.0  ,   0.0  ], [  101.0  ,   1.0  ], [  100.0  ,   1.0  ], [  100.0  ,   0.0  ] ] ] },（  不存在孔  ）|![](https://pingcode.yasdb.com/atlas/files/public/67396954a1ad9a3311dc75c9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|  
|  
| {   "type"  :   "Polygon"  ,   "coordinates"  : [ [ [  100.0  ,   0.0  ], [  101.0  ,   0.0  ], [  101.0  ,   1.0  ], [  100.0  ,   1.0  ], [  100.0  ,   0.0  ] ], [ [  100.8  ,   0.8  ], [  100.8  ,   0.2  ], [  100.2  ,   0.2  ], [  100.2  ,   0.8  ], [  100.8  ,   0.8  ] ] ] },（存在孔）|![](https://pingcode.yasdb.com/atlas/files/public/67396954a1ad9a3311dc75ca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|  
|MultiPoint（多点）,  
|{   "type"  :   "MultiPoint"  ,   "coordinates"  : [ [  100.0  ,   0.0  ], [  101.0  ,   1.0  ] ] }|![](https://pingcode.yasdb.com/atlas/files/public/67396954a1ad9a3311dc75cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|  
|MultiLineString（  多线串  ）,  
|{   "type"  :   "MultiLineString"  ,   "coordinates"  : [ [ [  100.0  ,   0.0  ], [  101.0  ,   1.0  ] ], [ [  102.0  ,   2.0  ], [  103.0  ,   3.0  ] ] ] }|![](https://pingcode.yasdb.com/atlas/files/public/673969548970c2af4f51f753/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  [反面子午线切割(Antimeridian Cutting)](https://conf.yasdb.com/display/~wenbohao/GeoJSON+Format#319--%E5%8F%8D%E9%9D%A2%E5%AD%90%E5%8D%88%E7%BA%BF%E5%88%87%E5%89%B2antimeridian-cutting)  , {   "type"  :   "MultiLineString"  ,   "coordinates"  : [ [ [  170.0  ,   45.0  ], [  180.0  ,   45.0  ] ], [ [  -180.0  ,   45.0  ], [  -170.0  ,   45.0  ] ] ] },![](https://pingcode.yasdb.com/atlas/files/public/673969548970c2af4f51f754/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|
|  
|  
|MultiPolygon（  多多边形  ）,  
|{   "type"  :   "MultiPolygon"  ,   "coordinates"  : [ [ [ [  102.0  ,   2.0  ], [  103.0  ,   2.0  ], [  103.0  ,   3.0  ], [  102.0  ,   3.0  ], [  102.0  ,   2.0  ] ] ], [ [ [  100.0  ,   0.0  ], [  101.0  ,   0.0  ], [  101.0  ,   1.0  ], [  100.0  ,   1.0  ], [  100.0  ,   0.0  ] ], [ [  100.2  ,   0.2  ], [  100.2  ,   0.8  ], [  100.8  ,   0.8  ], [  100.8  ,   0.2  ], [  100.2  ,   0.2  ] ] ] ] }|![](https://pingcode.yasdb.com/atlas/files/public/673969558970c2af4f51f755/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  [反面子午线切割(Antimeridian Cutting)](https://conf.yasdb.com/display/~wenbohao/GeoJSON+Format#319--%E5%8F%8D%E9%9D%A2%E5%AD%90%E5%8D%88%E7%BA%BF%E5%88%87%E5%89%B2antimeridian-cutting)  ,{   "type"  :   "MultiPolygon"  ,   "coordinates"  : [ [ [ [  180.0  ,   40.0  ], [  180.0  ,   50.0  ], [  170.0  ,   50.0  ], [  170.0  ,   40.0  ], [  180.0  ,   40.0  ] ] ], [ [ [  -170.0  ,   40.0  ], [  -170.0  ,   50.0  ], [  -180.0  ,   50.0  ], [  -180.0  ,   40.0  ], [  -170.0  ,   40.0  ] ] ] ] },![](https://pingcode.yasdb.com/atlas/files/public/67396955a1ad9a3311dc75cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|
|  
|  
|Geometry Collection（  几何集合  ）,  
,  
|{   "type"  :   "GeometryCollection"  ,   "geometries"  : [{   "type"  :   "Point"  ,   "coordinates"  : [  100.0  ,   0.0  ] }, {   "type"  :   "LineString"  ,   "coordinates"  : [ [  101.0  ,   0.0  ], [  102.0  ,   1.0  ] ] }] }|![](https://pingcode.yasdb.com/atlas/files/public/67396955a1ad9a3311dc75cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|几何集合的“几何”数组中的每个元素都是上面描述的几何对象之一|
|  
|Feature,（不支持？）|Feature（特征）|{  {   "type"  :   "Feature"  ,   "geometry"  : {   "type"  :   "Polygon"  ,   "coordinates"  : [ [ [  100.0  ,   0.0  ], [  101.0  ,   0.0  ], [  101.0  ,   1.0  ], [  100.0  ,   1.0  ], [  100.0  ,   0.0  ] ] ] },   "properties"  : {   "prop0"  :   "value0"  ,   "prop1"  : {   "this"  :   "that"   } } }|![](https://pingcode.yasdb.com/atlas/files/public/67396955a1ad9a3311dc75ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|FeatureCollection,（不支持？）|FeatureCollection（特征集合对象）| {   "type"  :   "FeatureCollection"  ,   "features"  : [{   "type"  :   "Feature"  ,   "geometry"  : {   "type"  :   "Point"  ,   "coordinates"  : [  102.0  ,   0.5  ] },   "properties"  : {   "prop0"  :   "value0"   } }, {   "type"  :   "Feature"  ,   "geometry"  : {   "type"  :   "LineString"  ,   "coordinates"  : [ [  102.0  ,   0.0  ], [  103.0  ,   1.0  ], [  104.0  ,   0.0  ], [  105.0  ,   1.0  ] ] },   "properties"  : {   "prop0"  :   "value0"  ,   "prop1"  :   0.0   } }, {   "type"  :   "Feature"  ,   "geometry"  : {   "type"  :   "Polygon"  ,   "coordinates"  : [ [ [  100.0  ,   0.0  ], [  101.0  ,   0.0  ], [  101.0  ,   1.0  ], [  100.0  ,   1.0  ], [  100.0  ,   0.0  ] ] ] },   "properties"  : {   "prop0"  :   "value0"  ,   "prop1"  : {   "this"  :   "that"   } } }] }|![](https://pingcode.yasdb.com/atlas/files/public/673969558970c2af4f51f756/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|包含边界框|bbox| {   "type"  :   "Polygon"  ,   "bbox"  : [  -10.0  ,   -10.0  ,   10.0  ,   10.0  ],   "coordinates"  : [ [ [  -10.0  ,   -10.0  ], [  10.0  ,   -10.0  ], [  10.0  ,   10.0  ], [  -10.0  ,   -10.0  ] ] ] },  
|  
|  
|2D bbox member on a Feature    
    
  对子午线    
  "bbox"  : [  177.0  ,   -20.0  ,   -178.0  ,   -16.0  ]    
  "bbox"  : [  -178.0  ,   -20.0  ,   177.0  ,   -16.0  ]    
  两级     
  (1)  边界框近似于以纬度“minlat”圆为界的球形帽    
  "bbox"  : [  -180.0  , minlat,   180.0  ,   90.0  ]     
  (2)包含南极的边界框    
  "bbox"  : [  -180.0  ,   -90.0  ,   180.0  , maxlat]     
  (3)边界框从“minlat”N度和“westlon”E度的    
  西南角延伸到90°N和“eastlon”E度    
  "bbox"  : [westlon, minlat, eastlon,   90.0  ]    
  (4)接触南极并形成近似球形帽的一部分的边界框    
  "bbox"  : [westlon,   -90.0  , eastlon, maxlat]    
|
|  
|包含坐标参考系|crs|{"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[100.0,0.0]},{"type":"LineString","coordinates":[[101.0,0.0],[102.0,1.0]]}],"crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:EPSG::3395"}}}|  
|  
|不检查crs的正确性|
|  
|  
|NULL|NULL|  
|NULL|  
|
|  
|不支持的  geometry子类型（2D）|Polyhedral surfaces（多面体表面）|  
|  
|不支持|  
|
|  
|  
|Tin（不规则三角网）|  
|  
|  
|  
|
|  
|  
|Circularstring（曲线）|  
|![](https://pic2.zhimg.com/80/v2-707fe825086fe8dcdb107af4a88ca809_720w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|  
|Compoundcurve（复合曲线）|  
|![](https://pic1.zhimg.com/80/v2-7876d2366be6361ef37b045d25c90590_720w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|  
|Curpolyogn（复合曲线）|  
|![](https://pic1.zhimg.com/80/v2-7afca6ca623f879155494797263a4b3c_720w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|  
|Multicurve（多曲线）|  
|![](https://pic1.zhimg.com/80/v2-222fffce05bc509689d9debd73846e84_720w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|  
|
|  
|  
|Multisurface（多表面、多多边形）|  
|![](https://pic2.zhimg.com/80/v2-7f277aee5880fe4effe0583f4bc1276d_720w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|  
|一个平面的集合，平面可以是具有线性环的多边形或曲线环的多边形|
|  
|不支持的  geometry子类型（3D、4D  ）|- POINTZ
- POINTM
- POINTZM
|{   "type"  :   "Point"  ,   "coordinates"  : [  100.0  ,   0.0, 1.0  ] },{   "type"  :   "Point"  ,   "coordinates"  : [  100.0  ,   0.0, 1.0, 1.0  ] }|  
|  
|  
|
|  
|  
|- LINESTRINGZ
- LINESTRINGM
- LINESTRINGZM
|  
|  
|  
|  
|
|  
|  
|- POLYGONZ
- POLYGONM
- POLYGONZM
|  
|  
|  
|  
|
|  
|  
|- MULTIPOINTZ、MULTIPOINTM、MULTIPOINTZM
- MULTILINESTRINGZ、MULTILINESTRINGM、MULTILINESTRINGZM
- MULTIPOLYGONZ、MULTIPOLYGONM、MULTIPOLYGONZM
- GEOMETRYCOLLECTIONZ、GEOMETRYCOLLECTIONM、GEOMETRYCOLLECTIONZM
|  
|  
|  
|  
|
|  
|  
|- POLYHEDRALSURFACEZ
- POLYHEDRALSURFACEM
- POLYHEDRALSURFACEZM
|  
|  
|  
|  
|
|  
|  
|- TINZ
- TINM
- TINZM
|  
|  
|  
|  
|
|  
|其他|GeoJSON字符串的大小写|SELECT ST_AsText(ST_GeomFromGeoJSON('{  "type"  :  "point"  ,  "coordinates"  :[  1  ,  2  ]}')) from dual; ,SELECT ST_AsText(ST_GeomFromGeoJSON('{  "Type"  :  "Point"  ,  "coordinates"  :[  1  ,  2  ]}')) from dual; ,SELECT ST_AsText(ST_GeomFromGeoJSON('{  "type"  :  "Point"  ,  "Coordinates"  :[  1  ,  2  ]}')) from dual;|```
--正常
SQL&gt; SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Point","coordinates":[1,2]}')) from dual;

ST_ASTEXT(ST_GEOMFRO
----------------------------------------------------------------
POINT (1.000000000000000 2.000000000000000)

1 row fetched.
--异常
SQL&gt; SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"point","coordinates":[1,2]}')) from dual;

YAS-07202 plugin execution error, ParseException: Unknown geometry type!

SQL&gt; SELECT ST_AsText(ST_GeomFromGeoJSON('{"Type":"Point","coordinates":[1,2]}')) from dual;

YAS-07202 plugin execution error, ParseException: Error parsing JSON: '[json.exception.out_of_range.403] key 'type' not found'

SQL&gt; SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Point","Coordinates":[1,2]}')) from dual;

YAS-07202 plugin execution error, ParseException: Error parsing JSON: '[json.exception.out_of_range.403] key 'coordinates' not found'


```|报错，YAS-07202 plugin execution error, XXX|  
|
|  
|  
|空坐标与非空坐标混合|SELECT   ST_AsText(ST_GeomFromGeoJSON(  '{"type":"Polygon","coordinates":[[[0,0]],[]]}'  ))   from   dual;,SELECT   ST_AsText(ST_GeomFromGeoJSON(  '{"type":"Polygon","coordinates":[[],[0,0]]}'  ))   from   dual;,  
|```
SQL&gt; SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[0,0]],[]]}')) from dual;

YAS-07202 plugin execution error, IllegalArgumentException: point array must contain 0 or &gt;1 elements


SQL&gt; SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[],[0,0]]}')) from dual;

YAS-07202 plugin execution error, ParseException: Error parsing JSON: '[json.exception.type_error.302] type must be array, but is number'


```|报错，YAS-07202 plugin execution error, XXX|  
|


  


  


**st_AsGeoJson函数**

|  
|参数|分类|示例|返回类型|备注|
|---|---|---|---|---|---|
|**ST_AsGeoJson(geom blob [,precision int [,options int]])**,  
|**参数一**  ，这里需要用  ST_GeomFromText函数转换格式    
    
|Point（点）|POINT(100 0)|文本或二进制|  
|
|  
|  
|LineString（线串）,  
|MULTIPOINT((100 0), (101 1))|  
|  
|
|  
|  
|Polygon（多边形）,  
,其中，LineRing（线环）不是个独立的几何类型，属于Polygon|POLYGON((100 0, 101 0, 101 1, 100 1, 100 0)),（  不存在孔  ）|  
|  
|
|  
|  
|  
|POLYGON ((100 0, 101 0, 101 1, 100 1, 100 0), (100.8 0.8, 100.8 0.2, 100.2 0.2, 100.2 0.8, 100.8 0.8)),（存在孔）|  
|  
|
|  
|  
|MultiPoint（多点）,  
|MULTIPOINT((100 0), (101 1))|  
|  
|
|  
|  
|MultiLineString（  多线串  ）,  
|MULTILINESTRING ((100 0, 101 1), (102 2, 103 3))|  
|  
|
|  
|  
|MultiPolygon（  多多边形  ）,  
|MULTIPOLYGON (((102 2, 103 2, 103 3, 102 3, 102 2)), ((100 0, 101 0, 101 1, 100 1, 100 0), (100.2 0.2, 100.2 0.8, 100.8 0.8, 100.8 0.2, 100.2 0.2)))|  
|  
,  
|
|  
|  
|Geometry Collection（  几何集合  ）,  
,  
|GEOMETRYCOLLECTION (POINT (100 0), LINESTRING (101 0, 102 1))|  
|几何集合的“几何”数组中的每个元素都是上面描述的几何对象之一|
|  
|Feature,（不支持？）|Feature（特征）|POLYGON ((-10 -10, 10 -10, 10 10, -10 -10))|  
|  
|
|  
|FeatureCollection,（不支持？）|FeatureCollection（特征集合对象）|GEOMETRYCOLLECTION (POINT (102 0.5), LINESTRING (102 0, 103 1, 104 0, 105 1), POLYGON ((100 0, 101 0, 101 1, 100 1, 100 0)))|  
|  
|
|  
|包含边界框|bbox|POLYGON ((-10 -10, 10 -10, 10 10, -10 -10))|  
|  
|
|  
|包含坐标参考系？|crs|  
|  
|不检查crs的正确性|
|  
|不支持的  geometry子类型（2D）|Polyhedral surfaces（多面体表面）|  
|  
|  
|
|  
|  
|Tin（不规则三角网）|  
|  
|  
|
|  
|  
|Circularstring（曲线）|  
|  
|  
|
|  
|  
|Compoundcurve（复合曲线）|  
|  
|  
|
|  
|  
|Curpolyogn（复合曲线）|  
|  
|  
|
|  
|  
|Multicurve（多曲线）|  
|  
|  
|
|  
|  
|Multisurface（多表面、多多边形）|  
|  
|一个平面的集合，平面可以是具有线性环的多边形或曲线环的多边形|
|  
|不支持的  geometry子类型（3D、4D  ）|- POINTZ
- POINTM
- POINTZM
|‘POINTZ Z (1,2,3)’ , ‘POINTZ M (1,2,3)’, ‘POINTZ ZM (1,2,3,4)’|  
|Z是z轴，M是测量量，XYZ是3D，XYM是3D，XYZM是4D,由于Geojson的函数是只支持2D，所以不支持POINTZ，POINTM，POINTZM，下同|
|  
|  
|- LINESTRINGZ
- LINESTRINGM
- LINESTRINGZM
|  
|  
|  
|
|  
|  
|- POLYGONZ
- POLYGONM
- POLYGONZM
|  
|  
|  
|
|  
|  
|- MULTIPOINTZ、MULTIPOINTM、MULTIPOINTZM
- MULTILINESTRINGZ、MULTILINESTRINGM、MULTILINESTRINGZM
- MULTIPOLYGONZ、MULTIPOLYGONM、MULTIPOLYGONZM
- GEOMETRYCOLLECTIONZ、GEOMETRYCOLLECTIONM、GEOMETRYCOLLECTIONZM
|  
|  
|  
|
|  
|  
|- POLYHEDRALSURFACEZ
- POLYHEDRALSURFACEM
- POLYHEDRALSURFACEZM
|  
|  
|  
|
|  
|  
|- TINZ
- TINM
- TINZM
|  
|  
|  
|
|  
|入参（参数二、参数三）|任何int型，除null外|  
|不会影响整体结果|precision、options参数无效，除null外,![](https://pingcode.yasdb.com/atlas/files/public/673969558970c2af4f51f757/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQmdBZ0VBQWdFQWdBQUNBR0FBQUFBUkFCQUZBQUVBQUJBSUJBSUFJTUFBQUNBQUFBQUlBQUFBQVVnQUFFZ0FBQUlFQUlBRUFnQUFBQUFBQUFRSWdJQWdBQUFBRUFBQUFBQUFBQUFRUUFFQW9BQ2dBQUFBQUJBRUNBa0VBQ2dJQUFBQUFBQkFRUUFBQWdBQUFBQUNBQUlBQkFRQUFBQ0FBaUFBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY3MzcsImV4cCI6MTc4MjEzNzUzN30.KA_bC0yPv7gwk5D7Ar4iLFAQkHqHlrp02U9bgXUr5mY)|
|  
|  
|三个参数都输入NULL|NULL，NULL，NULL|NULL|  
|


  


# 3.   **测试设计方法**

边界值，等价类，场景分析等。

  


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

4.1 函数入参

|测试点|  
|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|函数入参个数|ST_GeomFromGeoJSON|1|0，2|  
|
|  
|ST_AsGeoJson|1，2，3|0，4|  
|
|入参|ST_GeomFromGeoJSON.j  son|可以转成Geometry的字符串，其中字符串可包含bbox、crs,特殊值：null，空字符串，EMPTY，表达式（常量，函数，udf）|1、支持的  Geometry子类型的（3D、4D）；,2、不支持的  Geometry子类型（2D、3D、4D），如Polyhedral surfaces，Tin，Circularstring，Compoundcurve，Curpolyogn，Multicurve，Multisurface；,3、非Geometry类型，如Feature，FeatureCollection；,4、非法字符串，内容格式无法转换。如符合格式，但特定字符大小写书写有误；格式不符合；,5、除blob、char/varchar外的其他数据类型。如int，double，number，bit，date，boolean，raw等|正确格式：,'{"type":"Point","coordinates":[1,2]}',有误：,'{  "Type"  :  "point"  ,  "Coordinates"  :[  1  ,  2  ]}','{  "type"  :  "  ,  "Coordinates"  :[  1  ,  2  ]}'|
|  
|ST_AsGeoJson.  geom|支持的Geometry子类型，可以是输出函数表达式；  表中的Geometry列,特殊值：null，空串，EMPTY|1、非Geometry类型，如Feature，  FeatureCollection  ；,2、当前还不支持的Geometry子类型（2D、3D、4D），如Polyhedral surfaces、Tin、Circularstring、Compoundcurve、Curpolyogn、Multicurve、Multisurface；,3、支持的Geometry子类型（3D、4D），如  POINTZ、POINTM、POINTZM等（其余见上表）|  
|
|  
|ST_AsGeoJson.  precision|任何int类型数值,特殊值：null|1、除int外的数据类型|precision参数无效，不会影响最终结果，null除外|
|  
|ST_AsGeoJson.  options|任何int类型数值,特殊值：null|1、除int外的数据类型|options参数无效，不会影响最终结果，null除外|
|其他|函数名称|正确拼写：  ST_GeomFromGeoJSON、  ST_AsGeoJson|拼错或少写字母：  ST_GeomFromGeoJSO、  ST_sGeoJson等等|  
|


4.2 函数使用场景

|测试场景|  
|示例|备注|
|---|---|---|---|
|函数嵌套|自嵌套|不支持|  
|
|  
|函数结果作为其他函数入参|ST_AsBinary(st_geomFromGeoJson)，  ST_AsEWKB(st_geomFromGeoJson)，  ST_AsGeoJson(st_geomFromGeoJson)，  ST_AsText(st_geomFromGeoJson) |  
|
|  
|其他函数表达式作为函数入参|st_geomFromGeoJson(st_As  GeoJson  ),st_As  GeoJson  (st_geomFromGeoJson、  st_geomFromText、st_geomFromWKB、st_geomFromEWKB  ),字符串处理函数+st_As  GeoJson|  
|
|  
|多层嵌套|  
|  
|
|查询场景中使用函数|作为select投影列返回|select   st_geomFromGeoJson()   from table；,select   st_AsGeoJson()   from table；|  
|
|  
|作为where条件表达式|1. where func(col1) = xx，> <, like, between等
1. where col1 = func(xx)
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

1. 测试重点：验证子类型（Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection）在2D下能够正常输入输出，且结果正常
1. 由于协议还不支持UDT，所以输入函数ST_GeomFromGeoJSON的结果不能直接在客户端  以十六进制二进制显示，要通过输出函数  st_AsText等转换后输出
1. 结果对比postGIS


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
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

[image2023-4-20_14-37-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTJhMWFkOWEzMzExZGM3NWI1IiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.vgKbKbhvbwfNrpOBgv48aYRiWjMcOxBLGjjRxywfUdA)

 (image/png)    


[image2023-4-18_15-39-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTI4OTcwYzJhZjRmNTFmNzQyIiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.6DhDNmcRpFbRL-fgvOKAuJ3Wd53sHoiPmO52I68y6gc)

 (image/png)    


[image2023-4-18_10-39-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTI4OTcwYzJhZjRmNTFmNzQ1IiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.4gnUBxnWdh48W-krrztUZEoKiCTWY0kO8xOkih3beGA)

 (image/png)    


[image2023-4-17_19-44-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTNhMWFkOWEzMzExZGM3NWMyIiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.twSCMHhCMIxJ1F60Qd3LTfGakUGOplJht5luGIlOVJc)

 (image/png)    


[image2023-3-6_15-59-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTNhMWFkOWEzMzExZGM3NWMzIiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.DMvwQ_JEA1CQNPuBsRG1UTt2wsnVcjtvZAn0L-Zu5mA)

 (image/png)    


[image2023-3-6_16-0-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTM4OTcwYzJhZjRmNTFmNzRjIiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.Zwdt9-Qt1HWvnho4wWSL-D6zJhE2BYhMhKFDgK1NrB4)

 (image/png)    


[image2023-3-9_15-27-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTNhMWFkOWEzMzExZGM3NWM0IiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.7Mi6fbkNDJUzh9wlVZSq8lzrmETuz5ZNcQ17ta8EB4Y)

 (image/png)    


[image2023-3-9_15-28-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTNhMWFkOWEzMzExZGM3NWM1IiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.mPoQHHnsxvIkmR0_rq_6cgcwIKKsfLdnmIpA6at-_VE)

 (image/png)    


[image2023-3-9_15-53-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTM4OTcwYzJhZjRmNTFmNzRkIiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.8QVmWe3N4A_HuOw3mAtmDNUEXNjopYLxbrlgD8N4_Vc)

 (image/png)    


[image2023-3-9_15-53-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTM4OTcwYzJhZjRmNTFmNzRlIiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.xQgcj9w5VJY2D6g1UaxOFHOfVnqKnoNA_hNIoncEgK4)

 (image/png)    


[image2023-3-6_15-58-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTNhMWFkOWEzMzExZGM3NWM2IiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.oh5X-e3M6LVxndSBnC05Tvip4LBWfSaABiDdAKCaeHA)

 (image/png)    


[image2023-3-6_16-14-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTM4OTcwYzJhZjRmNTFmNzRmIiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.oPO4XP88DzF8_T17vSmxobwE8MP64t-4AlleKIO_0tg)

 (image/png)    


[image2023-3-6_15-55-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTM4OTcwYzJhZjRmNTFmNzUwIiwicmVmX2lkIjoiNjczOTY5NTE3MjgyMDZlZmI5MmVmMWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzM3LCJleHAiOjE3ODIyMTMxMzd9.ZrGduZxXCFAOvv-6oZk3ivlHYp1d3aeXAtBtuSFn4-s)

 (image/png)    
