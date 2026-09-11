Created by 张江, last modified on 十一月 14, 2024

# 1.概述

SR链接：    [https://pingcode.yasdb.com/pjm/items/6718671ce489dd0868fcc078](https://pingcode.yasdb.com/pjm/items/6718671ce489dd0868fcc078)    ，本次包含的gis函数如下：

ST_MakeValid、ST_CollectionExtract、ST_Centroid、ST_PointOnSurface。

# 2.需求分析

## 2.1功能点分析

1）ST_MakeValid：在不丢失顶点的情况下，尝试将无效的  Geometry对象转换成有效的Geometry对象，对于有效的集合图形则保持不变。语法结构如下：

geometry ST_MakeValid(geometry input);

geometry ST_MakeValid(geometry input, text params);

其中input为Geometry对象，params  提供选择构建有效几何图形的方法，为可选参数。参数值可以是：

method=linework(原始算法，提取所有线条，并将线条连接在一起，然后从线条构建输出数据，从而构建出有效的Geometry对象)

method=struct keepcollapsed=true|false(区分内环和外环的算法，通过合并外环来构建新的Geometry对象，设置为 "false" 时，会删除低维度的几何对象)

  


2）ST_CollectionExtract：从给定的Geometry对象或Geometry对象集合，提取返回指定类型的Geometry对象。语法结构如下：

geometry ST_CollectionExtract(geometry collection);

geometry ST_CollectionExtract(geometry collection, integer type);

其中collection为给定的Geometry对象或者集合，type为可选参数，表示对象类型，可以是1：Point、2：LineString、3：Polygon。

  


3）ST_Centroid：返回给定Geometry对象的几何中心。语法结构如下：

geometry ST_Centroid(geometry g1);

~~geography ST_Centroid(geography g1, boolean use_spheroid);~~  (默认支持，该语法不保留)

其中g1为给定的  Geometry对象或者Geography对象，对于Geography对象，use_spheroid表示是否使用椭球模式，默认为true；

未指定类型时，则返回仅包含最高维度的几何图形，多边形优先于线，线优先于点。

  


4）ST_PointOnSurface：返回一个给定Geometry对象或者Geometry对象混合后的内部中心的点。语法结构如下：

geometry ST_PointOnSurface(geometry g1);

其中g1为给定的Geometry对象，通常可以是POLYGON,、MULTIPOLYGON和  CURVED POLYGON(曲多边形，如CURVEPOLYGON((10 10, 20 20, 30 10, 10 10))，我们目前不支持，potsgis支持)  ，

也可以是POINT、LineString、LineRing，及其混合形式。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机；

集群、分布式拦截处理。

# 3.详细测试设计

## 3.1  测试设计方法

主要采用等价类划分、场景法组合进行设计。

## 3.2详细测试设计

### 3.2.1等价类设计

geometry ST_MakeValid(geometry input);

geometry ST_MakeValid(geometry input, text params);

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,  
,  
,参数校验    
    
|参数个数|可以是1或者2个|0或者大于2个|
||  
,  
,参数类型|1、input：,geometry类型，子类型可以是,- Point
- LineString
- Linering
- Polygon
- MultiPoint
- MultiLineString
- MultiPolygon
- Geometry Collection
,2、params：,字符类型，可以是char、varchar、nchar、nvarchar、clob、nclob|1、input：非  geometry类型，如标量类型或者UDT,2、params：非字符串类型|
||  
,  
,  
,  
,  
,  
,参数值|1、input：,- geometry子类型对象是有效的，也可以是无效的
- 特殊值null(返回值也是null)、EMPTY
- 数据覆盖二维和三维坐标(输入四维坐标时则会忽略)
- 指定空间参考系标识SRID
- 边界值覆盖
- float：  +(-)  1.401298E-45、+(-)3.402823E38
- double：+(-)-1.79769313486232E308、  +(-)4.94065645841247E-324
,2、params：,- 可省略，默认使用  linework算法；
- method=linework
- method=linework keepcollapsed=true|false(可以输入，但算法不生效)
- method=structure keepcollapsed=true
- method=structure keepcollapsed=false(删除低维度的几何图形)
- 特殊值空串''、null(返回值也是null)
|1、input：,- 非  geometry类型的标量类型数据、UDT数据等
- 非法值，空格' '、'null'
,2、  params：,1)不在"method=linework|structkeepcollapsed=true|false",关键字之外的其他数据如数字、中英文、特殊符合等,2)使用多余的引号，如下：,- "method"="  linework  "
- "  keepcollapsed  "="  false  "
- method="  structure  "   keepcollapsed="false"
- "method"=  structure "keepcollapsed"=false
,3) 数据格式不正确，缺少或使用不规范的分隔符,- 'method=structkeepcollapsed=true'
- 'method=structure，keepcollapsed=true'
- 'method=structure：keepcollapsed=true'
,4)值缺失,- method= keepcollapsed=
- method=structure keepcollapsed=
- method=  keepcollapsed=true
|
||参数传值方式|直接传入参数值（需按照参数顺序传参）|- 指定参数名称传参（参数名=>参数值，可无序传入参数）
- 混合传参(直接传入参数+指定参数名称)
|
|关键字校验|/|函数名称大小写|函数名拼写错误|
|返回值校验|返回值类型|使用st_geometrytype函数查询返回值类型为geometry|/|
||返回值|返回一个有效的或者不变的geometry对象，结果对比参考postgis|/|
|特殊值|/|对象坐标数据覆盖  Nan、Inf、-Inf||
|数据量|/|- 构造单条大数据量(512k左右)
- 构造整表大数据量(1G左右，导入数据)
- 覆盖多点、多线、多面、集合等子类型
- 覆盖无效、有效的数据(参考invalid函数造数)，验证结果正确性
||


