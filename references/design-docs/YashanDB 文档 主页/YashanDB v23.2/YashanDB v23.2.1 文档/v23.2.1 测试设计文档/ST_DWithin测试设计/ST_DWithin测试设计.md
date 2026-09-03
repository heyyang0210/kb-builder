Created by 李美娥, last modified on 十二月 06, 2023

# 1. 参考资料

        需求：    [YDBRD-22074](https://jira.yasdb.com/browse/YDBRD-22074?src=confmacro)    -  支持空间谓词ST_DWithin  完成

        开发设计：    [ST_DWithin Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/ST_DWithin+Design)  

        对外提供的函数：ST_DWithin

        函数目前支持的类型：Point、LineString（  LineRing  ）、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型

# 2.   **需求分析**

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

2.1 函数功能

    一、ST_DWithin  ：  将两个几何作为输入，如果几何彼此间距离在指定范围内则返回 true；否则将返回 false。几何的空间参考系统决定指定距离将应用的测量单位。因此，提供给 ST_DWithin 的几何必须使用同样的坐标 SRID。

             boolean ST_DWithin(geometry g1, geometry g2, double precision distance_of_srid);      参考系定义的单位

          功能表现上等价 st_distance（geom1,geom2) <= distance，后面第三个传参也要先通过st_distance算出，然后再传入一个跟距离相等、小、大的数据。

- 该函数只会计算2D，会忽略Z坐标、M属性进行计算。
- 输入为null则返回null。
- geom1与geom2的srid如果不同则报错。
- 距离的参数要大于等于0。（测试i传入0的结果：    [#1264 (st_dwithin(geog, geog, 0) doesn't work?) – PostGIS (osgeo.org)](https://trac.osgeo.org/postgis/ticket/1264)    ）
- 若存在入参是纯empty，其他入参不为null时，返回的都是false。（纯empty与任意geom的距离st_distance都是null)
- 无效的Geometry对象，不会报错。


# 3.   **测试设计方法**

等价类，边界值，场景分析。

入参为geometry类型。可以通过输入函数（st_geomFromText、st_geomFromWKB、st_geomFromEWKB、  ST_GeomFromGeoJson  ）传入,也可以是表中geometry类型的列。

