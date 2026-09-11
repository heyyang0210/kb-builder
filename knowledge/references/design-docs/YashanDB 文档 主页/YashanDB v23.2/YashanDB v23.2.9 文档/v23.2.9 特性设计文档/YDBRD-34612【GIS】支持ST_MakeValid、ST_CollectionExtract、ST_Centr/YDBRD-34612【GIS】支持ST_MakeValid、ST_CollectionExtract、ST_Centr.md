Created by 廖增康, last modified on 十一月 14, 2024

  [https://pingcode.yasdb.com/pjm/items/6718671ce489dd0868fcc078](https://pingcode.yasdb.com/pjm/items/6718671ce489dd0868fcc078)    ?    
  #YDBRD-34612 【GIS】支持ST_MakeValid、ST_CollectionExtract、ST_Centroid、ST_PointOnSurface、ST_Transform函数

##   [1. 总述](#1-总述)  

深圳住建局需求需要支持GIS相关ST_MakeValid、ST_CollectionExtract、ST_Centroid、ST_PointOnSurface、ST_Transform函数

###   [1.1 需求来源](#11-需求来源)  

深圳住建局需求。

###   [1.2 调研文档](#12-调研文档)  

无

###   [1.3 需求分析](#13-需求分析)  

- 支持ST_MakeValid、ST_CollectionExtract、ST_Centroid、ST_PointOnSurface、ST_Transform(geometry geom, text from_proj, integer to_srid);函数
- 需求只需要支持单机部署。


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

```
函数接口
-- ST_MakeValid
geometry ST_MakeValid(geometry input);

geometry ST_MakeValid(geometry input, text params);

-- ST_CollectionExtract
geometry ST_CollectionExtract(geometry collection);

geometry ST_CollectionExtract(geometry collection, integer type);

-- ST_Centroid
geometry ST_Centroid(geometry g1, bool use_spheroid);

-- ST_PointOnSurface
geometry ST_PointOnSurface(geometry g1);

-- ST_Transform

geometry ST_Transform(geometry geom, text from_proj, integer to_srid);

```

##   [3. 规格与约束](#3-规格与约束)  

|约束||
|---|---|
|ST_Transform()本次需求只实现geometry ST_Transform(geometry geom, text from_proj, integer to_srid)接口|,|
|ST_Centroid接口use_spheroid默认值为ture,目前崖山计算面积只支持椭球体方式.,|ST_Centroid经纬度坐标，参数use_spheroid = false实现还是按椭球体方式计算，后续再统一规划球体的计算|


##   [4. 特性](#4-特性)  

###   [4.1 ST_MakeValid](#41-st-makevalid)  

```
1. postgis 参考文档: https://postgis.net/docs/manual-3.5/zh_Hans/ST_MakeValid.html
2. 函数功能: 该函数尝试创建给定无效几何体的有效表示，而不丢失任何输入顶点。 有效几何图形原封不动地返回。
          相应的输入是点、多点、线串、多线串、多边形、多多边形、几何集合及其混合。
          在完全或部分尺寸折叠的情况下，输出几何是相同或较低维度的几何集合，或者是较低维度几何的集合。
          在自相交的情况下，单个多边形可能会变成多重几何图形。
3. 函数参数: params参数可用于提供选项字符串来选择用于构建有效几何图形的方法。 选项字符串的格式为 "method=linework|struct keepcollapsed=true|false"。 如果未提供"params"参数，则将使用"linework"算法作为默认值。
          1. "method" 键有两个值。
             "linework" 是原始算法，它通过首先提取所有线条、将线条节点在一起、然后从线条构建值输出来构建有效的几何图形。
             "structure" 是一种区分内环和外环的算法，通过合并外环来构建新的几何形状，然后区分所有内环。
          2. "keepcollapsed" 键仅对 "structure" 算法有效，其取值为 "true" 或 "false"。当设置为 "false" 时，会删除折叠到更低维度的几何组件，例如一维线串（linestring）会被丢弃。
4. 函数实现:  
         1. 读取输入参数0，并且判断输入参数类型是否点、多点、线串、多线串、多边形、多多边形、几何集合及其混合，否报不支持geom类型.
         2. 当前参数是否大于1 ，如果是判断输入参数1是否为空，非空读取输入参数1.
         3. 如果只有1个输入参数，调用 GEOSMakeValid_r 接口函数返回有效几何图形。
         4. 如果参数大于1，判断params选项：
            1.包含 method, 调 GEOSMakeValidParams_setMethod_r 方法设置。
            2.包含 keepcollapsed，调 GEOSMakeValidParams_setKeepCollapsed_r 方法设置。
            3. 调用 GEOSMakeValidWithParams_r 接口函数返回有效几何图形。

```

###   [4.2 ST_CollectionExtract](#42-st-collectionextract)  

```
1. postgis参考文档:  https://postgis.net/docs/manual-3.5/zh_Hans/ST_CollectionExtract.html
2. 函数功能: 给定一个几何集合，返回同种类型多几何。
          对于基本几何输入，如果输入类型与请求的类型匹配，则几何图形将保持不变返回。 否则，结果是指定类型的空几何图形。 如果需要，可以使用 ST_Multi 将它们转换为多几何图形。
3. 函数参数: 
         1. 如果未指定类型(type)，则返回仅包含最高维度几何的多几何。 因此，多边形优先于线，线优先于点。
         2. 果指定了类型(type)，则返回仅包含指定类型的多几何。 如果没有指定类型的元素，则返回 EMPTY 几何图形。 仅支持点、线和面。 type类型编号如下：
            1 == POINT
			2 == LINESTRING
			3 == POLYGON
4. 函数实现: 
         1. 读取输入几何集合参数和type类型参数，没有输入type参数，type默认为0.
         2. 判断是否为镜像非集合类型几何图形，如果非集合几何类型，判断是否跟type一致，一致返回输入几何的集合类型，如果不一致返回空集合类型。
         3. 遍历输入集合类型里面几何图形，提前最高维度集合类型type.
         4. 递归提取type类型相同几何类型，放入返回几何集合中.

```

###   [4.3 ST_Centroid](#43-st-centroid)  

```
1. postgis参考文档: https://postgis.net/docs/manual-3.5/zh_Hans/ST_Centroid.html
2. 函数功能: 计算作为几何体的几何质心的点。 对于 [MULTI]POINT，质心是输入坐标的算术平均值。 对于 [MULTI]LINESTRING，质心是使用每条线段的加权长度计算的。 
          对于 [MULTI]POLYGON，质心是根据面积计算的。 如果提供了空几何图形，则返回空的GEOMETRYCOLLECTION。 如果提供 NULL，则返回 NULL。 如果提供了CIRCULARSTRING或COMPOUNDCURVE，它们首先使用CurveToLine转换为线串，然后与LINESTRING相同
          对于混合维度输入，结果等于最高维度的组件几何图形的质心（因为较低维度的几何图形对质心的“权重”贡献为零）。
          请注意，对于多边形几何形状，质心不一定位于多边形的内部。 例如，请参见下图 C 形多边形的质心。 要构造保证位于多边形内部的点，请使用 ST_PointOnSurface。
3. 函数参数: 无
4. 函数实现:
         1. 读取输入几何集参数。
         2. 调用 GEOSGetCentroid_r函数返回几何质心的点.

```

###   [4.4 ST_PointOnSurface](#44-st-pointonsurface)  

```
1. postgis参考文档: https://postgis.net/docs/manual-3.5/zh_Hans/ST_PointOnSurface.html
2. 函数功能: 返回保证位于曲面内部的POINT（POLYGON、MULTIPOLYGON 和 CURVEPOLYGON）。 在 PostGIS 中，此函数也适用于线和点几何图形。
3. 函数参数: 无
4. 函数实现:
         1. 读取输入几何集参数。
         2. 调用 GEOSPointOnSurface_r函数返回位于曲面内部几何质心的点.

```

###   [4.5 ST_Transform](#45-st-transform)  

```
1. postgis参考文档: https://postgis.net/docs/manual-3.5/zh_Hans/ST_Transform.html
2. 函数功能: 返回一个新的几何图形，其坐标转换为不同的空间参考系统。
3. 函数参数: from_proj 字符串源空间参考。
             to_srid 目标空间参考SRID.
4. 函数实现:
        1. 读取输入几何集参数, from_proj 字符串源空间参考，to_srid 目标空间参考srid.
        2. 调用proj库proj_transport_generic函数转换. 

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|测试项目|测试步骤|用例|预期结果|备注|
|---|---|---|---|---|
|ST_MakeValid|ST_MakeValid输入点(Point)返回有效几何体||与postgis结果执行一致||
|ST_MakeValid|ST_MakeValid输入线串(Linestring)返回有效几何体||与postgis结果执行一致||
|ST_MakeValid|ST_MakeValid输入多边形(Polygon)返回有效几何体||与postgis结果执行一致||
|ST_MakeValid|ST_MakeValid输入多点(MultiPoint)返回有效几何体||与postgis结果执行一致||
|ST_MakeValid|ST_MakeValid输入多线串(MultiLinestring)返回有效几何体||与postgis结果执行一致||
|ST_MakeValid|ST_MakeValid输入多多边形(MultiPolygon)返回有效几何体||与postgis结果执行一致||
|ST_MakeValid|ST_MakeValid输入几何集合(GeometryCollection)返回有效几何体||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入点(Point)几何集合不指定类型返回同种点几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入点(Point)几何集合指定类型点(Point 1)返回同种点几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入点(Point)几何集合指定类型线串(Linestring 2)返回空几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入点(Point)几何集合指定类型多边形(Polygon 3)返回空几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入线串(Linestring)几何集合不指定类型返回同种线串几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入线串(Linestring)几何集合指定类型点(Point 1)返回空几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入线串(Linestring)几何集合指定类型线串(Linestring 2)返回同种线串几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入线串(Linestring)几何集合指定类型多边形(Polygon 3)返回空几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多边形(Polygon)几何集合不指定类型返回同种几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多边形(Polygon)几何集合指定类型点(Point 1)返回空几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多边形(Polygon)几何集合指定类型线串(Linestring 2)返回空几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多边形(Polygon)几何集合指定类型多边形(Polygon 3)返回同种几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多点(MultiPoint)几何集合不指定类型返回同种几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多点(MultiPoint)几何集合指定类型点(Point 1)返回同种几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多点(MultiPoint)几何集合指定类型线串(Linestring 2)返回空几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多点(MultiPoint)几何集合指定类型多边形(Polygon 3)返回空几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多线串(MultiLinestring)几何集合不指定类型返回同种几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多线串(MultiLinestring)几何集合指定类型点(Point 1)返回空几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多线串(MultiLinestring)几何集合指定类型线串(Linestring 2)返回同种几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多线串(MultiLinestring)几何集合指定类型多边形(Polygon 3)返回空几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多多边形(MultiPolygon)几何集合不指定类型返回同种几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多多边形(MultiPolygon)几何集合指定类型点(Point 1)返回空几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多多边形(MultiPolygon)几何集合指定类型线串(Linestring 2)返回空几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入多多边形(MultiPolygon)几何集合指定类型多边形(Polygon 3)返回同种几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入几何集合(GeometryCollection)几何集合不指定类型返回同种多边形几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入几何集合(GeometryCollection)几何集合指定类型点(Point 1)返回同种点几何类型多几何||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入几何集合(GeometryCollection)几何集合指定类型线串(Linestring 2)返回同种线串几何类型||与postgis结果执行一致||
|ST_CollectionExtract|ST_CollectionExtract输入几何集合(GeometryCollection)几何集合指定类型多边形(Polygon 3)返回同种多边形几何类型||与postgis结果执行一致||
|ST_Centroid|ST_Centroid输入点(Point)返回几何体的几何质心的点||与postgis结果执行一致||
|ST_Centroid|ST_Centroid输入线串(Linestring)返回几何体的几何质心的点||与postgis结果执行一致||
|ST_Centroid|ST_Centroid输入多边形(Polygon)返回几何体的几何质心的点||与postgis结果执行一致||
|ST_Centroid|ST_Centroid输入多点(MultiPoint)返回几何体的几何质心的点||与postgis结果执行一致||
|ST_Centroid|ST_Centroid输入多线串(MultiLinestring)返回几何体的几何质心的点||与postgis结果执行一致||
|ST_Centroid|ST_Centroid输入多多边形(MultiPolygon)返回几何体的几何质心的点||与postgis结果执行一致||
|ST_Centroid|ST_Centroid输入几何集合(GeometryCollection)返回几何体的几何质心的点||与postgis结果执行一致||
|ST_PointOnSurface|ST_PointOnSurface输入点(Point)返回保证位于曲面内部的POINT||与postgis结果执行一致||
|ST_PointOnSurface|ST_PointOnSurface输入线串(Linestring)返回保证位于曲面内部的POINT||与postgis结果执行一致||
|ST_PointOnSurface|ST_PointOnSurface输入多边形(Polygon)返回保证位于曲面内部的POINT||与postgis结果执行一致||
|ST_PointOnSurface|ST_PointOnSurface输入多点(MultiPoint)返回保证位于曲面内部的POINT||与postgis结果执行一致||
|ST_PointOnSurface|ST_PointOnSurface输入多线串(MultiLinestring)返回保证位于曲面内部的POINT||与postgis结果执行一致||
|ST_PointOnSurface|ST_PointOnSurface输入多多边形(MultiPolygon)返回保证位于曲面内部的POINT||与postgis结果执行一致||
|ST_PointOnSurface|ST_PointOnSurface输入几何集合(GeometryCollection)返回保证位于曲面内部的POINT||与postgis结果执行一致||
|ST_Transform|ST_Transform输入点(Point)给定from_proj和目标to_srid返回转换为目标参考系下的新几何图形||与postgis结果执行一致||
|ST_Transform|ST_Transform输入线串(Linestring)给定from_proj和目标to_srid返回转换为目标参考系下的新几何图形||与postgis结果执行一致||
|ST_Transform|ST_Transform输入多边形(Polygon)给定from_proj和目标to_srid返回转换为目标参考系下的新几何图形||与postgis结果执行一致||
|ST_Transform|ST_Transform输入多点(MultiPoint)给定from_proj和目标to_srid返回转换为目标参考系下的新几何图形||与postgis结果执行一致||
|ST_Transform|ST_Transform输入多线串(MultiLinestring)给定from_proj和目标to_srid返回转换为目标参考系下的新几何图形||与postgis结果执行一致||
|ST_Transform|ST_Transform输入多多边形(MultiPolygon)给定from_proj和目标to_srid返回转换为目标参考系下的新几何图形||与postgis结果执行一致||
|ST_Transform|ST_Transform输入几何集合(GeometryCollection)给定from_proj和目标to_srid返回转换为目标参考系下的新几何图形||与postgis结果执行一致||


##   [7. 工作量评估](#7-工作量评估)  

|序号|工作项|时间(单位: 人/天)|日期|
|---|---|---|---|
|1|单机GIS支持ST_MakeValid，ST_Centroid，ST_PointOnSurface 函数|2||
|2|单机GIS支持ST_CollectionExtract 函数|1||
|3|单机GIS支持ST_Transform函数|2||
|4|新增GIS函数自测|3||


##   [8.资料设计章节](#8资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [9.未来规划](#9未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,1. 崖山DB调用GEOS接口需要 _r 的线程安全接口.
1. 输入参数不一致报错。
1. use_spheroid 参数调研。-- 不需要支持.
1. text参数类型改成varchar.
1. geography类型 ST_Centroid 是否需要实现。 - 跟3一致，崖山geometry类型已经支持地理坐标系，不需要再支持这个接口.
,Posted by liaozengkang at 十一月 06, 2024 15:08|
|---|