geometry ST_CollectionExtract(geometry collection);

geometry ST_CollectionExtract(geometry collection, integer type);

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,  
,  
,参数校验    
    
|参数个数|可以是1或者2个|0或者大于2个|
||  
,  
,  
,参数类型|1、  collection  ：,geometry类型，子类型可以是,- Point
- LineString
- Linering
- Polygon
- MultiPoint
- MultiLineString
- MultiPolygon
- Geometry Collection
,2、  type  ：,- 整型：int/bigint/number/double/float/bit/boolean
- 字符型：char、varchar、nchar、nvarchar、clob、nclob
|1、input：非  geometry类型，如标量类型或者UDT,2、  type  ：除整型、字符类型之外的其他类型|
||  
,  
,参数值|1、  collection  ：,- 单个或者多个geometry对象，有效的或者无效的
- 特殊值null(返回值也是null)、EMPTY数据
- 数据覆盖二维和三维坐标(四维需要覆盖？)
- 指定空间参考系标识SRID
- 边界值覆盖
- float：  +(-)  1.401298E-45、+(-)3.402823E38
- double：+(-)-1.79769313486232E308、  +(-)4.94065645841247E-324
,2、  type  ：,- 1(Point)、  2(LineString)、  3(Polygon)
- type=null时，返回值为null
- 却省时，执行类型顺序为3>2>1
- 指定type的维度大于给定geometry维度时，则返回的是type对应类型的EMPTY
|1、  collection  ：,- 非  geometry类型的标量类型数据、UDT数据等
- 非法值，空格' '、'null'
,2、  type  ：,- 负数、0、大于3的正数
- 非数值型数据
- 非法值，空串''、空格' '、'null'
|
||参数传值方式|直接传入参数（需按照参数顺序传参）|- 指定参数名称传参（参数名=>参数值，可无序传入参数）
- 混合传参(直接传入参数+指定参数名称)
|
|关键字校验|/|函数名称大小写|函数名拼写错误|
|返回值校验|返回值类型|使用st_geometrytype函数查询返回值类型为geometry|/|
||返回值|返回  Point、LineString、Polygon对应的geometry对象或者多Geometry对象|/|
|特殊值|/|坐标数据覆盖  Nan、Inf、-Inf||
|数据量|/|- 构造单条大数据量(512k左右)
- 构造整表大数据量(1G左右)
- 覆盖多点、多线、多面、集合等子类型
||


