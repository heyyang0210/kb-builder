Created by 李美娥, last modified on 三月 11, 2024

# 1. 概述

      需求：    [YDBRD-23101](https://jira.yasdb.com/browse/YDBRD-23101?src=confmacro)    -  支持ST_Split等9个函数  完成

      开发设计：待补充

      对外提供的函数：  ST_Dump、st_concavehull、  ST_MakeEnvelope、ST_Multi、ST_IsClosed、ST_BuildArea、ST_LineMerge、ST_Split、  ST_Z

      函数目前支持的类型：Point、LineString（  LineRing  ）、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型

# 2. 需求分析

## 2.1 功能点分析

（1）ST_Dump：  它返回一组       [geometry_dump](https://www.osgeo.cn/postgis-manual/geometry_dump.html)       行，每个行包含一个几何图形(     *几何图形*  * *  字段)和一个整数数组(     *路径*  * *  字段)。  对于原子几何类型(POINT、LINESTRING、POLGON)，返回的单个记录为空     *路径*  * *  数组和输入几何图形为     *几何图形*  * *  。对于集合或多几何图形，返回每个集合组件的记录，并且     *路径*  * *  表示组件在集合内的位置。

         表中纯empty的数据会跳过，不处理，无任何返回。

         入参是Null,也无返回。

         点、线、面 st_dump后的path，{}

         多点、多线、多面st_dump后的path，{X}，比如含2个点的多点，返回的2个元素的path依次是{1}、{2} 

         集合含点、线、面st_dump后的path，{X}

         集合里面含多线、多点、多面st_dump后的path，{X1，X2}，X1是在集合里面第几个元素，X2是集合里面第几个元素再dump拆分后第几个元素，比如st_geomfromtext('GEOMETRYCOLLECTION Z (MULTIPOLYGON Z (((0 0 5,10 0 5,10 10 5,0 10 5,0 0 5),(2 2 5,2 5 5,5 5 5,5 2 5,2 2 5))),POINT Z (0 0 5),MULTILINESTRING Z ((0 0 5, 2 0 5),(1 1 5, 2 2 5)))')的path依次是{1,1}，{2}，{3,1}，{3,2}。

         st_geomfromtext('MULTIPOINT((-15 -15), (5 5), EMPTY)')  会拆成POINT(-15 -15)、POINT(5 5)、POINT EMPTY

          select t1.col_int, st_astext(t2.geom,0) as result from tb_YDBRD_21117_rtree_pre_01 t1, table(st_dump(t1.col_geom)) t2 where t1.col_int in (1001,1002) order by t1.col_int;

          select t3.col_int, t4.column_value, t3.geom from (select t1.col_int col_int, t2.path path , st_astext(t2.geom,0) geom from tb_YDBRD_21117_rtree_pre_01 t1, table(st_dump(t1.col_geom)) t2) t3, table(t3.path) t4 order by t3.col_int,t4.column_value;

         SELECT col_int,(t.dump).path,ST_AsText((t.dump).geom) from (select col_int,ST_Dump(col_geom) as dump from tb_YDBRD_22074_pre_07_target) as t;

         pg是如下的方式查询：

         select col_int,ST_Dump(col_geom) from tb_YDBRD_21117_rtree_pre_01;

         select col_int,(ST_Dump(col_geom)).path,st_astext( (ST_Dump(col_geom)).geom ) from tb_YDBRD_21117_rtree_pre_01;

         yashan的查询方式：

         --只查看st_dump结果中的geom，由于st_dump的结果是数组，数组的每个成员是一个int的数组和一个geometry, 所以只查看geometry的话，需要用到一次表函数    
           select t1.col_int, st_astext(t2.geom) from tb_YDBRD_21117_rtree_pre_01 t1, table(st_dump(t1.col_geom)) t2;    
           --查看path，由于path也是个数组，所以需要用到两次表函数    
           select t3.col_int, t4.column_value, t3.geom from (select t1.col_int col_int, t2.path path , st_astext(t2.geom) geom from tb_YDBRD_21117_rtree_pre_01 t1, table(st_dump(t1.col_geom)) t2) t3, table(t3.path) t4;

         yashan返回的是数组udt_array，里面的元素是udt_table类型+ udt_object(geom)。可以支持table函数查询。与ARRAY_XXX函数简单结合测试如ARRAY_TO_STRING，报错。

         集合变量操作方法如limit、count可以跟其结合使用。

（2）st_concavehull：函数用于计算一个Geometry对象的凹包。凹包指可以覆盖输入的几何对象所有顶点的一个几何对象，该几何对象一般    
  为一个凹多边形。  在一般情况下，凸壳是一个多边形。两个或多个共线点的凸包是两点直线串。一个或多个相同点的凸包称为点。纯empty的凸包仍是自己。任一入参是Null返回null。

        geometry ST_ConcaveHull(geometry param_geom,     float param_pctconvex, boolean param_allow_holes = false  ); 

        param_pctconvex范围是【0，1】，  控制计算外壳线的凹陷度。值为1将生成凸面外壳线。值为0会生成具有最大凹度的外壳线(但仍为单个多边形)。介于1和0之间的值会产生凹凸度增加的外壳。选择合适的值取决于输入数据的性质，但介于0.3和0.1之间的值通常会产生合理的结果。

        param_allow_holes返回的面是否含孔–如何构造这样的数据，传参是false无孔，传参true有孔？

       --最后一个点的z不一样，会把最后一个点的z统一    
         select ST_AsText(ST_ConcaveHull(st_geomfromtext('linestring(0 0 9, 4 0 0, 4 4 0, 0 4 0, 0 0 1)'),0.88,true),0) from dual;

       面的顺序经常变动(Pg也变动）

（3  ）  ST_MakeEnvelope  ：  根据最小值和最大值 X 和 Y 生成矩形多边形。 输入值必须与 SRID 指定的空间参考系统匹配。如果未指定 SRID，则使用未知空间参考系统 （SRID 0）。指定的srid如9999不存在，其srid是9999。

        geometry ST_MakeEnvelope(float xmin, float ymin, float xmax, float ymax, integer srid=unknown);

        select st_astext(ST_MakeEnvelope(1, 2,-3, 0,9999));返回的是POLYGON((1 2,1 0,-3 0,-3 2,1 2))。返回POLYGON((1 2,1 0,-3 0,-3 2,1 2))，没有要求xmin<xmax，只要xmin<=xmax，或者xmin>=xmax均可以。

        坐标构造出的外包框超过对应srid的xy的边界，查看返回的外包框情况。（常用的srid，都测试下对应的边界，超出边界的挑选一个srid测试即可）。

（4）  ST_Multi：  将几何图形作为多*几何图形集合返回。如果几何图形已经是一个集合，则返回时不变。入参是null，返回null。

        geometry ST_Multi(geometry geom)

        例子：select col_int,st_astext(ST_Multi( col_geom ))from tb_YDBRD_22074_rtree_pre_01; point empty变成MULTIPOINT EMPTY

（5）  ST_IsClosed  （跟Z坐标有关系）  ：  如果输入几何体已闭合，则 ST_IsClosed 返回 true，入参是Null返回Null。以下规则定义闭合的几何体：

         boolean ST_IsClosed(geometry g);

- 输入的几何体是一个点或一个多点。
- 输入几何体是一个线串，并且该线串的起点和终点是重合的。
- 输入几何体是一个非空的多线串，并且其所有线串均已闭合。
- 输入几何体是一个非空多边形，所有多边形的环都是非空的，并且所有环的起点和终点都是重合的。
- 输入几何体是一个非空的多边形集合，并且其所有多边形均已闭合。
- 输入几何体是一个非空几何体集合，并且其所有组件均已闭合。


      数据里面只要含了empty,都是返回的false。

      select ST_IsClosed( st_geomfromtext('POLYGON((0 0,0.5 0,0.5 0,0 0))', 4326) );面是空的，没有面积，也是闭合，返回的是true。

   补充线、多线、集合的数据。

          即使线自交，只要首尾点相同，是闭合，都是true。

     select ST_IsClosed(st_geomfromtext('LINESTRING(0 0, 0 1, 1 1, 2 2, 1 1, 1 0, 0 0)', 4326)) from dual;

     select ST_IsClosed(st_geomfromtext('LINESTRING(0 0 8,8 0 9,4 4 9,0 8 5,8 8 7, 4 4 9,0 0 8)', 4326)) from dual;

     若首尾点的Z坐标不一样，即使闭合，也是false。

     select ST_IsClosed(st_geomfromtext('LINESTRING(0 0 8,8 0 9,4 4 9,0 8 5,8 8 7, 4 4 9,0 0 6)', 4326)) from dual;

     跟pg存在一个差异，见31。

（6）  ST_BuildArea：  创建由输入几何体的组成线条形成的面几何体。 输入可以是 LineString、MultiLineString、Polygon、MultiPolygon 或 GeometryCollection。 结果是多边形或多多边形，具体取决于输入。 如果输入线条未形成多边形，则返回 NULL。  纯empty，函数都是返回POLYGON EMPTY。集合里面若含点，面，多点，返回集合里面的面，点和多点信息会丢弃。  多面，但实际里面仅一个面信息，返回的是面。只有有多个面，即使多个面间是包含等关系，返回的也是多面。  入参是Null返回Null。含数据+empty，会返回数据把empty丢弃。

          geometry ST_BuildArea(geometry geom);

|  
|  
|  
|
|:---|:---|:---|
|线|1、线有多余的一部分线：LINESTRING(0 0, 0 1, 1 1, 2 2, 1 1, 1 0, 0 0),2、线组成的面，面积为0,3、线组成的面自身相交（类似8的形状）|返回Null|
|多线|1、多线相交：MULTILINESTRING((0 0, 20 0,20 20,0 20,0 0), EMPTY,(10 2,30 2,30 10,10 10 ,10 2)),2、多线组成的面独立,3、多线组成的面含洞，洞独立 :返回的面含2个洞,4、多线组成的面含洞，洞间是包含关系：一个面含一个孔交替|返回的是POLYGON ((30 10, 30 2, 20 2, 20 0, 0 0, 0 20, 20 20, 20 10, 30 10)),，把多线相交的部分，不再单独算一个面|
|面|1、含孔、不含孔,2、面自交|  
|
|多面|1、独立,2、相交,3、包含|  
|
|集合|1、集合仅含点、多点,2、集合仅含线、线间组成独立、相交、包含的面,3、线含多线、多面（上面线、面的情况包了一层而已）|  
|


          select st_astext(st_buildarea(st_geomfromtext('linestring(0 0 nan, 4 0 0, 4 4 0, 0 4 0, 0 0 1)')), 0) from dual;  --对于Z是特殊值，返回会有差异。

（7）  ST_LineMerge：  返回通过将 MultiLineString 的线元素连接在一起而形成的 LineString 或 MultiLineString。 线在 2 线交叉点处的  端点处连接  。 线不会在三向或更高阶次的交叉点上连接。如果  **定向**  为 TRUE，则 ST_LineMerge 将不会更改 LineStrings 内的点顺序，因此方向相反的线不会被合并。仅与 MultiLineString/LineString 一起使用。 其他几何类型返回空的 GeometryCollection（纯empty除外，若是纯empty,返回对应的empty）集合里面是线或者多线，返回的也是空集合。集合里面含的是纯empty，返回的是集合，里面的对象是比如GEOMETRYCOLLECTION(POLYGON EMPTY)。多线里面的只有部分线在交叉点连接，就可以把这部分合成一条线，返回的仍是多线。入参是Null,返回Null。

  `    geometry ST_LineMerge(`    geometry     amultilinestring    `)`    ;

  `    geometry ST_LineMerge(`    geometry     amultilinestring, boolean     directed    `)`    ;

         directed默认是false，不区分线的顺序。

         select st_astext(ST_LineMerge( st_geomfromtext('POLYGON EMPTY',4327) ));  返回的是POLYGON EMPTY。

         此函数去除M维度,返回值不含M：

                 select st_astext(ST_LineMerge( st_geomfromtext('MULTILINESTRING ZM ((0 0 0 1, 2 0 0 1),(2 0 0 1,0 1 0 1))',4326) ));   LINESTRING Z (0 0 0,2 0 0,0 1 0)

                 select st_astext(ST_LineMerge( st_geomfromtext('MULTILINESTRING M ((0 0 0 , 2 0 0 ),(2 0 0 ,0 1 0 ))',4326) ));     LINESTRING(0 0,2 0,0 1)

Z可以不一样，也会连接。

SELECT ST_AsText(ST_LineMerge('MULTILINESTRING((-29 -27 11,-30 -29.7 10,-36 -31 5,-45 -33 6), (-29 -27 12,-30 -29.7 5), (-45 -33 1,-46 -32 11))'));st_astext--------------------------------------------------------------------------------------------------LINESTRING Z (-30 -29.7 5,-29 -27 11,-30 -29.7 10,-36 -31 5,-45 -33 1,-46 -32 11)    
       不会消除重叠段：select st_astext(ST_LineMerge(st_geomfromtext('MULTILINESTRING((0 0, 2 0), (2 0, 3 0),(0 0, 2 0),(4 4,3 0))', 4326),true));返回的是MULTILINESTRING((0 0,2 0),(0 0,2 0),(2 0,3 0),(4 4,3 0))。

（8）  ST_Split  ：该函数支持按(多)点、(多)线串或(多)多边形边界拆分线串，或按线串拆分(多)多边形。结果几何图形始终是一个集合。（  第二个geom拆分第一个geom。  两个入参的srid必现一致。只要有一个  入参为Null，另外一个geom的7种任意类型，返回都为null。  ）–可推断第一个入参只能是含线、多线、多边形、多多边形，第二个参数不能是集合。

         geometry ST_Split(geometry input, geometry blade);

          第一个参数只要是含了点或多点的集合，报错  。除非仅含线、多线、多边形、多多边形的组合。

          第一个参数是面，第二个参数是点，报错。第一个参数是面，第二个是线，线是面里面的一部分，分割后的是集合，集合里面是geom1。

  


|geom1|geom2|  
|
|:---|:---|:---|
|线串、多线|点、多点、线、多线、多边形，多多边形|  
  16个，正常组合是36,其他都是报错的|
|多边形，多多边形|线、多线||
|集合，仅含线串|  
|  
  集合的不是重点，不发散太多，把支持的测全。|
|集合，仅含多边形、多多边形|  
||


  


     支持的场景的geom1是empty,如LINESTRING EMPTY返回的是GEOMETRYCOLLECTION(LINESTRING EMPTY)

     select ST_Split(st_geomfromtext('MULTILINESTRING M ((0 0 0 , 2 0 0 ),(2 0 0 ,0 1 0 ))',4326) , st_geomfromtext('MULTILINESTRING M ((0 0 0 , 2 0 0 ),(2 0 0 ,0 1 0 ))',4326));    


     select ST_Split(st_geomfromtext('MULTILINESTRING M ((0 0 0 , 2 0 0 ),(3 0 0 ,4 1 0 ))',4326) , st_geomfromtext('MULTILINESTRING M ((0 0 0 , 2 0 0 ),(3 0 0 ,4 1 0 ))',4326))    


     报错：Splitter line has linear intersection with input

    点并不完全在线上，只是离线很近，也会把线进行分割。    
      SELECT ST_AsText(ST_Split(st_geomfromtext('LINESTRING(-1 10,100 10)', 4326),st_geomfromtext('POINT(60 9.99999999999999999999)', 4326) ))from dual;

    M坐标会进行计算：

   SELECT ST_AsText(ST_Split(st_geomfromtext('LINESTRING M(0 0 2,1 0 3,2 4 7, 8 4 8)', 4326),st_geomfromtext('MULTIPOINT(0.5 0, 7 4)', 4326) )) from dual;

（9）ST_Z：Return the Z coordinate of the point, or NULL if not available. Input must be a point.入参是Null返回Null。

         float ST_Z(geometry a_point)

         测试点：  点：point(x,y) -null、point(x,y,z,m) -z、point(x,y,z)-z、 point m(x,y,m)-null  ，yanshan会返回M值  、point zm(x,y,z,m)-z、point empty-null、空-null

                       Z点的坐标:正常值，double边界（返回的是Inf)+nan(返回的是null)等

                       其他的类型，报错。

                       返回值类型是float

参考资料：       [ST_Dump (osgeo.cn)](https://www.osgeo.cn/postgis-manual/ST_Dump.html)    、    [ST_Dump (postgis.net)](https://postgis.net/docs/ST_Dump.html)    、    [ST_ConcaveHull (osgeo.cn)](https://www.osgeo.cn/postgis-manual/ST_ConcaveHull.html)      、    [ST_ConcaveHull (postgis.net)](https://postgis.net/docs/manual-2.0/ST_ConcaveHull.html)    、     [ST_ConvexHull (osgeo.cn)](https://www.osgeo.cn/postgis-manual/ST_ConvexHull.html)    、    [ST_MakeEnvelope (postgis.net)](https://postgis.net/docs/ST_MakeEnvelope.html)    、    [ST_MakeEnvelope (postgis.net)](https://postgis.net/docs/manual-dev/zh_Hans/ST_MakeEnvelope.html)    、    [ST_Multi (osgeo.cn)](https://www.osgeo.cn/postgis-manual/ST_Multi.html)    、    [ST_Multi (postgis.net)](https://postgis.net/docs/ST_Multi.html)    、

  [ST_IsClosed - Amazon Redshift](https://docs.aws.amazon.com/zh_cn/redshift/latest/dg/ST_IsClosed-function.html)      、    [ST_BuildArea (postgis.net)](https://postgis.net/docs/ST_BuildArea.html)      、    [ST_BuildArea (postgis.net)](https://postgis.net/docs/manual-3.5/zh_Hans/ST_BuildArea.html)    、    [#1806 (Extremely slow and CPU-intensive ST_MakeValid (ST_BuildArea) case) – PostGIS (osgeo.org)](https://trac.osgeo.org/postgis/ticket/1806#no1)     、

  [PostGIS--线路合并方法比较 - 简书 (jianshu.com)](https://www.jianshu.com/p/4b9d22406bce)    （应用场景）、    [ST_LineMerge (postgis.net)](https://postgis.net/docs/manual-2.0/ST_LineMerge.html)    、    [PostgreSQL PostGIS连接几何线的函数|极客教程 (geek-docs.com)](https://geek-docs.com/postgresql/postgresql-questions/114_postgresql_postgis_function_to_connect_geometry_line_together.html)     、    [ST_Split (postgis.net)](https://postgis.net/docs/ST_Split.html)     、    [ST_Split (osgeo.cn)](https://www.osgeo.cn/postgis-manual/ST_Split.html)       

  [https://juejin.cn/post/6844904019962363917](https://juejin.cn/post/6844904019962363917)    、       [https://zhuanlan.zhihu.com/p/573926608?utm_id=0](https://zhuanlan.zhihu.com/p/573926608?utm_id=0)        

## 2.2 应用场景

ST_BuildArea的应用场景：

  [https://www.coder.work/article/2635338](https://www.coder.work/article/2635338)            --  可补充2个场景，  跟  ST_Collect结合和加一个面自相交的容错（构造的容错数据，不再报错）

  [https://www.jianshu.com/p/67e474b507a0](https://www.jianshu.com/p/67e474b507a0)  

st_linemerge的应用场景：

  [https://blog.csdn.net/luncky_dog/article/details/125957779](https://blog.csdn.net/luncky_dog/article/details/125957779)    ，结合st_union将表里面的多条线组合成一条线。

  [https://geek-docs.com/postgresql/postgresql-questions/114_postgresql_postgis_function_to_connect_geometry_line_together.html](https://geek-docs.com/postgresql/postgresql-questions/114_postgresql_postgis_function_to_connect_geometry_line_together.html)      跟  ST_MakeLine结合使用

  [http://www.hzhcontrols.com/new-906449.html](http://www.hzhcontrols.com/new-906449.html)  

  


## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


# 3. 详细测试设计

## 3.1 测试设计方法

等价类，边界值，场景分析。

- 入参为geometry类型。可以通过输入函数（st_geomFromText、st_geomFromWKB、st_geomFromEWKB、  ST_GeomFromGeoJson  ）传入,也可以是表中geometry类型的列。
- srid：  使用常用的4326（GEOGRAPHIC2D  大地坐标-经纬度） 、4327（GEOGRAPHIC3D 大地坐标-经纬度）、3857（PROJECTED   投影坐标系  **-**  米  ）  、4479（  GEOCENTRIC  大地坐标，地心参考系-米  ）、5598（COMPOUND）、0等。（    [SRID WKID 空间参考简介_srid和wkid_bigbigtree911的博客-CSDN博客](https://blog.csdn.net/bigbigtreewhu/article/details/52162277?ops_request_misc=%257B%2522request%255Fid%2522%253A%2522168197695316800188553300%2522%252C%2522scm%2522%253A%252220140713.130102334..%2522%257D&request_id=168197695316800188553300&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~sobaiduend~default-1-52162277-null-null.142^v85^insert_down1,239^v2^insert_chatgpt&utm_term=%E5%B8%B8%E7%94%A8%E7%9A%84srid&spm=1018.2226.3001.4187)    ），数据在同一srid，不同srid作为容错。  ST_MakeEnvelope需要关注每类的srid，其他函数跟srid的关系不大  。
- 第一个入参和第二个入参是目前支持的7个子类型中的一个，组合后是49种。（某些函数，某种组合是报错，测试下容错，不重点测试）。
- 超长文本入参（geom）空间关系比较（某个数据存在允许的误差）


仅标记为蓝色部分，需要构造数据或补充数据场景，其他函数可以复用空间函数的数据+rtree的数据，数据含如下特点：（n  ull和空串，含empty、  nan inf -inf、  构造的数据误差范围：  小数点后面15位，  15位内没有差异，16位A比B多或者少，查看结果的正确性。）

函数的测试点本质同内置函数，参考    [*内置函数测试设计checklist - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929071)    的测试点，进行设计。(作为查询条件要着重测试）

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
|性能|是|
|可维护性|否|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[YDBRD-21117.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjRhMWFkOWEzMzExZGM4NGRiIiwicmVmX2lkIjoiNjczOTZiYjQ3MjgyMDZlZmI5MmYwOTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDYyLCJleHAiOjE3ODIzODI4NjJ9.DueaLeAGLZi2njU4oDJMbhOJlqnWtQIUoRyYH6sqdJA)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：  5人天（复用用例）

# 8.待确认问题记录

|  
|序号|现象|用例|确认结果|
|:---|:---|:---|:---|:---|
|已改|1|![](https://pingcode.yasdb.com/atlas/files/public/67396bb5a1ad9a3311dc84e9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20)|drop table if exists tb_YDBRD_21117_rtree_pre_01;    
  CReATE TABLE tb_YDBRD_21117_rtree_pre_01 (col_int int, col_geom geometry);,--POINT    
  insert into tb_YDBRD_21117_rtree_pre_01(col_int,col_geom) values(1, st_geomfromtext('POINT(16 16)', 4326));    
  insert into tb_YDBRD_21117_rtree_pre_01(col_int,col_geom) values(2, st_geomfromtext('POINT ZM(4 4 6 10)', 4326));    
  insert into tb_YDBRD_21117_rtree_pre_01(col_int,col_geom) values(7, st_geomfromtext('POINT EMPTY', 4326));,create table tb_YDBRD_21117_ST_LineMerge_01(col_int int,col_clob clob,col_clob_1 clob);    
  insert into tb_YDBRD_21117_ST_LineMerge_01 select col_int,st_astext(ST_LineMerge( col_geom)),st_astext(ST_LineMerge( col_geom,false)) from tb_YDBRD_21117_rtree_pre_01 where col_int != 2006 order by col_int;    
  SELECT distinct DBMS_LOB.COMPARE(col_clob, col_clob_1) compare_res FROM tb_YDBRD_21117_ST_LineMerge_01;|是问题：,为支持plugin方式的聚集函数，引入了问题|
|已改|2|![](https://pingcode.yasdb.com/atlas/files/public/67396bb58970c2af4f520674/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20)|前置+create or replace procedure proc_gis_psit_06(n1 int) is    
  CURSOR cur1(c1 int) IS    
  SELECT col_int, ST_AsEWKB(ST_GeomFromeWKB(ST_AsEWKB(col_geom))) as col_geom FROM tb_YDBRD_21117_rtree_pre_01 WHERE col_int!=7 order by col_int;    
  CURSOR cur2(c1 int) IS    
  SELECT col_int, ST_AsEWKB(ST_GeomFromeWKB(ST_AsEWKB(col_geom))) as col_geom FROM tb_YDBRD_21117_rtree_pre_01 WHERE col_int<=c1 order by col_int;    
  var_varchar varchar(80) := null;    
  begin    
  for v_sal in cur1(n1) loop    
  for v_sa2 in cur2(n1) loop    
  begin    
  var_varchar := st_astext(ST_Split(ST_GEOMFROMeWKB(v_sal.col_geom), ST_GEOMFROMeWKB(v_sa2.col_geom)),0);    
  dbms_output.put_line('' || v_sal.col_int || ': ' || v_sa2.col_int || var_varchar);    
  exception    
  when others then    
  dbms_output.put_line(v_sal.col_int || ': ' || v_sa2.col_int || ': ' ||sqlerrm);    
  end;    
  end loop;    
  end loop;    
  end;    
  /    
  declare    
  begin    
  proc_gis_psit_06(1000);    
  end;    
  /|是问题,返回结果是linestring empty时，未对坐标串的空指针赋值|
|已改|3|![](https://pingcode.yasdb.com/atlas/files/public/67396bb5a1ad9a3311dc84eb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20)|前置+select t1.col_int, st_astext(t2.geom) from tb_YDBRD_21117_rtree_pre_01 t1, table(st_dump(t1.col_geom)) t2 order by t1.col_int;|是问题,未累计总的path数目，导致后面的path将前面的内存踩掉了|
|已改|4|纯empty的处理存在差异：,yanshan,SQL> select st_astext(ST_BuildArea(st_geomfromtext('MULTILINESTRING EMPTY', 4326))) from dual;,ST_ASTEXT(ST_BUILDAR    
  ----------------------------------------------------------------,  
  1 row fetched.,pg返回的是POLYGON EMPTY。,  
|  
|  
|
|已改|5|特殊数据返回的srid不同：,select st_srid(ST_Split(st_geomfromtext('LINESTRING EMPTY', 4326),st_geomfromtext('LINESTRING EMPTY', 4326)) )from dual;,ST_SRID(ST_SPLIT(ST_    
  --------------------    
  0,1 row fetched.,pg返回的是4326|  
|是问题,用线去切割线的时候没有设置srid|
|测试再分析用例|6--测试自己再理理，开发可先不看，暂时没弄清原因|select poly.COL_INT,    
  st_astext(ST_Split(    
  ST_Multi(    
  ST_Buffer(    
  ST_Intersection(country.col_geom, poly.col_geom),    
  0.0    
  )    
  )    
  ,country.col_geom),0)clipped_geom    
  from tb_YDBRD_21117_rtree_pre_01 country    
  inner join tb_YDBRD_21117_rtree_pre_01 poly on ST_Intersects(country.COL_geom, poly.COL_geom)    
  where ST_IsEmpty(ST_Buffer(ST_Intersection(country.COL_geom, poly.COL_geom), 0.0)) AND poly.COL_INT BETWEEN 401 AND 410 AND country.COL_INT BETWEEN 101 AND 200;,yanshan报错YAS-07202 plugin execution error, splitting polygon by MULTIPOINT is not supported，pg返回GEOMETRYCOLLECTION EMPTY,把语句拆解，我们的返回跟pg是一样的，都是MULTIPOLYGON EMPTY，传入的参数country.col_geom就是多点（非empty的被多点split是不支持的）,select poly.COL_INT,    
  st_astext(    
  ST_Multi(    
  ST_Buffer(    
  ST_Intersection(country.col_geom, poly.col_geom),    
  0.0    
  )    
  )    
  ,0)    
  clipped_geom    
  from tb_YDBRD_21117_rtree_pre_01 country    
  inner join tb_YDBRD_21117_rtree_pre_01 poly on ST_Intersects(country.COL_geom, poly.COL_geom)    
  where ST_IsEmpty(ST_Buffer(ST_Intersection(country.COL_geom, poly.COL_geom), 0.0)) AND poly.COL_INT BETWEEN 401 AND 410 AND country.COL_INT BETWEEN 101 AND 200;,--yanshan跟pg都是支持,select st_astext(ST_Split(st_geomfromtext('MULTIPOLYGON empty', 4326),st_geomfromtext('MULTIPOINT(80 80, -15 -15)', 4326))) from dual;|  
|  
|
|非问题|7，忽略，可能是同时操作出的问题|理论是要支持的,select ST_AsText(ST_Split(st_geomfromtext('POLYGON((0 0,0.5 0,0.5 0.5,0 1,0 0))', 4326),st_geomfromtext('MULTILINESTRING((0 0, 2 0), (1 1, 2 2), (100 90, 180 90))', 4326) )) from dual;,yanshan报错：YAS-07202 plugin execution error, splitting polygon by MULTIPOINT is not supported,pg成功返回GEOMETRYCOLLECTION(POLYGON((0.5 0,0 0,0 1,0.5 0.5,0.5 0)))|  
|  
|
|已改|8|![](https://pingcode.yasdb.com/atlas/files/public/67396bb58970c2af4f520676/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20)|CREATE OR REPLACE PROCEDURE proc_YDBRD_21117_ST_Split_10() IS    
  TYPE rec_type is RECORD (V_COL_GEOM geometry := st_geomfromtext('POINT(0 0 1)'));    
  va_rec rec_type;    
  v_char char(8000);    
  str1_sql VARCHAR(300) := 'select ST_Split( st_geomfromtext(''POLYGON ((0 0,100 0,100 90,0 89,0 0),(10 10,20 10,20 20,10 20,10 10),(50 50,60 50,60 70,50 80,50 50))'', 4326),col_geom ) from tb_YDBRD_21117_rtree_pre_01 where col_int = 2006';    
  BEGIN    
  EXECUTE IMMEDIATE str1_sql INTO va_rec ;    
  v_char := st_astext(ST_GeomFromWKB( st_asbinary(va_rec.V_COL_GEOM) ));    
  DBMS_OUTPUT.PUT_LINE('区域号码:'|| trim(v_char));    
  END;    
  /    
  call proc_YDBRD_21117_ST_Split_10();|是问题,如果坐标中有nan，GEOS可能会core|
|已改|9|SQL> select ST_Astext(ST_Split(st_geomfromtext('POLYGON((0 0,0.5 0,0.5 0.5,0 1,0 0))', 4326),st_geomfromtext('LINESTRING(-1 0.789 4 10, 100 101.789 5 10)', 4326)),0)from dual;,YAS-07202 plugin execution error, IllegalArgumentException: Points of LinearRing do not form a closed linestring,pg返回的是GEOMETRYCOLLECTION(POLYGON((0 0,0 1,0 0,0 0,0 0)))|  
|  
|
|已改|10|yasdb: /home/zpf/anchorbase/src/storage/dictionary/dict_cache/dc_type.c:820: ankCloseUdtDict: Assertion `udtDict->refCount > 0' failed.,gdb yasdb core-WORKER-31502-1699605858,![](https://pingcode.yasdb.com/atlas/files/public/67396bb5a1ad9a3311dc84ee/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20),  
,  
|drop table if exists tb_YDBRD_21117_ST_Dump_05;    
  drop type if exists tY_YDBRD_21117_ST_Dump_05_last;    
  drop type if exists tY_YDBRD_21117_ST_Dump_05_obj force;    
  drop type if exists tY_YDBRD_21117_ST_Dump_05_INT;    
  create or replace type tY_YDBRD_21117_ST_Dump_05_INT is varray(100) of int;    
  /,create or replace TYPE tY_YDBRD_21117_ST_Dump_05_obj AS OBJECT (k2 tY_YDBRD_21117_ST_Dump_05_INT,k1 geometry);    
  /,create or replace type tY_YDBRD_21117_ST_Dump_05_last is varray(10) of tY_YDBRD_21117_ST_Dump_05_obj;    
  /,--函数返回值作为表种某列    
  CReATE TABLE tb_YDBRD_21117_ST_Dump_05 (col_int int, col_dump tY_YDBRD_21117_ST_Dump_05_last);,--返回值给plsql里面的对用类型变量    
  create or replace procedure proc_YDBRD_21117_ST_Dump_05(n1 int) is    
  rec_type tY_YDBRD_21117_ST_Dump_05_obj;    
  v_sql char(200);    
  v_int int;    
  v_loop int;    
  type cur_type is REF CURSOR;    
  cur_var1 cur_type;    
  begin    
  v_sql := 'SELECT ST_Dump(col_geom) as col_geom FROM tb_YDBRD_21117_rtree_pre_01 WHERE col_int<=:1 order by col_int';    
  v_int := n1;    
  v_loop := 1;    
  open cur_var1    
  for v_sql using v_int;    
  loop    
  fetch cur_var1 into rec_type;    
  DBMS_OUTPUT.PUT_LINE (rec_type.k2(v_loop));    
  DBMS_OUTPUT.PUT_LINE (ST_AsText(rec_type.k1));    
  v_loop := v_loop +1;    
  exit when cur_var1%notfound;    
  end loop;    
  close cur_var1;    
  end;    
  /,declare    
  begin    
  proc_YDBRD_21117_ST_Dump_05(1000);    
  end;    
  /|  
|
|已改|11|![](https://pingcode.yasdb.com/atlas/files/public/67396bb5a1ad9a3311dc84ef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20)|drop table if exists tb_YDBRD_21117_ST_Dump_07;    
  CReATE TABLE tb_YDBRD_21117_ST_Dump_07 (col_int int, col_geom geometry);,create or replace procedure proc_YDBRD_22074_rtree_pre(n1 int) is    
      CURSOR cur1(c1 int) IS    
      SELECT col_int, ST_AsEWKB(col_geom) as col_geom FROM tb_YDBRD_21117_rtree_pre_01 WHERE col_int<=c1 order by col_int;    
  begin    
      for v_sal in cur1(n1) loop    
          begin    
  insert into tb_YDBRD_21117_ST_Dump_07 values(v_sal.col_int,ST_GeomFromeWKB(v_sal.col_geom));    
          exception    
              when others then    
                  dbms_output.put_line(v_sal.col_int || ': ' ||sqlerrm);    
          end;    
      end loop;    
      COMMIT;    
  end;    
  /,declare    
  begin    
  proc_YDBRD_22074_rtree_pre(20);    
  end;    
  /    
  insert into tb_YDBRD_21117_ST_Dump_07 values(2001,null);    
  create view view_YDBRD_21117_rtree_pre_07 as select * from tb_YDBRD_21117_rtree_pre_01 with read only;    
  commit;    
  CREATE RTREE INDEX index_YDBRD_21117_ST_Dump_07_target on tb_YDBRD_21117_ST_Dump_07(col_geom);,--作为select的投影列返回、作为where条件    
  select   count(a.col_int), count(b.col_int) ,count(ST_Dump(a.col_geom) ) from view_YDBRD_21117_rtree_pre_07 a, tb_YDBRD_21117_ST_Dump_07 b where st_contains(a.col_geom,b.col_geom);,  
|  
|
|已改|12|SQL> select a.col_int, st_astext(a.col_geom,0) from view_YDBRD_21117_rtree_pre_07 a where ST_Dump(a.col_geom) IS NOT NULL;    
  yasdb: /home/zpf/anchorbase/src/infra/memory/ani_memory.c:865: mheapSetBmp: Assertion `!((bitmap)[(bitOff) >> 3] & (1 << ((bitOff)&0x07)))' failed.,YAS-00406 connection is closed,gdb yasdb core-WORKER-14164-1699607323,![](https://pingcode.yasdb.com/atlas/files/public/67396bb58970c2af4f520679/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20),  
,  
|drop table if exists tb_YDBRD_21117_ST_Dump_07;    
  CReATE TABLE tb_YDBRD_21117_ST_Dump_07 (col_int int, col_geom geometry);,create or replace procedure proc_YDBRD_22074_rtree_pre(n1 int) is    
      CURSOR cur1(c1 int) IS    
      SELECT col_int, ST_AsEWKB(col_geom) as col_geom FROM tb_YDBRD_21117_rtree_pre_01 WHERE col_int<=c1 order by col_int;    
  begin    
      for v_sal in cur1(n1) loop    
          begin    
  insert into tb_YDBRD_21117_ST_Dump_07 values(v_sal.col_int,ST_GeomFromeWKB(v_sal.col_geom));    
          exception    
              when others then    
                  dbms_output.put_line(v_sal.col_int || ': ' ||sqlerrm);    
          end;    
      end loop;    
      COMMIT;    
  end;    
  /,declare    
  begin    
  proc_YDBRD_22074_rtree_pre(20);    
  end;    
  /    
  insert into tb_YDBRD_21117_ST_Dump_07 values(2001,null);    
  create view view_YDBRD_21117_rtree_pre_07 as select * from tb_YDBRD_21117_rtree_pre_01 with read only;    
  commit;    
  CREATE RTREE INDEX index_YDBRD_21117_ST_Dump_07_target on tb_YDBRD_21117_ST_Dump_07(col_geom);,  
,--作为where条件    
  select a.col_int, st_astext(a.col_geom,0) from view_YDBRD_21117_rtree_pre_07 a where ST_Dump(a.col_geom) IS NOT NULL;|  
|
|已改|13|gdb yasdb core-WORKER-24600-1699607569,![](https://pingcode.yasdb.com/atlas/files/public/67396bb58970c2af4f52067a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20),  
|select a.col_int from view_YDBRD_21117_rtree_pre_07 a where exists (select ST_Dump(a.col_geom) from view_YDBRD_21117_rtree_pre_07 b where b.col_int between 100 and 200) and a.col_int between 101 and 200 order by a.col_int;|  
|
|已改|14|线跟线/多线的，都没有包一层集合,SQL> select st_astext(st_split(st_geomfromtext('LINESTRING(-1 10, 100 10)', 4326),st_geomfromtext('LINESTRING M(1 2 3,2.98656565 3.9 4, 6 7 8)', 4326)),0) from dual;,ST_ASTEXT(ST_SPLIT(S    
  ----------------------------------------------------------------    
  LINESTRING (-1 10, 100 10),1 row fetched.,pg返回的是GEOMETRYCOLLECTION(LINESTRING(-1 10,100 10)),  
,--最新包解决包了一层后，会多,SQL> select st_astext(st_split(st_geomfromtext('LINESTRING(-1 0.789 4 10, 100 101.789 5 10)', 4326),st_geomfromtext('MULTILINESTRING((1.89956565 50.5454544, -100 90),(1.45678 1, 100 20), (2 3.789 ,100.657675688 90))', 4326))) from dual;,ST_ASTEXT(ST_SPLIT(S    
  ----------------------------------------------------------------    
  GEOMETRYCOLLECTION Z (GEOMETRYCOLLECTION Z (LINESTRING Z (-1.000000000000000 0.789000000000000 4.000000000000000, 2.000000000000014 3.789000000000016 4.029702970297030), LINESTRING Z (2.000000000000014 3.789000000000016 4.029702970297030, 100.000000000000000 101.789000000000001 5.000000000000000))),1 row fetched.,pg是GEOMETRYCOLLECTION Z (LINESTRING Z (-1 0.789 4,2.000000000000014 3.789000000000016 4.02970297029703),LINESTRING Z (2.000000000000014 3.789000000000016 4.02970297029703,100 101.789 5))|  
|  
|
|开发再确认，已修改，跟pg一致|15|多线的结果差异有点大,select st_astext(st_split(st_geomfromtext('MULTILINESTRING ZM ((100 0 0 0, 200 0 0 0), (200 0 0 0,200 200 0 0, 100 200 0 0),(100 200 0 0,100 0 0 0),(150 10 0 0,280 10 0 0,280 170 0 0,150 170 0 0,150 10 0 0))', 4326),st_geomfromtext('MULTIPOINT(80 80, -15 -15)', 4326) ),0) from dual;    
  yanshan：    
  GEOMETRYCOLLECTION (    
  LINESTRING (100 0, 0 200),    
  LINESTRING (200 0, 0 200, 200 0),    
  LINESTRING (100 200, 0 100),    
  LINESTRING (150 10, 0 280, 10 0, 280 170, 0 150))    
  pg:    
  GEOMETRYCOLLECTION (LINESTRING (100 0 ,200 0 ),    
  LINESTRING (200 0 ,200 200 ,100 200 ),    
  LINESTRING (100 200 ,100 0 ),    
  LINESTRING (150 10 ,280 10 ,280 170 ,150 170 ,150 10 ))|  
|  
|
|后面上车改,1.   [YDBRD-25758](https://jira.yasdb.com/browse/YDBRD-25758)  
|16|select a.col_int from tb_YDBRD_21117_rtree_pre_01 a where exists (select ST_Dump(a.col_geom) from tb_YDBRD_21117_rtree_pre_01 b ) order by a.col_int;,我们会多7 、112、 205 、305、 405、605、2009、10004几个数据。,7, st_geomfromtext('POINT EMPTY', 4326),112, st_geomfromtext('MULTIPOINT EMPTY', 4326),205, st_geomfromtext('LINESTRING EMPTY', 4326),305, st_geomfromtext('MULTILINESTRING EMPTY', 4326),405, st_geomfromtext('POLYGON EMPTY', 4326),605, st_geomfromtext('GEOMETRYCOLLECTION EMPTY', 4326),2009, st_geomfromtext('LINESTRING(5 5, inf -inf)', 4326),10004, null,pg从表里面处理null或纯empty的数据，是不处理，直接返回，不会返回null，这块看是否要保持差异。,纯empty也不全部处理成返回的是null，只有几个。,SQL> select a.col_int, st_astext(a.col_geom,0) from tb_YDBRD_21117_rtree_pre_01 a where ST_Dump(a.col_geom) IS NULL;,COL_INT ST_ASTEXT(A.COL_GEOM    
  ------------ ----------------------------------------------------------------    
  112 MULTIPOINT EMPTY    
  305 MULTILINESTRING EMPTY    
  605 GEOMETRYCOLLECTION EMPTY    
  10004,4 rows fetched.,SQL>,select a.col_int, st_astext(a.col_geom,0) from tb_YDBRD_21117_rtree_pre_01 a where a.col_int in(7,112,205,305,405,605,2009,10004);,COL_INT ST_ASTEXT(A.COL_GEOM    
  ------------ ----------------------------------------------------------------    
  7 POINT EMPTY    
  112 MULTIPOINT EMPTY    
  205 LINESTRING EMPTY    
  305 MULTILINESTRING EMPTY    
  605 GEOMETRYCOLLECTION EMPTY    
  10004    
  405 POLYGON EMPTY,7 rows fetched.|  
|影响不大，但修改量大，上车时修改|
|非问题|17，需要请教|本身无法拆解的不会返回，数据会返回空的，我们不返回数据，pg会返回。--这2个语句并不等价，我们对于无法拆解的对应的语句应该是什么(我们应是数组返回空，所以无这种数据),select t3.col_int, t4.column_value, t3.geom from (select t1.col_int col_int, t2.path path , st_astext(t2.geom) geom from tb_YDBRD_21117_rtree_pre_01 t1, table(st_dump(t1.col_geom)) t2) t3, table(t3.path) t4 where t3.col_int < 10 order by t3.col_int,t4.column_value;,COL_INT COLUMN_VALUE GEOM    
  ------------ ------------ ----------------------------------------------------------------,0 rows fetched.,pg的语句：,select col_int,(ST_Dump(col_geom)).path,st_astext( (ST_Dump(col_geom)).geom ) from tb_YDBRD_21117_rtree_pre_01 where col_int < 10 order by col_int;,返回的是,![](https://pingcode.yasdb.com/atlas/files/public/67396bb68970c2af4f52067b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20)|  
|非问题，无法拆分的geometry，st_dump出的结果，path是一个长度为0的数组，但不是null，改写后的语句会遍历path中的元素，所以会返回0行|
|已改|18|拆分出来的geom的srid信息丢失,select col_int, st_srid(t1.col_geom),st_srid(t2.geom) from tb_YDBRD_21117_rtree_pre_01 t1, table(st_dump(t1.col_geom)) t2 where t1.col_int=102;,![](https://pingcode.yasdb.com/atlas/files/public/67396bb6a1ad9a3311dc84f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20),select col_int,(ST_Dump(col_geom)).path,st_srid( (ST_Dump(col_geom)).geom ) from tb_YDBRD_21117_rtree_pre_01 where col_int = 102;,![](https://pingcode.yasdb.com/atlas/files/public/67396bb6a1ad9a3311dc84f1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20)|  
|已修改|
|非问题|19--非问题|ST_Z的视图里面本身都已经是点,DROP VIEW view_YDBRD_21117_rtree_pre_07;    
  create view view_YDBRD_21117_rtree_pre_07 as select * from tb_YDBRD_21117_rtree_pre_01 WHERE GEOMETRYTYPE(col_geom)='POINT';    
  SELECT ST_ASTEXT(COL_GEOM) FROM view_YDBRD_21117_rtree_pre_07;    
  select a.col_int from view_YDBRD_21117_rtree_pre_07 a where ST_Z(a.col_geom) in (select ST_Z(b.col_geom)from view_YDBRD_21117_rtree_pre_07 b ) order by a.col_int;,PG可以返回2，yanshan报错YAS-07202 plugin execution error, argument must have type POINT,视图里面的数据如下：,![](https://pingcode.yasdb.com/atlas/files/public/67396bb6a1ad9a3311dc84f2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20),![](https://pingcode.yasdb.com/atlas/files/public/67396bb6a1ad9a3311dc84f3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20),备注：23.1的ST_X也存在这个报错|  
|取决于先执行哪个filter，跟ST_Z本身没有关系（视图里的条件和视图外面的条件，哪个先执行是不确定的）|
|已改|20|drop table if exists tb_YDBRD_21117_ST_Z_07_2;    
  drop table if exists tb_YDBRD_21117_ST_Z_07;    
  CReATE TABLE tb_YDBRD_21117_ST_Z_07 (col_int int, col_geom geometry);    
  CReATE TABLE tb_YDBRD_21117_ST_Z_07_2 (col_int int, col_geom geometry);    
  insert into tb_YDBRD_21117_ST_Z_07(col_int,col_geom) values(1, st_geomfromtext('POINT(16 16)', 4326));    
  insert into tb_YDBRD_21117_ST_Z_07(col_int,col_geom) values(2, st_geomfromtext('POINT ZM(4 4 6 10)', 4326));    
  insert into tb_YDBRD_21117_ST_Z_07(col_int,col_geom) values(7, st_geomfromtext('POINT EMPTY', 4326));    
  insert into tb_YDBRD_21117_ST_Z_07 values(2001,null);    
  insert into tb_YDBRD_21117_ST_Z_07_2(col_int,col_geom) values(1, st_geomfromtext('POINT(16 16)', 4326));    
  insert into tb_YDBRD_21117_ST_Z_07_2(col_int,col_geom) values(2, st_geomfromtext('POINT ZM(4 4 6 10)', 4326));    
  insert into tb_YDBRD_21117_ST_Z_07_2(col_int,col_geom) values(7, st_geomfromtext('POINT EMPTY', 4326));    
  insert into tb_YDBRD_21117_ST_Z_07_2 values(2001,null);    
  CREATE RTREE INDEX index_YDBRD_21117_ST_Z_07 on tb_YDBRD_21117_ST_Z_07(col_geom);    
  CREATE RTREE INDEX index_YDBRD_21117_ST_Z_07_2 on tb_YDBRD_21117_ST_Z_07_2(col_geom);,select a.col_int from tb_YDBRD_21117_ST_Z_07_2 a where ST_Z(a.col_geom) >= some (select ST_Z(b.col_geom) from tb_YDBRD_21117_ST_Z_07_2 b )order by a.col_int;,pg返回的是2,  
,备注：23.1的ST_X不存在这个问题|  
|  
|
|  
|21|这个是否就是保持差异，本身用户不太用。,select ST_Z(st_geomfromtext('POINT(1 2 NAN)',4326))  我们返回null，pg返回得是nan。,  
|  
|  
|
|后续有方案后，主干上面修改,1.   [YDBRD-25686](https://jira.yasdb.com/browse/YDBRD-25686)  
|22|SQL> select st_astext(st_split(st_geomfromtext('LINESTRING(-1 10, 100 10)', 4326),st_geomfromtext('POINT EMPTY', 4326))) from dual;,YAS-07202 plugin execution error, input or blade geometry has inf or nan coordinate, splitting is not allowed,pg返回GEOMETRYCOLLECTION(LINESTRING(-1 10,100 10))，之前的版本也是返回GEOMETRYCOLLECTION (LINESTRING (-1 10, 100 10)),  
,select st_astext(st_split(st_geomfromtext('LINESTRING(-1 10, 100 10)', 4326),st_geomfromtext('MULTIPOINT((-15 -15), (5 5), EMPTY)', 4326))) from dual;|  
|  
|
|非问题|23,以前的函数也这样|报错不应该是BLOB类型,SQL> select a.col_int from tb_YDBRD_21117_rtree_pre_01 a where ST_Dump(a.col_geom) > some(select ST_Dump(b.col_geom) from tb_YDBRD_21117_rtree_pre_01 b where b.col_int between 100 and 300) and a.col_int between 101 and 200 order by a.col_int;,[1:87]YAS-04401 data type - expected, but UDT_TABLE got,SQL> select a.col_int from tb_YDBRD_21117_rtree_pre_01 a where ST_Dump(a.col_geom) !=all (select ST_Dump(b.col_geom) from tb_YDBRD_21117_rtree_pre_01 b where b.col_int between 100 and 300) and a.col_int between 101 and 200 order by a.col_int;,YAS-00009 invalid comparison between BLOB and BLOB|  
|  
|
|已改|24|作为plsql返回值会报错，单独查询不会报错，上个版本的psql也不报错,create or replace function func_YDBRD_21117_ST_Split_10(a geometry) return geometry is    
  names geometry := st_geomfromtext('POINT(0 0 1)');    
  BEGIN    
  null;    
  names := a;    
  return names;    
  END func_YDBRD_21117_ST_Split_10;,/    
  9    
  Succeed.,SQL>    
  SQL> SELECT st_astext(func_YDBRD_21117_ST_Split_10(ST_Split(col_geom,st_geomfromtext('LINESTRING(-1 10, 100 10)', 4326))),0) from tb_YDBRD_21117_rtree_pre_01 where col_int = 1001;,YAS-07202 plugin execution error,,SQL> SELECT length(st_astext(ST_Split(col_geom,st_geomfromtext('LINESTRING(-1 10, 100 10)', 4326))) ) from tb_YDBRD_21117_rtree_pre_01 where col_int = 1001;,LENGTH(ST_ASTEXT(ST_    
  ---------------------    
  332935,1 row fetched.|  
|  
|
|  
|25|![](https://pingcode.yasdb.com/atlas/files/public/67396bb68970c2af4f52067c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20),SQL> select st_astext(ST_ConcaveHull(st_geomfromtext('MULTIPOINT EMPTY', 4326),0.2)) from dual;,YAS-07202 plugin execution error, ParseException: Unknown WKB type 0|  
  SELECT col_int, ST_ASTEXT(ST_ConcaveHull(col_geom,0.2))as col_geom FROM tb_YDBRD_21117_rtree_pre_01 WHERE col_int =507 order by col_int; 507这行数据造成的,  
  insert into tb_YDBRD_21117_rtree_pre_01(col_int,col_geom) values(507, st_geomfromtext('MULTIPOLYGON (((0 0, 0 10, 10 10, 10 0, 0 0), (2 2, 2 8, 8 8, 8 2, 2 2)), ((15 15,15 20,20 20,20 15,15 15)), ((1 1, 9 1, 9 9, 1 9, 1 1)),empty)', 4326));,  
|  
|
|数据库参数配置后，还是报错，待请教|26,DATA_BUFFER_SIZE=4G    
  VM_BUFFER_SIZE=2G    
  share_pool_size=4G    
  WORK_AREA_HEAP_SIZE=4194304    
  WORK_AREA_POOL_SIZE=6G    
  WORK_AREA_STACK_SIZE = 67108864    
  THREAD_STACK_SIZE =67108864|![](https://pingcode.yasdb.com/atlas/files/public/67396bb6a1ad9a3311dc84f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20),select t3.OGR_FID,t4.column_value, t3.geom from (select t1.OGR_FID OGR_FID , t2.path path , st_astext(t2.geom,0) geom from GIS_OSM_ROADS_FREE_1 t1, table(st_dump(t1.YAS_GEOMETRY)) t2) t3, table(t3.path) t4 order by t3.OGR_FID,t4.column_value;|  
|  
|
|  
|27|point m(x,y,m)-null  ，st_z, yanshan会返回M值，pg返回的是Null，看是否要写进资料,  
|  
|  
|
|  
|28|yanshan处理后，会保留M，pg不会保留M,select ST_AsText(ST_Split(st_geomfromtext('POLYGON M ((0 0 0,10000 0 0,200000 10000000 0,500000 10000000 0,0 0 0),(-1 0 0,-10 0 0,-10 4 0,1 -10 0,-1 0 0))'),st_geomfromtext('MULTILINESTRING((0 0, 2 0), (1 1, 2 2), EMPTY)')),0) from dual;,返回的是GEOMETRYCOLLECTION Z (POLYGON Z ((2 0 0, 0 0 0, 16129 322581 0, 10000 0 0, 2 0 0)), POLYGON Z ((16129 322581 0, 200000 10000000 0, 500000 10000000 0, 16129 322581 0))),pg返回的是：GEOMETRYCOLLECTION(POLYGON((2 0,0 0,16129 322581,10000 0,2 0)),POLYGON((16129 322581,200000 10000000,500000 10000000,16129 322581)))|  
|  
|
|  
|29资料与实测不符合：当输入对象为空几何对象（如LineString Empty），返回TRUE|SQL> select ST_IsClosed(st_geomfromtext('LINESTRING EMPTY', 4326)) from dual;,ST_ISCLOSED(ST_GEOMF    
  --------------------    
  false,1 row fetched.|  
|  
|
|  
|30，主干问题，已提单|![](https://pingcode.yasdb.com/atlas/files/public/67396bb68970c2af4f52067f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNJQUFBZ0FBQUFBQUJBSWdFUVJRQWdLQUFBRUFBZ0FJQUFJQUFBQUVnQUFBQUJDQUFnVWtBQUFBQUFnQUFBUUFBWWdBQVVBRUFBQUFnQUFBQUJRQUFBQUFBQUFCQWNBQUFDQkFBSUlBRUFBQUNFUUFBUUFDd0FBQUJBWUJBQUFBRWdBQUFCQUFBQUNnQUFnSUFBZ0FBQUlBQkFBQ0tnQUFBQUFGQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0NjIsImV4cCI6MTc4MjMwNzI2Mn0.Q0YglguLtN4JUGf8WUnegF6HsKU1ArRO48mwzb64F20)|core-WORKER-21971-1700531104,drop table if exists tb_YDBRD_21117_ST_Dump_14;    
  CReATE TABLE tb_YDBRD_21117_ST_Dump_14 (col_int int, col_geom st_geometry, col_geom_2 geometry);,insert into tb_YDBRD_21117_ST_Dump_14 values(1, st_geomfromtext('POLYGON((0 0,80 0,80 80,0 80,0 0))'),st_geomfromtext('POLYGON((100 200,100 140,180 140,180 200,100 200))'));    
  insert into tb_YDBRD_21117_ST_Dump_14 values(2, st_geomfromtext('POLYGON((0 0,140 0,140 140,0 140,0 0))'),st_geomfromtext('POLYGON((140 0,0 0,0 140,140 140,140 0))'));    
  insert into tb_YDBRD_21117_ST_Dump_14 values(3, st_geomfromtext('POLYGON((40 60,360 60,360 300,40 300,40 60))'),st_geomfromtext('POLYGON((120 100,280 100,280 240,120 240,120 100))'));,declare    
  begin    
  for i in 3..4096 loop    
  EXECUTE IMMEDIATE 'alter table tb_YDBRD_21117_ST_Dump_14 add column col_geom_' || i || ' geometry';    
  end loop;    
  commit;    
  end;    
  /    
  --查询语句会CORE：    
  select t3.col_int, t4.column_value, t3.geom,t3.geom_2 from (select t1.col_int col_int, t2.path path , st_astext(t2.geom,0) geom,st_astext(t4.geom,0) geom_2 from tb_YDBRD_21117_ST_Dump_14 t1, table(st_dump(t1.col_geom)) t2,table(st_dump(t1.col_geom_2)) t4,table(st_dump(t1.col_geom_3)) t5,table(st_dump(t1.col_geom_4)) t6,table(st_dump(t1.col_geom_5)) t7,table(st_dump(t1.col_geom_6)) t8,table(st_dump(t1.col_geom_7)) t9,table(st_dump(t1.col_geom_8)) t10) t3, table(t3.path) t4 order by t3.col_int,t4.column_value;|  
|
|跟开发确认，保持差异|31|yanshan返回false,select ST_IsClosed(st_geomfromtext('LINESTRING M(0 0 8,8 0 9,4 4 9,0 8 5,8 8 7, 4 4 9,0 0 6)', 4326)) from dual;,pg返回true,pg不处理M坐标，我们应该是把M当作Z，然后这个函数是要求Z坐标也要一样的,  
|  
|  
|
|  
|32|是否保持差异，看着没什么影响,select ST_AsText(ST_ConcaveHull(st_geomfromtext('linestring(0 0 -1.79769313486232E308, 4 0 0, 4 4 0, 0 4 0, 0 0 1)'),0.88,true),0) from dual;,yanshan返回POLYGON Z ((0 0 -inf, 0 4 0, 4 4 0, 4 0 0, 0 0 -inf)),pg返回POLYGON((0 0,0 4,4 4,4 0,0 0))|  
|  
|
|不影响，都是报错，不更改|33|SELECT col_int, ST_AsText(ST_ConcaveHull(col_geom_2,0.4,true),0)from tb_YDBRD_21117_ST_ConcaveHull_14 where col_int = 257;    
  SELECT col_int, ST_AsText(ST_ConcaveHull(col_geom_2,0.4,true),0)from tb_YDBRD_21117_ST_ConcaveHull_14 where col_int = 219;    
  SELECT col_int, ST_AsText(ST_ConcaveHull(col_geom_2,0.4,true),0)from tb_YDBRD_21117_ST_ConcaveHull_14 where col_int = 81;    
  SELECT col_int, ST_AsText(ST_ConcaveHull(col_geom_2,0.4,true),0)from tb_YDBRD_21117_ST_ConcaveHull_14 where col_int = 27;    
  SELECT col_int, ST_AsText(ST_ConcaveHull(col_geom_2,0.4,true),0)from tb_YDBRD_21117_ST_ConcaveHull_14 where col_int = 23;    
  SELECT col_int, ST_AsText(ST_ConcaveHull(col_geom_2,0.4,true),0)from tb_YDBRD_21117_ST_ConcaveHull_14 where col_int = 16;,这几条语句，我们都是报错YAS-07202 plugin execution error, IllegalStateException: Unable to find a convex corner，pg会有两种，一种跟yanshan一样，一种类似  lwgeom_concavehull: GEOS Error: TopologyException: side location conflict at 140 100. This can occur if the input geometry is invalid.|drop table if exists tb_YDBRD_21117_ST_ConcaveHull_14;    
  CReATE TABLE tb_YDBRD_21117_ST_ConcaveHull_14 (col_int int, col_geom st_geometry, col_geom_2 geometry);,insert into tb_YDBRD_21117_ST_ConcaveHull_14 values(16, st_geomfromtext('LINESTRING(70 50,70 150)'),st_geomfromtext('MULTIPOLYGON(((0 0,0 100,140 100,140 0,0 0)),((20 170,70 100,130 170,20 170)))'));,insert into tb_YDBRD_21117_ST_ConcaveHull_14 values(23, st_geomfromtext('LINESTRING(100 140,100 40)'),st_geomfromtext('MULTIPOLYGON(((20 80,180 80,100 0,20 80)),((20 160,180 160,100 80,20 160)))'));,insert into tb_YDBRD_21117_ST_ConcaveHull_14 values(27, st_geomfromtext('LINESTRING(40 180,140 180)'),st_geomfromtext('MULTIPOLYGON(((20 320,180 320,180 180,20 180,20 320)),((60 180,60 80,180 80,180 180,60 180)))'));,insert into tb_YDBRD_21117_ST_ConcaveHull_14 values(81, st_geomfromtext('POLYGON((110 140,200 70,200 160,110 140))'),st_geomfromtext('POLYGON((110 140,110 50,60 50,60 90,160 190,20 110,20 20,200 20,110 140))'));,insert into tb_YDBRD_21117_ST_ConcaveHull_14 values(219, st_geomfromtext('LINESTRING(70 50,70 150)'),st_geomfromtext('MULTIPOLYGON(((0 0,0 100,140 100,140 0,0 0)),((20 170,70 100,130 170,20 170)))'));,insert into tb_YDBRD_21117_ST_ConcaveHull_14 values(257, st_geomfromtext('LINESTRING(40 180,140 180)'),st_geomfromtext('MULTIPOLYGON(((20 320,180 320,180 180,20 180,20 320)),((60 180,60 80,180 80,180 180,60 180)))'));|  
|
|pg也变化|34 ST_ConcaveHull|的面的结果，无法稳定(同样的版本，面里面点的顺序不稳定，这种是保持差异么，把这种会造成的差异数据过滤掉）|  
|  
|
|1.   [YDBRD-25756](https://jira.yasdb.com/browse/YDBRD-25756)  
|35|SELECT ST_AsText(ST_Split(st_geomfromtext('LINESTRING(-1 10, 60 10,100 10)', 4326),st_geomfromtext('POINT(60 9.99999999999999999999)', 4326) )) from dual;,GEOMETRYCOLLECTION (LINESTRING (-1.000000000000000 10.000000000000000, 60.000000000000000 10.000000000000000), LINESTRING (60.000000000000000 10.000000000000000, 60.000000000000000 10.000000000000000, 100.000000000000000 10.000000000000000)),pg返回的是GEOMETRYCOLLECTION(LINESTRING(-1 10,60 10),LINESTRING(60 10,100 10)),我们不会把重复点去掉。|  
|  
|
|  
|36  使用含cte会报错[1:214]YAS-04121 invalid datatype，查询含数据，依赖此查询创建的视图，去查询视图，视图无数据|drop table if exists tb_YDBRD_21117_ST_Dump_01;    
  create table tb_YDBRD_21117_ST_Dump_01(col_int int, col_geom geometry);    
  insert into tb_YDBRD_21117_ST_Dump_01(col_int,col_geom) values(301, st_geomfromtext('MULTILINESTRING((0 0, 2 0), (1 1, 2 2), (100 90, 180 90))', 4326));    
  insert into tb_YDBRD_21117_ST_Dump_01(col_int,col_geom) values(302, st_geomfromtext('MULTILINESTRING((1.89956565 50.5454544, -100 90),(1.45678 1, 100 20), (2 3.789 ,100.657675688 90))', 4326));,WITH q_area (ano,dd ,aname) as (select t3.col_int ano, t4.column_value b , to_char(t3.geom) aname from (select t1.col_int col_int, t2.path path , st_astext(t2.geom,0) geom from tb_YDBRD_21117_ST_Dump_01 t1, table(st_dump(t1.col_geom)) t2) t3, table(t3.path) t4 where t3.col_int not in (1001,1002) order by t3.col_int,t4.column_value)    
  select bno,bname,aname FROM (    
  SELECT a.col_int bno,to_char(ST_Astext(a.col_geom,0)) bname,b.aname aname FROM tb_YDBRD_21117_ST_Dump_01 a,q_area b WHERE a.col_int=b.ano    
  UNION    
  SELECT a.col_int bno,to_char(ST_Astext(a.col_geom,0)) bname,b.aname aname FROM tb_YDBRD_21117_ST_Dump_01 a,q_area b WHERE a.col_int=b.ano    
  )order by bno,bname,aname limit 25;    
  --跟cte的语句等价    
  select bno,bname,aname FROM (    
  SELECT a.col_int bno,to_char(ST_Astext(a.col_geom,0)) bname,b.aname aname FROM tb_YDBRD_21117_ST_Dump_01 a,(select t3.col_int ano, t4.column_value b , to_char(t3.geom) aname from (select t1.col_int col_int, t2.path path , st_astext(t2.geom,0) geom from tb_YDBRD_21117_ST_Dump_01 t1, table(st_dump(t1.col_geom)) t2) t3, table(t3.path) t4 where t3.col_int not in (1001,1002) order by t3.col_int,t4.column_value) b WHERE a.col_int=b.ano    
  UNION    
  SELECT a.col_int bno,to_char(ST_Astext(a.col_geom,0)) bname,b.aname aname FROM tb_YDBRD_21117_ST_Dump_01 a,(select t3.col_int ano, t4.column_value b , to_char(t3.geom) aname from (select t1.col_int col_int, t2.path path , st_astext(t2.geom,0) geom from tb_YDBRD_21117_ST_Dump_01 t1, table(st_dump(t1.col_geom)) t2) t3, table(t3.path) t4 where t3.col_int not in (1001,1002) order by t3.col_int,t4.column_value) b WHERE a.col_int=b.ano    
  )order by bno,bname,aname limit 25;,  
  --层次化(视图里面没有数据，查询语句看是有数据的）    
  create view view_YDBRD_21117_rtree_pre_01 as select t3.col_int, t4.column_value, t3.geom from (select t1.col_int col_int, t2.path path , st_astext(t2.geom,0) geom from tb_YDBRD_21117_ST_Dump_01 SAMPLE(99) SEED(99) T1, table(st_dump(t1.col_geom)) SAMPLE(99) SEED(99) t2) t3, table(t3.path) SAMPLE(99) SEED(99) t4 order by t3.col_int,t4.column_value;    
  select * from view_YDBRD_21117_rtree_pre_01;|  
|  
|


## Attachments:

[YDBRD-21117.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjVhMWFkOWEzMzExZGM4NGU3IiwicmVmX2lkIjoiNjczOTZiYjQ3MjgyMDZlZmI5MmYwOTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDYyLCJleHAiOjE3ODIzODI4NjJ9.2WQ2xRwWccQRoo3pmerzh9VNMbrarVnhrXILRYTntdw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-21117.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjRhMWFkOWEzMzExZGM4NGRiIiwicmVmX2lkIjoiNjczOTZiYjQ3MjgyMDZlZmI5MmYwOTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDYyLCJleHAiOjE3ODIzODI4NjJ9.DueaLeAGLZi2njU4oDJMbhOJlqnWtQIUoRyYH6sqdJA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
