Created by 李美娥 on 十一月 23, 2023

#   [1. Overview（概述）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#1-overview%E6%A6%82%E8%BF%B0)  

- ST_DWithIn函数的功能是：  将两个几何作为输入，如果几何彼此间距离在指定范围内则返回 true；否则将返回 false。几何的空间参考系统决定指定距离将应用的测量单位。因此，提供给 ST_DWithin 的几何必须使用同样的坐标投影和 SRID。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 输入为null则返回null。
- geom1与geom2的srid如果不同则报错。
- 距离的参数要大于等于0。（测试i传入0的结果：    [#1264 (st_dwithin(geog, geog, 0) doesn't work?) – PostGIS (osgeo.org)](https://trac.osgeo.org/postgis/ticket/1264)    ）
- 若存在入参是纯empty，其他入参不为null时，返回的都是false。（纯empty与任意geom的距离st_distance都是null)
- 无效的Geometry对象，不会报错。
- 支持的几何类型待补充：  未见对应资料说明，yanshan支持的7种类型实测是支持的，pg还支持curved geometries


#   [2. Grammer（语法）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#2-grammer%E8%AF%AD%E6%B3%95)  

boolean ST_DWithin(geometry g1, geometry g2, double precision distance_of_srid);  参考系定义的单位    
  boolean ST_DWithin(geography gg1, geography gg2, double precision distance_meters, boolean use_spheroid = true)  米为单位，use_spheroid默认是true，可测试其默认值    
  use_spheroid：  是否使用椭球参考系。使用椭球参考系会使得结果更精确但稍慢。

#   [3. 常用场景（接口）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#3-interfaces%E6%8E%A5%E5%8F%A3)  

应用场景：不关注实际的距离，是关注距离关系。

函数等价 st_distance（geom1,geom2) <= distance;

  [PostGIS空间关系函数_postgis空间函数_FYHannnnnn的博客-CSDN博客](https://blog.csdn.net/qq_42773863/article/details/115397237)  

#   [4. Example（用例）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#5-example%E7%94%A8%E4%BE%8B)  

```
见初验用例
<a style="text-decoration: none;" rel="nofollow" class="external-link" href="https://trac.osgeo.org/postgis/ticket/1828#no1">#1828 (Estimate returned by geography_gist_selectivity results in slow query plan for ST_DWithin) – PostGIS (osgeo.org)</a>

```

#   [5. Reference（参考文档）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#6-reference%E5%8F%82%E8%80%83%E6%96%87%E6%A1%A3)  

  [ST_DWithin—ArcMap | 文档 (arcgis.com)](https://desktop.arcgis.com/zh-cn/arcmap/latest/manage-data/using-sql-with-gdbs/st-dwithin.htm)  

  [ST_DWithin - Amazon Redshift](https://docs.aws.amazon.com/zh_cn/redshift/latest/dg/ST_DWithin-function.html)  

  [使用ST_DWithin判断两个对象之间的距离是否在指定范围之内(PostgreSQL引擎)_云原生数据库 PolarDB-阿里云帮助中心 (aliyun.com)](https://help.aliyun.com/zh/polardb/polardb-for-postgresql/st-dwithin)       --为  Geography对象时，SRID要一致

#   [6. 后续关注](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#6-reference%E5%8F%82%E8%80%83%E6%96%87%E6%A1%A3)  

（1）该函数调用时将自动包括外包框比较，该比较将利用Geometry对象上可用的任何索引。–yanshan对于其带索引的情况

select ST_DWithIn(st_geomfromtext('LINESTRING(-1 10, 100 10)', 4326),st_geomfromtext('POLYGON((0 0,0.5 0,0.5 0.5,0 1,0 0))', 4326),9,true);     --传的若是geometry，不应该有这个true参数，结果是返回false.