geometry ST_Centroid(geometry g1);(SRID：大地坐标)(yashan通过指定srid统一处理)

geography ST_Centroid(geography g1, boolean use_spheroid=true);(SRID：  地理坐标，经纬度坐标)

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,  
,  
,参数校验    
    
|参数个数|可以是1或者2个|0或者大于2个|
||  
,  
,  
,参数类型|1、  g1  ：,geometry类型，子类型可以是,- Point
- LineString
- Linering
- Polygon
- MultiPoint
- MultiLineString
- MultiPolygon
- Geometry Collection
- geography类型(大地坐标，指定空间参考系srid)
,2、use_spheroid：,boolean，其他有效等价类型可以是：,- 整型：int/bigint/bit
- 字符型：char、varchar、nchar、nvarchar
|1、  g1  ：非  geometry类型，如标量类型或者UDT,2、use_spheroid：除boolean、整型、字符类型之外的其他无效类型|
||  
,  
,参数值|1、  g1  ：,- 单个或者多个geometry对象，有效的或者无效的
- 特殊值null(返回值也是null)、EMPTY数据(返回值为POINT EMPTY)
- 数据覆盖二维和三维坐标(四维需要覆盖？)
- 指定空间参考系标识SRID
- 边界值覆盖
- float：  +(-)  1.401298E-45、+(-)3.402823E38
- double：+(-)-1.79769313486232E308、  +(-)4.94065645841247E-324
,2、use_spheroid：,- true、false
- 有效等价值：
,true：  'true'、't'、 'yes'、 'y'、 'on'、 '1'、1,false：'false'、'f'、 'no'、 'n'、 'off'、 '0'、0,- use_spheroid=null时，返回值也为null
|1、  g1  ：,- 非  geometry类型的标量类型数据、UDT数据等
- 非法值，空格' '、'null'
,2、  use_spheroid  ：,- 非true、false及其等价数据
- 非法值，空串''、空格' '、'null'
|
||参数传值方式|直接传入参数（需按照参数顺序传参）|- 指定参数名称传参（参数名=>参数值，可无序传入参数）
- 混合传参(直接传入参数+指定参数名称)
|
|关键字校验|/|函数名称大小写|函数名拼写错误|
|返回值校验|返回值类型|使用st_geometrytype函数查询返回值类型为geometry|/|
||返回值|返回值为Point对应的geometry对象|/|
|特殊值|/|坐标数据覆盖  Nan、Inf、-Inf||
|数据量|/|- 构造单条大数据量(512k左右)
- 构造整表大数据量(1G左右)
- 覆盖多点、多线、多面、集合等子类型
||


geometry ST_PointOnSurface(geometry g1);

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,  
,  
,参数校验    
    