- srid：  使用常用的4326（GEOGRAPHIC2D  大地坐标-经纬度） 、4327（GEOGRAPHIC3D 大地坐标-经纬度）、3857（PROJECTED   投影坐标系  **-**  米  ）  、4479（  GEOCENTRIC  大地坐标，地心参考系-米  ）、5598（COMPOUND）、0等。（    [SRID WKID 空间参考简介_srid和wkid_bigbigtree911的博客-CSDN博客](https://blog.csdn.net/bigbigtreewhu/article/details/52162277?ops_request_misc=%257B%2522request%255Fid%2522%253A%2522168197695316800188553300%2522%252C%2522scm%2522%253A%252220140713.130102334..%2522%257D&request_id=168197695316800188553300&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~sobaiduend~default-1-52162277-null-null.142^v85^insert_down1,239^v2^insert_chatgpt&utm_term=%E5%B8%B8%E7%94%A8%E7%9A%84srid&spm=1018.2226.3001.4187)    ），数据在同一srid，不同srid作为容错。ST_DWithin需要关注每类的srid。  –数据补上某个srid的边界值  ，srid不存在。
- 第一个入参和第二个入参是目前支持的7个子类型中的一个，组合后是49种。
- 超长文本入参（geom）空间关系比较
- ST_Distance跟pg存在差异的，也会导致ST_DWithin存在差异  电


      复用空间函数的数据+rtree的数据，数据含如下特点：（n  ull和空串，含empty、  nan inf -inf、  构造的数据误差范围：  小数点后面15位，  15位内没有差异，16位A比B多或者少，查看结果的正确性。）

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

函数的测试点本质同内置函数，参考    [*内置函数测试设计checklist - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929071)    的测试点，进行设计。(作为查询条件要着重测试）

|  
|第一个参数|第二个参数|第三个参数|
|:---|:---|:---|:---|
|1|两个参数的SRID不同,两个参数的SRID相同（常用的srid，srid不存在）||st_distance(col_geom1,col_geom2)或者直接常量数据（主要是常量数据：double边界、科学计数法数据、nan Inf等特殊值）|
|2|点在线或面内,线在某根线上或者线间相交,面在一个面内或相交,（集合是从所有里面的元素挑选一个最近点跟第二个geom)|||
|3|其他测试点，参考内置函数|||
|4|投影坐标：,2个对象的距离跟第三个参数的差值，小于float的最小值,2个对象的距离跟第三个参数的和，大于float的最大值    补充：走索引的时候，第三个参数大于float的上下限时候，要测试下，会处理成float的边界值。第三个参数尽量小一点，大的一般不出问题，小的容易出问题。,大地坐标：  如果范围超过经纬度，则用超过的值|||
|  
|补充：,同一份数据，带索引和不带索引的结果要一样。,对比的大地数据，不要用维度特别高的。（经纬度跨度大，但是不能用接近边界的值）|||


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|是|
|HA|是|
|压力|否|
|性能|是|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例

子表格

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

# **8. 差异点记录与疑问**

pg与yanshan本身ST_Distance存在的差异，也会导致ST_Dwithin存在差异：

1、超出某个srid坐标系的值，内部是如何处理的，会转换为srid的边界值吗

select st_distance(st_geomfromtext('LINESTRING(0.5 0.5, 10 10)',4326)::geography,st_geomfromtext('GEOMETRYCOLLECTION(LINESTRING(0.6 0.6, 1 1),MULTILINESTRING((3 3, 4 4),(100 100, 1000 1000)))',4326)::geography); 

insert into tb_YDBRD_22074_rtree_pre_01(col_int,col_geom) values(307, st_geomfromtext('MULTILINESTRING((-100 -90, 180 90), (1 1, 2 2), EMPTY,(180 90,0 -90))', 4326));

pg是报错：  Coordinate values were coerced into range [-180   ~~90, 180 90] for GEOGRAPHY，我们yashan会把这些的距离处理为0，后面st_dwithin呢，这些数据如何处理？~~   

select st_distance(st_geomfromtext('LINESTRING(0.5 0.5, 10 10)',4326),st_geomfromtext('GEOMETRYCOLLECTION(LINESTRING(0.6 0.6, 1 1),MULTILINESTRING((3 3, 4 4),(100 100, 1000 1000)))',4326)) from dual;

2、st_distance的差异点，结果不一致

yanshan    
            select st_distance( st_geomfromtext('POINT(5E-3 5E-3)',4326), st_geomfromtext('POLYGON M ((0 0 78 ,-1.79769313486232E308 -4.94065645841247E-324 78,10 10 78 ,0 10 78 ,0 0 78 ))',4326)) from dual;  返回0

          select st_distance(st_geomfromtext('MULTILINESTRING(( -10000 0, 30000 0),( 30000 30000, -10000 30000), (-200000 30000 ,-10000 0))',4326),st_geomfromtext('LINESTRING(0 0 0, 2000 0 0, 2000 0 0, 2000 2000 0, 2000 2000 0, 0 2000 0, 0 2000 0, 0 0 0)',4326)) from dual;  返回的是7.491E+006

         pg:    
           select st_distance( st_geomfromtext('POINT(5E-3 5E-3)',4326)::geography, st_geomfromtext('POLYGON M ((0 0 78 ,-1.79769313486232E308 -4.94065645841247E-324 78,10 10 78 ,0 10 78 ,0 0 78 ))',4326)::geography) 返回的是556.59745186

         select st_distance(st_geomfromtext('MULTILINESTRING(( -10000 0, 30000 0),( 30000 30000, -10000 30000), (-200000 30000 ,-10000 0))',4326)::geography,st_geomfromtext('LINESTRING(0 0 0, 2000 0 0, 2000 0 0, 2000 2000 0, 2000 2000 0, 0 2000 0, 0 2000 0, 0 0 0)',4326)::geography)  返回的是0

|序号|描述|
|---|---|
|3待确认  （不解决，遗留）|drop table if exists bakbaktb_YDBRD_22074_rtree_pre_01;    
  CReATE TABLE bakbaktb_YDBRD_22074_rtree_pre_01 (col_int int, col_geom geometry);    
  create rtree index bakindex_YDBRD_22074_rtree_pre_01 on bakbaktb_YDBRD_22074_rtree_pre_01 (col_geom);    
  insert into bakbaktb_YDBRD_22074_rtree_pre_01(col_int,col_geom) values(403, st_geomfromtext('POLYGON((-100 0,-30.9000 0,-50.8999 89,0 -88.87666, -100 0))', 4326));    
  select a.col_int from bakbaktb_YDBRD_22074_rtree_pre_01 a where ST_DWithin (a.col_geom, st_geomfromtext('MULTIPOINT(0.5 0.5,6 6)', 4326),47.75693526055696) and col_int =403 order by a.col_int;    
  select a.col_int from bakbaktb_YDBRD_22074_rtree_pre_01 a where ST_DWithin (a.col_geom::geography, st_geomfromtext('MULTIPOINT(0.5 0.5,6 6)', 4326)::geography,47.75693526055696) and col_int =403 order by a.col_int;,403和1002都有差异,select a.col_int from tb_YDBRD_22074_rtree_pre_01 a where ST_DWithin (a.col_geom, st_geomfromtext('POINT(16 16)', 4326),1.401298E-45) order by a.col_int;   --比pg少403和1002,  
|
|4待确认,已提单    [YDBRD-23753](https://jira.yasdb.com/browse/YDBRD-23753)    （问题单更改后还会差3条，保持差异），st_distance造成的差异，保持差异，不管|select a.col_int from tb_YDBRD_22074_rtree_pre_01 a where ST_DWithin (st_geomfromtext('POLYGON((-180 0,30.90 0,50.8999 89,0 88.87666, -180 0))', 4326),a.col_geom,80) order by a.col_int;    
  select a.col_int from tb_YDBRD_22074_rtree_pre_01 a where ST_DWithin (st_geomfromtext('POLYGON((-180 0,30.90 0,50.8999 89,0 88.87666, -180 0))', 4326)::geography,a.col_geom::geography,80) order by a.col_int; --第一个无索引，返回26，有索引返回15，pg是返回51（pg和yanshan都是58条数据）,不带索引存在差异，验证是st_distance差异导致,select a.col_int, ST_distance(st_geomfromtext('POLYGON((-180 0,30.90 0,50.8999 89,0 88.87666, -180 0))', 4326),a.col_geom) from tb_YDBRD_22074_rtree_pre_01 a order by a.col_int;,select a.col_int, ST_distance(st_geomfromtext('POLYGON((-180 0,30.90 0,50.8999 89,0 88.87666, -180 0))', 4326),a.col_geom) from tb_YDBRD_22074_rtree_pre_01 a order by a.col_int;|
|5第二个语句未走算子，已提单    [YDBRD-23673](https://jira.yasdb.com/browse/YDBRD-23673)  |explain select a.col_int,b.col_int from tb_YDBRD_22074_rtree_pre_01 a, tb_YDBRD_22074_rtree_pre_02 b where ST_DWithin (a.col_geom, b.col_geom,30)and st_distance(a.col_geom, b.col_geom) !=0;,explain select a.col_int,b.col_int from tb_YDBRD_22074_rtree_pre_01 a, tb_YDBRD_22074_rtree_pre_02 b where ST_DWithin (b.col_geom, a.col_geom,30)and st_distance(a.col_geom, b.col_geom) !=0;,![](https://pingcode.yasdb.com/atlas/files/public/67396b928970c2af4f52057c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)|
|6这个是yashan更合理是吗,（  保持差异  ）|drop table if exists tb_YDBRD_22074_ST_DWithin_46;    
  CReATE TABLE tb_YDBRD_22074_ST_DWithin_46 (col_int int, col_var varchar(32000), col_geom geometry, col_geom_2 geometry);    
  create rtree index index_YDBRD_22074_ST_DWithin_46 on tb_YDBRD_22074_ST_DWithin_46 (col_geom_2);,insert into tb_YDBRD_22074_ST_DWithin_46(col_int,col_var,col_geom,col_geom_2) values(2, '09982', st_geomfromtext('POINT ZM(4 4 6 10)', 4326), st_geomfromtext('MULTIPOINT((-15 -15), (5 5), EMPTY)', 4326));,insert into tb_YDBRD_22074_ST_DWithin_46(col_int,col_var,col_geom,col_geom_2) values(207, '123', st_geomfromtext('LINESTRING Z(1 2 5 , 7 8 9 ,2.09887763434 3.9 4.98876665 , 89 90 91)', 4326), st_geomfromtext('MULTILINESTRING((0 0, 2 0), (1 1, 2 2), EMPTY)', 4326));    
  insert into tb_YDBRD_22074_ST_DWithin_46(col_int,col_var,col_geom,col_geom_2) values(208, '0--=',st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY, (-80 -76.8767445454))', 4326), st_geomfromtext('LINESTRING M(1 2 3,2.98656565 3.9 4, 6 7 8)', 4326));,insert into tb_YDBRD_22074_ST_DWithin_46(col_int,col_var,col_geom,col_geom_2) values(205, '7845', st_geomfromtext('LINESTRING EMPTY', 4326),st_geomfromtext('MULTILINESTRING((-100 -90, 180 90), (1 1, 2 2), EMPTY,(180 90,0 -90))', 4326));,select col_int,st_distance(col_geom,col_geom_2) from tb_YDBRD_22074_ST_DWithin_46 where col_int =2 order by col_int;,COL_INT ST_DISTANCE(COL_GEOM    
  ------------ --------------------    
  2 1.567E+005,1 row fetched.,select col_int,ST_DWithin(col_geom,col_geom_2,1.5) from tb_YDBRD_22074_ST_DWithin_46 where col_int =2 order by col_int;,COL_INT ST_DWITHIN(COL_GEOM,    
  ------------ --------------------    
  2 false,1 row fetched.,pg:,select col_int,st_distance(col_geom::geography,col_geom_2::geography) from tb_YDBRD_22074_ST_DWithin_46 where col_int =2 order by col_int;返回156665.64184753,select col_int,ST_DWithin(col_geom::geography,col_geom_2::geography,1.5) from tb_YDBRD_22074_ST_DWithin_46 where col_int =2 order by col_int;,报错：  ERROR: 错误: lwgeom_distance_spheroid returned negative!,207，208，pg也是报错。205是ST_distance有差异，导致这个函数计算有差异|
|8不走算子，已发开发,（  已确认，跟5是一个问题  ）|update tb_YDBRD_22074_ST_DWithin_45 set col_geom_2 = st_geomfromtext('MULTIPOLYGON (((0 0, 0 10, 10 10, 10 0, 0 0)), ((15 15,15 20,20 20,20 15,15 15)), ((2 2, 2 8, 8 8, 8 2, 2 2)))', 4326) where exists(select col_geom from tb_YDBRD_22074_rtree_pre_01 WHERE ST_DWithin (col_geom,st_geomfromtext('POLYGON((-80 0,30.90 0,50.8999 89,0 88.87666, -80 0))', 4326),0));,改造成ST_CONTAINS也不走，主干ST_CONTIANS此语句走算子|
|9索引会概率失效，最基本的语句都是失效的,--李坤宇在看|环境上表有索引，但是会概率出现，索引失效,![](https://pingcode.yasdb.com/atlas/files/public/67396b928970c2af4f52057d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro),![](https://pingcode.yasdb.com/atlas/files/public/67396b92a1ad9a3311dc83f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro),select a.col_int from tb_YDBRD_22074_rtree_pre_01 a where ST_DWithin (a.col_geom, st_geomfromtext('LINESTRING(-1 -1, -1.79769313486232E308 -4.94065645841247E-324)', 4326),7122872.662721755) order by a.col_int;|
|10第三个参数，传入的是同一个值，投影坐标报错，大地坐标不再报错，已提单,1.   [YDBRD-23694](https://jira.yasdb.com/browse/YDBRD-23694)  
|应用场景应该不多，是否保持差异,select ST_DWithin(a.col_geom,b.col_geom,1.79769313486232E308) from (select col_geom from tb_YDBRD_22074_rtree_pre_01 where col_int=1001) as a, (select col_geom from tb_YDBRD_22074_rtree_pre_01 where col_int=1) as b;  返回true,我们的srid是投影坐标时，报错,![](https://pingcode.yasdb.com/atlas/files/public/67396b928970c2af4f52057f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro),drop table if exists tb_YDBRD_22074_ST_DWithin_04;    
  CReATE TABLE tb_YDBRD_22074_ST_DWithin_04 (col_int int, col_geom geometry);    
  create rtree index index_YDBRD_22074_ST_DWithin_04 on tb_YDBRD_22074_ST_DWithin_04 (col_geom);    
  insert into tb_YDBRD_22074_ST_DWithin_04(col_int,col_geom) values(1, st_geomfromtext('POINT(-20037508.34 -20048966.1)', 3857));    
  insert into tb_YDBRD_22074_ST_DWithin_04(col_int,col_geom) values(2, st_geomfromtext('POINT ZM(20037508.34 20048966.1 6 10)', 3857));    
  select a.col_int,b.col_int from tb_YDBRD_22074_ST_DWithin_04 a, tb_YDBRD_22074_ST_DWithin_04 b where a.col_int=1 and b.col_int=2 and ST_DWithin(a.col_geom,b.col_geom,1.79769313486232E308);,pg均是报错：select ST_DWithin(a.col_geom::geography,b.col_geom::geography,1.79769313486232E308) from (select col_geom from tb_YDBRD_22074_rtree_pre_01 where col_int=1001) as a, (select col_geom from tb_YDBRD_22074_rtree_pre_01 where col_int=1) as b;|
|12我们比pg多1002数据，是pg异常？|SQL> select a.col_int,c.col_int from tb_YDBRD_22074_rtree_pre_01 a join tb_YDBRD_22074_rtree_pre_01 c on ST_DWithin (a.col_geom, st_geomfromtext('MULTIPOINT(25 25,6 6)', 4326),9.9999999) = ST_Touches (st_geomfromtext('MULTIPOINT(50 5,60 6)', 4326),c.col_geom) where a.col_int =1002 and c.col_int between 1 and 100 order by a.col_int,c.col_int;,COL_INT COL_INT    
  ------------ ------------    
  1002 1    
  1002 2    
  1002 7,3 rows fetched.,select a.col_int,c.col_int from tb_YDBRD_22074_rtree_pre_01 a join tb_YDBRD_22074_rtree_pre_01 c on ST_DWithin (a.col_geom::geography, st_geomfromtext('MULTIPOINT(25 25,6 6)', 4326)::geography,9.9999999) = ST_Touches (st_geomfromtext('MULTIPOINT(50 5,60 6)', 4326),c.col_geom) where a.col_int = 1002 and c.col_int between 1 and 100 order by a.col_int,c.col_int;,pg单独只能出来1002 1，若不限定的条件1002去掉，1002相关的记录都出不来，这个是pg有问题吗|
|13 无索引数据跟Pg一致，有索引会少，hi是4327坐标系，保持差异|drop table if exists tb_YDBRD_22074_ST_DWithin_01;    
  CReATE TABLE tb_YDBRD_22074_ST_DWithin_01(col_int integer, col_geom geometry) ;    
  create rtree index index_YDBRD_22074_ST_DWithin_01 on tb_YDBRD_22074_ST_DWithin_01 (col_geom);    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(1,st_geomfromtext('POINT(-180 -90)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(2,st_geomfromtext('POINT(-180 90)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(3,st_geomfromtext('POINT(180 -90)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(4,st_geomfromtext('POINT(180 90)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(5,st_geomfromtext('POINT(-180 0)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(6,st_geomfromtext('POINT(180 0)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(7,st_geomfromtext('POINT(0 -90)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(8,st_geomfromtext('POINT(0 90)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(9,st_geomfromtext('POINT(0 0)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(10,null);    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(11,st_geomfromtext('POINT(0 0.159876)', 4327));    
  insert into tb_YDBRD_22074_ST_DWithin_01 values(12,st_geomfromtext('POINT(0.159876 0)', 4327));    
  select a.col_int,b.col_int from tb_YDBRD_22074_ST_DWithin_01 a,tb_YDBRD_22074_ST_DWithin_01 b where ST_DWithin(a.col_geom,b.col_geom,0.159876) order by a.col_int,b.col_int;|
|14test_sdv_YDBRD_22074_ST_DWithin_10里面的plsql访问数据，有索引无索引，存在差异，简化后的用例  （保持差异）|select a.col_int as var_1,b.col_int as var_2 ,ST_DWithin(a.col_geom, b.col_geom,1.77890990) as result from tb_YDBRD_22074_rtree_pre_01 as a, tb_YDBRD_22074_rtree_pre_01 as b where ST_Covers(a.col_geom, b.col_geom) and ST_DWithin(a.col_geom, b.col_geom,1.77890990) order by a.col_int,b.col_int;,新包比旧包少了很多数据,![](https://pingcode.yasdb.com/atlas/files/public/67396b92a1ad9a3311dc83f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)|
|15用例35，不规范的数据，目前最新结果正常（不规范化，之前的数据很大，外包框就不会过滤掉了，现在规范化，之后可能就直接筛选掉了）|select /*+NO_INDEX_FFS(a)*/ col_int from tb_YDBRD_22074_rtree_pre_01 where ST_DWithin(st_geomfromtext('MULTIPOLYGON (((20 0 ,300000 0,300000 10000000 ,20 10000000,20 0 ),(-5 -5 ,-6000 -5 ,-6000 -6000 ,-5000 -6000 ,-5 -5 )))',4326),col_geom,4142801.8597047804) and ST_distance(st_geomfromtext('MULTIPOLYGON (((20 0 ,300000 0,300000 10000000 ,20 10000000,20 0 ),(-5 -5 ,-6000 -5 ,-6000 -6000 ,-5000 -6000 ,-5 -5 )))',4326),col_geom)!=0 order by col_int;,![](https://pingcode.yasdb.com/atlas/files/public/67396b92a1ad9a3311dc83f6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro),  
,  
|


# 9、性能

参数和数据同    [gis的rtree性能测试报告 - 李美娥 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130129997)    ，大地坐标，我们走索引的情况：

（1）ST_DWithin在yanshan走索引，pg不走索引的情况

|  
|1|2|3|
|---|---|---|---|
|yanshan|00:01:44.993|00:01:43.222|00:01:43.480|
|pg|00:00:56.341|00:00:56.214|00:00:55.953|


yashan：00:01:44.993

pg：00:00:55.863

yanshan的截图

![](https://pingcode.yasdb.com/atlas/files/public/67396b928970c2af4f520581/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)

pg的截图

![](https://pingcode.yasdb.com/atlas/files/public/67396b92a1ad9a3311dc83f7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)

（2）  ST_ContainsProperly的情况

select /*+leading(c) use_nl(a)*/ a.OGR_FID,c.OGR_FID from GIS_OSM_ROADS_FREE_1 a, WORLD_LAKES c where ST_ContainsProperly(c.YAS_GEOMETRY,a.YAS_GEOMETRY);

select a.gid,c.gid from GIS_OSM_ROADS_FREE_1 a, WORLD_LAKES c where ST_ContainsProperly(c.geom,a.geom);

|  
|1|2|3|
|---|---|---|---|
|yanshan|00:00:00.016|00:00:00.004|00:00:00.005|
|pg|4.189 ms|2.968 ms|3ms|


（3）3857投影坐标，均使用索引时，ST_DWITHIN情况

|  
|1|2|3|
|---|---|---|---|
|yanshan|00:00:00.042|00:00:00.009|00:00:00.009|
|pg|19.738 ms|19.637 ms|19.295 ms|


yanshan截图

![](https://pingcode.yasdb.com/atlas/files/public/67396b92a1ad9a3311dc83f8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)

pg截图

![](https://pingcode.yasdb.com/atlas/files/public/67396b92a1ad9a3311dc83f9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)

（4）3的基础上，去掉索引的测试情况

|  
|1|2|3|
|---|---|---|---|
|yanshan|00:00:00.099|00:00:00.068|00:00:00.068|
|pg|205.188 ms|241.944 ms|207.345 ms|


yanshan截图

![](https://pingcode.yasdb.com/atlas/files/public/67396b928970c2af4f520582/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)

pg截图

![](https://pingcode.yasdb.com/atlas/files/public/67396b92a1ad9a3311dc83fa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)

（5）3的基础上，表的数据量大，采用的是大表GIS_OSM_ROADS_FREE_1的数据，改造成3857。

|  
|1|2|3|
|---|---|---|---|
|yanshan|00:00:02.171|00:00:02.119|00:00:02.178|
|pg|00:00:03.186|00:00:01.481|00:00:01.398|


yanshan：

![](https://pingcode.yasdb.com/atlas/files/public/67396b938970c2af4f520583/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)

pg：

![](https://pingcode.yasdb.com/atlas/files/public/67396b938970c2af4f520584/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFRUFCQUlFQUFBUUFFQUFBQUFBQUFBQUFBZ0FBSUFJQUFTQUFRZ0FFQUFCQWdBQUlFSUJBQ1FBQUFBQUFBQVFBQUFnQUFBQUNBRUFLU0FBQUVBQUFJQUFBQUFnQUFBQ2tBZ0FBQWhBQUFvQUFBRWtBQUFnUkFBQUNnaElBQUFBQ0FBQUVBQUFBQUFBQUJRQUFRS0FnQlFBQWdBQUFBQkFBQUNBQkFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1MzYsImV4cCI6MTc4MjMwNjMzNn0.k6UsQpso2SYFMbqcXP-_gvTWmPYiWK2oqszLta6I0ro)

## Attachments:

[image2023-11-30_10-6-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTE4OTcwYzJhZjRmNTIwNTZmIiwicmVmX2lkIjoiNjczOTZiOTA3MjgyMDZlZmI5MmYwN2FiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTM2LCJleHAiOjE3ODIzODE5MzZ9.duHgFKAGxC1OcAqauc1E-b_AFmrdrHw64xdBWsQMsKM)

 (image/png)    


[image2023-11-30_10-27-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTE4OTcwYzJhZjRmNTIwNTcwIiwicmVmX2lkIjoiNjczOTZiOTA3MjgyMDZlZmI5MmYwN2FiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTM2LCJleHAiOjE3ODIzODE5MzZ9.RMh3Wh2IumlMzzaz4PnHWQxqIAkDT8NRJW3T3grDhFs)

 (image/png)    


[image2023-11-30_19-25-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTE4OTcwYzJhZjRmNTIwNTc0IiwicmVmX2lkIjoiNjczOTZiOTA3MjgyMDZlZmI5MmYwN2FiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTM2LCJleHAiOjE3ODIzODE5MzZ9.zZhnRs2T2NBrXdKcTKA5gB11pojoGwD5s6QUC17R3ec)

 (image/png)    


[image2023-12-4_15-10-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTE4OTcwYzJhZjRmNTIwNTc1IiwicmVmX2lkIjoiNjczOTZiOTA3MjgyMDZlZmI5MmYwN2FiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTM2LCJleHAiOjE3ODIzODE5MzZ9.TM_QRUYWXUGKZaTAZgMfnZsX0YtHgmLAoUiqG8i6dxY)

 (image/png)    


[image2023-12-5_14-30-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTFhMWFkOWEzMzExZGM4M2U5IiwicmVmX2lkIjoiNjczOTZiOTA3MjgyMDZlZmI5MmYwN2FiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTM2LCJleHAiOjE3ODIzODE5MzZ9.ipgvQV0hCMoH_MoUurRipWGEgMC9srR_2Wlie8w5XIE)

 (image/png)    


[image2023-12-5_14-34-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTFhMWFkOWEzMzExZGM4M2VhIiwicmVmX2lkIjoiNjczOTZiOTA3MjgyMDZlZmI5MmYwN2FiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTM2LCJleHAiOjE3ODIzODE5MzZ9.gU_mx8uHX3G_SmWzGLHvKsDhEbhdgQmiiCP-JpEDbKI)

 (image/png)    


[image2023-12-5_14-58-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTE4OTcwYzJhZjRmNTIwNTc2IiwicmVmX2lkIjoiNjczOTZiOTA3MjgyMDZlZmI5MmYwN2FiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTM2LCJleHAiOjE3ODIzODE5MzZ9.YagpChMKz5vZCyY3Qu9Ggjs09fNaozcsKAeTGnQfZaY)

 (image/png)    