|参数个数|1个|0或者大于1个|
||  
,  
,  
,参数类型|1、  g1  ：,geometry类型，子类型可以是,- Point
- LineString
- Linering
- Polygon
- MultiPoint
- MultiLineString
- MultiPolygon
- Geometry Collection
|1、  g1  ：非  geometry类型，如标量类型或者UDT|
||  
,  
,参数值|1、  g1  ：,- 单个或者多个geometry对象，有效的或者无效的
- 特殊值null(返回值也是null)、EMPTY数据(返回值为POINT EMPTY)
- 数据覆盖二维和三维坐标(四维需要覆盖？)
- 指定空间参考系标识SRID
- 边界值覆盖
- float：  +(-)  1.401298E-45、+(-)3.402823E38
- double：+(-)-1.79769313486232E308、  +(-)4.94065645841247E-324
|1、  g1  ：,- 非  geometry类型的标量类型数据、UDT数据等
- 非法值，空格' '、'null'
|
||参数传值方式|直接传入参数（需按照参数顺序传参）|- 指定参数名称传参（参数名=>参数值，可无序传入参数）
- 混合传参(直接传入参数+指定参数名称)
|
|关键字校验|/|函数名称大小写|函数名拼写错误|
|返回值校验|返回值类型|使用st_geometrytype函数查询返回值类型为geometry|/|
||返回值|返回值为Point对应的geometry对象|/|
|特殊值|/|坐标数据覆盖  Nan、Inf、-Inf||
|数据量|/|- 构造单条大数据量(512k左右)
- 构造整表大数据量(1G左右)
- 覆盖多点、多线、多面、集合等子类型
||


### 3.2.2使用场景

场景：geometry类型，挑选典型的场景去验证

|分类|使用场景|场景描述|备注|
|---|---|---|---|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,公共场景    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|  
,  
,函数嵌套    
    
,  
|自嵌套|ST_Centroid(ST_Centroid('LINESTRING EMPTY'))|
|||其他gis函数表达式作为函数入参|ST_Centroid(ST_geomFromText('LINESTRING EMPTY')),ST_Centroid(ST_Point(1, 2, 4326))|
|||作为其他gis函数的入参值|ST_IsValid(ST_CollectionExtract('LINESTRING(1 1, 2 2)'));|
||  
,geometry数据来源|- 表中的geometry列
- 输入函数构造(ST_GeomFromEwkb、ST_GeomFromGeoJSON等)
- 构造函数构造(ST_Point、ST_Polygon等)
- plsql中使用geometry变量
|  
|
||  
,  
,DML场景    
    
    
|insert values,insert into select(报错，YAS-00004 feature "UDT column batch insert" has not been implemented yet)|  
|
|||delete where|报错，YAS-06829 cannot compare VARRAY or LOB type|
|||update set value|  
|
|||merge into|  
|
||  
,  
,DDL场景    
    
    
|create table作为列的默认值|报错,YAS-04243 invalid identifier st_geomfromtext(xxx)|
|||alter table作为列的默认值||
|||create table as select 函数|不支持,YAS-00004 feature "UDT column in CREATE TABLE AS" has not been implemented yet|
|||create view as select 函数|支持|
||  
,  
,  
,DQL场景|作为select投影列返回(结合st_astext函数)|  
|
|||作为where条件：,- where gis_func()=xxx(拦截报错)
- where st_astext(gis_func()) (=、like、in xxx等)
|  
|
|||结合join：,- 直接作为join条件(拦截报错)
- 结合st_astext作为join条件
|  
|
|||结合in/not in/exists/not exist/between and/like/not like/  any/all/some/is null/is not null等子查询|  
|
||  
,  
,  
,  
,  
,PLSQL场景    
    
    
    
    
    
    
    
|变量赋值|  
|
|||游标投影列|  
|
|||用作存储过程、自定义函数出入参|  
|
|||用作自定义函数返回值|  
|
|||动态执行中用作绑定参数|  
|
|||在package子过程中使用|  
|
|||和内置高级包结合使用|dbms_sql子函数|
|||与触发器结合使用|  
|
|||在其他PLSQL语句中使用如流程控制语句、,FETCH子句等|forall in,fetch..bulk collect into|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,geometry对象场景数据构造|  
,  
,Point|- EMPTY：POINT EMPTY
- 二维：POINT(0 0)
- 三维：POINT Z(0.098877634341 0.9 4.98876665)
- 四维：POINT ZM(1.45678 1 6 10)
- 边界值：POINT(+(-)1.79769313486232E308 +(-)4.94065645841247E-324)
- 特殊值：POINT(nan nan)、POINT(-inf inf)(postgis报错)
|  
|
||  
,  
,  
,MultiPoint|- EMPTY：MULTIPOINT EMPTY
- 二维：MULTIPOINT(1 2 3 4,2 3.789 8 9)
- 三维：MULTIPOINT Z(2.098877634341 3.9 4.98876665)
- 四维：MULTIPOINT ZM(2.09887763434 3.9 4 10, 4 5 6 7)
- 边界值：MULTIPOINT(-1.79769313486232E308 1.79769313486232E308,4.94065645841247E-324 -4.94065645841247E-324)
- 特殊值：MULTIPOINT(nan nan,inf nan,-inf inf)
- 混合值：MULTIPOINT(0 0,EMPTY,nan nan)
- 多个点重合：MULTIPOINT(1 1 2 2,2 2 3 3,3 3 4 4)
|  
|
||  
,  
,  
,  
,  
,LineString|- EMPTY：LINESTRING EMPTY
- 二维：LINESTRING(4.632401035226987, -23.042281597142875,13.983954227628011, -19.664270777890319)
- 三维：LINESTRING Z(1 2 5 , 7 8 9 ,2.09887763434 3.9 4.98876665 , 89 90 91)
- 四维：LINESTRING ZM(2 3 4 10, 1 2 3 4)
- 边界值：LINESTRING(1 0,-1.79769313486232E308,-4.94065645841247E-324 1.79769313486232E308,4.94065645841247E-324 1.79769313486232E308)
- 特殊值：LINESTRING(nan nan,inf -inf)
- 混合值：LINESTRING(0 0,EMPTY,nan 50)
- 封闭线：LINESTRING(0 0, 0 1, 1 1, 1 0, 0 0)
- 线重复：LINESTRING(0 0, 0 1, 1 1, 0 1, 0 0)
- 线经过起点：LINESTRING(0 1,0 2,2 1,-1 1)
|  
|
||  
,  
,  
,  
,MultiLineString|- EMPTY：MULTILINESTRING EMPTY
- 二维：MULTILINESTRING((0 0, 2 0), (1 1, 2 2), (100 100, 250 260))
- 三维：MULTILINESTRING Z ((0 0 0, 2 0 0), (2.09887763434 3.91 0, 2 2 0))
- 四维：MULTILINESTRING ZM ((0 0 0 0, 2.09887763434 3.9000000000000009 0 0), (1 1 0 0, 2 2 0 0))
- 特殊值：MULTILINESTRING((nan nan, 2 0, inf nan), (1 0, inf -inf, -30 10))
- 边界值：MULTILINESTRING((1 2, 1.79769313486232E308 4.94065645841247E-324, 6 7, 7 9 , 56 57, -1 23),(0 0, 1 1, -1.79769313486232E308 -4.94065645841247E-324))
- 混合值：MULTILINESTRING((0 0, inf 0), (nan 1, 2 2), EMPTY)
- 线相交：相交1个点：MULTILINESTRING((4 -2,3 -9),(4 -2,8 6))；相交多个点：MULTILINESTRING((0 0, 2 0, 1 10), (1 10, 20 20, -10 30), (0 0,-20 10,-10 30))
- 封闭线：MULTILINESTRING((0 0,0 1),(0 1, 1 1),(1 1,1 0),(1 0,0 0))
- 线重复多次：MULTILINESTRING((0 0,1 1),(1 1,2 0),(2 0,1 1),(2 0,2 2),(2 2,2 0),(2 2, 1 1))
|  
|
||  
,  
,  
,  
,  
,  
,  
,Polygon|- EMPTY：POLYGON EMPTY
- 二维：POLYGON((0 0,0.5 0,0.5 0.5,0 1,0 0))
- 三维：POLYGON Z ((0 0 0,10000.899 0 0,200000 10000000 0,500000.877666 10000000.988766 0,0 0 0),(500 500 0,600 500 0,600 600 0,500 600 0,500 500 0))
- 四维：POLYGON ZM ((0 0 0 2,10 10 0 2,0 10 0 2,0 0 0 2),(2 2 0 2,5 5 0 2,5 2 0 2,2 2 0 2))
- 边界值：POLYGON ((0 0 0 2,-1.79769313486232E308 -4.94065645841247E-324 0 2,10 10 0 2,0 10 0 2,0 0 0 2),(2 2 0 2,1.79769313486232E308 4.94065645841247E-324 0 2,5 5 0 2,5 2 0 2,2 2 0 2))
- 特殊值(首尾包含nan)：POLYGON((nan nan,300 20,-50 -10,0 98.6, nan nan))
,无效的Polygon：    ,- 线性：POLYGON((0 0,0.5 0,1 0, 2 0,0 0))
- 内环在外环外面：POLYGON((0 0,50 0,100 0, 100 90,0 100,0 0),(-10 -10 ,50 -10,100 -10, 100 100,-10 150,-10 -10))
- 三个环：POLYGON((0 0,50 0,100 0, 100 90,0 100,0 0),(10 10 ,20 10, 20 20,10 20,10 10),(5 5 ,30 5, 30 30,5 30,5 5))
- 内环跟外环相交多个点：POLYGON((0 0,50 0,100 0, 100 90,0 90,0 0),(10 10 ,-20 10, -20 20,10 20,10 10))
- 内环与外环相切于线：POLYGON((0 0,50 0,100 0, 100 90,0 90,0 0),(0 10 ,20 10, 20 20,0 20,0 10))
,有效的Polygon：,- 内环在外环里面(不相交)：POLYGON((0 0,50 0,100 0, 100 90,0 90,0 0),(10 10 ,20 10, 20 20,10 20,10 10))
- 内环与外环相切于1个点：POLYGON((0 0,50 0,100 0, 100 90,0 90,0 0),(0 0,10 50,50 50,40 10,0 0))
|  
|
||  
,  
,  
,  
,  
,  
,  
,MultiPolygon|- EMPTY：MULTIPOLYGON EMPTY
- 二维：MULTIPOLYGON(((0 0,20 0,20 30,0 10,0 0)),((30 0,40 0,40 20,30 20,30 0)))
- 三维：MULTIPOLYGON M (((0 0,20 0,20 30,0 10,0 0)),((30 0,40 0,40 20,30 20,30 0)))
- 四维：MULTIPOLYGON ZM (((0 0 2 4,-10 0 2 5.453,10 10 2 23.231,0 10 2 1,0 0 2 5)),((-2 2 2 5.87,-2 5 2 20,-5 5 2 5.24,-5 2 2 23.242,-2 2 2 90.2124123199999)))
,有效的MultiPolygon：,- 两个面相交于1个点：MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((20 0,40 0,40 20,30 20,20 0)))
- 多个面，两两面相交于1个点：MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((10 0,20 -5,30 0,30 20,15 20,10 0)),((30 0,40 -5,50 0,50 30,35 20,30 0)),((50 0,60 -5,70 0,70 30,60 20,50 0)),((-20 -20,-10 -20,0 0,-50 0, -20 -20)))
- 多个面，里面的孔相互独立不相交：MULTIPOLYGON (((0 0,80 0,80 80,0 80,0 0),(1 1,20 1,20 20,1 20,1 1),(30 30,40 30,40 50,30 50,30 30)), ((-15 -15,-15 -20,-20 -20,-20 -15,-15 -15)))
- 多个面，第三个面在第一个面里面，不相交：MULTIPOLYGON (((0 0, 0 10, 10 10, 10 0, 0 0), (2 2, 2 8, 8 8, 8 2, 2 2)), ((15 15,15 20,20 20,20 15,15 15)), ((3 3, 4 3, 4 6, 3 6, 3 3)))
,无效的MultiPolygon：,- 两个面内部重合，第二个面在第一个面内部：MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((2 2,2 5,5 5,5 2,2 2)))
- 两个面部分相交：MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((10 5,5 10,8 20,15 10,10 5)))
- 两个面相交于一条线：MULTIPOLYGON(((20 0,40 0,40 20,30 20,20 0)),((20 0,50 0,40 30,20 0))
- 多个面，里面的孔一层套一层：MULTIPOLYGON (((0 0,80 0,80 80,0 80,0 0),(1 1,79 1,79 79,1 79,1 1),(2 2,76 2,76 76,2 76,2 2),(3 3,75 3,75 75,3 75,3 3),(30 50,60 50,60 70,30 70,30 50)))
|  
|
||  
,  
,  
,  
,  
,  
,  
,  
,  
,GeometryCollection|EMPTY：,- GEOMETRYCOLLECTION EMPTY
- GEOMETRYCOLLECTION(POINT EMPTY)
- GEOMETRYCOLLECTION(MULTIPOINT EMPTY)
- GEOMETRYCOLLECTION(LINESTRING EMPTY)
- GEOMETRYCOLLECTION(MULTILINESTRING EMPTY)
- GEOMETRYCOLLECTION(POLYGON EMPTY)
- GEOMETRYCOLLECTION(MULTIPOLYGON EMPTY)
- GEOMETRYCOLLECTION(POINT EMPTY, MULTIPOINT EMPTY, LINESTRING EMPTY, MULTILINESTRING EMPTY, POLYGON EMPTY, MULTIPOLYGON EMPTY)
,二维：GEOMETRYCOLLECTION(POINT(78 43.43),LINESTRING(-5 -5, -7 -7)),三维：GEOMETRYCOLLECTION Z (MULTIPOLYGON Z (((0 0 5,10 0 5,10 10 5,0 10 5,0 0 5),(2 2 5,2 5 5,5 5 5,5 2 5,2 2 5))),POINT Z (0 0 5),MULTILINESTRING Z ((0 0 5, 2 0 5),(1 1 5, 2 2 5))),四维：GEOMETRYCOLLECTION ZM (MULTIPOLYGON ZM (((0 0 5 4,10 0 5 4,10 10 5 4,0 10 5 4,0 0 5 4),(2 2 5 4,2 5 5 4,5 5 5 4,5 2 5 4,2 2 5 4))),POINT ZM (0 0 5 4),MULTILINESTRING ZM ((0 0 5 4, 2 0 5 4),(1 1 5 4, 2 2 5 4))),特殊值：GEOMETRYCOLLECTION(POINT(nan nan))、GEOMETRYCOLLECTION(POINT(inf -inf)),边界值：GEOMETRYCOLLECTION(MULTIPOINT(1.17549435082228750796873653722224568E-38 3.40282346638528859811704183484516925e+38, -1.17549435082228750796873653722224568e-38 -3.40282346638528859811704183484516925e+38),LINESTRING(1 1,10 3.40282346638528859811704183484516925e+38)),集合构成：POINT、MULTIPOINT、LINESTRING、MULTILINESTRING、POLYGON、MULTIPOLYGON及其GEOMETRYCOLLECTION的任意组合,子类型形态：,- 线的端点跟点相交：GEOMETRYCOLLECTION(POINT(5 -10),LINESTRING(5 -10,20 -10))
- 线跟线相交：GEOMETRYCOLLECTION(LINESTRING(5 0,5 -10),LINESTRING( -10 -5,20 -5)
- 线跟面相交：GEOMETRYCOLLECTION(POLYGON((0 0,50 0,100 0, 100 90,0 90,0 0)),MULTILINESTRING((1 0, 1 10),(25 10,50 90)))
- 面跟面相交：GEOMETRYCOLLECTION(POLYGON((0 0,50 0,100 0, 100 90,0 90,0 0)),POLYGON((10 10 ,-20 10, -20 20,10 20,10 10)))
|  
|


### 3.2.3特性是否涉及  DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


### 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：